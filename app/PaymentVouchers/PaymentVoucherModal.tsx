"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Banknote, X, Save, Info, CircleAlert, UserRound, Landmark, FileText, WalletCards } from 'lucide-react';
import SmartCombo from '@/components/SmartCombo';
import JobOrderSelector from '@/components/JobOrderSelector';
import { formatCurrency } from '@/lib/helpers';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { supabase } from '@/lib/supabase';
import {
  OpenCustodyCandidate,
  pickDefaultOpenCustodyForPartner,
  validateCustodyPaymentVoucherDraft,
} from '@/lib/custodyMirror';

type Props = { isOpen: boolean; onClose: () => void; record: any; setRecord: (value: any) => void; onSave: (record: any) => unknown; isSaving?: boolean; partnerBalance?: number; isBalanceLoading?: boolean };
export default function PaymentVoucherModal({ isOpen, onClose, record, setRecord, onSave, isSaving = false, partnerBalance = 0, isBalanceLoading = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => { if (!isSaving) onClose(); }, [isSaving, onClose]);
  useEffect(() => setMounted(true), []);
  useDialogFocus(panel, isOpen && mounted, close);

  const amount = Number(record?.amount || 0);
  const hasBalance = partnerBalance > 0;
  const percentage = hasBalance ? amount / partnerBalance * 100 : 0;
  const overpaid = percentage > 100;

  const custodyStatus = validateCustodyPaymentVoucherDraft({
    debitAccount: record?.debit_account,
    debitAccountCode: record?.debit_account_code,
    debitAccountName: record?.debit_account_name,
    partnerId: record?.payee_id ?? record?.partner_id,
    creditAccount: record?.credit_account,
    creditAccountCode: record?.credit_account_code,
    creditAccountName: record?.credit_account_name,
    custodyPartnerId: record?.custody_partner_id,
  });

  const custodyPartnerId = record?.custody_partner_id ? String(record.custody_partner_id) : '';

  const { data: openCustodies = [], isFetching: loadingOpenCustodies } = useQuery<OpenCustodyCandidate[]>({
    queryKey: ['open_custodies_for_pv_partner', custodyPartnerId],
    enabled: Boolean(isOpen && custodyStatus.isCreditCustody && custodyPartnerId),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_custodies')
        .select('id, custody_number, title, partner_id, project_id, remaining_amount, status, opened_date')
        .eq('partner_id', custodyPartnerId)
        .eq('status', 'open')
        .order('opened_date', { ascending: true });
      if (error) return [];
      return (data || []) as OpenCustodyCandidate[];
    },
  });

  // Auto-select the best matching open custody when a custody holder is chosen
  useEffect(() => {
    if (!isOpen || !custodyStatus.isCreditCustody || !custodyPartnerId || openCustodies.length === 0) return;
    const currentId = record?.custody_id ? String(record.custody_id) : '';
    const stillValid = currentId && openCustodies.some((c) => String(c.id) === currentId);
    if (stillValid) return;

    const picked = pickDefaultOpenCustodyForPartner(
      openCustodies,
      custodyPartnerId,
      amount,
      record?.project_ids?.[0] || null,
    );
    if (picked) {
      setRecord((prev: any) => ({ ...prev, custody_id: picked.id }));
    }
  }, [isOpen, custodyStatus.isCreditCustody, custodyPartnerId, openCustodies, record?.custody_id, record?.project_ids, amount, setRecord]);

  const selectedCustody = useMemo(
    () => openCustodies.find((c) => String(c.id) === String(record?.custody_id || '')) || null,
    [openCustodies, record?.custody_id],
  );

  if (!isOpen || !mounted || !record) return null;

  const custodyExceedsRemaining =
    Boolean(selectedCustody) && amount > Number(selectedCustody?.remaining_amount || 0);

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
            <div className="ent-form-field"><SmartCombo label="الفيلا / مركز التكلفة" table="projects" displayCol="Property" initialDisplay={record.site_ref || ''} onSelect={value => setRecord({ ...record, site_ref: value?.Property || '', project_ids: value?.id ? [value.id] : [], job_order_id: null, job_order_number: '' })}/></div>
            <div className="ent-form-field">{/* الفيلا ← أوامر الشغل بتاعتها: الصرف بيتحمّل على أمر الشغل */}<JobOrderSelector projectId={record.project_ids?.[0] || null} value={record.job_order_id || null} onChange={(jobOrderId, jo) => setRecord((prev: any) => ({ ...prev, job_order_id: jobOrderId, job_order_number: jo?.order_number || '' }))} required={Boolean(record.project_ids?.[0])}/></div>
            <div className="ent-form-field ent-form-full"><label htmlFor={`${id}-description`}>بيان السند</label><textarea id={`${id}-description`} placeholder="اكتب وصفًا واضحًا لسبب الصرف…" value={record.description || ''} onChange={event => setRecord({ ...record, description: event.target.value })}/></div>
          </div>
          {record.payee_id && <div className="ent-balance"><span>رصيد المستفيد قبل الصرف</span>{isBalanceLoading ? <span>جاري الحساب…</span> : <strong>{formatCurrency(Math.abs(partnerBalance))} {partnerBalance > 0 ? '(مستحق له)' : partnerBalance < 0 ? '(مدين — عليه)' : '(رصيد صفر)'}</strong>}{!isBalanceLoading && hasBalance && amount > 0 && <span>نسبة السداد: {percentage.toFixed(1)}%</span>}</div>}
          {!isBalanceLoading && overpaid && <div className="ent-overpaid" role="status"><CircleAlert size={15}/> مبلغ الصرف يتجاوز المستحق بـ {formatCurrency(amount - partnerBalance)}. يتحول الفارق إلى مديونية على المستفيد لصالح الشركة.</div>}
          </section>
          <div className="ent-form-divider"/>
          <section className="ent-form-section"><h3><Landmark size={17}/>التوجيه المحاسبي <span className="ent-muted">اختياري عند حفظ المسودة</span></h3><div className="ent-form-grid">
            <div className="ent-form-field"><SmartCombo label="الحساب المدين — من حساب" table="accounts" displayCol="name" initialDisplay={record.debit_account_name || ''} strict onSelect={value => setRecord((prev: any) => ({ ...prev, debit_account_name: value?.name || '', debit_account_code: value?.code || '', debit_account_id: value?.id || null }))}/></div>
            <div className="ent-form-field"><SmartCombo label="الحساب الدائن — الخزينة / البنك / العهدة" table="accounts" displayCol="name" initialDisplay={record.credit_account_name || ''} strict onSelect={value => setRecord((prev: any) => {
              const nextIsCreditCustody = Boolean(value && (/^125/.test(String(value.code || '').trim()) || String(value.name || '').includes('عهد')));
              return {
                ...prev,
                credit_account_name: value?.name || '',
                credit_account_code: value?.code || '',
                credit_account_id: value?.id || null,
                custody_partner_id: nextIsCreditCustody ? (prev.custody_partner_id || null) : null,
                custody_partner_name: nextIsCreditCustody ? (prev.custody_partner_name || '') : '',
                custody_id: nextIsCreditCustody ? (prev.custody_id || null) : (custodyStatus.isCustody ? prev.custody_id : null),
              };
            })}/></div>
          </div>

          {custodyStatus.isCreditCustody && (
            <div
              style={{
                marginTop: '0.9rem',
                padding: '0.95rem 1rem',
                borderRadius: '14px',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                background: 'rgba(245, 158, 11, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem', fontWeight: 900, fontSize: 'var(--fs-sm)', color: 'var(--accent-ink, #d97706)' }}>
                <WalletCards size={16} />
                <span>سداد من حساب العُهد — تحديد صاحب العهدة وربطها بصفحة العُهد</span>
              </div>

              <div className="ent-form-grid">
                <div className="ent-form-field">
                  <SmartCombo
                    key={`custody-holder-${custodyStatus.isCreditCustody ? 'on' : 'off'}`}
                    label="صاحب العهدة (الشخص اللي العهدة في ذمته) *"
                    table="partners"
                    displayCol="name"
                    placeholder="ابحث واختر المهندس / المشرف صاحب العهدة..."
                    initialDisplay={record.custody_partner_name || ''}
                    strict
                    enableClear
                    onSelect={value => setRecord((prev: any) => ({
                      ...prev,
                      custody_partner_id: value?.id || null,
                      custody_partner_name: value?.name || '',
                      custody_id: null,
                    }))}
                  />
                </div>

                <div className="ent-form-field">
                  <label htmlFor={`${id}-linked-custody`}>العهدة المربوطة في صفحة العُهد</label>
                  <select
                    id={`${id}-linked-custody`}
                    value={record.custody_id || ''}
                    disabled={!custodyPartnerId || loadingOpenCustodies}
                    onChange={event => setRecord((prev: any) => ({
                      ...prev,
                      custody_id: event.target.value || null,
                    }))}
                  >
                    <option value="">
                      {loadingOpenCustodies
                        ? 'جاري جلب العُهد المفتوحة...'
                        : openCustodies.length > 0
                          ? 'تلقائي — ربط بأقرب عهدة مفتوحة للبارتنر'
                          : custodyPartnerId
                            ? 'لا توجد عهدة مفتوحة لهذا البارتنر'
                            : 'اختر صاحب العهدة أولاً'}
                    </option>
                    {openCustodies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${c.custody_number || ''} — ${c.title || 'عهدة'} (متبقي: ${formatCurrency(Number(c.remaining_amount || 0))})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!custodyPartnerId ? (
                <div className="ent-overpaid" role="status" style={{ marginTop: '0.65rem' }}>
                  <CircleAlert size={16} />
                  <span>{custodyStatus.creditError}</span>
                </div>
              ) : loadingOpenCustodies ? (
                <div className="ent-help" role="status" style={{ marginTop: '0.65rem' }}>
                  <Info size={16} />
                  <span>جاري التحقق من العُهد المفتوحة باسم ({record.custody_partner_name})...</span>
                </div>
              ) : openCustodies.length === 0 ? (
                <div className="ent-overpaid" role="status" style={{ marginTop: '0.65rem' }}>
                  <CircleAlert size={16} />
                  <span>لا توجد عُهد مفتوحة حالياً باسم ({record.custody_partner_name}) في صفحة العُهد؛ سيتم إثبات الحركة الدائنة على حساب العهد (125) للبارتنر عند الترحيل.</span>
                </div>
              ) : custodyExceedsRemaining && selectedCustody ? (
                <div className="ent-overpaid" role="status" style={{ marginTop: '0.65rem' }}>
                  <CircleAlert size={16} />
                  <span>تنبيه: مبلغ السند ({formatCurrency(amount)}) أكبر من المتبقي في العهدة {selectedCustody.custody_number} ({formatCurrency(Number(selectedCustody.remaining_amount || 0))}). سيتم ربط الحركة بالعهدة وتحديث رصيدها في صفحة العُهد.</span>
                </div>
              ) : selectedCustody ? (
                <div className="ent-help" role="status" style={{ marginTop: '0.65rem' }}>
                  <Info size={16} />
                  <span>سيتم ربط السند مباشرة بالعهدة ({selectedCustody.custody_number}) الخاصة بـ ({record.custody_partner_name})، وبمجرد الترحيل يُخصم المبلغ تلقائياً في صفحة العُهد ويظهر في كشف حساب صاحب العهدة.</span>
                </div>
              ) : null}
            </div>
          )}

          {custodyStatus.bothSidesCustody ? (
            <div className="ent-overpaid" role="status" style={{ marginTop: '0.75rem' }}>
              <CircleAlert size={16} />
              <span>{custodyStatus.error}</span>
            </div>
          ) : custodyStatus.isCustody && (
            <div className={custodyStatus.debitValid ? 'ent-help' : 'ent-overpaid'} role="status" style={{ marginTop: '0.75rem' }}>
              {custodyStatus.debitValid ? <Info size={16} /> : <CircleAlert size={16} />}
              <span>{custodyStatus.debitValid ? (record.custody?.custody_number ? `مرتبط تلقائياً بالعهدة ${record.custody.custody_number} — أي تعديل هنا سينعكس على شاشة العُهد تلقائياً.` : 'سيتم إنشاء وربط عهدة تلقائياً في شاشة العُهد (ح/ 125) كمسودة لحين اعتماد السند.') : custodyStatus.error}</span>
            </div>
          )}
          </section>
          <div className="ent-help"><Info size={16}/><span>يُحفظ السند كمسودة. راجع بيانات السداد والحسابات ثم اعتمده من شاشة سندات الصرف لتسجيل الترحيل.</span></div>
        </div>
        <footer className="ent-dialog-footer"><div className="ent-dialog-total" aria-live="polite"><small>إجمالي مبلغ السند</small><strong>{formatCurrency(amount)}</strong></div><div><button type="button" className="ent-button" onClick={close} disabled={isSaving}>إلغاء</button><button type="submit" id="payment-save-button" className="ent-button ent-primary" disabled={isSaving || amount <= 0}><Save size={16}/>{isSaving ? 'جاري الحفظ…' : 'حفظ كمسودة'}</button></div></footer>
      </form>
    </div>
  </div>, document.body);
}
