"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import PaginationPanel from '@/components/PaginationPanel';
import RawasiSmartTable from '@/components/rawasismarttable'; // 💎 الجدول الذكي السيادي
import SecureAction from '@/components/SecureAction'; // 🛡️ حارس الأزرار
import { useReceiptVouchersLogic } from './ReceiptVouchers_logic';
import ReceiptVoucherModal from './ReceiptVoucherModal';
import MasterPage from '@/components/MasterPage';
import { useSidebar } from '@/lib/SidebarContext';
import SmartCombo from '@/components/SmartCombo';
import LoadingScreen from '@/components/LoadingScreen';

export default function ReceiptVouchersPage() {
    // 💎 نقطة الاستدعاء الواحدة (Single Source of Truth)
    const logic = useReceiptVouchersLogic();

  // 🚀 اختصار الحفظ (Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (logic.isEditModalOpen && e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!logic.isSaving) document.getElementById('receipt-save-button')?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [logic.isEditModalOpen, logic.isSaving]);

  // 🚀 اختصار إضافة جديد (Alt + N)
  useEffect(() => {
    const handleAddShortcut = (e: KeyboardEvent) => {
      if (!logic.isEditModalOpen && e.altKey && (e.code === 'KeyN' || e.key.toLowerCase() === 'n' || e.key === 'ى')) {
        e.preventDefault();
        logic.handleAddNew();
      }
    };
    window.addEventListener('keydown', handleAddShortcut);
    return () => window.removeEventListener('keydown', handleAddShortcut);
  }, [logic.isEditModalOpen, logic.handleAddNew]);
 
    const { setSidebarContent } = useSidebar();
    
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // 🚀 استخراج العناصر الحالية لتحديد الكل بأمان (الإضافة الجديدة)
    const currentVisibleIds = useMemo(() => {
        return logic.receipts?.map((v: any) => String(v.id)) || [];
    }, [logic.receipts]);

    const isAllVisibleSelected = currentVisibleIds.length > 0 && currentVisibleIds.every((id: string) => logic.selectedIds.includes(id));

    // =========================================================================
    // 💎 أعمدة الجدول الذكي (معمارية نظيفة وحراس رندر)
    // =========================================================================
    const receiptColumns = [
        {
            // 🚀 تم تحويل الهيدر إلى Checkbox لتحديد الكل
            header: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input 
                        type="checkbox" 
                        className="custom-checkbox"
                        checked={isAllVisibleSelected}
                        title="تحديد كل الصفحة"
                        onChange={(e) => {
                            e.stopPropagation();
                            if (isAllVisibleSelected) {
                                logic.setSelectedIds(logic.selectedIds.filter((id: string) => !currentVisibleIds.includes(id)));
                            } else {
                                logic.setSelectedIds([...new Set([...logic.selectedIds, ...currentVisibleIds])]);
                            }
                        }}
                    />
                </div>
            ),
            accessor: 'id',
            render: (row: any) => {
                if (!row) return null; // 🛡️ حارس دفاعي
                return (
                    <input 
                        type="checkbox" 
                        className="custom-checkbox" 
                        checked={logic.selectedIds.includes(String(row.id))} 
                        onChange={(e) => {
                            e.stopPropagation(); 
                            logic.setSelectedIds(prev => prev.includes(String(row.id)) ? prev.filter(x => x !== String(row.id)) : [...prev, String(row.id)]);
                        }} 
                    />
                );
            }
        },
        {
            header: 'رقم السند',
            accessor: 'receipt_number',
            render: (row: any) => {
                if (!row) return null;
                return (
                    <div style={{ fontWeight: 900, color: THEME.brand.coffee }}>
                        {row.receipt_number}
                        {row.reference_number && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>مرجع: {row.reference_number}</div>}
                    </div>
                );
            }
        },
        {
            header: 'التاريخ',
            accessor: 'date',
            render: (row: any) => {
                if (!row) return null;
                return <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 700 }}>{row.date}</span>;
            }
        },
        {
            header: 'العميل / الجهة',
            accessor: 'partner_name',
            render: (row: any) => {
                if (!row) return null;
                return <span style={{ fontWeight: 800, color: '#1e293b' }}>{row.partners?.name || '---'}</span>;
            }
        },
        {
            header: 'المشروع / العقار',
            accessor: 'project_names',
            render: (row: any) => {
                if (!row) return null;
                return (
                    <div style={{ color: THEME.brand.gold, fontSize: '12px', fontWeight: 800, maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.project_names || '---'}
                    </div>
                );
            }
        },
        {
            header: 'المبلغ',
            accessor: 'amount',
            render: (row: any) => {
                if (!row) return null;
                return <span style={{ color: THEME.success, fontWeight: 900, fontSize: '14px' }}>{formatCurrency(row.amount)}</span>;
            }
        },
        {
            header: 'الحالة',
            accessor: 'status',
            render: (row: any) => {
                if (!row) return null;
                const isPosted = row.status === 'معتمد' || row.status === 'معتمد';
                const isRefunded = row.status === 'مسترجع';
                return (
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 900,
                        background: isPosted ? '#ecfdf5' : isRefunded ? '#fef2f2' : '#fff7ed',
                        color: isPosted ? '#059669' : isRefunded ? '#dc2626' : '#d97706',
                    }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPosted ? '#10b981' : isRefunded ? '#ef4444' : '#f59e0b' }}></span>
                        {row.status || 'مسودة'}
                    </div>
                );
            }
        }
    ];

    // =========================================================================
    // 🚀 السحر: نقل العمليات للسايد بار المركزي (مع حراس الأمان)
    // =========================================================================
    useEffect(() => {
        const selectedCount = logic.selectedIds.length;
        const singleSelected = selectedCount === 1;
        const selectedRecord = singleSelected ? logic.allFiltered.find(r => r.id === logic.selectedIds[0]) : null;
        const canEdit = singleSelected && logic.canUserEdit(selectedRecord);

        setSidebarContent({
            actions: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    {/* 🛡️ حماية الإضافة */}
                    <SecureAction module="receipt_vouchers" action="create">
                        <button onClick={logic.handleAddNew} className="btn-main-glass gold" style={{ background: THEME.brand.gold, color: THEME.brand.coffee, border: 'none', padding: '14px', fontWeight: 900 }}>
                            ➕ سند قبض جديد
                        </button>
                    </SecureAction>

                    {/* 🛡️ حماية التعديل */}
                    {canEdit && (
                        <SecureAction module="receipt_vouchers" action="edit">
                            <button onClick={() => logic.handleEdit(selectedRecord)} className="btn-main-glass white" style={{ padding: '12px' }}>
                                📝 تعديل السند
                            </button>
                        </SecureAction>
                    )}

                    {selectedCount > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                            <span style={{ fontSize: '11px', color: THEME.brand.gold, fontWeight: 900, textAlign: 'center' }}>إجراءات جماعية ({selectedCount})</span>
                            
                            {/* 🛡️ حماية الترحيل والإلغاء والتصحيح المجمع */}
                            <SecureAction module="receipt_vouchers" action="post">
                                <button onClick={logic.handlePostSelected} className="btn-main-glass white" style={{ borderColor: THEME.success, color: THEME.success }}>✅ ترحيل</button>
                            </SecureAction>
                            
                            <SecureAction module="receipt_vouchers" action="post">
                                <button onClick={logic.handleUnpostSelected} className="btn-main-glass white" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>⏳ فك الترحيل</button>
                            </SecureAction>
                            
                            {/* 🛠️ زر التصحيح المجمع */}
                            <SecureAction module="receipt_vouchers" action="edit">
                                <button onClick={() => logic.setIsBulkFixModalOpen(true)} className="btn-main-glass white" style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}>🛠️ تصحيح مجمع</button>
                            </SecureAction>
                            
                            <SecureAction module="receipt_vouchers" action="delete">
                                <button onClick={logic.handleDeleteSelected} className="btn-main-glass white" style={{ borderColor: '#ef4444', color: '#ef4444', background: '#ef444410' }}>🗑️ حذف نهائي</button>
                            </SecureAction>
                        </div>
                    )}
                </div>
            ),
            summary: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="summary-glass-card" style={{ borderColor: THEME.brand.gold, padding: '15px' }}>
                        <span style={{fontSize:'12px', fontWeight:800, color:'#64748b'}}>إجمالي التحصيلات 💰</span>
                        <div style={{fontSize:'22px', fontWeight:900, color: THEME.brand.gold}}>{formatCurrency(logic.kpis.totalAmount)}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div className="summary-glass-card" style={{ borderColor: THEME.success, padding: '10px', textAlign: 'center' }}>
                            <span style={{fontSize:'10px', fontWeight:800, color:'#64748b'}}>مُرحّل ✅</span>
                            <div style={{fontSize:'16px', fontWeight:900, color: THEME.success}}>{logic.kpis.posted}</div>
                        </div>
                        <div className="summary-glass-card" style={{ borderColor: '#f59e0b', padding: '10px', textAlign: 'center' }}>
                            <span style={{fontSize:'10px', fontWeight:800, color:'#64748b'}}>معلق ⏳</span>
                            <div style={{fontSize:'16px', fontWeight:900, color: '#f59e0b'}}>{logic.kpis.pending}</div>
                        </div>
                    </div>
                </div>
            ),
            customFilters: (
                <div style={{ marginTop: '10px' }}>
                    <input 
                        type="text"
                        placeholder="بحث برقم السند، العميل..."
                        value={logic.globalSearch}
                        onChange={(e) => logic.setGlobalSearch(e.target.value)}
                        style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, outline: 'none' }}
                        onFocus={(e) => e.target.style.borderColor = THEME.brand.gold}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                    />
                </div>
            )
        });

        return () => setSidebarContent({ actions: null, summary: null, customFilters: null });
        // 🚀 التعديل هنا: استخدام قيم نهائية (Primitives) بدلاً من الكائنات لمنع اللوب
    }, [
        logic.selectedIds.length, 
        logic.selectedIds[0], 
        logic.kpis.totalAmount, 
        logic.kpis.posted, 
        logic.kpis.pending, 
        logic.globalSearch, 
        logic.allFiltered.length, 
        setSidebarContent
    ]);

    // =========================================================================
    // 🎨 واجهة المستخدم (التغليف السيادي والجدول الذكي)
    // =========================================================================
    return (
        <MasterPage icon="📥" title="سندات القبض والتحصيلات" subtitle="إدارة السندات، المراجعة، والترحيل المحاسبي">
            
            {logic.isLoading ? (
                <LoadingScreen message="جاري تحميل السندات..." fullScreen={false} />
            ) : (
                <div className="clickable-rows" onKeyDown={logic.handleTableKeyDown} tabIndex={0} style={{ outline: 'none' }}>
                    <RawasiSmartTable 
                        data={logic.receipts} 
                        columns={receiptColumns} 
                        title="" 
                        onRowClick={(row) => {
                            if(logic.canUserEdit(row)) {
                                logic.handleEdit(row);
                            }
                        }} 
                    />
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                        <PaginationPanel totalItems={logic.allFiltered.length} currentPage={logic.currentPage} rowsPerPage={logic.rowsPerPage} onPageChange={logic.setCurrentPage} onRowsChange={logic.setRowsPerPage} />
                    </div>
                </div>
            )}

            {/* 🛡️ مودال الإضافة والتعديل */}
            {mounted && logic.isEditModalOpen && createPortal(
                <div style={{
                    position: 'fixed', 
                    inset: 0, 
                    zIndex: 999999, 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    background: 'rgba(44, 34, 30, 0.5)',
                    backdropFilter: 'blur(20px) saturate(180%) brightness(0.8)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%) brightness(0.8)',
                    padding: '40px 20px',
                    overflowY: 'auto',
                    direction: 'rtl'
                }}>
                    <div 
                        style={{ position: 'fixed', inset: 0, zIndex: 0 }} 
                        onClick={() => logic.setIsEditModalOpen(false)} 
                    />

                    <div className="cinematic-scroll" style={{
                        background: 'rgba(255, 255, 255, 0.95)', 
                        borderRadius: '32px', 
                        width: '100%', 
                        maxWidth: '980px', 
                        position: 'relative', 
                        zIndex: 10,
                        margin: 'auto', 
                        boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.5)',
                        animation: 'modalEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                    }}>
                        <ReceiptVoucherModal 
                            isOpen={true} 
                            onClose={() => logic.setIsEditModalOpen(false)} 
                            record={logic.currentRecord} 
                            setRecord={logic.setCurrentRecord} 
                            onSave={logic.handleSave} 
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* 🛠️ مودال التصحيح المجمع (Bulk Fix) */}
            {mounted && logic.isBulkFixModalOpen && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    background: 'rgba(44, 34, 30, 0.5)', backdropFilter: 'blur(10px)', direction: 'rtl'
                }}>
                    <div className="cinematic-scroll" style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', zIndex: 10 }}>
                        <h3 style={{ margin: '0 0 10px 0', color: THEME.brand.coffee, fontWeight: 900 }}>🛠️ التصحيح المجمع للحسابات</h3>
                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', fontWeight: 800 }}>
                            سيتم تطبيق التعديلات على ({logic.selectedIds.length}) سند مسودة.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <SmartCombo 
                                label="🏦 حساب الخزينة / البنك (للتعديل)" 
                                table="accounts" 
                                displayCol="name" 
                                onSelect={(v:any) => logic.setBulkFixAccounts({...logic.bulkFixAccounts, safe_bank_acc_id: v?.id, safe_bank_acc_name: v?.name})} 
                            />
                            <SmartCombo 
                                label="👥 حساب العميل / الجهة (للتعديل)" 
                                table="accounts" 
                                displayCol="name" 
                                onSelect={(v:any) => logic.setBulkFixAccounts({...logic.bulkFixAccounts, partner_acc_id: v?.id, partner_acc_name: v?.name})} 
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                            <button onClick={logic.handleBulkFixSave} disabled={logic.isSaving} style={{ flex: 2, background: THEME.brand.gold, color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}>
                                {logic.isSaving ? '⏳ جاري الحفظ...' : '💾 تطبيق التعديل'}
                            </button>
                            <button onClick={() => logic.setIsBulkFixModalOpen(false)} style={{ flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}>
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <style>{`
                @keyframes modalEntrance {
                    from { opacity: 0; transform: translateY(50px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .btn-main-glass { border-radius: 12px; cursor: pointer; transition: 0.2s; font-weight: 900; }
                .btn-main-glass:hover { transform: translateY(-2px); filter: brightness(1.05); }
                body { overflow: hidden; }
            `}</style>
        </MasterPage>
    );
}
