export type VatSource = 'invoice' | 'expense' | 'note';
export type VatAmount = number | string | null;

export type VatTransaction = {
  source: VatSource;
  source_id: string;
  reference: string | null;
  document_date: string;
  tax_date: string | null;
  base: VatAmount;
  recorded_tax: VatAmount;
  confirmed_tax: VatAmount;
  recoverable_vat: VatAmount;
  gl_215_amount?: VatAmount;
  category: string | null;
  status: 'review' | 'confirmed' | 'excluded';
  review_reason: string | null;
  evidence: string | null;
  invoice_id?: string | null;
  original_category?: string | null;
  in_document_period: boolean;
  in_tax_period: boolean;
};

export type VatPeriodAdjustments = {
  prior_period_adjustment: VatAmount;
  carried_forward_credit: VatAmount;
  evidence: string;
  reviewed_at: string;
};

export type VatReturn = {
  period: { from: string; to: string };
  company: { id: string; name: string; tax_number: string | null };
  period_adjustments?: VatPeriodAdjustments | null;
  boxes: Array<{
    number: number;
    label: string;
    base: VatAmount;
    adjustment?: VatAmount;
    tax: VatAmount;
    status: 'confirmed' | 'partial' | 'pending' | 'manual';
  }>;
  transactions: VatTransaction[];
  reconciliation: {
    account_code: string;
    posted_movement: VatAmount;
    recorded_document_net: VatAmount;
    confirmed_document_net: VatAmount;
    variance_recorded: VatAmount;
    variance_confirmed: VatAmount;
    lines: Array<{
      id: string;
      header_id: string;
      date: string;
      source: string | null;
      source_id: string | null;
      description: string | null;
      amount: VatAmount;
      kind: string;
    }>;
  };
};

export const sourceLabels: Record<VatSource, string> = { invoice: 'فاتورة عميل', expense: 'مصروف', note: 'إشعار ضريبي' };
export const statusLabels: Record<string, string> = {
  confirmed: 'مؤكد', review: 'يحتاج مراجعة', excluded: 'مستبعد بعد المراجعة',
  partial: 'جزئي', pending: 'غير مكتمل', manual: 'يتطلب معالجة يدوية',
};
export const movementLabels: Record<string, string> = {
  sale: 'مبيعات', purchase: 'مشتريات', note: 'إشعار ضريبي', manual: 'قيد يدوي', other: 'حركة أخرى',
};
const reviewReasonLabels: Record<string, string> = {
  missing_posted_journal: 'لا يوجد قيد مرحّل مطابق للمستند.',
  multiple_posted_journals: 'يوجد أكثر من قيد مرحّل للمستند. تحقق من التكرار.',
  original_review_required: 'يلزم مراجعة الفاتورة الأصلية قبل اعتماد تصنيف الإشعار.',
  review_stale: 'تغيّر المستند أو قيده بعد المراجعة. أعد التحقق من التصنيف والمبالغ.',
  purchase_tax_eligibility_unverified: 'تحقّق من شروط الخصم والمستند المؤيد قبل اعتماد الضريبة القابلة للخصم.',
  tax_category_or_date_unverified: 'تحقّق من التصنيف وتاريخ الاستحقاق الضريبي، خصوصًا للمعاملات الحكومية أو النقدية.',
};
export const formatReviewReason = (reason: string) => reviewReasonLabels[reason] ?? reason;
export const categoryLabels: Record<string, string> = {
  standard_sales: 'مبيعات خاضعة للنسبة الأساسية',
  zero_sales: 'مبيعات محلية خاضعة للنسبة الصفرية',
  export_sales: 'صادرات خاضعة للنسبة الصفرية',
  exempt_sales: 'مبيعات معفاة',
  standard_purchases: 'مشتريات خاضعة للنسبة الأساسية',
  imports_paid: 'واردات دُفعت ضريبتها عند الاستيراد',
  zero_purchases: 'مشتريات خاضعة للنسبة الصفرية',
  exempt_purchases: 'مشتريات معفاة',
  outside_scope: 'خارج نطاق الضريبة',
  noncompliant_purchase: 'مشتريات غير مستوفية لشروط الخصم',
};
export const salesCategories = ['standard_sales', 'zero_sales', 'export_sales', 'exempt_sales', 'outside_scope'];
export const purchaseCategories = ['standard_purchases', 'imports_paid', 'zero_purchases', 'exempt_purchases', 'outside_scope', 'noncompliant_purchase'];

const money = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 });
export const formatVatAmount = (amount: VatAmount | undefined) => amount == null ? '—' : money.format(Number(amount));

export function currentTaxMonth() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric' }).formatToParts();
  return { year: parts.find(part => part.type === 'year')!.value, month: Number(parts.find(part => part.type === 'month')!.value) };
}

export function getPeriod(year: string, startMonth: number, monthCount: number) {
  if (!/^\d{4}$/.test(year) || Number(year) < 1900) return null;
  const endMonth = startMonth + monthCount - 1;
  const endDay = new Date(Date.UTC(Number(year), endMonth, 0)).getUTCDate();
  const twoDigits = (value: number) => String(value).padStart(2, '0');
  return { from: `${year}-${twoDigits(startMonth)}-01`, to: `${year}-${twoDigits(endMonth)}-${twoDigits(endDay)}` };
}

export async function exportVatReturn(report: VatReturn) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  const numeric = (value: VatAmount | undefined) => value == null ? null : Number(value);
  const sheet = (name: string, rows: (string | number | null | undefined)[][]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  };
  sheet('ملخص الإقرار', [
    ['مسودة مراجعة ضريبة القيمة المضافة'],
    ['الشركة', report.company.name], ['الرقم الضريبي', report.company.tax_number],
    ['من', report.period.from, 'إلى', report.period.to],
    ['الخانة', 'الوصف', 'المبلغ قبل الضريبة', 'تعديلات الإشعارات', 'الضريبة', 'الحالة'],
    ...report.boxes.map(box => [box.number, box.label, numeric(box.base), numeric(box.adjustment), numeric(box.tax), statusLabels[box.status] ?? box.status]),
  ]);
  sheet('سجل المستندات', [
    ['النوع', 'المرجع', 'معرّف المستند', 'تاريخ المستند', 'تاريخ الاستحقاق الضريبي', 'المبلغ قبل الضريبة', 'الضريبة المسجلة', 'الضريبة المؤكدة', 'الحركة على 215', 'التصنيف', 'الحالة', 'سبب المراجعة', 'المستند المؤيد', 'تاريخ المستند داخل الفترة', 'تاريخ الاستحقاق داخل الفترة'],
    ...report.transactions.map(row => [sourceLabels[row.source], row.reference, row.source_id, row.document_date, row.tax_date, numeric(row.base), numeric(row.recorded_tax), numeric(row.confirmed_tax), numeric(row.gl_215_amount), row.category && categoryLabels[row.category], statusLabels[row.status], row.review_reason && formatReviewReason(row.review_reason), row.evidence, row.in_document_period ? 'نعم' : 'لا', row.tax_date ? row.in_tax_period ? 'نعم' : 'لا' : null]),
  ]);
  const rec = report.reconciliation;
  sheet('المطابقة', [
    ['حساب الضريبة', rec.account_code],
    ['صافي حركة الأستاذ', numeric(rec.posted_movement)], ['صافي الضريبة المسجلة بالمستندات', numeric(rec.recorded_document_net)],
    ['صافي الضريبة المؤكدة', numeric(rec.confirmed_document_net)], ['فرق الأستاذ عن المسجلة', numeric(rec.variance_recorded)],
    ['فرق الأستاذ عن المؤكدة', numeric(rec.variance_confirmed)], [],
    ['التاريخ', 'النوع', 'الوصف', 'معرّف القيد', 'المصدر', 'معرّف المستند', 'الحركة'],
    ...rec.lines.map(line => [line.date, movementLabels[line.kind] ?? line.kind, line.description, line.header_id, line.source, line.source_id, numeric(line.amount)]),
  ]);
  XLSX.writeFile(workbook, `VAT_${report.period.from}_${report.period.to}.xlsx`);
}
