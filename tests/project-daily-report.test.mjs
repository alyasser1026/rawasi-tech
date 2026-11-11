import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectDailyReport, classifyProjectVoucher } from '../lib/projectDailyReport.ts';

test('Project Daily Report separates tech/helper labor, custodies (125), non-custody vouchers, receipts, and cumulative totals', () => {
  const project = {
    id: 'p1',
    Property: 'برج كابيتال',
    project_code: 'PRJ-1',
    status: 'قيد التنفيذ',
    current_stage: 'الاساسات',
    contract_value: 1500000,
    estimated_budget: 26900,
    overall_completion_percentage: 25,
    client: { name: 'مكتب الزهيري' },
    engineer_in_charge: 'م/ بهاء',
  };

  const details = {
    boq: [
      {
        id: 'b1',
        item_type: 'فرعي',
        work_item: 'كمرة الاستراوس',
        estimated_labor_cost: 10900,
        estimated_expenses_cost: 1000,
        estimated_subcontractor_cost: 15000,
        actual_labor_cost: 8600,
        actual_expenses_cost: 13650,
        actual_subcontractor_cost: 12000,
        actual_material_cost: 0,
        allocated_expenses: 0,
      },
    ],
    laborStats: {
      logs: [
        { id: 'l1', work_date: '2026-11-11', worker_name: 'ابراهيم شداد', skill_level: 'نجار مسلح', daily_wage: 700, attendance_days: 1 },
        { id: 'l2', work_date: '2026-11-11', worker_name: 'حبيشه', skill_level: 'مساعد', daily_wage: 300, attendance_days: 1 },
        { id: 'l3', work_date: '2026-11-10', worker_name: 'ابراهيم شداد', skill_level: 'نجار مسلح', daily_wage: 700, attendance_days: 1 },
      ],
    },
    expenses: [
      { id: 'e1', exp_date: '2026-11-11', description: 'ايجار يومي', total_price: 250, main_category: 'مصاريف إدارية' },
      { id: 'e2', exp_date: '2026-11-11', description: 'اكرامية خلاطة', total_price: 300, main_category: 'عمولات' },
      { id: 'synth', exp_date: '2026-11-11', row_type: 'labor_direct', total_price: 1000 },
    ],
    paymentVouchers: [
      {
        id: 'pv7', voucher_number: 'PV-2026-0007', date: '2026-11-11', amount: 3000, project_ids: ['p1'],
        description: 'عهده مصروفات عماله', debit_account: { code: '125', name: 'عُهد الموظفين والمواقع' },
      },
      {
        id: 'pv8', voucher_number: 'PV-2026-0008', date: '2026-11-11', amount: 10000, project_ids: ['p1'],
        sub_claim_id: 'sc2', description: 'سداد مستخلص مقاول باطن',
      },
    ],
    projectReceipts: [
      { id: 'rv1', receipt_number: 'RV-2026-0001', date: '2026-11-10', amount: 30000, project_ids: ['p1'] },
    ],
    milestones: [
      { id: 'm1', milestone_number: 1, title: 'مقدمة', due_date: '2026-11-08', expected_amount: 150000, received_amount: 30000, receipt_voucher_id: 'rv1', receipt_number: 'RV-2026-0001' },
    ],
    siteVisits: [
      { id: 'v1', visit_date: '2026-11-11', title: 'فحص الشدة', inspector_name: 'م/ بهاء', status: 'معتمدة' },
    ],
    jobOrders: [
      { id: 'jo1', order_number: 'JO-2026-0001', status: 'جاري التنفيذ' },
    ],
  };

  assert.equal(classifyProjectVoucher(details.paymentVouchers[0]), 'custody');
  assert.equal(classifyProjectVoucher(details.paymentVouchers[1]), 'sub_claim');

  const r = buildProjectDailyReport(project, details, '2026-11-11', '2026-11-11');
  assert.equal(r.hasActivityToday, true);
  assert.deepEqual(r.activeDates, ['2026-11-11', '2026-11-10']);

  // Tech vs helper labor on 2026-11-11
  assert.equal(r.today.labor.techDays, 1);
  assert.equal(r.today.labor.techCost, 700);
  assert.equal(r.today.labor.helperDays, 1);
  assert.equal(r.today.labor.helperCost, 300);
  assert.equal(r.today.labor.totalCost, 1000);

  // Direct expenses (synth labor excluded)
  assert.equal(r.today.expenses.count, 2);
  assert.equal(r.today.expenses.total, 550);

  // Custodies separated from vouchers
  assert.equal(r.today.custodies.count, 1);
  assert.equal(r.today.custodies.total, 3000);
  assert.equal(r.today.vouchers.count, 1);
  assert.equal(r.today.vouchers.total, 10000);
  assert.equal(r.today.vouchers.wagePayoutsTotal, 0);

  // Cumulative & Milestones
  assert.equal(r.cumulative.totalActualCost, 22250);
  assert.equal(r.cumulative.budgetVariance, 4650);
  assert.equal(r.cumulative.totalCashCollected, 30000);
  assert.equal(r.cumulative.paymentSchedule.overdueAmount, 120000);
  assert.equal(r.today.siteVisits.count, 1);
  assert.equal(r.today.jobOrders.active.length, 1);
});
