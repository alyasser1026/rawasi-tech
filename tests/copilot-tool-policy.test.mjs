import test from 'node:test';
import assert from 'node:assert/strict';
import { getCopilotDate, getEnabledCopilotDeclarations, runEnabledCopilotTool } from '../scripts/copilot-tool-policy.mjs';

const checklist = 'get_engineering_checklist_and_specs';
const labor = 'get_labor_daily_logs';
const write = 'record_site_inspection_visit';
const declarations = [checklist, labor, write, 'generate_and_send_worker_statement_pdf'].map(name => ({ name }));
const company = { companyId: 'company-test', userId: 'user-test', companyName: 'شركة اختبار', permissions: { labor_logs: ['view'] } };

test('only exposes local knowledge by default and scoped daily logs with view', () => {
  assert.deepEqual(getEnabledCopilotDeclarations(declarations, null).map(item => item.name), [checklist]);
  assert.deepEqual(getEnabledCopilotDeclarations(declarations, company).map(item => item.name), [checklist, labor]);
  assert.deepEqual(getEnabledCopilotDeclarations(declarations, { permissions: { labor_logs: { view: false } } }).map(item => item.name), [checklist]);
});

test('rejects forged writes, inherited methods and database tools without access', async () => {
  let calls = 0;
  const tools = { [write]: () => { calls += 1; }, [labor]: () => { calls += 1; } };
  for (const name of [write, 'constructor', 'toString', 'generate_and_send_worker_statement_pdf']) {
    assert.match(await runEnabledCopilotTool({ name, args: {} }, tools, company), /مش متاحة/);
  }
  assert.match(await runEnabledCopilotTool({ name: labor, args: { date: 'today' } }, tools, null), /مش متاحة/);
  assert.equal(calls, 0);
});

test('validates dates, identity injection and date range before a company tool can run', async () => {
  let calls = 0;
  const tools = { [labor]: () => { calls += 1; } };
  for (const args of [{}, { date: '2026-02-30' }, { date: 'today', companyId: 'different' },
    { start_date: '2026-01-01', end_date: '2026-02-01' }, { date: 'today', worker_name: '*%' }]) {
    assert.match(await runEnabledCopilotTool({ name: labor, args }, tools, company), /حدّد تاريخ/);
  }
  assert.equal(calls, 0);
});

test('uses Riyadh day boundaries and formats results without personal names, notes or wages', async () => {
  const now = new Date('2026-11-06T21:15:00Z');
  assert.equal(getCopilotDate(now), '2026-11-07');
  const tools = { [labor]: args => {
    assert.deepEqual(args, { date: '2026-11-07' });
    return { success: true, count_records: 2, workers_list: ['اسم اصطناعي'], total_wages: 77 };
  }};
  const result = await runEnabledCopilotTool({ name: labor, args: { date: 'today' } }, tools, company, now);
  assert.match(result, /شركة اختبار/);
  assert.match(result, /2026-11-07/);
  assert.match(result, /المطابقة: 2/);
  assert.doesNotMatch(result, /اسم اصطناعي|77/);
});

test('distinguishes no matches from partial and unavailable', async () => {
  const call = { name: labor, args: { date: '2026-11-06' } };
  const render = result => runEnabledCopilotTool(call, { [labor]: () => result }, company);
  assert.match(await render({ success: true, count_records: 0 }), /لا توجد سجلات/);
  assert.match(await render({ success: true, partial: true, count_records: 1 }), /جزئية/);
  assert.doesNotMatch(await render({ success: false }), /لا توجد سجلات/);
});

test('calls local checklist without authenticated database access', async () => {
  const tools = { [checklist]: () => ({ success: true, reference_found: true, engineering_guidance: 'راجع نظافة السطح' }) };
  assert.match(await runEnabledCopilotTool({ name: checklist, args: { item_name: 'محارة' } }, tools, null), /راجع نظافة السطح/);
});
