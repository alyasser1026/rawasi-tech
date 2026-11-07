import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { addAbortSignal } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { egyptianNumberWords, formatEgyptianRiyals } from './copilot-spoken-money.mjs';

const GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';
const MAX_SPEECH_LENGTH = 380;
const DETAILS_IN_TEXT = 'باقي التفاصيل في الرسالة.';
const sentenceSegmenter = new Intl.Segmenter('ar-EG', { granularity: 'sentence' });
const spokenMonth = new Intl.DateTimeFormat('ar-EG', { month: 'long', timeZone: 'UTC' });

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
  const value = amount ? '، بمبلغ ' + amount : (wage ? '، بأجر يومي ' + wage : '');
  const state = isDraft ? subject + ' لسه مسودة'
    : (status ? subject + ' حالته ' + status : '');
  return [
    intro + (detail ? ' ' + detail : '') + where + value,
    state ? state + '، ورقم العملية ' + reference : 'رقم العملية ' + reference,
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
    amount ? 'المصروفات كانت ' + amount : (expenses?.includes('غير متاح') ? 'بيانات المصروفات مش متاحة' : ''),
  ].filter(Boolean);
  return [
    'ده ملخّص الشغل' + (date ? ' ليوم ' + date : ''),
    ...(facts.length ? [facts.join('، و')] : []),
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

async function synthesizeWithEdge(text, settings, createEdgeTts) {
  const tts = createEdgeTts({ connectionTimeoutMs: 4500, synthesisTimeoutMs: 6000 });
  const deadline = AbortSignal.timeout(10000);
  try {
    await tts.setMetadata('ar-EG-SalmaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const escaped = text.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
    const { audioStream } = tts.toStream(escaped, {
      pitch: settings.mozzaModeEnabled ? '+8%' : '+0Hz',
      rate: settings.mozzaModeEnabled ? '-4%' : '-6%',
    });
    const audio = await buffer(addAbortSignal(deadline, audioStream));
    return audio.length ? { buffer: audio, mimeType: 'audio/mpeg', fileName: 'salma_reply.mp3' } : null;
  } finally {
    tts.close();
  }
}

async function convertPcmToOpus(pcm) {
  const encoder = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1',
    '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '48k', '-application', 'voip', '-f', 'ogg', 'pipe:1',
  ], { windowsHide: true, signal: AbortSignal.timeout(5000), stdio: ['pipe', 'pipe', 'ignore'] });
  encoder.stdin.on('error', () => {});
  const result = Promise.all([buffer(encoder.stdout), once(encoder, 'close')]);
  encoder.stdin.end(pcm);
  const [audio, [exitCode]] = await result;
  return exitCode === 0 && audio.length
    ? { buffer: audio, mimeType: 'audio/ogg', fileName: 'salma_reply.ogg' }
    : null;
}

async function synthesizeWithGemini(text, settings, apiKey, fetchImpl) {
  const delivery = settings.mozzaModeEnabled ? 'warm and relaxed' : 'calm, clear and professional';
  const prompt = [
    'Read the transcript verbatim in natural Egyptian Arabic, in an adult female voice.',
    `Use a ${delivery} tone at a measured conversational pace. Pause briefly between sentences.`,
    'Read numbers, dates, and currencies accurately. Do not add words or read the directions aloud.',
    'Transcript:', text,
  ].join('\n');
  const response = await fetchImpl(GEMINI_TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voiceName || 'Aoede' } } },
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const audio = data?.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
  if (!/^audio\/L16(?:;|$)/i.test(audio?.mimeType ?? '')) return null;
  const pcm = Buffer.from(audio.data, 'base64');
  if (!pcm.length || pcm.length % 2 !== 0 || pcm.length > 5 * 1024 * 1024) return null;
  return convertPcmToOpus(pcm);
}

export async function synthesizeArabicSpeech(rawText, {
  settings = {}, geminiApiKey = '', fetchImpl = fetch, createEdgeTts = options => new MsEdgeTTS(options),
} = {}) {
  const { text, workReply } = prepareSpeech(rawText);
  if (!text) return null;

  const voiceSettings = workReply ? { ...settings, mozzaModeEnabled: false } : settings;
  const edge = await synthesizeWithEdge(text, voiceSettings, createEdgeTts).catch(() => null);
  if (edge) return edge;
  if (!geminiApiKey) return null;
  return synthesizeWithGemini(text, voiceSettings, geminiApiKey, fetchImpl).catch(() => null);
}
