import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { createTelegramVoiceSender } from '../scripts/copilot-telegram-sender.mjs';
import { prepareSpeechText, synthesizeArabicSpeech } from '../scripts/copilot-voice.mjs';

test('narrates an expense in Egyptian sentences with the exact amount and draft status', () => {
  const spoken = prepareSpeechText([
    '✅ تمام يا باشمهندس، سجلتلك مسودة المصروف | العملية رقم [#101]',
    '🔢 رقم العملية للتعديل السريع: #101',
    '━━━━━━━━━━',
    '• البيان: نقل خامات',
    '• المبلغ الإجمالي: ١٬٥٠٠٫٢٥ ر.س',
    '• الفيلا / الموقع: فيلا ٦٥٧',
    '• الحالة: مسودة للمراجعة',
    '💡 لو حابب تعدل اكتب رقم العملية.',
  ].join('\n'));

  assert.equal(spoken, [
    'سجلتلك مصروف نقل خامات لفيلا ٦٥٧.',
    'المبلغ، ألف وخمسمية ريال سعودي، وخمسة وعشرين هللة.',
    'المصروف لسه مسودة.',
    'رقم العملية، 101.',
  ].join('\n'));
});

test('keeps negation and negative amounts, uses sentence pauses and expands unambiguous dates and units', () => {
  const spoken = prepareSpeechText('🚨 ما قدرتش أحفظ المصروف.\n-0.25 ر.س\nالمساحة 25 م² والتاريخ 2026-11-07\nالمرجع INV-2026-11-07\n[التفاصيل](https://example.invalid)');
  assert.match(spoken, /^ما قدرتش أحفظ المصروف\.\nناقص خمسة وعشرين هللة\./);
  assert.match(spoken, /متر مربع.*نوفمبر/);
  assert.match(spoken, /INV-2026-11-07/);
  assert.match(spoken, /\nالتفاصيل\.$/);
  assert.doesNotMatch(spoken, /https|🚨/);
});

test('speaks the date and confirmed report facts once, and distinguishes missing figures from zero', () => {
  const spoken = prepareSpeechText([
    '📊 اتفضل يا باشمهندس، ده التقرير اليومي المفصل الشامل — شركة الاختبار',
    '📊 التقرير اليومي المفصل الشامل — شركة الاختبار',
    '📅 ليوم: 2026-11-06 | الفلل: كل المشاريع والفلل',
    '1️⃣ العمالة اللي نزلت النهارده (0 يومية / 0 عامل):',
    '3️⃣ المصروفات المسجلة: غير متاح (راجع صلاحية المصروفات expenses أو المصدر).',
  ].join('\n'));
  assert.equal(spoken, [
    'ده ملخّص الشغل ليوم ستة نوفمبر ألفين وستة وعشرين.',
    'مفيش عمال اتسجلوا في اليوم ده.',
    'بيانات المصروفات مش متاحة.',
    'باقي التفاصيل في الرسالة.',
  ].join('\n'));
});

test('keeps nonnumeric operation references and does not infer an approval', () => {
  const spoken = prepareSpeechText([
    '🔨 تمام يا باشمهندس، سجلتلك أمر تشغيل جديد | العملية رقم [JO-2026-11-07]',
    '🔢 رقم العملية للتعديل السريع: JO-2026-11-07',
    '📦 البند: محارة',
    '💵 الإجمالي: 1,000 ر.س',
  ].join('\n'));
  assert.equal(spoken, 'سجلتلك أمر شغل محارة.\nالمبلغ، ألف ريال سعودي.\nرقم العملية، JO-2026-11-07.');
});

test('keeps the count, total and halalas distinct in the work voice even when the casual voice is enabled', async () => {
  const report = [
    '💖 عيوني ليك يا حبيبي! ده التقرير اليومي المفصل لكل الشغل النهارده',
    '📊 التقرير اليومي المفصل الشامل — شركة الاختبار',
    '📅 ليوم: 2026-11-08 | الفلل: كل المشاريع والفلل',
    '1️⃣ العمالة اللي نزلت النهارده (5 يومية / 5 عامل):',
    '3️⃣ المصروفات المسجلة النهارده (1 عملية بمبلغ إجمالي 1500.25 ر.س):',
  ].join('\n');
  let request;
  await synthesizeArabicSpeech(report, {
    settings: { mozzaModeEnabled: true },
    createEdgeTts: () => ({
      setMetadata() {},
      toStream: (...args) => {
        request = args;
        return { audioStream: Readable.from([Buffer.from('synthetic mp3 fixture')]) };
      },
      close() {},
    }),
  });

  assert.equal(request[0], [
    'ده ملخّص الشغل ليوم تمانية نوفمبر ألفين وستة وعشرين.',
    'اِتْسَجَّل خمسة عُمَّال.',
    'إجمالي المصروفات، ألف وَخُمْسُمِيَّة ريال سعودي، وخمسة وعشرين هَلَلَة.',
    'باقي التفاصيل في الرسالة.',
  ].join('\n'));
  assert.deepEqual(request[1], { pitch: '+8%', rate: '-4%' });
});

test('keeps precision and preserves currencies or ambiguous formats it cannot expand', () => {
  assert.equal(prepareSpeechText('۱۲۳٫۵ ر.س\n7.005 ر.س\n٥٠٠ جنيه مصري\nالمرجع EXP-500 ر.س'),
    'مية وتلاتة وعشرين ريال سعودي، وخمسين هللة.\n7.005 ريال سعودي.\n٥٠٠ جنيه مصري.\nالمرجع EXP-500 ريال سعودي.');
});

test('keeps the amount and reference audible even when an operation description exceeds the speech budget', () => {
  const spoken = prepareSpeechText([
    '✅ سجلتلك مسودة المصروف | العملية رقم [#101]',
    '🔢 رقم العملية للتعديل السريع: #101',
    '• البيان: ' + 'وصف عملية طويل '.repeat(35),
    '• المبلغ الإجمالي: 500.25 ر.س',
  ].join('\n'));
  assert.match(spoken, /المبلغ، خمسمية ريال سعودي، وخمسة وعشرين هللة\.\n/);
  assert.match(spoken, /\nرقم العملية، 101\./);
});

test('shortens speech only between complete sentences', () => {
  const result = prepareSpeechText('المصروف لسه مسودة.\n' + 'البيان '.repeat(70) + '500.25 ريال.');
  assert.equal(result, 'المصروف لسه مسودة.\nباقي التفاصيل في الرسالة.');
});

test('uses the original Edge MP3 with measured pacing and escapes text for SSML', async () => {
  let metadata;
  let request;
  let closed = false;
  const mp3 = Buffer.from('synthetic mp3 fixture');
  const audio = await synthesizeArabicSpeech('بنود A & B\nالتفاصيل جاهزة', {
    geminiApiKey: 'synthetic-key',
    voiceProvider: 'edge',
    fetchImpl: () => assert.fail('Gemini must not be used when Edge returns audio'),
    createEdgeTts: () => ({
      setMetadata: (...args) => { metadata = args; },
      toStream: (...args) => {
        request = args;
        return { audioStream: Readable.from([mp3]) };
      },
      close: () => { closed = true; },
    }),
  });

  assert.equal(metadata[0], 'ar-EG-SalmaNeural');
  assert.match(metadata[1], /96kbitrate-mono-mp3/);
  assert.equal(request[0], 'بنود A &amp; B.\nالتفاصيل جاهزة.');
  assert.deepEqual(request[1], { pitch: '+0Hz', rate: '-6%' });
  assert.deepEqual(audio, { buffer: mp3, mimeType: 'audio/mpeg', fileName: 'salma_reply.mp3' });
  assert.ok(closed);
});

test('when Edge fails, requests the configured fallback voice with verbatim delivery and never calls generic translation', async () => {
  const calls = [];
  let closed = false;
  const audio = await synthesizeArabicSpeech('الإجمالي 500 ريال', {
    settings: { voiceName: 'Leda' },
    geminiApiKey: 'synthetic-key',
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return Response.json({ error: 'unavailable' }, { status: 503 });
    },
    createEdgeTts: () => ({
      setMetadata: () => { throw new Error('offline'); },
      close: () => { closed = true; },
    }),
  });

  assert.equal(audio, null);
  assert.ok(closed);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
  assert.equal(calls[0].body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Leda');
  assert.match(calls[0].body.contents[0].parts[0].text, /verbatim[\s\S]*Transcript:\nالإجمالي 500 ريال\.$/);
});

test('tries the opt-in Gemini speech API first and falls back instead of sending incomplete audio', async () => {
  const calls = [];
  const edgeAudio = Buffer.from('synthetic edge audio');
  const audio = await synthesizeArabicSpeech('إجمالي المصروفات 500.25 ر.س\nرقم العملية 101', {
    geminiApiKey: 'synthetic-key',
    voiceProvider: 'gemini-3.8-flash-tts',
    geminiVoice: 'voice_example',
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return Response.json({
        status: 'incomplete',
        steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/l16', data: 'AAAA' }] }],
      });
    },
    createEdgeTts: () => {
      calls.push('edge');
      return {
        setMetadata() {},
        toStream: () => ({ audioStream: Readable.from([edgeAudio]) }),
        close() {},
      };
    },
  });

  assert.equal(calls.length, 2);
  const [request, fallback] = calls;
  assert.match(request.url, /\/v1beta\/interactions$/);
  assert.equal(request.body.model, 'gemini-3.8-flash-tts');
  assert.equal(request.body.store, false);
  assert.deepEqual(request.body.response_format, { type: 'audio', mime_type: 'audio/l16', sample_rate: 24000 });
  assert.deepEqual(request.body.generation_config.speech_config, [{ voice: 'voice_example' }]);
  const [speech] = request.body.input[0].content;
  assert.match(speech.annotations[0].style, /Cairene Egyptian Arabic/);
  assert.equal(speech.text, 'إجمالي المصروفات خمسمية ريال سعودي، وخمسة وعشرين هللة. <short pause> رقم العملية 101.');
  assert.equal(fallback, 'edge');
  assert.deepEqual(audio.buffer, edgeAudio);
});

test('uploads each supported voice format with its real name and MIME type as a threaded reply', async () => {
  const files = [];
  const send = createTelegramVoiceSender({
    botToken: 'synthetic-token',
    fetchImpl: async (url, { body }) => {
      assert.ok(url.endsWith('/sendVoice'));
      assert.equal(body.get('chat_id'), '123');
      assert.deepEqual(JSON.parse(body.get('reply_parameters')), {
        message_id: 22, allow_sending_without_reply: true,
      });
      const file = body.get('voice');
      files.push([file.name, file.type, await file.text()]);
      return Response.json({ ok: files.length === 1 });
    },
  });
  assert.equal(await send(123, { buffer: Buffer.from('mp3'), mimeType: 'audio/mpeg', fileName: 'reply.mp3' }, 22), true);
  assert.equal(await send(123, { buffer: Buffer.from('opus'), mimeType: 'audio/ogg', fileName: 'reply.ogg' }, 22), false);
  assert.deepEqual(files, [['reply.mp3', 'audio/mpeg', 'mp3'], ['reply.ogg', 'audio/ogg', 'opus']]);
});
