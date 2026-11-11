import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvmAnalysis, extractEvmLeafItems, resolveScheduleRatio } from '../lib/evmAnalysis.ts';

test('EVM ignores parent phases, avoids false +budget variance on unstarted items, and separates BAC/PV/EV/AC', () => {
  const boqList = [
    {
      id: 'parent-1',
      item_type: 'رئيسي',
      work_item: 'الأعمال الإنشائية',
      total_contract_amount: 0,
      estimated_labor_cost: 0,
      estimated_expenses_cost: 0,
    },
    {
      id: 'boq-strauss',
      parent_id: 'parent-1',
      boq_item_id: 'cat-strauss',
      item_type: 'فرعي',
      work_item: 'كمرة الاستراوس',
      contract_quantity: 1,
      unit_contract_price: 50000,
      total_contract_amount: 50000,
      estimated_labor_cost: 7600,
      estimated_subcontractor_cost: 0,
      estimated_material_cost: 0,
      estimated_expenses_cost: 19300,
      actual_labor_cost: 8600,
      actual_material_cost: 0,
      actual_expenses_cost: 13650,
      allocated_expenses: 0,
      completed_percentage: 0,
      start_date: '2026-11-08',
      end_date: '2026-11-12',
      execution_status: 'تحت التنفيذ',
    },
    {
      id: 'boq-raft',
      parent_id: 'parent-1',
      boq_item_id: 'cat-raft',
      item_type: 'فرعي',
      work_item: 'لبشة مسلحة / Reinforced Concrete (R.C.) Raft / Mat Foundation',
      contract_quantity: 1,
      unit_contract_price: 100000,
      total_contract_amount: 100000,
      estimated_labor_cost: 2700,
      estimated_subcontractor_cost: 0,
      estimated_material_cost: 0,
      estimated_expenses_cost: 110000,
      actual_labor_cost: 0,
      actual_material_cost: 0,
      actual_expenses_cost: 0,
      allocated_expenses: 0,
      completed_percentage: 0,
      start_date: '2026-12-14',
      end_date: '2026-12-22',
      execution_status: 'لم يتم البدئ',
    },
  ];

  const laborLogs = [
    { work_item_id: 'cat-strauss', job_order_boq_id: 'boq-strauss', completion_percentage: 10 },
    { work_item_id: 'cat-strauss', job_order_boq_id: 'boq-strauss', completion_percentage: null },
  ];

  const res = buildEvmAnalysis(boqList, {
    asOfDate: '2026-11-11',
    project: { start_date: '2026-11-08', end_date: '2027-04-01' },
    laborLogs,
  });

  assert.equal(res.rows.length, 2);
  assert.equal(extractEvmLeafItems(boqList).length, 2);

  // لبشة مسلحة: لم تبدأ بعد -> CV = 0 (وليس +112,700!) مع رصد عجز التسعير -12,700
  const raft = res.rows[1];
  assert.equal(raft.plannedValueToDate, 0);
  assert.equal(raft.earnedValue, 0);
  assert.equal(raft.totalActual, 0);
  assert.equal(raft.costVariance, 0);
  assert.equal(raft.scheduleVariance, 0);
  assert.equal(raft.remainingBudget, 112700);
  assert.equal(raft.pricingMargin, -12700);
  assert.equal(raft.isPricingDeficit, true);
  assert.equal(raft.status, 'not_started');

  // كمرة الاستراوس: 4/5 من المدة -> PV = 21,520 | 10% إنجاز -> EV = 2,690 (من الميزانية وليس 50,000 التعاقد!)
  const strauss = res.rows[0];
  assert.equal(strauss.budgetCost, 26900);
  assert.equal(strauss.plannedValueToDate, 21520);
  assert.equal(strauss.progressPct, 10);
  assert.equal(strauss.progressSource, 'labor_log');
  assert.equal(strauss.earnedValue, 2690);
  assert.equal(strauss.totalActual, 22250);
  assert.equal(strauss.costVariance, -19560);
  assert.equal(strauss.scheduleVariance, -18830);
  assert.equal(strauss.status, 'cost_overrun');

  // مجاميع المشروع
  assert.equal(res.bac, 139600);
  assert.equal(res.plannedValue, 21520);
  assert.equal(res.earnedValue, 2690);
  assert.equal(res.actualCost, 22250);
  assert.equal(res.costVariance, -19560);
  assert.equal(res.scheduleVariance, -18830);
  assert.equal(res.cpi, 0.12);
  assert.equal(res.spi, 0.13);
  assert.equal(res.isCostOverrun, true);
  assert.equal(res.isBehindSchedule, true);
  assert.equal(res.pricingDeficitCount, 1);
});

test('EVM calculates genuine savings, CPI > 1, and EAC on completed items with ABC allocations', () => {
  const res = buildEvmAnalysis([
    {
      id: 'item-done',
      item_type: 'فرعي',
      work_item: 'أساسات',
      total_contract_amount: 50000,
      estimated_labor_cost: 10000,
      estimated_expenses_cost: 16900,
      actual_labor_cost: 8600,
      actual_expenses_cost: 11400,
      allocated_expenses: 2250,
      execution_status: 'انتهى',
      start_date: '2026-11-01',
      end_date: '2026-11-10',
    },
  ], { asOfDate: '2026-11-11' });

  const row = res.rows[0];
  assert.equal(row.progressPct, 100);
  assert.equal(row.progressSource, 'status');
  assert.equal(row.plannedValueToDate, 26900);
  assert.equal(row.earnedValue, 26900);
  assert.equal(row.directActual, 20000);
  assert.equal(row.allocatedAbc, 2250);
  assert.equal(row.totalActual, 22250);
  assert.equal(row.costVariance, 4650);
  assert.equal(row.status, 'under_budget');
  assert.equal(res.cpi, 1.21);
  assert.equal(res.spi, 1);
  assert.equal(res.eac, 22250);
  assert.equal(res.vac, 4650);
  assert.equal(row.netProfit, 27750);
});

test('EVM flags spending without progress entry and prevents ambiguous catalog_id bleed across duplicate items', () => {
  const res = buildEvmAnalysis([
    {
      id: 'col-3',
      boq_item_id: 'shared-cat',
      item_type: 'فرعي',
      work_item: 'أعمدة دور ثالث',
      total_contract_amount: 100000,
      estimated_labor_cost: 20000,
      actual_labor_cost: 5000,
      completed_percentage: 0,
    },
    {
      id: 'col-4',
      boq_item_id: 'shared-cat',
      item_type: 'فرعي',
      work_item: 'أعمدة دور رابع',
      total_contract_amount: 100000,
      estimated_labor_cost: 20000,
      actual_labor_cost: 0,
      completed_percentage: 0,
    },
  ], {
    asOfDate: '2026-11-11',
    laborLogs: [
      // شهادة الإنجاز مرتبطة بـ work_item_id = 'shared-cat' فقط دون تحديد الصف الأب فالمفروض لا تتسرب عشوائياً
      { work_item_id: 'shared-cat', completion_percentage: 50 },
    ],
  });

  assert.equal(res.rows[0].progressPct, 0);
  assert.equal(res.rows[0].status, 'missing_progress');
  assert.equal(res.rows[0].costVariance, -5000);
  assert.equal(res.rows[1].progressPct, 0);
  assert.equal(res.rows[1].status, 'not_started');
  assert.equal(res.missingProgressCount, 1);
  assert.equal(res.eac, null);
});

test('resolveScheduleRatio handles before, during, after, and missing dates accurately', () => {
  assert.equal(resolveScheduleRatio('2026-12-01', '2026-12-10', null, null, '2026-11-11'), 0);
  assert.equal(resolveScheduleRatio('2026-11-01', '2026-11-10', null, null, '2026-11-11'), 1);
  assert.equal(resolveScheduleRatio('2026-11-08', '2026-11-12', null, null, '2026-11-11'), 0.8);
  assert.equal(resolveScheduleRatio(null, null, '2026-11-01', '2026-11-10', '2026-11-05'), 0.5);
  assert.equal(resolveScheduleRatio(null, null, null, null, '2026-11-11'), 1);
});
