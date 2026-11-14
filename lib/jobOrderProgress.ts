/**
 * lib/jobOrderProgress.ts
 * حساب تقدم بنود المقايسة والموقف الزمني لأوامر التشغيل
 */

export interface JobOrderItemProgress {
    boqBudgetId: string | null;
    workItemName: string;
    unit: string;
    contractQty: number;
    completedQty: number;
    progressPercent: number; // 0 to 100
    isFullyCompleted: boolean;
    remainingQty: number;

    startDate: string | null;
    endDate: string | null;
    diffDays: number;
    timelineCategory: 'completed_on_time' | 'completed_late' | 'in_schedule' | 'overdue' | 'no_date';
    timelineBadgeText: string;
    timelineStatusDesc: string;
    timelineTone: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
    isTimelineCompleted: boolean;
    isDelayed: boolean;

    summaryMessage: string;
}

export function computeJobOrderProgressAndTimeline(
    jo: any,
    allJobOrders: any[] = [],
    referenceDate?: string
): JobOrderItemProgress {
    const boqBudgetId = jo?.boq_budget_id || jo?.boq_budget?.id || null;
    const boqObj = jo?.boq_budget || {};
    const workItemName = boqObj?.work_item || jo?.job_order_name || 'بند أعمال';
    const unit = boqObj?.unit || 'وحدة';

    // 1. حساب الكميات والتقدم في بند المقايسة
    let contractQty = Number(boqObj?.contract_quantity || 0);

    // تجميع كافة أوامر الشغل التابعة لنفس بند المقايسة
    const siblingOrders = (allJobOrders || []).filter(
        (other: any) => (other?.boq_budget_id && boqBudgetId && other.boq_budget_id === boqBudgetId) ||
                        (other?.id && jo?.id && other.id === jo.id)
    );

    if (contractQty <= 0) {
        if (siblingOrders.length > 0) {
            contractQty = siblingOrders.reduce((sum: number, o: any) => sum + Number(o?.assigned_qty || 0), 0);
        }
        if (contractQty <= 0) {
            contractQty = Number(jo?.assigned_qty || 1);
        }
    }

    // الكميات المنجزة من واقع أوامر الشغل المكتملة
    let completedQty = 0;
    if (siblingOrders.length > 0) {
        completedQty = siblingOrders
            .filter((o: any) => {
                // إذا كان الأمر الحالي يتم فحصه وهو مكتمل، نعتبره مكتملاً
                if (jo?.id && o?.id === jo.id) {
                    return jo.status === 'مكتمل';
                }
                return o?.status === 'مكتمل';
            })
            .reduce((sum: number, o: any) => sum + Number(o?.assigned_qty || 0), 0);
    } else if (jo?.status === 'مكتمل') {
        completedQty = Number(jo?.assigned_qty || contractQty);
    }

    // نسبة الإنجاز
    const progressPercent = contractQty > 0
        ? Math.min(100, Math.round((completedQty / contractQty) * 100))
        : (jo?.status === 'مكتمل' ? 100 : 0);

    const isFullyCompleted = progressPercent >= 100;
    const remainingQty = Math.max(0, contractQty - completedQty);

    // 2. حساب الموقف الزمني (Timeline / Schedule Status)
    const startDate = jo?.start_date || boqObj?.start_date || null;
    const endDate = jo?.end_date || boqObj?.end_date || null;

    const todayStr = referenceDate || new Date().toISOString().split('T')[0];

    let diffDays = 0;
    let timelineCategory: JobOrderItemProgress['timelineCategory'] = 'no_date';
    let timelineBadgeText = 'بدون جدول زمني';
    let timelineStatusDesc = 'لم يتم تحديد تاريخ انتهاء مخطط للبند';
    let timelineTone: JobOrderItemProgress['timelineTone'] = 'neutral';
    let isDelayed = false;
    let isTimelineCompleted = false;

    if (!endDate) {
        if (jo?.status === 'مكتمل') {
            timelineBadgeText = 'مكتمل (بدون موعد مخطط)';
            timelineTone = 'success';
            timelineStatusDesc = 'تم إنجاز أمر الشغل (بدون تاريخ نهاية مخطط)';
            isTimelineCompleted = true;
        }
    } else {
        const endD = new Date(endDate + 'T00:00:00');
        const refD = new Date(todayStr + 'T00:00:00');
        diffDays = Math.round((refD.getTime() - endD.getTime()) / (1000 * 60 * 60 * 24));
        const diffAbs = Math.abs(diffDays);

        if (jo?.status === 'مكتمل') {
            isTimelineCompleted = true;
            if (diffDays <= 0) {
                timelineCategory = 'completed_on_time';
                timelineBadgeText = diffDays === 0 ? 'مكتمل في الموعد' : `مكتمل ومتقدم بـ ${diffAbs} يوم`;
                timelineTone = 'success';
                timelineStatusDesc = diffDays === 0
                    ? `مكتمل ضمن الجدول الزمني تماماً (${endDate})`
                    : `مكتمل قبل الموعد المخطط بـ ${diffAbs} يوم (تاريخ النهاية: ${endDate})`;
                isDelayed = false;
            } else {
                timelineCategory = 'completed_late';
                timelineBadgeText = `متأخر زمنياً بـ ${diffDays} يوم`;
                timelineTone = 'danger';
                timelineStatusDesc = `مكتمل مع تأخير قدره ${diffDays} يوم عن الجدول الزمني المخطط (${endDate})`;
                isDelayed = true;
            }
        } else {
            // الأمر غير مكتمل (جاري التنفيذ / مسودة / موقوف)
            if (diffDays > 0) {
                timelineCategory = 'overdue';
                timelineBadgeText = `متأخر زمنياً (تجاوز ${diffDays} يوم)`;
                timelineTone = 'danger';
                timelineStatusDesc = `انتهت المدة المخططة في ${endDate} وتأخر بـ ${diffDays} يوم وغير مكتمل بعد`;
                isDelayed = true;
                isTimelineCompleted = true; // انقضت المدة
            } else {
                timelineCategory = 'in_schedule';
                timelineBadgeText = diffDays === 0
                    ? 'اليوم الموعد النهائي'
                    : `غير مكتمل زمنياً بعد (متبقي ${diffAbs} يوم)`;
                timelineTone = 'info';
                timelineStatusDesc = diffDays === 0
                    ? `اليوم هو موعد التسليم النهائي المخطط (${endDate})`
                    : `البند ساري ومتبقي ${diffAbs} يوم حتى موعد التسليم (${endDate})`;
                isDelayed = false;
                isTimelineCompleted = false;
            }
        }
    }

    const completionStatusText = isFullyCompleted
        ? `مكتمل بالكامل 100% (${completedQty} من ${contractQty} ${unit})`
        : `منجز جزئياً بنسبة ${progressPercent}% (${completedQty} من ${contractQty} ${unit} - متبقي ${remainingQty} ${unit})`;

    const summaryMessage = `بند [${workItemName}]: ${completionStatusText} | الموقف الزمني: ${timelineBadgeText} (${timelineStatusDesc})`;

    return {
        boqBudgetId,
        workItemName,
        unit,
        contractQty,
        completedQty,
        progressPercent,
        isFullyCompleted,
        remainingQty,
        startDate,
        endDate,
        diffDays,
        timelineCategory,
        timelineBadgeText,
        timelineStatusDesc,
        timelineTone,
        isTimelineCompleted,
        isDelayed,
        summaryMessage
    };
}
