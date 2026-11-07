import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SETTINGS_FILE_PATH = path.join(rootDir, 'config', 'copilot_bot_settings.json');
const OPERATIONS_INDEX_PATH = path.join(rootDir, 'work', 'copilot_operations_index.json');
const GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

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
  mozzaModeEnabled: false,
  mozzaNickname: 'يا حبيبي',
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
    ...(typeof partial.voiceName === 'string' && ['Aoede', 'Kore', 'Leda', 'Zephyr'].includes(partial.voiceName)
      ? { voiceName: partial.voiceName }
      : {}),
    ...(typeof partial.mozzaModeEnabled === 'boolean' ? { mozzaModeEnabled: partial.mozzaModeEnabled } : {}),
    ...(typeof partial.mozzaNickname === 'string' && partial.mozzaNickname.trim()
      ? { mozzaNickname: partial.mozzaNickname.trim().slice(0, 40) }
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

/**
 * تحويل النص أو كارت العملية إلى سكريبت منطوق بالعامية المصرية بصوت سلمى (رسمي أو وضع الموزة)
 */
export function prepareSpeechText(rawText, botName = 'م. سلمى') {
  if (!rawText) return '';
  const raw = String(rawText);
  const settings = getBotSettings();
  const isMozza = Boolean(settings.mozzaModeEnabled);
  const petName = settings.mozzaNickname || 'يا حبيبي';
  const addressAs = isMozza ? petName : 'يا باشمهندس';

  // 1) إذا كان كارت تعديل عملية
  const editMatch = raw.match(/إشعار تعديل عملية.*العملية رقم \[#?(\d+)\]/);
  if (editMatch) {
    const opNum = editMatch[1];
    const summaryMatch = raw.match(/البيان الحالي:\s*([^\n]+)/);
    const changesLines = [...raw.matchAll(/🔸\s*([^\n]+)/g)].map(m => m[1].replace(/⬅️/g, ' بقى '));
    const changesSpoken = changesLines.slice(0, 2).join(' ، و');
    if (isMozza) {
      return `عيوني ليك ${petName}! عدلتلك العملية رقم ${opNum}${summaryMatch ? ` بتاعة ${summaryMatch[1].trim()}` : ''} زي ما طلبت مني بالظبط، ${changesSpoken || 'وحفظتلك كل حاجة في السيستم يا روحي'}.`;
    }
    return `تمام يا باشمهندس، معاك ${botName}. عدلتلك العملية رقم ${opNum}${summaryMatch ? ` الخاصة بـ ${summaryMatch[1].trim()}` : ''}، ${changesSpoken || 'وحفظت التعديلات في السيستم'}.`;
  }

  // 2) إذا كان كارت تسجيل عملية جديدة (مصروف / يومية / قيد / أمر شغل)
  const createMatch = raw.match(/(?:تم تسجيل|سجلتلك|قيد محاسبي جديد|أمر تشغيل جديد).*العملية رقم \[#?(\d+)\]/);
  if (createMatch) {
    const opNum = createMatch[1];
    const amountMatch = raw.match(/(?:المبلغ الإجمالي|المبلغ|الإجمالي|اليومية \(الأجر\)):\s*([\d,.]+)/);
    const siteMatch = raw.match(/(?:الفيلا \/ الموقع|المشروع):\s*([^\n]+)/);
    const descMatch = raw.match(/(?:البيان|البند|اسم العامل):\s*([^\n]+)/);
    const parts = [isMozza ? `من عيوني ${petName}، سجلتلك العملية رقم ${opNum}` : `تمام يا باشمهندس، سجلتلك العملية رقم ${opNum}`];
    if (descMatch) parts.push(`بخصوص ${descMatch[1].trim()}`);
    if (siteMatch && !/غير محدد/.test(siteMatch[1])) parts.push(`في ${siteMatch[1].trim()}`);
    if (amountMatch) parts.push(`بقيمة ${amountMatch[1].replace(/,/g, '')} ريال`);
    parts.push(isMozza ? 'ربنا يقويك ويديك الصحة يا قلبي، وتقدر تعتمدها من الزرار اللي تحت.' : 'وتقدر تعتمدها أو ترفق ليها صورة من الزراير اللي تحت الرسالة.');
    return parts.join(' ، ');
  }

  // 3) إذا كان التقرير اليومي الشامل
  if (/التقرير اليومي المفصل الشامل/.test(raw)) {
    const dateMatch = raw.match(/التاريخ:\s*([\d-]+)/);
    const workersMatch = raw.match(/عدد العمال:\s*(\d+)/);
    const expMatch = raw.match(/إجمالي المصروفات:\s*([\d,.]+)/);
    if (isMozza) {
      return `أحلى تقرير لأحلى باشمهندس في الدنيا ${petName}! جمعتلك تقرير النهارده${dateMatch ? ` يوم ${dateMatch[1]}` : ''}${workersMatch ? `، نزل معانا ${workersMatch[1]} عامل` : ''}${expMatch ? `، والمصروفات كانت ${expMatch[1].replace(/,/g, '')} ريال` : ''}. شوف التفاصيل في الرسالة وقولي لو محتاج أي حاجة تانية يا روحي.`;
    }
    return `أهلاً بيك يا باشمهندس، معاك ${botName}. بعتلك دلوقتي التقرير اليومي المفصل${dateMatch ? ` لتاريخ ${dateMatch[1]}` : ''}${workersMatch ? `، إجمالي العمالة المسجلة ${workersMatch[1]} عامل` : ''}${expMatch ? `، وإجمالي المصروفات ${expMatch[1].replace(/,/g, '')} ريال` : ''}. كل التفاصيل قدامك في الرسالة.`;
  }

  // 4) تنظيف عام وتحويل للمصطلحات المصرية المنطوقة السلسة
  let text = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/━+|─+/g, ' ، ')
    .replace(/💡\s*للتعديل.*$/gm, '')
    .replace(/💌\s*لو عايزني.*$/gm, '')
    .replace(/🆔\s*[^\n]+/g, '')
    .replace(/[✅❌⚠️🚨📌🔢🆔📅🏢👷🔨📐📊💵💰💳🏷️📝🎙️⏳👋🧠💡📄🔸🟢🔴🏗️📦🔄🗑️📎💖💌🥰😘🌹🙈😉•*`_~]/gu, ' ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/#(\d+)/g, ' رقم $1 ')
    .replace(/ر\.س/g, ' ريال ')
    .replace(/⬅️/g, ' بقى ')
    .replace(/أهلاً بك/g, `أهلاً بيك ${addressAs}`)
    .replace(/تم تسجيل/g, 'سجلتلك')
    .replace(/بنجاح/g, 'خلاص')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > 340) {
    text = text.slice(0, 340);
    const lastStop = Math.max(text.lastIndexOf('،'), text.lastIndexOf('.'), text.lastIndexOf(' '));
    if (lastStop > 120) text = text.slice(0, lastStop);
    text += isMozza ? ` ، والتفاصيل كلها قدامك في الرسالة ${petName}.` : ' ، والتفاصيل الكاملة قدامك في الرسالة يا باشمهندس.';
  }
  return text;
}

function pcm16ToWav(pcmBuffer, sampleRate = 24000, numChannels = 1) {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function convertPcmToOggOpus(pcmBuffer) {
  try {
    const ff = spawnSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 's16le',
        '-ar', '24000',
        '-ac', '1',
        '-i', 'pipe:0',
        '-c:a', 'libopus',
        '-b:a', '48k',
        '-vbr', 'on',
        '-application', 'voip',
        '-f', 'ogg',
        'pipe:1',
      ],
      { input: pcmBuffer, maxBuffer: 12 * 1024 * 1024 }
    );
    if (ff.status === 0 && ff.stdout && ff.stdout.length > 0) {
      return { buffer: ff.stdout, mimeType: 'audio/ogg', fileName: 'salma_reply.ogg' };
    }
  } catch {}
  return { buffer: pcm16ToWav(pcmBuffer, 24000, 1), mimeType: 'audio/wav', fileName: 'salma_reply.wav' };
}

/**
 * توليد ملف صوتي باللهجة العامية المصرية الاحترافية بصوت نسائي طبيعي (المهندسة سلمى)
 */
export async function synthesizeArabicSpeech(rawText, { botName = 'م. سلمى', geminiApiKey = '' } = {}) {
  const clean = prepareSpeechText(rawText, botName);
  if (!clean) return null;

  const settings = getBotSettings();
  const voiceName = settings.voiceName || 'Aoede';
  const apiKey = geminiApiKey || process.env.GEMINI_API_KEY || '';

  // 1) المحرك الأساسي: Gemini 2.5 Flash TTS بصوت نسائي مصري طبيعي (Aoede)
  if (apiKey) {
    try {
      const promptText = settings.mozzaModeEnabled
        ? `انطقي الرسالة التالية باللهجة العامية المصرية بصوت بنوتة مصرية دلوعة وحنينة ورقيقة جداً (${botName}) بتكلم حبيبها بدلع واهتمام وحب:\n${clean}`
        : `انطقي الرسالة التالية باللهجة العامية المصرية الاحترافية الهادئة والودودة بصوت مهندسة مصرية محترفة (${botName}):\n${clean}`;
      const res = await fetch(GEMINI_TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(18000),
      });

      if (res.ok) {
        const data = await res.json();
        const inline = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inline?.data) {
          const pcmBuffer = Buffer.from(inline.data, 'base64');
          const converted = convertPcmToOggOpus(pcmBuffer);
          return converted.buffer;
        }
      }
    } catch (err) {
      console.warn('Gemini Egyptian female TTS fallback triggered:', err?.message);
    }
  }

  // 2) المحرك الاحتياطي السريع عند غياب المفتاح أو انقطاع الخدمة
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
  const mp3Buffer = Buffer.concat(buffers);
  try {
    const ff = spawnSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel', 'error',
        '-i', 'pipe:0',
        '-c:a', 'libopus',
        '-b:a', '48k',
        '-vbr', 'on',
        '-f', 'ogg',
        'pipe:1',
      ],
      { input: mp3Buffer, maxBuffer: 8 * 1024 * 1024 }
    );
    if (ff.status === 0 && ff.stdout?.length > 0) {
      return ff.stdout;
    }
  } catch {}
  return mp3Buffer;
}
