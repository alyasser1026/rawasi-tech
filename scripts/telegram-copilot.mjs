import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { createCopilotTools } from './copilot-tools.mjs';
import { authorizeTelegramMessages, getSharedTelegramCommand, normalizeTelegramChatId, normalizeTelegramSharedChatId } from './copilot-telegram-auth.mjs';
import { createCopilotCompanyAccess } from './copilot-company-access.mjs';
import { createCopilotTrainingProposals } from './copilot-training-proposals.mjs';
import { getCopilotDate, getEnabledCopilotDeclarations, runEnabledCopilotTool, splitReportParts } from './copilot-tool-policy.mjs';
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
  KNOWN_COMPANIES, getActiveCompany, setActiveCompany,
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
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}
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
const COPILOT_VOICE_PROVIDER = setting('COPILOT_VOICE_PROVIDER')?.trim();
const COPILOT_GEMINI_TTS_VOICE = setting('COPILOT_GEMINI_TTS_VOICE')?.trim();
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
let _cachedServiceCompanyId = null;

function convertAudioToWav(inputBuffer) {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 'wav', '-ar', '16000', '-ac', '1', 'pipe:1'], { stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks = [];
    proc.stdout.on('data', c => chunks.push(c));
    proc.on('close', code => {
      if (code === 0 && chunks.length) resolve(Buffer.concat(chunks));
      else resolve(null);
    });
    proc.on('error', () => resolve(null));
    proc.stdin.write(inputBuffer);
    proc.stdin.end();
  });
}

async function resolveServiceCompanyAccess() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const activeComp = getActiveCompany();
  const currentTargetCompanyId = activeComp?.id || DEFAULT_COMPANY_ID;

  if (_cachedServiceAccess && _cachedServiceCompanyId === currentTargetCompanyId && Date.now() - _cachedServiceAccessAt < 5 * 60 * 1000) {
    return _cachedServiceAccess;
  }
  try {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let company = null;
    if (currentTargetCompanyId) {
      const { data } = await adminClient
        .from('companies')
        .select('id, name, code, is_active')
        .eq('id', currentTargetCompanyId)
        .maybeSingle();
      if (data) company = data;
    }
    if (!company) {
      const { data } = await adminClient
        .from('companies')
        .select('id, name, code, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
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
      companyName: company.name || activeComp?.name || 'فاي تك',
      companyCode: company.code || activeComp?.code || 'PHI',
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
    _cachedServiceCompanyId = company.id;
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
  const currentSettings = getBotSettings();
  if (settings?.voiceReplyMode === 'off' || currentSettings?.voiceReplyMode === 'off') {
    return false;
  }
  void sendChatAction(chatId, 'record_voice');
  const audio = await synthesizeArabicSpeech(textToSpeak, {
    settings: { ...settings, onlyGeminiVoice: settings?.onlyGeminiVoice ?? false },
    geminiApiKey: GEMINI_API_KEY,
    voiceProvider: 'gemini',
    geminiVoice: COPILOT_GEMINI_TTS_VOICE,
    elevenlabsApiKey: setting('ELEVENLABS_API_KEY'),
  });
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

function buildCompanySwitchMarkup(activeId) {
  const isComp1 = activeId === '72918f4d-10c3-43a0-884e-2f84f1224335';
  return {
    inline_keyboard: [
      [
        {
          text: isComp1 ? '🟢 شركة 1: فاي تك (مفعلة)' : '🏢 التبديل لشركة 1: فاي تك',
          callback_data: 'switch_company:1',
        },
        {
          text: !isComp1 ? '🟢 شركة 2: PHI-TECH-EGY (مفعلة)' : '🏢 التبديل لشركة 2: PHI-TECH-EGY',
          callback_data: 'switch_company:2',
        },
      ],
    ],
  };
}

function buildCompanySwitchedText(targetCompany, botSettings) {
  const addr = botSettings.mozzaModeEnabled ? (botSettings.mozzaNickname || 'يا يسور') : 'يا باشمهندس';
  const isOne = targetCompany.index === 1 || targetCompany.id === '72918f4d-10c3-43a0-884e-2f84f1224335';
  return [
    `🏢 <b>تمام ${addr}، فتحتلك ${isOne ? 'الشركة الأولى' : 'الشركة الثانية'} بنجاح!</b> ✨`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏛️ <b>اسم الشركة:</b> ${escapeTelegramText(targetCompany.name)}`,
    `🏷️ <b>كود الشركة:</b> <code>${targetCompany.code || (isOne ? 'PHI' : 'AWA')}</code>`,
    `🔢 <b>الرقم:</b> ${isOne ? 'شركة 1 (الرئيسية 🇸🇦)' : 'شركة 2 (مصر 🇪🇬)'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ كل الاستفسارات والتقارير والعمليات الجديدة (مصروفات، قيود، يوميات، أوامر شغل) بقت متصلة دلوقتي على <b>${isOne ? 'الشركة الأولى' : 'الشركة الثانية'}</b> مباشرة.`,
  ].join('\n');
}

function buildSettingsMessageAndMarkup(s = getBotSettings()) {
  const isVoiceOff = s.voiceReplyMode === 'off';
  const isEmergency = s.emergencyVoiceEnabled !== false && s.onlyGeminiVoice !== true;
  const isMozza = Boolean(s.mozzaModeEnabled);
  const curComp = getActiveCompany(s);
  const isComp1 = curComp.id === '72918f4d-10c3-43a0-884e-2f84f1224335';
  const text = [
    `⚙️ لوحة إعدادات المساعد الذكي (${s.botName || 'م. سلمى'})`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏢 الشركة الحالية للبوت: ${curComp.name} (${curComp.code}) ${curComp.flag || ''}`,
    `🎙️ الرسائل الصوتية: ${isVoiceOff ? 'مقفولة ومعطلة بالكامل 🔇 (نص فقط)' : 'مفعلة وشغالة 🔊'}`,
    `1️⃣ الصوت الأساسي الأول: Gemini (Aoede) 🎙️`,
    `2️⃣ الصوت البديل الذكي: ElevenLabs (Sarah / eleven_v4) 🎭`,
    `3️⃣ صوت الطوارئ المجاني (Edge): ${isEmergency ? 'شغال كاحتياطي أخير ✅' : 'مقفول ومعطّل ❌'}`,
    `💖 وضع الموزة: ${isMozza ? `مفعّل (${s.mozzaNickname || 'يا يسور'}) 💖` : 'مغلق (الوضع الرسمي) 💼'}`,
    `⏳ إغلاق الجلسة التلقائي: ${s.inactivityCloseEnabled ? `${s.inactivityTimeoutMinutes || 3} دقائق ✅` : 'معطل ❌'}`,
    `📊 التقرير اليومي: ${s.autoDailyReportEnabled ? `مفعّل (${s.autoDailyReportTime || '20:00'}) ✅` : 'معطل ❌'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💡 للتبديل بين الشركات: اضغط على زر الشركة بالأسفل أو قول «افتحلي شركة واحد» أو «افتحلي شركة 2».`,
  ].join('\n');

  const markup = {
    inline_keyboard: [
      [
        {
          text: isComp1 ? '🟢 شركة 1: فاي تك' : '🏢 فتح شركة 1: فاي تك',
          callback_data: 'switch_company:1',
        },
        {
          text: !isComp1 ? '🟢 شركة 2: PHI-TECH-EGY' : '🏢 فتح شركة 2: PHI-TECH-EGY',
          callback_data: 'switch_company:2',
        },
      ],
      [
        {
          text: isVoiceOff ? '🔊 تشغيل الرسائل الصوتية' : '🔇 إغلاق الرسائل الصوتية بالكامل',
          callback_data: isVoiceOff ? 'set_voice_messages:on' : 'set_voice_messages:off',
        },
      ],
      [
        {
          text: isEmergency ? '🛑 إيقاف صوت طوارئ Edge' : '✅ تشغيل صوت طوارئ Edge',
          callback_data: isEmergency ? 'set_emergency_voice:off' : 'set_emergency_voice:on',
        },
      ],
      [
        {
          text: isMozza ? '💼 تحويل للوضع الرسمي' : '💖 تفعيل وضع الموزة',
          callback_data: isMozza ? 'set_mozza:off' : 'set_mozza:on',
        },
      ],
      [
        {
          text: '🔄 تحديث الإعدادات',
          callback_data: 'settings_refresh',
        },
      ],
    ],
  };

  return { text, replyMarkup: markup };
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

function cleanWorkerName(name) {
  if (!name) return '';
  let n = name
    .replace(/^(?:سجل(?:ي(?:لي)?)?|ضيف(?:ي(?:لي)?)?|أضف|اضف|ادخل|دخل|دخله(?:الي)?|مصروفات|مصروف|مصاريف|فاتورة|فواتير|يومية|يوميات|امبارح|أمس|النهارده|النهاردة|اليوم|و|أو|منهم|كشف|بيان)\s+/iu, '')
    .replace(/\s+(?:في\s*العمال[ةه]|للعمال[ةه]|يومية|يوميات|مصروفات|مصروف)$/iu, '')
    .trim();
  if (/(?:مشروع|فيلا|بند|شركة|مصروف|فواتير|فاتورة|سند|صرف|سداد)/iu.test(n) && !/(?:حارس|جرار|ونش|سائق|خفير|عامل|صنايعي|فني|مساعد)/iu.test(n)) {
    return '';
  }
  return n;
}

function parseBatchLaborLogs(userPrompt) {
  const text = String(userPrompt || '').trim();
  if (!text) return null;

  // استبعاد طلبات إنشاء أمر شغل صراحة حتى لا تتداخل مع يوميات العمالة
  if (/^(?:اعمل|انشئ|أنشئ|سجل|سجّل|ضيف|أضف|اضف)\s+(?:أمر\s*شغل|امر\s*شغل|أمر\s*تشغيل|امر\s*تشغيل)/iu.test(text)) return null;

  // إذا كانت الرسالة سطراً واحداً وتصف فريق عمل محدد (فني ومساعد)، نتركها لقاعدة الفريق الفردي
  if (!text.includes('\n') && /(?:للفني|فني)\s+.*(?:و?العامل|و?عامل|و?المساعد|و?مساعد)/iu.test(text)) return null;

  // 1. فحص نية تسجيل يوميات أو عمالة
  const hasLaborIntent =
    (/(?:يوميات|يومية|يوميه|عمال|العمال|عمالة|العماله|العمالة)/iu.test(text) &&
     /(?:ضيف|اضف|أضف|سجل|سجّل|اعمل|انشئ|أنشئ|عاوز|عايز|محتاج|دخل|ادخل|دخلهالي)/iu.test(text)) ||
    /(?:دخله(?:الي)?\s*في\s*العمال[ةه]|في\s*العمال[ةه]|للعمال[ةه])/iu.test(text);

  if (!hasLaborIntent) return null;

  // 2. استخراج الشركة المستهدفة إن ذُكرت
  let targetCompany = null;
  if (/(?:شرك[ةه]\s*(?:رقم\s*)?(?:2|اتنين|تنين|التانيه|الثانيه|الثانية|مصر)|phi-tech-egy|awa)/iu.test(text)) {
    targetCompany = 2;
  } else if (/(?:شرك[ةه]\s*(?:رقم\s*)?(?:1|واحد|الاولى|الأولى|السعوديه|السعودية)|phi)/iu.test(text)) {
    targetCompany = 1;
  }

  // 3. استخراج التاريخ إن وُجد
  let workDate = undefined;
  const dateMatch = text.match(/(?:بتاريخ|تاريخ|يوم)\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch) {
    workDate = dateMatch[1].replace(/\//g, '-');
  } else if (/(?:امبارح|أمس)/u.test(text)) {
    workDate = 'yesterday';
  }

  // 4. استخراج المشروع / الفيلا
  const projectMatch = text.match(/(?:في\s+|لـ?)?(?:مشروع|فيلا|عماره|عمارة|موقع|برج)\s+([^\n\r,،]+?)(?=\s+(?:على|في|بند|وبند|وامر|وأمر|امر|أمر|يومية|يوميات|للعمال|دخلهالي|دخلها|في\s*العمال|$))/iu);
  let siteRef = projectMatch ? projectMatch[0].replace(/^(?:في\s+|لـ?)/u, '').trim() : null;
  if (siteRef) {
    siteRef = siteRef.replace(/\s+(?:على|في|لـ?|بـ?)$/u, '').trim();
  }
  if (!siteRef) {
    const inlineSite = text.match(/(?:لـ?|في\s+)?(برج\s+[\p{L}\p{N}]+|فيلا\s+[\p{L}\p{N}_-]+)/u);
    if (inlineSite) siteRef = (inlineSite[1] || inlineSite[0]).replace(/^(?:في\s+|لـ?)/u, '').trim();
  }

  // 5. استخراج البند
  const itemMatch = text.match(/(?:بند)\s+([^\n\r,،]+?)(?=\s+(?:وامر|وأمر|امر|أمر|مشروع|فيلا|برج|عماره|عمارة|موقع|للعمال|دخلهالي|دخلها|في\s*العمال|$))/iu);
  let workItem = itemMatch ? itemMatch[1].trim() : null;
  if (workItem) {
    workItem = workItem.replace(/(?:دخله(?:الي)?\s*في\s*العمال[ةه]|في\s*العمال[ةه]|للعمال[ةه]).*$/u, '').trim();
  }
  if (!workItem) {
    const knownItemMatch = text.match(/(?:الاستراوس|خمرة\s*الاستراوس|كمرة\s*الاستراوس|كمر\s*استراوس|كمر\s*ستراوس|محارة|سباكة|نجارة|حدادة|مباني|دهانات|سيراميك|عزل|جبس)/iu);
    if (knownItemMatch) workItem = knownItemMatch[0].trim();
  }

  // 6. استخراج أمر الشغل المحدد صراحة
  const joMatch = text.match(/(?:على\s+)?(?:وامر\s*شغل|وأمر\s*شغل|امر\s*شغل|أمر\s*شغل)\s*(?:رقم\s*)?#?([^\n\r,،]+?)(?=\s+(?:وبند|بند|ومشروع|مشروع|وفيلا|فيلا|وبرج|برج|ودخله|دخله|في\s*العمال[ةه]|$))/iu);
  let explicitJobOrder = joMatch ? joMatch[1].trim() : null;
  if (explicitJobOrder) {
    explicitJobOrder = explicitJobOrder.replace(/^(?:على|في|رقم)\s+/u, '').replace(/(?:اللي|اللى|مربوط|مربوطة|خاص).*$/iu, '').trim();
  }

  // تنظيف النص العام من عبارات المشروع والبند وأمر الشغل والأسئلة وكلمات الأوامر
  let cleanText = text
    .replace(/(?:في\s+|لـ?)?(?:مشروع|فيلا|برج|عماره|عمارة|موقع)\s+[^\n\r,،]+/gi, ' ')
    .replace(/(?:وبند|بند)\s+[^\n\r,،]+/gi, ' ')
    .replace(/(?:على\s+)?(?:وامر|وأمر|امر|أمر)\s*شغل[^\n\r,،]*/gi, ' ')
    .replace(/(?:دخله(?:الي)?\s*في\s*العمال[ةه]|في\s*العمال[ةه]|للعمال[ةه])/gi, ' ')
    .replace(/(?:سجلي|سجل|ضيفي|ضيف|أضف|اضف|ادخل|دخل|اعمل)\s*(?:لي)?\s*(?:مصروفات|مصاريف|مصروف|يوميات|يومية|فواتير|فاتورة)?\s*(?:امبارح|أمس|النهارده|النهاردة|اليوم)?/gi, ' ')
    .replace(/ليه\s+اليوميات[^\n\r]*/gi, ' ')
    .replace(/المفروض\s+البوت[^\n\r]*/gi, ' ');

  const rawLines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const lines = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    if (/^(?:(?:في\s*شركة\s*(?:رقم\s*)?[12]\s*)?(?:عاوز|عايز|محتاج|سجل|سجّل|ضيف|أضف|اضف))/iu.test(line)) {
      line = line.replace(/^(?:.*?(?:دي|دول|الاتية|الآتية|التالية)\s*:?\s*|.*?(?:للعمال|للعامل|للعمالة)\s*:?\s*)/iu, '').trim();
    }
    if (line) lines.push(line);
  }

  const workers = [];
  let currentWorker = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^(?:غير\s+مربوط|ينتهي|عامل\s+يومية|---)/iu.test(line)) {
      continue;
    }

    const codeMatch = line.match(/\b(WRK-\d+|[0-9]{3,5})\b/i);
    const phoneMatch = line.match(/^(\+?[0-9]{10,14})$/);
    const roleWageMatch = line.match(/^([\p{L}\s]+?)\s*\((?:يومية|يوميه)[\s:]*(\d+(?:\.\d+)?)\s*(?:ر\.س|ريال|جنيه|ج\.م)?\)$/u) ||
                          line.match(/(?:يومية|يوميه)[\s:]*(\d+(?:\.\d+)?)/u);

    if (codeMatch && !line.includes(' ')) {
      if (currentWorker) {
        currentWorker.code = codeMatch[1];
      } else {
        currentWorker = { code: codeMatch[1] };
      }
      continue;
    }

    if (phoneMatch) {
      if (currentWorker) {
        currentWorker.phone = phoneMatch[1];
      } else {
        currentWorker = { phone: phoneMatch[1] };
      }
      continue;
    }

    if (roleWageMatch) {
      if (!currentWorker) currentWorker = {};
      if (roleWageMatch[1] && isNaN(Number(roleWageMatch[1]))) {
        currentWorker.skill_level = roleWageMatch[1].trim();
      }
      const wageVal = roleWageMatch[2] || (roleWageMatch[1] && !isNaN(Number(roleWageMatch[1])) ? roleWageMatch[1] : null);
      if (wageVal) currentWorker.daily_wage = Number(wageVal);
      continue;
    }

    // اسم الشخص (1 إلى 4 كلمات بدون كلمات النظام)
    if (/^[\p{L}\s]{2,40}$/u.test(line)) {
      const cleanN = cleanWorkerName(line);
      if (cleanN && cleanN.length >= 2) {
        if (currentWorker?.name) {
          workers.push(currentWorker);
          currentWorker = {};
        }
        if (!currentWorker) currentWorker = {};
        currentWorker.name = cleanN;
      }
    }
  }

  if (currentWorker?.name) {
    workers.push(currentWorker);
  }

  // إذا لم نجد عمالاً بالطريقة الرأسية، نبحث بالنمط الأفقي
  if (workers.length === 0) {
    // 1) نمط: المبلغ ثم الاسم (مثال: «1000جرار نقل خشب و 100 حارس» أو «1000 جرار و 100 حارس»)
    const amountFirstMatches = [...cleanText.matchAll(/(\d{2,6})\s*([\p{L}\s]{2,30}?)(?=\s+(?:و\s*\d|\d|$|[،,.]|\r?\n))/gu)];
    for (const m of amountFirstMatches) {
      const wage = Number(m[1]);
      const rawName = cleanWorkerName(m[2]);
      if (rawName && rawName.length >= 2 && wage > 0) {
        workers.push({
          name: rawName,
          daily_wage: wage,
        });
      }
    }

    // 2) نمط: الاسم ثم المبلغ (مثال: «إبراهيم النجار 700 ومحمد بهلول 700»)
    if (workers.length === 0) {
      const inlineMatches = [...cleanText.matchAll(/([\p{L}\s]{2,30}?)\s*(?:نجار\s*مسلح|مساعد|حداد\s*مسلح|بناء|مليس|صنايعي|فني)?\s*(?:يومية|يوميته|أجر|اجر|بـ)?\s*(\d{2,5})\s*(?:ر\.س|ريال|جنيه|ج\.م)?(?=\s+(?:و|$)|\r?\n|[،,.])/gu)];
      for (const m of inlineMatches) {
        const rawName = cleanWorkerName(m[1]);
        const wage = Number(m[2]);
        if (rawName && rawName.length >= 2 && wage > 0) {
          workers.push({
            name: rawName,
            daily_wage: wage,
          });
        }
      }
    }
  }

  if (workers.length === 0) return null;
  if (workers.length === 1 && !text.includes('\n') && !/(?:قائمة|كشف|يوميات)/iu.test(text)) {
    return null; // نترك العامل الفردي للقاعدة 1 لتطبيق كامل التفاصيل والإنتاجية والمساعد
  }

  const calls = workers.map(w => ({
    name: 'add_labor_daily_log_draft',
    args: {
      worker_name: w.name,
      ...(w.daily_wage ? { daily_wage: w.daily_wage } : {}),
      ...(w.skill_level ? { skill_level: w.skill_level } : {}),
      ...(siteRef ? { site_ref: siteRef } : {}),
      ...(workItem ? { work_item: workItem } : {}),
      ...(explicitJobOrder ? { job_order: explicitJobOrder } : {}),
      ...(workDate ? { work_date: workDate } : {}),
    },
  }));

  return {
    type: 'multi_tools',
    targetCompany,
    calls,
    workersCount: workers.length,
    siteRef,
    workItem,
  };
}

export function detectDirectFieldOpsCall(userPrompt, quotedMessageText = '') {
  const raw = String(userPrompt || '').trim();
  if (!raw) return null;
  // تنظيف أي عبارات دلع أو ترحيب في أول الجملة حتى تعمل كل أوامر الشغل بشكل طبيعي داخل وضع الموزة
  const t = raw
    .replace(/^(?:(?:صباح|مساء)\s*(?:الخير|الفل|الورد|الياسمين|العسل)|وحشتيني|وحشتنى|بحبك|عامله\s*ايه|عاملة\s*إيه|اخبارك\s*ايه|أخبارك\s*إيه|يا\s*(?:قلبي|روحي|حبيبتي|موزه|موزة|سلمى|قمر|عسل|باشمهندسه|باشمهندسة|جميله|جميلة)|حبيبتي|روحي|قلبي|سلمى|بقولك|اقولك|لو\s*سمحتي|معلش)[\s،,.-]*/iu, '')
    .replace(/^(?:يا\s*(?:قلبي|روحي|حبيبتي|موزه|موزة|سلمى|قمر|عسل)|حبيبتي|روحي|قلبي)[\s،,.-]*/iu, '')
    .trim() || raw;

  // 0.0) كشف وإضافة قائمة يوميات مجمعة لعدة عمال بدقة وحساسية هندسية فائقة
  const batchLabor = parseBatchLaborLogs(t);
  if (batchLabor && Array.isArray(batchLabor.calls) && batchLabor.calls.length > 0) {
    return batchLabor;
  }

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

  // 0.5) إنشاء أو تسجيل سند صرف مالي بحساسية ودقة فائقة (شاشة سندات الصرف: صرفه ودفع تمنه من الخزينة)
  const isCashDisbursement =
    /(?:^|\s)(?:صرفنا|دفعنا|سددنا|ادفع(?:لي)?|إدفع(?:لي)?|اصرف(?:لي)?|إصرف(?:لي)?|حاسبنا|حاسب(?:لي)?)(?:\s|$)/iu.test(t) ||
    /(?:سند\s*(?:صرف|سداد|دفع)|إيصال\s*صرف|ايصال\s*صرف|سند\s*قبض\s*وصرف)/iu.test(t) ||
    (/(?:اعمل|أنشئ|انشئ|سجل|سجّل|ضيف|أضف|اضف)\s+(?:سند|صرف|سداد|دفعة|دفعه)/iu.test(t) && !/(?:يوميه|يومية|حضور|انتاجية|إنتاجية)/iu.test(t)) ||
    (/(?:دفعة|دفعه|سلفة|سلفه)\s*(?:تحت\s*الحساب)?/iu.test(t) && /(?:لـ|للمقاول|للعامل|للفني|للمساعد|للمورد|للأستاذ|للمهندس|للشريك)/iu.test(t));

  const isInvoiceOrMaterialPurchase =
    /(?:فاتورة|فاتوره|فواتير|اشترينا|شراء|خامات|مواد\s*بناء|طن\s*حديد|شكارة\s*اسمنت|شكاير\s*اسمنت)/iu.test(t);

  const isPaymentVoucherTrigger = isCashDisbursement && !isInvoiceOrMaterialPurchase;

  if (isPaymentVoucherTrigger) {
    // 1. استخراج الموقع / الفيلا إن وُجدت
    let siteRef = null;
    const siteMatch = t.match(/(?:و?الفيلا|و?فيلا|و?المشروع|و?مشروع|و?العماره|و?عماره|و?العمارة|و?عمارة|و?الموقع|و?موقع)\s*([\p{L}\p{N}_-]+)/u);
    if (siteMatch) {
      siteRef = siteMatch[0].trim();
    }

    // 2. استخراج المبلغ
    let amount = undefined;
    const amtExplicit =
      t.match(/(?:مبلغ|بمبلغ|قيمة|قيمه|بقيمة|بـ|ب|قدره|وقدره)\s*(\d+(?:\.\d+)?)/i) ||
      t.match(/(\d+(?:\.\d+)?)\s*(?:ريال|رس|ر\.س|جنيه|جنية)/i);
    if (amtExplicit) {
      amount = Number(amtExplicit[1]);
    } else {
      const allNums = [...t.matchAll(/\b(\d+(?:\.\d+)?)\b/g)];
      for (const m of allNums) {
        const num = m[1];
        if (siteMatch && siteMatch[1] === num) continue;
        amount = Number(num);
        break;
      }
    }

    // 3. استخراج المستفيد (المقاول، العامل، الفني، المورد، الشخص)
    const payeeMatch = t.match(
      /(?:^|\s)(?:لصالح|باسم|بإسم|للمستفيد|المستفيد|المدفوع\s*له|لأجور|لاجور|للعامل|لعامل|للفني|لفني|للصنايعي|لصنايعي|للمساعد|لمساعد|للمقاول|لمقاول|للمورد|لمورد|للأستاذ|للمهندس|لمهندس|للشريك|لشريك|لـ|ل)(?:\s+)?([\p{L}\s]{2,40}?)(?=\s+(?:مبلغ|بمبلغ|فيلا|مشروع|موقع|عماره|عمارة|بند|من\s*حساب|من\s*الخزنة|من\s*الخزينه|كاش|نقدا|تحويل|شيك|بيان|وصف|دفعة|دفعه|\d)|$)/u
    );
    let payeeName = payeeMatch?.[1]?.trim();
    if (payeeName) {
      payeeName = payeeName
        .replace(/^(?:العامل|عامل|الفني|فني|المساعد|مساعد|المقاول|مقاول|المورد|مورد|المهندس|مهندس|الأستاذ|استاذ|الأسطى|اسطى|صنايعي|أجور|اجور)\s+/u, '')
        .replace(/^(?:سند|صرف|سداد)\s*/u, '')
        .trim();
    }
    if (!payeeName || payeeName === 'سند' || payeeName === 'صرف') {
      const fallbackPayee = t.match(/(?:^|\s)(?:العامل|عامل|المقاول|مقاول|المورد|مورد|الفني|فني)\s+([\p{L}\s]{2,30}?)(?=\s+(?:مبلغ|فيلا|مشروع|بند|\d)|$)/u);
      if (fallbackPayee) {
        payeeName = fallbackPayee[1].trim();
      }
    }

    // 4. استخراج البيان أو الوصف
    let description = undefined;
    const descMatch = t.match(/(?:البيان|بيان|الوصف|وصف|عن|نظير|بخصوص|مقابل|دفعة|دفعه)\s+([\p{L}\p{N}\s]{2,80}?)(?=\s+(?:مبلغ|فيلا|مشروع|لـ|للمقاول|للعامل|للفني|للمساعد|للمورد|\d)|$)/u);
    if (descMatch) {
      description = descMatch[1].trim();
      if (/^(?:تحت\s*الحساب|أعمال|اعمال|حساب)/.test(description)) {
        description = descMatch[0].trim();
      }
    } else {
      description = ('سند صرف ' + (payeeName ? 'إلى ' + payeeName : '') + (siteRef ? ' - ' + siteRef : '')).trim();
    }

    // 5. استخراج طريقة الدفع
    let paymentMethod = 'نقدي';
    if (/(?:تحويل\s*بنكي|تحويل|بنكي|عبر\s*البنك|أهلي|راجحي|حساب\s*بنكي)/i.test(t)) {
      paymentMethod = 'تحويل بنكي';
    } else if (/(?:شيك|شيكات)/i.test(t)) {
      paymentMethod = 'شيك';
    } else if (/(?:شبكة|مدى|بطاقة|فيزا)/i.test(t)) {
      paymentMethod = 'شبكة';
    }

    if (amount && Number.isFinite(amount) && amount > 0) {
      return {
        name: 'add_payment_voucher_draft',
        args: {
          payee_name: payeeName || 'مستفيد غير محدد',
          amount,
          payment_method: paymentMethod,
          ...(siteRef ? { site_ref: siteRef } : {}),
          ...(description ? { description } : {}),
        },
      };
    }
  }

  // 1) إضافة يومية عامل أو فني أو فني ومساعد من المحادثة
  if (
    !/(?:سند\s*(?:صرف|سداد|دفع)|إيصال\s*صرف|ايصال\s*صرف|سند\s*قبض\s*وصرف|اصرف|إصرف|سداد)/iu.test(t) &&
    /(?:ضيفيلي|ضفيلي|ضيفي|ضيفلي|ضيف|اضف|أضف|سجليلي|سجلي|سجل|سجّل|اعمليلي|اعملي|اعمل|انشئ|أنشئ).*(?:يوميه|يومية|فني|عامل)/iu.test(t)
  ) {
    const boundary = '(?=\\s+(?:و?العامل|و?عامل|و?المساعد|و?مساعد|و?الفيلا|و?فيلا|و?المشروع|و?مشروع|و?العماره|و?عماره|و?العمارة|و?عمارة|و?الموقع|و?موقع|و?البند|و?بند|و?امر\\s*شغل|و?أمر\\s*شغل|و?امر|و?أمر|و?انتاجيته|و?إنتاجيته|و?انتاجية|و?إنتاجية|و?انتاج|و?إنتاج|و?عمل|و?طريحه|و?طريحة|و?يوميه|و?يومية|و?اجر|و?أجر|و?ملاحظات|و?ملاحظة|و?ملاحظه|و?بيان|\\d)|$)';

    const techMatch = t.match(new RegExp(`(?:للفني|فني)\\s*(?:واسمه|اسمه)?\\s+([\\p{L}\\s]{2,30}?)${boundary}`, 'u'));
    const helperMatch = t.match(new RegExp(`(?:و?العامل|و?عامل|و?المساعد|و?مساعد)\\s*(?:واسمه|اسمه)?\\s+([\\p{L}\\s]{2,30}?)${boundary}`, 'u'));

    let workerName = techMatch?.[1]?.trim();
    let helperName = helperMatch?.[1]?.trim();

    if (!workerName && helperName) {
      if (!/(?:فني|صنايعي)/u.test(t)) {
        workerName = helperName;
        helperName = undefined;
      }
    }

    if (!workerName) {
      const singleMatch = t.match(new RegExp(`(?:يوميه|يومية)\\s*(?:عامل\\s+)?([\\p{L}\\s]{2,30}?)${boundary}`, 'u'));
      workerName = singleMatch?.[1]?.trim();
    }

    const itemMatch = t.match(new RegExp(`(?:و?البند|و?بند)\\s+([\\p{L}\\s]{2,40}?)${boundary}`, 'u'));
    const siteMatch = t.match(/(?:و?الفيلا|و?فيلا|و?المشروع|و?مشروع|و?العماره|و?عماره|و?العمارة|و?عمارة|و?الموقع|و?موقع)s*([p{L}p{N}_-]+)/u);
    const prodMatch = t.match(/(?:و?انتاجيته|و?إنتاجيته|و?انتاجية|و?إنتاجية|و?انتاج|و?إنتاج|و?عمل|و?منفذ|و?انجز|و?أنجز)s*(?:كذاs*)?(d+(?:.d+)?)/u);
    const tareehaMatch = t.match(/(?:و?طريحه|و?طريحة)s*(?:كذاs*)?(d+(?:.d+)?)/u);
    const wageMatches = [...t.matchAll(/(?:و?يوميه|و?يومية|و?اجر|و?أجر|بـ)s*(?:كذاs*)?(d+(?:.d+)?)/gu)];
    const joMatch = t.match(/(?:و?امرs*شغل|و?أمرs*شغل|و?امر|و?أمر)s*(?:رقمs*)?#?([a-zA-Z0-9_-]+)/u);
    const notesMatch = t.match(/(?:و?ملاحظات|و?ملاحظة|و?ملاحظه|و?بيان)s+([p{L}p{N}s]{2,100})/u);

    const dailyWage = wageMatches.length > 0 ? Number(wageMatches[0][1]) : undefined;
    const helperWage = wageMatches.length > 1 ? Number(wageMatches[1][1]) : undefined;

    if (workerName) {
      return {
        name: 'add_labor_daily_log_draft',
        args: {
          worker_name: workerName,
          ...(helperName ? { helper_name: helperName } : {}),
          ...(techMatch ? { skill_level: 'فني' } : {}),
          ...(itemMatch?.[1]?.trim() ? { work_item: itemMatch[1].trim() } : {}),
          ...(siteMatch ? { site_ref: siteMatch[0].trim() } : {}),
          ...(prodMatch ? { productivity: Number(prodMatch[1]) } : {}),
          ...(tareehaMatch ? { tareeha: Number(tareehaMatch[1]) } : {}),
          ...(dailyWage ? { daily_wage: dailyWage } : {}),
          ...(helperWage ? { helper_wage: helperWage } : {}),
          ...(joMatch ? { job_order: joMatch[1].trim() } : {}),
          ...(notesMatch ? { notes: notesMatch[1].trim() } : {}),
          work_date: 'today',
        },
      };
    }
  }

  // 2) إضافة أو تسجيل مصروف أو فاتورة من المحادثة بحساسية ودقة فائقة (شاشة المصروفات /expenses)
  const isLaborDirective = /(?:دخله(?:الي)?\s*في\s*العمال[ةه]|في\s*العمال[ةه]|للعمال[ةه])/iu.test(t);
  const isExplicitExpense =
    !isLaborDirective &&
    !isPaymentVoucherTrigger &&
    !/(?:سند\s*(?:صرف|سداد|دفع)|إيصال\s*صرف|ايصال\s*صرف|سند\s*قبض\s*وصرف|اصرف|إصرف)/iu.test(t) &&
    (/(?:فاتورة|فاتوره|فواتير|مصروف|مصاريف|اشترينا|شراء|توريد|خامات|مواد\s*بناء)/iu.test(t) ||
     (/(?:ضيفيلي|ضفيلي|ضيفي|ضيفلي|ضيف|اضف|أضف|سجليلي|سجلي|سجللي|سجل|سجّل|تسجيل|إضافة|اضافة)\s*(?:لي)?\s*(?:فاتورة|فاتوره|مصروف|مصاريف)/iu.test(t))) &&
    /\d+/.test(t) &&
    !/(?:ازاي|إزاي|كيف|وريني|استعلام|(?:^|\s)(?:عرض|هات|كشف|تقرير|كم|كام)(?:\s|$))/i.test(t);

  if (isExplicitExpense) {
    // 1. استخراج الفيلا أو المشروع (اختياري)
    let siteRef = null;
    const siteMatch = t.match(/(?:فيلا|مشروع|عماره|عمارة|موقع|برج)\s*([\p{L}\p{N}_-]+)/u);
    if (siteMatch) {
      siteRef = siteMatch[0].trim();
    }

    // 2. استخراج بند الأعمال (اختياري لربط أمر الشغل)
    let workItem = null;
    const itemMatch = t.match(/(?:بند|أعمال|اعمال)\s+([\p{L}\p{N}_\s]{2,40}?)(?=\s+(?:فيلا|مشروع|عماره|عمارة|موقع|برج|كمية|كميه|عدد|بمبلغ|بـ|بسعر|ريال|ر\.س|شامل|ضريبة|ضريبه)|\s*$)/u);
    if (itemMatch) {
      workItem = itemMatch[1].trim();
    }

    // 3. استخراج الضريبة (افتراضياً 0 - غير شامل الضريبة)
    let vatAmount = 0;
    const vatMatch = t.match(/(?:ضريبة|ضريبه|vat)\s*(\d+(?:\.\d+)?)/i);
    if (vatMatch) {
      vatAmount = Number(vatMatch[1]);
    }

    // 4. استخراج الكمية (افتراضياً 1 إذا لم تُذكر)
    let quantity = 1;
    const qtyExplicitMatch = t.match(/(?:كمية|كميه|عدد)\s*(\d+(?:\.\d+)?)/i);
    const qtyUnitMatch = t.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:طن|شكارة|شكاير|شيكارة|شوال|نقلة|نقلات|رد|ردود|متر|أمتار|حبة|حبات|كرتونة|كراتين|لتر|لترات|برميل|براميل|لوح|ألواح)(?:\s|$)/i);
    if (qtyExplicitMatch) {
      quantity = Number(qtyExplicitMatch[1]);
    } else if (qtyUnitMatch) {
      quantity = Number(qtyUnitMatch[1]);
    }

    // 5. استخراج المبلغ الإجمالي بدقة
    let totalPrice = null;
    const priceExplicitMatch = t.match(/(?:بمبلغ|بـ|ب\s*|سعر|بقيمة|إجمالي|اجمالي)\s*(\d+(?:\.\d+)?)/i);
    const priceCurrencyMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:ريال|ر\.س|جنية|جنيه|درهم)/i);

    if (priceExplicitMatch) {
      totalPrice = Number(priceExplicitMatch[1]);
    } else if (priceCurrencyMatch) {
      totalPrice = Number(priceCurrencyMatch[1]);
    } else {
      const numbers = [...t.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => Number(m[1]));
      const siteNum = siteRef ? Number(siteRef.replace(/\D/g, '')) : null;
      const filtered = numbers.filter(n => n !== quantity && n !== siteNum && n !== vatAmount);
      if (filtered.length > 0) {
        totalPrice = filtered[filtered.length - 1];
      }
    }

    if (totalPrice && totalPrice > 0) {
      // 6. تنظيف البيان بدقة واستخراج اسم المادة
      let desc = t
        .replace(/(?:يا\s*(?:قلبي|روحي|حبيبتي|موزه|موزة|سلمى|قمر))\s*$/iu, '')
        .replace(/^.*?(?:ضيفيلي|ضفيلي|ضيفي|ضيفلي|ضيف|اضف|أضف|سجليلي|سجلي|سجل|سجّل|تسجيل|إضافة|اضافة|فاتورة|فاتوره|مصروف|مصاريف|صرفنا|اشترينا|دفعنا)\s*(?:لي)?\s*(?:مصروف|فاتورة|فاتوره)?/u, '');

      if (siteRef) desc = desc.replace(new RegExp(`(?:في|بـ|لـ|على)?\\s*${siteRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gu'), ' ');
      if (workItem) desc = desc.replace(new RegExp(`(?:بند|أعمال|اعمال)?\\s*${workItem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gu'), ' ');
      desc = desc.replace(/(?:بند|أعمال|اعمال)\s+[\p{L}\p{N}_\s-]+?(?=(?:فيلا|مشروع|عماره|عمارة|موقع|برج|كمية|كميه|عدد|بمبلغ|بـ|بسعر|ريال|ر\.س|شامل|ضريبة|ضريبه|$))/gu, ' ');
      desc = desc.replace(/(?:غير\s*شامل|شامل\s*غير|شامل\s*)?(?:ضريبة|ضريبه|vat)\s*(?:\d+(?:\.\d+)?)?/gi, ' ');
      desc = desc.replace(/(?:بمبلغ|بسعر|بقيمة|إجمالي|اجمالي|بـ|ب)\s*\d+(?:\.\d+)?/gi, ' ');
      desc = desc.replace(/\d+(?:\.\d+)?\s*(?:ريال|ر\.س|جنية|جنيه|درهم)/gi, ' ');
      if (totalPrice) desc = desc.replace(new RegExp(`\\b${totalPrice}\\b`, 'g'), ' ');
      desc = desc.replace(/(?:كمية|كميه|عدد)\s*\d+(?:\.\d+)?/gi, ' ');
      desc = desc.replace(/(?:^|\s)(?:ريال|ر\.س|جنية|جنيه|درهم)(?:\s|$)/gi, ' ');
      desc = desc.replace(/(?:^|\s)(?:بمبلغ|بسعر|بقيمة|بند|فيلا|مشروع|عماره|عمارة|موقع|برج)(?:\s|$)/gu, ' ');
      desc = desc.replace(/^\s*(?:لـ|في|على|بـ|من|ل)\s+/u, '').replace(/\s+(?:لـ|في|على|بـ|من|ل)\s*$/u, '');
      desc = desc.replace(/\s+/g, ' ').trim();

      if (!desc || desc.length < 2) {
        desc = workItem ? `مصروف بند ${workItem}` : 'مصروف موقع';
      }

      // كشف ما إذا كان المصروف مسدد فورياً كاش (صرفه ودفع تمنه كاش)
      let paymentMethod = 'آجل';
      let isPaid = false;
      if (/(?:كاش|نقدا|نقداً|دفعنا\s*تمنه|صرفنا\s*تمنه|دفعنا\s*كاش|سددنا\s*كاش)/iu.test(t)) {
        paymentMethod = 'كاش';
        isPaid = true;
      }

      return {
        name: 'add_expense_draft',
        args: {
          description: desc.slice(0, 140),
          total_price: totalPrice,
          quantity,
          vat_amount: vatAmount,
          payment_method: paymentMethod,
          is_paid: isPaid,
          ...(siteRef ? { site_ref: siteRef } : {}),
          ...(workItem ? { work_item: workItem } : {}),
          exp_date: 'today',
        },
      };
    }
  }

  // 2.5) إضافة شريك / مقاول / مورد / عميل / عامل جديد من المحادثة
  if (
    /(?:ضيفيلي|ضفيلي|ضيفي|ضيفلي|ضيف|اضف|أضف|سجليلي|سجلي|سجل|سجّل|اعمليلي|اعملي|اعمل|انشئ|أنشئ|تسجيل|إضافة|اضافة)\s*(?:لي)?\s*(?:بارتنر|شريك|مقاول|مورد|عميل|عامل|صنايعي|فني|موظف)/i.test(t) ||
    (quotedMessageText && /اخترت نوع|اسم الشريك|شريك جديد|بارتنر جديد/i.test(quotedMessageText) && /(?:اسمه|اسم)/i.test(t))
  ) {
    if (!/ازاي|إزاي|كيف|عرض|هات|وريني|اسماء|كل\s*الشركاء|كشف|حساب/i.test(t)) {
      const nameMatch =
        t.match(/(?:اسمه|اسم)\s+([\p{L}\s]{2,40}?)(?=\s+و?(?:نوعه|تليفون|تلفون|موبايل|جوال|رقم|رقمه|مهنته|وظيفته|كود|كوده|شغال|بمهنة|فيلا|موقع)|$)/u) ||
        t.match(/(?:بارتنر|شريك|مقاول|مورد|عميل|عامل|صنايعي|موظف)\s+(?:جديد\s+)?([\p{L}\s]{2,40}?)(?=\s+و?(?:نوعه|تليفون|تلفون|موبايل|جوال|رقم|رقمه|مهنته|وظيفته|كود|كوده|شغال)|$)/u);

      const rawName = nameMatch?.[1]
        ? nameMatch[1]
            .replace(/^(?:جديد\s+)?(?:اسمه|اسم)\s+/u, '')
            .replace(/^(?:جديد|باطن|خامات|يومية|يوميه)\s+/u, '')
            .replace(/^(?:اسمه|اسم)\s+/u, '')
            .trim()
        : null;

      if (rawName && rawName.length >= 2 && !/^(?:بارتنر|شريك|مقاول|مورد|عميل|عامل|موظف|جديد)$/i.test(rawName)) {
        let pType = null;
        const typeExplicitMatch = t.match(/نوعه\s+([\p{L}\s]{2,30}?)(?=\s+و?(?:اسمه|تليفون|تلفون|رقم|رقمه|مهنته|وظيفته|كود)|$)/u);
        if (typeExplicitMatch) {
          pType = typeExplicitMatch[1].trim();
        } else if (/مقاول/i.test(t) || (quotedMessageText && /مقاول/i.test(quotedMessageText))) {
          pType = 'مقاول';
        } else if (/مورد|خامات/i.test(t) || (quotedMessageText && /مورد/i.test(quotedMessageText))) {
          pType = 'مورد';
        } else if (/عميل|مالك/i.test(t) || (quotedMessageText && /عميل/i.test(quotedMessageText))) {
          pType = 'عميل';
        } else if (/موظف/i.test(t) || (quotedMessageText && /موظف/i.test(quotedMessageText))) {
          pType = 'موظف';
        } else if (/عامل|صنايعي|فني|يومية|يوميه/i.test(t) || (quotedMessageText && /عامل/i.test(quotedMessageText))) {
          pType = 'عامل يومية';
        }

        const phoneMatch =
          t.match(/(?:و?(?:تليفون|تلفون|موبايل|جوال|رقم|رقمه))\s*[:=]?\s*([+\d\s-]{8,15})/i) ||
          t.match(/\b(05\d{8}|01\d{9}|\+?\d{9,14})\b/);
        const phone = phoneMatch ? (phoneMatch[1] || phoneMatch[0]).replace(/\s+/g, '') : undefined;

        const roleMatch =
          t.match(/(?:و?(?:مهنته|وظيفته|شغال|تخصصه|صناعته|بمهنة))\s+([\p{L}\s]{2,30}?)(?=\s+و?(?:نوعه|تليفون|تلفون|رقم|رقمه|كود)|$)/u) ||
          t.match(/\b(حداد مسلح|حداد|نجار مسلح|نجار|مبيض محارة|محار|سباك|كهربائي|دهان|نقاش|بناء|مليس|مبلط|سيراميك|عامل عادي|فورمان|مهندس موقع)\b/u);
        const jobRole = roleMatch ? (roleMatch[1] || roleMatch[0]).trim() : undefined;

        const codeMatch = t.match(/(?:و?(?:كوده|كود))\s*([A-Za-z0-9_-]{2,20})/i);
        const code = codeMatch ? codeMatch[1].trim() : undefined;

        const wageMatch = t.match(/(?:و?(?:يوميه|يومية|يوميته|أجره|اجره|أجر|اجر|راتب|راتبه|متفق\s*عليها|بسعر|بـ|ب))\s*[:=]?\s*(\d+(?:\.\d+)?)/u);
        const dailyWage = wageMatch ? Number(wageMatch[1]) : undefined;

        return {
          name: 'add_partner',
          args: {
            name: rawName,
            ...(pType ? { partner_type: pType } : {}),
            ...(phone ? { phone } : {}),
            ...(jobRole ? { job_role: jobRole } : {}),
            ...(dailyWage ? { daily_wage: dailyWage } : {}),
            ...(code ? { code } : {}),
          },
        };
      }
    }
  }

  // 2.7) إضافة أمر شغل جديد لمقاول من المحادثة
  if (
    /(?:امر\s*شغل|أمر\s*شغل|امر\s*تشغيل|أمر\s*تشغيل)/iu.test(t) &&
    /(?:اعمل|أنشئ|انشئ|سجل|سجّل|ضيف|أضف|اضف|فتح|اصدار|إصدار)/iu.test(t) &&
    !/(?:ازاي|كيف|وريني|استعلام|تقرير)/iu.test(t)
  ) {
    let siteRef = null;
    const siteMatch = t.match(/(?:و?الفيلا|و?فيلا|و?المشروع|و?مشروع|و?العماره|و?عماره|و?العمارة|و?عمارة|و?الموقع|و?موقع)\s*([\p{L}\p{N}_-]+)/u);
    if (siteMatch) siteRef = siteMatch[0].trim();

    let workItem = null;
    const itemMatch = t.match(/(?:بند|أعمال|اعمال|شغل)?\s*(محارة|لياسة|نجارة|حدادة|مباني|دهانات|سيراميك|عزل|سباكة|كهرباء|خرسانة|تشطيبات)/iu);
    if (itemMatch) workItem = itemMatch[1].trim();

    let assignedQty = 1;
    const qtyMatch = t.match(/(?:كمية|كميه|مساحة|مساحه|قدرها|عدد)?\s*(\d+(?:\.\d+)?)\s*(?:متر|م2|م|طن|حبة|حبات)?(?=\s+(?:بسعر|فئة|فئه|ريال|ر\.س|لمقاول|لـ)|$)/iu);
    if (qtyMatch) assignedQty = Number(qtyMatch[1]);

    let unitPrice = 0;
    const priceMatch = t.match(/(?:بسعر|فئة|فئه|سعر|بـ|ب)\s*(\d+(?:\.\d+)?)/iu);
    if (priceMatch) unitPrice = Number(priceMatch[1]);

    let contractorName = null;
    const contMatch = t.match(/(?:لمقاول|للمقاول|مقاول|لـ|مع)\s+([\p{L}\s]{2,30}?)(?=\s+(?:كمية|كميه|بسعر|فئة|فئه|فيلا|مشروع|\d)|$)/u);
    if (contMatch) contractorName = contMatch[1].replace(/^(?:المقاول|مقاول)\s+/u, '').trim();

    if (contractorName || workItem) {
      return {
        name: 'add_job_order_draft',
        args: {
          contractor_name: contractorName || 'مقاول غير محدد',
          work_item: workItem || 'أعمال مقاولات',
          assigned_qty: assignedQty,
          unit_price: unitPrice,
          ...(siteRef ? { site_ref: siteRef } : {}),
          executor_type: 'مقاول باطن',
        },
      };
    }
  }

  // 2.8) إضافة قيد محاسبي أو قيد يومية من المحادثة
  if (
    /(?:قيد\s*(?:يومية|يوميه|محاسبي|تسوية)?|سجل\s*قيد|اعمل\s*قيد|أضف\s*قيد|اضف\s*قيد)/iu.test(t) &&
    /\d+/.test(t) &&
    !/(?:ازاي|كيف|وريني|استعلام|تقرير|كشف)/iu.test(t)
  ) {
    let amount = undefined;
    const amtMatch = t.match(/(?:بمبلغ|مبلغ|بقيمة|قيمة|قيمه|بـ|ب)\s*(\d+(?:\.\d+)?)/iu) ||
      t.match(/(\d+(?:\.\d+)?)\s*(?:ريال|ر\.س|جنيه)/iu) ||
      t.match(/\b(\d{3,7}(?:\.\d+)?)\b/);
    if (amtMatch) amount = Number(amtMatch[1]);

    let debitAccount = null;
    let creditAccount = null;

    // نمط: من [حساب دائن أو مدين] إلى [حساب مدين]
    const fromToMatch = t.match(/من\s+([\p{L}\s]{2,30}?)\s+(?:إلى|الى|لـ|ل)\s+([\p{L}\s]{2,30}?)(?=\s+(?:بمبلغ|مبلغ|بقيمة|\d)|$)/u);
    if (fromToMatch) {
      creditAccount = fromToMatch[1].trim();
      debitAccount = fromToMatch[2].trim();
    } else {
      const singleFrom = t.match(/من\s+([\p{L}\s]{2,30}?)(?=\s+(?:إلى|الى|لـ|ل|بمبلغ|مبلغ|\d)|$)/u);
      const singleTo = t.match(/(?:إلى|الى|لـ|ل)\s+([\p{L}\s]{2,30}?)(?=\s+(?:من|بمبلغ|مبلغ|\d)|$)/u);
      if (singleFrom) creditAccount = singleFrom[1].trim();
      if (singleTo) debitAccount = singleTo[1].trim();
    }

    let siteRef = null;
    const siteMatch = t.match(/(?:و?الفيلا|و?فيلا|و?المشروع|و?مشروع|و?الموقع|و?موقع)\s*([\p{L}\p{N}_-]+)/u);
    if (siteMatch) siteRef = siteMatch[0].trim();

    let desc = t.replace(/(?:ضيفيلي|ضيفلي|ضيف|اضف|أضف|سجل|سجّل|اعمل)\s*(?:قيد|مسودة)?/iu, '').trim();

    if (amount && Number.isFinite(amount) && amount > 0) {
      return {
        name: 'add_journal_entry_draft',
        args: {
          description: desc.slice(0, 140) || 'قيد محاسبي جديد',
          amount,
          ...(debitAccount ? { debit_account: debitAccount } : {}),
          ...(creditAccount ? { credit_account: creditAccount } : {}),
          ...(siteRef ? { site_ref: siteRef } : {}),
          entry_date: 'today',
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
  const pet = s.mozzaNickname || 'يا يسور';

  // إذا كانت الرسالة تحتوي على أي أمر شغل أو حسابات (تقرير، مصروف، قيد، سند صرف، يومية، أمر شغل، تعديل عملية، فلل، عمالة)، اتركها تمر لأدوات الشغل فوراً!
  const hasWorkIntent =
    Boolean(detectDirectFieldOpsCall(t, q)) ||
    /(?:تقرير|مصروف|سند|سداد|دفعة|دفعه|يوميه|يومية|قيد|امر\s*شغل|أمر\s*شغل|العمليه|العملية|الفلل|المشاريع|العماله|العمالة|الشركاء|طريحه|طريحة|فحص|استلام|مستخلص)/i.test(t);

  // 0) تفعيل أو إيقاف «وضع الموزة» مباشرة من المحادثة أو الصوت
  if (/^(?:(?:شغل|شغّل|افتح|فعّل|فعل|عاوز|عايز|هات)\s*)?(?:وضع\s*)?(?:الموزه|الموزة)$|^\/mozza(?:\s+on)?$/i.test(t)) {
    saveBotSettings({ mozzaModeEnabled: true });
    return `💖 فتحتلك «وضع الموزة» خلاص يا روحي! كدا نقدر ندردش براحتنا وأدلعك وسط الشغل زي ما تحب يا قلبي 😘`;
  }
  if (/(?:اقفل|إقفل|اطفي|إطفي|وقف|وقّف|الغي|إلغي)\s*(?:وضع\s*)?(?:الموزه|الموزة)|^\/mozza\s+off$/i.test(t)) {
    saveBotSettings({ mozzaModeEnabled: false });
    return `💼 تمام يا باشمهندس، قفلت «وضع الموزة» ورجعنا للوضع الرسمي الاحترافي. تحت أمرك في أي حسابات أو تقارير موقع!`;
  }

  // 0.0) التحكم في الرسائل الصوتية بالكامل (إغلاق / تشغيل)
  const disableVoicePrefix = /(?:اقفل|إقفل|اقفلي|قفل|اطفي|إطفي|اطفيلي|طفي|وقف|وقّف|وقفلي|ايقاف|إيقاف|اوقف|أوقف|الغي|إلغي|الغيلي|الغاء|إلغاء|عطل|تعطيل|عطلي|اغلق|إغلق|اغلاق|إغلاق|كتم|اسكت|اسكتي|بلاش|من\s*غير|بدون|كفاية|مش\s*عايز|مش\s*عاوز|مش\s*حابب|ماتبعتش|ما\s*تبعتش|بلاش\s*تبعت|لا\s*ترسل|ما\s*ترسل|مافيش\s*داعي)/;
  const enableVoicePrefix = /(?:شغل|شغّل|تشغيل|افتح|إفتح|فتح|فعّل|فعل|تفعيل|رجع|رجّع|ترجيع|استرجع|رد\s*بـ?|ردي\s*بـ?|عاوز\s*(?:اسمع)?|عايز\s*(?:اسمع)?|ابعت|ابعتلي|اسمع|هات|خليه|خليه\s*صوت|خليك)/;
  const voiceNouns = /(?:الرد\s*الصوتي|الردود\s*الصوتيه|الردود\s*الصوتية|الرد\s*صوتي|رد\s*صوتي|ردود\s*صوتيه|ردود\s*صوتية|الرسائل\s*الصوتيه|الرسائل\s*الصوتية|الرسائل\s*الصوت|الرساله\s*الصوتيه|الرسالة\s*الصوتية|رسائل\s*صوتيه|رسائل\s*صوتية|رسالة\s*صوتية|رساله\s*صوتيه|الفويس|الفويسات|فويسات|فويس|صوتيات|الصوت|صوت)/;

  const isDisableVoiceCommand =
    /^\/(?:voice\s*(?:off|disable|stop|mute|0)|voice_off|mute|silent|silence)$/i.test(t) ||
    /^(?:صامت|وضع\s*صامت|ميوت|كتم|كتم\s*الصوت|نص\s*بس|كتابة\s*بس|كتابه\s*بس|شات\s*بس|نص\s*فقط|كتابة\s*فقط|كتابه\s*فقط|بدون\s*صوت|من\s*غير\s*صوت|بلاش\s*صوت|بلاش\s*فويس)$/i.test(t) ||
    new RegExp(`(?:${disableVoicePrefix.source})(?:\\s+[\\w\\u0600-\\u06FF]+){0,3}\\s*(?:${voiceNouns.source})`, 'i').test(t) ||
    /(?:كتابة|كتابه|نص|شات)\s*(?:بس|فقط|مش\s*صوت|من\s*غير\s*صوت|بدون\s*صوت)/i.test(t);

  if (isDisableVoiceCommand) {
    saveBotSettings({ voiceReplyMode: 'off' });
    const replyText = isMozza
      ? `🔇 من عيوني يا ${pet}! قفلتلك كل الرسائل الصوتية خالص، وهرد عليك كتابة بس من غير أي فويس يا قلبي 😘`
      : `🔇 تم إغلاق الرسائل والردود الصوتية بالكامل يا باشمهندس. سأرد عليك بالنصوص والتقارير المكتوبة فقط دون أي بصمات صوتية.`;
    return {
      text: replyText,
      replyMarkup: {
        inline_keyboard: [[{ text: '🔊 إعادة تشغيل الرسائل الصوتية', callback_data: 'set_voice_messages:on' }]],
      },
    };
  }

  const isEnableVoiceCommand =
    /^\/(?:voice\s*(?:on|enable|start|unmute|1)|voice_on|unmute)$/i.test(t) ||
    new RegExp(`(?:${enableVoicePrefix.source})(?:\\s+[\\w\\u0600-\\u06FF]+){0,3}\\s*(?:${voiceNouns.source})`, 'i').test(t);

  if (isEnableVoiceCommand) {
    saveBotSettings({ voiceReplyMode: 'always' });
    const replyText = isMozza
      ? `🔊 شغلتلك الرسائل الصوتية يا ${pet}! هسمّعك صوتي مع كل رد وتقرير من هنا ورايح يا حبيبي 🥰`
      : `🔊 تم تفعيل الرسائل الصوتية بنجاح يا باشمهندس. ستصلك البصمات الصوتية مع الردود والتقارير.`;
    return {
      text: replyText,
      replyMarkup: {
        inline_keyboard: [[{ text: '🔇 إغلاق الرسائل الصوتية', callback_data: 'set_voice_messages:off' }]],
      },
    };
  }

  // 0.1) التحكم في صوت الطوارئ (Edge TTS) مباشرة من المحادثة
  if (/(?:اقفل|إقفل|اطفي|إطفي|وقف|وقّف|الغي|إلغي|عطل|تعطيل|قفل)\s*(?:صوت\s*)?(?:الطوارئ|طوارئ|البديل)|^\/emergency_voice\s+(?:off|disable|stop)$/i.test(t)) {
    saveBotSettings({ emergencyVoiceEnabled: false, onlyGeminiVoice: true });
    const replyText = isMozza
      ? `🛑 قفلتلك صوت الطوارئ يا ${pet}! مش هيشتغل غير صوت Gemini الناعم بس، ولو كوتة جيميني خلصت الرد هينزل كتابة ومش هيطلع أي صوت طوارئ أبداً 😘`
      : `🛑 تم إيقاف صوت الطوارئ (Edge TTS) بنجاح يا باشمهندس. الردود الصوتية ستعتمد حصرياً على Gemini، وفي حال نفاد الكوتة اليومية سيصلك الرد نصياً فقط دون صوت طوارئ.`;
    return {
      text: replyText,
      replyMarkup: {
        inline_keyboard: [[{ text: '✅ إعادة تشغيل صوت الطوارئ', callback_data: 'set_emergency_voice:on' }]],
      },
    };
  }

  if (/(?:شغل|شغّل|افتح|فعّل|فعل|تشغيل|تفعيل)\s*(?:صوت\s*)?(?:الطوارئ|طوارئ|البديل)|^\/emergency_voice\s+(?:on|enable|start)$/i.test(t)) {
    saveBotSettings({ emergencyVoiceEnabled: true, onlyGeminiVoice: false });
    const replyText = isMozza
      ? `✅ شغلتلك صوت الطوارئ يا ${pet}! الأساسي دايماً هيكون صوت Gemini، وصوت الطوارئ هيدخل كبديل أوتوماتيك بس لو كوتة جيميني خلصت عشان ما أسكتش أبداً 🥰`
      : `✅ تم تفعيل صوت الطوارئ (Edge TTS) بنجاح يا باشمهندس. صوت Gemini هو الأساسي دائماً، وصوت الطوارئ سيعمل كاحتياطي تلقائي عند نفاد الكوتة فقط.`;
    return {
      text: replyText,
      replyMarkup: {
        inline_keyboard: [[{ text: '🛑 إيقاف صوت الطوارئ', callback_data: 'set_emergency_voice:off' }]],
      },
    };
  }

  // 0.2) عرض لوحة الإعدادات التفاعلية مباشرة في الشات
  if (/^(?:\/settings|\/config|الإعدادات|الاعدادات|إعدادات|اعدادات|ضبط\s*البوت|اعدادات\s*البوت)$/i.test(t)) {
    return buildSettingsMessageAndMarkup(s);
  }

  // الرد على ملاحظات الصوت (مثل: صوتك ناشف / ليه صوتك ناشف)
  if (/(?:صوتك\s*(?:ناشف|وحش|غريب|مش مضبوط|مش مظبوط|مش تمام)|مال\s*صوتك|ليه\s*صوتك\s*ناشف)/i.test(t) && !hasWorkIntent) {
    return `حقك عليا أنا يا ${pet}! 💖 ده أنا ما أقدرش على زعلك ولا على الصوت الناشف ده أبداً.. ظبطتلك الصوت المصري الناعم أهو يا روحي وفي قمة الروقان والدلع، قولي إيه رأيك دلوقتي؟ 😘`;
  }

  // تغيير اسم الدلع مباشرة من المحادثة (مثل: قوليلي يا يسور / ناديني يا محاميحو)
  const nickMatch = t.match(/^(?:قوليلي|ناديني|دلعيني|سميني)(?:\s+يا|\s+بـ|\s+ب)?\s*([^\n.!؟]+)$/i);
  if (nickMatch && !hasWorkIntent) {
    const rawNick = nickMatch[1].trim();
    const newNick = rawNick.startsWith('يا ') ? rawNick : `يا ${rawNick}`;
    saveBotSettings({ mozzaNickname: newNick, mozzaModeEnabled: true });
    return `من عيوني الاتنين يا روحي! 💖 من هنا ورايح مش هناديك غير بـ «${newNick}» يا سكر قلبي 😘`;
  }

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

  // 0.3) طلب إضافة شريك جديد بدون تفاصيل (توجيه تفاعلي فوري مع أزرار اختيار نوع الشريك)
  if (
    /^(?:(?:ضيف|ضفي|سجل|سجّل|اضافة|إضافة|اضف|أضف|اعمل|عايز\s*اضيف|عاوز\s*اضيف|محتاج\s*اضيف)\s*(?:لي)?\s*(?:بارتنر|شريك|شريك\s*جديد|بارتنر\s*جديد|مقاول|مورد|عميل|عامل))$/i.test(t) ||
    /^(?:بارتنر\s*جديد|شريك\s*جديد|اضافة\s*بارتنر|اضافة\s*شريك)$/i.test(t)
  ) {
    const intro = isMozza
      ? `💖 من عيوني يا روحي ${pet}! تحب تسجل شريك من أي نوع؟\nاختار من الأزرار تحت، أو اكتبلي بياناته مباشرة، مثلاً:\n«ضيف مقاول جديد اسمه شركة النور وتليفونه 0501234567»\n«سجل مورد خامات اسمه مصنع اليمامة»\n«ضيف عامل يومية جديد اسمه حسين الحداد مهنته حداد مسلح»`
      : `👷 من عيوني يا باشمهندس! تحب تسجل شريك من أي نوع؟\nاختر نوع الشريك من الأزرار أدناه، أو اكتب بياناته مباشرة في رسالة:\n• «ضيف مقاول باطن جديد اسمه شركة النور وتليفونه 0501234567»\n• «سجل مورد خامات اسمه مصنع اليمامة»\n• «ضيف عامل يومية جديد اسمه حسين الحداد مهنته حداد مسلح»\n• «ضيف عميل جديد اسمه شركة الفرسان»`;

    return {
      text: intro,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '👷 عامل يومية', callback_data: 'partner_type:عامل يومية' },
            { text: '🏗️ مقاول باطن', callback_data: 'partner_type:مقاول' },
          ],
          [
            { text: '📦 مورد خامات', callback_data: 'partner_type:مورد' },
            { text: '🏢 عميل / مالك', callback_data: 'partner_type:عميل' },
          ],
          [
            { text: '👤 موظف', callback_data: 'partner_type:موظف' },
            { text: '🚜 تأجير معدات', callback_data: 'partner_type:تأجير معدات' },
          ],
        ],
      },
    };
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
    if (typeof directText === 'object') {
      return { ...directText, memory: { ...memory, modelText: directText.text } };
    }
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
    const toolRes = await runEnabledCopilotTool(call, tools, verified);
    const text = typeof toolRes === 'string' ? toolRes : (toolRes?.text || String(toolRes));
    const replyMarkup = typeof toolRes === 'object' && toolRes?.replyMarkup ? toolRes.replyMarkup : undefined;
    // التقرير اليومي بيرجع تقريرين (اليومي + الإضافات المتأخرة) يتبعتوا رسالتين ورا بعض
    if (call.name === 'get_daily_comprehensive_report') {
      const parts = splitReportParts(text);
      if (parts.length > 1) {
        return { type: 'multi_messages', messages: parts, memory: { ...memory, toolName: call.name } };
      }
    }
    return {
      text,
      ...(replyMarkup ? { replyMarkup } : {}),
      memory: { ...memory, toolName: call.name },
    };
  }

  const directCall = detectDirectFieldOpsCall(userPrompt, actor?.quotedMessageText || '');
  if (directCall) {
    if (directCall.type === 'multi_tools' && Array.isArray(directCall.calls)) {
      if (directCall.targetCompany) {
        setActiveCompany(directCall.targetCompany);
        _cachedServiceAccess = null;
        _cachedServiceCompanyId = null;
      }
      const messages = [];
      for (const call of directCall.calls) {
        const res = await executeToolCall(call);
        if (Array.isArray(res?.messages)) messages.push(...res.messages);
        else if (res?.text) messages.push(res.text);
      }
      return {
        type: 'multi_messages',
        messages: messages.length > 0 ? messages : ['تم تنفيذ كافة اليوميات بنجاح.'],
        memory: { ...memory, toolCalls: directCall.calls.map(c => c.name) }
      };
    }
    if (declarations.some(d => d.name === directCall.name)) {
      if (directCall.targetCompany) {
        setActiveCompany(directCall.targetCompany);
        _cachedServiceAccess = null;
        _cachedServiceCompanyId = null;
      }
      return executeToolCall(directCall);
    }
  }
  if (!GEMINI_API_KEY) {
    return { text: 'خدمة الرد الذكي مش مفعّلة في إعدادات البوت.' };
  }

  const botSettings = getBotSettings();
  const activeComp = getActiveCompany(botSettings);
  const systemInstructions = buildSystemInstructions({
    knowledge: loadKnowledgeBase(),
    declarations,
    referenceMissing: context.referenceMissing,
    quotedMessageText,
    date: getCopilotDate(),
    botPersona: {
      ...botSettings,
      activeCompanyName: activeComp?.name,
      activeCompanyCode: activeComp?.code,
    },
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
        if (Array.isArray(res?.messages)) messages.push(...res.messages);
        else if (res?.text) messages.push(res.text);
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

// 📇 إدارة كروت الاتصال المشتركة (Shared Contact Sessions) لإضافة الشركاء
const pendingContactSessions = new Map(); // chatId -> { fullName, phone, timestamp }

function parsePartnerDetails(text) {
  const t = String(text || '').trim();
  if (!t) return { job_role: null, daily_wage: null, partner_type: null };

  const wageMatch = t.match(/(?:يوميه|يومية|يوميته|اجره|أجره|اجر|أجر|راتب|راتبه|متفق\s*عليها|بسعر|بـ|ب)\s*(?:كذا\s*)?(\d+(?:\.\d+)?)/u) ||
                    t.match(/(\d+(?:\.\d+)?)\s*(?:ريال|ر\.س|جنية|جنيه|ج\.م)/u) ||
                    t.match(/\b(\d{2,4})\b/);
  const dailyWage = wageMatch ? Number(wageMatch[1]) : null;

  const tradePattern = '(?:(?:فني|صنايعي|معلم)\\s+)?(?:محارة|محاره|حدادة\\s*مسلحة|حدادة|حداده|نجارة\\s*مسلحة|نجارة|نجاره|سباكة|سباكه|كهرباء|نقاشة|نقاشه|دهانات|سيراميك|رخام|مباني|عزل|تكييف|ألوميتال|الوميتال|جبس|حداد\\s*مسلح|حداد|نجار\\s*مسلح|نجار|سباك|كهربائي|نقاش|دهان|مبلط|بناء|مليس|مساعد|عامل\\s*عادي|عامل|مشرف\\s*موقع|مشرف|مهندس\\s*موقع|مهندس)';
  const tradeMatch = t.match(new RegExp(tradePattern, 'u'));

  let jobRole = null;
  if (tradeMatch) {
    jobRole = tradeMatch[0].trim();
  } else {
    const roleClean = t
      .replace(/(?:مهنته|شغال|وظيفته|وظيفه|وظيفة|هو)\s*/u, '')
      .replace(/(?:و?يوميه|و?يومية|و?يوميته|و?اجره|و?أجره|و?اجر|و?أجر|و?متفق\s*عليها|و?بسعر|و?بـ|و?ب)\s*(?:كذا\s*)?\d+(?:\.\d+)?/gu, '')
      .replace(/\d+\s*(?:ريال|ر\.س|جنية|جنيه|ج\.م)/gu, '')
      .replace(/\b\d{2,4}\b/g, '')
      .trim();
    if (roleClean.length >= 2 && roleClean.length <= 40) {
      jobRole = roleClean;
    }
  }

  let partnerType = 'عامل يومية';
  if (/مهندس|مشرف|محاسب|مدير|اداري|إداري/u.test(jobRole || t)) {
    partnerType = 'موظف';
  } else if (/مقاول/u.test(jobRole || t)) {
    partnerType = 'مقاول';
  } else if (/مورد|شركة/u.test(jobRole || t)) {
    partnerType = 'مورد';
  }

  return {
    job_role: jobRole,
    daily_wage: dailyWage,
    partner_type: partnerType,
  };
}

async function handleAddPartnerFromContact(actor, fullName, phone, details, messageId) {
  const verified = await verifyTelegramAuth(actor);
  if (!verified.ok) {
    await sendTelegramMessage(actor.chatId, verified.error, messageId);
    return;
  }

  const access = await checkUserCompanyAccess(verified.user.id, verified.companyId);
  if (!access.ok) {
    await sendTelegramMessage(actor.chatId, 'لا توجد صلاحية للشركة الحالية.', messageId);
    return;
  }

  const tools = createCopilotTools({
    companyId: verified.companyId,
    authToken: verified.sessionToken,
    supabaseKey: SUPABASE_ANON_KEY,
    restBase: REST_BASE,
  });

  const addRes = await tools.add_partner({
    name: fullName,
    phone: phone,
    job_role: details.job_role || 'صنايعي',
    daily_wage: details.daily_wage || null,
    partner_type: details.partner_type || 'عامل يومية',
  });

  const s = getBotSettings();
  const activeComp = getActiveCompany(s);
  const replyText = formatAddPartnerReply(addRes, activeComp?.name || 'فاي تك');

  await sendTelegramMessage(actor.chatId, replyText, messageId, { html: false });
  if (s.voiceReplyMode === 'always') {
    await sendTelegramVoiceReply(actor.chatId, replyText, messageId, s);
  }
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

  // 📇 معالجة كارت الاتصال المشترك (Shared Contact Card) لإضافة شريك جديد
  if (msg.contact) {
    const contact = msg.contact;
    const firstName = contact.first_name || '';
    const lastName = contact.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'شريك جديد';
    let phone = String(contact.phone_number || '').trim();
    if (phone && !phone.startsWith('+') && !phone.startsWith('00')) {
      phone = '+' + phone;
    }

    const caption = String(msg.caption || '').trim();
    const parsedCaption = parsePartnerDetails(caption);

    if (parsedCaption.job_role || parsedCaption.daily_wage) {
      return await handleAddPartnerFromContact(actor, fullName, phone, parsedCaption, messageId);
    } else {
      pendingContactSessions.set(actor.chatId, {
        fullName,
        phone,
        timestamp: Date.now(),
      });

      const s = getBotSettings();
      const isMozza = Boolean(s.mozzaModeEnabled);
      const pet = s.mozzaNickname || 'يا باشمهندس';
      const promptMsg = isMozza
        ? `📥 يا روحي ${pet}، استلمت كارت الاتصال بنجاح!
` +
          `👤 الاسم: ${fullName}
` +
          `📱 الجوال: ${phone}

` +
          `قولّي بقى في رسالة أو فويس: إيه مهنته واليومية المتفق عليها كام؟
(مثال: «فني محارة ويوميته 250»)`
        : `📥 تم استلام كارت الاتصال بنجاح يا فندم!
` +
          `👤 الاسم: ${fullName}
` +
          `📱 رقم الجوال: ${phone}

` +
          `من فضلك اكتبلي أو ابعتلي فويس بمهنته واليومية المتفق عليها:
(مثال: «فني محارة ويوميته 250» أو «حداد مسلح يومية 200»)`;

      await sendTelegramMessage(chatId, promptMsg, messageId, { html: false });
      if (s.voiceReplyMode === 'always') {
        await sendTelegramVoiceReply(chatId, promptMsg, messageId, s);
      }
      return;
    }
  }

  // 🎙️ معالجة الرسائل الصوتية (Voice Notes & Audio) فورياً عبر Groq Whisper Large V3 مع بديل Gemini الصوتي
  const isVoiceUpdate = Boolean(msg.voice || msg.audio || msg.video_note);
  if (isVoiceUpdate && BOT_TOKEN) {
    const fileId = msg.voice?.file_id || msg.audio?.file_id || msg.video_note?.file_id;
    const groqKey = setting('GROQ_API_KEY');

    if (fileId && (groqKey || GEMINI_API_KEY)) {
      try {
        await sendChatAction(chatId, 'record_voice');
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`, { signal: AbortSignal.timeout(12000) });
        const fileInfo = await fileInfoRes.json();

        if (fileInfo.ok && fileInfo.result?.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
          const audioRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(15000) });
          if (!audioRes.ok) throw new Error('Telegram audio unavailable');
          const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
          console.log(`🎙️ [Voice STT] تم استلام بصمة صوتية بحجم ${audioBuffer.length} بايت، جاري المعالجة...`);

          // المحاولة الأولى: Groq Whisper Large V3
          if (groqKey) {
            try {
              const whisperForm = new FormData();
              whisperForm.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'telegram_voice.ogg');
              whisperForm.append('model', 'whisper-large-v3');
              whisperForm.append('language', 'ar');
              whisperForm.append('temperature', '0.0');
              whisperForm.append('prompt', 'فاي تك، افتحلي شركة واحد، افتحلي شركة 2، شركة 1، شركة 2، سجل مصروف، سجل قيد، يومية عامل، أمر شغل، تقرير اليوم، فيلا، طريحة، محارة، جبس، سباكة، ريال، عهدة، مقاول، PHI-TECH-EGY');

              const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${groqKey}` },
                body: whisperForm,
                signal: AbortSignal.timeout(25000),
              });

              const whisperJson = await whisperRes.json();
              if (whisperJson?.text && whisperJson.text.trim()) {
                rawText = whisperJson.text.trim();
                console.log(`🎙️ [Voice STT Groq]: "${rawText}"`);
              } else {
                console.warn('Groq Whisper response had no text:', whisperRes.status, whisperJson?.error?.message || '');
              }
            } catch (wErr) {
              console.warn('Groq Whisper attempt failed:', wErr?.message);
            }
          }

          // المحاولة الثانية الاحتياطية: تحويل إلى WAV 16kHz ثم إرسالها لـ Gemini 3.5-flash
          if (!rawText && GEMINI_API_KEY) {
            try {
              const wavBuffer = await convertAudioToWav(audioBuffer);
              if (wavBuffer) {
                const geminiAudioUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
                const geminiAudioRes = await fetch(geminiAudioUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      role: 'user',
                      parts: [
                        { text: 'فرّغ هذا التسجيل الصوتي باللغة العربية بدقة كما قيل تماماً دون أي شرح أو مقدمات إضافية:' },
                        { inlineData: { mimeType: 'audio/wav', data: wavBuffer.toString('base64') } },
                      ],
                    }],
                  }),
                  signal: AbortSignal.timeout(25000),
                });
                if (geminiAudioRes.ok) {
                  const geminiAudioJson = await geminiAudioRes.json();
                  const transcribed = geminiAudioJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                  if (transcribed) {
                    rawText = transcribed;
                    console.log(`🎙️ [Voice STT Gemini]: "${rawText}"`);
                  }
                }
              }
            } catch (gErr) {
              console.warn('Gemini Audio STT fallback failed:', gErr?.message);
            }
          }

          if (rawText) {
            const curS = getBotSettings();
            const addr = curS.mozzaModeEnabled ? (curS.mozzaNickname || 'يا يسور') : 'يا باشمهندس';
            await sendTelegramMessage(chatId, `🎙️ <i>سمعتك بتقول ${escapeTelegramText(addr)}: "${escapeTelegramText(rawText.slice(0, 600))}"</i>\n\n⏳ <i>ثواني بجهزلك الطلب...</i>`, messageId);
          }
        }
      } catch (err) {
        console.error('Telegram voice processing failed:', err?.message);
      }
    }
  }

  // 📇 التحقق هل هناك كارت اتصال معلق بانتظار تحديد المهنة واليومية؟
  if (pendingContactSessions.has(actor.chatId) && rawText) {
    const pending = pendingContactSessions.get(actor.chatId);
    const ageMs = Date.now() - pending.timestamp;

    if (ageMs <= 15 * 60 * 1000) {
      if (/^(?:كنسل|الغاء|إلغاء|\/cancel)$/i.test(rawText.trim())) {
        pendingContactSessions.delete(actor.chatId);
        await sendTelegramMessage(chatId, 'تم إلغاء إضافة الشريك.', messageId);
        return;
      }

      const parsed = parsePartnerDetails(rawText);
      if (parsed.job_role || parsed.daily_wage) {
        pendingContactSessions.delete(actor.chatId);
        return await handleAddPartnerFromContact(actor, pending.fullName, pending.phone, parsed, messageId);
      }
    } else {
      pendingContactSessions.delete(actor.chatId);
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

    // 🏢 أوامر التبديل بين الشركات (شركة 1 / شركة 2)
    const COMPANY_1_REGEX = /^(?:افتح|إفتح|شغل|شغّل|حول|حوّل|وديني|اختار|إختار|ادخل|إدخل|هات|غير|غيّر|بدل|بدّل|عايز|عاوز|روح|خلينا\s*في)\s*(?:على|إلى|الي|لي|لى)?\s*(?:(?:ال)?شرك[ةه]\s*)?(?:واحد|1|الاولى|الأولى|الاولانيه|الأولانيه|فاي\s*تك|الاساسيه|الأساسية|السعوديه|السعودية)$|^(?:(?:ال)?شرك[ةه]\s*)?(?:واحد|1|الاولى|الأولى|الاولانيه|الأولانيه|فاي\s*تك)$|^\/company\s*1$/i;
    const COMPANY_2_REGEX = /^(?:افتح|إفتح|شغل|شغّل|حول|حوّل|وديني|اختار|إختار|ادخل|إدخل|هات|غير|غيّر|بدل|بدّل|عايز|عاوز|روح|خلينا\s*في)\s*(?:على|إلى|الي|لي|لى)?\s*(?:(?:ال)?شرك[ةه]\s*)?(?:اتنين|تنين|2|التانيه|الثانيه|الثانية|التانية|مصر|egy|phi-tech-egy|awa)$|^(?:(?:ال)?شرك[ةه]\s*)?(?:اتنين|تنين|2|التانيه|الثانيه|الثانية|التانية|مصر|egy|phi-tech-egy)$|^\/company\s*2$/i;
    const LIST_COMPANIES_REGEX = /^(?:إيه|ايه|عرض|قائمة|قايمة|وريني|ماهي|ما هي)\s*الشركات$|^\/companies$|^\/company$/i;

    // فحص بادئات التبديل المباشر المضمنة في أول الرسالة
    const inlineComp2 = /^(?:في\s*)?(?:شرك[ةه]\s*(?:رقم\s*)?2|phi-tech-egy|awa)\s*[:،,-]?\s*(.+)$/is.exec(cleanText);
    const inlineComp1 = /^(?:في\s*)?(?:شرك[ةه]\s*(?:رقم\s*)?1|فاي\s*تك|السعودية)\s*[:،,-]?\s*(.+)$/is.exec(cleanText);
    if (inlineComp2) {
      setActiveCompany(2);
      _cachedServiceAccess = null;
      _cachedServiceCompanyId = null;
      cleanText = inlineComp2[1].trim();
    } else if (inlineComp1) {
      setActiveCompany(1);
      _cachedServiceAccess = null;
      _cachedServiceCompanyId = null;
      cleanText = inlineComp1[1].trim();
    }

    const isComp1 = COMPANY_1_REGEX.test(cleanText);
    const isComp2 = COMPANY_2_REGEX.test(cleanText);
    const isListComp = LIST_COMPANIES_REGEX.test(cleanText);

    if (isComp1 || isComp2 || isListComp) {
      if (isComp1 || isComp2) {
        const target = setActiveCompany(isComp1 ? 1 : 2);
        _cachedServiceAccess = null;
        _cachedServiceCompanyId = null;
        conversation.clear(actor);
        activeSessionOpened.delete(String(chatId));

        const replyText = buildCompanySwitchedText(target, getBotSettings());
        const markup = buildCompanySwitchMarkup(target.id);
        await sendTelegramMessage(chatId, replyText, messageId, {
          html: true,
          replyMarkup: markup,
        });
        return;
      }
      if (isListComp) {
        const cur = getActiveCompany();
        const msg = [
          `🏢 <b>الشركات المتاحة في النظام:</b>`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `1️⃣ <b>الشركة الأولى:</b> فاي تك للمقاولات العامة والتشطيبات الفاخرة 🇸🇦`,
          `🏷️ الكود: <code>PHI</code> ${cur.id === '72918f4d-10c3-43a0-884e-2f84f1224335' ? '← [مفعلة حالياً ✅]' : ''}`,
          ``,
          `2️⃣ <b>الشركة الثانية:</b> PHI-TECH-EGY 🇪🇬`,
          `🏷️ الكود: <code>AWA</code> ${cur.id === '8c90cb59-ffa3-4cd1-8bdc-db80a3c825b8' ? '← [مفعلة حالياً ✅]' : ''}`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 قولّي «افتحلي شركة واحد» أو «افتحلي شركة 2» للتبديل السريع في أي وقت!`,
        ].join('\n');
        await sendTelegramMessage(chatId, msg, messageId, {
          html: true,
          replyMarkup: buildCompanySwitchMarkup(cur.id),
        });
        return;
      }
    }

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
      botSettings.voiceReplyMode !== 'off' &&
      (botSettings.voiceReplyMode === 'always' ||
        (botSettings.voiceReplyMode === 'on_voice_or_request' &&
          (Boolean(msg.voice || msg.audio) || /(?:رد\s*صوت|بصوت|صوتيا|صوتياً)/i.test(cleanText))));

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
        replyMarkup: reply.replyMarkup ?? buildOperationInlineMarkup(reply.text || ''),
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

  const editMessage = async (text, replyMarkup) => {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          ...(replyMarkup && { reply_markup: replyMarkup }),
        }),
        signal: AbortSignal.timeout(6000),
      });
    } catch {}
  };

  if (data.startsWith('jo_pick:')) {
    const parts = data.split(':');
    const expenseId = parts[1];
    const jobOrderId = parts[2];
    await answerCb('جارٍ ربط المصروف بأمر الشغل...');

    const verified = await resolveLiveCompanyAccess({ chatId, userId: cb.from?.id || 0 });
    const tools = createCopilotTools({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: verified?.allowServiceRole ? SUPABASE_SERVICE_KEY : SUPABASE_PUBLIC_KEY,
      accessToken: verified?.accessToken,
      companyId: verified?.companyId,
      detailedReads: true,
      allowServiceRole: Boolean(verified?.allowServiceRole),
    });

    const linkRes = await tools.link_expense_job_order({ expense_id: expenseId, job_order_id: jobOrderId });
    if (linkRes.success) {
      await answerCb(`✅ تم ربط أمر الشغل #${linkRes.job_order_number || ''}`);
      await sendTelegramMessage(
        chatId,
        `✅ تم ربط المصروف بنجاح بأمر الشغل [#${linkRes.job_order_number || '—'}] (${linkRes.job_order_item || 'بدون بند'})\nالمقاول: ${linkRes.contractor_name || 'غير محدد'}`,
        messageId,
        { html: false }
      );
    } else {
      await answerCb('تعذر ربط أمر الشغل');
      await sendTelegramMessage(chatId, `⚠️ تعذر ربط المصروف بأمر الشغل: ${linkRes.error || 'خطأ غير متوقع'}`, messageId);
    }
    return;
  }

  if (data.startsWith('partner_type:')) {
    const selectedType = data.split(':')[1];
    await answerCb(`تم اختيار: ${selectedType}`);
    await sendTelegramMessage(
      chatId,
      `👍 تمام يا باشمهندس، اخترت نوع «${selectedType}».\nاكتب لي اسمه وتليفونه دلوقتي وسأسجله فوراً، مثلاً:\n«اسمه أحمد الشناوي وتليفونه 0501234567»`,
      messageId
    );
    return;
  }

  if (data === 'switch_company:1' || data === 'switch_company:2') {
    const target = setActiveCompany(data === 'switch_company:1' ? 1 : 2);
    _cachedServiceAccess = null;
    _cachedServiceCompanyId = null;
    const actor = { chatId, userId: cb.from?.id || 0 };
    conversation.clear(actor);
    activeSessionOpened.delete(String(chatId));

    await answerCb(`🏢 تم فتح ${target.shortName}`);
    const updated = buildSettingsMessageAndMarkup(getBotSettings());
    await editMessage(updated.text, updated.replyMarkup);

    const confirmationText = buildCompanySwitchedText(target, getBotSettings());
    await sendTelegramMessage(chatId, confirmationText, undefined, {
      html: true,
      replyMarkup: buildCompanySwitchMarkup(target.id),
    });
    return;
  }

  if (data === 'set_voice_messages:off') {
    saveBotSettings({ voiceReplyMode: 'off' });
    await answerCb('🔇 تم إغلاق الرسائل الصوتية (نص فقط)');
    const updated = buildSettingsMessageAndMarkup(getBotSettings());
    await editMessage(updated.text, updated.replyMarkup);
    return;
  }

  if (data === 'set_voice_messages:on') {
    saveBotSettings({ voiceReplyMode: 'always' });
    await answerCb('🔊 تم تشغيل الرسائل الصوتية!');
    const updated = buildSettingsMessageAndMarkup(getBotSettings());
    await editMessage(updated.text, updated.replyMarkup);
    return;
  }

  if (data === 'set_emergency_voice:off') {
    saveBotSettings({ emergencyVoiceEnabled: false, onlyGeminiVoice: true });
    await answerCb('🛑 تم إيقاف صوت الطوارئ (Gemini فقط)');
    const updated = buildSettingsMessageAndMarkup(getBotSettings());
    await editMessage(updated.text, updated.replyMarkup);
    return;
  }

  if (data === 'set_emergency_voice:on') {
    saveBotSettings({ emergencyVoiceEnabled: true, onlyGeminiVoice: false });
    await answerCb('✅ تم تشغيل صوت الطوارئ (Edge كبديل)');
    const updated = buildSettingsMessageAndMarkup(getBotSettings());
    await editMessage(updated.text, updated.replyMarkup);
    return;
  }

  if (data === 'set_mozza:off') {
    saveBotSettings({ mozzaModeEnabled: false });
    await answerCb('💼 تم إيقاف وضع الموزة والرجوع للرسمي');
    const updated = buildSettingsMessageAndMarkup(getBotSettings());
    await editMessage(updated.text, updated.replyMarkup);
    return;
  }

  if (data === 'set_mozza:on') {
    saveBotSettings({ mozzaModeEnabled: true });
    await answerCb('💖 تم تفعيل وضع الموزة!');
    const updated = buildSettingsMessageAndMarkup(getBotSettings());
    await editMessage(updated.text, updated.replyMarkup);
    return;
  }

  if (data === 'settings_refresh') {
    await answerCb('🔄 تم تحديث الإعدادات');
    const updated = buildSettingsMessageAndMarkup(getBotSettings());
    await editMessage(updated.text, updated.replyMarkup);
    return;
  }

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
        const reportParts = splitReportParts(reportText);
        await sendTelegramMessage(targetChat, header + escapeTelegramText(reportParts[0]), undefined, { html: true });
        for (const extra of reportParts.slice(1)) {
          await new Promise(r => setTimeout(r, 300));
          await sendTelegramMessage(targetChat, escapeTelegramText(extra), undefined, { html: true });
        }
        if (s.voiceReplyMode !== 'off') {
          await sendTelegramVoiceReply(targetChat, reportParts[0], undefined, s);
        }
      }
    } catch (err) {
      console.warn('Auto daily report scheduler error:', err?.message);
    }
  }, 45_000).unref();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  initKnowledgeBase();
  startDailyReportScheduler();
  runPdfMockTest().catch(err => console.error('Mock test error:', err.message));
  // Polling timeout=25s (long-poll standard). AbortSignal is 35s. // TODO: env — COPILOT_POLL_TIMEOUT_S
  pollUpdates();
}
