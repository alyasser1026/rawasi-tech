"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import { useInvoicesLogic } from './invoices_logic';
import { THEME } from '@/lib/theme';
import { formatCurrency, getInvoiceSummaryAndAging } from '@/lib/helpers'; 
import { usePermissions } from '@/lib/PermissionsContext'; 
import SecureAction from '@/components/SecureAction';      
import MasterPage from '@/components/MasterPage';

// 🧱 المكونات
import RawasiSmartTable from '@/components/rawasismarttable';
import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import InvoiceAgingDashboard from '@/components/InvoiceAgingDashboard';
import SmartCombo from '@/components/SmartCombo'; 

// 🎬 المودالز
import InvoiceFormModal from './InvoiceFormModal';
import InvoicePrintModal from './InvoicePrintModal';
import ReceiptVoucherModal from '@/app/ReceiptVouchers/ReceiptVoucherModal';
import LoadingScreen from '@/components/LoadingScreen';
import { Printer, Banknote } from 'lucide-react';

export default function InvoicesPage() {
  const logic = useInvoicesLogic(); 
  const { can, loading: permsLoading } = usePermissions();

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 💎 حساب إحصائيات أعمار الديون
  const result = useMemo(() => {
      return getInvoiceSummaryAndAging(logic.allFiltered.filter((i:any)=> i?.status !== 'مسودة'));
  }, [logic.allFiltered]);

  // 🚀 استخراج العناصر الحالية لتحديد الكل بأمان
  const currentVisibleIds = useMemo(() => {
    return logic.allFiltered
      .slice((logic.currentPage - 1) * logic.rowsPerPage, logic.currentPage * logic.rowsPerPage)
      .map((v: any) => String(v.id));
  }, [logic.allFiltered, logic.currentPage, logic.rowsPerPage]);

  const isAllVisibleSelected = currentVisibleIds.length > 0 && currentVisibleIds.every((id: string) => logic.selectedIds.includes(id));

  // =========================================================================
  // 💎 أعمدة الجدول
  // =========================================================================
  const invoiceColumns = useMemo(() => [
    {
      key: 'select',
      label: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input 
                  type="checkbox" 
                  className="custom-checkbox"
                  checked={isAllVisibleSelected}
                  title="تحديد كل الصفحة"
                  onChange={() => {
                      if (isAllVisibleSelected) {
                          logic.setSelectedIds(logic.selectedIds.filter((id: string) => !currentVisibleIds.includes(id)));
                      } else {
                          logic.setSelectedIds([...new Set([...logic.selectedIds, ...currentVisibleIds])]);
                      }
                  }}
              />
          </div>
      ), 
      render: (row: any) => {
        if (!row) return null;
        const isSelected = logic.selectedIds.includes(String(row.id));
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center' }}>
              <input 
                  type="checkbox" 
                  className="custom-checkbox" 
                  checked={isSelected} 
                  onChange={(e) => {
                      e.stopPropagation();
                      if (isSelected) logic.setSelectedIds(logic.selectedIds.filter((i:any) => i !== String(row.id))); 
                      else logic.setSelectedIds([...logic.selectedIds, String(row.id)]); 
                  }} 
              />
          </div>
        );
      }
    },
    { 
      key: 'invoice_number',
      label: 'الفاتورة', 
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <b style={{ color: '#8b5cf6', textShadow: '0 0 10px rgba(139, 92, 246, 0.3)', fontSize: 'var(--fs-md)' }}>#{row.invoice_number}</b>
            <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b' }}>
               {row.skip_zatca ? 'فاتورة داخلية' : 'ضريبية (ZATCA)'}
            </span>
          </div>
        );
      } 
    },
    { 
      key: 'date',
      label: 'التاريخ', 
      render: (row: any) => {
        if (!row) return null;
        return (
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#0284c7', background: 'rgba(2, 132, 199, 0.1)', padding: '0.25rem 0.625rem', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
            {row.date ? new Date(row.date).toLocaleDateString('ar-EG') : '---'}
          </span> 
        );
      }
    },
    { 
      key: 'client_name',
      label: 'العميل / البيان', 
      render: (row: any) => {
        if (!row) return null; 
        const finalClientName = row.partners?.name || row.client_name || '---';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'right' }}>
             <span style={{fontWeight: 900, color: '#1e293b'}}>{finalClientName}</span>
             {row.description && (
               <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '11.25rem' }} title={row.description}>
                  {row.description}
               </span>
             )}
          </div>
        );
      } 
    },
    {
      key: 'financial_details',
      label: 'تفاصيل المبالغ (قبل الصافي)',
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: 'var(--fs-xs)', fontWeight: 700, textAlign: 'right' }}>
             <span style={{ color: '#334155' }}>الخاضع: {formatCurrency(row.taxable_amount)}</span>
             {Number(row.materials_discount) > 0 && <span style={{ color: '#ef4444' }}>خصم مواد: -{formatCurrency(row.materials_discount)}</span>}
             {Number(row.tax_amount) > 0 && <span style={{ color: '#0ea5e9' }}>ضريبة (15%): +{formatCurrency(row.tax_amount)}</span>}
             {Number(row.guarantee_amount) > 0 && <span style={{ color: '#f59e0b' }}>ضمان ({row.guarantee_percent}%): -{formatCurrency(row.guarantee_amount)}</span>}
          </div>
        );
      }
    },
    { 
      key: 'total_amount',
      label: 'الإجمالي الصافي', 
      render: (row: any) => {
        if (!row) return null; 
        return <span style={{ fontWeight: 900, color: THEME.brand?.gold || '#d97706', fontSize: 'var(--fs-lg)' }}>{formatCurrency(row.total_amount)}</span>;
      } 
    },
    {
      key: 'paid_amount',
      label: 'السداد',
      render: (row: any) => {
        if (!row) return null; 
        const total = Number(row.total_amount || 0);
        const paid = Number(row.paid_amount || 0);
        const remaining = total - paid;
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
             {paid > 0 && <span style={{ color: '#10b981' }}>مسدد: {formatCurrency(paid)}</span>}
             
             {/* 🚀 إظهار المتبقي لو كان لسه عليه فلوس، أو دائن لو دفع بزيادة */}
             {remaining > 0 && <span style={{ color: '#ef4444' }}>متبقي: {formatCurrency(remaining)}</span>}
             {remaining < 0 && <span style={{ color: '#8b5cf6', background: '#f5f3ff', padding: '2px 0.25rem', borderRadius: '4px' }}>دائن (بزيادة): {formatCurrency(Math.abs(remaining))}</span>}
             
             {paid === 0 && remaining === 0 && <span style={{ color: '#94a3b8' }}>0.00</span>}
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'الاعتماد',
      render: (row: any) => {
        if (!row) return null; 
        const isApproved = row.status === 'معتمد' || row.status === 'معتمد';
        return (
          <div className={`approval-glass-badge ${isApproved ? 'approved' : 'pending'}`}>
            <span className="dot"></span>
            {isApproved ? row.status : 'معلق'}
          </div>
        );
      }
    },
    {
      key: 'due_date',
      label: 'حالة الدفع',
      render: (row: any) => {
        if (!row) return null; 
        const total = Number(row.total_amount || 0);
        const paid = Number(row.paid_amount || 0);
        
        // 🚀 حالات الدفع (مكتمل أو بزيادة)
        if (paid > total && total > 0) return <span className="deadline-badge paid" style={{background: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe'}}>سداد بزيادة</span>;
        if (paid === total && total > 0) return <span className="deadline-badge paid">مكتمل</span>;
        
        if (!row.due_date) return <span style={{color:'#94a3b8', fontWeight: 'bold'}}>---</span>;
        
        const today = new Date();
        const due = new Date(row.due_date);
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return <div className="deadline-badge overdue">متأخر ({Math.abs(diffDays)} يوم)</div>;
        if (diffDays === 0) return <div className="deadline-badge today">السداد اليوم</div>;
        return <div className="deadline-badge active">متبقي {diffDays} يوم</div>;
      }
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (row: any) => {
        if (!row) return null; 
        const total = Number(row.total_amount || 0);
        const paid = Number(row.paid_amount || 0);
        const balance = total - paid;
        
        // 🚀 الشرط اللي بيخفي الزرار لو الفاتورة مسددة أو بزيادة
        const needsPayment = balance > 0; 
        const isApproved = row.status === 'معتمد' || row.status === 'معتمد' || row.is_posted === true;
        
        return (
          <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', alignItems: 'center' }}>
            <button onClick={(e) => { e.stopPropagation(); setPrintData(row); setIsPrintModalOpen(true); }} className="btn-glass-print" title="طباعة الفاتورة" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-xl)', transition: '0.2s' }}><Printer size={15} aria-hidden="true" /></button>
            
            {/* 🚀 السحر هنا: دمجنا needsPayment في الشرط عشان يخفي الزرار */}
            {needsPayment && isApproved && logic.handleOpenPaymentModal && (
              <button onClick={(e) => {
                  e.stopPropagation(); 
                  logic.handleOpenPaymentModal(row); 
                }} className="btn-glass-pay" title="تسجيل سند قبض / دفعة إضافية" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-xl)', transition: '0.2s' }}><Banknote size={15} aria-hidden="true" /></button>
            )}
          </div>
        );
      }
    }
  ], [logic.selectedIds, isAllVisibleSelected, currentVisibleIds, logic]);

  // =========================================================================
  // 🎛️ أزرار السايد بار
  // =========================================================================
  const sidebarActions = useMemo(() => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
      <SecureAction module="invoices" action="create">
        <button className="btn-main-glass gold" onClick={logic.handleAddNew}>
          إنشاء فاتورة جديدة
        </button>
      </SecureAction>

      {logic.selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.3125rem', paddingTop: '0.9375rem', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <p style={{fontSize:'var(--fs-xs)', textAlign:'center', color:'#94a3b8', fontWeight:900, marginBottom:'-0.3125rem'}}>الإجراءات على ({logic.selectedIds.length})</p>
          <SecureAction module="invoices" action="post">
            <button className="btn-main-glass blue" onClick={logic.handlePostSelected} disabled={logic.isSaving}>
              {logic.isSaving ? 'جاري الترحيل...' : 'اعتماد وترحيل'}
            </button>
          </SecureAction>
          <SecureAction module="invoices" action="post">
            <button className="btn-main-glass yellow" onClick={logic.handleUnpostSelected} disabled={logic.isSaving}>
              تعليق الفاتورة
            </button>
          </SecureAction>
          {logic.selectedIds.length === 1 && (
            <SecureAction module="invoices" action="edit">
              <button className="btn-main-glass white" onClick={() => logic.handleEdit(logic.allFiltered.find((i:any) => String(i.id) === logic.selectedIds[0]))}>
                تعديل البيانات
              </button>
            </SecureAction>
          )}
          <SecureAction module="invoices" action="delete">
            <button className="btn-main-glass red" onClick={logic.handleDeleteSelected} disabled={logic.isSaving}>
              حذف نهائي
            </button>
          </SecureAction>
        </div>
      )}
    </div>
  ), [logic.selectedIds, logic]);

  return (
    <MasterPage 
      title="فواتير المبيعات" 
      subtitle="مركز إدارة المستخلصات والتحصيل المالي"
    >
      
      <RawasiSidebarManager 
        summary={
          <div className="summary-glass-card">
            <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي المديونية</span>
            <div className="val" style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: THEME.goldAccent, marginTop:'0.3125rem'}}>{formatCurrency(result.totalRemaining)}</div>
          </div>
        }
        actions={sidebarActions}
        customFilters={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <SmartCombo 
                    label="تصفية سريعة بالعميل"
                    icon="🔍"
                    table="partners"
                    displayCol="name"
                    placeholder="ابحث عن عميل محدد..."
                    enableClear={true}
                    onSelect={(item:any) => logic.setGlobalSearch(item?.name || '')}
                />
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.625rem 0' }} />
              <InvoiceAgingDashboard aging={{ ...result.aging, totalOverdue: result.totalOverdue, totalOpen: result.aging.current + result.totalOverdue }} />
            </div>
        }
        onSearch={logic.setGlobalSearch}
        onDateFilter={(start, end) => { if(logic.setDateFrom) logic.setDateFrom(start); if(logic.setDateTo) logic.setDateTo(end); }}
        watchDeps={[logic.selectedIds, logic.allFiltered.length, result.totalRemaining]}
      />

      <style>{`
        .custom-checkbox { width: 1.25rem; height: 1.25rem; accent-color: ${THEME.goldAccent}; cursor: pointer; transition: 0.1s; }
        .btn-main-glass { width: 100%; padding: 0.875rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .btn-main-glass.gold { background: linear-gradient(135deg, rgba(194,65,12, 0.9), rgba(194,65,12, 1)); color: white; }
        .btn-main-glass.blue { background: linear-gradient(135deg, rgba(14, 165, 233, 0.8), rgba(2, 132, 199, 0.9)); color: white; }
        .btn-main-glass.green { background: linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.9)); color: white; }
        .btn-main-glass.yellow { background: linear-gradient(135deg, rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 0.9)); color: white; }
        .btn-main-glass.white { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255,255,255,0.8); }
        .btn-main-glass.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .btn-main-glass:hover { transform: translateY(-3px); filter: brightness(1.1); }
      `}</style>

      {( (logic.isLoading || permsLoading) && logic.allFiltered.length === 0 ) ? (
        <LoadingScreen message="جاري المزامنة..." fullScreen={false} />
      ) : (
        <div className="clickable-rows cinematic-scroll" style={{ background: 'white', borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <RawasiSmartTable 
              data={logic.allFiltered} 
              columns={invoiceColumns} 
              enablePagination={true}
              currentPage={logic.currentPage}
              totalItems={logic.allFiltered.length}
              rowsPerPage={logic.rowsPerPage}
              onPageChange={logic.setCurrentPage}
              onRowsChange={logic.setRowsPerPage}
              onRowClick={(row:any) => { setPrintData(row); setIsPrintModalOpen(true); }}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* 🚀 المودالز */}
      {/* ==================================================================== */}
      
      {mounted && logic.isReceiptModalOpen && createPortal(
        <div style={{ 
            position: 'fixed', inset: 0, zIndex: 999999999, 
            background: 'rgba(40, 24, 10, 0.85)', 
            backdropFilter: 'blur(10px)',
            display: 'flex', 
            alignItems: 'flex-start',
            justifyContent: 'center', 
            overflowY: 'auto', 
            padding: '3.125rem 1.25rem' 
        }}>
            <div style={{ width: '100%', maxWidth: '56.25rem', position: 'relative' }}>
                <ReceiptVoucherModal 
                    isOpen={logic.isReceiptModalOpen} 
                    onClose={() => logic.setIsReceiptModalOpen(false)} 
                    record={logic.selectedInvoiceForPay || {}} 
                    setRecord={logic.setSelectedInvoiceForPay}
                    onSave={logic.handleSavePayment} 
                />
            </div>
        </div>,
        document.body
      )}

      {mounted && logic.isEditModalOpen && (
          <InvoiceFormModal 
            isOpen={logic.isEditModalOpen} 
            onClose={() => logic.setIsEditModalOpen(false)} 
            record={logic.currentRecord} 
            setRecord={logic.setCurrentRecord} 
            onSave={logic.handleSave} 
            projects={logic.projects} 
          />
      )}
      
      {mounted && isPrintModalOpen && (
          <InvoicePrintModal 
            isOpen={true} 
            onClose={() => setIsPrintModalOpen(false)} 
            record={printData} 
            projects={logic.projects} 
          />
      )}
      
    </MasterPage>
  );
}
