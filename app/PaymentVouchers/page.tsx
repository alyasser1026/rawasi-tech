"use client";
import React, { useState, useEffect, useMemo } from 'react'; 
import { createPortal } from 'react-dom'; 
import { usePaymentVouchersLogic } from './payment_vouchers_logic';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo'; 
import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import { usePermissions } from '@/lib/PermissionsContext'; 
import SecureAction from '@/components/SecureAction';      
import { formatCurrency } from '@/lib/helpers';
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import { useConfirm } from '@/components/ConfirmContext';


import PaymentVoucherModal from './PaymentVoucherModal'; 
import PaymentPrintModal from './PaymentPrintModal'; 
import LoadingScreen from '@/components/LoadingScreen';

export default function PaymentVouchersPage() {
  const { showConfirm } = useConfirm();

    
  const logic = usePaymentVouchersLogic();

  // 🚀 اختصار الحفظ (Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (logic.state.isEditModalOpen && e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!logic.isLoading) document.getElementById('payment-save-button')?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [logic.state.isEditModalOpen, logic.isLoading]);

  // 🚀 اختصار إضافة جديد (Alt + N)
  useEffect(() => {
    const handleAddShortcut = (e: KeyboardEvent) => {
      if (!logic.state.isEditModalOpen && e.altKey && (e.code === 'KeyN' || e.key.toLowerCase() === 'n' || e.key === 'ى')) {
        e.preventDefault();
        logic.actions.handleAddNew();
      }
    };
    window.addEventListener('keydown', handleAddShortcut);
    return () => window.removeEventListener('keydown', handleAddShortcut);
  }, [logic.state.isEditModalOpen, logic.actions.handleAddNew]);

  const [mounted, setMounted] = useState(false); 
  const { can, loading: permsLoading } = usePermissions();

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState(null);

  useEffect(() => setMounted(true), []);

  // 🚀 التعديل هنا: استخراج *جميع* العناصر المفلترة (وليس الصفحة الحالية فقط) لتحديد الكل
  const allFilteredIds = useMemo(() => {
    return logic.data.map((v: any) => String(v.id));
  }, [logic.data]);

  // التحقق مما إذا كانت كل العناصر المفلترة محددة
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id: string) => logic.state.selectedIds.includes(id));

  // 🚀 مصفوفة الأعمدة للجدول
  const voucherColumns = useMemo(() => [
    {
      header: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input 
                  type="checkbox" 
                  className="custom-checkbox"
                  checked={isAllSelected}
                  title="تحديد كل السجلات المفلترة"
                  onChange={() => {
                      if (isAllSelected) {
                          // إلغاء تحديد جميع السجلات المفلترة
                          logic.actions.setSelectedIds(logic.state.selectedIds.filter((id: string) => !allFilteredIds.includes(id)));
                      } else {
                          // تحديد جميع السجلات المفلترة
                          logic.actions.setSelectedIds([...new Set([...logic.state.selectedIds, ...allFilteredIds])]);
                      }
                  }}
              />
          </div>
      ), 
      accessor: 'id',
      render: (row: any) => {
        if (!row) return null;
        const isSelected = logic.state.selectedIds.includes(String(row.id));
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center' }}>
              <input 
                  type="checkbox" 
                  className="custom-checkbox" 
                  checked={isSelected} 
                  onChange={(e) => {
                      e.stopPropagation();
                      if (isSelected) logic.actions.setSelectedIds(logic.state.selectedIds.filter((i:any) => i !== String(row.id))); 
                      else logic.actions.setSelectedIds([...logic.state.selectedIds, String(row.id)]); 
                  }} 
              />
          </div>
        );
      }
    },
    { header: 'رقم السند', accessor: 'voucher_number', render: (row: any) => row ? <b style={{ color: THEME.primary, fontSize: '14px' }}>#{row.voucher_number}</b> : null },
    { header: 'التاريخ', accessor: 'date', render: (row: any) => row ? <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 700 }}>{row.date}</span> : null },
    { 
      header: 'المستفيد', 
      accessor: 'payee_name', 
      render: (row: any) => row ? <b style={{ fontWeight: 900, color: '#1e293b' }}>👤 {row.payee?.name || row.payee_name || '---'}</b> : null 
    },
    { 
      header: 'الحساب الدائن (الخزينة)', 
      accessor: 'credit_account_id', 
      render: (row: any) => row ? (
        <span style={{ fontSize:'11px', background: '#f8fafc', padding: '4px 10px', borderRadius: '8px', color: '#475569', fontWeight: 900 }}>
          🏦 {row.credit_account?.name || '---'} 
        </span>
      ) : null 
    },
    { 
      header: 'الحساب المدين', 
      accessor: 'debit_account_id', 
      render: (row: any) => row ? (
        <span style={{ fontSize:'11px', background: '#f8fafc', padding: '4px 10px', borderRadius: '8px', color: '#475569', fontWeight: 900 }}>
          🧾 {row.debit_account?.name || '---'}
        </span>
      ) : null 
    },
    { 
      header: 'البيان', 
      accessor: 'description', 
      render: (row: any) => row ? (
        <div>
          <span style={{ fontSize:'12px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{row.description}</span>
          {(row.job_order?.order_number || row.job_order_number) && (
            <div style={{ fontSize: '10px', color: THEME.goldAccent, fontWeight: 800 }}>
              🛠️ #{row.job_order?.order_number || row.job_order_number}
            </div>
          )}
        </div>
      ) : null 
    },
    { header: 'المبلغ', accessor: 'amount', render: (row: any) => row ? <span style={{ color: THEME.danger, fontWeight: 900, fontSize: '15px' }}>{formatCurrency(row.amount)}</span> : null },
    {
      header: 'الحالة',
      accessor: 'is_posted',
      render: (row: any) => {
        if (!row) return null;
        return row.is_posted ? 
          <span style={{ display: 'inline-block', background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 900 }}>معتمد ✅</span> : 
          <span style={{ display: 'inline-block', background: '#fff7ed', color: '#d97706', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 900 }}>معلق ⏳</span>;
      }
    },
    {
      header: 'الإجراءات',
      accessor: 'actions',
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); setPrintData(row); setIsPrintModalOpen(true); }} 
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', fontSize: '14px' }}
              title="طباعة السند"
            >
              🖨️
            </button>
          </div>
        );
      }
    }
  ], [logic.state.selectedIds, isAllSelected, allFilteredIds, logic.actions]); 

  // 🚀 القائمة الجانبية للأزرار الإجرائية
  const sidebarActions = useMemo(() => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <SecureAction module="payments" action="create">
          <button className="btn-main-glass gold" onClick={logic.actions.handleAddNew}>➕ إصدار سند صرف</button>
        </SecureAction>

        {logic.state.selectedIds.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '5px', paddingTop: '15px', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>            
            <div style={{ textAlign: 'center', marginBottom: '5px' }}>
              <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 900, margin: 0 }}>
                تم تحديد ({logic.state.selectedIds.length}) سجل
              </p>
              <button 
                onClick={() => logic.actions.setSelectedIds([])}
                style={{ background: 'none', border: 'none', color: THEME.primary, fontSize: '10px', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline' }}
              >
                إلغاء التحديد
              </button>
            </div>
            
            {/* 🚀 الزرار الجديد بتاع التصحيح المجمع */}
            <SecureAction module="payments" action="edit">
              <button className="btn-main-glass blue" onClick={() => logic.actions.setIsBulkFixModalOpen(true)}>🛠️ تصحيح التوجيه مجمع</button>
            </SecureAction>

            {logic.state.selectedIds.length === 1 && (
              <SecureAction module="payments" action="edit">
                <button className="btn-main-glass white" onClick={logic.actions.handleEditSelected}>✏️ تعديل السجل</button>
              </SecureAction>
            )}
            <SecureAction module="payments" action="post">
              <button className="btn-main-glass green" onClick={logic.actions.handlePostSelected}>🚀 اعتماد وترحيل</button>
            </SecureAction>
            <SecureAction module="payments" action="post">
              <button className="btn-main-glass yellow" onClick={logic.actions.handleUnpostSelected}>↩️ فك الترحيل</button>
            </SecureAction>
            <SecureAction module="payments" action="delete">
              <button className="btn-main-glass red" onClick={() => {
                  showConfirm({
                      title: 'حذف السجلات نهائياً',
                      message: `هل أنت متأكد من حذف عدد (${logic.state.selectedIds.length}) سند صرف بشكل نهائي؟ هذا الإجراء لا يمكن التراجع عنه.`,
                      type: 'danger',
                      onConfirm: () => {
                          logic.actions.handleDeleteSelected();
                      }
                  });
              }}>
                🗑️ حذف نهائي
              </button>
            </SecureAction>
          </div>
        )}
      </div>
    );
  }, [logic.state.selectedIds, logic.actions]);

  return (
    <>
      <div className="clean-page">
        <MasterPage icon="📤" title="سندات الصرف" subtitle="إدارة المدفوعات والتحويلات المالية والتوجيه المحاسبي الدقيق">
            <RawasiSidebarManager 
              summary={
                <div className="summary-glass-card">
                  <span style={{fontSize:'12px', fontWeight:800, color:'#64748b'}}>
                    {logic.state.filterStatus === 'معتمد' ? 'إجمالي السندات المعتمدة 📉' : 
                     logic.state.filterStatus === 'معلق' ? 'إجمالي السندات المعلقة ⏳' : 
                     'إجمالي المدفوعات 🏦'}
                  </span>
                  
                  <div className="val" style={{fontSize:'24px', fontWeight:900, color: THEME.danger, marginTop:'5px'}}>
                    {/* 🚀 رجعنا نعتمد على جمع الشاشة الدقيق لأنه تفاعلي مع البحث والتاريخ */}
                    {formatCurrency(logic.totals.totalAmount)}
                  </div>
                </div>
              }
              actions={sidebarActions}
              customFilters={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                  <div>
                    <label style={{ color: 'white', fontSize: '11px', fontWeight: 900, display: 'block', marginBottom: '8px' }}>تصفية حسب الحالة:</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {['الكل', 'معتمد', 'معلق'].map(type => (
                        <button 
                          key={type} 
                          onClick={() => logic.actions.setFilterStatus(type)} 
                          className={`filter-btn ${logic.state.filterStatus === type ? 'active' : ''}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              }
              watchDeps={[logic.state.selectedIds, logic.totals.totalAmount, logic.state.rowsPerPage, logic.data.length, logic.state.filterStatus]}
            />

            <style>{`
              .custom-checkbox { width: 20px; height: 20px; accent-color: ${THEME.goldAccent}; cursor: pointer; transition: 0.1s; }
              .btn-main-glass { width: 100%; padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; }
              .btn-main-glass.gold { background: linear-gradient(135deg, rgba(194,65,12, 0.9), rgba(194,65,12, 1)); color: white; }
              .btn-main-glass.blue { background: linear-gradient(135deg, rgba(14, 165, 233, 0.8), rgba(2, 132, 199, 0.9)); color: white; }
              .btn-main-glass.green { background: linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.9)); color: white; }
              .btn-main-glass.yellow { background: linear-gradient(135deg, rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 0.9)); color: white; }
              .btn-main-glass.white { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255,255,255,0.8); }
              .btn-main-glass.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
              .btn-main-glass:hover { transform: translateY(-3px); filter: brightness(1.1); }
              .summary-glass-card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 20px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 25px; }
              .filter-btn { flex: 1; padding: 8px; border-radius: 8px; background: rgba(255,255,255,0.1); color: white; border: none; font-weight: 900; cursor: pointer; font-size: 11px; transition: 0.3s; }
              .filter-btn.active { background: ${THEME.goldAccent}; color: #1e293b; }
            `}</style>

            {(logic.isLoading || permsLoading) ? (
              <LoadingScreen message="جاري المزامنة..." fullScreen={false} />
            ) : (
              <RawasiSmartTable 
                data={logic.data}
                columns={voucherColumns} 
                onRowClick={(row) => { setPrintData(row); setIsPrintModalOpen(true); }}
                enablePagination={true}
                currentPage={logic.state.currentPage}
                totalItems={logic.data.length}
                rowsPerPage={logic.state.rowsPerPage}
                onPageChange={logic.actions.setCurrentPage}
                onRowsChange={logic.actions.setRowsPerPage}
              />
            )}
        </MasterPage>
      </div>

      {/* 🚀 المودال الجديد للتصحيح المجمع */}
      {mounted && logic.state.isBulkFixModalOpen && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 999999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)', padding: '50px 20px', overflowY: 'auto' }}>
              <div style={{ position: 'fixed', inset: 0 }} onClick={() => logic.actions.setIsBulkFixModalOpen(false)} />
              <div className="cinematic-scroll" style={{ background: 'white', borderRadius: '32px', width: '100%', maxWidth: '600px', padding: '40px', position: 'relative', zIndex: 10, margin: 'auto', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)' }}>
                  <h2 style={{ fontWeight: 900, textAlign: 'center', marginBottom: '30px', color: THEME.primary, fontSize: '24px' }}>🛠️ تصحيح الحسابات لـ ({logic.state.selectedIds.length}) سند معلق</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', zIndex: 50, position: 'relative' }}>
                      <div style={{ zIndex: 60, position: 'relative' }}>
                          <SmartCombo 
                              label="🧾 الحساب المدين الجديد (من حـ)" 
                              table="accounts" 
                              displayCol="name" 
                              initialDisplay={logic.state.bulkFixAccounts.debit_account_name} 
                              onSelect={(val:any) => {
                                  logic.actions.setBulkFixAccounts({
                                      ...logic.state.bulkFixAccounts, 
                                      debit_account_name: val?.name || '',
                                      debit_account_id: val?.id || null 
                                  });
                              }} 
                              strict={true} 
                          />
                      </div>
                      <div style={{ zIndex: 50, position: 'relative' }}>
                          <SmartCombo 
                              label="🏦 الحساب الدائن الجديد (إلى حـ)" 
                              table="accounts" 
                              displayCol="name" 
                              initialDisplay={logic.state.bulkFixAccounts.credit_account_name} 
                              onSelect={(val:any) => {
                                  logic.actions.setBulkFixAccounts({
                                      ...logic.state.bulkFixAccounts, 
                                      credit_account_name: val?.name || '',
                                      credit_account_id: val?.id || null 
                                  });
                              }} 
                              strict={true} 
                          />
                      </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', marginTop: '40px' }}>
                      <button onClick={logic.actions.handleBulkFixSave} disabled={logic.isLoading} style={{ flex: 2, padding: '18px', borderRadius: '16px', background: THEME.info, color: 'white', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                          {logic.isLoading ? '⏳ جاري الحفظ...' : '✅ تطبيق التعديلات'}
                      </button>
                      <button onClick={()=>logic.actions.setIsBulkFixModalOpen(false)} style={{ flex: 1, padding: '18px', borderRadius: '16px', border: '2px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 900, cursor: 'pointer', fontSize: '16px' }}>إلغاء</button>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* 🚀 مودال التعديل والإضافة المربوط باللوجيك الجديد */}
      {mounted && logic.state.isEditModalOpen && (
          <PaymentVoucherModal 
              isOpen={logic.state.isEditModalOpen} 
              onClose={() => logic.actions.setIsEditModalOpen(false)} 
              record={logic.state.currentVoucher} 
              setRecord={logic.actions.setCurrentVoucher}
              onSave={logic.actions.handleSaveVoucher}
              isSaving={logic.isLoading}
              partnerBalance={logic.state.partnerBalance}
              isBalanceLoading={logic.state.isBalanceLoading}
          />
      )}

      {mounted && isPrintModalOpen && (
          <PaymentPrintModal 
            isOpen={isPrintModalOpen} 
            onClose={() => setIsPrintModalOpen(false)} 
            record={printData} 
          />
      )}
    </>
  );
}
