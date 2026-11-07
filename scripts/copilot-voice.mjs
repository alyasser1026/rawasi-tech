import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { addAbortSignal } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { egyptianNumberWords, formatEgyptianRiyals } from './copilot-spoken-money.mjs';

const GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent';
const GEMINI_TTS_FALLBACK_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent';
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_PRO_VOICE_MODEL = 'gemini-3.8-flash-tts';
const MAX_SPEECH_LENGTH = 380;
const DETAILS_IN_TEXT = 'باقي التفاصيل في الرسالة.';
const sentenceSegmenter = new Intl.Segmenter('ar-EG', { granularity: 'sentence' });
const spokenMonth = new Intl.DateTimeFormat('ar-EG', { month: 'long', timeZone: 'UTC' });
const pronunciationHints = {
  'اتسجّل': 'اِتْسَجَّل',
  'عمّال': 'عُمَّال',
  'خمسمية': 'خُمْسُمِيَّة',
  'وخمسمية': 'وَخُمْسُمِيَّة',
  'هللة': 'هَلَلَة',
};

function speakIsoDate(iso) {
  const date = new Date(iso + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || !date.toISOString().startsWith(iso)) return iso;
  return [egyptianNumberWords(date.getUTCDate()), spokenMonth.format(date), egyptianNumberWords(date.getUTCFullYear())].join(' ');
}

function cleanSpeechLine(line) {
  return line
    .replace(/<\/?(?:b|strong|i|em|u|s|code|pre|a|span)(?:\s[^>]*)?>/gi, '')
    .replace(/\[([^\]\n]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\b/gi, '')
    .replace(/\d\uFE0F?\u20E3|\p{Extended_Pictographic}|[\uFE0F\u200D]/gu, '')
    .replace(/[━─]+/g, '')
    .replace(/^\s*(?:(?:[-*>]+|#{1,6})(?=\s)|•)\s*/g, '')
    .replace(/\[(?:#)([\d٠-٩۰-۹]+)\]/g, '$1')
    .replace(/(\*\*|__|~~|\x60)(.+?)\1/g, '$2')
    .replace(/\|\s*/g, '، ')
    .replace(/ر\s*\.\s*س\.?|\bSAR\b/gi, ' ريال سعودي ')
    .replace(/ج\s*\.\s*م\.?|\bEGP\b/gi, ' جنيه مصري ')
    .replace(/(?<![\p{L}\p{N}_-])\d{4}-\d{2}-\d{2}(?![\p{L}\p{N}_-])/gu, speakIsoDate)
    .replace(/(?<=[\s\d٠-٩۰-۹])م²/g, ' متر مربع')
    .replace(/(?<=[\s\d٠-٩۰-۹])م³/g, ' متر مكعب')
    .replace(/(^|\s)م\.\s*(?=سلمى)/g, '$1المهندسة ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([،.؟!:])/g, '$1')
    .trim();
}

function readField(lines, label) {
  return lines.find(line => line.startsWith(label + ':'))?.slice(label.length + 1).trim() ?? '';
}

const operationTypes = [
  ['سجلتلك مسودة المصروف', 'سجلتلك مصروف', 'المصروف'],
  ['سجلتلك مسودة يومية العامل', 'سجلتلك يومية', 'اليومية'],
  ['سجلتلك قيد محاسبي جديد', 'سجلتلك قيد محاسبي', 'القيد'],
  ['سجلتلك أمر تشغيل جديد', 'سجلتلك أمر شغل', 'أمر الشغل'],
];

function narrateOperation(lines) {
  const reference = lines[0].match(/العملية رقم (?:\[)?(#?[\p{L}\p{N}_-]+)\]?$/u)?.[1];
  const type = operationTypes.find(([heading]) => lines[0].includes(heading));
  if (!reference || !type || !readField(lines, 'رقم العملية للتعديل السريع')) return null;

  const [heading, intro, subject] = type;
  const detail = readField(lines, 'البيان') || readField(lines, 'البند') || readField(lines, 'اسم العامل');
  const site = readField(lines, 'الفيلا / الموقع') || readField(lines, 'المشروع');
  const amount = readField(lines, 'المبلغ الإجمالي') || readField(lines, 'المبلغ') || readField(lines, 'الإجمالي');
  const wage = readField(lines, 'اليومية (الأجر)').split(' (حضور:')[0];
  const status = readField(lines, 'الحالة');
  const isDraft = /^مسودة(?:\s|$)/.test(status) || (!status && heading.includes('مسودة'));
  const where = site && !/^(?:عام|غير محدد|مش متحدد|—)$/.test(site)
    ? (/^فيلا\s/.test(site) ? ' ل' + site : ' في ' + site)
    : '';
  const value = amount ? 'المبلغ، ' + amount : (wage ? 'الأجر اليومي، ' + wage : '');
  const state = isDraft ? subject + ' لسه مسودة'
    : (status ? subject + ' حالته ' + status : '');
  const context = (detail ? ' ' + detail : '') + where;
  const includeContext = context.length <= 110;
  return [
    intro + (includeContext ? context : ''),
    ...(value ? [value] : []),
    ...(state ? [state] : []),
    'رقم العملية، ' + reference,
    ...(includeContext ? [] : [DETAILS_IN_TEXT]),
  ];
}

function narrateDailyReport(lines) {
  if (!lines.some(line => /^التقرير اليومي المفصل الشامل(?:\s|$)/.test(line))) return null;
  const date = readField(lines, 'ليوم').split('،')[0];
  const labor = lines.find(line => /^العمالة اللي نزلت/.test(line));
  const expenses = lines.find(line => /^المصروفات المسجلة/.test(line));
  const workers = labor?.match(/([\d٠-٩۰-۹]+)\s+عامل\)/)?.[1];
  const amount = expenses?.match(/بمبلغ إجمالي\s+(.+?)\s*\)/)?.[1];
  const facts = [
    workers ? narrateWorkers(workers) : (labor?.includes('غير متاح') ? 'بيانات العمالة مش متاحة' : ''),
    amount ? 'إجمالي المصروفات، ' + amount : (expenses?.includes('غير متاح') ? 'بيانات المصروفات مش متاحة' : ''),
  ].filter(Boolean);
  return [
    'ده ملخّص الشغل' + (date ? ' ليوم ' + date : ''),
    ...facts,
    DETAILS_IN_TEXT,
  ];
}

function narrateWorkers(digits) {
  const count = Number(digits.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 0xf)));
  if (count === 0) return 'مفيش عمال اتسجلوا في اليوم ده';
  if (count === 1) return 'اتسجّل عامل واحد';
  if (count === 2) return 'اتسجّل عاملين';
  return 'اتسجّل ' + egyptianNumberWords(count) + (count <= 10 ? ' عمّال' : ' عامل');
}

function punctuate(line) {
  return /[.!؟?…]$/.test(line) ? line : line.replace(/[،:؛]+$/, '') + '.';
}

function prepareSpeech(rawText) {
  const lines = String(rawText ?? '').split(/\r?\n/)
    .filter(line => !/^\s*(?:🆔|(?:💡|💌)\s*(?:لو |للتعديل))/.test(line))
    .map(cleanSpeechLine)
    .filter(line => line && !/^شرح عام من دليل فاي تك$/.test(line));
  if (!lines.length) return { text: '', workReply: false };

  const spoken = narrateOperation(lines) ?? narrateDailyReport(lines);
  const text = (spoken ?? lines).map(line => punctuate(formatEgyptianRiyals(line))).join('\n');
  const workReply = Boolean(spoken);
  if (text.length <= MAX_SPEECH_LENGTH) return { text, workReply };

  const sentences = [];
  let remaining = MAX_SPEECH_LENGTH - DETAILS_IN_TEXT.length - 1;
  for (const { segment } of sentenceSegmenter.segment(text)) {
    const sentence = segment.trim();
    if (sentence.length > remaining) break;
    if (!sentence) continue;
    sentences.push(sentence);
    remaining -= sentence.length + 1;
  }
  return { text: [...sentences, DETAILS_IN_TEXT].join('\n'), workReply };
}

export function prepareSpeechText(rawText) {
  return prepareSpeech(rawText).text;
}

async function synthesizeWithEdge(text, settings, createEdgeTts, workReply) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const tts = createEdgeTts({ connectionTimeoutMs: 12000, synthesisTimeoutMs: 30000 });
    const deadline = AbortSignal.timeout(35000);
    try {
      await tts.setMetadata('ar-EG-SalmaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const pronunciation = workReply
        ? text.replace(/(?<![\p{L}\p{M}\p{N}_-])(?:اتسجّل|عمّال|و?خمسمية|هللة)(?![\p{L}\p{M}\p{N}_-])/gu,
          word => pronunciationHints[word])
        : text;
      const escaped = pronunciation.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
      const { audioStream } = tts.toStream(escaped, {
        pitch: settings.mozzaModeEnabled ? '+8%' : '+0Hz',
        rate: settings.mozzaModeEnabled ? '-4%' : (workReply ? '-12%' : '-6%'),
      });
      const audio = await buffer(addAbortSignal(deadline, audioStream));
      if (audio.length) {
        return { buffer: audio, mimeType: 'audio/mpeg', fileName: 'salma_reply.mp3' };
      }
    } catch (err) {
      if (attempt < 2 && !err?.message?.includes('offline')) {
        await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
        continue;
      }
      return null;
    } finally {
      try { tts.close(); } catch {}
    }
  }
  return null;
}

async function convertAudioToOpus(buf, isWav) {
  const args = isWav
    ? ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '48k', '-application', 'voip', '-f', 'ogg', 'pipe:1']
    : ['-hide_banner', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '48k', '-application', 'voip', '-f', 'ogg', 'pipe:1'];
  const encoder = spawn('ffmpeg', args, { windowsHide: true, signal: AbortSignal.timeout(5000), stdio: ['pipe', 'pipe', 'ignore'] });
  encoder.stdin.on('error', () => {});
  const result = Promise.all([buffer(encoder.stdout), once(encoder, 'close')]);
  encoder.stdin.end(buf);
  const [audio, [exitCode]] = await result;
  return exitCode === 0 && audio.length
    ? { buffer: audio, mimeType: 'audio/ogg', fileName: 'salma_reply.ogg' }
    : null;
}

function encodeGeminiAudio(data, mimeType) {
  if (typeof data !== 'string') return null;
  const isL16 = /^audio\/L16(?:;|$)/i.test(mimeType ?? '');
  const isWav = /^audio\/wav(?:;|$)/i.test(mimeType ?? '');
  if (!isL16 && !isWav) return null;
  const rawBytes = Buffer.from(data, 'base64');
  if (!rawBytes.length || rawBytes.length > 5 * 1024 * 1024) return null;
  return convertAudioToOpus(rawBytes, isWav);
}

async function synthesizeWithGemini(text, settings, apiKey, fetchImpl) {
  const delivery = settings.mozzaModeEnabled ? 'warm and relaxed' : 'calm, clear and professional';
  const prompt = [
    'Read the transcript verbatim in natural Egyptian Arabic, in an adult female voice.',
    `Use a ${delivery} tone at a measured conversational pace. Pause briefly between sentences.`,
    'Articulate each word and read every number, date, and unit in full. Leave a short pause after each sentence. Do not add words or read the directions aloud.',
    'Transcript:', text,
  ].join('\n');
  const urls = [GEMINI_TTS_URL, GEMINI_TTS_FALLBACK_URL];
  for (const url of urls) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voiceName || 'Aoede' } } },
          },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) {
        if (response.status === 404 && urls.length > 1 && url === urls[0]) continue;
        return null;
      }
      const data = await response.json();
      const audio = data?.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
      const res = await encodeGeminiAudio(audio?.data, audio?.mimeType);
      if (res) return res;
    } catch {
      continue;
    }
  }
  return null;
}

async function synthesizeWithGeminiPro(text, settings, apiKey, voice, fetchImpl) {
  const tone = settings.mozzaModeEnabled ? 'warm and conversational' : 'calm and professional';
  const style = 'Natural Cairene Egyptian Arabic with an adult female voice. ' +
    'Speak at a measured pace and clearly articulate every digit, date and currency unit. ' +
    'Use a ' + tone + ' tone.';
  // Reserve angle-bracket tags for the pauses inserted here.
  const transcript = text.replace(/</g, ' أقل من ').replace(/>/g, ' أكبر من ').replace(/\n/g, ' <short pause> ');
  const response = await fetchImpl(GEMINI_INTERACTIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model: GEMINI_PRO_VOICE_MODEL,
      store: false,
      input: [{
        type: 'user_input',
        content: [{ type: 'text', text: transcript, annotations: [{ type: 'speech_metadata', style }] }],
      }],
      response_format: { type: 'audio', mime_type: 'audio/l16', sample_rate: 24000 },
      generation_config: { speech_config: [{ voice: voice || settings.voiceName || 'Aoede' }] },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const result = await response.json();
  if (result?.status !== 'completed' || !Array.isArray(result.steps)) return null;
  const audio = result.steps
    .filter(step => step.type === 'model_output')
    .flatMap(step => step.content ?? [])
    .findLast(part => part.type === 'audio' && part.data);
  if ((audio?.sample_rate ?? 24000) !== 24000 || (audio?.channels ?? 1) !== 1) return null;
  return encodeGeminiAudio(audio?.data, audio?.mime_type);
}

export async function synthesizeArabicSpeech(rawText, {
  settings = {}, geminiApiKey = '', voiceProvider = '', geminiVoice = '',
  fetchImpl = fetch, createEdgeTts = options => new MsEdgeTTS(options),
} = {}) {
  const { text, workReply } = prepareSpeech(rawText);
  if (!text) return null;

  const voiceSettings = settings;
  const prefersGeminiPro = voiceProvider === GEMINI_PRO_VOICE_MODEL;
  if (prefersGeminiPro && geminiApiKey) {
    const audio = await synthesizeWithGeminiPro(text, voiceSettings, geminiApiKey, geminiVoice, fetchImpl).catch(() => null);
    if (audio) return audio;
  }
  // 1) إعطاء الأولوية دائماً لصوت Gemini قبل Edge TTS
  if (geminiApiKey && voiceProvider !== 'edge' && !prefersGeminiPro) {
    const geminiAudio = await synthesizeWithGemini(text, voiceSettings, geminiApiKey, fetchImpl).catch(() => null);
    if (geminiAudio) return geminiAudio;
    if (voiceSettings.onlyGeminiVoice) return null;
  }

  if (voiceSettings.onlyGeminiVoice) return null;

  // 2) محرك Edge TTS كبديل أو عند طلبه صراحة
  const edge = await synthesizeWithEdge(text, voiceSettings, createEdgeTts, workReply).catch(() => null);
  return edge;
}
