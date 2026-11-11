import test from 'node:test';
import assert from 'node:assert/strict';
import { createCopilotTools, classifyPaymentVoucherCategory } from '../scripts/copilot-tools.mjs';
import { runEnabledCopilotTool, splitReportParts } from '../scripts/copilot-tool-policy.mjs';
import { prepareSpeechText } from '../scripts/copilot-voice.mjs';

const egyptCompanyId = '8c90cb59-ffa3-4cd1-8bdc-db80a3c825b8';
const saudiCompanyId = '72918f4d-10c3-43a0-884e-2f84f1224335';
const userId = 'c268de8c-bac0-430b-b4b1-f70b2999b601';
const supabaseKey = 'sb_publishable_copilot_fixture';
const supabaseUrl = 'https://copilot-test.example.invalid';
const date = '2026-11-11';

function fixtureToken(claims) {
  return ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'fixture-signature'].join('.');
}

const accessToken = fixtureToken({ role: 'authenticated', sub: userId, exp: 4_102_444_800 });

const ACC_CUSTODY = { id: '7142b36f-f79b-4721-8f1a-615cb37d2f71', code: '125', name: 'عُهد الموظفين والمواقع', account_type: 'أصول' };
const ACC_WAGES_PAYABLE = { id: '304a645c-6791-432a-b4d7-dbb229501c2e', code: '216', name: 'رواتب وأجور مستحقة', account_type: 'التزامات' };
const ACC_LABOR_EXP = { id: '504a17b0-f979-414f-b1cb-42c70677006f', code: '512', name: 'أجور ومرتبات عمالة الموقع', account_type: 'مصروفات' };
const ACC_SUBCONTRACTORS = { id: 'a18ff2f8-3f47-4cbb-8acc-99b14e0851f1', code: '212', name: 'التزام مقاولي الباطن', account_type: 'التزامات' };

const WORKER = { id: '207eade1-de0b-4b4f-8947-767f01e020c0', name: 'ابراهيم شداد', partner_type: 'عامل يومية', job_role: 'نجار مسلح' };
const CONTRACTOR = { id: 'bb2bb060-42da-4207-bc6f-8026b9638ba4', name: 'المعلم ناصر السيد', partner_type: 'مقاول' };

test('classifyPaymentVoucherCategory separates custody (125) from actual worker wage payouts', () => {
  assert.equal(
    classifyPaymentVoucherCategory(
      { description: 'عهده مصروفات عماله', debit_account_id: ACC_CUSTODY.id },
      WORKER,
      ACC_CUSTODY
    ),
    'custody'
  );
  assert.equal(
    classifyPaymentVoucherCategory(
      { description: 'عهده للموقع من غير ربط حساب' },
      WORKER,
      null
    ),
    'custody'
  );
  assert.equal(
    classifyPaymentVoucherCategory(
      { description: 'سداد يومية ابراهيم شداد', debit_account_id: ACC_WAGES_PAYABLE.id },
      WORKER,
      ACC_WAGES_PAYABLE
    ),
    'labor_wage'
  );
  assert.equal(
    classifyPaymentVoucherCategory(
      { description: 'صرف أجر عمال نجارة', debit_account_id: ACC_LABOR_EXP.id },
      WORKER,
      ACC_LABOR_EXP
    ),
    'labor_wage'
  );
  assert.equal(
    classifyPaymentVoucherCategory(
      { description: 'سداد قيمة مستخلص مقاول باطن', sub_claim_id: 'sc-1', debit_account_id: ACC_SUBCONTRACTORS.id },
      CONTRACTOR,
      ACC_SUBCONTRACTORS
    ),
    'sub_claim'
  );
  assert.equal(
    classifyPaymentVoucherCategory(
      { description: 'سداد مصروف: ايجار يومي' },
      null,
      null
    ),
    'expense'
  );
});

test('Daily comprehensive report: separates custody (3000) from unpaid labor daily logs (700) and renders EGP (ج.م) for Company 2', async () => {
  const prevFlag = process.env.COPILOT_LIVE_FIELD_OPS_ENABLED;
  process.env.COPILOT_LIVE_FIELD_OPS_ENABLED = 'true';
  try {
    const projectId = 'b0e562e1-b00c-4401-a4e1-cdd222d342f4';
    const tools = createCopilotTools({
      supabaseUrl,
      supabaseKey,
      accessToken,
      companyId: egyptCompanyId,
      detailedReads: true,
      async fetchImpl(url) {
        const u = new URL(url);
        const tbl = u.pathname.replace('/rest/v1/', '');
        const isLate = u.searchParams.has('created_at');
        if (tbl === 'companies') return Response.json([{ id: egyptCompanyId, name: 'PHI-TECH-EGY', currency: 'EGP', country: 'EG' }]);
        if (tbl === 'accounts') return Response.json([ACC_CUSTODY, ACC_WAGES_PAYABLE, ACC_LABOR_EXP, ACC_SUBCONTRACTORS]);
        if (tbl === 'partners') return Response.json([WORKER, CONTRACTOR]);
        if (tbl === 'projects') return Response.json([{ id: projectId, project_code: 'PRJ-1', Property: 'برج كابيتال', status: 'قيد التنفيذ', current_stage: 'الخرسانات', contract_value: 1500000, estimated_budget: 26900 }]);
        if (tbl === 'boq_budget') {
          return Response.json([{
            id: 'boq-1', project_id: projectId, item_type: 'فرعي', work_item: 'كمرة الاستراوس',
            actual_labor_cost: 8600, actual_expenses_cost: 13650, actual_subcontractor_cost: 12000, actual_material_cost: 0,
            loaded_amount_egp: 0, completed_percentage: 20,
          }]);
        }
        if (tbl === 'project_payment_milestones') {
          return Response.json([{
            id: 'ms-1', project_id: projectId, milestone_number: 1, title: 'مقدمة', due_date: '2026-11-08',
            expected_amount: 150000, received_amount: 30000, receipt_voucher_id: 'rv-1', receipt_number: 'RV-2026-0001',
          }]);
        }
        if (tbl === 'labor_daily_logs') {
          return Response.json(isLate ? [] : [{
            id: 'log-1', work_date: date, worker_name: 'ابراهيم شداد', project_id: projectId,
            site_ref: 'برج كابيتال', work_item: 'كمرة الاستراوس', daily_wage: 700, attendance_value: 1, is_posted: true,
          }]);
        }
        if (tbl === 'expenses') {
          return Response.json(isLate ? [] : [
            { id: 'e1', exp_date: date, description: 'اكرامية خلاطة', total_price: 300, main_category: 'عمولات وبقشيش', is_posted: true },
            { id: 'e2', exp_date: date, description: 'ايجار يومي', total_price: 250, main_category: 'مصاريف إدارية', is_posted: true },
          ]);
        }
        if (tbl === 'payment_vouchers') {
          return Response.json(isLate ? [] : [
            { id: 'pv10', voucher_number: 'PV-2026-0010', date, amount: 250, description: 'سداد مصروف: ايجار يومي', status: 'معتمد', is_posted: true },
            { id: 'pv9', voucher_number: 'PV-2026-0009', date, amount: 300, description: 'سداد مصروف: اكرامية خلاطة', status: 'معتمد', is_posted: true },
            { id: 'pv8', voucher_number: 'PV-2026-0008', date, amount: 10000, partner_id: CONTRACTOR.id, sub_claim_id: 'sc1', debit_account_id: ACC_SUBCONTRACTORS.id, description: 'سداد قيمة مستخلص مقاول باطن رقم CLM-2026-0002', status: 'معتمد', is_posted: true },
            { id: 'pv7', voucher_number: 'PV-2026-0007', date, amount: 3000, partner_id: WORKER.id, debit_account_id: ACC_CUSTODY.id, description: 'عهده مصروفات عماله', status: 'معتمد', is_posted: true },
          ]);
        }
        return Response.json([]);
      },
    });

    const access = {
      companyId: egyptCompanyId,
      userId,
      companyName: 'PHI-TECH-EGY',
      companyCurrency: 'EGP',
      permissions: { labor_logs: ['view'], laborcost: ['view'], projects: ['view'], expenses: ['view'], payments: ['view'], inventory: ['view'], contractors: ['view'], receipts: ['view'] },
    };

    const raw = await tools.get_daily_comprehensive_report({
      date,
      section_permissions: { labor_logs: true, laborcost: true, projects: true, expenses: true, payments: true, inventory: true, contractors: true, receipts: true },
    });

    assert.equal(raw.currency_label, 'ج.م');
    assert.equal(raw.section_4_spent_on_labor.daily_logs_wages_total, 700);
    assert.equal(raw.section_4_spent_on_labor.labor_payment_vouchers_total, 0);
    assert.equal(raw.section_4_spent_on_labor.total_actual_cash_paid_for_labor, 0);
    assert.equal(raw.section_4_spent_on_labor.unpaid_daily_wages_today, 700);
    assert.equal(raw.section_4_spent_on_labor.custody_vouchers_today_total, 3000);
    assert.equal(raw.section_4_spent_on_labor.non_custody_payment_vouchers_today_total, 10550);

    const rendered = await runEnabledCopilotTool(
      { name: 'get_daily_comprehensive_report', args: { date } },
      tools,
      access
    );
    const parts = splitReportParts(rendered);
    const [mainPart, projectPart] = parts;

    assert.doesNotMatch(mainPart, /ر\.س|ريال/);
    assert.match(mainPart, /اليوميات المسجلة للعمال \(labor_daily_logs\): 700 ج\.م/);
    assert.match(mainPart, /سندات صرف يوميات\/أجور مصروفة للعمال: 0 ج\.م/);
    assert.match(mainPart, /إجمالي المنصرف الفعلي للعمالة النهارده: 0 ج\.م/);
    assert.match(mainPart, /يوميات مستحقة من النهارده لسه لم تُصرف بسند: 700 ج\.م/);
    assert.match(mainPart, /العُهد النقدية المسلّمة النهارده \(1 عهدة بإجمالي 3000 ج\.م/);
    assert.match(mainPart, /سندات الصرف النهارده \(3 سند بإجمالي 10550 ج\.م — بخلاف العُهد\)/);
    assert.match(projectPart, /تقرير المشاريع اليومي التفصيلي الشامل/);
    assert.match(projectPart, /برج كابيتال/);
    assert.match(projectPart, /التكلفة الفعلية التراكمية: 22,250 ج\.م/);
    assert.match(projectPart, /جدول دفعات العميل: المجدول 150,000 ج\.م \| المحصل 30,000 ج\.م/);
  } finally {
    if (prevFlag === undefined) delete process.env.COPILOT_LIVE_FIELD_OPS_ENABLED;
    else process.env.COPILOT_LIVE_FIELD_OPS_ENABLED = prevFlag;
  }
});

test('Daily comprehensive report: actual worker wage voucher is counted as labor disbursement without adding unpaid logs on top, and Saudi company keeps SAR (ر.س)', async () => {
  const prevFlag = process.env.COPILOT_LIVE_FIELD_OPS_ENABLED;
  process.env.COPILOT_LIVE_FIELD_OPS_ENABLED = 'true';
  try {
    const tools = createCopilotTools({
      supabaseUrl,
      supabaseKey,
      accessToken,
      companyId: saudiCompanyId,
      detailedReads: true,
      async fetchImpl(url) {
        const tbl = new URL(url).pathname.replace('/rest/v1/', '');
        const isLate = new URL(url).searchParams.has('created_at');
        if (tbl === 'companies') return Response.json([{ id: saudiCompanyId, name: 'فاي تك', currency: 'SAR', country: 'SA' }]);
        if (tbl === 'accounts') return Response.json([ACC_WAGES_PAYABLE]);
        if (tbl === 'partners') return Response.json([WORKER]);
        if (tbl === 'labor_daily_logs') {
          return Response.json(isLate ? [] : [{
            id: 'log-2', work_date: date, worker_name: 'ابراهيم شداد', site_ref: 'فيلا 1', work_item: 'نجارة', daily_wage: 700, attendance_value: 1, is_posted: true,
          }]);
        }
        if (tbl === 'payment_vouchers') {
          return Response.json(isLate ? [] : [
            { id: 'pv-wage', voucher_number: 'PV-2026-0020', date, amount: 700, partner_id: WORKER.id, debit_account_id: ACC_WAGES_PAYABLE.id, description: 'سداد يومية ابراهيم شداد', status: 'معتمد', is_posted: true },
          ]);
        }
        return Response.json([]);
      },
    });

    const access = {
      companyId: saudiCompanyId,
      userId,
      companyName: 'فاي تك',
      companyCurrency: 'SAR',
      permissions: { labor_logs: ['view'], laborcost: ['view'], projects: ['view'], expenses: ['view'], payments: ['view'], inventory: ['view'], contractors: ['view'], receipts: ['view'] },
    };

    const rendered = await runEnabledCopilotTool(
      { name: 'get_daily_comprehensive_report', args: { date } },
      tools,
      access
    );
    const [mainPart] = splitReportParts(rendered);
    assert.match(mainPart, /اليوميات المسجلة للعمال \(labor_daily_logs\): 700 ر\.س/);
    assert.match(mainPart, /سندات صرف يوميات\/أجور مصروفة للعمال: 700 ر\.س/);
    assert.match(mainPart, /إجمالي المنصرف الفعلي للعمالة النهارده: 700 ر\.س/);
    assert.doesNotMatch(mainPart, /1400 ر\.س/);
    assert.doesNotMatch(mainPart, /ج\.م/);

    // Verify voice cleanSpeechLine reads ج.م as جنيه مصري
    assert.match(prepareSpeechText('المبلغ: 3000 ج.م'), /جنيه مصري/);
  } finally {
    if (prevFlag === undefined) delete process.env.COPILOT_LIVE_FIELD_OPS_ENABLED;
    else process.env.COPILOT_LIVE_FIELD_OPS_ENABLED = prevFlag;
  }
});
