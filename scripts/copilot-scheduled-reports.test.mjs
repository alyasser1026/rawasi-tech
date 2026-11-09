// node scripts/copilot-scheduled-reports.test.mjs — التقارير المجدولة: حدود التواريخ بتوقيت الرياض + منع التكرار + أداة الفترة.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeScheduleSettings, riyadhParts, shiftDate, previousMonthRange, weeklyRange, dueReport,
  formatPeriodSummary, applyScheduleConfig, resolveScheduleCallback, buildScheduleSettingsView,
  createReportScheduleStore, createScheduledReportRunner, CATCH_UP_WINDOW_MINUTES,
} from './copilot-scheduled-reports.mjs';

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; };
const on = (kinds) => normalizeScheduleSettings(Object.fromEntries(kinds.map(k => [k, { enabled: true }])));
// 2026-11-12 الخميس. توقيت الرياض = UTC+3
const utc = (s) => new Date(s);
const tmpStore = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-'));
  return createReportScheduleStore({ settingsPath: path.join(d, 's.json'), statePath: path.join(d, 'st.json') });
};

await test('defaults all off, bad times fall back', () => {
  const s = normalizeScheduleSettings({ morning: { enabled: 'yes', time: '25:99' } });
  assert.equal(s.morning.enabled, false);
  assert.equal(s.morning.time, '07:30');
  assert.equal(s.weekly.time, '18:00');
});

await test('Riyadh parts: midnight boundary and weekday', () => {
  assert.deepEqual(riyadhParts(utc('2026-11-11T21:30:00Z')), { date: '2026-11-12', hhmm: '00:30', weekday: 4, day: 12 });
  assert.equal(riyadhParts(utc('2026-11-11T20:59:00Z')).date, '2026-11-11');
  assert.equal(riyadhParts(utc('2026-11-12T15:00:00Z')).weekday, 4);
});

await test('date ranges: week, previous month, year rollover, leap year', () => {
  assert.deepEqual(weeklyRange('2026-11-12'), { start: '2026-11-06', end: '2026-11-12', key: '2026-11-06_2026-11-12' });
  assert.deepEqual(previousMonthRange('2026-11-01'), { start: '2026-10-01', end: '2026-10-31', key: '2026-10' });
  assert.deepEqual(previousMonthRange('2027-01-01'), { start: '2026-12-01', end: '2026-12-31', key: '2026-12' });
  assert.equal(previousMonthRange('2028-03-01').end, '2028-02-29');
  assert.equal(previousMonthRange('2026-03-01').end, '2026-02-28');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
});

await test('morning: due at time, reports yesterday, not before, expires after window', () => {
  const s = on(['morning']); // 07:30 Riyadh = 04:30Z
  assert.equal(dueReport('morning', s, utc('2026-11-12T04:29:00Z'), null), null);
  const d = dueReport('morning', s, utc('2026-11-12T04:30:00Z'), null);
  assert.deepEqual([d.start, d.end, d.key], ['2026-11-11', '2026-11-11', '2026-11-11']);
  assert.ok(dueReport('morning', s, utc(`2026-11-12T0${4 + 2}:29:00Z`), null), 'inside catch-up window');
  assert.equal(CATCH_UP_WINDOW_MINUTES, 180);
  assert.equal(dueReport('morning', s, utc('2026-11-12T07:31:00Z'), null), null, 'after window');
});

await test('weekly: only Thursday; monthly: only the 1st', () => {
  const w = on(['weekly']); // 18:00 → 15:00Z
  assert.ok(dueReport('weekly', w, utc('2026-11-12T15:00:00Z'), null));
  assert.equal(dueReport('weekly', w, utc('2026-11-11T15:00:00Z'), null), null, 'Wednesday');
  assert.equal(dueReport('weekly', w, utc('2026-11-13T15:00:00Z'), null), null, 'Friday');
  const m = on(['monthly']); // 09:00 → 06:00Z
  const d = dueReport('monthly', m, utc('2026-11-01T06:00:00Z'), null);
  assert.equal(d.key, '2026-10');
  assert.equal(dueReport('monthly', m, utc('2026-11-02T06:00:00Z'), null), null);
  assert.equal(dueReport('monthly', m, utc('2026-10-31T21:30:00Z'), null), null, '00:30 on Nov 1 Riyadh is before 09:00');
});

await test('disabled never due; same period key never repeats', () => {
  assert.equal(dueReport('morning', normalizeScheduleSettings({}), utc('2026-11-12T04:30:00Z'), null), null);
  assert.equal(dueReport('morning', on(['morning']), utc('2026-11-12T04:45:00Z'), '2026-11-11'), null);
  assert.ok(dueReport('morning', on(['morning']), utc('2026-11-13T04:45:00Z'), '2026-11-11'), 'next day is new period');
});

await test('formatter: full, unavailable sections, truncated warning', () => {
  const data = {
    start: '2026-11-06', end: '2026-11-12',
    labor: { available: true, logs: 10, workers: 4, worker_days: 9.5, days_with_work: 5, wages: 1900 },
    expenses: { available: true, count: 3, total: 4500.5, truncated: true },
    vouchers: { available: false }, claims: { available: true, count: 1, net: 1000, paid: 200 },
    jobOrders: { available: true, created: 2, active: 1 },
  };
  const t = formatPeriodSummary(data, 'weekly', 'فاي تك');
  assert.ok(t.includes('التقرير الأسبوعي') && t.includes('فاي تك'));
  assert.ok(t.includes('أجور 1,900') && t.includes('4,500.5') && t.includes('جزئية'));
  assert.ok(t.includes('سندات الصرف: غير متاح'));
  assert.ok(formatPeriodSummary({ ...data, start: '2026-10-01', end: '2026-10-31' }, 'monthly').includes('2026-10'));
});

await test('config: callbacks strict, toggle, time cycles and wraps', () => {
  for (const b of buildScheduleSettingsView({}).replyMarkup.inline_keyboard.flat()) {
    assert.ok(Buffer.byteLength(b.callback_data) <= 64);
    assert.ok(resolveScheduleCallback(b.callback_data), b.callback_data);
  }
  assert.equal(resolveScheduleCallback('sched_cfg:t:toString'), null);
  assert.equal(resolveScheduleCallback('sched_cfg:show:x'), null);
  assert.equal(resolveScheduleCallback('alert_cfg:show'), null);
  let s = applyScheduleConfig({}, { action: 'toggle', kind: 'weekly' });
  assert.equal(s.weekly.enabled, true);
  s = applyScheduleConfig(s, { action: 'time', kind: 'weekly' });
  assert.equal(s.weekly.time, '20:00');
  s = applyScheduleConfig({ weekly: { time: '21:00' } }, { action: 'time', kind: 'weekly' });
  assert.equal(s.weekly.time, '16:00');
});

await test('store persists last key across instances (restart)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-'));
  const paths = { settingsPath: path.join(d, 's.json'), statePath: path.join(d, 'st.json') };
  const a = createReportScheduleStore(paths);
  a.markSent('weekly', 'k1'); a.markSent('morning', 'k2');
  const b = createReportScheduleStore(paths);
  assert.equal(b.getLastKey('weekly'), 'k1');
  assert.equal(b.getLastKey('morning'), 'k2');
  assert.equal(b.getLastKey('monthly'), null);
});

const makeRunner = (store, clockRef, sent, overrides = {}) => createScheduledReportRunner({
  store,
  resolveAccess: async () => ({ companyName: 'فاي تك', fullCompanyAccess: true }),
  makeTools: () => ({ get_period_summary: async (a) => ({ success: true, start: a.start_date, end: a.end_date, labor: { available: false }, expenses: { available: false }, vouchers: { available: false }, claims: { available: false }, jobOrders: { available: false } }) }),
  hasPermission: () => true,
  getDailyReport: async (date) => [`تقرير ${date} جزء 1`, `تقرير ${date} جزء 2`],
  send: async (chatId, text, extra) => { sent.push({ chatId, text, extra }); return { ok: true }; },
  companyLabel: (a) => a.companyName,
  now: () => clockRef.t,
  ...overrides,
});

await test('runner: sends once, survives restart, follow-up buttons only on last message', async () => {
  const store = tmpStore();
  store.saveSettings(on(['morning', 'weekly']));
  const sent = [];
  const clock = { t: utc('2026-11-12T04:30:00Z') }; // الخميس 07:30
  const r1 = makeRunner(store, clock, sent);
  assert.deepEqual(await r1.tick({ chatId: 1, userId: 0 }), ['morning:2026-11-11']);
  assert.equal(sent.length, 2);
  assert.ok(sent[0].text.includes('الملخص الصباحي') && sent[0].text.includes('2026-11-11'));
  assert.equal(sent[0].extra, undefined);
  assert.equal(sent[1].extra, 'followup');
  clock.t = utc('2026-11-12T04:40:00Z');
  assert.deepEqual(await r1.tick({ chatId: 1, userId: 0 }), []);
  const r2 = makeRunner(store, clock, sent); // إعادة تشغيل
  assert.deepEqual(await r2.tick({ chatId: 1, userId: 0 }), []);
  assert.equal(sent.length, 2);
  clock.t = utc('2026-11-12T15:00:00Z'); // 18:00 الخميس → أسبوعي
  assert.deepEqual(await r2.tick({ chatId: 1, userId: 0 }), ['weekly:2026-11-06_2026-11-12']);
  assert.ok(sent.at(-1).text.includes('التقرير الأسبوعي'));
});

await test('runner: failed send is retried next tick (not marked)', async () => {
  const store = tmpStore();
  store.saveSettings(on(['weekly']));
  const sent = [];
  let fail = true;
  const clock = { t: utc('2026-11-12T15:00:00Z') };
  const r = makeRunner(store, clock, sent, { send: async (c, t, e) => { if (fail) return { ok: false }; sent.push({ t }); return { ok: true }; } });
  assert.deepEqual(await r.tick({ chatId: 1, userId: 0 }), []);
  fail = false;
  clock.t = utc('2026-11-12T15:05:00Z');
  assert.equal((await r.tick({ chatId: 1, userId: 0 })).length, 1);
});

await test('runner: all off → no access resolution at all', async () => {
  const store = tmpStore();
  let touched = 0;
  const r = makeRunner(store, { t: utc('2026-11-12T04:30:00Z') }, [], { resolveAccess: async () => { touched++; return {}; } });
  assert.deepEqual(await r.tick({ chatId: 1, userId: 0 }), []);
  assert.equal(touched, 0);
});

await test('runner: callback toggles and edits message; unrelated data ignored', async () => {
  const store = tmpStore();
  const edits = [];
  const r = makeRunner(store, { t: new Date() }, []);
  const ctx = { chatId: 1, answerCb: async () => {}, editMessage: async (t, m) => edits.push(t) };
  assert.equal(await r.handleCallback({ ...ctx, data: 'sched_cfg:t:monthly' }), true);
  assert.equal(store.getSettings().monthly.enabled, true);
  assert.equal(edits.length, 1);
  assert.equal(await r.handleCallback({ ...ctx, data: 'menu:projects' }), false);
});

await test('get_period_summary: read-only, company-scoped, permission-gated, totals', async () => {
  const { createCopilotTools } = await import('./copilot-tools.mjs');
  const companyId = '72918f4d-10c3-43a0-884e-2f84f1224335';
  const requests = [];
  const rows = {
    labor_daily_logs: [{ work_date: '2026-11-10', worker_name: 'أ', attendance_value: 1, daily_wage: 200 }, { work_date: '2026-11-11', worker_name: 'ب', attendance_value: 0.5, daily_wage: 100 }],
    expenses: [{ total_price: 1000, paid_amount: 400 }, { total_price: 0, paid_amount: 250 }],
    payment_vouchers: [{ amount: 300 }],
  };
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), method: init?.method });
    const table = new URL(String(url)).pathname.split('/').pop();
    const data = rows[table] || [];
    return { ok: true, json: async () => data, headers: { get: () => `0-${Math.max(data.length - 1, 0)}/${data.length}` } };
  };
  const tools = createCopilotTools({ supabaseUrl: 'https://example.supabase.co', supabaseKey: 'service-role-key-for-test', companyId, allowServiceRole: true, fetchImpl });
  const res = await tools.get_period_summary({
    start_date: '2026-11-06', end_date: '2026-11-12',
    permissions: { labor_logs: true, laborcost: false, expenses: true, payments: true, contractors: false },
  });
  assert.equal(res.success, true);
  assert.equal(res.labor.worker_days, 1.5);
  assert.equal(res.labor.workers, 2);
  assert.equal(res.labor.wages, undefined, 'wages hidden without laborcost');
  assert.equal(res.expenses.total, 1250);
  assert.equal(res.vouchers.total, 300);
  assert.equal(res.claims.available, false);
  assert.equal(res.jobOrders.available, false);
  assert.equal(requests.some(r => r.url.includes('daily_wage')), false, 'daily_wage not even selected');
  assert.equal(requests.some(r => r.url.includes('sub_claims') || r.url.includes('job_orders')), false);
  for (const r of requests) {
    assert.equal(r.method, 'GET');
    assert.ok(r.url.includes(`company_id=eq.${companyId}`));
  }
  const bad = await tools.get_period_summary({ start_date: '2026-11-12', end_date: '2026-11-06', permissions: {} });
  assert.equal(bad.success, false);
  const long = await tools.get_period_summary({ start_date: '2026-01-01', end_date: '2026-03-01', permissions: {} });
  assert.equal(long.success, false);
});

console.log(`copilot-scheduled-reports: ${passed} tests OK`);
