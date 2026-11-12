import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMilestoneSchedule, resolveMilestoneStatus, MILESTONE_CONTRACTUAL_DISCLAIMER } from '../lib/milestoneSchedule.ts';

const capitalMilestones = [
  { id: 'm1', milestone_number: 1, title: 'مقدمة', due_date: '2026-11-08', expected_amount: '150000', received_amount: '0', status: 'مستحقة' },
  { id: 'm2', milestone_number: 2, title: 'الأساسات', due_date: '2026-12-08', expected_amount: '375000', received_amount: '0', status: 'مستحقة' },
  { id: 'm3', milestone_number: 3, title: 'البدروم', due_date: '2026-11-15', expected_amount: '100000', received_amount: '0', status: 'مستحقة' },
];
const receipts = [{ id: 'rv1', receipt_number: 'RV-2026-0001', date: '2026-11-10', amount: '30000.00' }];

test('Milestone schedule: allocates unlinked project receipts FIFO and flags overdue partial', () => {
  const s = buildMilestoneSchedule(capitalMilestones, receipts, '2026-11-11');
  const [first, second, third] = s.rows;
  assert.equal(first.number, 1);
  assert.equal(first.paid, 30000);
  assert.equal(first.remaining, 120000);
  assert.equal(first.status.key, 'overdue_partial');
  assert.equal(first.daysDiff, 3);
  assert.equal(first.daysLabel, 'متأخرة 3 يوم');
  assert.deepEqual(first.receiptRefs, ['RV-2026-0001']);
  // sorted by due date: 2026-11-15 comes before 2026-12-08
  assert.equal(second.number, 3);
  assert.equal(second.status.key, 'collecting');
  assert.equal(second.daysLabel, 'متبقي 4 يوم');
  assert.equal(third.status.key, 'scheduled');
  assert.equal(s.totalScheduled, 625000);
  assert.equal(s.totalReceived, 30000);
  assert.equal(s.totalRemaining, 595000);
  assert.equal(s.overdueAmount, 120000);
  assert.equal(s.unallocatedAdvance, 0);
  assert.equal(s.nextDue.number, 1);
});

test('Milestone schedule: manual links take priority and excess becomes advance', () => {
  const ms = [
    { id: 'a', milestone_number: 1, due_date: '2026-10-01', expected_amount: 1000, received_amount: 1000, receipt_voucher_id: 'rv1', receipt_number: 'RV-1', status: 'محصلة بالكامل' },
    { id: 'b', milestone_number: 2, due_date: '2026-12-30', expected_amount: 500, received_amount: 0, status: 'مستحقة' },
  ];
  const rv = [
    { id: 'rv1', receipt_number: 'RV-1', date: '2026-10-01', amount: 1000 },
    { id: 'rv2', receipt_number: 'RV-2', date: '2026-11-01', amount: 800 },
  ];
  const s = buildMilestoneSchedule(ms, rv, '2026-11-11');
  assert.equal(s.rows[0].status.key, 'paid');
  assert.equal(s.rows[1].paid, 500);
  assert.equal(s.rows[1].status.key, 'paid');
  assert.equal(s.unallocatedAdvance, 300);
  assert.equal(s.totalReceived, 1800);
  assert.equal(s.totalRemaining, 0);
  assert.equal(s.collectionRate, 100);
});

test('Milestone schedule: cancelled milestones are excluded from totals and allocation', () => {
  const ms = [
    { id: 'x', milestone_number: 1, due_date: '2026-10-01', expected_amount: 1000, status: 'ملغاة' },
    { id: 'y', milestone_number: 2, due_date: '2026-11-11', expected_amount: 400, status: 'مستحقة' },
  ];
  const s = buildMilestoneSchedule(ms, [], '2026-11-11');
  assert.equal(s.rows[0].status.key, 'cancelled');
  assert.equal(s.rows[1].status.key, 'collecting');
  assert.equal(s.rows[1].daysLabel, 'تستحق اليوم');
  assert.equal(s.totalScheduled, 400);
  assert.equal(s.totalRemaining, 400);
});

test('Milestone status: partial before due date is "محصلة جزئياً"', () => {
  const r = resolveMilestoneStatus(1000, 200, '2026-12-01', '2026-11-11', 'مستحقة');
  assert.equal(r.status.key, 'partial');
  assert.equal(r.status.label, 'محصلة جزئياً');
});

test('Milestone contractual disclaimer: includes 3-month owner delay condition, schedule replanning, and price adjustment', () => {
  assert.ok(typeof MILESTONE_CONTRACTUAL_DISCLAIMER === 'string');
  assert.ok(MILESTONE_CONTRACTUAL_DISCLAIMER.includes('ثلاثة (3) أشهر') || MILESTONE_CONTRACTUAL_DISCLAIMER.includes('ثلاث'));
  assert.ok(MILESTONE_CONTRACTUAL_DISCLAIMER.includes('المالك'));
  assert.ok(MILESTONE_CONTRACTUAL_DISCLAIMER.includes('فني أو تقني'));
  assert.ok(MILESTONE_CONTRACTUAL_DISCLAIMER.includes('تعديل وتحديث الأسعار') || MILESTONE_CONTRACTUAL_DISCLAIMER.includes('تعديل الأسعار'));
  assert.ok(MILESTONE_CONTRACTUAL_DISCLAIMER.includes('الجدول الزمني'));
});
