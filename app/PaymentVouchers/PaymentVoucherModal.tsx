"use client";
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Banknote, X, Save, Info, CircleAlert, UserRound, Landmark, FileText } from 'lucide-react';
import SmartCombo from '@/components/SmartCombo';
import { formatCurrency } from '@/lib/helpers';
import { useDialogFocus } from '@/hooks/useDialogFocus';

type Props = { isOpen: boolean; onClose: () => void; record: any; setRecord: (value: any) => void; onSave: (record: any) => unknown; isSaving?: boolean; partnerBalance?: number; isBalanceLoading?: boolean };
export default function PaymentVoucherModal({ isOpen, onClose, record, setRecord, onSave, isSaving = false, partnerBalance = 0, isBalanceLoading = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => { if (!isSaving) onClose(); }, [isSaving, onClose]);
  useEffect(() => setMounted(true), []);
  useDialogFocus(panel, isOpen && mounted, close);
  if (!isOpen || !mounted || !record) return null;
  const amount = Number(record.amount || 0);
  const hasBalance = partnerBalance > 0;
  const percentage = hasBalance ? amount / partnerBalance * 100 : 0;
  const overpaid = percentage > 100;
  return createPortal(<div className="ent-dialog-backdrop no-print" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="ent-voucher-dialog" ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <form onSubmit={event => { event.preventDefault(); if (!isSaving && amount > 0) void Promise.resolve(onSave(record)).catch(() => {}); }}>
        <header className="ent-dialog-header"><div className="ent-dialog-title"><span><Banknote size={23}/></span><div><h2 id={`${id}-title`}>{record.id ? 'تعديل سند صرف' : 'سند صرف جديد'}</h2><p>{record.voucher_number ? `رقم السند: ${record.voucher_number}` : 'أدخل بيانات السداد واحفظ السند كمسودة للمراجعة'}</p></div></div><button type="button" className="ent-icon-button" onClick={close} disabled={isSaving} aria-label="إغلاق نموذج السند"><X size={19}/></button></header>
        <div className="ent-dialog-body">
          <section className="ent-form-section"><h3><FileText size={17}/>بيانات السند</h3><div className="ent-form-grid">
            <div className="ent-form-field"><label htmlFor={`${id}-date`}>تاريخ السداد</label><input id={`${id}-date`} type="date" value={record.date || ''} onChange={event => setRecord({ ...record, date: event.target.value })}/></div>
            <div className="ent-form-field"><label htmlFor={`${id}-amount`}>مبلغ السند <span aria-hidden="true">*</span></label><input id={`${id}-amount`} data-autofocus type="number" min="0.01" step="0.01" required placeholder="0.00" value={record.amount || ''} onChange={event => setRecord({ ...record, amount: Number(event.target.value) })}/></div>
            <div className="ent-form-field"><label htmlFor={`${id}-method`}>طريقة الدفع</label><select id={`${id}-method`} value={record.payment_method || 'تحويل بنكي'} onChange={event => setRecord({ ...record, payment_method: event.target.value })}><option value="تحويل بنكي">تحويل بنكي</option><option value="نقدي">نقدي (كاش)</option><option value="شيك">شيك</option></select></div>
            <div className="ent-form-field"><label htmlFor={`${id}-reference`}>رقم المرجع أو الحوالة</label><input id={`${id}-reference`} placeholder="اختياري" value={record.reference_number || record.reference_no || ''} onChange={event => setRecord({ ...record, reference_number: event.target.value, reference_no: event.target.value })}/></div>
          </div></section>
          <div className="ent-form-divider"/>
          <section className="ent-form-section"><h3><UserRound size={17}/>المستفيد وبيان السداد</h3><div className="ent-form-grid">
            <div className="ent-form-field ent-form-full"><SmartCombo label="المستفيد / المستلم المباشر" table="partners" displayCol="name" initialDisplay={record.payee_name || ''} onSelect={value => setRecord({ ...record, payee_name: value?.name || '', payee_id: value?.id || null })} allowAddNew/></div>
            <div className="ent-form-field"><SmartCombo label="المشروع / مركز التكلفة" table="projects" displayCol="Property" initialDisplay={record.site_ref || ''} onSelect={value => setRecord({ ...record, site_ref: value?.Property || '' })}/></div>
            <div className="ent-form-field"><SmartCombo label="أمر الشغل" table="job_orders" displayCol="order_number" searchCols="order_number,notes" initialDisplay={record.job_order_number || ''} customQuery={query => query.select('*, boq_budget:boq_budget_id(work_item), projects:project_id(Property)')} displayFormat={item => `${item.order_number} (${item.projects?.Property || 'مشروع'} - ${item.boq_budget?.work_item || 'بدون بند'})`} onSelect={value => setRecord({ ...record, job_order_id: value?.id || null, job_order_number: value?.order_number || '', site_ref: record.site_ref || value?.projects?.Property || '' })}/></div>
            <div className="ent-form-field ent-form-full"><label htmlFor={`${id}-description`}>بيان السند</label><textarea id={`${id}-description`} placeholder="اكتب وصفًا واضحًا لسبب الصرف…" value={record.description || ''} onChange={event => setRecord({ ...record, description: event.target.value })}/></div>
          </div>
          {record.payee_id && <div className="ent-balance"><span>رصيد المستفيد قبل الصرف</span>{isBalanceLoading ? <span>جاري الحساب…</span> : <strong>{formatCurrency(Math.abs(partnerBalance))} {partnerBalance > 0 ? '(مستحق له)' : partnerBalance < 0 ? '(مدين — عليه)' : '(رصيد صفر)'}</strong>}{!isBalanceLoading && hasBalance && amount > 0 && <span>نسبة السداد: {percentage.toFixed(1)}%</span>}</div>}
          {!isBalanceLoading && overpaid && <div className="ent-overpaid" role="status"><CircleAlert size={15}/> مبلغ الصرف يتجاوز المستحق بـ {formatCurrency(amount - partnerBalance)}. يتحول الفارق إلى مديونية على المستفيد لصالح الشركة.</div>}
          </section>
          <div className="ent-form-divider"/>
          <section className="ent-form-section"><h3><Landmark size={17}/>التوجيه المحاسبي <span className="ent-muted">اختياري عند حفظ المسودة</span></h3><div className="ent-form-grid">
            <div className="ent-form-field"><SmartCombo label="الحساب المدين — من حساب" table="accounts" displayCol="name" initialDisplay={record.debit_account_name || ''} strict onSelect={value => setRecord({ ...record, debit_account_name: value?.name || '', debit_account_id: value?.id || null })}/></div>
            <div className="ent-form-field"><SmartCombo label="الحساب الدائن — الخزينة / البنك" table="accounts" displayCol="name" initialDisplay={record.credit_account_name || ''} strict onSelect={value => setRecord({ ...record, credit_account_name: value?.name || '', credit_account_id: value?.id || null })}/></div>
          </div></section>
          <div className="ent-help"><Info size={16}/><span>يُحفظ السند كمسودة. راجع بيانات السداد والحسابات ثم اعتمده من شاشة سندات الصرف لتسجيل الترحيل.</span></div>
        </div>
        <footer className="ent-dialog-footer"><div className="ent-dialog-total" aria-live="polite"><small>إجمالي مبلغ السند</small><strong>{formatCurrency(amount)}</strong></div><div><button type="button" className="ent-button" onClick={close} disabled={isSaving}>إلغاء</button><button type="submit" id="payment-save-button" className="ent-button ent-primary" disabled={isSaving || amount <= 0}><Save size={16}/>{isSaving ? 'جاري الحفظ…' : 'حفظ كمسودة'}</button></div></footer>
      </form>
    </div>
  </div>, document.body);
}
