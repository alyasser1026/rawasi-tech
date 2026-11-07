import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SETTINGS_FILE_PATH = path.join(rootDir, 'config', 'copilot_bot_settings.json');
const OPERATIONS_INDEX_PATH = path.join(rootDir, 'work', 'copilot_operations_index.json');

export const DEFAULT_BOT_SETTINGS = Object.freeze({
  botName: 'م. سليم',
  botTitle: 'المساعد الهندسي والمحاسبي الذكي — فاي تك',
  introEnabled: true,
  introTemplate: '👋 أهلاً بك! معك {botName} ({botTitle}).',
  inactivityCloseEnabled: true,
  inactivityTimeoutMinutes: 3,
  inactivityCloseMessage:
    '⏳ نظراً لعدم وجود رد أو استفسار جديد، تم إنهاء الجلسة الحالية وحفظ السياق.\nأنا ({botName}) موجود دائماً في خدمتك وقتما تبعث رسالة جديدة! 👋',
  voiceReplyMode: 'always', // 'always' | 'on_voice_or_request' | 'off'
  voiceSpeed: 'normal',
  autoDailyReportEnabled: true,
  autoDailyReportTime: '20:00',
  operationSeqStart: 101,
});

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getBotSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      ensureDir(SETTINGS_FILE_PATH);
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_BOT_SETTINGS, null, 2), 'utf8');
      return { ...DEFAULT_BOT_SETTINGS };
    }
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, 'utf8'));
    return {
      ...DEFAULT_BOT_SETTINGS,
      ...(raw && typeof raw === 'object' ? raw : {}),
    };
  } catch {
    return { ...DEFAULT_BOT_SETTINGS };
  }
}

export function saveBotSettings(partial = {}) {
  const current = getBotSettings();
  const updated = {
    ...current,
    ...(typeof partial.botName === 'string' && partial.botName.trim() ? { botName: partial.botName.trim().slice(0, 60) } : {}),
    ...(typeof partial.botTitle === 'string' && partial.botTitle.trim() ? { botTitle: partial.botTitle.trim().slice(0, 120) } : {}),
    ...(typeof partial.introEnabled === 'boolean' ? { introEnabled: partial.introEnabled } : {}),
    ...(typeof partial.introTemplate === 'string' && partial.introTemplate.trim()
      ? { introTemplate: partial.introTemplate.trim().slice(0, 400) }
      : {}),
    ...(typeof partial.inactivityCloseEnabled === 'boolean' ? { inactivityCloseEnabled: partial.inactivityCloseEnabled } : {}),
    ...(Number.isFinite(Number(partial.inactivityTimeoutMinutes)) && Number(partial.inactivityTimeoutMinutes) >= 1
      ? { inactivityTimeoutMinutes: Math.min(120, Math.max(1, Math.round(Number(partial.inactivityTimeoutMinutes)))) }
      : {}),
    ...(typeof partial.inactivityCloseMessage === 'string' && partial.inactivityCloseMessage.trim()
      ? { inactivityCloseMessage: partial.inactivityCloseMessage.trim().slice(0, 500) }
      : {}),
    ...(typeof partial.voiceReplyMode === 'string' && ['always', 'on_voice_or_request', 'off'].includes(partial.voiceReplyMode)
      ? { voiceReplyMode: partial.voiceReplyMode }
      : {}),
    ...(typeof partial.autoDailyReportEnabled === 'boolean' ? { autoDailyReportEnabled: partial.autoDailyReportEnabled } : {}),
    ...(typeof partial.autoDailyReportTime === 'string' && /^\d{2}:\d{2}$/.test(partial.autoDailyReportTime.trim())
      ? { autoDailyReportTime: partial.autoDailyReportTime.trim() }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  ensureDir(SETTINGS_FILE_PATH);
  fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

function loadOperationsStore() {
  try {
    if (!fs.existsSync(OPERATIONS_INDEX_PATH)) {
      return { nextSeq: DEFAULT_BOT_SETTINGS.operationSeqStart, operations: [] };
    }
    const parsed = JSON.parse(fs.readFileSync(OPERATIONS_INDEX_PATH, 'utf8'));
    return {
      nextSeq: Number.isInteger(parsed?.nextSeq) && parsed.nextSeq >= 1 ? parsed.nextSeq : DEFAULT_BOT_SETTINGS.operationSeqStart,
      operations: Array.isArray(parsed?.operations) ? parsed.operations : [],
    };
  } catch {
    return { nextSeq: DEFAULT_BOT_SETTINGS.operationSeqStart, operations: [] };
  }
}

function saveOperationsStore(store) {
  ensureDir(OPERATIONS_INDEX_PATH);
  fs.writeFileSync(OPERATIONS_INDEX_PATH, JSON.stringify(store, null, 2), 'utf8');
}

/**
 * يسجل عملية جديدة في الفهرس التسلسلي ويعيد رقمها المختصر (مثال: 101، 102)
 */
export function registerOperation({ operationType, recordId, recordCode, summary = '', siteRef = '', amount = null } = {}) {
  const store = loadOperationsStore();
  // إذا كانت العملية مسجلة مسبقاً بنفس الـ recordId أو recordCode نعيد رقمها الحالي
  const existing = store.operations.find(
    op => (recordId && op.recordId === String(recordId)) || (recordCode && op.recordCode === String(recordCode))
  );
  if (existing) {
    return existing.opNumber;
  }

  const opNumber = store.nextSeq;
  store.nextSeq = opNumber + 1;
  const entry = {
    opNumber,
    operationType: String(operationType || 'unknown'),
    recordId: recordId ? String(recordId) : null,
    recordCode: recordCode ? String(recordCode) : null,
    summary: String(summary || '').slice(0, 200),
    siteRef: String(siteRef || '').slice(0, 80),
    amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    createdAt: new Date().toISOString(),
  };
  store.operations.unshift(entry);
  if (store.operations.length > 500) {
    store.operations = store.operations.slice(0, 500);
  }
  saveOperationsStore(store);
  return opNumber;
}

/**
 * يبحث عن عملية بواسطة رقمها التسلسلي المختصر (مثل 101 أو #101 أو OP-101) أو الكود المرجعي
 */
export function resolveOperationByNumberOrCode(identifier) {
  if (!identifier) return null;
  const raw = String(identifier).trim();
  const store = loadOperationsStore();

  // فحص ما إذا كان المعرف رقماً تسلسلياً مثل 101 أو #101 أو OP-101 أو عمليه 101
  const numMatch = raw.match(/^(?:#|OP-|عملية|عمليه)?\s*(\d{1,6})$/i);
  if (numMatch) {
    const targetNum = Number(numMatch[1]);
    const foundByNum = store.operations.find(op => op.opNumber === targetNum);
    if (foundByNum) return foundByNum;
  }

  // أو مطابقة بالكود المرجعي أو الـ UUID
  const upper = raw.toUpperCase();
  const foundByCode = store.operations.find(
    op =>
      (op.recordCode && op.recordCode.toUpperCase() === upper) ||
      (op.recordId && op.recordId.toUpperCase() === upper) ||
      (op.recordId && op.recordId.toUpperCase().startsWith(upper.replace(/^(?:EXP-|LAB-|JO-|JV-)/, '')))
  );
  return foundByCode || null;
}

export function listRecentOperations(limit = 30) {
  const store = loadOperationsStore();
  return {
    nextSeq: store.nextSeq,
    operations: store.operations.slice(0, limit),
  };
}

/**
 * إرفاق صورة أو مستند أو فيديو بعملية مسجلة عبر رقمها المختصر (#101) أو كودها
 */
export function attachFileToOperation(identifier, { fileId, fileName, mimeType, fileType = 'document' } = {}) {
  const store = loadOperationsStore();
  const raw = String(identifier || '').trim();
  const numMatch = raw.match(/^(?:#|OP-|عملية|عمليه)?\s*(\d{1,6})$/i);
  const targetNum = numMatch ? Number(numMatch[1]) : null;
  const upper = raw.toUpperCase();

  const idx = store.operations.findIndex(op =>
    (targetNum !== null && op.opNumber === targetNum) ||
    (op.recordCode && op.recordCode.toUpperCase() === upper) ||
    (op.recordId && op.recordId.toUpperCase() === upper)
  );
  const targetOp = idx >= 0 ? store.operations[idx] : store.operations[0];
  if (!targetOp) return null;

  if (!Array.isArray(targetOp.attachments)) {
    targetOp.attachments = [];
  }
  targetOp.attachments.push({
    fileId: String(fileId || ''),
    fileName: String(fileName || 'attachment'),
    mimeType: String(mimeType || 'application/octet-stream'),
    fileType: String(fileType || 'document'),
    attachedAt: new Date().toISOString(),
  });
  saveOperationsStore(store);
  return targetOp;
}

export function updateOperationStatusInIndex(identifier, newStatus) {
  const store = loadOperationsStore();
  const raw = String(identifier || '').trim();
  const numMatch = raw.match(/^(?:#|OP-|عملية|عمليه)?\s*(\d{1,6})$/i);
  const targetNum = numMatch ? Number(numMatch[1]) : null;
  const upper = raw.toUpperCase();

  const op = store.operations.find(item =>
    (targetNum !== null && item.opNumber === targetNum) ||
    (item.recordCode && item.recordCode.toUpperCase() === upper) ||
    (item.recordId && item.recordId.toUpperCase() === upper)
  );
  if (!op) return null;
  op.status = newStatus;
  op.updatedAt = new Date().toISOString();
  saveOperationsStore(store);
  return op;
}

/**
 * تنظيف وتجهيز النص العربي لتحويله إلى كلام صوتي واضح ومختصر (TTS)
 */
export function prepareSpeechText(rawText, botName = 'م. سليم') {
  if (!rawText) return '';
  let text = String(rawText)
    .replace(/<[^>]+>/g, ' ')
    .replace(/━+/g, ' ، ')
    .replace(/[✅❌⚠️🚨📌🔢🆔📅🏢👷🔨📐📊💵💰💳🏷️📝🎙️⏳👋🧠💡📄•*`_~]/gu, ' ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/#(\d+)/g, ' رقم $1 ')
    .replace(/ر\.س/g, ' ريال سعودي ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > 420) {
    text = text.slice(0, 420);
    const lastStop = Math.max(text.lastIndexOf('،'), text.lastIndexOf('.'), text.lastIndexOf(' '));
    if (lastStop > 150) text = text.slice(0, lastStop);
    text += ' . التفاصيل الكاملة موضحة في الرسالة النصية.';
  }
  return text;
}

/**
 * تقسيم النص إلى جمل قصيرة (<= 165 حرف) وتوليد ملف صوتي عربي موحد (MP3 Buffer)
 */
export async function synthesizeArabicSpeech(rawText, { botName = 'م. سليم' } = {}) {
  const clean = prepareSpeechText(rawText, botName);
  if (!clean) return null;

  // تقسيم إلى مقاطع لا تتجاوز 165 حرفاً
  const words = clean.split(' ');
  const chunks = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 160) {
      if (current.trim()) chunks.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());

  const buffers = [];
  for (const chunk of chunks.slice(0, 4)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) continue;
    const arr = await res.arrayBuffer();
    if (arr.byteLength > 0) {
      buffers.push(Buffer.from(arr));
    }
  }

  if (buffers.length === 0) return null;
  return Buffer.concat(buffers);
}
