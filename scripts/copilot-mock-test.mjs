/**
 * copilot-mock-test.mjs
 * Mock test للـ receive loop الكاملة بدون بوت حي
 * تشغيل: node scripts/copilot-mock-test.mjs
 */

import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isAuthorizedTelegramUpdate } from './copilot-telegram-auth.mjs';
import { createCopilotEntryForms } from './copilot-entry-forms.mjs';
import { createTelegramMessageSender } from './copilot-telegram-sender.mjs';
import { createCopilotConversation } from './copilot-conversation.mjs';
import { createCopilotTrainingProposals } from './copilot-training-proposals.mjs';

// ─── Test Runner ───────────────────────────────────────────────────────────────
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ ok: true, name });
    process.stdout.write(`✅ ${name}\n`);
  } catch (err) {
    results.push({ ok: false, name, error: err.message });
    process.stderr.write(`❌ ${name}\n   → ${err.message}\n`);
  }
}

function summary() {
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const total = results.length;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`النتيجة: ${passed}/${total} اختبارات نجحت${failed > 0 ? ` — ${failed} فشلت` : ' ✅'}`);
  if (failed > 0) process.exit(1);
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const AUTHORIZED_ID = 123456789;
const OTHER_ID      = 999999999;

function makeUpdate(chatId, fromId, text, { edited = false } = {}) {
  const msg = {
    message_id: Math.floor(Math.random() * 9999) + 1,
    chat: { type: 'private', id: chatId },
    from: { id: fromId, is_bot: false },
    text,
  };
  return edited ? { edited_message: msg } : { message: msg };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. AUTH — isAuthorizedTelegramUpdate
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── 1. Auth ──────────────────────────────────────────────────────');

await test('رسالة private من الـ chatId المصرح → مقبولة', () => {
  const update = makeUpdate(AUTHORIZED_ID, AUTHORIZED_ID, 'مرحبا');
  assert.equal(isAuthorizedTelegramUpdate(update, AUTHORIZED_ID), true);
});

await test('رسالة من chatId غير مصرح → مرفوضة', () => {
  const update = makeUpdate(OTHER_ID, OTHER_ID, 'مرحبا');
  assert.equal(isAuthorizedTelegramUpdate(update, AUTHORIZED_ID), false);
});

await test('edited_message → مرفوضة دايمًا', () => {
  const update = makeUpdate(AUTHORIZED_ID, AUTHORIZED_ID, 'تعديل', { edited: true });
  assert.equal(isAuthorizedTelegramUpdate(update, AUTHORIZED_ID), false);
});

await test('رسالة جروب (مش private) → مرفوضة', () => {
  const update = {
    message: {
      message_id: 1,
      chat: { type: 'group', id: -100123456 },
      from: { id: AUTHORIZED_ID, is_bot: false },
      text: 'مرحبا',
    },
  };
  assert.equal(isAuthorizedTelegramUpdate(update, AUTHORIZED_ID), false);
});

await test('chatId صفر أو سالب → مرفوض', () => {
  assert.equal(isAuthorizedTelegramUpdate(makeUpdate(0, 0, 'test'), 0), false);
  assert.equal(isAuthorizedTelegramUpdate(makeUpdate(-1, -1, 'test'), -1), false);
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. ENTRY FORMS — createCopilotEntryForms
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── 2. Entry Forms ───────────────────────────────────────────────');

await test('/add expense يبدأ جلسة ويظهر خطوة 1 من X', () => {
  const forms = createCopilotEntryForms({ now: () => Date.now() });
  const res = forms.handle({ chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID }, '/add expense');
  assert.ok(res, 'يجب أن يرجع رد');
  assert.ok(res.text.includes('مصروف'), 'يذكر نوع العملية');
  assert.match(res.text, /خطوة 1 من \d+/, 'يظهر العداد مع الإجمالي');
});

await test('الخطوة الثانية بعد إدخال التاريخ → خطوة 2 من X', () => {
  const forms = createCopilotEntryForms({ now: () => Date.now() });
  const ctx = { chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID };
  forms.handle(ctx, '/add expense');
  const res = forms.handle(ctx, '2026-01-15');
  assert.match(res.text, /خطوة 2 من \d+/, 'العداد يتقدم بعد إدخال التاريخ');
});

await test('/cancel يلغي الجلسة ويرجع تأكيد', () => {
  const forms = createCopilotEntryForms({ now: () => Date.now() });
  const ctx = { chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID };
  forms.handle(ctx, '/add expense');
  const res = forms.handle(ctx, '/cancel');
  assert.ok(res.text.includes('ألغيت'), 'يؤكد الإلغاء');
  // بعد الإلغاء: /resume يقول مفيش جلسة
  const after = forms.handle(ctx, '/resume');
  assert.ok(after.text.includes('مفيش معاينة'), 'الجلسة اتمسحت');
});

await test('رسالة عادية (مش /add) → null (يروح للـ AI)', () => {
  const forms = createCopilotEntryForms({ now: () => Date.now() });
  const res = forms.handle({ chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID }, 'ما هو رصيد المشروع؟');
  assert.equal(res, null, 'يجب أن يُعاد للـ AI');
});

await test('فتح جلسة جديدة وفيه جلسة قديمة → يطلب إغلاقها أولاً', () => {
  const forms = createCopilotEntryForms({ now: () => Date.now() });
  const ctx = { chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID };
  forms.handle(ctx, '/add expense');
  const res = forms.handle(ctx, '/add receipt');
  assert.ok(res.text.includes('فيه معاينة مفتوحة'), 'يرفض فتح جلسة ثانية');
});

await test('TTL منتهي → تلقائيًا يمسح الجلسة', () => {
  let now = Date.now();
  const forms = createCopilotEntryForms({ now: () => now });
  const ctx = { chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID };
  forms.handle(ctx, '/add expense');
  now += 21 * 60 * 1000; // +21 دقيقة (بعد الـ TTL)
  const res = forms.handle(ctx, 'إجابة ما بعد الـ TTL');
  assert.ok(res.text.includes('انتهت مدة المعاينة'), 'يخبر أن المدة انتهت');
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. TELEGRAM SENDER — createTelegramMessageSender
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── 3. Telegram Sender ───────────────────────────────────────────');

await test('رسالة قصيرة → تُرسل في call واحد', async () => {
  const sent = [];
  const mockFetch = async (_url, opts) => {
    sent.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ ok: true, result: { message_id: sent.length } }) };
  };
  const send = createTelegramMessageSender({ botToken: 'mock-token', fetchImpl: mockFetch });
  const result = await send(AUTHORIZED_ID, 'مرحبا بك في فاي تك');
  assert.equal(result.ok, true);
  assert.equal(sent.length, 1, 'رسالة واحدة فقط');
  assert.equal(result.messageIds.length, 1);
});

await test('رسالة أطول من 3900 حرف → تنقسم لأكثر من رسالة', async () => {
  const sent = [];
  let msgId = 0;
  const mockFetch = async (_url, opts) => {
    sent.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ ok: true, result: { message_id: ++msgId } }) };
  };
  const send = createTelegramMessageSender({ botToken: 'mock-token', fetchImpl: mockFetch });
  const longText = 'سطر طويل جداً\n'.repeat(300); // ~4500 حرف
  const result = await send(AUTHORIZED_ID, longText, null, { html: false });
  assert.equal(result.ok, true);
  assert.ok(sent.length > 1, `يجب أن تنقسم — جاءت ${sent.length} رسائل`);
});

await test('فشل الـ API → ok: false', async () => {
  const mockFetch = async () => ({
    ok: false,
    json: async () => ({ ok: false, error_code: 400, description: 'Bad Request' }),
  });
  const send = createTelegramMessageSender({ botToken: 'mock-token', fetchImpl: mockFetch });
  const result = await send(AUTHORIZED_ID, 'رسالة');
  assert.equal(result.ok, false);
  assert.equal(result.messageIds.length, 0);
});

await test('نص فاضي → ok: false بدون call للـ API', async () => {
  let called = false;
  const mockFetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const send = createTelegramMessageSender({ botToken: 'mock-token', fetchImpl: mockFetch });
  const result = await send(AUTHORIZED_ID, '   ');
  assert.equal(result.ok, false);
  assert.equal(called, false, 'ما يتصلش بالـ API لو النص فاضي');
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. CONVERSATION — createCopilotConversation
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── 4. Conversation ──────────────────────────────────────────────');

await test('scope مختلف → سياق جديد فاضي', () => {
  const conv = createCopilotConversation({ maxTurns: 6 });
  conv.remember({
    chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID, scope: 'scope-A',
    userMessageId: 1, botMessageIds: [2], parentMessageId: null,
    userText: 'سؤال أول', modelText: 'جواب أول',
  });
  const ctx = conv.getContext({ chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID, scope: 'scope-B' });
  assert.equal(ctx.contents.length, 0, 'scope مختلف يبدأ من الصفر');
});

await test('نفس الـ scope → يرجع السياق', () => {
  const conv = createCopilotConversation({ maxTurns: 6 });
  conv.remember({
    chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID, scope: 'scope-A',
    userMessageId: 1, botMessageIds: [2], parentMessageId: null,
    userText: 'سؤال أول', modelText: 'جواب أول',
  });
  const ctx = conv.getContext({ chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID, scope: 'scope-A' });
  assert.equal(ctx.contents.length, 2, 'user turn + model turn');
});

await test('clear → السياق يتمسح', () => {
  const conv = createCopilotConversation({ maxTurns: 6 });
  conv.remember({
    chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID, scope: 'scope-A',
    userMessageId: 1, botMessageIds: [2], parentMessageId: null,
    userText: 'سؤال', modelText: 'جواب',
  });
  conv.clear({ chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID });
  const ctx = conv.getContext({ chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID, scope: 'scope-A' });
  assert.equal(ctx.contents.length, 0, 'بعد clear السياق فاضي');
});

await test('TTL منتهي → يتمسح تلقائيًا', () => {
  let now = Date.now();
  const conv = createCopilotConversation({ maxTurns: 6, ttlMs: 1000, now: () => now });
  conv.remember({
    chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID, scope: 'scope-A',
    userMessageId: 1, botMessageIds: [2], parentMessageId: null,
    userText: 'سؤال', modelText: 'جواب',
  });
  now += 2000; // بعد الـ TTL
  const ctx = conv.getContext({ chatId: AUTHORIZED_ID, userId: AUTHORIZED_ID, scope: 'scope-A' });
  assert.equal(ctx.contents.length, 0, 'بعد TTL السياق يتمسح');
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. TRAINING PROPOSALS — منع التكرار
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── 5. Training Proposals ────────────────────────────────────────');

await test('submit مقترح جديد → ينجح ويرجع proposal', () => {
  const filePath = join(tmpdir(), `phi-proposals-${Date.now()}-a.json`);
  const proposals = createCopilotTrainingProposals(filePath);
  const p = proposals.submit({ text: 'مقترح تجريبي فريد', telegramUserId: AUTHORIZED_ID });
  assert.ok(p.id, 'يرجع proposal بـ id');
  assert.equal(p.status, 'pending');
});

await test('تكرار نفس النص من نفس المستخدم → خطأ DUPLICATE', () => {
  const filePath = join(tmpdir(), `phi-proposals-${Date.now()}-b.json`);
  const proposals = createCopilotTrainingProposals(filePath);
  proposals.submit({ text: 'مقترح مكرر للاختبار', telegramUserId: AUTHORIZED_ID });
  assert.throws(
    () => proposals.submit({ text: 'مقترح مكرر للاختبار', telegramUserId: AUTHORIZED_ID }),
    err => err.code === 'COPILOT_PROPOSAL_DUPLICATE',
    'يجب أن يرفض المقترح المكرر'
  );
});

await test('نفس النص من مستخدم مختلف → مقبول', () => {
  const filePath = join(tmpdir(), `phi-proposals-${Date.now()}-c.json`);
  const proposals = createCopilotTrainingProposals(filePath);
  proposals.submit({ text: 'مقترح مشترك', telegramUserId: AUTHORIZED_ID });
  const p2 = proposals.submit({ text: 'مقترح مشترك', telegramUserId: 987654321 });
  assert.ok(p2.id, 'مستخدم مختلف يقدر يضيف نفس النص');
});

await test('withdraw مقترح موجود → true والقائمة بتتقلص', () => {
  const filePath = join(tmpdir(), `phi-proposals-${Date.now()}-d.json`);
  const proposals = createCopilotTrainingProposals(filePath);
  const p = proposals.submit({ text: 'مقترح للسحب', telegramUserId: AUTHORIZED_ID });
  const removed = proposals.withdraw(p.id, AUTHORIZED_ID);
  assert.equal(removed, true);
  const list = proposals.list(AUTHORIZED_ID);
  assert.equal(list.length, 0, 'القائمة فاضية بعد السحب');
});

await test('withdraw بـ id مش موجود → false', () => {
  const filePath = join(tmpdir(), `phi-proposals-${Date.now()}-e.json`);
  const proposals = createCopilotTrainingProposals(filePath);
  const removed = proposals.withdraw('00000000-0000-0000-0000-000000000000', AUTHORIZED_ID);
  assert.equal(removed, false);
});

await test('نص فيه credential → يترفض', () => {
  const filePath = join(tmpdir(), `phi-proposals-${Date.now()}-f.json`);
  const proposals = createCopilotTrainingProposals(filePath);
  assert.throws(
    () => proposals.submit({ text: 'مفتاحي هو sk-abcdefghijklmnopqrstuvwx', telegramUserId: AUTHORIZED_ID }),
    err => err.code === 'COPILOT_PROPOSAL_SENSITIVE_TEXT',
    'يجب رفض النصوص التي تحتوي على credentials'
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════
// ─── إرسال المستندات: sent / failed / uncertain ───────────────────────────────
console.log('\n📎 Telegram document sender');
{
  const { createTelegramDocumentSender } = await import('./copilot-telegram-sender.mjs');
  const pdf = Buffer.from('%PDF-1.4 test');
  const sender = (handlers, extra = {}) => {
    let calls = 0;
    const send = createTelegramDocumentSender({
      botToken: 'test-token', sleep: async () => {}, ...extra,
      fetchImpl: async () => { const handler = handlers[Math.min(calls, handlers.length - 1)]; calls++; return handler(); },
    });
    return { send: () => send(1, pdf, 'a.pdf', 'cap', 2), calls: () => calls };
  };
  const json = (status, body) => () => new Response(JSON.stringify(body), { status });
  const netError = code => () => { const error = new TypeError('fetch failed'); error.cause = { code }; throw error; };

  await test('رد ok:true صريح → sent', async () => {
    assert.deepEqual(await sender([json(200, { ok: true, result: {} })]).send(), { status: 'sent' });
  });
  await test('رفض صريح 400 ok:false → failed', async () => {
    assert.equal((await sender([json(400, { ok: false, error_code: 400 })]).send()).status, 'failed');
  });
  await test('429 قصير → انتظار ومحاولة واحدة → sent', async () => {
    const s = sender([json(429, { ok: false, error_code: 429, parameters: { retry_after: 3 } }), json(200, { ok: true })]);
    assert.equal((await s.send()).status, 'sent');
    assert.equal(s.calls(), 2);
  });
  await test('429 طويل → failed مع retryAfter ومن غير إعادة', async () => {
    const s = sender([json(429, { ok: false, error_code: 429, parameters: { retry_after: 30 } })]);
    assert.deepEqual(await s.send(), { status: 'failed', retryAfter: 30 });
    assert.equal(s.calls(), 1);
  });
  await test('timeout أثناء الإرسال → uncertain (مفيش إعادة)', async () => {
    const s = sender([() => { throw new DOMException('timed out', 'TimeoutError'); }]);
    assert.equal((await s.send()).status, 'uncertain');
    assert.equal(s.calls(), 1);
  });
  await test('502 من البوابة → uncertain', async () => {
    assert.equal((await sender([() => new Response('bad gateway', { status: 502 })]).send()).status, 'uncertain');
  });
  await test('DNS/اتصال مرفوض قبل الإرسال → failed', async () => {
    assert.equal((await sender([netError('ENOTFOUND')]).send()).status, 'failed');
    assert.equal((await sender([netError('ECONNRESET')]).send()).status, 'uncertain');
  });
}

// ─── السجل الدائم لطلبات الـ PDF ──────────────────────────────────────────────
console.log('\n🗂️ PDF request log');
{
  const fsm = await import('node:fs');
  const { createPdfRequestLog } = await import('./copilot-pdf-requests.mjs');
  const dir = fsm.mkdtempSync(join(tmpdir(), 'copilot-pdf-log-'));
  const file = join(dir, 'copilot-pdf-requests.json');
  const actor = { chatId: 10, userId: 20 };
  const request = { type: 'worker_statement', params: { workerName: 'عامل اصطناعي', startDate: '2026-10-01', endDate: '2026-10-07' } };

  await test('sending بيتكتب على الديسك قبل الاتصال، وبيتحول uncertain بعد إعادة التشغيل', () => {
    const log = createPdfRequestLog({ filePath: file });
    const started = log.begin(actor, request);
    assert.equal(started.ok, true);
    assert.equal(log.mark(started.id, 'sending'), true);
    const onDisk = JSON.parse(fsm.readFileSync(file, 'utf8')).records.at(-1);
    assert.equal(onDisk.status, 'sending');
    // "crash" → new process reads the same file
    const restarted = createPdfRequestLog({ filePath: file });
    assert.equal(restarted.recoverInterrupted(), 1);
    assert.equal(restarted.get(started.id).status, 'uncertain');
    assert.equal(restarted.begin(actor, request).reason, 'uncertain');
    assert.ok(restarted.resolve(actor, started.id.slice(0, 8)));
    assert.equal(restarted.begin(actor, request).ok, true);
  });
  await test('السجل مافيهوش اسم العامل ولا معاملات التقرير', () => {
    const text = fsm.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /عامل اصطناعي|2026-10-01|workerName|params/);
  });
  await test('ملف سجل تالف → unavailable ومايتكتبش فوقه', () => {
    const bad = join(dir, 'bad.json');
    fsm.writeFileSync(bad, '{ broken', 'utf8');
    const log = createPdfRequestLog({ filePath: bad });
    assert.equal(log.available, false);
    assert.equal(log.begin(actor, request).reason, 'unavailable');
    assert.equal(fsm.readFileSync(bad, 'utf8'), '{ broken');
  });
  await test('التقليم بيحتفظ بالمحاولات غير المحسومة', () => {
    const log = createPdfRequestLog({ maxRecords: 3 });
    const first = log.begin(actor, request);
    log.mark(first.id, 'sending'); log.mark(first.id, 'uncertain');
    for (let i = 0; i < 6; i++) {
      const other = log.begin({ chatId: 10, userId: 30 + i }, request);
      log.mark(other.id, 'sent');
    }
    assert.equal(log.list().length, 3);
    assert.equal(log.get(first.id)?.status, 'uncertain');
  });
}

// ─── سجل الأدوات ──────────────────────────────────────────────────────────────
console.log('\n🧭 Tool registry');
{
  const { TOOL_REGISTRY, RETIRED_TOOL_NAMES, DECLARED_TOOLS } = await import('./copilot-tool-registry.mjs');
  const { FUNCTION_DECLARATIONS } = await import('./copilot-prompt.mjs');
  const { createCopilotTools } = await import('./copilot-tools.mjs');
  let requests = 0;
  const tools = createCopilotTools({ fetchImpl: async () => { requests++; return Response.json([]); } });

  await test('كل أداة في createCopilotTools متسجلة، وكل أداة متسجلة ليها تنفيذ', () => {
    const names = new Set(TOOL_REGISTRY.map(entry => entry.name));
    for (const name of Object.keys(tools)) assert.ok(names.has(name), 'مش متسجلة: ' + name);
    for (const name of names) assert.equal(typeof tools[name], 'function', 'مالهاش تنفيذ: ' + name);
  });
  await test('الأدوات المتوقفة بترفض ومابتعملش أي طلب', async () => {
    for (const name of RETIRED_TOOL_NAMES) assert.equal((await tools[name]({ search_query: 'x', chatId: 1 })).success, false);
    assert.equal(requests, 0);
  });
  await test('تعريفات Gemini = الأدوات active/pilot في السجل بس', () => {
    assert.deepEqual(FUNCTION_DECLARATIONS.map(d => d.name), DECLARED_TOOLS.map(d => d.name));
    assert.ok(FUNCTION_DECLARATIONS.every(d => !RETIRED_TOOL_NAMES.includes(d.name)));
    assert.ok(!FUNCTION_DECLARATIONS.some(d => d.name === 'get_worker_month_statement'));
  });
}

summary();
