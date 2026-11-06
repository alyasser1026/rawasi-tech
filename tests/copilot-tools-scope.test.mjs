import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCopilotTools } from '../scripts/copilot-tools.mjs';

const companyId = 'b67414ab-8241-4b9d-8627-8175dfa8e501';
const userId = 'c268de8c-bac0-430b-b4b1-f70b2999b601';
const supabaseKey = 'sb_publishable_copilot_fixture';
const supabaseUrl = 'https://copilot-test.example.invalid';
const date = '2026-11-06';

// Tokens are synthetic and deliberately unsigned. Supabase signature validation
// is outside the local tools boundary and this suite makes no network requests.
function fixtureToken(claims) {
  return ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'fixture-signature'].join('.');
}

const accessToken = fixtureToken({ role: 'authenticated', sub: userId, exp: 4_102_444_800 });
const base = { supabaseUrl, supabaseKey, accessToken, companyId };

function buildTools(options = {}, handle = () => Response.json([])) {
  const requests = [];
  const tools = createCopilotTools({
    ...base,
    ...options,
    async fetchImpl(url, init) {
      requests.push({ url: new URL(url), init });
      return handle(url, init);
    },
  });
  return { tools, requests };
}

test('missing, privileged and invalid scope all stop before network access', async () => {
  const invalidOptions = [
    { accessToken: undefined },
    { companyId: undefined },
    { companyId: 'default' },
    { supabaseUrl: 'http://non-local.example.invalid' },
    { supabaseKey: 'sb_secret_fixture' },
    { supabaseKey: fixtureToken({ role: 'service_role' }) },
    { accessToken: fixtureToken({ role: 'anon', sub: userId, exp: 4_102_444_800 }) },
    { accessToken: fixtureToken({ role: 'service_role', sub: userId, exp: 4_102_444_800 }) },
    { accessToken: fixtureToken({ role: 'authenticated', sub: userId, exp: 1 }) },
    { accessToken: fixtureToken({ role: 'authenticated', sub: 'invalid', exp: 4_102_444_800 }) },
  ];

  for (const options of invalidOptions) {
    const { tools, requests } = buildTools(options);
    const reply = await tools.get_labor_daily_logs({ date });
    assert.equal(reply.success, false);
    assert.match(reply.error, /جلسة مستخدم وشركة مصرح بها/);
    assert.equal(requests.length, 0);
  }
});

test('labor read pins company and user auth, projects minimal fields and reports partial results', async () => {
  const row = {
    work_date: date,
    worker_name: 'عامل تجريبي',
    site_ref: 'موقع تجريبي',
    work_item: 'مراجعة',
    attendance_value: 1,
    daily_wage: 999,
    notes: 'لا تُرسل',
  };
  const { tools, requests } = buildTools({}, () =>
    Response.json([row], { status: 206, headers: { 'Content-Range': '0-0/3' } })
  );

  const reply = await tools.get_labor_daily_logs({ date, worker_name: row.worker_name });
  assert.equal(reply.success, true);
  assert.equal(reply.count_records, 3);
  assert.equal(reply.returned_count, 1);
  assert.equal(reply.partial, true);
  assert.equal(reply.date_filter, date);
  assert.deepEqual(Object.keys(reply.logs[0]).sort(), ['attendance_value', 'site_ref', 'work_date', 'work_item', 'worker_name']);
  assert.equal(requests.length, 1);

  const { url, init } = requests[0];
  assert.equal(url.origin, supabaseUrl);
  assert.equal(url.pathname, '/rest/v1/labor_daily_logs');
  assert.equal(url.searchParams.get('company_id'), 'eq.' + companyId);
  assert.equal(url.searchParams.get('select'), 'work_date,worker_name,site_ref,work_item,attendance_value');
  assert.equal(url.searchParams.get('work_date'), 'eq.' + date);
  assert.equal(url.searchParams.get('worker_name'), 'eq.' + row.worker_name);
  assert.equal(url.searchParams.get('limit'), '100');
  assert.equal(init.method, 'GET');
  assert.equal(init.redirect, 'error');
  assert.deepEqual(init.headers, { apikey: supabaseKey, Authorization: 'Bearer ' + accessToken, 'x-company-id': companyId, Prefer: 'count=exact' });
});

test('only explicit valid bounded labor dates become filters', async () => {
  const { tools, requests } = buildTools();
  const invalid = [
    {},
    { date: 'today' },
    { date: '2026-02-30' },
    { date: date + '&select=*' },
    { date, start_date: date, end_date: date },
    { start_date: date },
    { start_date: '2026-10-01', end_date: '2026-11-01' },
    { start_date: '2026-11-06', end_date: '2026-11-05' },
  ];
  for (const args of invalid) assert.equal((await tools.get_labor_daily_logs(args)).success, false);
  assert.equal(requests.length, 0);
  const reply = await tools.get_labor_daily_logs({ start_date: '2026-10-01', end_date: '2026-10-31' });
  assert.equal(reply.success, true);
  assert.deepEqual(requests[0].url.searchParams.getAll('work_date'), ['gte.2026-10-01', 'lte.2026-10-31']);
});

test('unknown totals stay unknown, zero requires an exact response, and outages are errors', async () => {
  const missingTotal = buildTools({}, () => Response.json([]));
  const missingReply = await missingTotal.tools.get_labor_daily_logs({ date });
  assert.equal(missingReply.count_records, null);
  assert.equal(missingReply.partial, true);

  const zero = buildTools({}, () => Response.json([], { headers: { 'Content-Range': '*/0' } }));
  const zeroReply = await zero.tools.get_labor_daily_logs({ date });
  assert.equal(zeroReply.count_records, 0);
  assert.equal(zeroReply.partial, false);

  const unavailable = buildTools({}, () => Response.json({ detail: 'fixture detail' }, { status: 403 }));
  for (const reply of [
    await unavailable.tools.get_labor_daily_logs({ date }),
    await unavailable.tools.get_company_notifications(),
    await unavailable.tools.get_fixed_assets_summary(),
    await unavailable.tools.get_financial_transaction_details({ search_query: '123' }),
    await unavailable.tools.get_custodies_and_closings(),
  ]) {
    assert.equal(reply.success, false);
    assert.match(reply.error, /تعذّر جلب البيانات/);
    assert.doesNotMatch(reply.error, /fixture detail/);
  }
});

test('legacy anon key is only an apikey; PDF reads need scope and site visits cannot write', async () => {
  const anon = fixtureToken({ role: 'anon' });
  const legacy = buildTools({ supabaseKey: anon });
  assert.equal((await legacy.tools.get_labor_daily_logs({ date })).success, true);
  assert.equal(legacy.requests[0].init.headers.apikey, anon);
  assert.equal(legacy.requests[0].init.headers.Authorization, 'Bearer ' + accessToken);

  const unscoped = buildTools({ companyId: null });
  assert.equal((await unscoped.tools.generate_and_send_worker_statement_pdf({ worker_name: 'عامل', chatId: 123 })).success, false);
  const reference = await unscoped.tools.get_engineering_checklist_and_specs({ item_name: 'العزل' });
  assert.equal(reference.success, true);
  assert.equal(unscoped.requests.length, 0);

  const scoped = buildTools();
  assert.equal((await scoped.tools.record_site_inspection_visit({ title: 'زيارة تجريبية' })).success, false);
  assert.equal(scoped.requests.length, 0);
});
