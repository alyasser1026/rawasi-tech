import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDailyWorkerExpenseAllocations,
  isExpenseEligibleForDailyWorkerAllocation,
  getExpenseNetAmount,
} from '../lib/dailyWorkerExpenseAllocation.ts';

test('Daily Worker Expense Allocation: allocates general expense by exact day worker counts across villas and job orders', () => {
  const projects = [
    { id: 'v888', company_id: 'c1', project_name: 'فيلا 888', project_code: 'V-888' },
    { id: 'v887', company_id: 'c1', project_name: 'فيلا 887', project_code: 'V-887' },
  ];

  const boqItems = [
    { id: 'boq-888', company_id: 'c1', project_id: 'v888', item_name: 'معجون' },
    { id: 'boq-887', company_id: 'c1', project_id: 'v887', item_name: 'معجون' },
  ];

  const jobOrders = [
    {
      id: 'jo-7',
      company_id: 'c1',
      project_id: 'v888',
      boq_budget_id: 'boq-888',
      order_number: 'JO-2026-0007',
      order_description: 'معجون فيلا 888',
      status: 'active',
    },
    {
      id: 'jo-8',
      company_id: 'c1',
      project_id: 'v887',
      boq_budget_id: 'boq-887',
      order_number: 'JO-2026-0008',
      order_description: 'معجون فيلا 887',
      status: 'active',
    },
  ];

  const attendance = [
    {
      id: 'a1',
      company_id: 'c1',
      project_id: 'v888',
      job_order_id: 'jo-7',
      work_date: '2026-11-15',
      number_of_workers: 4,
      attendance_value: 4,
    },
    {
      id: 'a2',
      company_id: 'c1',
      project_id: 'v887',
      job_order_id: 'jo-8',
      work_date: '2026-11-15',
      number_of_workers: 3,
      attendance_value: 3,
    },
  ];

  const expenses = [
    {
      id: 'exp-1',
      company_id: 'c1',
      project_id: null,
      job_order_id: null,
      exp_date: '2026-11-15',
      amount: 161,
      tax_amount: 0,
      discount_amount: 0,
      category: 'مصروفات عامة ومشتركة',
      description: 'مصاريف نقل وإعاشة يومية',
    },
  ];

  const rows = computeDailyWorkerExpenseAllocations({
    expenses,
    attendance,
    jobOrders,
    projects,
    boqItems,
  });

  assert.equal(rows.length, 2);

  const row888 = rows.find((r) => r.project_id === 'v888');
  const row887 = rows.find((r) => r.project_id === 'v887');

  assert.ok(row888);
  assert.ok(row887);

  // 4 / 7 of 161 = 92, 3 / 7 of 161 = 69
  assert.equal(row888.allocated_amount, 92);
  assert.equal(row888['المبلغ المحمل (ر.س)'], 92);
  assert.equal(row888['المبلغ المحمل (جنيه)'], 92);
  assert.equal(row888.worker_count, 4);
  assert.equal(row888.total_workers_in_pool, 7);
  assert.equal(row888.job_order_id, 'jo-7');

  assert.equal(row887.allocated_amount, 69);
  assert.equal(row887.worker_count, 3);
  assert.equal(row887.total_workers_in_pool, 7);
  assert.equal(row887.job_order_id, 'jo-8');

  // Exact sum preservation
  assert.equal(row888.allocated_amount + row887.allocated_amount, 161);
});

test('Daily Worker Expense Allocation: allocates villa-assigned expense without job_order_id across that villa job orders by worker count', () => {
  const projects = [
    { id: 'v888', company_id: 'c1', project_name: 'فيلا 888', project_code: 'V-888' },
    { id: 'v887', company_id: 'c1', project_name: 'فيلا 887', project_code: 'V-887' },
  ];

  const jobOrders = [
    { id: 'jo-1', company_id: 'c1', project_id: 'v888', boq_budget_id: 'b1', order_number: 'JO-1' },
    { id: 'jo-2', company_id: 'c1', project_id: 'v888', boq_budget_id: 'b2', order_number: 'JO-2' },
    { id: 'jo-other', company_id: 'c1', project_id: 'v887', boq_budget_id: 'b3', order_number: 'JO-3' },
  ];

  const attendance = [
    { id: 'a1', company_id: 'c1', project_id: 'v888', job_order_id: 'jo-1', work_date: '2026-11-16', number_of_workers: 6 },
    { id: 'a2', company_id: 'c1', project_id: 'v888', job_order_id: 'jo-2', work_date: '2026-11-16', number_of_workers: 2 },
    { id: 'a3', company_id: 'c1', project_id: 'v887', job_order_id: 'jo-other', work_date: '2026-11-16', number_of_workers: 10 },
  ];

  const expenses = [
    {
      id: 'exp-villa-only',
      company_id: 'c1',
      project_id: 'v888',
      job_order_id: null,
      exp_date: '2026-11-16',
      amount: 400,
      tax_amount: 0,
      discount_amount: 0,
      category: 'تشوين خامات ومواد',
    },
  ];

  assert.equal(isExpenseEligibleForDailyWorkerAllocation(expenses[0]), true);
  assert.equal(getExpenseNetAmount(expenses[0]), 400);

  const rows = computeDailyWorkerExpenseAllocations({
    expenses,
    attendance,
    jobOrders,
    projects,
    boqItems: [],
  });

  // Should only allocate onto v888's job orders (jo-1 and jo-2), ignoring v887's jo-other
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.project_id === 'v888'));

  const jo1 = rows.find((r) => r.job_order_id === 'jo-1');
  const jo2 = rows.find((r) => r.job_order_id === 'jo-2');

  // 6/8 of 400 = 300, 2/8 of 400 = 100
  assert.equal(jo1.allocated_amount, 300);
  assert.equal(jo2.allocated_amount, 100);
});

test('Daily Worker Expense Allocation: strictly isolates companies (no cross-company leakage)', () => {
  const projects = [
    { id: 'v-saudi', company_id: 'company-saudi', project_name: 'فيلا 888' },
    { id: 'v-egypt', company_id: 'company-egypt', project_name: 'برج كابيتال' },
  ];

  const jobOrders = [
    { id: 'jo-saudi', company_id: 'company-saudi', project_id: 'v-saudi', order_number: 'JO-SA' },
    { id: 'jo-egypt', company_id: 'company-egypt', project_id: 'v-egypt', order_number: 'JO-EG' },
  ];

  const attendance = [
    { id: 'a-sa', company_id: 'company-saudi', project_id: 'v-saudi', job_order_id: 'jo-saudi', work_date: '2026-11-14', number_of_workers: 4 },
    { id: 'a-eg', company_id: 'company-egypt', project_id: 'v-egypt', job_order_id: 'jo-egypt', work_date: '2026-11-29', number_of_workers: 13 },
  ];

  const expenses = [
    {
      id: 'exp-saudi',
      company_id: 'company-saudi',
      project_id: null,
      job_order_id: null,
      exp_date: '2026-11-29',
      amount: 365,
      category: 'مصروفات عامة ومشتركة',
    },
  ];

  const rows = computeDailyWorkerExpenseAllocations({
    expenses,
    attendance,
    jobOrders,
    projects,
    boqItems: [],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].project_id, 'v-saudi');
  assert.equal(rows[0].job_order_id, 'jo-saudi');
  assert.equal(rows[0].allocated_amount, 365);
});
