import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeJobOrderProgressAndTimeline } from '../lib/jobOrderProgress.ts';

test('Job Order Progress: fully completed item (1 of 1)', () => {
    const jo = {
        id: 'jo-1',
        order_number: 'JO-2026-0001',
        assigned_qty: 1,
        status: 'مكتمل',
        start_date: '2026-11-08',
        end_date: '2026-11-12',
        boq_budget_id: 'boq-1',
        boq_budget: {
            id: 'boq-1',
            work_item: 'كمرة الاستراوس',
            unit: 'متر طولي',
            contract_quantity: 1
        }
    };

    // When evaluated at 2026-11-14 (2 days late)
    const result = computeJobOrderProgressAndTimeline(jo, [jo], '2026-11-14');

    assert.equal(result.contractQty, 1);
    assert.equal(result.completedQty, 1);
    assert.equal(result.progressPercent, 100);
    assert.equal(result.isFullyCompleted, true);
    assert.equal(result.remainingQty, 0);

    // Timeline: 2 days after end_date (2026-11-12)
    assert.equal(result.timelineCategory, 'completed_late');
    assert.equal(result.timelineBadgeText, 'متأخر زمنياً بـ 2 يوم');
    assert.equal(result.isDelayed, true);
    assert.equal(result.isTimelineCompleted, true);
});

test('Job Order Progress: completed on time', () => {
    const jo = {
        id: 'jo-2',
        order_number: 'JO-2026-0002',
        assigned_qty: 10,
        status: 'مكتمل',
        start_date: '2026-11-01',
        end_date: '2026-11-15',
        boq_budget_id: 'boq-2',
        boq_budget: {
            id: 'boq-2',
            work_item: 'أعمال المحارة',
            unit: 'م2',
            contract_quantity: 10
        }
    };

    // When evaluated at 2026-11-10 (5 days before end_date)
    const result = computeJobOrderProgressAndTimeline(jo, [jo], '2026-11-10');

    assert.equal(result.progressPercent, 100);
    assert.equal(result.isFullyCompleted, true);
    assert.equal(result.timelineCategory, 'completed_on_time');
    assert.equal(result.timelineBadgeText, 'مكتمل ومتقدم بـ 5 يوم');
    assert.equal(result.isDelayed, false);
});

test('Job Order Progress: partial completion across multiple orders (50 of 100)', () => {
    const jo1 = {
        id: 'jo-a',
        order_number: 'JO-01',
        assigned_qty: 50,
        status: 'مكتمل',
        boq_budget_id: 'boq-3',
        start_date: '2026-11-01',
        end_date: '2026-11-20',
        boq_budget: { id: 'boq-3', work_item: 'بياض واجهات', unit: 'م2', contract_quantity: 100 }
    };
    const jo2 = {
        id: 'jo-b',
        order_number: 'JO-02',
        assigned_qty: 50,
        status: 'جاري التنفيذ',
        boq_budget_id: 'boq-3',
        start_date: '2026-11-10',
        end_date: '2026-11-20',
        boq_budget: { id: 'boq-3', work_item: 'بياض واجهات', unit: 'م2', contract_quantity: 100 }
    };

    const all = [jo1, jo2];
    const resultJo1 = computeJobOrderProgressAndTimeline(jo1, all, '2026-11-14');
    assert.equal(resultJo1.contractQty, 100);
    assert.equal(resultJo1.completedQty, 50);
    assert.equal(resultJo1.progressPercent, 50);
    assert.equal(resultJo1.isFullyCompleted, false);
    assert.equal(resultJo1.remainingQty, 50);

    // Timeline for in-progress jo2 (evaluated at 2026-11-14, end_date is 2026-11-20 -> 6 days remaining)
    const resultJo2 = computeJobOrderProgressAndTimeline(jo2, all, '2026-11-14');
    assert.equal(resultJo2.timelineCategory, 'in_schedule');
    assert.equal(resultJo2.timelineBadgeText, 'غير مكتمل زمنياً بعد (متبقي 6 يوم)');
    assert.equal(resultJo2.isTimelineCompleted, false);
    assert.equal(resultJo2.isDelayed, false);
});
