"use client";
import React, { useState, useEffect, useMemo } from 'react'; 
import { createPortal } from 'react-dom';
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
import { Pencil } from 'lucide-react';
import { notify } from '@/lib/notify';

export default function ManualJournalsPage() {
    const logic = useManualJournalsLogic();
    const { can } = usePermissions();
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);

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
                    <b style={{ color: THEME.primary, fontSize: '14px' }}>{row.voucher_number}</b>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{row.entry_date}</span>
                </div>
            )
        },
        { 
            header: 'بيان التسوية', 
            accessor: 'description', 
            render: (row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '250px' }}>
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
            render: (row: any) => <span style={{ fontWeight: 900, color: '#1e293b', fontSize: '15px' }}>{formatCurrency(row.amount)}</span> 
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <SecureAction module="manual_journals" action="add">
                <button className="btn-main-glass green" onClick={() => openModal()} style={{ height: '50px', fontSize: '15px' }}>
                    إضافة تسوية جديدة
                </button>
            </SecureAction>

            {logic.state.selectedIds.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px', paddingTop: '15px', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
                    <p style={{fontSize:'12px', textAlign:'center', color:'#94a3b8', fontWeight:900, margin:0}}>تم تحديد ({logic.state.selectedIds.length}) سند</p>
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
                            <span style={{fontSize:'12px', fontWeight:800, color:'#64748b'}}>إجمالي مبالغ التسويات</span>
                            <div style={{fontSize:'22px', fontWeight:900, color: THEME.primary, marginTop:'5px'}}>
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

            {mounted && isModalOpen && createPortal(
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(39,39,42, 0.5)', backdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', overflowY: 'auto' }} onClick={() => setIsModalOpen(false)}>
                    <div className="cinematic-scroll" onClick={e => e.stopPropagation()} style={{ background: '#ffffff', padding: '30px', borderRadius: '14px', width: '100%', maxWidth: '900px', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', margin: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '2px dashed #e2e8f0', paddingBottom: '15px' }}>
                            <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#1e293b', margin: 0 }}>{editingVoucher ? 'تعديل سند التسوية' : 'سند تسوية جديد'}</h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', color: '#64748b' }}>×</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="glass-input-group">
                                <label>التاريخ</label>
                                <input type="date" className="glass-input" value={formData.entry_date} onChange={e => setFormData({...formData, entry_date: e.target.value})} />
                            </div>
                            <div className="glass-input-group">
                                <label>المبلغ</label>
                                <input type="number" className="glass-input" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                            </div>
                            <div className="glass-input-group">
                                <label>البيان / تفاصيل التسوية</label>
                                <textarea className="glass-input" rows={2} placeholder="سبب التسوية..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                            </div>
                            
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div className="glass-input-group" style={{ flex: 1 }}>
                                    <label>من حساب (الطرف الدائن)</label>
                                    <SmartCombo 
                                        options={logic.state.accounts || []}
                                        displayCol="name"
                                        initialDisplay={(logic.state.accounts || []).find((a:any) => a.id === formData.credit_account_id)?.name || ''}
                                        onSelect={(val: any) => setFormData({...formData, credit_account_id: val?.id || ''})}
                                        placeholder="اختر الحساب الدائن..."
                                    />
                                </div>
                                <div className="glass-input-group" style={{ flex: 1 }}>
                                    <label>إلى حساب (الطرف المدين)</label>
                                    <SmartCombo 
                                        options={logic.state.accounts || []}
                                        displayCol="name"
                                        initialDisplay={(logic.state.accounts || []).find((a:any) => a.id === formData.debit_account_id)?.name || ''}
                                        onSelect={(val: any) => setFormData({...formData, debit_account_id: val?.id || ''})}
                                        placeholder="اختر الحساب المدين..."
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div className="glass-input-group" style={{ flex: 1 }}>
                                    <label>الشريك (اختياري)</label>
                                    <SmartCombo 
                                        options={logic.state.partners || []}
                                        displayCol="name"
                                        initialDisplay={(logic.state.partners || []).find((p:any) => p.id === formData.partner_id)?.name || ''}
                                        onSelect={(val: any) => setFormData({...formData, partner_id: val?.id || ''})}
                                        placeholder="بدون شريك"
                                    />
                                </div>
                                <div className="glass-input-group" style={{ flex: 1 }}>
                                    <label>الموقع / المشروع (اختياري)</label>
                                    <SmartCombo 
                                        options={logic.state.projects || []}
                                        displayCol="Property"
                                        initialDisplay={(logic.state.projects || []).find(p => p.id === formData.project_id)?.name || ''}
                                        onSelect={(val: any) => setFormData({...formData, project_id: val?.id || ''})}
                                        placeholder="بدون مشروع"
                                    />
                                </div>
                                <div className="glass-input-group" style={{ flex: 1 }}>
                                    <label>أمر الشغل (اختياري)</label>
                                    <SmartCombo 
                                        table="job_orders"
                                        displayCol="order_number"
                                        searchCols="order_number,notes"
                                        filterColumn="project_id"
                                        filterValue={formData.project_id || undefined}
                                        initialDisplay={formData.job_order_id ? 'أمر شغل مرتبط' : ''}
                                        customQuery={(q: any) => q.select('*, boq_budget:boq_budget_id(work_item)')}
                                        displayFormat={(item: any) => `${item.order_number} - ${item.boq_budget?.work_item || 'بدون بند'}`}
                                        onSelect={(val: any) => setFormData({...formData, job_order_id: val?.id || ''})}
                                        placeholder="بدون أمر شغل"
                                    />
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', marginTop: '30px', borderTop: '2px dashed #e2e8f0', paddingTop: '20px' }}>
                            <button className="btn-main-glass green" onClick={handleSave} disabled={logic.state.isProcessing} style={{ flex: 2, padding: '15px', fontSize: '16px' }}>
                                {editingVoucher ? 'تحديث التسوية' : 'حفظ التسوية'}
                            </button>
                            <button className="btn-main-glass red" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '15px', fontSize: '16px' }}>إلغاء</button>
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
