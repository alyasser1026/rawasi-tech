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
process.env.COPILOT_LIVE_FIELD_OPS_ENABLED ??= 'true';
process.env.COPILOT_TOOL_TAREEHA_ENABLED ??= 'true';

const BOT_TOKEN = setting('TELEGRAM_BOT_TOKEN');
const RAW_CHAT_ID = String(setting('TELEGRAM_COPILOT_CHAT_ID') ?? setting('TELEGRAM_CHAT_ID') ?? '').trim();
const CHAT_ID = normalizeTelegramChatId(RAW_CHAT_ID);
const GROUP_CHAT_ID = CHAT_ID === null && /^-[1-9]\d*$/.test(RAW_CHAT_ID) ? Number(RAW_CHAT_ID) : null;
const GEMINI_API_KEY = setting('GEMINI_API_KEY');
const SUPABASE_URL =
  setting('SUPABASE_URL') || setting('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_PUBLIC_KEY = setting('COPILOT_SUPABASE_PUBLIC_KEY') ||
  setting('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || setting('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  setting('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_KEY =
  setting('SUPABASE_SERVICE_ROLE_KEY') || setting('SUPABASE_SECRET_KEY');
const DEFAULT_COMPANY_ID =
  setting('COPILOT_COMPANY_ID') || '72918f4d-10c3-43a0-884e-2f84f1224335';
const LIVE_READS_ENABLED = setting('COPILOT_ENABLE_LIVE_READS') !== 'false';

let _cachedServiceCompanyAccess = null;

async function resolveServiceCompanyAccess() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  if (_cachedServiceCompanyAccess && _cachedServiceCompanyAccess.expiresAt > Date.now()) {
    return _cachedServiceCompanyAccess.value;
  }
  try {
    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const headers = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    };
    const compRes = await fetch(
      `${baseUrl}/rest/v1/companies?id=eq.${encodeURIComponent(DEFAULT_COMPANY_ID)}&select=id,name&limit=1`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    let companyId = DEFAULT_COMPANY_ID;
    let companyName = setting('COPILOT_COMPANY_NAME') || 'فاي تك للمقاولات العامة والتشطيبات الفاخرة';
    if (compRes.ok) {
      const rows = await compRes.json();
      if (Array.isArray(rows) && rows[0]?.id) {
        companyId = rows[0].id;
        companyName = rows[0].name || companyName;
      }
    }
    const ucRes = await fetch(
      `${baseUrl}/rest/v1/user_companies?company_id=eq.${encodeURIComponent(companyId)}&select=user_id,role&limit=1`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    let userId = '00000000-0000-4000-8000-000000000001';
    if (ucRes.ok) {
      const ucRows = await ucRes.json();
      if (Array.isArray(ucRows) && ucRows[0]?.user_id) {
        userId = ucRows[0].user_id;
      }
    }
    const value = {
      companyId,
      companyName,
      userId,
      accessToken: SUPABASE_SERVICE_KEY,
      allowServiceRole: true,
      fullCompanyAccess: true,
      permissions: {
        labor_logs: ['view', 'create', 'edit'],
        projects: ['view', 'create', 'edit'],
        expenses: ['view', 'create', 'edit'],
        partners: ['view', 'create', 'edit'],
        laborcost: ['view'],
        violations: ['view'],
        payments: ['view'],
        journal: ['view'],
      },
    };
    _cachedServiceCompanyAccess = { value, expiresAt: Date.now() + 10 * 60 * 1000 };
    return value;
  } catch {
    return null;
  }
}

/**
 * Enriches a raw access object from resolveCompanyAccess() with the fields
 * required by copilot-tool-policy.mjs: companyName and permissions.
 */
function enrichAccess(raw) {
  if (!raw) return null;
  return {
    ...raw,
    companyName: raw.companyName ?? setting('COPILOT_COMPANY_NAME') ?? null,
    fullCompanyAccess: raw.fullCompanyAccess === true,
    allowServiceRole: raw.allowServiceRole === true,
    permissions: raw.permissions && typeof raw.permissions === 'object' && !Array.isArray(raw.permissions)
      ? raw.permissions : {},
  };
}

async function resolveLiveCompanyAccess() {
  if (!LIVE_READS_ENABLED) return null;
  const userScoped = enrichAccess(await resolveCompanyAccess());
  if (userScoped) return userScoped;
  return enrichAccess(await resolveServiceCompanyAccess());
}

if (!BOT_TOKEN) {
  console.error('❌ خطأ: TELEGRAM_BOT_TOKEN غير موجود في ملف .env.local');
  process.exit(1);
}

if (CHAT_ID === null && GROUP_CHAT_ID === null) {
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
    resolveAccess: async () => resolveLiveCompanyAccess(),
    createTools: access => createCopilotTools({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: access?.allowServiceRole ? access.accessToken : SUPABASE_PUBLIC_KEY,
      accessToken: access?.accessToken,
      companyId: access?.companyId,
      allowServiceRole: Boolean(access?.allowServiceRole),
      detailedReads: true,
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

function detectDirectFieldOpsCall(userPrompt) {
  const t = String(userPrompt || '').trim();
  if (!t) return null;

  // 1) إضافة يومية عامل من المحادثة
  if (/(?:ضيف|اضف|أضف|سجل|سجّل|اعمل|انشئ|أنشئ).*(?:يوميه|يومية)\s*(?:عامل)?/i.test(t)) {
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
  if (/(?:ضيف|اضف|أضف|سجل|سجّل).*(?:مصروف)/i.test(t) && /\d+/.test(t) && !/ازاي|إزاي|كيف/.test(t)) {
    const amountMatch = t.match(/(\d+(?:\.\d+)?)/);
    const siteMatch = t.match(/(?:فيلا|مشروع|عماره|عمارة|موقع)\s*([\p{L}\p{N}_-]+)/u);
    if (amountMatch) {
      const desc = t
        .replace(/^(?:ضيفلي|ضيف|اضف|أضف|سجل|سجّل)\s*(?:مصروف)?/u, '')
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
    /تقرير\s*(?:اليوم|النهارده|النهاردة|يومي|مفصل|شامل)/i.test(t) ||
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
    /(?:عاوز|اي\s*هي|ايه\s*هي|اي|إيه)\s*(?:كل)?\s*(?:الفلل|المشاريع)/i.test(t) ||
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

  // 1) سؤال عن حالة السيستم / الأعطال
  if (/(?:هل\s*في|فيه)\s*(?:مشاكل|اعطال|أعطال)\s*(?:في)?\s*(?:السيستم|النظام)/i.test(t)) {
    return 'معنديش طريقة أتابع بيها حالة السيستم. تنبيهات الأخطاء بتوصل في القناة دي؛ لو فيه تنبيه معيّن رد عليه وأنا أشرح سببه.';
  }

  // 2) سؤال عن اسم الموديل
  if (/(?:المودل|الموديل|model)\s*(?:بتاعك|اللي\s*انت)?\s*(?:اسمه|ايه|إيه)/i.test(t)) {
    return 'أنا مساعد فاي تك، مبني على Gemini من Google.';
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
  const access = await resolveLiveCompanyAccess();
  const declarations = getEnabledCopilotDeclarations(FUNCTION_DECLARATIONS, access);
  const scope = conversationScope(access, declarations);
  const context = conversation.getContext({ ...actor, scope });
  const memory = { scope, parentMessageId: context.parentMessageId };
  const quotedMessageText = context.referenceMissing && actor?.quotedMessageText ? actor.quotedMessageText : '';

  const directText = detectDirectTextReply(userPrompt, actor?.quotedMessageText || '');
  if (directText) {
    return { text: directText, memory: { ...memory, modelText: directText } };
  }

  async function executeToolCall(call) {
    const verified = call.name === 'get_engineering_checklist_and_specs'
      ? null
      : await resolveLiveCompanyAccess();
    const tools = createCopilotTools({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: verified?.allowServiceRole ? verified.accessToken : SUPABASE_PUBLIC_KEY,
      accessToken: verified?.accessToken,
      companyId: verified?.companyId,
      allowServiceRole: Boolean(verified?.allowServiceRole),
      detailedReads: true,
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

  const systemInstructions = buildSystemInstructions({
    knowledge: loadKnowledgeBase(),
    declarations,
    referenceMissing: context.referenceMissing,
    quotedMessageText,
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
      if (directCall && declarations.some(d => d.name === directCall.name)) {
        return executeToolCall(directCall);
      }
      return { text: MODEL_MESSAGES.unavailable };
    }
    const responseBody = await response.json();
    const candidate = responseBody.candidates?.[0];
    const reply = interpretModelParts(candidate?.content?.parts, declarations, candidate?.finishReason);
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
      return { text: MODEL_MESSAGES.generalPrefix + reply.text, memory: { ...memory, modelText: reply.text } };
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

function authorizeBotMessages(handleMessage) {
  if (CHAT_ID !== null) {
    return authorizeTelegramMessages(CHAT_ID, handleMessage);
  }
  return async update => {
    const message = update?.message;
    if (!message || update.edited_message || update.channel_post || update.edited_channel_post) return;
    if (message.chat?.id !== GROUP_CHAT_ID || !message.from || message.from.is_bot !== false) return;
    return handleMessage(message);
  };
}

// Process incoming Telegram update
const handleUpdate = authorizeBotMessages(async msg => {
  const chatId = msg.chat?.id;
  let rawText = String(msg.text || msg.caption || '').trim();
  const messageId = msg.message_id;
  const fromName = escapeTelegramText(msg.from.first_name || 'صديقي');
  const actor = {
    chatId,
    userId: msg.from.id,
    replyToMessageId: msg.reply_to_message?.chat?.id === chatId ? msg.reply_to_message.message_id : undefined,
    quotedMessageText: msg.reply_to_message?.chat?.id === chatId
      ? String(msg.reply_to_message.text || msg.reply_to_message.caption || '').trim().slice(0, 1200)
      : undefined,
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

أنا مساعد فاي تك الذكي لإدارة المشروعات والمحاسبة. تقدر تسألني مباشرةً عن:

📊 <b>استعلامات الميدان والتقارير اليومية</b>
• «العمالة اللي نزلت النهارده»
• «المشاريع اللي موجودة كلها»
• «المشاريع اللي اشتغلناها النهارده كلها»
• «تقرير اليوم المفصل» (العمالة + الفلل + المصروفات + اللي اتصرف للعمالة + الخامات + المقاولين اللي اتسلمت + الركوستات اللي خلصت)

📝 <b>إضافة يومية عامل أو مصروف مباشرةً</b>
• «ضيفلي يومية عامل محمد مطيز بند جبس تجليد طريحة 50 عمل 35 يومية 200»
• «سجل مصروف 500 ريال تشوين رمل فيلا 657»
• أو استخدم <code>/add</code> لبدء نموذج (يومية عامل / مصروف / سند قبض / سند صرف).

🧠 <b>مقترحات التدريب والمعرفة</b>
• «اتشك ليست استلام المحارة»
• <code>/train المعلومة</code> أو «احفظ عندك أن…» لإرسال اقتراح للمراجعة.
• <code>/memory</code> لعرض مقترحاتك المعلقة، و<code>/reload</code> لتحديث دليل المعرفة.

📄 <b>ملفات PDF</b> (بتأكيد قبل الإرسال)
• <code>/pdf worker الاسم YYYY-MM</code> لكشف عامل يومية عن شهر.
• <code>/pdf checklist البند</code> لاستمارة فحص مسودة.
• <code>/confirm</code> للتأكيد أو <code>/cancel</code> للإلغاء، و<code>/new</code> لمحادثة جديدة.
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
      const company = await resolveLiveCompanyAccess();
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

initKnowledgeBase();
runPdfMockTest().catch(err => console.error('Mock test error:', err.message));
// Polling timeout=25s (long-poll standard). AbortSignal is 35s. // TODO: env — COPILOT_POLL_TIMEOUT_S
pollUpdates();
