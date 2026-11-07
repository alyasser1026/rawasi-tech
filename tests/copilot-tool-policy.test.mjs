import test from 'node:test';
import assert from 'node:assert/strict';
import { getCopilotDate, getEnabledCopilotDeclarations, runEnabledCopilotTool } from '../scripts/copilot-tool-policy.mjs';
import { buildSystemInstructions, interpretModelParts } from '../scripts/copilot-prompt.mjs';

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

test('gates labor wages on laborcost permission in field-ops mode and marks unavailable report sections as غير متاح', async () => {
  const prevFlag = process.env.COPILOT_LIVE_FIELD_OPS_ENABLED;
  process.env.COPILOT_LIVE_FIELD_OPS_ENABLED = 'true';
  try {
    const noWageCompany = { companyId: 'company-test', userId: 'user-test', companyName: 'شركة اختبار', permissions: { labor_logs: ['view'] } };
    const wageCompany = { companyId: 'company-test', userId: 'user-test', companyName: 'شركة اختبار', permissions: { labor_logs: ['view'], laborcost: ['view'] } };
    const laborTools = {
      [labor]: args => ({
        success: true,
        count_records: 1,
        count_unique_workers: 1,
        total_attendance_days: 1,
        wages_available: Boolean(args.include_wages),
        total_wages: args.include_wages ? 250 : null,
        posted_records: 1,
        draft_records: 0,
        logs: [{ work_date: '2026-11-06', worker_name: 'محمد ياسر', site_ref: 'فيلا 643', work_item: 'جبس', attendance_value: 1, ...(args.include_wages ? { daily_wage: 250 } : {}) }],
      }),
    };

    const replyWithoutWagePerm = await runEnabledCopilotTool({ name: labor, args: { date: '2026-11-06' } }, laborTools, noWageCompany);
    assert.match(replyWithoutWagePerm, /غير متاح \(تتطلب صلاحية laborcost\)/);
    assert.doesNotMatch(replyWithoutWagePerm, /250/);

    const replyWithWagePerm = await runEnabledCopilotTool({ name: labor, args: { date: '2026-11-06' } }, laborTools, wageCompany);
    assert.match(replyWithWagePerm, /250 ر\.س/);

    const reportName = 'get_daily_comprehensive_report';
    const reportTools = {
      [reportName]: args => ({
        success: true,
        report_date: '2026-11-06',
        villa_filter: 'جميع المشاريع والفلل',
        section_1_labor_today: { available: Boolean(args.section_permissions?.labor_logs), wages_available: Boolean(args.section_permissions?.laborcost), records_count: 1, unique_workers_count: 1, total_attendance_days: 1, total_daily_wages: null, workers: [] },
        section_2_villas_and_projects: { available: Boolean(args.section_permissions?.projects), worked_today_count: null, total_company_projects: null, worked_today_villas: [], all_company_projects: [] },
        section_3_expenses_today: { available: Boolean(args.section_permissions?.expenses), count: null, total_amount: null, items: [] },
        section_4_spent_on_labor: { available: false, wages_available: false, expenses_available: false, vouchers_available: false, accrued_wages_from_logs: null, direct_labor_expenses: null, payment_vouchers_to_workers: null, total_cash_disbursed_to_labor: null },
        section_5_materials_issued: { available: Boolean(args.section_permissions?.inventory), issues_count: null, total_issued_value: null, issues: [] },
        section_6_contractors_delivered: { available: Boolean(args.section_permissions?.contractors), claims_today_count: null, active_job_orders_count: null, completed_job_orders_count: null, claims_today: [], job_orders: [] },
        section_7_completed_requests: { available: Boolean(args.section_permissions?.requests), total_requests_count: null, completed_count: null, pending_count: null, completed_requests: [], pending_requests: [] },
      }),
    };

    const reportReply = await runEnabledCopilotTool({ name: reportName, args: { date: '2026-11-06' } }, reportTools, noWageCompany);
    assert.match(reportReply, /2️⃣ الفلل والمشاريع: غير متاح/);
    assert.match(reportReply, /3️⃣ المصروفات المسجلة: غير متاح/);
    assert.match(reportReply, /4️⃣ اللي اتصرف للعمالة: غير متاح/);
    assert.match(reportReply, /5️⃣ الخامات اللي اتصرفت من المخازن: غير متاح/);
    assert.match(reportReply, /6️⃣ المقاولين اللي اتسلمت والمستخلصات وأوامر الشغل: غير متاح/);
    assert.match(reportReply, /7️⃣ الركوستات والطلبات والمهام اللي خلصت: غير متاح/);
  } finally {
    if (prevFlag === undefined) delete process.env.COPILOT_LIVE_FIELD_OPS_ENABLED;
    else process.env.COPILOT_LIVE_FIELD_OPS_ENABLED = prevFlag;
  }
});

test('prevents mid-word truncated MAX_TOKENS replies and injects quoted message as untrusted data', () => {
  const truncated = interpretModelParts([{ text: 'السطر الأول مكتمل.\nالسطر التاني مقطوع في نص الكل' }], [], 'MAX_TOKENS');
  assert.equal(truncated.type, 'text');
  assert.match(truncated.text, /السطر الأول مكتمل\./);
  assert.doesNotMatch(truncated.text, /مقطوع في نص الكل/);
  assert.match(truncated.text, /تم اختصار الرد/);

  const instructions = buildSystemInstructions({
    knowledge: 'دليل مختصر',
    declarations: [],
    referenceMissing: true,
    quotedMessageText: '🚨 [خطأ تقني - ERROR] Could not find the function public.save_expense_draft',
    date: '2026-11-06',
  });
  assert.match(instructions, /save_expense_draft/);
  assert.match(instructions, /بيانات غير موثوقة/);
});
