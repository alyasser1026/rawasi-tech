// node scripts/copilot-write-confirm.test.mjs — تأكيد الكتابة بخطوتين + سياق الأسماء.
import assert from 'node:assert/strict';
import {
  createPendingWrites, isWriteCall, freezeCalls, formatConfirmationText, formatCallSummary,
  buildConfirmMarkup, resolveConfirmCallback, WRITE_TOOL_NAMES, CONFIRM_STATUS_MESSAGES,
} from './copilot-write-confirm.mjs';
import { createCopilotConversation, extractEntities } from './copilot-conversation.mjs';

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; };
const CO = '72918f4d-10c3-43a0-884e-2f84f1224335';
const expense = () => ({ name: 'add_expense_draft', args: { description: 'نقل رمل', total_price: 500, site_ref: 'فيلا 12', exp_date: 'today' } });
const labor = (n) => ({ name: 'add_labor_daily_log_draft', args: { worker_name: n, daily_wage: 200, site_ref: 'فيلا 5' } });
let seq = 0;
const ids = () => (++seq).toString(16).padStart(16, '0');

await test('write tool classification', () => {
  for (const n of ['add_labor_daily_log_draft', 'add_expense_draft', 'add_payment_voucher_draft', 'add_journal_entry_draft', 'add_job_order_draft', 'add_partner', 'update_operation_draft']) {
    assert.ok(isWriteCall({ name: n }), n);
  }
  for (const n of ['get_daily_comprehensive_report', 'get_labor_daily_logs', 'switch_company', 'get_proactive_alert_data']) assert.equal(isWriteCall({ name: n }), false, n);
  assert.equal(WRITE_TOOL_NAMES.size, 7);
});

await test('nothing executes on create; confirm once only (double press)', () => {
  const pw = createPendingWrites({ newId: ids });
  const e = pw.create({ chatId: 10, userId: 7, companyId: CO, calls: [expense()] });
  assert.equal(pw.size(), 1);
  const first = pw.take({ id: e.id, chatId: 10, userId: 7 });
  assert.equal(first.status, 'ok');
  assert.equal(first.entry.calls[0].args.total_price, 500);
  const second = pw.take({ id: e.id, chatId: 10, userId: 7 });
  assert.equal(second.status, 'done');
  assert.ok(CONFIRM_STATUS_MESSAGES.done);
});

await test('another user cannot confirm or cancel, and does not consume it', () => {
  const pw = createPendingWrites({ newId: ids });
  const e = pw.create({ chatId: -100123, userId: 7, companyId: CO, calls: [expense()] });
  assert.equal(pw.take({ id: e.id, chatId: -100123, userId: 8 }).status, 'wrong_user');
  assert.equal(pw.cancel({ id: e.id, chatId: -100123, userId: 8 }).status, 'wrong_user');
  assert.equal(pw.take({ id: e.id, chatId: 555, userId: 7 }).status, 'wrong_user', 'same user, other chat');
  assert.equal(pw.take({ id: e.id, chatId: -100123, userId: 7 }).status, 'ok', 'owner still can');
});

await test('expired confirmation is rejected and cleared', () => {
  let t = 1_000_000;
  const pw = createPendingWrites({ ttlMs: 60_000, now: () => t, newId: ids });
  const e = pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [expense()] });
  t += 60_000;
  assert.equal(pw.take({ id: e.id, chatId: 1, userId: 2 }).status, 'expired');
  assert.equal(pw.take({ id: e.id, chatId: 1, userId: 2 }).status, 'expired');
  assert.equal(pw.size(), 0);
});

await test('a new proposal (edit after display) supersedes the old one', () => {
  const pw = createPendingWrites({ newId: ids });
  const a = pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [expense()] });
  const edited = expense(); edited.args.total_price = 450;
  const b = pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [edited] });
  assert.equal(pw.take({ id: a.id, chatId: 1, userId: 2 }).status, 'superseded');
  const ok = pw.take({ id: b.id, chatId: 1, userId: 2 });
  assert.equal(ok.entry.calls[0].args.total_price, 450);
  // مستخدم تاني في نفس الجروب ما بيلغيش طلب الأول
  const c = pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [expense()] });
  pw.create({ chatId: 1, userId: 3, companyId: CO, calls: [expense()] });
  assert.equal(pw.take({ id: c.id, chatId: 1, userId: 2 }).status, 'ok');
});

await test('executed values are exactly the displayed values (frozen copy)', () => {
  const pw = createPendingWrites({ newId: ids });
  const call = expense();
  const e = pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [call] });
  const shown = formatConfirmationText(e.calls);
  call.args.total_price = 99999; // تعديل الكائن الأصلي بعد العرض
  assert.throws(() => { e.calls[0].args.total_price = 1; });
  const got = pw.take({ id: e.id, chatId: 1, userId: 2 }).entry;
  assert.equal(got.calls[0].args.total_price, 500);
  assert.ok(shown.includes('500') && !shown.includes('99,999'));
  assert.equal(got.companyId, CO);
});

await test('cancel works once and blocks later confirm', () => {
  const pw = createPendingWrites({ newId: ids });
  const e = pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [expense()] });
  assert.equal(pw.cancel({ id: e.id, chatId: 1, userId: 2 }).status, 'ok');
  assert.equal(pw.take({ id: e.id, chatId: 1, userId: 2 }).status, 'cancelled');
});

await test('create rejects reads, missing user/company, and channel posts', () => {
  const pw = createPendingWrites({ newId: ids });
  assert.throws(() => pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [{ name: 'get_labor_daily_logs', args: {} }] }));
  assert.throws(() => pw.create({ chatId: 1, userId: 0, companyId: CO, calls: [expense()] }));
  assert.throws(() => pw.create({ chatId: 1, userId: 2, companyId: '', calls: [expense()] }));
  assert.throws(() => pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [] }));
});

await test('batch: one confirmation lists every operation', () => {
  const pw = createPendingWrites({ newId: ids });
  const e = pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [labor('محمد'), labor('أحمد'), expense()] });
  const text = formatConfirmationText(e.calls, { companyLabel: 'فاي تك' });
  assert.ok(text.includes('3 عمليات') && text.includes('محمد') && text.includes('أحمد') && text.includes('نقل رمل'));
  assert.ok(text.includes('1)') && text.includes('3)'));
  assert.ok(formatCallSummary({ name: 'add_partner', args: {} }).includes('من غير تفاصيل'));
});

await test('callback data strict and within Telegram limit', () => {
  const m = buildConfirmMarkup('0123456789abcdef');
  for (const b of m.inline_keyboard.flat()) assert.ok(Buffer.byteLength(b.callback_data) <= 64);
  assert.deepEqual(resolveConfirmCallback('cfm:y:0123456789abcdef'), { action: 'confirm', id: '0123456789abcdef' });
  assert.deepEqual(resolveConfirmCallback('cfm:n:0123456789abcdef'), { action: 'cancel', id: '0123456789abcdef' });
  assert.equal(resolveConfirmCallback('cfm:y:../../x'), null);
  assert.equal(resolveConfirmCallback('cfm:y:0123456789ABCDEF'), null);
  assert.equal(resolveConfirmCallback('cfm:x:0123456789abcdef'), null);
});

await test('default ids are random 16-hex', () => {
  const pw = createPendingWrites();
  const e = pw.create({ chatId: 1, userId: 2, companyId: CO, calls: [expense()] });
  assert.match(e.id, /^[0-9a-f]{16}$/);
  assert.ok(freezeCalls([expense()])[0].args.description);
});

await test('entities: names and dates only, no amounts or IDs', () => {
  const ents = extractEntities([{ name: 'add_partner', args: { name: 'أحمد علي', identity_number: '1234567890', daily_wage: 250, phone: '0500000000' } },
    { name: 'get_daily_comprehensive_report', args: { villa_filter: 'فيلا 12', date: '2026-11-10' } }]);
  assert.deepEqual(ents, ['الاسم: أحمد علي', 'الفيلا/المشروع: فيلا 12', 'التاريخ: 2026-11-10']);
  assert.ok(!ents.join(' ').includes('1234567890') && !ents.join(' ').includes('250'));
  assert.deepEqual(extractEntities({ args: { contractor_name: 'x'.repeat(200) } }), [], 'overlong dropped');
});

await test('follow-up context carries the names into the next model turn', () => {
  const conv = createCopilotConversation();
  const ok = conv.remember({
    chatId: 1, userId: 2, scope: 's', userMessageId: 11, botMessageIds: [12],
    userText: 'أوامر شغل المقاول أحمد', toolName: 'get_daily_comprehensive_report',
    entities: extractEntities({ args: { contractor_name: 'أحمد', villa_filter: 'فيلا 9' } }),
  });
  assert.equal(ok, true);
  const ctx = conv.getContext({ chatId: 1, userId: 2, scope: 's' });
  const modelText = ctx.contents.find(c => c.role === 'model').parts[0].text;
  assert.ok(modelText.includes('المقاول: أحمد') && modelText.includes('فيلا 9'));
  // تسجيل كتابة بعد التأكيد بيحتفظ بماركر واضح إن العملية لسه مستنية تأكيد
  assert.equal(conv.remember({ chatId: 1, userId: 2, scope: 's', userMessageId: 13, botMessageIds: [14], userText: 'سجل مصروف', toolName: 'write_confirmation', entities: [] }), true);
  // أداة كتابة جديدة ليها ماركر دلوقتي (قبل كده كانت بتضيع من السياق)
  assert.equal(conv.remember({ chatId: 1, userId: 2, scope: 's', userMessageId: 15, botMessageIds: [16], userText: 'سند', toolName: 'add_payment_voucher_draft' }), true);
});

await test('context expires after TTL', () => {
  let t = 0;
  const conv = createCopilotConversation({ ttlMs: 1000, now: () => t });
  conv.remember({ chatId: 1, userId: 2, scope: 's', userMessageId: 11, botMessageIds: [12], userText: 'x', toolName: 'get_labor_daily_logs', entities: ['العامل: محمد'] });
  t = 1000;
  assert.equal(conv.getContext({ chatId: 1, userId: 2, scope: 's' }).contents.length, 0);
});

console.log(`copilot-write-confirm: ${passed} tests OK`);
