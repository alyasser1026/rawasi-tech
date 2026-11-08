export type AgingPartyType = 'customers' | 'subcontractors' | 'suppliers';

export type AgingBucket = 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'over_90' | 'unspecified';

export const partyTypeLabels: Record<AgingPartyType, string> = {
  customers: 'أعمار ذمم العملاء (حساب 123)',
  subcontractors: 'أعمار ذمم مقاولي الباطن (حساب 212)',
  suppliers: 'أعمار ذمم الموردين (حساب 211)',
};

export const partyTypeTabs: Array<{ id: AgingPartyType; label: string; account: string }> = [
  { id: 'customers', label: 'العملاء', account: '123' },
  { id: 'subcontractors', label: 'مقاولو الباطن', account: '212' },
  { id: 'suppliers', label: 'الموردون', account: '211' },
];

export const bucketLabels: Record<AgingBucket, string> = {
  current: 'الحالي (غير متأخر)',
  days_1_30: '1 - 30 يوم',
  days_31_60: '31 - 60 يوم',
  days_61_90: '61 - 90 يوم',
  over_90: '+90 يوم',
  unspecified: 'غير محدد الاستحقاق',
};

export const bucketColors: Record<AgingBucket, string> = {
  current: '#10b981',
  days_1_30: '#3b82f6',
  days_31_60: '#f59e0b',
  days_61_90: '#f97316',
  over_90: '#ef4444',
  unspecified: '#6b7280',
};

export type AgingDoc = {
  doc_id: string;
  doc_number: string;
  doc_type: string;
  doc_date: string;
  due_date: string | null;
  payment_period_days?: number | null;
  project_id?: string | null;
  project_name?: string | null;
  original_amount: number;
  adjustment_amount: number;
  adjusted_total: number;
  paid_amount: number;
  remaining_balance: number;
  overdue_days: number | null;
  bucket: AgingBucket;
};

export type AgingPartner = {
  partner_id: string;
  partner_code: string | null;
  partner_name: string;
  partner_phone: string | null;
  open_docs_count: number;
  total_due: number;
  current_balance: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
  unspecified: number;
  overdue_balance: number;
  documents: AgingDoc[];
};

export type AgingProject = {
  project_id: string;
  project_name: string;
  open_docs_count: number;
  total_due: number;
  current_balance: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
  unspecified: number;
  overdue_balance: number;
};

export type AgingKpis = {
  total_due: number;
  overdue_balance: number;
  current_balance: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
  unspecified: number;
  collection_rate_percent: number;
  total_sales: number;
  total_collected: number;
};

export type GlReconciliation = {
  account_code: string;
  account_name: string | null;
  gl_balance: number;
  subledger_balance: number;
  variance: number;
  is_reconciled: boolean;
};

export type TopDebtor = {
  partner_id: string;
  partner_code: string | null;
  partner_name: string;
  total_due: number;
  overdue_balance: number;
  overdue_share_percent: number;
};

export type AgingReport = {
  party_type: AgingPartyType;
  as_of_date: string;
  company: { id: string; name: string };
  gl_reconciliation: GlReconciliation;
  kpis: AgingKpis;
  top_debtors: TopDebtor[];
  partners: AgingPartner[];
  projects: AgingProject[];
};

export function formatAgingCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '0.00 ر.س';
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ر.س';
}

export function formatAgingPercent(percent: number | null | undefined): string {
  if (percent == null || isNaN(percent)) return '0.0%';
  return Number(percent).toFixed(1) + '%';
}

export async function exportAgingToExcel(report: AgingReport, partyType: AgingPartyType) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };

  const num = (v: number | null | undefined) => (v == null ? 0 : Number(v));

  // Sheet 1: الملخص ومطابقة الأستاذ
  const summaryRows = [
    ['تقرير أعمار الذمم ومؤشرات التحصيل'],
    ['الشركة', report.company.name],
    ['نوع الطرف', partyTypeLabels[partyType]],
    ['بتاريخ (نقطة القطع)', report.as_of_date],
    [],
    ['مطابقة دفتر الأستاذ العام'],
    ['رقم الحساب الرقابي', report.gl_reconciliation.account_code],
    ['اسم الحساب', report.gl_reconciliation.account_name ?? '—'],
    ['رصيد حركة الأستاذ حتى التاريخ', num(report.gl_reconciliation.gl_balance)],
    ['إجمالي رصيد الذمم الفرعية', num(report.gl_reconciliation.subledger_balance)],
    ['الفارق', num(report.gl_reconciliation.variance)],
    ['حالة المطابقة', report.gl_reconciliation.is_reconciled ? 'مطابق تمامًا' : 'يوجد فارق'],
    [],
    ['المؤشرات الرئيسية (KPIs)'],
    ['إجمالي المستحق القائم', num(report.kpis.total_due)],
    ['إجمالي المتأخرات', num(report.kpis.overdue_balance)],
    ['الحالي (غير متأخر)', num(report.kpis.current_balance)],
    ['1 - 30 يوم', num(report.kpis.days_1_30)],
    ['31 - 60 يوم', num(report.kpis.days_31_60)],
    ['61 - 90 يوم', num(report.kpis.days_61_90)],
    ['أكثر من 90 يوم', num(report.kpis.over_90)],
    ['غير محدد تاريخ الاستحقاق', num(report.kpis.unspecified)],
    ['نسبة التحصيل / السداد', num(report.kpis.collection_rate_percent) + '%'],
    ['إجمالي الأعمال المؤرخة حتى التاريخ', num(report.kpis.total_sales)],
    ['إجمالي المسدد حتى التاريخ', num(report.kpis.total_collected)],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'الملخص والمؤشرات');

  // Sheet 2: تفصيل الشركاء
  const partnerHeaders = [
    'كود الشريك',
    'اسم الشريك',
    'الهاتف',
    'عدد المستندات المفتوحة',
    'إجمالي المستحق',
    'الحالي',
    '1 - 30 يوم',
    '31 - 60 يوم',
    '61 - 90 يوم',
    '+90 يوم',
    'غير محدد',
    'إجمالي المتأخرات',
  ];
  const partnerRows = report.partners.map(p => [
    p.partner_code ?? '—',
    p.partner_name,
    p.partner_phone ?? '—',
    p.open_docs_count,
    num(p.total_due),
    num(p.current_balance),
    num(p.days_1_30),
    num(p.days_31_60),
    num(p.days_61_90),
    num(p.over_90),
    num(p.unspecified),
    num(p.overdue_balance),
  ]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([partnerHeaders, ...partnerRows]), 'الأرصدة حسب الشركاء');

  // Sheet 3: تفصيل المستندات القائمة
  const docHeaders = [
    'الشريك',
    'رقم المستند',
    'النوع',
    'تاريخ المستند',
    'تاريخ الاستحقاق',
    'المشروع',
    'المبلغ الأصلي',
    'تعديلات/إشعارات',
    'الصافي الفعلي',
    'المسدد حتى التاريخ',
    'الرصيد المتبقي',
    'أيام التأخير',
    'الشريحة',
  ];
  const docRows: (string | number)[][] = [];
  for (const p of report.partners) {
    for (const d of p.documents || []) {
      docRows.push([
        p.partner_name,
        d.doc_number,
        d.doc_type,
        d.doc_date,
        d.due_date ?? 'غير محدد',
        d.project_name ?? '—',
        num(d.original_amount),
        num(d.adjustment_amount),
        num(d.adjusted_total),
        num(d.paid_amount),
        num(d.remaining_balance),
        d.overdue_days != null ? d.overdue_days : '—',
        bucketLabels[d.bucket] ?? d.bucket,
      ]);
    }
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([docHeaders, ...docRows]), 'المستندات المفتوحة');

  // Sheet 4: حسب المشاريع
  const projectHeaders = [
    'المشروع',
    'عدد المستندات',
    'إجمالي المستحق',
    'الحالي',
    '1 - 30 يوم',
    '31 - 60 يوم',
    '61 - 90 يوم',
    '+90 يوم',
    'غير محدد',
    'إجمالي المتأخرات',
  ];
  const projectRows = report.projects.map(pr => [
    pr.project_name,
    pr.open_docs_count,
    num(pr.total_due),
    num(pr.current_balance),
    num(pr.days_1_30),
    num(pr.days_31_60),
    num(pr.days_61_90),
    num(pr.over_90),
    num(pr.unspecified),
    num(pr.overdue_balance),
  ]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([projectHeaders, ...projectRows]), 'الأرصدة حسب المشاريع');

  XLSX.writeFile(workbook, `Aging_Report_${partyType}_${report.as_of_date}.xlsx`);
}
