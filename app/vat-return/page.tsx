'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, FileSpreadsheet, Printer, RefreshCw, TriangleAlert } from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import PhiDialog from '@/components/PhiDialog';
import LoadingScreen from '@/components/LoadingScreen';
import { useCompany } from '@/lib/CompanyContext';
import { usePermissions } from '@/lib/PermissionsContext';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import {
  categoryLabels, currentTaxMonth, exportVatReturn, formatReviewReason, formatVatAmount, getPeriod, movementLabels,
  purchaseCategories, salesCategories, sourceLabels, statusLabels, type VatPeriodAdjustments, type VatReturn, type VatTransaction,
} from './vatReturnModel';
import styles from './vat-return.module.css';

const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const quarters = ['يناير – مارس', 'أبريل – يونيو', 'يوليو – سبتمبر', 'أكتوبر – ديسمبر'];

function Status({ status }: { status: string }) {
  return <span className={`ent-status ${status === 'confirmed' ? 'posted' : 'draft'}`}>{statusLabels[status] ?? status}</span>;
}

function ReviewDialog({ row, companyId, onClose }: { row: VatTransaction; companyId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const noteCategories = row.original_category && salesCategories.includes(row.original_category) ? [row.original_category] : [];
  const categories = row.source === 'expense' ? purchaseCategories : row.source === 'note' ? noteCategories : salesCategories;
  const [category, setCategory] = useState(row.category && categories.includes(row.category) ? row.category : categories.length === 1 ? categories[0] : '');
  const [taxDate, setTaxDate] = useState(row.tax_date || '');
  const [evidence, setEvidence] = useState(row.evidence || '');
  const [deductible, setDeductible] = useState(row.recoverable_vat == null ? '' : String(Number(row.recoverable_vat)));
  const needsDeductible = category === 'standard_purchases' || category === 'imports_paid';
  const validAmount = !needsDeductible || /^\d+(\.\d{1,2})?$/.test(deductible);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_vat_document_review', {
        p_source: row.source, p_source_id: row.source_id, p_category: category,
        p_effective_tax_date: taxDate, p_recoverable_vat: needsDeductible ? Number(deductible) : null,
        p_evidence: evidence.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vat-return', companyId] });
      notify.success('تم حفظ المراجعة الضريبية');
      onClose();
    },
  });
  const canSubmit = categories.includes(category) && taxDate && evidence.trim() && validAmount;
  return <PhiDialog open title="مراجعة المستند ضريبيًا" subtitle={`${sourceLabels[row.source]} ${row.reference ?? row.source_id}`}
    icon={<ClipboardCheck size={20} />} onClose={onClose} busy={save.isPending}
    onSubmit={() => { if (canSubmit && !save.isPending) save.mutate(); }}
    footer={<button type="submit" className="ent-button ent-primary" disabled={!canSubmit || save.isPending}>{save.isPending ? 'جاري الحفظ…' : 'حفظ المراجعة'}</button>}>
    <div className="ent-form-grid" dir="rtl">
      {row.review_reason && <p className={`ent-form-full ${styles.reviewNotice}`}><TriangleAlert size={17} aria-hidden="true" />{formatReviewReason(row.review_reason)}</p>}
      {row.source === 'note' && !categories.length && <p className={`ent-form-full ${styles.reviewNotice}`}>راجع تصنيف الفاتورة الأصلية أولًا قبل اعتماد تصنيف الإشعار.</p>}
      <div className="ent-form-field"><label htmlFor="vat-review-category">التصنيف الضريبي</label>
        <select id="vat-review-category" required value={category} onChange={event => setCategory(event.target.value)} disabled={save.isPending || !categories.length}>
          <option value="">اختر التصنيف</option>{categories.map(value => <option key={value} value={value}>{categoryLabels[value]}</option>)}
        </select>
      </div>
      <div className="ent-form-field"><label htmlFor="vat-review-date">تاريخ الاستحقاق الضريبي المؤكد</label>
        <input id="vat-review-date" type="date" required value={taxDate} onChange={event => setTaxDate(event.target.value)} disabled={save.isPending} />
        <small className="ent-field-note">تاريخ المستند {row.document_date}. تحقّق من التاريخ حسب المستند المؤيد، خصوصًا في المعاملات الحكومية أو النقدية.</small>
      </div>
      {needsDeductible && <div className="ent-form-field ent-form-full"><label htmlFor="vat-review-deductible">الضريبة القابلة للخصم (ريال)</label>
        <input id="vat-review-deductible" type="number" min="0" step="0.01" inputMode="decimal" required value={deductible}
          onChange={event => setDeductible(event.target.value)} disabled={save.isPending} />
        <small className="ent-field-note">الضريبة المسجلة {formatVatAmount(row.recorded_tax)}. أدخل المبلغ الذي تؤيده المستندات، أو صفرًا إذا تأكدت من عدم وجود مبلغ قابل للخصم.</small>
      </div>}
      <div className="ent-form-field ent-form-full"><label htmlFor="vat-review-evidence">أساس التصنيف ومرجع المستند المؤيد</label>
        <textarea id="vat-review-evidence" required value={evidence} onChange={event => setEvidence(event.target.value)} disabled={save.isPending} />
      </div>
      {save.isError && <p className={`ent-form-full ${styles.reviewNotice}`} role="alert">{save.error.message}</p>}
    </div>
  </PhiDialog>;
}

function PeriodAdjustmentsDialog({
  companyId, period, current, onClose,
}: {
  companyId: string;
  period: { from: string; to: string };
  current: VatPeriodAdjustments | null | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [priorAdj, setPriorAdj] = useState(current?.prior_period_adjustment != null ? String(Number(current.prior_period_adjustment)) : '0');
  const [creditFwd, setCreditFwd] = useState(current?.carried_forward_credit != null ? String(Number(current.carried_forward_credit)) : '0');
  const [evidence, setEvidence] = useState(current?.evidence || 'لا توجد تسويات فترات سابقة');
  const validPrior = /^-?d+(.d{1,2})?$/.test(priorAdj.trim());
  const validCredit = /^d+(.d{1,2})?$/.test(creditFwd.trim()) && Number(creditFwd) >= 0;
  const canSubmit = validPrior && validCredit && Boolean(evidence.trim());
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_vat_period_adjustments', {
        p_from: period.from,
        p_to: period.to,
        p_prior_period_adjustment: Number(priorAdj),
        p_carried_forward_credit: Number(creditFwd),
        p_evidence: evidence.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vat-return', companyId] });
      notify.success('تم اعتماد تسويات الفترة وتحديث الخانة 16');
      onClose();
    },
  });
  return <PhiDialog open title="اعتماد تسويات الفترة (خانة 14 و15)" subtitle={`الفترة من ${period.from} إلى ${period.to}`}
    icon={<ClipboardCheck size={20} />} onClose={onClose} busy={save.isPending}
    onSubmit={() => { if (canSubmit && !save.isPending) save.mutate(); }}
    footer={<button type="submit" className="ent-button ent-primary" disabled={!canSubmit || save.isPending}>{save.isPending ? 'جاري الحفظ…' : 'حفظ واعتماد الخانات'}</button>}>
    <div className="ent-form-grid" dir="rtl">
      <div className="ent-form-field">
        <label htmlFor="vat-box-14">خانة 14 — تصحيحات الفترات السابقة (ريال)</label>
        <input id="vat-box-14" dir="ltr" type="number" step="0.01" inputMode="decimal" required value={priorAdj}
          onChange={event => setPriorAdj(event.target.value)} disabled={save.isPending} />
        <small className="ent-field-note">أدخل 0 إذا لم توجد تصحيحات، أو قيمة موجبة/سالبة حسب لائحة الهيئة (±5,000 ر.س).</small>
      </div>
      <div className="ent-form-field">
        <label htmlFor="vat-box-15">خانة 15 — الرصيد الدائن المرحّل من فترات سابقة (ريال)</label>
        <input id="vat-box-15" dir="ltr" type="number" min="0" step="0.01" inputMode="decimal" required value={creditFwd}
          onChange={event => setCreditFwd(event.target.value)} disabled={save.isPending} />
        <small className="ent-field-note">يُطرح من صافي ضريبة الفترة الحالية للوصول إلى الخانة 16 بعد اكتمال مراجعة المستندات.</small>
      </div>
      <div className="ent-form-field ent-form-full">
        <label htmlFor="vat-period-adj-evidence">بيان الاعتماد / مرجع التسوية</label>
        <textarea id="vat-period-adj-evidence" required value={evidence}
          onChange={event => setEvidence(event.target.value)} disabled={save.isPending} />
      </div>
      {save.isError && <p className={`ent-form-full ${styles.reviewNotice}`} role="alert">{save.error.message}</p>}
    </div>
  </PhiDialog>;
}

export default function VatReturnPage() {
  const { activeCompanyId, isLoading: companyLoading } = useCompany();
  const { can, loading: permissionsLoading } = usePermissions();
  const [initialMonth] = useState(currentTaxMonth);
  const [year, setYear] = useState(initialMonth.year);
  const [month, setMonth] = useState(initialMonth.month);
  const [quarter, setQuarter] = useState(Math.ceil(initialMonth.month / 3));
  const [frequency, setFrequency] = useState<'month' | 'quarter'>('quarter');
  const [filter, setFilter] = useState('all');
  const [review, setReview] = useState<{ companyId: string; row: VatTransaction } | null>(null);
  const [periodAdjOpen, setPeriodAdjOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const period = getPeriod(year, frequency === 'month' ? month : (quarter - 1) * 3 + 1, frequency === 'month' ? 1 : 3);
  const canView = ['vat_return', 'invoices', 'expenses', 'journal'].every(module => can(module, 'view'));
  const canReview = canView && can('vat_return', 'edit');
  const loading = permissionsLoading || companyLoading;
  const query = useQuery({
    queryKey: ['vat-return', activeCompanyId, period?.from, period?.to],
    enabled: Boolean(!loading && canView && activeCompanyId && period),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_vat_return', { p_from: period!.from, p_to: period!.to });
      if (error) throw new Error(error.message);
      if (data?.company?.id !== activeCompanyId || !Array.isArray(data?.boxes) || !Array.isArray(data?.transactions) || !Array.isArray(data?.reconciliation?.lines)) {
        throw new Error('تعذر التحقق من بيانات الإقرار للشركة النشطة.');
      }
      return data as VatReturn;
    },
  });
  const report = canView && activeCompanyId && period ? query.data : undefined;
  const rows = report?.transactions.filter(row => filter === 'all' || row.status === filter) ?? [];
  const reviewCount = report?.transactions.filter(row => row.status === 'review').length ?? 0;
  const rec = report?.reconciliation;
  const exportReport = async () => {
    if (!report || exporting) return;
    setExporting(true);
    try { await exportVatReturn(report); }
    catch { notify.error('تعذر تصدير ملف Excel.'); }
    finally { setExporting(false); }
  };
  return <MasterPage title="إقرار ضريبة القيمة المضافة" subtitle="مراجعة داخلية لخانات الإقرار ومطابقتها مع الأستاذ"
    headerContent={report && <>
      <button type="button" className="ent-button" onClick={() => void exportReport()} disabled={exporting}><FileSpreadsheet size={16} aria-hidden="true" />{exporting ? 'جاري التصدير…' : 'تصدير Excel'}</button>
      <button type="button" className="ent-button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />طباعة الملخص A4</button>
    </>}>
    <div className={styles.page} dir="rtl">
      {loading ? <LoadingScreen message="جاري تحميل الشركة والصلاحيات…" fullScreen={false} /> : !canView ?
        <p className={styles.reviewNotice} role="alert">تحتاج صلاحية عرض الإقرار والفواتير والمصروفات ودفتر اليومية لعرض التقرير كاملًا.</p> : !activeCompanyId ?
        <p className={styles.reviewNotice} role="alert">اختر شركة لعرض الإقرار.</p> : <>
          <div className={`ent-panel no-print ${styles.controls}`} aria-label="فترة الإقرار">
            <div className="ent-form-field"><label htmlFor="vat-frequency">نوع الفترة</label>
              <select id="vat-frequency" value={frequency} onChange={event => setFrequency(event.target.value === 'month' ? 'month' : 'quarter')}>
                <option value="quarter">ربع سنوي</option><option value="month">شهري</option>
              </select>
            </div>
            <div className="ent-form-field"><label htmlFor="vat-year">السنة الميلادية</label>
              <input id="vat-year" type="number" min="1900" max="9999" step="1" dir="ltr" value={year} onChange={event => setYear(event.target.value)} />
            </div>
            <div className="ent-form-field"><label htmlFor="vat-period">{frequency === 'month' ? 'الشهر' : 'الربع'}</label>
              <select id="vat-period" value={frequency === 'month' ? month : quarter}
                onChange={event => (frequency === 'month' ? setMonth : setQuarter)(Number(event.target.value))}>
                {(frequency === 'month' ? months : quarters).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
            </div>
            <button type="button" className="ent-button" disabled={!period || query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw size={16} aria-hidden="true" />{query.isFetching ? 'جاري الحساب…' : 'إعادة الحساب'}
            </button>
          </div>
          {!period && <p className={styles.reviewNotice} role="alert">أدخل سنة ميلادية من أربع خانات.</p>}
          {period && query.isPending && <LoadingScreen message="جاري إعداد مسودة الإقرار…" fullScreen={false} />}
          {query.isError && <p className={styles.reviewNotice} role="alert"><TriangleAlert size={17} aria-hidden="true" />{query.error.message}</p>}
          {report && rec && <>
            <div className={styles.reportHeading}>
              <strong>{report.company.name}</strong>
              <span>الرقم الضريبي <bdi>{report.company.tax_number || 'غير مسجل في إعدادات الشركة'}</bdi></span>
              <span>الفترة من <bdi>{report.period.from}</bdi> إلى <bdi>{report.period.to}</bdi></span>
            </div>
            <p className={styles.reviewNotice}><TriangleAlert size={18} aria-hidden="true" />
              <span><strong>مسودة مراجعة داخلية.</strong> {reviewCount ? `${reviewCount.toLocaleString('ar-SA')} مستند يحتاج مراجعة. ` : ''}أكمل الخانات اليدوية وراجع الفروق قبل استخدام الأرقام في الإقرار.</span>
            </p>
            <section className="ent-panel" aria-labelledby="vat-boxes-title">
              <div className="ent-panel-heading">
                <h2 id="vat-boxes-title">خانات الإقرار</h2>
                {canReview && <button type="button" className="ent-button no-print" onClick={() => setPeriodAdjOpen(true)}>
                  <ClipboardCheck size={16} aria-hidden="true" />تسويات الفترة (خانة 14 و15)
                </button>}
              </div>
              <div className="ent-table-scroll" tabIndex={0} role="region" aria-label="جدول خانات الإقرار">
                <table className={`ent-table ${styles.boxTable}`}>
                  <thead><tr><th scope="col">الخانة</th><th scope="col">البيان</th><th scope="col">المبلغ قبل الضريبة</th><th scope="col">تعديلات الإشعارات</th><th scope="col">الضريبة</th><th scope="col">الحالة</th></tr></thead>
                  <tbody>{report.boxes.map(box => <tr key={box.number}>
                    <td>{box.number}</td><td>{box.label}</td><td className="ent-amount">{formatVatAmount(box.base)}</td>
                    <td className="ent-amount">{formatVatAmount(box.adjustment)}</td><td className="ent-amount">{formatVatAmount(box.tax)}</td><td><Status status={box.status} /></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>
            <section className="ent-panel" aria-labelledby="vat-reconciliation-title">
              <div className="ent-panel-heading"><h2 id="vat-reconciliation-title">مطابقة حساب {rec.account_code}</h2></div>
              {rec.posted_movement == null && <p className={styles.reviewNotice} role="status"><TriangleAlert size={17} aria-hidden="true" />حساب الضريبة غير متاح لهذه الشركة، والمطابقة غير مكتملة.</p>}
              <dl className={styles.reconciliation}>
                <div><dt>صافي حركة الأستاذ المرحّلة</dt><dd>{formatVatAmount(rec.posted_movement)}</dd></div>
                <div><dt>صافي الضريبة المسجلة بالمستندات</dt><dd>{formatVatAmount(rec.recorded_document_net)}</dd></div>
                <div><dt>صافي الضريبة المؤكدة</dt><dd>{formatVatAmount(rec.confirmed_document_net)}</dd></div>
                <div><dt>فرق الأستاذ عن المسجلة</dt><dd>{formatVatAmount(rec.variance_recorded)}</dd></div>
                <div><dt>فرق الأستاذ عن المؤكدة</dt><dd>{formatVatAmount(rec.variance_confirmed)}</dd></div>
              </dl>
              <details className={`no-print ${styles.journalDetails}`}>
                <summary>تفاصيل حركة الأستاذ ({rec.lines.length.toLocaleString('ar-SA')})</summary>
                {rec.lines.length ? <div className="ent-table-scroll" tabIndex={0} role="region" aria-label="تفاصيل القيود المرحّلة">
                  <table className={`ent-table ${styles.boxTable}`}>
                    <thead><tr><th scope="col">التاريخ</th><th scope="col">النوع</th><th scope="col">البيان</th><th scope="col">معرّف القيد</th><th scope="col">الحركة</th></tr></thead>
                    <tbody>{rec.lines.map(line => <tr key={line.id}><td><bdi>{line.date}</bdi></td><td>{movementLabels[line.kind] ?? line.kind}</td>
                      <td>{line.description || '—'}</td><td><bdi>{line.header_id}</bdi></td><td className="ent-amount">{formatVatAmount(line.amount)}</td></tr>)}</tbody>
                  </table>
                </div> : <p className="ent-muted">لا توجد حركات مرحّلة للحساب في هذه الفترة.</p>}
              </details>
            </section>
            <section className="ent-panel no-print" aria-labelledby="vat-audit-title">
              <div className="ent-panel-heading">
                <h2 id="vat-audit-title">المستندات والمراجعة</h2>
                <div className="ent-form-field"><label htmlFor="vat-audit-filter">حالة المستند</label>
                  <select id="vat-audit-filter" value={filter} onChange={event => setFilter(event.target.value)}>
                    <option value="all">كل المستندات</option><option value="review">يحتاج مراجعة</option><option value="confirmed">مؤكد</option><option value="excluded">مستبعد بعد المراجعة</option>
                  </select>
                </div>
              </div>
              {rows.length ? <div className="ent-table-scroll" tabIndex={0} role="region" aria-label="سجل مستندات الإقرار">
                <table className={`ent-table ${styles.auditTable}`}>
                  <thead><tr><th scope="col">المستند</th><th scope="col">تاريخ المستند</th><th scope="col">تاريخ الاستحقاق</th><th scope="col">المبلغ قبل الضريبة</th>
                    <th scope="col">الضريبة المسجلة</th><th scope="col">الضريبة المؤكدة</th><th scope="col">التصنيف والمراجعة</th>{canReview && <th scope="col">الإجراء</th>}</tr></thead>
                  <tbody>{rows.map(row => <tr key={`${row.source}-${row.source_id}`}>
                    <td><strong>{sourceLabels[row.source]}</strong><small className={styles.auditDetail}><bdi>{row.reference || row.source_id}</bdi></small></td>
                    <td><bdi>{row.document_date}</bdi>{!row.in_document_period && <small className={styles.auditDetail}>خارج الفترة</small>}</td>
                    <td><bdi>{row.tax_date || 'غير مؤكد'}</bdi>{row.tax_date && !row.in_tax_period && <small className={styles.auditDetail}>خارج الفترة</small>}</td>
                    <td className="ent-amount">{formatVatAmount(row.base)}</td><td className="ent-amount">{formatVatAmount(row.recorded_tax)}</td>
                    <td className="ent-amount">{formatVatAmount(row.confirmed_tax)}</td>
                    <td><Status status={row.status} />{row.category && <small className={styles.auditDetail}>{categoryLabels[row.category] ?? row.category}</small>}
                      {row.review_reason && <small className={styles.auditDetail}>{formatReviewReason(row.review_reason)}</small>}
                      {row.evidence && <small className={styles.auditDetail}>{row.evidence}</small>}</td>
                    {canReview && <td><button type="button" className="ent-button" onClick={() => setReview({ companyId: activeCompanyId, row })}>مراجعة</button></td>}
                  </tr>)}</tbody>
                </table>
              </div> : <p className={styles.empty}>لا توجد مستندات بهذه الحالة في الفترة المختارة.</p>}
            </section>
          </>}
        </>}
    </div>
    {review && review.companyId === activeCompanyId && canReview && <ReviewDialog row={review.row} companyId={review.companyId} onClose={() => setReview(null)} />}
    {periodAdjOpen && activeCompanyId && period && canReview && report && (
      <PeriodAdjustmentsDialog companyId={activeCompanyId} period={report.period} current={report.period_adjustments} onClose={() => setPeriodAdjOpen(false)} />
    )}
  </MasterPage>;
}
