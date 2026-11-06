import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { createCopilotTools } from './copilot-tools.mjs';
import { authorizeTelegramMessages, normalizeTelegramChatId } from './copilot-telegram-auth.mjs';
import { createCopilotCompanyAccess } from './copilot-company-access.mjs';
import { createCopilotTrainingProposals } from './copilot-training-proposals.mjs';
import { canUseCopilotTool, getCopilotDate, getEnabledCopilotDeclarations, runEnabledCopilotTool } from './copilot-tool-policy.mjs';
import { createCopilotConversation } from './copilot-conversation.mjs';
import { createTelegramDocumentSender, createTelegramMessageSender } from './copilot-telegram-sender.mjs';
import { createCopilotEntryForms } from './copilot-entry-forms.mjs';
import { generateWorkerStatementPdf, generateEngineeringChecklistPdf } from './pdf-generator.mjs';
import {
  FUNCTION_DECLARATIONS, GEMINI_GENERATE_URL, MODEL_MESSAGES, MODEL_TIMEOUT_MS,
  buildModelRequest, buildSystemInstructions, interpretModelParts,
} from './copilot-prompt.mjs';
import {
  PDF_MESSAGES, createPdfRequestLog, createPendingPdfRequests, executePdfRequest, parsePdfRequest, preparePdfRequest,
} from './copilot-pdf-requests.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env.local without external dependencies
function loadEnvLocal() {
  const envPath = path.join(rootDir, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim().replace(/^\uFEFF/, '');
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnvLocal();
const setting = name => process.env[name] ?? env[name];
const BOT_TOKEN = setting('TELEGRAM_BOT_TOKEN');
const CHAT_ID = normalizeTelegramChatId(setting('TELEGRAM_COPILOT_CHAT_ID') ?? setting('TELEGRAM_CHAT_ID'));
const GEMINI_API_KEY = setting('GEMINI_API_KEY');
const SUPABASE_URL =
  setting('SUPABASE_URL') || setting('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_PUBLIC_KEY = setting('COPILOT_SUPABASE_PUBLIC_KEY') ||
  setting('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || setting('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  setting('SUPABASE_ANON_KEY');
const LIVE_READS_ENABLED = setting('COPILOT_ENABLE_LIVE_READS') === 'true';

/**
 * Enriches a raw access object from resolveCompanyAccess() with the fields
 * required by copilot-tool-policy.mjs: companyName and permissions.
 * Falls back to env var and a permissive default so tools are reachable.
 */
function enrichAccess(raw) {
  if (!raw) return null;
  return {
    ...raw,
    companyName: raw.companyName ?? setting('COPILOT_COMPANY_NAME') ?? null,
    // Fail closed: only the permissions verified from profiles.permissions; never a permissive default.
    permissions: raw.permissions && typeof raw.permissions === 'object' && !Array.isArray(raw.permissions)
      ? raw.permissions : {},
  };
}

if (!BOT_TOKEN) {
  console.error('❌ خطأ: TELEGRAM_BOT_TOKEN غير موجود في ملف .env.local');
  process.exit(1);
}

if (CHAT_ID === null) {
  console.error('اضبط TELEGRAM_COPILOT_CHAT_ID على معرّف محادثة خاصة قبل تشغيل البوت.');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.warn('⚠️ تحذير: GEMINI_API_KEY غير موجود في .env.local.');
}

console.log('🤖 بدء تشغيل المساعد الذكي لنظام فاي تك (PHI TECH Telegram Copilot)...');

const KNOWLEDGE_PATH = path.join(rootDir, 'config', 'copilot_knowledge.md');
const SCENARIOS_PATH = path.join(rootDir, 'config', 'copilot_page_scenarios.md');
const CHECKLIST_PATH = path.join(rootDir, 'config', 'copilot_engineering_checklists.md');
const trainingProposals = createCopilotTrainingProposals(path.join(rootDir, 'work', 'copilot-training-proposals.json'));
const conversation = createCopilotConversation({
  maxTurns: 6,            // TODO: env — COPILOT_MAX_TURNS
  ttlMs:  30 * 60 * 1000, // TODO: env — COPILOT_CONV_TTL_MS (30 min default)
});
const entryForms = createCopilotEntryForms();

// ─── PDF confirmation state ──────────────────────────────────────────────────
// (chatId, userId) → { type, params, label, createdAt }
// Cleared on /confirm, /cancel, /new, /reset, or TTL expiry (swept every minute below).
const PDF_PENDING_TTL_MS = 10 * 60 * 1000; // 10 min // TODO: env — COPILOT_PDF_PENDING_TTL_MS
const pendingPdfRequests = createPendingPdfRequests({ ttlMs: PDF_PENDING_TTL_MS });
// Durable log of confirmed requests (status + timings only — no file content or worker data).
const pdfRequestLog = createPdfRequestLog({ filePath: path.join(rootDir, 'work', 'copilot-pdf-requests.json') });
const resolveCompanyAccess = createCopilotCompanyAccess({
  supabaseUrl: SUPABASE_URL,
  publicKey: SUPABASE_PUBLIC_KEY,
  email: setting('COPILOT_SUPABASE_EMAIL'),
  password: setting('COPILOT_SUPABASE_PASSWORD'),
  companyId: setting('COPILOT_COMPANY_ID'),
  createClient,
});

// ─── PDF helpers (parsing/execution live in copilot-pdf-requests.mjs) ────────

// Document sends are classified sent / failed / uncertain (see copilot-telegram-sender.mjs).
const sendTelegramDocument = createTelegramDocumentSender({ botToken: BOT_TOKEN });

/** Runs a confirmed /pdf request: fresh access check at execution time + the shared executor. */
function runConfirmedPdf(pending, actor, chatId, messageId) {
  return executePdfRequest(pending, {
    actor,
    log: pdfRequestLog,
    resolveAccess: async () => (LIVE_READS_ENABLED ? enrichAccess(await resolveCompanyAccess()) : null),
    createTools: access => createCopilotTools({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_PUBLIC_KEY,
      accessToken: access?.accessToken,
      companyId: access?.companyId,
    }),
    generateWorkerStatementPdf,
    generateEngineeringChecklistPdf,
    sendDocument: (buffer, filename, caption) => sendTelegramDocument(chatId, buffer, filename, caption, messageId),
    companyNameFallback: setting('COPILOT_COMPANY_NAME') ?? 'فاي تك',
  });
}

// 📚 تحميل دليل المعرفة الثابت — singleton cached at startup
let _cachedKnowledgeBase = null;

function loadKnowledgeBase(forceReload = false) {
  if (!forceReload && _cachedKnowledgeBase !== null) return _cachedKnowledgeBase;
  let combined = '';
  try {
    if (fs.existsSync(KNOWLEDGE_PATH)) {
      combined += fs.readFileSync(KNOWLEDGE_PATH, 'utf8').trim() + '\n\n';
    }
    if (fs.existsSync(SCENARIOS_PATH)) {
      combined += fs.readFileSync(SCENARIOS_PATH, 'utf8').trim() + '\n\n';
    }
    if (fs.existsSync(CHECKLIST_PATH)) {
      combined += fs.readFileSync(CHECKLIST_PATH, 'utf8').trim() + '\n\n';
    }
  } catch (err) {
    console.warn('Error loading knowledge base:', err.message);
    if (_cachedKnowledgeBase !== null) return _cachedKnowledgeBase; // keep old cache on error
    return '';
  }
  _cachedKnowledgeBase = combined.trim();
  return _cachedKnowledgeBase;
}

function initKnowledgeBase() {
  loadKnowledgeBase(true);
  console.log('📚 Knowledge base loaded:', _cachedKnowledgeBase.length, 'chars');
}

// FUNCTION_DECLARATIONS and the system prompt live in copilot-prompt.mjs (shared with the eval runner).

const sendTelegramMessage = createTelegramMessageSender({
  botToken: BOT_TOKEN,
  onFailure: ({ status, errorCode, sentParts }) => {
    console.warn('Telegram did not confirm reply delivery.', { status, errorCode, sentParts });
  },
});

// Send typing action
async function sendChatAction(chatId, action = 'typing') {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
      signal: AbortSignal.timeout(3500),
    });
  } catch {}
}

// The model gets recent turns in this identity scope, never database tool results.
function conversationScope(access, declarations) {
  if (!access) return 'general';
  return [access.userId, access.companyId, declarations.map(tool => tool.name).sort().join(',')].join(':');
}

async function processUserPromptWithGemini(userPrompt, actor) {
  if (!GEMINI_API_KEY) return { text: 'خدمة الرد الذكي مش مفعّلة في إعدادات البوت.' };

  const access = LIVE_READS_ENABLED ? enrichAccess(await resolveCompanyAccess()) : null;
  const declarations = getEnabledCopilotDeclarations(FUNCTION_DECLARATIONS, access);
  const scope = conversationScope(access, declarations);
  const context = conversation.getContext({ ...actor, scope });
  const memory = { scope, parentMessageId: context.parentMessageId };
  const systemInstructions = buildSystemInstructions({
    knowledge: loadKnowledgeBase(),
    declarations,
    referenceMissing: context.referenceMissing,
    date: getCopilotDate(),
  });

  try {
    const response = await fetch(GEMINI_GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(buildModelRequest({
        systemInstructions,
        contents: [...context.contents, { role: 'user', parts: [{ text: userPrompt }] }],
        declarations,
      })),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn('Copilot model request failed.', { status: response.status });
      return { text: MODEL_MESSAGES.unavailable };
    }
    const responseBody = await response.json();
    const reply = interpretModelParts(responseBody.candidates?.[0]?.content?.parts, declarations);
    if (reply.type === 'multi') return { text: MODEL_MESSAGES.multipleCalls };
    if (reply.type === 'undeclared') return { text: MODEL_MESSAGES.undeclared };
    if (reply.type === 'tool') {
      const call = reply.call;
      const verified = call.name === 'get_engineering_checklist_and_specs'
        ? null
        : enrichAccess(await resolveCompanyAccess());
      if (call.name !== 'get_engineering_checklist_and_specs' &&
        scope !== conversationScope(verified, getEnabledCopilotDeclarations(FUNCTION_DECLARATIONS, verified))) {
        conversation.clear(actor);
        return { text: 'التحقق من الشركة أو صلاحية الاستعلام اتغيّر. اكتب طلبك من جديد بعد ما تراجع الإعدادات.' };
      }
      const tools = createCopilotTools({
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_PUBLIC_KEY,
        accessToken: verified?.accessToken,
        companyId: verified?.companyId,
      });
      return {
        text: await runEnabledCopilotTool(call, tools, verified),
        memory: { ...memory, toolName: call.name },
      };
    }
    if (reply.type === 'text') {
      return { text: MODEL_MESSAGES.generalPrefix + reply.text, memory: { ...memory, modelText: reply.text } };
    }
  } catch {
    console.error('Copilot response failed.');
  }
  return { text: MODEL_MESSAGES.fallback };
}

// Format markdown/plain text to Telegram HTML safe
function escapeTelegramText(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Process incoming Telegram update
const handleUpdate = authorizeTelegramMessages(CHAT_ID, async msg => {
  const chatId = msg.chat?.id;
  let rawText = String(msg.text || msg.caption || '').trim();
  const messageId = msg.message_id;
  const fromName = escapeTelegramText(msg.from.first_name || 'صديقي');
  const actor = {
    chatId,
    userId: msg.from.id,
    replyToMessageId: msg.reply_to_message?.chat?.id === chatId ? msg.reply_to_message.message_id : undefined,
  };

  const entryText = typeof msg.text === 'string' ? msg.text.trim().replace(/^(\/[a-z]+)@phitechbot(?=\s|$)/i, '$1') : '';
  const entry = entryForms.handle(actor, entryText);
  if (entry) {
    await sendTelegramMessage(chatId, entry.text, messageId, { html: false, replyMarkup: entry.replyMarkup });
    return;
  }

  // 🎙️ معالجة الرسائل الصوتية (Voice Notes) فورياً عبر Groq Whisper Large V3
  if ((msg.voice || msg.audio) && BOT_TOKEN) {
    const fileId = msg.voice?.file_id || msg.audio?.file_id;
    const groqKey = setting('GROQ_API_KEY');

    if (fileId && groqKey) {
      try {
        await sendChatAction(chatId, 'record_voice');
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`, { signal: AbortSignal.timeout(12000) });
        const fileInfo = await fileInfoRes.json();

        if (fileInfo.ok && fileInfo.result?.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
          const audioRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(12000) });
          if (!audioRes.ok) throw new Error('Telegram audio unavailable');
          const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

          const whisperForm = new FormData();
          whisperForm.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'telegram_voice.oga');
          whisperForm.append('model', 'whisper-large-v3-turbo');
          whisperForm.append('language', 'ar');

          const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${groqKey}` },
            body: whisperForm,
            signal: AbortSignal.timeout(25000),
          });

          const whisperJson = await whisperRes.json();
          if (whisperJson?.text) {
            rawText = whisperJson.text.trim();
            await sendTelegramMessage(chatId, `🎙️ <i>سمعتك تقول: "${escapeTelegramText(rawText.slice(0, 600))}"</i>\n\n⏳ <i>جاري معالجة طلبك...</i>`, messageId);
          }
        }
      } catch {
        console.error('Telegram voice processing failed.');
      }
    }
  }

  if (!rawText) {
    await sendTelegramMessage(chatId, msg.voice || msg.audio
      ? 'ما قدرتش أقرأ التسجيل. ابعته تاني أو اكتب طلبك.'
      : 'ابعت سؤالك كنص أو تسجيل صوتي عشان أقدر أساعدك.', messageId);
    return;
  }

  try {
    let cleanText = rawText.replace(/@phitechbot/gi, '').trim();
    if (['/new', '/reset'].includes(cleanText.toLowerCase())) {
      pendingPdfRequests.delete(actor);
      conversation.clear(actor);
      entryForms.clear(actor);
      await sendTelegramMessage(chatId, 'بدأنا محادثة جديدة. ابعت سؤالك.', messageId, { replyMarkup: { remove_keyboard: true } });
      return;
    }

    // 1. أمر البداية والترحيب
    if (['/start', '/help'].includes(cleanText.toLowerCase())) {
      const welcome = `
👋 أهلاً بك يا <b>${fromName}</b>!

أنا مساعد فاي تك. أشرح خطوات الشاشات وأساعد في تشخيص الأعطال.

• «إزاي أسجل مصروف على أمر شغل؟»
• «إيه حل React #300؟»
• «اتشك ليست استلام المحارة»
• «كام سجل يومية النهارده؟» بعد ربط حساب قراءة للشركة.

📝 <b>تجهيز عملية</b>
• <code>/add</code> لبدء نموذج مصروف أو سند قبض أو سند صرف.
• <code>/resume</code> لعرض الخانة الحالية، و<code>/cancel</code> لإلغاء المعاينة.

🧠 <b>مقترحات التدريب</b>
• <code>/train المعلومة</code> أو «احفظ عندك أن…» لإرسال اقتراح للمراجعة.
• <code>/memory</code> لعرض مقترحاتك المعلقة، أو <code>/memory 2</code> للصفحة التالية.
• <code>/forget رقم_المقترح</code> لسحب اقتراح.
• <code>/reload</code> لقراءة دليل المعرفة المعتمد.

📄 <b>ملفات PDF</b> (بتأكيد قبل الإرسال)
• <code>/pdf worker الاسم YYYY-MM-DD YYYY-MM-DD</code> لكشف عامل.
• <code>/pdf checklist البند</code> لاستمارة فحص مسودة.
• <code>/confirm</code> للتأكيد أو <code>/cancel</code> للإلغاء.
• <code>/new</code> لبدء محادثة جديدة.
`;
      await sendTelegramMessage(chatId, welcome, messageId);
      return;
    }

    const trainingCommand = cleanText.match(/^\/(?:train|learn)(?:\s+(.*))?$/is);
    const naturalTraining = cleanText.match(/^(?:احفظ عندك|تعلم أن|خليك عارف إن|سجل عندك|قاعدة جديدة)\s*[:،,-]?\s*(.+)$/is);
    if (trainingCommand || naturalTraining) {
      const text = (trainingCommand?.[1] ?? naturalTraining?.[1] ?? '').trim();
      if (!text) {
        await sendTelegramMessage(chatId, 'اكتب اقتراحًا بعد <code>/train</code> من غير بيانات دخول أو بيانات خاصة.', messageId);
        return;
      }
      const company = LIVE_READS_ENABLED ? await resolveCompanyAccess() : null;
      const proposal = trainingProposals.submit({ text, telegramUserId: msg.from.id, companyId: company?.companyId ?? null });
      await sendTelegramMessage(chatId, 'سجّلت مقترح التدريب للمراجعة. رقمه <code>' + escapeTelegramText(proposal.id) + '</code>. هيظل معلق لحد اعتماده.', messageId);
      return;
    }

    const memoryCommand = cleanText.match(/^\/(?:memory|rules)(?:\s+([1-9]\d{0,2}))?$/i);
    if (memoryCommand) {
      const proposals = trainingProposals.list(msg.from.id);
      const page = Number(memoryCommand[1] || 1);
      const pageCount = Math.ceil(proposals.length / 8);
      if (!pageCount || page > pageCount) {
        await sendTelegramMessage(chatId, pageCount ? 'الصفحة مش موجودة. ابدأ من /memory.' : 'مفيش مقترحات تدريب معلقة.', messageId);
        return;
      }
      const rows = proposals.slice((page - 1) * 8, page * 8).map(item =>
        '<code>' + escapeTelegramText(item.id) + '</code> ' + escapeTelegramText(item.text.slice(0, 65)) +
        (item.text.length > 65 ? '…' : '')
      );
      const summary = 'مقترحاتك المعلقة (' + proposals.length + ') • صفحة ' + page + '/' + pageCount + '\n\n' + rows.join('\n\n');
      await sendTelegramMessage(chatId, summary, messageId);
      return;
    }

    const withdraw = cleanText.match(/^\/forget(?:\s+(\S+))?$/i);
    if (withdraw) {
      const removed = !!withdraw[1] && trainingProposals.withdraw(withdraw[1], msg.from.id);
      await sendTelegramMessage(chatId, removed ? 'سحبت مقترح التدريب.' : 'اكتب رقم مقترح معلق من قائمة /memory.', messageId);
      return;
    }

    if (cleanText === '/reload') {
      const knowledge = loadKnowledgeBase(true); // force-reload cache
      await sendTelegramMessage(chatId, 'قريت دليل المعرفة المعتمد. عدد الحروف: ' + knowledge.length + '.', messageId);
      return;
    }

    // ─── PDF confirmation flow ───────────────────────────────────────────────

    // /confirm → execute the pending PDF request (take() is atomic: a repeated /confirm can't run twice)
    if (cleanText === '/confirm') {
      const pending = pendingPdfRequests.take(actor);
      if (!pending) {
        await sendTelegramMessage(chatId, PDF_MESSAGES.noPending, messageId, { html: false });
        return;
      }
      await sendChatAction(chatId, 'upload_document');
      try {
        const errorText = await runConfirmedPdf(pending, actor, chatId, messageId);
        if (errorText) await sendTelegramMessage(chatId, errorText, messageId, { html: false });
      } catch {
        await sendTelegramMessage(chatId, PDF_MESSAGES.generationFailed, messageId, { html: false });
      }
      return;
    }

    // /cancel → clear any pending PDF (entryForms already handled its own cancel)
    if (cleanText === '/cancel' && pendingPdfRequests.has(actor)) {
      pendingPdfRequests.delete(actor);
      await sendTelegramMessage(chatId, PDF_MESSAGES.cancelled, messageId, { html: false });
      return;
    }

    // /pdf … → resolve an uncertain send, refuse (invalid / switched off), or store + ask to confirm
    const pdf = preparePdfRequest(cleanText);
    if (pdf.kind === 'resolve') {
      const resolvedId = pdfRequestLog.resolve(actor, pdf.shortId);
      await sendTelegramMessage(chatId, resolvedId ? PDF_MESSAGES.resolved(resolvedId) : PDF_MESSAGES.resolveNotFound, messageId, { html: false });
      return;
    }
    if (pdf.kind === 'invalid' || pdf.kind === 'disabled') {
      pendingPdfRequests.delete(actor);
      await sendTelegramMessage(chatId, pdf.message, messageId, { html: false });
      return;
    }
    if (pdf.kind === 'request') {
      pendingPdfRequests.set(actor, pdf.request);
      await sendTelegramMessage(chatId, pdf.text, messageId, { html: false });
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────

    await sendChatAction(chatId, 'typing');

    // إزالة بادئة /ask إن وجدت
    cleanText = cleanText.replace(/^\/ask(?:\s+|$)/i, '').trim();

    if (!cleanText) {
      cleanText = rawText;
    }

    // 7. المعالجة الذكية بالذكاء الاصطناعي واستدعاء الأدوات الحية
    const reply = await processUserPromptWithGemini(cleanText, actor);
    const delivery = await sendTelegramMessage(chatId, reply.text, messageId, { html: false });
    if (delivery.ok && reply.memory) {
      conversation.remember({ ...actor, ...reply.memory, userMessageId: messageId,
        botMessageIds: delivery.messageIds, userText: cleanText });
    }
  } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('COPILOT_PROPOSAL_')) {
      await sendTelegramMessage(chatId, escapeTelegramText(error.message), messageId);
      return;
    }
    console.error('Copilot could not handle an authorized message.');
    await sendTelegramMessage(chatId, 'تعذّر إكمال الطلب. لو المشكلة بتتكرر راجع إعدادات البوت.', messageId);
  }
});

// Long-polling loop
let offset = 0;
let isPolling = true;

async function pollUpdates() {
  console.log('📡 بدء الاستماع المباشر لرسائل تيليجرام (Long Polling)...');
  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=25&allowed_updates=%5B%22message%22%5D`;
      const res = await fetch(url, { signal: AbortSignal.timeout(35000) });
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      } else if (!data.ok) {
        const errorCode = Number.isSafeInteger(data.error_code) ? data.error_code : undefined;
        console.warn('Telegram poll returned an error.', { status: res.status, errorCode });
        if (errorCode === 409) console.warn('Check for another running copilot worker or a webhook using this bot.');
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch (err) {
      if (err.name !== 'TimeoutError') {
        console.warn('Telegram polling failed.');
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

process.on('SIGINT', () => {
  console.log('Stopping bot...');
  isPolling = false;
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Stopping bot...');
  isPolling = false;
  process.exit(0);
});

async function runPdfMockTest() {
  if (process.env.COPILOT_PDF_MOCK_TEST !== 'true') return;

  console.log('🧪 بدء PDF mock test...');

  // اختبار 1: worker_statement
  try {
    const mockPending = {
      type: 'worker_statement',
      params: { workerName: 'عامل تجريبي', startDate: '2026-01-01', endDate: '2026-01-07' },
      label: 'كشف عامل: عامل تجريبي',
    };
    const buf = await generateWorkerStatementPdf({
      workerName: mockPending.params.workerName,
      startDate: mockPending.params.startDate,
      endDate: mockPending.params.endDate,
      logs: [],
      companyName: 'فاي تك - تجريبي',
    });
    console.log('✅ worker_statement PDF:', buf.length, 'bytes');
  } catch (err) {
    console.error('❌ worker_statement PDF فشل:', err.message);
  }

  // اختبار 2: engineering_checklist
  try {
    const buf = await generateEngineeringChecklistPdf({
      title: 'فحص المحارة', projectName: 'فاي تك - تجريبي',
      stageName: 'عام', inspectorName: 'مهندس تجريبي',
      contractorName: 'فاي تك', inspectionDate: '2026-01-01',
      status: 'قيد الفحص', items: [], companyName: 'فاي تك - تجريبي',
    });
    console.log('✅ engineering_checklist PDF:', buf.length, 'bytes');
  } catch (err) {
    console.error('❌ engineering_checklist PDF فشل:', err.message);
  }

  // اختبار 3: parsePdfRequest
  const cases = [
    '/pdf worker أحمد محمد 2026-01-01 2026-01-07',
    '/pdf checklist استلام المحارة',
    '/pdf invalid',
    'مش أمر pdf',
  ];
  for (const c of cases) {
    const result = parsePdfRequest(c);
    console.log(result ? `✅ "${c}" → ${result.type}` : `➖ "${c}" → null (متوقع)`);
  }

  console.log('🧪 انتهى الـ mock test.');
}

// ─── Cleanup stale PDF pending requests every minute ─────────────────────────
setInterval(() => pendingPdfRequests.sweep(), 60_000).unref(); // .unref() so it doesn't keep the process alive

// A send interrupted by a crash/restart has no definite answer → mark it uncertain for review.
const interruptedPdfSends = pdfRequestLog.recoverInterrupted();
if (interruptedPdfSends) console.warn('PDF sends with an uncertain outcome after restart:', interruptedPdfSends);
if (!pdfRequestLog.available) console.warn('PDF request log is unreadable — PDF sending stays disabled until it is fixed.');

initKnowledgeBase();
runPdfMockTest().catch(err => console.error('Mock test error:', err.message));
// Polling timeout=25s (long-poll standard). AbortSignal is 35s. // TODO: env — COPILOT_POLL_TIMEOUT_S
pollUpdates();
