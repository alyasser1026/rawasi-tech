"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Banknote, Plus, Download, Printer, Search, SlidersHorizontal, CircleCheck, Clock3, Pencil, RotateCcw, Trash2, X, ChevronLeft, ChevronRight, Landmark, FileText, ArrowUpDown } from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import WorkspaceDialog from '@/components/WorkspaceDialog';
import SmartCombo from '@/components/SmartCombo';
import { usePermissions } from '@/lib/PermissionsContext';
import { useConfirm } from '@/components/ConfirmContext';
import { formatCurrency } from '@/lib/helpers';
import { isCustodyAccountLike } from '@/lib/custodyMirror';
import { usePaymentVouchersLogic } from './payment_vouchers_logic';
import PaymentVoucherModal from './PaymentVoucherModal';
import PaymentPrintModal from './PaymentPrintModal';

export default function PaymentVouchersPage() {
  const logic = usePaymentVouchersLogic();
  const { state, actions } = logic;
  const { can, loading: permsLoading } = usePermissions();
  const { showConfirm } = useConfirm();
  const [printData, setPrintData] = useState<any>(null);
  const [dateFilters, setDateFilters] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  type SortKey = 'voucher_number' | 'date' | 'payee' | 'amount';
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const checkAll = useRef<HTMLInputElement>(null);
  const ids = useMemo(() => logic.data.map(row => String(row.id)), [logic.data]);
  const allSelected = ids.length > 0 && ids.every(id => state.selectedIds.includes(id));
  const partial = !allSelected && ids.some(id => state.selectedIds.includes(id));
  const postedCount = logic.data.filter(row => row.is_posted).length;
  const totalPages = Math.max(1, Math.ceil(logic.data.length / state.rowsPerPage));
  const currentPage = Math.min(state.currentPage, totalPages);
  const start = (currentPage - 1) * state.rowsPerPage;
  const orderedRows = useMemo(() => {
    if (!sort) return logic.data;
    const value = (row: any) => sort.key === 'payee' ? row.payee?.name || row.payee_name || '' : row[sort.key];
    return [...logic.data].sort((a, b) => {
      const comparison = sort.key === 'amount' ? Number(value(a) || 0) - Number(value(b) || 0) : String(value(a) || '').localeCompare(String(value(b) || ''), 'ar', { numeric: true });
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [logic.data, sort]);
  const rows = orderedRows.slice(start, start + state.rowsPerPage);
  const sortHeader = (key: SortKey, label: string) => <th aria-sort={sort?.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="ent-table-sort" onClick={() => { setSort({ key, direction: sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc' }); actions.setCurrentPage(1); }}>{label}<ArrowUpDown size={12}/></button></th>;
  useEffect(() => { if (checkAll.current) checkAll.current.indeterminate = partial; }, [partial, logic.isLoading]);
  useEffect(() => { if (state.currentPage > totalPages) actions.setCurrentPage(totalPages); }, [state.currentPage, totalPages, actions]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (state.isEditModalOpen && event.ctrlKey && event.key === 'Enter') { event.preventDefault(); document.getElementById('payment-save-button')?.click(); }
      if (!state.isEditModalOpen && !state.isBulkFixModalOpen && event.altKey && event.code === 'KeyN' && can('payments', 'create')) { event.preventDefault(); actions.handleAddNew(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, can, state.isEditModalOpen, state.isBulkFixModalOpen]);
  const toggleAll = () => actions.setSelectedIds(allSelected ? state.selectedIds.filter(id => !ids.includes(id)) : [...new Set([...state.selectedIds, ...ids])]);
  const resetFilters = () => { actions.setGlobalSearch(''); actions.setFilterStatus('الكل'); actions.setDateRange({ start: '', end: '' }); actions.setCurrentPage(1); };
  const exportRows = () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(orderedRows.map(row => ({ 'رقم السند': row.voucher_number, 'التاريخ': row.date, 'المستفيد': row.payee?.name || row.payee_name || '', 'الحساب الدائن': row.credit_account?.name || '', 'الحساب المدين': row.debit_account?.name || '', 'البيان': row.description || '', 'المبلغ': Number(row.amount || 0), 'الحالة': row.is_posted ? 'معتمد' : 'معلق' })));
    sheet['!cols'] = Array.from({ length: 8 }, () => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(workbook, sheet, 'سندات الصرف');
    XLSX.writeFile(workbook, `Phi_Tech_Payments_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const setDate = (key: 'start' | 'end', value: string) => { actions.setDateRange({ ...state.dateRange, [key]: value }); actions.setCurrentPage(1); };
  return <>
    <MasterPage enterprise icon={<Banknote/>} title="سندات الصرف" subtitle="إدارة المدفوعات، مراجعة السندات والتوجيه المحاسبي">
      <div className="ent-summary-grid">
        <div className="ent-summary-card"><div className="ent-summary-top"><span>قيمة السندات المعروضة</span><div className="ent-summary-icon"><Banknote size={19}/></div></div><strong>{formatCurrency(logic.totals.totalAmount)}</strong><small>ضمن البحث والفترة المحددين</small></div>
        <div className="ent-summary-card"><div className="ent-summary-top"><span>سندات معتمدة</span><div className="ent-summary-icon green"><CircleCheck size={19}/></div></div><strong>{postedCount.toLocaleString('en-US')}</strong><small>ضمن السندات المعروضة</small></div>
        <div className="ent-summary-card"><div className="ent-summary-top"><span>بانتظار الترحيل</span><div className="ent-summary-icon blue"><Clock3 size={19}/></div></div><strong>{(logic.data.length - postedCount).toLocaleString('en-US')}</strong><small>سندات معلّقة ضمن التصفية الحالية</small></div>
      </div>
      <section className="ent-panel" aria-label="سجل سندات الصرف">
        <div className="ent-panel-heading"><div className="ent-panel-title"><h2>سجل المدفوعات</h2><small>{logic.data.length.toLocaleString('en-US')} سند</small></div><div className="ent-panel-actions no-print">
          <button type="button" className="ent-button" onClick={exportRows} disabled={!logic.data.length || logic.isLoading}><Download size={16}/>تصدير Excel</button>
          {can('payments', 'create') && <button type="button" className="ent-button ent-primary" onClick={actions.handleAddNew} disabled={logic.isLoading}><Plus size={17}/>سند صرف جديد</button>}
        </div></div>
        <div className="ent-filters no-print"><div className="ent-segments" role="group" aria-label="حالة السند">{['الكل', 'معتمد', 'معلق'].map(status => <button key={status} type="button" aria-pressed={state.filterStatus === status} onClick={() => { actions.setFilterStatus(status); actions.setCurrentPage(1); }}>{status === 'الكل' ? 'كل السندات' : status === 'معتمد' ? 'المعتمدة' : 'المعلقة'}</button>)}</div>
          <div className="ent-filter-actions"><div className="ent-search"><Search size={16}/><input aria-label="البحث في السندات" placeholder="ابحث برقم السند أو المستفيد…" value={state.globalSearch} onChange={event => { actions.setGlobalSearch(event.target.value); actions.setCurrentPage(1); }}/></div><button type="button" className="ent-button" aria-expanded={dateFilters} onClick={() => setDateFilters(value => !value)}><SlidersHorizontal size={15}/>الفترة</button>{(state.globalSearch || state.dateRange.start || state.dateRange.end || state.filterStatus !== 'الكل') && <button type="button" className="ent-icon-button" onClick={resetFilters} aria-label="مسح فلاتر السندات"><X size={16}/></button>}</div>
        </div>
        {dateFilters && <div className="ent-date-filters no-print"><label>من تاريخ<input type="date" value={state.dateRange.start} onChange={event => setDate('start', event.target.value)}/></label><label>إلى تاريخ<input type="date" value={state.dateRange.end} onChange={event => setDate('end', event.target.value)}/></label></div>}
        {state.selectedIds.length > 0 && <div className="ent-bulk-actions no-print"><strong>{state.selectedIds.length} سند محدد</strong>
          {can('payments', 'edit') && state.selectedIds.length === 1 && <button type="button" className="ent-button" onClick={actions.handleEditSelected} disabled={logic.isLoading}><Pencil size={14}/>تعديل</button>}
          {can('payments', 'edit') && <button type="button" className="ent-button" onClick={() => actions.setIsBulkFixModalOpen(true)} disabled={logic.isLoading}><Landmark size={14}/>تصحيح الحسابات</button>}
          {can('payments', 'post') && <><button type="button" className="ent-button ent-success" onClick={() => void actions.handlePostSelected()} disabled={logic.isLoading}><CircleCheck size={14}/>اعتماد وترحيل</button><button type="button" className="ent-button" onClick={() => void actions.handleUnpostSelected()} disabled={logic.isLoading}><RotateCcw size={14}/>فك الترحيل</button></>}
          {can('payments', 'delete') && <button type="button" className="ent-button ent-danger" disabled={logic.isLoading} onClick={() => showConfirm({ title: 'حذف سندات الصرف المحددة', message: `سيتم حذف ${state.selectedIds.length} سند نهائيًا. لا يمكن حذف السندات المرحلة قبل فك الترحيل.`, type: 'danger', onConfirm: actions.handleDeleteSelected })}><Trash2 size={14}/>حذف</button>}
          <button type="button" className="ent-icon-button" onClick={() => actions.setSelectedIds([])} aria-label="إلغاء تحديد السندات"><X size={14}/></button>
        </div>}
        {(logic.isLoading || permsLoading) ? <div className="ent-empty" role="status">جاري تحميل سندات الصرف…</div> : rows.length ? <div className="ent-table-scroll"><table className="ent-table"><thead><tr><th className="ent-check"><input type="checkbox" ref={checkAll} checked={allSelected} onChange={toggleAll} aria-label="تحديد كل السندات المفلترة"/></th>{sortHeader('voucher_number', 'رقم السند')}{sortHeader('payee', 'المستفيد / البيان')}{sortHeader('date', 'التاريخ')}<th>طريقة الدفع</th><th>التوجيه المحاسبي</th>{sortHeader('amount', 'المبلغ')}<th>الحالة</th><th className="ent-row-actions">إجراءات</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} data-selected={state.selectedIds.includes(String(row.id))}>
          <td className="ent-check"><input type="checkbox" checked={state.selectedIds.includes(String(row.id))} onChange={() => actions.setSelectedIds(state.selectedIds.includes(String(row.id)) ? state.selectedIds.filter(id => id !== String(row.id)) : [...state.selectedIds, String(row.id)])} aria-label={`تحديد السند ${row.voucher_number}`}/></td>
          <td><span className="ent-voucher-number" dir="ltr">{row.voucher_number}</span></td><td className="ent-payee-cell"><strong>{row.payee?.name || row.payee_name || 'بدون مستفيد'}</strong><small>{row.description || '—'}</small></td><td><span className="ent-muted" dir="ltr">{row.date}</span></td><td>{row.payment_method || '—'}</td><td className="ent-payee-cell"><small>من: {row.debit_account?.name || 'غير محدد'}</small><small>إلى: {row.credit_account?.name || 'غير محدد'}</small>{(row.custody?.custody_number || isCustodyAccountLike(row.debit_account)) && <Link href={`/custodies?q=${encodeURIComponent(row.custody?.custody_number || row.voucher_number)}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:underline mt-0.5">{row.custody?.custody_number ? `عهدة: ${row.custody.custody_number}` : 'عهدة (ح/ 125)'}</Link>}</td><td><span className="ent-amount">{formatCurrency(row.amount)}</span></td><td><span className={`ent-status ${row.is_posted ? 'posted' : 'draft'}`}>{row.is_posted ? <CircleCheck/> : <Clock3/>}{row.is_posted ? 'معتمد' : 'معلق'}</span></td><td className="ent-row-actions"><button type="button" className="ent-icon-button" onClick={() => setPrintData(row)} aria-label={`طباعة السند ${row.voucher_number}`}><Printer size={16}/></button></td>
        </tr>)}</tbody></table></div> : <div className="ent-empty"><FileText size={32}/><h3>لا توجد سندات مطابقة</h3><p>ستظهر السندات هنا بعد إضافتها، أو بعد تعديل خيارات البحث والفترة.</p>{can('payments', 'create') && <button type="button" className="ent-button ent-primary" onClick={actions.handleAddNew}><Plus size={16}/>إضافة سند صرف</button>}</div>}
        <footer className="ent-table-footer no-print"><span>{logic.data.length ? `عرض ${start + 1}–${Math.min(start + state.rowsPerPage, logic.data.length)} من ${logic.data.length} سند` : 'لا توجد نتائج'}</span><div className="ent-pagination"><label htmlFor="payment-page-size">عدد الصفوف</label><select id="payment-page-size" value={state.rowsPerPage} onChange={event => { actions.setRowsPerPage(Number(event.target.value)); actions.setCurrentPage(1); }}>{[20,50,100].map(size => <option key={size} value={size}>{size}</option>)}</select><button type="button" className="ent-icon-button" disabled={currentPage <= 1} onClick={() => actions.setCurrentPage(currentPage - 1)} aria-label="الصفحة السابقة"><ChevronRight size={16}/></button><span>{currentPage} / {totalPages}</span><button type="button" className="ent-icon-button" disabled={currentPage >= totalPages} onClick={() => actions.setCurrentPage(currentPage + 1)} aria-label="الصفحة التالية"><ChevronLeft size={16}/></button></div></footer>
      </section>
    </MasterPage>
    <PaymentVoucherModal isOpen={state.isEditModalOpen} onClose={() => actions.setIsEditModalOpen(false)} record={state.currentVoucher} setRecord={actions.setCurrentVoucher} onSave={actions.handleSaveVoucher} isSaving={logic.isLoading} partnerBalance={state.partnerBalance} isBalanceLoading={state.isBalanceLoading}/>
    <PaymentPrintModal isOpen={!!printData} onClose={() => setPrintData(null)} record={printData}/>
    {state.isBulkFixModalOpen && <WorkspaceDialog title="تصحيح التوجيه المحاسبي" onClose={() => { if (!bulkSaving) actions.setIsBulkFixModalOpen(false); }}><p className="ent-muted">تُطبّق الحسابات المختارة على السندات المعلقة فقط.</p><div className="ent-form-grid" style={{ marginTop:'1.125rem' }}><div className="ent-form-field"><SmartCombo label="الحساب المدين الجديد" table="accounts" strict initialDisplay={state.bulkFixAccounts.debit_account_name} onSelect={value => actions.setBulkFixAccounts({ ...state.bulkFixAccounts, debit_account_name:value?.name || '', debit_account_id:value?.id || null })}/></div><div className="ent-form-field"><SmartCombo label="الحساب الدائن الجديد" table="accounts" strict initialDisplay={state.bulkFixAccounts.credit_account_name} onSelect={value => actions.setBulkFixAccounts({ ...state.bulkFixAccounts, credit_account_name:value?.name || '', credit_account_id:value?.id || null })}/></div></div><button type="button" className="ent-button ent-primary" style={{ marginTop:'1.25rem' }} disabled={bulkSaving || (!state.bulkFixAccounts.credit_account_id && !state.bulkFixAccounts.debit_account_id)} onClick={async () => { setBulkSaving(true); try { await actions.handleBulkFixSave(); } finally { setBulkSaving(false); } }}>{bulkSaving ? 'جاري الحفظ…' : 'تطبيق التعديلات'}</button></WorkspaceDialog>}
  </>;
}
