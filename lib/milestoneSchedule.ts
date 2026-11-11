// =========================================================================
// 💳 محرك جدول دفعات العميل (Client Payment Schedule Engine)
// -------------------------------------------------------------------------
// يحسب لكل دفعة مجدولة: المسدد منها، المتبقي، الحالة الفعلية (متأخرة / قيد
// التحصيل / محصلة جزئياً / محصلة بالكامل / مجدولة / ملغاة) وعدد أيام التأخير
// أو الأيام المتبقية على الاستحقاق.
//
// قواعد التخصيص:
// 1) السند المربوط يدوياً بالدفعة (receipt_voucher_id / received_amount) له الأولوية.
// 2) سندات قبض المشروع غير المربوطة بأي دفعة تُوزَّع تلقائياً (FIFO) على
//    الدفعات غير المسددة بالترتيب حسب تاريخ الاستحقاق.
// 3) أي فائض بعد تغطية كل الدفعات يظهر كـ "دفعات مقدمة غير مخصصة".
// =========================================================================

export type MilestoneStatusKey =
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'overdue_partial'
  | 'collecting'
  | 'scheduled'
  | 'cancelled';

export interface MilestoneStatusMeta {
  key: MilestoneStatusKey;
  label: string;
  bg: string;
  color: string;
  border: string;
}

export const MILESTONE_STATUS_META: Record<MilestoneStatusKey, MilestoneStatusMeta> = {
  paid:            { key: 'paid',            label: 'محصلة بالكامل',          bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  partial:         { key: 'partial',         label: 'محصلة جزئياً',           bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
  overdue:         { key: 'overdue',         label: 'متأخرة',                 bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  overdue_partial: { key: 'overdue_partial', label: 'متأخرة - محصلة جزئياً',  bg: '#ffedd5', color: '#c2410c', border: '#fdba74' },
  collecting:      { key: 'collecting',      label: 'قيد التحصيل',            bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  scheduled:       { key: 'scheduled',       label: 'مجدولة (لم يحن موعدها)', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  cancelled:       { key: 'cancelled',       label: 'ملغاة',                  bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' },
};

/** عدد الأيام قبل الاستحقاق التي تعتبر فيها الدفعة "قيد التحصيل" */
export const COLLECTION_WINDOW_DAYS = 7;

export interface ScheduleReceipt {
  id?: string;
  receipt_number?: string | null;
  date?: string | Date | null;
  amount?: number | string | null;
  final_amount?: number | string | null;
}

export interface ScheduleRow {
  milestone: any;
  number: number;
  title: string;
  dueDate: string;
  expected: number;
  manualPaid: number;
  autoPaid: number;
  paid: number;
  remaining: number;
  paidPct: number;
  status: MilestoneStatusMeta;
  /** موجب = أيام تأخير، سالب = أيام متبقية على الاستحقاق، null = بدون تاريخ */
  daysDiff: number | null;
  daysLabel: string;
  receiptRefs: string[];
  lastReceiptDate: string;
}

export interface ScheduleSummary {
  rows: ScheduleRow[];
  totalScheduled: number;
  totalPaidOnSchedule: number;
  unallocatedAdvance: number;
  totalReceived: number;
  totalRemaining: number;
  overdueAmount: number;
  collectingAmount: number;
  collectionRate: number;
  counts: Record<MilestoneStatusKey, number>;
  nextDue: ScheduleRow | null;
}

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const toDateStr = (v: any): string => {
  if (!v) return '';
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).split('T')[0];
};

/** تاريخ اليوم المحلي بصيغة YYYY-MM-DD (بدون انزياح UTC) */
export const localToday = (): string => toDateStr(new Date());

const daysBetween = (from: string, to: string): number => {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function resolveMilestoneStatus(
  expected: number,
  paid: number,
  dueDate: string,
  today: string,
  manualStatus?: string | null
): { status: MilestoneStatusMeta; daysDiff: number | null } {
  const daysDiff = dueDate ? daysBetween(dueDate, today) : null;

  if (manualStatus === 'ملغاة') return { status: MILESTONE_STATUS_META.cancelled, daysDiff };
  if (expected > 0 && paid >= expected - 0.005) return { status: MILESTONE_STATUS_META.paid, daysDiff };

  const isOverdue = daysDiff !== null && daysDiff > 0;
  if (isOverdue) {
    return { status: paid > 0 ? MILESTONE_STATUS_META.overdue_partial : MILESTONE_STATUS_META.overdue, daysDiff };
  }
  if (paid > 0) return { status: MILESTONE_STATUS_META.partial, daysDiff };
  if (daysDiff !== null && daysDiff >= -COLLECTION_WINDOW_DAYS) {
    return { status: MILESTONE_STATUS_META.collecting, daysDiff };
  }
  return { status: MILESTONE_STATUS_META.scheduled, daysDiff };
}

const buildDaysLabel = (statusKey: MilestoneStatusKey, daysDiff: number | null): string => {
  if (daysDiff === null) return '---';
  if (statusKey === 'paid' || statusKey === 'cancelled') return '---';
  if (daysDiff > 0) return `متأخرة ${daysDiff} يوم`;
  if (daysDiff === 0) return 'تستحق اليوم';
  return `متبقي ${Math.abs(daysDiff)} يوم`;
};

export function buildMilestoneSchedule(
  milestones: any[],
  projectReceipts: ScheduleReceipt[],
  today: string = localToday()
): ScheduleSummary {
  const sorted = [...(milestones || [])].sort((a, b) => {
    const da = toDateStr(a.due_date) || '9999-12-31';
    const db = toDateStr(b.due_date) || '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    return toNum(a.milestone_number) - toNum(b.milestone_number);
  });

  const linkedIds = new Set(sorted.map((m) => m.receipt_voucher_id).filter(Boolean));
  const pool = (projectReceipts || [])
    .filter((r) => !r.id || !linkedIds.has(r.id))
    .map((r) => ({
      ref: r.receipt_number || '',
      date: toDateStr(r.date),
      left: toNum(r.final_amount ?? r.amount),
    }))
    .filter((r) => r.left > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const rows: ScheduleRow[] = sorted.map((m, idx) => {
    const expected = toNum(m.expected_amount);
    const isCancelled = m.status === 'ملغاة';
    const manualPaid = Math.min(toNum(m.received_amount), expected > 0 ? expected : toNum(m.received_amount));
    const refs: string[] = m.receipt_number ? [String(m.receipt_number)] : [];
    let lastReceiptDate = toDateStr(m.receipt_date);

    let autoPaid = 0;
    if (!isCancelled) {
      let need = Math.max(0, expected - manualPaid);
      for (const r of pool) {
        if (need <= 0.005) break;
        if (r.left <= 0.005) continue;
        const take = Math.min(need, r.left);
        r.left = round2(r.left - take);
        need = round2(need - take);
        autoPaid = round2(autoPaid + take);
        if (r.ref && !refs.includes(r.ref)) refs.push(r.ref);
        if (r.date && r.date > lastReceiptDate) lastReceiptDate = r.date;
      }
    }

    const paid = round2(manualPaid + autoPaid);
    const remaining = isCancelled ? 0 : round2(Math.max(0, expected - paid));
    const dueDate = toDateStr(m.due_date);
    const { status, daysDiff } = resolveMilestoneStatus(expected, paid, dueDate, today, m.status);

    return {
      milestone: m,
      number: toNum(m.milestone_number) || idx + 1,
      title: m.title || 'دفعة تعاقدية',
      dueDate,
      expected,
      manualPaid,
      autoPaid,
      paid,
      remaining,
      paidPct: expected > 0 ? Math.min(100, round2((paid / expected) * 100)) : 0,
      status,
      daysDiff,
      daysLabel: buildDaysLabel(status.key, daysDiff),
      receiptRefs: refs,
      lastReceiptDate,
    };
  });

  const active = rows.filter((r) => r.status.key !== 'cancelled');
  const totalScheduled = round2(active.reduce((s, r) => s + r.expected, 0));
  const totalPaidOnSchedule = round2(active.reduce((s, r) => s + r.paid, 0));
  const unallocatedAdvance = round2(pool.reduce((s, r) => s + r.left, 0));
  const totalReceived = round2(totalPaidOnSchedule + unallocatedAdvance);
  const totalRemaining = round2(active.reduce((s, r) => s + r.remaining, 0));
  const overdueAmount = round2(
    active.filter((r) => r.status.key === 'overdue' || r.status.key === 'overdue_partial').reduce((s, r) => s + r.remaining, 0)
  );
  const collectingAmount = round2(
    active.filter((r) => r.status.key === 'collecting' || r.status.key === 'partial').reduce((s, r) => s + r.remaining, 0)
  );

  const counts = Object.keys(MILESTONE_STATUS_META).reduce((acc, k) => {
    acc[k as MilestoneStatusKey] = 0;
    return acc;
  }, {} as Record<MilestoneStatusKey, number>);
  rows.forEach((r) => { counts[r.status.key] += 1; });

  const nextDue = active.find((r) => r.remaining > 0) || null;

  return {
    rows,
    totalScheduled,
    totalPaidOnSchedule,
    unallocatedAdvance,
    totalReceived,
    totalRemaining,
    overdueAmount,
    collectingAmount,
    collectionRate: totalScheduled > 0 ? round2((totalPaidOnSchedule / totalScheduled) * 100) : 0,
    counts,
    nextDue,
  };
}
