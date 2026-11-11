import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SETTINGS_FILE_PATH = path.join(rootDir, 'config', 'copilot_bot_settings.json');
const OPERATIONS_INDEX_PATH = path.join(rootDir, 'work', 'copilot_operations_index.json');

export const DEFAULT_BOT_SETTINGS = Object.freeze({
  botName: 'م. سلمى',
  botTitle: 'المساعدة الهندسية والمحاسبية الذكية — فاي تك',
  introEnabled: true,
  introTemplate: '👋 أهلاً بيك يا باشمهندس! معاك {botName} ({botTitle}). تحت أمرك في أي استعلام أو تسجيل عملية النهارده!',
  inactivityCloseEnabled: true,
  inactivityTimeoutMinutes: 3,
  inactivityCloseMessage:
    '⏳ علشان مفيش استفسارات جديدة دلوقتي يا باشمهندس، قفلت المحادثة دي وحفظتلك كل حاجة.\nأنا ({botName}) موجودة معاك في أي وقت تبعتلي فيه رسالة جديدة! 👋',
  voiceReplyMode: 'always', // 'always' | 'on_voice_or_request' | 'off'
  voiceGender: 'female',
  voiceDialect: 'ar-EG',
  voiceName: 'Aoede',
  voiceSpeed: 'normal',
  onlyGeminiVoice: false,
  emergencyVoiceEnabled: true,
  mozzaModeEnabled: false,
  mozzaNickname: 'يا محاميحو',
  autoDailyReportEnabled: true,
  autoDailyReportTime: '20:00',
  operationSeqStart: 101,
  activeCompanyId: '72918f4d-10c3-43a0-884e-2f84f1224335',
});

export const KNOWN_COMPANIES = Object.freeze([
  {
    index: 1,
    id: '72918f4d-10c3-43a0-884e-2f84f1224335',
    code: 'PHI',
    name: 'فاي تك للمقاولات العامة والتشطيبات الفاخرة',
    shortName: 'فاي تك',
    country: 'SA',
    currency: 'SAR',
    currencyLabel: 'ر.س',
    flag: '🇸🇦',
  },
  {
    index: 2,
    id: '8c90cb59-ffa3-4cd1-8bdc-db80a3c825b8',
    code: 'AWA',
    name: 'PHI-TECH-EGY',
    shortName: 'فاي تك مصر (PHI-TECH-EGY)',
    country: 'EG',
    currency: 'EGP',
    currencyLabel: 'ج.م',
    flag: '🇪🇬',
  },
]);

export function resolveCompanyCurrencyLabel({ companyId, companyName, currency } = {}) {
  const cur = String(currency || '').trim().toUpperCase();
  if (cur === 'EGP' || cur === 'EG' || cur === 'ج.م' || cur === 'جنيه') return 'ج.م';
  if (cur === 'SAR' || cur === 'SA' || cur === 'ر.س' || cur === 'ريال') return 'ر.س';
  if (cur === 'USD' || cur === 'دولار') return 'USD';
  if (cur === 'AED' || cur === 'درهم') return 'د.إ';

  const idLower = String(companyId || '').trim().toLowerCase();
  const nameLower = String(companyName || '').trim().toLowerCase();
  const matched = KNOWN_COMPANIES.find(
    c => (idLower && c.id === idLower) || (nameLower && (c.name.toLowerCase() === nameLower || c.code.toLowerCase() === nameLower))
  );
  if (matched?.currencyLabel) return matched.currencyLabel;
  if (nameLower && (nameLower.includes('egy') || nameLower.includes('مصر'))) return 'ج.م';
  return 'ر.س';
}

export function getActiveCompany(settings = getBotSettings()) {
  const activeId = settings.activeCompanyId || KNOWN_COMPANIES[0].id;
  return KNOWN_COMPANIES.find(c => c.id === activeId) || {
    index: 1,
    id: activeId,
    code: 'PHI',
    name: 'فاي تك',
    shortName: 'فاي تك',
    country: 'SA',
    flag: '🇸🇦',
  };
}

export function setActiveCompany(companyIdentifier) {
  let target = null;
  const str = String(companyIdentifier ?? '').trim().toLowerCase();
  if (['1', 'one', 'واحد', 'الأولى', 'الاولى', 'الاولانيه', 'phi', 'sa', 'السعودية', 'السعوديه'].includes(str)) {
    target = KNOWN_COMPANIES[0];
  } else if (['2', 'two', 'اتنين', 'تنين', 'الثانية', 'التانية', 'الثانيه', 'التانيه', 'awa', 'egy', 'phi-tech-egy', 'مصر'].includes(str)) {
    target = KNOWN_COMPANIES[1];
  } else {
    target = KNOWN_COMPANIES.find(c => c.id === str || c.code.toLowerCase() === str || c.name.toLowerCase().includes(str));
  }
  if (!target) target = KNOWN_COMPANIES[0];
  saveBotSettings({ activeCompanyId: target.id });
  return target;
}

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
    ...(typeof partial.voiceName === 'string' && ['ar-EG-SalmaNeural', 'Aoede', 'Kore', 'Leda', 'Zephyr'].includes(partial.voiceName)
      ? { voiceName: partial.voiceName }
      : {}),
    ...(typeof partial.emergencyVoiceEnabled === 'boolean'
      ? { emergencyVoiceEnabled: partial.emergencyVoiceEnabled, onlyGeminiVoice: !partial.emergencyVoiceEnabled }
      : {}),
    ...(typeof partial.onlyGeminiVoice === 'boolean'
      ? { onlyGeminiVoice: partial.onlyGeminiVoice, emergencyVoiceEnabled: !partial.onlyGeminiVoice }
      : {}),
    ...(typeof partial.onlySalmaVoice === 'boolean' ? { onlySalmaVoice: partial.onlySalmaVoice } : {}),
    ...(typeof partial.mozzaModeEnabled === 'boolean' ? { mozzaModeEnabled: partial.mozzaModeEnabled } : {}),
    ...(typeof partial.mozzaNickname === 'string' && partial.mozzaNickname.trim()
      ? { mozzaNickname: partial.mozzaNickname.trim().slice(0, 40) }
      : {}),
    ...(typeof partial.autoDailyReportEnabled === 'boolean' ? { autoDailyReportEnabled: partial.autoDailyReportEnabled } : {}),
    ...(typeof partial.autoDailyReportTime === 'string' && /^\d{2}:\d{2}$/.test(partial.autoDailyReportTime.trim())
      ? { autoDailyReportTime: partial.autoDailyReportTime.trim() }
      : {}),
    ...(typeof partial.activeCompanyId === 'string' && partial.activeCompanyId.trim()
      ? { activeCompanyId: partial.activeCompanyId.trim() }
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

  const numMatch = raw.match(/^(?:#|OP-|عملية|عمليه)?\s*(\d{1,6})$/i);
  if (numMatch) {
    const targetNum = Number(numMatch[1]);
    const foundByNum = store.operations.find(op => op.opNumber === targetNum);
    if (foundByNum) return foundByNum;
  }

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
