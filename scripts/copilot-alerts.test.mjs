// node scripts/copilot-alerts.test.mjs — اختبارات التنبيهات الاستباقية بدون تلغرام أو قاعدة بيانات حقيقية.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_ALERT_SETTINGS, normalizeAlertSettings, enabledAlertTypes, isQuietTime, evaluateAlerts,
  selectAlertsToSend, createAlertStore, createAlertRunner, resolveAlertCallback, resolveAlertConfigCallback,
  applyAlertConfig, buildAlertMarkup, buildAlertSettingsView, MAX_ALERTS_PER_RUN,
} from './copilot-alerts.mjs';

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; };
const allOn = normalizeAlertSettings({ types: { overdue_claim: true, low_treasury: true, overdue_job_order: true, large_transaction: true } });
const today = '2026-11-10';
const tmpStore = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alerts-'));
  return createAlertStore({ settingsPath: path.join(dir, 's.json'), statePath: path.join(dir, 'st.json') });
};
const sampleData = () => ({
  success: true,
  claims: { available: true, rows: [
    { id: 'c1', claim_number: 'SC-1', contractor_name: 'أحمد', date: '2026-10-01', payment_period_days: 15, net_amount: 1000, paid_amount: 200, status: 'معتمد' }, // متأخر
    { id: 'c2', claim_number: 'SC-2', contractor_name: 'محمد', date: '2026-11-05', payment_period_days: 15, net_amount: 1000, paid_amount: 0, status: 'معتمد' }, // لسه
    { id: 'c3', claim_number: 'SC-3', date: '2026-09-01', payment_period_days: 10, net_amount: 500, paid_amount: 500, status: 'معتمد' }, // مدفوع بالكامل
    { id: 'c4', claim_number: 'SC-4', date: '2026-10-05', payment_period_days: null, net_amount: 500, paid_amount: 0, status: 'معتمد' }, // افتراضي 30 → 11-04 متأخر
  ] },
  jobOrders: { available: true, rows: [
    { id: 'j1', order_number: 'JO-1', end_date: '2026-11-01', status: 'جاري التنفيذ' },
    { id: 'j2', order_number: 'JO-2', end_date: '2026-11-20', status: 'جاري التنفيذ' },
    { id: 'j3', order_number: 'JO-3', end_date: '2026-10-01', status: 'مكتمل' },
  ] },
  treasury: { available: true, balance: 3000 },
  transactions: { available: true, rows: [
    { kind: 'expense', id: 'e1', amount: 7000, party: 'مورد' },
    { kind: 'voucher', id: 'v1', amount: 4999 },
  ] },
});

await test('defaults: everything off', () => {
  assert.deepEqual(enabledAlertTypes(normalizeAlertSettings({})), []);
  assert.equal(DEFAULT_ALERT_SETTINGS.treasuryMin, 10000);
  assert.equal(DEFAULT_ALERT_SETTINGS.largeTxMin, 5000);
});

await test('nothing evaluated when types are off', () => {
  assert.deepEqual(evaluateAlerts(sampleData(), {}, today), []);
});

await test('conditions per type', () => {
  const keys = evaluateAlerts(sampleData(), allOn, today).map(a => a.key).sort();
  assert.deepEqual(keys, [
    'large_transaction:expense:e1', 'low_treasury:122', 'overdue_claim:c1', 'overdue_claim:c4', 'overdue_job_order:j1',
  ].sort());
});

await test('treasury emergency only when negative', () => {
  const d = sampleData();
  d.treasury.balance = -50;
  const a = evaluateAlerts(d, allOn, today).find(x => x.type === 'low_treasury');
  assert.equal(a.emergency, true);
  d.treasury.balance = 20000;
  assert.equal(evaluateAlerts(d, allOn, today).some(x => x.type === 'low_treasury'), false);
});

await test('unavailable sections produce no alerts', () => {
  const d = sampleData();
  d.claims.available = false; d.treasury = { available: false, balance: null };
  const types = new Set(evaluateAlerts(d, allOn, today).map(a => a.type));
  assert.equal(types.has('overdue_claim'), false);
  assert.equal(types.has('low_treasury'), false);
});

await test('quiet hours across midnight', () => {
  assert.equal(isQuietTime('23:30', '22:00', '07:00'), true);
  assert.equal(isQuietTime('03:00', '22:00', '07:00'), true);
  assert.equal(isQuietTime('07:00', '22:00', '07:00'), false);
  assert.equal(isQuietTime('12:00', '22:00', '07:00'), false);
  assert.equal(isQuietTime('13:00', '12:00', '14:00'), true);
  assert.equal(isQuietTime('bad', '22:00', '07:00'), false);
});

await test('quiet hours hold non-emergency, pass emergency', () => {
  const d = sampleData(); d.treasury.balance = -1;
  const alerts = evaluateAlerts(d, allOn, today);
  const r = selectAlertsToSend(alerts, { settings: allOn, wasSentRecently: () => false, nowMs: 0, hhmm: '23:00' });
  assert.deepEqual(r.send.map(a => a.type), ['low_treasury']);
  assert.equal(r.heldForQuiet, alerts.length - 1);
  const manual = selectAlertsToSend(alerts, { settings: allOn, wasSentRecently: () => false, nowMs: 0, hhmm: '23:00', ignoreQuietHours: true });
  assert.equal(manual.send.length + manual.overflow.length, alerts.length);
});

await test('dedupe within cooldown, resend after it', () => {
  const store = tmpStore();
  const alerts = evaluateAlerts(sampleData(), allOn, today);
  const t0 = Date.parse('2026-11-10T09:00:00Z');
  const first = selectAlertsToSend(alerts, { settings: allOn, wasSentRecently: store.wasSentRecently, nowMs: t0, hhmm: '12:00' });
  store.markSent([...first.send, ...first.overflow], t0);
  const again = selectAlertsToSend(alerts, { settings: allOn, wasSentRecently: store.wasSentRecently, nowMs: t0 + 3600_000, hhmm: '13:00' });
  assert.equal(again.send.length + again.overflow.length, 0);
  const later = selectAlertsToSend(alerts, { settings: allOn, wasSentRecently: store.wasSentRecently, nowMs: t0 + 25 * 3600_000, hhmm: '13:00' });
  assert.equal(later.send.length + later.overflow.length, alerts.length);
});

await test('per-run cap with overflow summary', () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ kind: 'expense', id: `e${i}`, amount: 9000 }));
  const alerts = evaluateAlerts({ success: true, transactions: { available: true, rows } }, allOn, today);
  const r = selectAlertsToSend(alerts, { settings: allOn, wasSentRecently: () => false, nowMs: 0, hhmm: '12:00' });
  assert.equal(r.send.length, MAX_ALERTS_PER_RUN);
  assert.equal(r.overflow.length, 9 - MAX_ALERTS_PER_RUN);
});

await test('callbacks are strict and short', () => {
  const a = evaluateAlerts(sampleData(), allOn, today)[0];
  for (const b of buildAlertMarkup(a).inline_keyboard.flat()) assert.ok(Buffer.byteLength(b.callback_data) <= 64);
  for (const b of buildAlertSettingsView(allOn).replyMarkup.inline_keyboard.flat()) assert.ok(Buffer.byteLength(b.callback_data) <= 64);
  assert.deepEqual(resolveAlertCallback(`alert:d:${a.id}`), { action: 'details', id: a.id });
  assert.deepEqual(resolveAlertCallback('alert:m:low_treasury'), { action: 'mute', type: 'low_treasury' });
  assert.equal(resolveAlertCallback('alert:m:__proto__'), null);
  assert.equal(resolveAlertCallback('alert:d:../../etc'), null);
  assert.equal(resolveAlertConfigCallback('alert_cfg:t:toString'), null);
  assert.deepEqual(resolveAlertConfigCallback('alert_cfg:t:overdue_claim'), { action: 'toggle', type: 'overdue_claim' });
});

await test('config toggle and threshold cycling', () => {
  let s = normalizeAlertSettings({});
  s = applyAlertConfig(s, { action: 'toggle', type: 'low_treasury' });
  assert.equal(s.types.low_treasury, true);
  s = applyAlertConfig(s, { action: 'threshold', which: 'treasury' });
  assert.equal(s.treasuryMin, 20000);
  s = applyAlertConfig(s, { action: 'threshold', which: 'large' });
  assert.equal(s.largeTxMin, 10000);
  s = applyAlertConfig({ ...s, treasuryMin: 50000 }, { action: 'threshold', which: 'treasury' });
  assert.equal(s.treasuryMin, 2000, 'wraps around');
});

await test('runner: manual check sends, records, details and mute', async () => {
  const store = tmpStore();
  store.saveSettings(allOn);
  const sent = [];
  let toolArgs;
  const runner = createAlertRunner({
    store,
    resolveAccess: async () => ({ companyId: 'x', fullCompanyAccess: false, permissions: { projects: ['view'], expenses: ['view'] } }),
    makeTools: () => ({ get_proactive_alert_data: async (args) => { toolArgs = args; return sampleData(); } }),
    hasPermission: (access, mod) => Array.isArray(access.permissions[mod]),
    send: async (chatId, text, markup) => { sent.push({ chatId, text, markup }); return { ok: true }; },
    getDate: () => today,
    getHHMM: () => '23:00', // ساعات هدوء — الفحص اليدوي بيتجاهلها
    now: () => Date.parse('2026-11-10T20:00:00Z'),
  });
  const r = await runner.check({ chatId: 1, userId: 2 }, { manual: true });
  assert.equal(r.ok, true);
  assert.equal(r.sent, 5);
  assert.deepEqual(toolArgs.permissions, { contractors: true, journal: false, expenses: true, payments: false });
  assert.equal(toolArgs.large_tx_min, 5000);
  const second = await runner.check({ chatId: 1, userId: 2 }, { manual: true });
  assert.equal(second.sent, 0, 'deduped');

  const detailsBtn = sent[0].markup.inline_keyboard[0][0].callback_data;
  const answers = [];
  const ctx = { chatId: 1, userId: 2, answerCb: async (t) => answers.push(t), editMessage: async () => {} };
  assert.equal(await runner.handleCallback({ ...ctx, data: detailsBtn }), true);
  assert.ok(sent.at(-1).text.length > 20);
  assert.equal(await runner.handleCallback({ ...ctx, data: 'alert:m:large_transaction' }), true);
  assert.equal(store.getSettings().types.large_transaction, false);
  assert.equal(await runner.handleCallback({ ...ctx, data: 'jo_pick:1:2' }), false);
});

await test('runner: scheduled tick respects interval and quiet hours, does nothing when all off', async () => {
  const store = tmpStore();
  let clock = Date.parse('2026-11-10T08:00:00Z');
  let calls = 0;
  const runner = createAlertRunner({
    store,
    resolveAccess: async () => ({ fullCompanyAccess: true }),
    makeTools: () => ({ get_proactive_alert_data: async () => { calls++; return sampleData(); } }),
    hasPermission: () => true,
    send: async () => ({ ok: true }),
    getDate: () => today,
    getHHMM: () => '23:00',
    now: () => clock,
  });
  assert.equal(await runner.tick({ chatId: 1, userId: 0 }), null);
  assert.equal(calls, 0, 'all off → no DB read');
  store.saveSettings(allOn);
  const r = await runner.tick({ chatId: 1, userId: 0 });
  assert.equal(r.sent, 0, 'quiet hours, no emergency');
  assert.ok(r.heldForQuiet > 0);
  clock += 60_000;
  assert.equal(await runner.tick({ chatId: 1, userId: 0 }), null, 'interval not reached');
  assert.equal(calls, 1);
});

// أداة القراءة: GET فقط + فلتر الشركة على كل طلب + احترام الصلاحيات
await test('get_proactive_alert_data: read-only, company-scoped, permission-gated', async () => {
  const { createCopilotTools } = await import('./copilot-tools.mjs');
  const companyId = '72918f4d-10c3-43a0-884e-2f84f1224335';
  const accId = '11111111-1111-4111-8111-111111111111';
  const hdrId = '22222222-2222-4222-8222-222222222222';
  const requests = [];
  const respond = (rows) => ({ ok: true, json: async () => rows, headers: { get: () => `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } });
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), method: init?.method });
    const u = String(url);
    if (u.includes('/accounts?')) return respond([{ id: accId }]);
    if (u.includes('/journal_lines?')) return respond([{ header_id: hdrId, debit: 1000, credit: 4000 }]);
    if (u.includes('/journal_headers?')) return respond([{ id: hdrId }]);
    return respond([]);
  };
  const tools = createCopilotTools({
    supabaseUrl: 'https://example.supabase.co', supabaseKey: 'service-role-key-for-test', companyId,
    allowServiceRole: true, fetchImpl,
  });
  const res = await tools.get_proactive_alert_data({
    types: ['overdue_claim', 'low_treasury', 'overdue_job_order', 'large_transaction'],
    permissions: { contractors: false, journal: true, expenses: true, payments: false },
  });
  assert.equal(res.success, true);
  assert.equal(res.treasury.available, true);
  assert.equal(res.treasury.balance, -3000);
  assert.equal(res.claims.available, false, 'no contractors permission');
  assert.equal(res.jobOrders.available, false);
  assert.ok(requests.length > 0);
  for (const r of requests) {
    assert.equal(r.method, 'GET');
    assert.ok(r.url.includes(`company_id=eq.${companyId}`), `company filter on ${r.url}`);
  }
  assert.equal(requests.some(r => r.url.includes('/sub_claims') || r.url.includes('/payment_vouchers')), false);
});

console.log(`copilot-alerts: ${passed} tests OK`);
