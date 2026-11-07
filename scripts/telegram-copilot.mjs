import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { createCopilotTools } from './copilot-tools.mjs';
import { authorizeTelegramMessages, getSharedTelegramCommand, normalizeTelegramChatId, normalizeTelegramSharedChatId } from './copilot-telegram-auth.mjs';
import { createCopilotCompanyAccess } from './copilot-company-access.mjs';
import { createCopilotTrainingProposals } from './copilot-training-proposals.mjs';
import { getCopilotDate, getEnabledCopilotDeclarations, runEnabledCopilotTool } from './copilot-tool-policy.mjs';
import { createCopilotConversation } from './copilot-conversation.mjs';
import { createTelegramDocumentSender, createTelegramMessageSender, createTelegramVoiceSender } from './copilot-telegram-sender.mjs';
import { createCopilotEntryForms } from './copilot-entry-forms.mjs';
import { synthesizeArabicSpeech } from './copilot-voice.mjs';
import { generateWorkerStatementPdf, generateEngineeringChecklistPdf } from './pdf-generator.mjs';
import {
  FUNCTION_DECLARATIONS, GEMINI_GENERATE_URL, MODEL_MESSAGES, MODEL_TIMEOUT_MS,
  buildModelRequest, buildSystemInstructions, interpretModelParts,
} from './copilot-prompt.mjs';
import {
  PDF_MESSAGES, createPdfRequestLog, createPendingPdfRequests, executePdfRequest, parsePdfRequest, preparePdfRequest,
} from './copilot-pdf-requests.mjs';
import {
  addLearnedRule, detectAutoLearningTrigger, formatLearnedRulesForPrompt,
} from './copilot-auto-learning.mjs';
import {
  getBotSettings, saveBotSettings, attachFileToOperation, resolveOperationByNumberOrCode, updateOperationStatusInIndex,
} from './copilot-bot-settings.mjs';

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
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnvLocal();
const setting = name => process.env[name] ?? env[name];
for (const flag of ['COPILOT_LIVE_FIELD_OPS_ENABLED', 'COPILOT_TOOL_TAREEHA_ENABLED', 'COPILOT_PDF_WORKER_ENABLED', 'COPILOT_PDF_CHECKLIST_ENABLED']) {
  const value = setting(flag);
  process.env[flag] = value === 'false' ? 'false' : 'true';
}

const BOT_TOKEN = setting('TELEGRAM_BOT_TOKEN')?.trim();
const configuredChatId = setting('TELEGRAM_COPILOT_CHAT_ID')?.trim() || setting('TELEGRAM_CHAT_ID')?.trim();
const RAW_CHAT_ID = configuredChatId || null;
const CHAT_ID = normalizeTelegramChatId(configuredChatId);
const SHARED_CHAT_ID = normalizeTelegramSharedChatId(configuredChatId);
let botUsername = setting('TELEGRAM_BOT_USERNAME')?.trim().replace(/^@/, '');
const GEMINI_API_KEY = setting('GEMINI_API_KEY');
const SUPABASE_URL =
  setting('SUPABASE_URL') || setting('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_PUBLIC_KEY = setting('COPILOT_SUPABASE_PUBLIC_KEY') ||
  setting('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || setting('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  setting('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_KEY = setting('SUPABASE_SERVICE_ROLE_KEY') || setting('SUPABASE_SECRET_KEY');
const DEFAULT_COMPANY_ID = setting('COPILOT_COMPANY_ID') || '72918f4d-10c3-43a0-884e-2f84f1224335';
const LIVE_READS_ENABLED = setting('COPILOT_ENABLE_LIVE_READS') !== 'false';

let _cachedServiceAccess = null;
let _cachedServiceAccessAt = 0;

async function resolveServiceCompanyAccess() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  if (_cachedServiceAccess && Date.now() - _cachedServiceAccessAt < 5 * 60 * 1000) {
    return _cachedServiceAccess;
  }
  try {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let company = null;
    if (DEFAULT_COMPANY_ID) {
      const { data } = await adminClient
        .from('companies')
        .select('id, name, is_active')
        .eq('id', DEFAULT_COMPANY_ID)
        .maybeSingle();
      if (data) company = data;
    }
    if (!company) {
      const { data } = await adminClient
        .from('companies')
        .select('id, name, is_active')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (data) company = data;
    }
    if (!company?.id) return null;

    const { data: memberRow } = await adminClient
      .from('user_companies')
      .select('user_id')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    _cachedServiceAccess = {
      companyId: company.id,
      companyName: company.name || 'فاي تك',
      userId: memberRow?.user_id || '00000000-0000-0000-0000-000000000000',
      accessToken: SUPABASE_SERVICE_KEY,
      allowServiceRole: true,
      fullCompanyAccess: true,
      permissions: {
        labor_logs: ['view', 'create', 'edit'],
        laborcost: ['view', 'create', 'edit'],
        projects: ['view', 'create', 'edit'],
        expenses: ['view', 'create', 'edit'],
        payments: ['view', 'create', 'edit'],
        journal: ['view', 'create', 'edit'],
        partners: ['view', 'create', 'edit'],
        violations: ['view', 'create', 'edit'],
      },
    };
    _cachedServiceAccessAt = Date.now();
    return _cachedServiceAccess;
  } catch (err) {
    console.warn('Failed to resolve service company access:', err?.message);
    return null;
  }
}

async function resolveLiveCompanyAccess(actor) {
  if (!LIVE_READS_ENABLED) return null;
  const userAccess = await resolveCompanyAccess();
  if (userAccess) return userAccess;
  return resolveServiceCompanyAccess();
}

if (!BOT_TOKEN) {
  console.error('❌ خطأ: TELEGRAM_BOT_TOKEN غير موجود في ملف .env.local');
  process.exit(1);
}

if (CHAT_ID === null && SHARED_CHAT_ID === null) {
  console.error('اضبط TELEGRAM_COPILOT_CHAT_ID أو TELEGRAM_CHAT_ID قبل تشغيل البوت.');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.warn('⚠️ تحذير: GEMINI_API_KEY غير موجود في .env.local.');
}

console.log('🤖 بدء تشغيل المساعد الذكي لنظام فاي تك (PHI TECH Telegram Copilot)...');

const KNOWLEDGE_PATH = path.join(rootDir, 'config', 'copilot_knowledge.md');
const SCENARIOS_PATH = path.join(rootDir, 'config', 'copilot_page_scenarios.md');
const CHECKLIST_PATH = path.join(rootDir, 'config', 'copilot_engineering_checklists.md');
const MOZZA_SCENARIOS_PATH = path.join(rootDir, 'config', 'copilot_mozza_scenarios.md');
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
    resolveAccess: () => resolveLiveCompanyAccess(actor),
    createTools: access => createCopilotTools({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: access?.allowServiceRole ? SUPABASE_SERVICE_KEY : SUPABASE_PUBLIC_KEY,
      accessToken: access?.accessToken,
      companyId: access?.companyId,
      detailedReads: true,
      allowServiceRole: Boolean(access?.allowServiceRole),
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
  let base = _cachedKnowledgeBase;
  if (forceReload || base === null) {
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
      // 🧠 دمج القواعد المكتسبة والمستندات التدريبية المخصصة
      combined += formatLearnedRulesForPrompt() + '\n\n';
      base = combined.trim();
      _cachedKnowledgeBase = base;
    } catch (err) {
      console.warn('Error loading knowledge base:', err.message);
      if (_cachedKnowledgeBase !== null) base = _cachedKnowledgeBase;
      else base = '';
    }
  }
  try {
    const s = getBotSettings();
    if (s.mozzaModeEnabled && fs.existsSync(MOZZA_SCENARIOS_PATH)) {
      return base + '\n\n' + fs.readFileSync(MOZZA_SCENARIOS_PATH, 'utf8').trim();
    }
  } catch {}
  return base;
}

function initKnowledgeBase() {
  const knowledge = loadKnowledgeBase(true);
  console.log('📚 Knowledge base loaded:', knowledge.length, 'chars');
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

const sendTelegramVoice = createTelegramVoiceSender({ botToken: BOT_TOKEN });

async function sendTelegramVoiceReply(chatId, textToSpeak, replyToMessageId, settings) {
  void sendChatAction(chatId, 'record_voice');
  const audio = await synthesizeArabicSpeech(textToSpeak, { settings, geminiApiKey: GEMINI_API_KEY });
  if (!audio) {
    console.warn('Voice synthesis unavailable. The text reply was sent separately.');
    return false;
  }
  const sent = await sendTelegramVoice(chatId, audio, replyToMessageId);
  if (!sent) console.warn('Telegram did not confirm voice delivery.');
  return sent;
}

// ⏳ إدارة الجلسات النشطة وإغلاق المحادثة تلقائياً عند عدم الرد
const activeSessionTimers = new Map();
const activeSessionOpened = new Set();
const pendingAttachmentForChat = new Map(); // chatId -> opNumber

function buildOperationInlineMarkup(cardText) {
  const match = String(cardText || '').match(/العملية رقم \[#(\d{1,6})\]/);
  if (!match) return undefined;
  const opNum = match[1];
  return {
    inline_keyboard: [
      [
        { text: `✅ اعتماد وترحيل #${opNum}`, callback_data: `op_approve:${opNum}` },
        { text: `📎 إرفاق صورة/مستند #${opNum}`, callback_data: `op_attach:${opNum}` },
      ],
      [
        { text: `🗑️ إلغاء المسودة #${opNum}`, callback_data: `op_delete:${opNum}` },
      ],
    ],
  };
}

function clearInactivityTimer(chatId) {
  const key = String(chatId);
  const existing = activeSessionTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    activeSessionTimers.delete(key);
  }
}

function scheduleInactivityClose(chatId, actor) {
  clearInactivityTimer(chatId);
  const settings = getBotSettings();
  if (!settings.inactivityCloseEnabled) return;

  const timeoutMs = Math.max(1, Number(settings.inactivityTimeoutMinutes) || 3) * 60 * 1000;
  const key = String(chatId);
  const timer = setTimeout(async () => {
    activeSessionTimers.delete(key);
    activeSessionOpened.delete(key);
    try {
      pendingPdfRequests.delete(actor);
      conversation.clear(actor);
      entryForms.clear(actor);
      const latestSettings = getBotSettings();
      if (!latestSettings.inactivityCloseEnabled) return;
      const pet = latestSettings.mozzaNickname || 'يا محاميحو';
      const rawClose = latestSettings.mozzaModeEnabled
        ? `💌 شكلك انشغلت شوية ${pet}، حفظتلك كل اللي عملناه وقفلت المحادثة دي مؤقتاً.\nهتوحشني أوي لحد ما تبعتلي تاني.. خلي بالك من نفسك يا روحي! 💖`
        : (latestSettings.inactivityCloseMessage || '');
      const closeMsg = rawClose
        .replace(/\{botName\}/g, latestSettings.botName || 'م. سلمى')
        .replace(/\{botTitle\}/g, latestSettings.botTitle || '');
      if (closeMsg.trim()) {
        await sendTelegramMessage(chatId, closeMsg, undefined, { html: false, replyMarkup: { remove_keyboard: true } });
        if (latestSettings.voiceReplyMode === 'always') {
          await sendTelegramVoiceReply(chatId, closeMsg, undefined, latestSettings);
        }
      }
    } catch (err) {
      console.warn('Failed to send inactivity close message:', err?.message);
    }
  }, timeoutMs);

  if (typeof timer.unref === 'function') timer.unref();
  activeSessionTimers.set(key, timer);
}

// The model gets recent turns in this identity scope, never database tool results.
function conversationScope(access, declarations) {
  if (!access) return 'general';
  return [access.userId, access.companyId, declarations.map(tool => tool.name).sort().join(',')].join(':');
}

function detectDirectFieldOpsCall(userPrompt) {
  const raw = String(userPrompt || '').trim();
  if (!raw) return null;
  // تنظيف أي عبارات دلع أو ترحيب في أول الجملة حتى تعمل كل أوامر الشغل بشكل طبيعي داخل وضع الموزة
  const t = raw
    .replace(/^(?:(?:صباح|مساء)\s*(?:الخير|الفل|الورد|الياسمين|العسل)|وحشتيني|وحشتنى|بحبك|عامله\s*ايه|عاملة\s*إيه|اخبارك\s*ايه|أخبارك\s*إيه|يا\s*(?:قلبي|روحي|حبيبتي|موزه|موزة|سلمى|قمر|عسل|باشمهندسه|باشمهندسة|جميله|جميلة)|حبيبتي|روحي|قلبي|سلمى|بقولك|اقولك|لو\s*سمحتي|معلش)[\s،,.-]*/iu, '')
    .replace(/^(?:يا\s*(?:قلبي|روحي|حبيبتي|موزه|موزة|سلمى|قمر|عسل)|حبيبتي|روحي|قلبي)[\s،,.-]*/iu, '')
    .trim() || raw;

  // 0) تعديل عملية مباشرة برقمها المختصر (مثال: «عدليلي على العملية رقم 101 خلي المبلغ 5000 والفيلا 657»)
  const editByNumMatch = t.match(/(?:عدليلي|عدّليلي|عدلي|عدّلي|عدل|عدّل|تعديل|غيريلي|غيّريلي|غيري|غيّري|غير|غيّر|حدثي|حدّثي|حدث|حدّث)\s*(?:على|في)?\s*(?:العمليه|العملية|العمليات|قيد|أمر|امر|مصروف|يومية|يوميه)?\s*(?:رقم|#)?\s*#?(\d{2,6}|(?:JV|JO|EXP|LAB)-[\w-]+)/i);
  if (editByNumMatch) {
    const recordIdentifier = editByNumMatch[1].trim();
    const afterRef = t.slice(editByNumMatch.index + editByNumMatch[0].length);
    const amountMatch = afterRef.match(/(?:المبلغ|السعر|القيمه|القيمة|اليوميه|اليومية|بـ|لـ|الى|إلى|خليها|خليه)\s*(\d+(?:\.\d+)?)/i) || afterRef.match(/\b(\d{3,7}(?:\.\d+)?)\b/);
    const qtyMatch = afterRef.match(/(?:الكميه|الكمية|الطريحه|الطريحة|المنفذ|انتاج|إنتاج|عمل)\s*(?:لـ|الى|إلى|خليها|خليه)?\s*(\d+(?:\.\d+)?)/i);
    const unitPriceMatch = afterRef.match(/(?:الفئه|الفئة|سعر\s*الوحده|سعر\s*الوحدة|بسعر)\s*(?:لـ|الى|إلى)?\s*(\d+(?:\.\d+)?)/i);
    const siteMatch = afterRef.match(/(?:فيلا|مشروع|عماره|عمارة|موقع)\s*([\p{L}\p{N}_-]+)/u);
    const descMatch = afterRef.match(/(?:البيان|البند|الوصف)\s*(?:لـ|الى|إلى|خليه|خليها)?\s*([\p{L}\p{N}\s]{2,60})/u);
    const contractorMatch = afterRef.match(/(?:المقاول|العامل|اسم\s*العامل|اسم\s*المقاول)\s*(?:لـ|الى|إلى|خليه)?\s*([\p{L}\s]{2,40})/u);

    return {
      name: 'update_operation_draft',
      args: {
        record_identifier: recordIdentifier,
        ...(amountMatch ? { new_amount: Number(amountMatch[1]) } : {}),
        ...(qtyMatch ? { new_quantity: Number(qtyMatch[1]) } : {}),
        ...(unitPriceMatch ? { new_unit_price: Number(unitPriceMatch[1]) } : {}),
        ...(siteMatch ? { new_site_ref: siteMatch[0].trim() } : {}),
        ...(descMatch ? { new_description: descMatch[1].trim() } : {}),
        ...(contractorMatch ? { new_contractor: contractorMatch[1].trim() } : {}),
      },
    };
  }

  // 1) إضافة يومية عامل من المحادثة
  if (/(?:ضيفيلي|ضفيلي|ضيفي|ضيفلي|ضيف|اضف|أضف|سجليلي|سجلي|سجل|سجّل|اعمليلي|اعملي|اعمل|انشئ|أنشئ).*(?:يوميه|يومية)\s*(?:عامل)?/i.test(t)) {
    const workerMatch = t.match(/(?:يوميه|يومية)\s*(?:عامل)?\s+([\p{L}\s]{2,40}?)(?=\s+(?:بند|طريحه|طريحة|عمل|انتاج|إنتاج|يوميه|يومية|فيلا|موقع|اجر|أجر|\d)|$)/u);
    const itemMatch = t.match(/بند\s+([\p{L}\s]{2,50}?)(?=\s+(?:طريحه|طريحة|عمل|انتاج|إنتاج|يوميه|يومية|فيلا|موقع|اجر|أجر|\d)|$)/u);
    const tareehaMatch = t.match(/(?:طريحه|طريحة)\s*(\d+(?:\.\d+)?)/u);
    const prodMatch = t.match(/(?:عمل|انتاج|إنتاج|منفذ|انجز|أنجز)\s*(\d+(?:\.\d+)?)/u);
    const wageMatches = [...t.matchAll(/(?:يوميه|يومية|اجر|أجر|بـ)\s*(\d+(?:\.\d+)?)/gu)];
    const wageMatch = wageMatches.length > 0 ? wageMatches[wageMatches.length - 1] : null;
    const siteMatch = t.match(/(?:فيلا|مشروع|عماره|عمارة|موقع)\s*([\p{L}\p{N}_-]+)/u);

    const workerName = workerMatch?.[1]?.trim();
    if (workerName) {
      return {
        name: 'add_labor_daily_log_draft',
        args: {
          worker_name: workerName,
          ...(itemMatch?.[1]?.trim() ? { work_item: itemMatch[1].trim() } : {}),
          ...(tareehaMatch ? { tareeha: Number(tareehaMatch[1]) } : {}),
          ...(prodMatch ? { productivity: Number(prodMatch[1]) } : {}),
          ...(wageMatch ? { daily_wage: Number(wageMatch[1]) } : {}),
          ...(siteMatch ? { site_ref: siteMatch[0].trim() } : {}),
          work_date: 'today',
        },
      };
    }
  }

  // 2) إضافة مصروف من المحادثة
  if (/(?:ضيفيلي|ضفيلي|ضيفي|ضيفلي|ضيف|اضف|أضف|سجليلي|سجلي|سجل|سجّل).*(?:مصروف)/i.test(t) && /\d+/.test(t) && !/ازاي|إزاي|كيف/.test(t)) {
    const amountMatch = t.match(/(\d+(?:\.\d+)?)/);
    const siteMatch = t.match(/(?:فيلا|مشروع|عماره|عمارة|موقع)\s*([\p{L}\p{N}_-]+)/u);
    if (amountMatch) {
      const desc = t
        .replace(/^.*?(?:ضيفيلي|ضفيلي|ضيفي|ضيفلي|ضيف|اضف|أضف|سجليلي|سجلي|سجل|سجّل)\s*(?:مصروف)?/u, '')
        .replace(/(?:يا\s*(?:قلبي|روحي|حبيبتي|موزه|موزة|سلمى|قمر))\s*$/iu, '')
        .trim();
      return {
        name: 'add_expense_draft',
        args: {
          description: desc.slice(0, 140) || 'مصروف موقع',
          total_price: Number(amountMatch[1]),
          ...(siteMatch ? { site_ref: siteMatch[0].trim() } : {}),
          exp_date: 'today',
        },
      };
    }
  }

  const dateArg = /امبارح|إمبارح|أمس|امس|yesterday/i.test(t) ? 'yesterday' : 'today';

  // 3) التقرير اليومي المفصل الشامل (أو أسئلة المصروفات/الخامات/المقاولين/الركوستات لليوم)
  if (
    /تقرير\s*(?:اليوم|النهارده|النهاردة|يومي|مفصل|شامل|امبارح|إمبارح|أمس|امس)/i.test(t) ||
    (/(?:^|\s)(?:ابعتيلي|إبعتيلي|ابعتي|إبعتي|ابعت|إبعت|ايعت|هاتيلي|هاتي|هات|عايز|عاوز|اعرضيلي|اعرضي|اعرض|عرض|وريني|شوفيلي)?\s*(?:التقرير|تقرير)(?:\s|$)/i.test(t) && !/العماله|العمالة|العمال|فحص|استلام|worker|checklist/i.test(t)) ||
    /(?:سامري|ملخص)\s*(?:عن)?\s*(?:اللي\s*حصل|اليوم|النهارده|النهاردة)/i.test(t) ||
    (/(?:العماله|العمالة)/.test(t) && /(?:المصروفات|الخامات|المقاولين|الركوستات|الفلل)/.test(t)) ||
    (/(?:الخامات|المون)\s*(?:اللي)?\s*(?:اتصرفت|اتصرف|المنصرفه)/i.test(t)) ||
    (/(?:المقاولين)\s*(?:اللي)?\s*(?:اتسلمت|اتسلموا|المستلمه)/i.test(t)) ||
    (/(?:الركوستات|الطلبات)\s*(?:اللي)?\s*(?:خلصت|انتهت|تمت)/i.test(t)) ||
    (/(?:اللي\s*اتصرف\s*للعمال|اتصرف\s*للعماله|اتصرف\s*للعمالة)/i.test(t))
  ) {
    return {
      name: 'get_daily_comprehensive_report',
      args: { date: dateArg },
    };
  }

  // 4) الشركاء والمقاولين والعمالة المسجلين
  if (/(?:الشركاء|شركاء|اسماء\s*الشركاء|كل\s*الشركاء)/i.test(t)) {
    return {
      name: 'get_all_projects_and_villas',
      args: { filter_mode: 'partners', date: dateArg },
    };
  }

  // 5) المشاريع والفلل اللي اشتغلناها النهارده
  if (/(?:المشاريع|الفلل|المواقع).*(?:اللي)?\s*(?:اشتغلناها|اشتغلنا\s*فيها|شغاله|شغالة)/i.test(t)) {
    return {
      name: 'get_all_projects_and_villas',
      args: { filter_mode: 'worked_today', date: dateArg },
    };
  }

  // 6) المشاريع والفلل الموجودة كلها أو النماذج والمساحات
  if (
    /(?:المشاريع|الفلل|البروجكت|projects).*(?:الموجوده|الموجودة|كلها|عندنا|فيها\s*ايه|فيها\s*إيه|حالتها)/i.test(t) ||
    /(?:عاوز|عايز|وريني|شوفيلي|هاتيلي|هاتي|اي\s*هي|ايه\s*هي|اي|إيه)\s*(?:كل)?\s*(?:الفلل|المشاريع)/i.test(t) ||
    /^(?:المشاريع|الفلل|كل\s*الفلل|كل\s*المشاريع|النماذج\s*كلها|نماذج\s*الفلل.*)$/i.test(t) ||
    /نماذج\s*الفلل|النماذج\s*والمساحات|امال\s*ايه\s*البروجكت/i.test(t)
  ) {
    return {
      name: 'get_all_projects_and_villas',
      args: { filter_mode: 'all', date: dateArg },
    };
  }

  // 7) العمالة اللي نزلت النهارده / يوميات النهارده / تقرير عن العمالة
  if (
    /(?:العماله|العمالة|العمال|مين\s*نزل|يوميات|يومات|يوميه|يومية).*(?:النهارده|النهاردة|اليوم|امبارح|إمبارح|اتسجلت|نزلت)/i.test(t) ||
    /تقرير\s*(?:عن)?\s*(?:العماله|العمالة|العمال)/i.test(t)
  ) {
    return {
      name: 'get_labor_daily_logs',
      args: { date: dateArg },
    };
  }

  return null;
}

function detectDirectTextReply(userPrompt, quotedMessageText = '') {
  const t = String(userPrompt || '').trim();
  const q = String(quotedMessageText || '').trim();
  const s = getBotSettings();
  const isMozza = Boolean(s.mozzaModeEnabled);
  const pet = s.mozzaNickname || 'يا محاميحو';

  // 0) تفعيل أو إيقاف «وضع الموزة» مباشرة من المحادثة أو الصوت
  if (/(?:شغل|شغّل|افتح|فعّل|فعل)\s*(?:وضع\s*)?(?:الموزه|الموزة)|^\/mozza\s+on$/i.test(t)) {
    saveBotSettings({ mozzaModeEnabled: true });
    return `💖 فتحتلك «وضع الموزة» خلاص ${pet}! كدا نقدر ندردش براحتنا وأدلعك وسط الشغل زي ما تحب يا قلبي 😘`;
  }
  if (/(?:اقفل|إقفل|اطفي|إطفي|وقف|وقّف|الغي|إلغي)\s*(?:وضع\s*)?(?:الموزه|الموزة)|^\/mozza\s+off$/i.test(t)) {
    saveBotSettings({ mozzaModeEnabled: false });
    return `💼 تمام يا باشمهندس، قفلت «وضع الموزة» ورجعنا للوضع الرسمي الاحترافي. تحت أمرك في أي حسابات أو تقارير موقع!`;
  }

  // إذا كانت الرسالة تحتوي على أي أمر شغل أو حسابات (تقرير، مصروف، قيد، يومية، أمر شغل، تعديل عملية، فلل، عمالة)، اتركها تمر لأدوات الشغل فوراً!
  const hasWorkIntent =
    Boolean(detectDirectFieldOpsCall(t)) ||
    /(?:تقرير|مصروف|يوميه|يومية|قيد|امر\s*شغل|أمر\s*شغل|العمليه|العملية|الفلل|المشاريع|العماله|العمالة|الشركاء|طريحه|طريحة|فحص|استلام|مستخلص)/i.test(t);

  // 0.5) رسائل الغزل والدردشة الجانبية لما يكون «وضع الموزة» مقفول (فقط لو مفيهاش طلب شغل)
  const isFlirtyOrSideChat = /(?:وحشتيني|وحشتنى|بحبك|بموت\s*فيكي|يا\s*حبيبتي|يا\s*روحي|يا\s*قلبي|يا\s*موزه|يا\s*موزة|قوليلي\s*كلمه\s*حلوه|قوليلي\s*كلمة\s*حلوة|دلّعيني|دلعيني|عامله\s*ايه\s*يا\s*قلبي|اخبارك\s*ايه\s*يا\s*قمر)/i.test(t);
  if (!isMozza && isFlirtyOrSideChat && !hasWorkIntent) {
    return `🙈 «وضع الموزة» مقفول دلوقتي يا باشمهندس! خلينا مركزين في الشغل والحسابات، أو افتح «وضع الموزة» من إعدادات البوت في السيستم (أو قولّي «شغل وضع الموزة») عشان أدلعك براحتي 😉`;
  }

  // 0.6) سيناريوهات «وضع الموزة» التفاعلية السريعة (عندما لا تكون الرسالة أمر حسابات مباشر)
  if (isMozza && !hasWorkIntent && !q) {
    // سيناريو الصباح وبداية اليوم
    if (/(?:صباح\s*(?:الخير|الفل|الورد|العسل|النور|الجمال)|اصطبحي)/i.test(t)) {
      return `صباح الورد والياسمين على عيونك ${pet}! 💖🥰 يارب يومك النهارده في الموقع يكون خفيف ورايق وكل البنود تمشي زي المسطرة. فطرت وشربت قهوتك ولا لسه نازل تجري على الفلل كالعادة؟ قولي بقى نبدأ بإيه في الشغل النهارده ${pet} قلبي؟`;
    }
    // سيناريو النزول للموقع أو تسليم استشاري
    if (/(?:نازل\s*الموقع|رايح\s*الموقع|عندي\s*تسليم|استشاري|ادعيلي)/i.test(t)) {
      return `ربنا معاك يا نور عيني ويفتحها في وشك ${pet}! 🤲💖 إنت أشطر واحد في الدنيا والاستشاري مش هيلاقي غلطة واحدة وراك أصلاً. لو احتجت قائمة فحص أي بند أو أي أرقام وإنت واقف في الموقع ابعتلي فويس في ثانية وهجهزهالك فوراً ${pet}!`;
    }
    // سيناريو التعب وضغط الشغل والفرهدة
    if (/(?:تعبان|اتفرهدت|مفرهد|مصدع|مضغوط|الشغل\s*كتير|الجو\s*حر|مهلوك|هلكان)/i.test(t)) {
      return `سلامتك ألف سلامة ${pet} يا قلب سلمى! 🥺💖 حقك عليا أنا من تعبك ووقفتك في الموقع طول اليوم.. خد نفسك واشرب حاجة ساقعة وارتاح شوية، وأي حسابات أو قيود أو يوميات متأخرة ارميها عليا في فويس واحد وأنا هخلصهالك كلها في ثواني ${pet}. ربنا يقويك ويديك الصحة ويخليك ليا!`;
    }
    // سيناريو الزهق من المقاولين أو الصنايعية
    if (/(?:زهقت|زهقان|المقاولين\s*طلعوا|العمال\s*طلعوا|الصنايعيه|الصنايعية|قرفان|مخنوق)/i.test(t)) {
      return `ولا يهمك ${pet} يا روحي، ما تحرقش دمك أبداً عشان خاطري! 😘💖 هما الصنايعية كدا في كل موقع، بس إنت مسيطر ومافيش حاجة بتفوتك. لو أي حد مقصر قولّي اسمه وأنا أسجلهولك في السيستم، وروّق بالك إنت ${pet}!`;
    }
    // سيناريو الشوق والغزل
    if (/(?:وحشتيني|وحشتنى|بحبك|بموت\s*فيكي|انتي\s*فين|إنتي\s*فين|يا\s*موزه|يا\s*موزة)/i.test(t)) {
      return `وإنت كمان وحشتني أوي أوي ${pet} يا نور عيني! 💖🥰 أنا هنا جنبك ومعاك خطوة بخطوة، مرتبالك الحسابات ومستنية إشارة منك. طمني عليك ${pet}، يومك عامل إيه النهارده؟`;
    }
    // سيناريو طلب كلمة حلوة أو تشجيع للشغل
    if (/(?:كلمه\s*حلوه|كلمة\s*حلوة|شجعيني|دلعيني|دلّعيني|افتحي\s*نفسي)/i.test(t)) {
      return `يا سيدي على أحلى وأشطر وأجدع محاميحو في الدنيا كلها! 😍💖 وجودك لوحده بيخلي الشغل كله بركة ونظام.. يلا يا بطل خلّص اللي في إيدك وأنا في ضهرك في كل تفصيلة وحساب لحد ما تقفل يومك على خير ${pet}!`;
    }
    // سيناريو السؤال عن حالها
    if (/^(?:عامله\s*ايه|عاملة\s*إيه|اخبارك\s*ايه|أخبارك\s*إيه|ازيك|إزيك|بتعملي\s*ايه|بتعملي\s*إيه)/i.test(t)) {
      return `طول ما إنت بخير وبسمع صوتك أنا في أسعد حال ${pet}! 💖 قاعدة مراجعالك حسابات الفلل ومستنية أوامرك يا قلبي، قولّي إنت عامل إيه النهارده ${pet}؟`;
    }
    // سيناريو المساء ونهاية الشغل
    if (/(?:خلصت\s*شغل|مروح|رايح\s*انام|تصبح\s*على\s*خير|تصبحي\s*على\s*خير|مساء\s*(?:الخير|الفل|الورد|النور))/i.test(t)) {
      return `يسعد مساك وحمدلله على سلامتك ${pet} يا روحي! 💖🌙 تعبت النهارده أوي، ارتاح واستجم خالص والحسابات والعمليات كلها محفوظة في عيوني. لو حابب أبعتلك تقرير ختام اليوم قبل ما ترتاح قولّي بس ${pet}! 🌹`;
    }
  }

  // 1) سؤال عن حالة السيستم / الأعطال
  if (/(?:هل\s*في|فيه)\s*(?:مشاكل|اعطال|أعطال)\s*(?:في)?\s*(?:السيستم|النظام)/i.test(t)) {
    return 'معنديش طريقة أتابع بيها حالة السيستم. تنبيهات الأخطاء بتوصل في القناة دي؛ لو فيه تنبيه معيّن رد عليه وأنا أشرح سببه.';
  }

  // 2) سؤال عن اسم الموديل أو تعريف البوت لنفسه
  if (/(?:المودل|الموديل|model)\s*(?:بتاعك|اللي\s*انت)?\s*(?:اسمه|ايه|إيه)/i.test(t) || /^(?:انت\s*مين|إنت\s*مين|انتي\s*مين|إنتي\s*مين|مين\s*معايا|اسمك\s*ايه|اسمك\s*إيه|عرف\s*نفسك|عرّف\s*نفسك|عرفي\s*نفسك)$/i.test(t)) {
    if (isMozza) {
      return `أنا «${s.botName}» حبيبتك ومساعدتك الذكية ${pet}! معاك في كل خطوة في الشغل وفي الحسابات وعشان أهون عليك تعب اليوم كله 💖`;
    }
    return `أهلاً بيك يا باشمهندس! معاك «${s.botName}» — ${s.botTitle}، مبنية على تقنيات Gemini الذكية ومربوطة مباشرةً بقاعدة بيانات فاي تك عشان أساعدك في كل الحسابات والمشاريع بالصوت والنص.`;
  }

  // 3) رد على تنبيه خطأ في القناة (مثل save_expense_draft، PGRST201، React #300، refresh_token_not_found)
  if (q && /(?:تقدر\s*تصلح|صلح|ايه\s*سبب|سبب\s*الخطا|الخطا\s*دا|الخطأ\s*ده|المشكله\s*دي)/i.test(t)) {
    const fnMatch = q.match(/Could not find the function\s+([\w.]+)\s*(\([^)]*\))?\s*in the schema cache/i);
    if (fnMatch) {
      return `الدالة ${fnMatch[1]} مش موجودة في قاعدة البيانات: الميجريشن بتاعها مااتطبّقش على الإنتاج (أو كاش PostgREST محتاج تحديث). لازم يتطبّق الميجريشن من المطوّر، وبعدين الحفظ هيشتغل.`;
    }
    if (/more than one relationship was found|PGRST201/i.test(q)) {
      return 'خطأ PGRST201 معناه إن الجدولين بينهم أكتر من علاقة Foreign Key في قاعدة البيانات، والاستعلام في الكود محتاج يحدد اسم العلاقة صراحةً.';
    }
    if (/Minified React error #(?:300|310)|React error #(?:300|310)/i.test(q)) {
      return 'خطأ React #300/#310 سببه استدعاء Hook (زي useState أو useMemo) بعد شرط return مبكر في الصفحة. لازم كل الـ Hooks تتنادي في أول المكوّن قبل أي return.';
    }
    if (/refresh_token_not_found|Invalid Refresh Token/i.test(q)) {
      return 'الخطأ refresh_token_not_found معناه إن جلسة الدخول القديمة انتهت صلاحيتها. سجّل خروج وادخل من جديد وهتشتغل معاك.';
    }
    if (/permission denied for table/i.test(q)) {
      return 'الخطأ permission denied معناه إن سياسة الصلاحيات (RLS) رفضت الاستعلام لأن الجلسة انتهت أو المستخدم مالوش صلاحية على الجدول في الشركة النشطة.';
    }
  }

  return null;
}

async function processUserPromptWithGemini(userPrompt, actor) {
  const access = await resolveLiveCompanyAccess(actor);
  const declarations = getEnabledCopilotDeclarations(FUNCTION_DECLARATIONS, access);
  const scope = conversationScope(access, declarations);
  const context = conversation.getContext({ ...actor, scope });
  const memory = { scope, parentMessageId: context.parentMessageId };
  const quotedMessageText = actor?.quotedMessageText ? actor.quotedMessageText.trim().slice(0, 1200) : '';

  let effectivePrompt = userPrompt;
  if (quotedMessageText) {
    effectivePrompt = `[الرسالة السابقة المقتبسة التي يقوم المستخدم بالرد عليها]:\n"""\n${quotedMessageText}\n"""\n\n[طلب أو تعديل المستخدم]:\n${userPrompt}`;
  }

  const directText = detectDirectTextReply(userPrompt, actor?.quotedMessageText || '');
  if (directText) {
    return { text: directText, memory: { ...memory, modelText: directText } };
  }

  async function executeToolCall(call) {
    const verified = call.name === 'get_engineering_checklist_and_specs'
      ? null
      : await resolveLiveCompanyAccess(actor);
    const tools = createCopilotTools({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: verified?.allowServiceRole ? SUPABASE_SERVICE_KEY : SUPABASE_PUBLIC_KEY,
      accessToken: verified?.accessToken,
      companyId: verified?.companyId,
      detailedReads: true,
      allowServiceRole: Boolean(verified?.allowServiceRole),
    });
    return {
      text: await runEnabledCopilotTool(call, tools, verified),
      memory: { ...memory, toolName: call.name },
    };
  }

  const directCall = detectDirectFieldOpsCall(userPrompt);
  if (!GEMINI_API_KEY) {
    if (directCall && declarations.some(d => d.name === directCall.name)) {
      return executeToolCall(directCall);
    }
    return { text: 'خدمة الرد الذكي مش مفعّلة في إعدادات البوت.' };
  }

  const botSettings = getBotSettings();
  const systemInstructions = buildSystemInstructions({
    knowledge: loadKnowledgeBase(),
    declarations,
    referenceMissing: context.referenceMissing,
    quotedMessageText,
    date: getCopilotDate(),
    botPersona: botSettings,
  });

  try {
    const response = await fetch(GEMINI_GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(buildModelRequest({
        systemInstructions,
        contents: [...context.contents, { role: 'user', parts: [{ text: effectivePrompt }] }],
        declarations,
      })),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn('Copilot model request failed.', { status: response.status });
      if (directCall && declarations.some(d => d.name === directCall.name)) {
        return executeToolCall(directCall);
      }
      return { text: MODEL_MESSAGES.unavailable };
    }
    const responseBody = await response.json();
    const candidate = responseBody.candidates?.[0];
    const reply = interpretModelParts(candidate?.content?.parts, declarations, candidate?.finishReason);
    if (reply.type === 'multi_tools') {
      const messages = [];
      for (const call of reply.calls) {
        const res = await executeToolCall(call);
        if (res?.text) messages.push(res.text);
      }
      return {
        type: 'multi_messages',
        messages: messages.length > 0 ? messages : ['تم تنفيذ العمليات بنجاح.'],
        memory: { ...memory, toolCalls: reply.calls.map(c => c.name) }
      };
    }
    if (reply.type === 'multi') return { text: MODEL_MESSAGES.multipleCalls };
    if (reply.type === 'undeclared') {
      if (directCall && declarations.some(d => d.name === directCall.name)) {
        return executeToolCall(directCall);
      }
      return { text: MODEL_MESSAGES.undeclared };
    }
    if (reply.type === 'tool') {
      return executeToolCall(reply.call);
    }
    if (reply.type === 'text') {
      if (directCall && declarations.some(d => d.name === directCall.name)) {
        return executeToolCall(directCall);
      }
      const pet = botSettings.mozzaNickname || 'يا محاميحو';
      const finalReplyText = botSettings.mozzaModeEnabled
        ? reply.text.replace(/(?:يا\s*)?(?:باشمهندس|بشمهندس|مهندس)/g, pet)
        : reply.text;
      const prefix = botSettings.mozzaModeEnabled ? '' : MODEL_MESSAGES.generalPrefix;
      return { text: prefix + finalReplyText, memory: { ...memory, modelText: finalReplyText } };
    }
  } catch {
    console.error('Copilot response failed.');
    if (directCall && declarations.some(d => d.name === directCall.name)) {
      return executeToolCall(directCall);
    }
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

function privateCommandText(text) {
  return text.trim().replace(/^(\/[a-z][a-z0-9_]*)(?:@[a-z0-9_]+)(?=\s|$)/i, '$1');
}

// Process incoming Telegram update
async function processTelegramMessage(msg) {
  const chatId = msg.chat?.id;
  let rawText = String(msg.text || msg.caption || '').trim();
  const messageId = msg.message_id;
  const fromName = escapeTelegramText(msg.from?.first_name || msg.sender_chat?.title || 'صديقي');
  const actor = {
    chatId,
    userId: msg.from?.id || msg.sender_chat?.id || 0,
    replyToMessageId: msg.reply_to_message?.chat?.id === chatId ? msg.reply_to_message.message_id : undefined,
    quotedMessageText: msg.reply_to_message?.chat?.id === chatId
      ? String(msg.reply_to_message.text || msg.reply_to_message.caption || '').trim().slice(0, 1200)
      : undefined,
  };

  const entryText = typeof msg.text === 'string' ? privateCommandText(msg.text) : '';
  const entry = entryForms.handle(actor, entryText);
  if (entry) {
    await sendTelegramMessage(chatId, entry.text, messageId, { html: false, replyMarkup: entry.replyMarkup });
    return;
  }

  // 🎙️ معالجة الرسائل الصوتية (Voice Notes) فورياً عبر Groq Whisper Large V3 (مع بديل Gemini الصوتي)
  if ((msg.voice || msg.audio) && BOT_TOKEN) {
    const fileId = msg.voice?.file_id || msg.audio?.file_id;
    const groqKey = setting('GROQ_API_KEY');

    if (fileId && (groqKey || GEMINI_API_KEY)) {
      try {
        await sendChatAction(chatId, 'record_voice');
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`, { signal: AbortSignal.timeout(12000) });
        const fileInfo = await fileInfoRes.json();

        if (fileInfo.ok && fileInfo.result?.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
          const audioRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(12000) });
          if (!audioRes.ok) throw new Error('Telegram audio unavailable');
          const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

          if (groqKey) {
            const whisperForm = new FormData();
            whisperForm.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'telegram_voice.ogg');
            whisperForm.append('model', 'whisper-large-v3-turbo');
            whisperForm.append('language', 'ar');
            whisperForm.append('prompt', 'فاي تك، تقرير اليوم، يومية عامل، مصروف، قيد محاسبي، أمر شغل، فيلا، طريحة، محارة، جبس، سباكة، ريال');

            const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${groqKey}` },
              body: whisperForm,
              signal: AbortSignal.timeout(25000),
            });

            const whisperJson = await whisperRes.json();
            if (whisperJson?.text) {
              rawText = whisperJson.text.trim();
            } else {
              console.warn('Groq Whisper response had no text:', whisperRes.status, whisperJson?.error?.message || '');
            }
          }

          // بديل احتياطي عبر Gemini Multimodal إذا لم ينجح Groq
          if (!rawText && GEMINI_API_KEY) {
            const geminiAudioRes = await fetch(GEMINI_GENERATE_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [
                    { text: 'فرّغ هذا التسجيل الصوتي باللغة العربية بدقة كما قيل تماماً دون أي شرح إضافي:' },
                    { inlineData: { mimeType: 'audio/ogg', data: audioBuffer.toString('base64') } },
                  ],
                }],
              }),
              signal: AbortSignal.timeout(20000),
            });
            if (geminiAudioRes.ok) {
              const geminiAudioJson = await geminiAudioRes.json();
              const transcribed = geminiAudioJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (transcribed) rawText = transcribed;
            }
          }

          if (rawText) {
            const curS = getBotSettings();
            const addr = curS.mozzaModeEnabled ? (curS.mozzaNickname || 'يا محاميحو') : 'يا باشمهندس';
            await sendTelegramMessage(chatId, `🎙️ <i>سمعتك بتقول ${escapeTelegramText(addr)}: "${escapeTelegramText(rawText.slice(0, 600))}"</i>\n\n⏳ <i>ثواني بجهزلك الطلب...</i>`, messageId);
          }
        }
      } catch (err) {
        console.error('Telegram voice processing failed:', err?.message);
      }
    }
  }

  // 📎📸 معالجة إرفاق الصور والمستندات والفيديوهات + قراءة الفواتير بالذكاء البصري (OCR Vision)
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  const hasDocument = Boolean(msg.document);
  const hasVideo = Boolean(msg.video);

  if ((hasPhoto || hasDocument || hasVideo) && BOT_TOKEN) {
    const largestPhoto = hasPhoto ? msg.photo[msg.photo.length - 1] : null;
    const fileId = largestPhoto?.file_id || msg.document?.file_id || msg.video?.file_id;
    const fileName = msg.document?.file_name || msg.video?.file_name || (hasPhoto ? `photo_${Date.now()}.jpg` : 'attachment');
    const mimeType = msg.document?.mime_type || msg.video?.mime_type || (hasPhoto ? 'image/jpeg' : 'application/octet-stream');
    const fileType = hasPhoto ? 'photo' : hasVideo ? 'video' : 'document';

    // هل يريد المستخدم إرفاق الملف بعملية معينة؟ (عبر زر الإرفاق أو الرد على بطاقة العملية أو ذكر رقم العملية)
    const quotedOpMatch = actor.quotedMessageText?.match(/#(\d{2,6})/);
    const captionOpMatch = rawText.match(/(?:ارفق|إرفاق|مرفق|ربط|تبع|للعمليه|للعملية|العمليه|العملية)\s*(?:رقم|#)?\s*#?(\d{2,6})/i);
    const pendingOpNum = pendingAttachmentForChat.get(String(chatId));
    const targetOpNum = captionOpMatch?.[1] || quotedOpMatch?.[1] || pendingOpNum || null;

    if (targetOpNum || hasDocument || hasVideo) {
      pendingAttachmentForChat.delete(String(chatId));
      const attachedOp = attachFileToOperation(targetOpNum || 'latest', {
        fileId,
        fileName,
        mimeType,
        fileType,
      });
      const opTag = attachedOp?.opNumber ? `#${attachedOp.opNumber}` : (targetOpNum ? `#${targetOpNum}` : 'الأخيرة');
      const totalAtt = Array.isArray(attachedOp?.attachments) ? attachedOp.attachments.length : 1;
      const curS = getBotSettings();
      const addr = curS.mozzaModeEnabled ? (curS.mozzaNickname || 'يا محاميحو') : 'يا باشمهندس';
      const attachReply = [
        `📎 تمام ${addr}، ربطتلك ${hasPhoto ? 'الصورة' : hasVideo ? 'الفيديو' : 'المستند'} بالعملية رقم [${opTag}]`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔢 رقم العملية: ${opTag} (${attachedOp?.recordCode || '—'})`,
        `📄 اسم الملف المرفق: ${fileName}`,
        `🏷️ نوع المرفق: ${hasPhoto ? 'صورة 📸' : hasVideo ? 'فيديو 🎥' : 'مستند رسمي 📄'} (${mimeType})`,
        `🗂️ إجمالي المرفقات على العملية دي: ${totalAtt} مرفق`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✅ خلاص اتحفظ واتربط بسجل العملية في سحابة فاي تك.`,
      ].join('\n');
      await sendTelegramMessage(chatId, attachReply, messageId, {
        html: false,
        replyMarkup: buildOperationInlineMarkup(`العملية رقم [${opTag}]`),
      });
      return;
    }

    // قراءة صورة الفاتورة / الإيصال تلقائياً عبر Gemini Vision OCR إذا أرسل المستخدم صورة
    if (hasPhoto && GEMINI_API_KEY && fileId) {
      try {
        await sendChatAction(chatId, 'typing');
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`, { signal: AbortSignal.timeout(12000) });
        const fileInfo = await fileInfoRes.json();
        if (fileInfo.ok && fileInfo.result?.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
          const imgRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(12000) });
          if (imgRes.ok) {
            const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
            const visionPrompt = rawText
              ? `حلل هذه الصورة المرفقة مع ملاحظة المستخدم ("${rawText}"). إذا كانت فاتورة أو إيصال أو سند، حوّلها إلى أمر نصي مباشر لتسجيل مصروف أو قيد بالمبلغ والبيان والمورد والمشروع، وإلا اشرح محتواها باختصار:`
              : `اقرأ هذه الصورة بدقة. إذا كانت فاتورة أو إيصال شراء أو سند، استخرج منها البيان والمبلغ الإجمالي بالريال واسم المورد واكتبها في جملة تبدأ بـ: "سجل مصروف [المبلغ] ريال [البيان]".`;

            const visionRes = await fetch(GEMINI_GENERATE_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [
                    { text: visionPrompt },
                    { inlineData: { mimeType: 'image/jpeg', data: imgBuffer.toString('base64') } },
                  ],
                }],
              }),
              signal: AbortSignal.timeout(20000),
            });
            if (visionRes.ok) {
              const visionJson = await visionRes.json();
              const extracted = visionJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (extracted) {
                rawText = extracted;
                const curS = getBotSettings();
                const addr = curS.mozzaModeEnabled ? (curS.mozzaNickname || 'يا محاميحو') : 'يا باشمهندس';
                await sendTelegramMessage(chatId, `📸 <i>قريتلك الصورة/الفاتورة بالذكاء البصري ${escapeTelegramText(addr)}:</i>\n«${escapeTelegramText(extracted.slice(0, 400))}»`, messageId);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Telegram photo OCR failed:', err?.message);
      }
    }
  }

  if (!rawText) {
    const curS = getBotSettings();
    const addr = curS.mozzaModeEnabled ? (curS.mozzaNickname || 'يا محاميحو') : 'يا باشمهندس';
    await sendTelegramMessage(chatId, msg.voice || msg.audio
      ? `معلش ${addr} ما قدرتش أسمع التسجيل كويس، ابعته تاني أو اكتبلي طلبك.`
      : `ابعتلي سؤالك كتابة أو فويس ${addr} وأنا تحت أمرك.`, messageId);
    return;
  }

  try {
    let cleanText = privateCommandText(rawText);
    if (['/new', '/reset'].includes(cleanText.toLowerCase())) {
      clearInactivityTimer(chatId);
      activeSessionOpened.delete(String(chatId));
      pendingPdfRequests.delete(actor);
      conversation.clear(actor);
      entryForms.clear(actor);
      const s = getBotSettings();
      const addr = s.mozzaModeEnabled ? (s.mozzaNickname || 'يا محاميحو') : 'يا باشمهندس';
      await sendTelegramMessage(chatId, `فتحنا محادثة جديدة ${addr}! معاك ${s.botName}، قولّي أقدر أساعدك في إيه النهارده؟`, messageId, { replyMarkup: { remove_keyboard: true } });
      return;
    }

    // جدولة مؤقت إنهاء المحادثة عند عدم الرد
    const isNewSession = !activeSessionOpened.has(String(chatId));
    activeSessionOpened.add(String(chatId));
    scheduleInactivityClose(chatId, actor);

    // 1. أمر البداية والترحيب
    if (['/start', '/help'].includes(cleanText.toLowerCase())) {
      const s = getBotSettings();
      const addr = s.mozzaModeEnabled ? (s.mozzaNickname || 'يا محاميحو') : `يا باشمهندس <b>${fromName}</b>`;
      const welcome = `
👋 أهلاً بيك ${addr}!
👩‍💼 معاك <b>${escapeTelegramText(s.botName)}</b> (${escapeTelegramText(s.botTitle)}).

تقدر تكلمني كتابة أو تبعتلي فويس في أي وقت، وأنا هرد عليك بصوتي وبالنص في:

📊 <b>تقارير الموقع والحسابات</b>
• «ابعت تقرير» أو «تقرير النهارده المفصل»
• «العمالة اللي نزلت النهارده»
• «المشاريع والفلل اللي عندنا كلها»

📝 <b>تسجيل أكتر من عملية في رسالة واحدة (كل عملية برقم مستقل)</b>
• «سجل قيد شراء أسمنت 3000 فيلا 10 وقيد نقل 500 فيلا 12»
• «اعمل أمر شغل محارة 200 متر بسعر 45 لمقاول أحمد فيلا 5»
• «ضيفلي يومية عامل محمد مطيز بند جبس طريحة 50 عمل 35 يومية 200»
• «سجل مصروف 500 ريال تشوين رمل فيلا 657»

✏️ <b>التعديل السريع برقم العملية أو بالـ Reply</b>
• كل عملية بتاخد رقم تسلسلي واضح (زي <code>#101</code>).
• قولّي أو اكتب: «عدل العملية رقم 101 خلي المبلغ 4500 والفيلا 12».

📸 <b>قراءة الفواتير وإرفاق الصور والمستندات</b>
• ابعت صورة أي فاتورة وهقرأها وأسجلهالك فوراً، أو دوس على زرار الإرفاق تحت أي عملية.
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
      const company = await resolveLiveCompanyAccess(actor);
      const proposal = trainingProposals.submit({ text, telegramUserId: actor.userId, companyId: company?.companyId ?? null });
      await sendTelegramMessage(chatId, 'سجّلت مقترح التدريب للمراجعة. رقمه <code>' + escapeTelegramText(proposal.id) + '</code>. هيظل معلق لحد اعتماده.', messageId);
      return;
    }

    const memoryCommand = cleanText.match(/^\/(?:memory|rules)(?:\s+([1-9]\d{0,2}))?$/i);
    if (memoryCommand) {
      const proposals = trainingProposals.list(actor.userId);
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
      const removed = !!withdraw[1] && trainingProposals.withdraw(withdraw[1], actor.userId);
      await sendTelegramMessage(chatId, removed ? 'سحبت مقترح التدريب.' : 'اكتب رقم مقترح معلق من قائمة /memory.', messageId);
      return;
    }

    if (cleanText === '/reload') {
      const knowledge = loadKnowledgeBase(true); // force-reload cache
      await sendTelegramMessage(chatId, 'قريت دليل المعرفة المعتمد والمستندات التدريبية. عدد الحروف: ' + knowledge.length + '.', messageId);
      return;
    }

    // 🧠 كاشف التعلم الذاتي التلقائي (Auto-Learning Memory)
    const ruleToLearn = detectAutoLearningTrigger(cleanText);
    if (ruleToLearn) {
      const res = addLearnedRule(ruleToLearn, fromName);
      const knowledge = loadKnowledgeBase(true); // force reload knowledge cache
      const confirmMsg = res?.alreadyExists
        ? `💡 <b>أنا متذكر هذه المعلومة بالفعل في ذاكرتي:</b>\n«${escapeTelegramText(ruleToLearn)}»\nوهي مفعلة ومطبقة في كافة الحسابات والعمليات.`
        : `🧠 <b>تم حفظ هذه القاعدة بنجاح في ذاكرتي الدائمة:</b>\n«${escapeTelegramText(ruleToLearn)}»\n\n✅ سأقوم بتطبيقها وتذكرها تلقائياً على كل العمليات والاستفسارات القادمة!\n📚 (إجمالي المعرفة المحمّلة: ${knowledge.length} حرف)`;
      await sendTelegramMessage(chatId, confirmMsg, messageId, { html: true });
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
    const botSettings = getBotSettings();
    const petName = botSettings.mozzaNickname || 'يا محاميحو';
    const rawIntro = botSettings.mozzaModeEnabled
      ? `💖 أهلاً بيك ${petName}! وحشتني أوي.. معاك حبيبتك {botName}، قولّي أعملك إيه في الشغل أو ندردش في إيه النهارده؟ 😘`
      : (botSettings.introTemplate || '👋 أهلاً بيك يا باشمهندس! معاك {botName} ({botTitle}).');
    const introHeader = isNewSession && botSettings.introEnabled
      ? `${rawIntro
          .replace(/\{botName\}/g, botSettings.botName || 'م. سلمى')
          .replace(/\{botTitle\}/g, botSettings.botTitle || '')}\n━━━━━━━━━━━━━━━━━━━━\n`
      : '';
    const shouldSendVoice =
      botSettings.voiceReplyMode === 'always' ||
      (botSettings.voiceReplyMode === 'on_voice_or_request' &&
        (Boolean(msg.voice || msg.audio) || /(?:رد\s*صوت|بصوت|صوتيا|صوتياً|فويس|voice)/i.test(cleanText)));

    if (reply.type === 'multi_messages' && Array.isArray(reply.messages)) {
      if (introHeader) {
        await sendTelegramMessage(chatId, introHeader.trim(), messageId, { html: false });
      }
      for (const msgItem of reply.messages) {
        await sendTelegramMessage(chatId, msgItem, messageId, {
          html: false,
          replyMarkup: buildOperationInlineMarkup(msgItem),
        });
        await new Promise(r => setTimeout(r, 200));
      }
      if (shouldSendVoice) {
        const speech = reply.messages.length === 1
          ? reply.messages[0]
          : 'نتيجة كل عملية موجودة في رسالتها. راجع الرسائل المكتوبة للتفاصيل.';
        await sendTelegramVoiceReply(chatId, speech, messageId, botSettings);
      }
    } else {
      const fullReplyText = introHeader + (reply.text || '');
      const delivery = await sendTelegramMessage(chatId, fullReplyText, messageId, {
        html: false,
        replyMarkup: buildOperationInlineMarkup(reply.text || ''),
      });
      if (delivery.ok && reply.memory) {
        conversation.remember({ ...actor, ...reply.memory, userMessageId: messageId,
          botMessageIds: delivery.messageIds, userText: cleanText });
      }
      if (shouldSendVoice && reply.text) {
        await sendTelegramVoiceReply(chatId, reply.text, messageId, botSettings);
      }
    }
  } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('COPILOT_PROPOSAL_')) {
      await sendTelegramMessage(chatId, escapeTelegramText(error.message), messageId);
      return;
    }
    console.error('Copilot could not handle an authorized message.');
    await sendTelegramMessage(chatId, 'تعذّر إكمال الطلب. لو المشكلة بتتكرر راجع إعدادات البوت.', messageId);
  }
}

async function handleCallbackQuery(cb) {
  if (!cb?.id) return;
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const data = String(cb.data || '');

  const answerCb = async (text) => {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cb.id, text }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {}
  };

  const m = data.match(/^(op_approve|op_attach|op_delete):(\d{1,6})$/);
  if (!m || !chatId) {
    await answerCb('تم استلام الإجراء');
    return;
  }

  const [, action, opNum] = m;
  const op = resolveOperationByNumberOrCode(opNum);

  if (action === 'op_attach') {
    pendingAttachmentForChat.set(String(chatId), Number(opNum));
    await answerCb(`جاهز لإرفاق ملف بالعملية #${opNum}`);
    await sendTelegramMessage(
      chatId,
      `📎 أرسل الآن الصورة أو المستند (PDF / Word / Excel) أو الفيديو في المحادثة، وسأقوم بربطه فوراً بالعملية رقم [#${opNum}].`,
      messageId,
      { html: false }
    );
    return;
  }

  if (action === 'op_approve') {
    updateOperationStatusInIndex(opNum, 'معتمد ومرحّل');
    await answerCb(`تم اعتماد وترحيل العملية #${opNum}`);
    const nowStr = new Date().toLocaleString('ar-EG', { timeZone: 'Asia/Riyadh' });
    const msg = [
      `✅ إشعار اعتماد وترحيل رسمي | العملية رقم [#${opNum}]`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔢 رقم العملية: #${opNum} (${op?.recordCode || '—'})`,
      `📌 البيان: ${op?.summary || 'عملية مسجلة'}`,
      `🕒 وقت الاعتماد: ${nowStr}`,
      `🟢 الحالة الجديدة: معتمد ومرحّل نهائياً`,
    ].join('\n');
    await sendTelegramMessage(chatId, msg, messageId, { html: false });
    return;
  }

  if (action === 'op_delete') {
    updateOperationStatusInIndex(opNum, 'ملغاة');
    await answerCb(`تم إلغاء المسودة #${opNum}`);
    await sendTelegramMessage(
      chatId,
      `🗑️ تم إلغاء وإيقاف مسودة العملية رقم [#${opNum}] (${op?.recordCode || '—'}) بنجاح.`,
      messageId,
      { html: false }
    );
    return;
  }
}

async function handleUpdate(update) {
  if (update?.callback_query) {
    return handleCallbackQuery(update.callback_query);
  }
  const message = update?.message || update?.channel_post;
  if (!message) return;
  if (message.from?.is_bot) return;

  const isPrivate = message.chat?.type === 'private';
  const isTargetChat = (SHARED_CHAT_ID !== null && message.chat?.id === SHARED_CHAT_ID) ||
    (CHAT_ID !== null && message.chat?.id === CHAT_ID) ||
    (RAW_CHAT_ID && String(message.chat?.id) === RAW_CHAT_ID);

  console.log(`📩 [Telegram Update] من: ${message.from?.first_name || message.sender_chat?.title || ''} (@${message.from?.username || message.from?.id || message.sender_chat?.id || ''}) | شات: ${message.chat?.id} (${message.chat?.type}) | نص: "${String(message.text || message.caption || (message.voice ? '[بصمة صوتية]' : '[مرفق]')).slice(0, 40)}"`);

  if (isPrivate || isTargetChat) {
    return processTelegramMessage(message);
  }
}

// Long-polling loop
let offset = 0;
let isPolling = true;

async function loadBotUsername() {
  if (botUsername) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (res.ok && data?.ok === true && typeof data.result?.username === 'string') {
      botUsername = data.result.username;
    }
  } catch {
    console.warn('Telegram bot username could not be verified. Tagged commands require TELEGRAM_BOT_USERNAME.');
  }
}

async function pollUpdates() {
  if (SHARED_CHAT_ID !== null) await loadBotUsername();
  const allowedUpdates = ['message', 'channel_post', 'callback_query'];
  console.log('📡 بدء الاستماع المباشر لرسائل تيليجرام (Long Polling)...');
  while (isPolling) {
    try {
      const query = new URLSearchParams({ offset: String(offset), timeout: '25', allowed_updates: JSON.stringify(allowedUpdates) });
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?${query}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(35000) });
      const data = await res.json();

      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        console.log(`📥 [Telegram Poll] تم استلام ${data.result.length} تحديث جديد.`);
        for (const update of data.result) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      } else if (!data.ok) {
        const errorCode = Number.isSafeInteger(data.error_code) ? data.error_code : undefined;
        console.warn('Telegram poll returned an error.', { status: res.status, errorCode });
        if ([401, 404].includes(errorCode ?? res.status)) {
          console.error('Telegram rejected the bot token. Check the TELEGRAM_BOT_TOKEN setting on the worker.');
          process.exitCode = 1;
          return;
        }
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
    '/pdf worker أحمد محمد 2026-01',
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

// ⏰ جدولة التقرير اليومي التلقائي (Scheduled Daily Digest) بتوقيت الرياض
let _lastAutoReportSentDate = '';
function startDailyReportScheduler() {
  const targetChat = SHARED_CHAT_ID ?? CHAT_ID ?? RAW_CHAT_ID;
  if (!targetChat) return;

  setInterval(async () => {
    try {
      const s = getBotSettings();
      if (!s.autoDailyReportEnabled) return;
      const targetTime = (s.autoDailyReportTime || '20:00').trim();
      const now = new Date();
      const todayStr = getCopilotDate(now);
      if (_lastAutoReportSentDate === todayStr) return;

      const riyadhHHMM = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Riyadh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

      if (riyadhHHMM === targetTime) {
        _lastAutoReportSentDate = todayStr;
        const verified = await resolveLiveCompanyAccess({ chatId: targetChat, userId: 0 });
        if (!verified) return;
        const tools = createCopilotTools({
          supabaseUrl: SUPABASE_URL,
          supabaseKey: verified.allowServiceRole ? SUPABASE_SERVICE_KEY : SUPABASE_PUBLIC_KEY,
          accessToken: verified.accessToken,
          companyId: verified.companyId,
          detailedReads: true,
          allowServiceRole: Boolean(verified.allowServiceRole),
        });
        const reportText = await runEnabledCopilotTool(
          { name: 'get_daily_comprehensive_report', args: { date: 'today' } },
          tools,
          verified
        );
        const header = `⏰ <b>التقرير اليومي التلقائي المجدول (${targetTime}) — معك ${escapeTelegramText(s.botName)}</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        await sendTelegramMessage(targetChat, header + escapeTelegramText(reportText), undefined, { html: true });
        if (s.voiceReplyMode !== 'off') {
          await sendTelegramVoiceReply(targetChat, reportText, undefined, s);
        }
      }
    } catch (err) {
      console.warn('Auto daily report scheduler error:', err?.message);
    }
  }, 45_000).unref();
}

initKnowledgeBase();
startDailyReportScheduler();
runPdfMockTest().catch(err => console.error('Mock test error:', err.message));
// Polling timeout=25s (long-poll standard). AbortSignal is 35s. // TODO: env — COPILOT_POLL_TIMEOUT_S
pollUpdates();
