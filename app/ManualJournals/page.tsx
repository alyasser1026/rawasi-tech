"use client";
import React, { useState, useMemo } from 'react'; 
import { useManualJournalsLogic } from './manual_journals_logic';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo'; 
import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import { usePermissions } from '@/lib/PermissionsContext'; 
import SecureAction from '@/components/SecureAction';      
import { formatCurrency } from '@/lib/helpers';
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import LoadingScreen from '@/components/LoadingScreen';
import { ArrowLeftRight, FileText, Link2, Pencil, Save, Scale } from 'lucide-react';
import PhiDialog from '@/components/PhiDialog';
import { notify } from '@/lib/notify';

export default function ManualJournalsPage() {
    const logic = useManualJournalsLogic();
    const { can } = usePermissions();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState<any>(null);

    // Modal state
    const [formData, setFormData] = useState({
        entry_date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        debit_account_id: '',
        credit_account_id: '',
        partner_id: '',
        project_id: '',
        job_order_id: ''
    });

    const openModal = (j: any = null) => {
        if (j) {
            if (j.is_posted || j.status === 'معتمد' || j.status === 'مرحل') {
                notify('عذراً، لا يمكن تعديل قيد تم ترحيله.');
                return;
            }
            setFormData({
                entry_date: j.entry_date,
                description: j.description,
                amount: j.amount,
                debit_account_id: j.debit_account_id,
                credit_account_id: j.credit_account_id,
                partner_id: j.partner_id || '',
                project_id: j.project_id || '',
                job_order_id: j.job_order_id || ''
            });
            setEditingVoucher(j);
        } else {
            setFormData({
                entry_date: new Date().toISOString().split('T')[0],
                description: '',
                amount: '',
                debit_account_id: '',
                credit_account_id: '',
                partner_id: '',
                project_id: '',
                job_order_id: ''
            });
            setEditingVoucher(null);
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            await logic.actions.saveJournal({ ...formData, id: editingVoucher?.id });
            setIsModalOpen(false);
        } catch (error) {
            // Error handled in logic
        }
    };

    const columns = useMemo(() => [
        { 
            header: 'رقم السند', 
            accessor: 'voucher_number', 
            render: (row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <b style={{ color: THEME.primary, fontSize: 'var(--fs-md)' }}>{row.voucher_number}</b>
                    <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b' }}>{row.entry_date}</span>
                </div>
            )
        },
        { 
            header: 'بيان التسوية', 
            accessor: 'description', 
            render: (row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '15.625rem' }}>
                    <span style={{ color: '#1e293b', fontWeight: 800 }}>{row.description}</span>
                </div>
            )
        },
        { 
            header: 'من حساب (دائن)', 
            accessor: 'credit_account', 
            render: (row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#dc2626', fontWeight: 800 }}>{row.credit_account?.name || '---'}</span>
                </div>
            )
        },
        { 
            header: 'إلى حساب (مدين)', 
            accessor: 'debit_account', 
            render: (row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#059669', fontWeight: 800 }}>{row.debit_account?.name || '---'}</span>
                </div>
            )
        },
        { 
            header: 'المبلغ', 
            accessor: 'amount', 
            render: (row: any) => <span style={{ fontWeight: 900, color: '#1e293b', fontSize: 'var(--fs-lg)' }}>{formatCurrency(row.amount)}</span> 
        },
        {
            header: 'الحالة',
            accessor: 'status',
            render: (row: any) => (
                row.is_posted || row.status === 'معتمد' || row.status === 'مرحل' ? 
                <span className="badge-glass green">مرحل</span> : 
                <span className="badge-glass yellow">مسودة</span>
            )
        },
        {
            header: 'إجراءات',
            accessor: 'actions',
            render: (row: any) => (
                <SecureAction module="manual_journals" action="edit">
                    <button className="btn-main-glass icon-only blue" onClick={() => openModal(row)} disabled={row.is_posted || row.status === 'مرحل'}>
                        <Pencil size={16} aria-hidden="true" />
                    </button>
                </SecureAction>
            )
        }
    ], []);

    const sidebarActions = useMemo(() => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
            <SecureAction module="manual_journals" action="add">
                <button className="btn-main-glass green" onClick={() => openModal()} style={{ height: '3.125rem', fontSize: 'var(--fs-lg)' }}>
                    إضافة تسوية جديدة
                </button>
            </SecureAction>

            {logic.state.selectedIds.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.625rem', paddingTop: '0.9375rem', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
                    <p style={{fontSize:'var(--fs-sm)', textAlign:'center', color:'#94a3b8', fontWeight:900, margin:0}}>تم تحديد ({logic.state.selectedIds.length}) سند</p>
                    <SecureAction module="manual_journals" action="post">
                        <button className="btn-main-glass blue" onClick={logic.actions.handlePostSelected}>ترحيل القيود المحددة</button>
                    </SecureAction>
                    <SecureAction module="manual_journals" action="unpost">
                        <button className="btn-main-glass yellow" onClick={logic.actions.handleUnpostSelected}>فك ترحيل المحددة</button>
                    </SecureAction>
                    <SecureAction module="manual_journals" action="delete">
                        <button className="btn-main-glass red" onClick={logic.actions.handleDeleteSelected}>حذف القيود المحددة</button>
                    </SecureAction>
                </div>
            )}
        </div>
    ), [logic.state.selectedIds.length, logic.actions.handlePostSelected, logic.actions.handleUnpostSelected, logic.actions.handleDeleteSelected]); 

    if (logic.state.isLoading) return <LoadingScreen message="جاري تجهيز السجلات..." />;

    return (
        <div className="clean-page">
            <MasterPage title="القيود اليدوية (التسويات)" subtitle="ترحيل مبالغ من حساب إلى حساب بشكل يدوي مباشر ومحاسبي.">
                
                <RawasiSidebarManager 
                    summary={
                        <div className="summary-glass-card">
                            <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي مبالغ التسويات</span>
                            <div style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: THEME.primary, marginTop:'0.3125rem'}}>
                                {formatCurrency(logic.state.totals.amount)}
                            </div>
                        </div>
                    }
                    actions={sidebarActions}
                    watchDeps={[logic.state.selectedIds]}
                />

                <RawasiSmartTable 
                    columns={columns}
                    data={logic.state.paginatedJournals}
                    selectable={true}
                    selectedIds={logic.state.selectedIds}
                    onSelectionChange={logic.state.setSelectedIds}
                />
            </MasterPage>

            <PhiDialog
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingVoucher ? 'تعديل سند التسوية' : 'سند تسوية جديد'}
                subtitle={editingVoucher?.voucher_number ? `رقم السند: ${editingVoucher.voucher_number}` : 'قيد بطرفين: حساب مدين وحساب دائن بنفس المبلغ'}
                icon={<Scale size={22} />}
                busy={logic.state.isProcessing}
                total={<><small>مبلغ التسوية</small><strong>{formatCurrency(Number(formData.amount || 0))}</strong></>}
                footer={<button type="button" className="ent-button ent-primary" onClick={() => void handleSave()} disabled={logic.state.isProcessing || !(Number(formData.amount) > 0)}><Save size={16} aria-hidden="true" />{logic.state.isProcessing ? 'جاري الحفظ…' : editingVoucher ? 'تحديث التسوية' : 'حفظ التسوية'}</button>}
            >
                <section className="ent-form-section"><h3><FileText size={17} aria-hidden="true" />بيانات السند</h3><div className="ent-form-grid">
                    <div className="ent-form-field"><label htmlFor="mj-date">التاريخ</label><input id="mj-date" type="date" required value={formData.entry_date} onChange={e => setFormData({...formData, entry_date: e.target.value})} /></div>
                    <div className="ent-form-field"><label htmlFor="mj-amount">المبلغ <span aria-hidden="true">*</span></label><input id="mj-amount" data-autofocus type="number" min="0.01" step="0.01" required placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                    <div className="ent-form-field ent-form-full"><label htmlFor="mj-description">البيان / تفاصيل التسوية</label><textarea id="mj-description" rows={2} placeholder="سبب التسوية…" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                </div></section>
                <div className="ent-form-divider" />
                <section className="ent-form-section"><h3><ArrowLeftRight size={17} aria-hidden="true" />طرفا القيد</h3><div className="ent-form-grid">
                    <div className="ent-form-field"><SmartCombo label="من حساب (الطرف الدائن)" options={logic.state.accounts || []} displayCol="name" initialDisplay={(logic.state.accounts || []).find((a: any) => a.id === formData.credit_account_id)?.name || ''} onSelect={(val: any) => setFormData({...formData, credit_account_id: val?.id || ''})} placeholder="اختر الحساب الدائن…" /></div>
                    <div className="ent-form-field"><SmartCombo label="إلى حساب (الطرف المدين)" options={logic.state.accounts || []} displayCol="name" initialDisplay={(logic.state.accounts || []).find((a: any) => a.id === formData.debit_account_id)?.name || ''} onSelect={(val: any) => setFormData({...formData, debit_account_id: val?.id || ''})} placeholder="اختر الحساب المدين…" /></div>
                </div></section>
                <div className="ent-form-divider" />
                <section className="ent-form-section"><h3><Link2 size={17} aria-hidden="true" />الربط التحليلي <span className="ent-muted">اختياري</span></h3><div className="ent-form-grid cols-3">
                    <div className="ent-form-field"><SmartCombo label="الشريك" options={logic.state.partners || []} displayCol="name" initialDisplay={(logic.state.partners || []).find((p: any) => p.id === formData.partner_id)?.name || ''} onSelect={(val: any) => setFormData({...formData, partner_id: val?.id || ''})} placeholder="بدون شريك" /></div>
                    <div className="ent-form-field"><SmartCombo label="الموقع / المشروع" options={logic.state.projects || []} displayCol="Property" initialDisplay={(() => { const project: any = (logic.state.projects || []).find((p: any) => p.id === formData.project_id); return project?.Property || project?.name || ''; })()} onSelect={(val: any) => setFormData({...formData, project_id: val?.id || ''})} placeholder="بدون مشروع" /></div>
                    <div className="ent-form-field"><SmartCombo label="أمر الشغل" table="job_orders" displayCol="order_number" searchCols="order_number,notes" filterColumn="project_id" filterValue={formData.project_id || undefined} initialDisplay={formData.job_order_id ? 'أمر شغل مرتبط' : ''} customQuery={(q: any) => q.select('*, boq_budget:boq_budget_id(work_item)')} displayFormat={(item: any) => `${item.order_number} - ${item.boq_budget?.work_item || 'بدون بند'}`} onSelect={(val: any) => setFormData({...formData, job_order_id: val?.id || ''})} placeholder="بدون أمر شغل" /></div>
                </div></section>
            </PhiDialog>
        </div>
    );
}
