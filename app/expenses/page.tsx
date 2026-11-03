"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; 
import { useQueryClient } from '@tanstack/react-query'; 
import { useExpensesLogic } from './expenses_logic';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo'; 
import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import { usePermissions } from '@/lib/PermissionsContext'; 
import SecureAction from '@/components/SecureAction';      
import { formatCurrency } from '@/lib/helpers';
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import { usePaymentVouchersLogic } from '../PaymentVouchers/payment_vouchers_logic'; 
import PaymentVoucherModal from '../PaymentVouchers/PaymentVoucherModal'; 
import { supabase } from '@/lib/supabase';

// 🎬 المودالز
import ExpenseFormModal from './ExpenseFormModal'; 
import ExpensePrintModal from './ExpensePrintModal'; 
import LoadingScreen from '@/components/LoadingScreen';

const MAIN_CATEGORIES = [
  "إعاشة وتغذية", "محروقات وانتقالات", "عدد ومعدات", "مستهلكات ومواد تشغيل", 
  "صيانة وإصلاحات", "مصاريف إدارية", "عمولات وبقشيش", "سكن وأثاث", 
  "أدوات نظافة", "مواد إنشائية"
];

export default function ExpensesPage() {
  const queryClient = useQueryClient(); 
  const logic = useExpensesLogic();

  // 🚀 اختصار الحفظ (Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (logic.isEditModalOpen && e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!logic.isSaving) document.getElementById('expense-save-button')?.click();
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

  const pvLogic = usePaymentVouchersLogic();
  
  const [mounted, setMounted] = useState(false); 
  
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // 🚀 حالة الترتيب (للأعمدة)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const { can, loading: permsLoading } = usePermissions();

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState(null);

  useEffect(() => {
      setMounted(true);
  }, []);

  const displayedExpenses = useMemo(() => {
    if (!categoryFilter) return logic.filteredExpenses;
    return logic.filteredExpenses.filter((item: any) => item.main_category === categoryFilter);
  }, [logic.filteredExpenses, categoryFilter]);

  const displayedTotal = useMemo(() => {
    return displayedExpenses.reduce((sum: number, row: any) => {
      const total = row.total_price || ((Number(row.quantity || 1) * Number(row.unit_price || 0)) + Number(row.vat_amount || 0) - Number(row.discount_amount || 0));
      return sum + total;
    }, 0);
  }, [displayedExpenses]);

  // 🚀 اللوجيك الذكي لترتيب البيانات حسب العمود المختار
  const sortedExpenses = useMemo(() => {
      if (!sortConfig) return displayedExpenses;

      return [...displayedExpenses].sort((a, b) => {
          let aValue = a[sortConfig.key];
          let bValue = b[sortConfig.key];

          // 🚀 معالجة المبالغ والأرقام والإجمالي المحسوب
          if (sortConfig.key === 'total' || sortConfig.key === 'vat_amount' || sortConfig.key === 'discount_amount' || sortConfig.key === 'paid_amount') {
              if (sortConfig.key === 'total') {
                  aValue = a.total_price || ((Number(a.quantity || 1) * Number(a.unit_price || 0)) + Number(a.vat_amount || 0) - Number(a.discount_amount || 0));
                  bValue = b.total_price || ((Number(b.quantity || 1) * Number(b.unit_price || 0)) + Number(b.vat_amount || 0) - Number(b.discount_amount || 0));
              }
              aValue = Number(aValue || 0);
              bValue = Number(bValue || 0);
          } 
          // 🚀 معالجة التواريخ
          else if (sortConfig.key === 'exp_date') {
              aValue = new Date(aValue || 0).getTime();
              bValue = new Date(bValue || 0).getTime();
          } 
          // 🚀 معالجة المقاول/المستفيد (عشان بيعتمد على حقلين)
          else if (sortConfig.key === 'sub_contractor') {
              aValue = (a.sub_contractor || a.payee_name || '').toLowerCase();
              bValue = (b.sub_contractor || b.payee_name || '').toLowerCase();
          }
          // 🚀 معالجة النصوص
          else {
              aValue = aValue !== null && aValue !== undefined ? String(aValue).toLowerCase() : '';
              bValue = bValue !== null && bValue !== undefined ? String(bValue).toLowerCase() : '';
          }

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [displayedExpenses, sortConfig]);

  // 🚀 خدعة ذكية: دالة لإنشاء عنوان عمود قابل للضغط والترتيب
  const renderSortableHeader = (label: string, key: string) => (
      <div 
          onClick={() => {
              let direction: 'asc' | 'desc' = 'asc';
              if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
                  direction = 'desc';
              }
              setSortConfig({ key, direction });
          }}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', userSelect: 'none' }}
          title={`ترتيب حسب ${label}`}
      >
          <span>{label}</span>
          <span style={{ fontSize: '10px', opacity: sortConfig?.key === key ? 1 : 0.3 }}>
              {sortConfig?.key === key ? (sortConfig.direction === 'asc' ? '🔼' : '🔽') : '↕️'}
          </span>
      </div>
  );

  // =========================================================================
  // 💎 أعمدة الجدول
  // =========================================================================
  const expenseColumns = [
    {
      header: (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <input 
            type="checkbox" 
            className="custom-checkbox"
            checked={logic.selectedIds.length > 0 && logic.selectedIds.length === displayedExpenses.length}
            ref={(input) => {
              if (input) input.indeterminate = logic.selectedIds.length > 0 && logic.selectedIds.length < displayedExpenses.length;
            }}
            onChange={(e) => {
              e.stopPropagation();
              if (e.target.checked) logic.setSelectedIds(displayedExpenses.map((row: any) => row.id));
              else logic.setSelectedIds([]);
            }} 
          />
        </div>
      ),
      accessor: 'id',
      excludeFromExport: true, 
      render: (row: any) => {
        if (!row) return null;
        const isSelected = logic.selectedIds.includes(row.id);
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center' }}>
              <input 
                  type="checkbox" 
                  className="custom-checkbox" 
                  checked={isSelected} 
                  onChange={(e) => {
                      e.stopPropagation();
                      if (isSelected) logic.setSelectedIds(logic.selectedIds.filter((i:any) => i !== row.id)); 
                      else logic.setSelectedIds([...logic.selectedIds, row.id]); 
                  }} 
              />
          </div>
        );
      }
    },
    { 
      header: renderSortableHeader('التاريخ', 'exp_date'), 
      accessor: 'exp_date', 
      render: (row: any) => row ? <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 700 }}>{row.exp_date}</span> : null,
      exportValue: (row: any) => row.exp_date || '---' 
    },
    { 
      header: renderSortableHeader('المقاول/المستفيد', 'sub_contractor'), 
      accessor: 'sub_contractor', 
      render: (row: any) => row ? <b style={{ fontWeight: 900, color: '#1e293b' }}>{row.sub_contractor || row.payee_name || '---'}</b> : null,
      exportValue: (row: any) => row.sub_contractor || row.payee_name || '---'
    },
    { 
      header: renderSortableHeader('التصنيف', 'main_category'), 
      accessor: 'main_category', 
      render: (row: any) => row ? (
        <span style={{ fontSize:'11px', background: '#e0f2fe', padding: '4px 10px', borderRadius: '8px', color: '#0369a1', fontWeight: 900, border: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>
          📁 {row.main_category || 'غير مصنف'}
        </span>
      ) : null,
      exportValue: (row: any) => row.main_category || 'غير مصنف'
    },
    { 
      header: renderSortableHeader('المشروع', 'site_ref'), 
      accessor: 'site_ref', 
      render: (row: any) => row ? (
        <span style={{ fontSize:'11px', background: row.is_auto_distributed ? '#f3e8ff' : '#f1f5f9', padding: '4px 10px', borderRadius: '8px', color: row.is_auto_distributed ? THEME.purple : THEME.brand.coffee, fontWeight: 900 }}>
          {row.is_auto_distributed ? '⚡ توزيع ذكي' : row.site_ref || 'عام'}
        </span>
      ) : null,
      exportValue: (row: any) => row.is_auto_distributed ? '⚡ توزيع ذكي' : (row.site_ref || 'عام')
    },
    { 
      header: renderSortableHeader('المدين', 'creditor_account'), 
      accessor: 'creditor_account', 
      render: (row: any) => row ? (
        <span style={{ fontSize:'11px', background: '#f8fafc', padding: '4px 10px', borderRadius: '8px', color: '#475569', fontWeight: 900 }}>
          🧾 {row.creditor_account || '---'}
        </span>
      ) : null,
      exportValue: (row: any) => row.creditor_account || '---'
    },
    { 
      header: renderSortableHeader('الدائن', 'payment_account'), 
      accessor: 'payment_account', 
      render: (row: any) => row ? (
        <span style={{ fontSize:'11px', background: '#f8fafc', padding: '4px 10px', borderRadius: '8px', color: '#475569', fontWeight: 900 }}>
          🏦 {row.payment_account || '---'}
        </span>
      ) : null,
      exportValue: (row: any) => row.payment_account || '---'
    },
    { 
      header: renderSortableHeader('البيان التفصيلي', 'description'), 
      accessor: 'description', 
      render: (row: any) => {
        if (!row) return null;
        let displayDesc = row.description;
        if ((!displayDesc || displayDesc.trim() === '') && row.lines_data && Array.isArray(row.lines_data) && row.lines_data.length > 0) {
            displayDesc = row.lines_data.map((l: any) => l.description).filter(Boolean).join(' + ');
        }
        return <span style={{ fontSize:'12px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }} title={displayDesc || '---'}>{displayDesc || '---'}</span>;
      },
      exportValue: (row: any) => {
        let displayDesc = row.description;
        if ((!displayDesc || displayDesc.trim() === '') && row.lines_data && Array.isArray(row.lines_data) && row.lines_data.length > 0) {
            displayDesc = row.lines_data.map((l: any) => l.description).filter(Boolean).join(' + ');
        }
        return displayDesc || '---';
      }
    },
    { 
      header: renderSortableHeader('الضريبة', 'vat_amount'), 
      accessor: 'vat_amount', 
      render: (row: any) => row ? <span style={{fontWeight: 700}}>{Number(row.vat_amount || 0).toLocaleString()}</span> : null,
      exportValue: (row: any) => Number(row.vat_amount || 0)
    },
    { 
      header: renderSortableHeader('الخصم', 'discount_amount'), 
      accessor: 'discount_amount', 
      render: (row: any) => row ? <span style={{ color: THEME.ruby, fontWeight: 700 }}>{Number(row.discount_amount || 0).toLocaleString()}</span> : null,
      exportValue: (row: any) => Number(row.discount_amount || 0)
    },
    { 
      header: renderSortableHeader('الإجمالي', 'total'), 
      accessor: 'total', 
      render: (row: any) => {
        if (!row) return null;
        const total = row.total_price || ((Number(row.quantity || 1) * Number(row.unit_price || 0)) + Number(row.vat_amount || 0) - Number(row.discount_amount || 0));
        return <span style={{ color: THEME.success, fontWeight: 900, fontSize: '14px' }}>{total.toLocaleString()}</span>;
      },
      exportValue: (row: any) => {
        if (row.total_price) return Number(row.total_price);
        if (row.lines_data && Array.isArray(row.lines_data) && row.lines_data.length > 0) {
            const linesTotal = row.lines_data.reduce((sum: number, line: any) => {
                const lineTotal = line.total_price || (Number(line.quantity || 1) * Number(line.unit_price || 0));
                return sum + lineTotal;
            }, 0);
            return linesTotal + Number(row.vat_amount || 0) - Number(row.discount_amount || 0);
        }
        return (Number(row.quantity || 1) * Number(row.unit_price || 0)) + Number(row.vat_amount || 0) - Number(row.discount_amount || 0);
      }
    },
    {
      header: renderSortableHeader('السداد', 'paid_amount'),
      accessor: 'payment_status',
      render: (row: any) => {
        if (!row) return null;
        const total = row.total_price || (Number(row.quantity || 1) * Number(row.unit_price || 0)) + Number(row.vat_amount || 0) - Number(row.discount_amount || 0);
        const paid = Number(row.paid_amount || 0);
        
        let statusText = ''; let bgColor = ''; let textColor = '';

        if (paid <= 0) {
            statusText = 'غير مسدد ❌'; bgColor = '#fef2f2'; textColor = '#ef4444';
        } else if (paid > 0 && paid < total) {
            statusText = 'مسدد جزئي ⏳'; bgColor = '#fffbeb'; textColor = '#f59e0b';
        } else if (paid >= total) {
            statusText = 'مسدد ✅'; bgColor = '#ecfdf5'; textColor = '#10b981';
        }

        return (
          <span style={{ display: 'inline-block', background: bgColor, color: textColor, padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 900, border: `1px solid ${textColor}30`, whiteSpace: 'nowrap' }}>
            {statusText}
          </span>
        );
      },
      exportValue: (row: any) => {
        const total = row.total_price || (Number(row.quantity || 1) * Number(row.unit_price || 0)) + Number(row.vat_amount || 0) - Number(row.discount_amount || 0);
        const paid = Number(row.paid_amount || 0);
        if (paid <= 0) return 'غير مسدد ❌';
        if (paid > 0 && paid < total) return 'مسدد جزئي ⏳';
        return 'مسدد ✅';
      }
    },
    {
      header: renderSortableHeader('الحالة', 'is_posted'),
      accessor: 'is_posted',
      render: (row: any) => {
        if (!row) return null;
        return row.is_posted ? 
          <span style={{ display: 'inline-block', background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 900 }}>معتمد ✅</span> : 
          <span style={{ display: 'inline-block', background: '#fff7ed', color: '#d97706', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 900 }}>معلق ⏳</span>;
      },
      exportValue: (row: any) => row.is_posted ? 'معتمد ✅' : 'معلق ⏳'
    },
    {
      header: 'الإجراءات',
      accessor: 'actions',
      excludeFromExport: true, 
      render: (row: any) => {
        if (!row) return null;
        const total = row.total_price || ((Number(row.quantity || 1) * Number(row.unit_price || 0)) + Number(row.vat_amount || 0) - Number(row.discount_amount || 0));
        const paid = Number(row.paid_amount || 0);
        const balance = total - paid;
        
        const needsPayment = balance > 0 && row.is_posted === true; 

        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); setPrintData(row); setIsPrintModalOpen(true); }} 
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', fontSize: '14px' }}
              title="طباعة المصروف"
            >
              🖨️
            </button>
            {needsPayment && (
             <button 
                  disabled={pvLogic.state.isEditModalOpen} 
                  onClick={(e) => {
                      e.stopPropagation(); 
                      const MAIN_TREASURY_ID = '21b8a1db-bc9f-4cf8-b741-1efeded0963c';
                      const MAIN_TREASURY_NAME = 'الخزينة الرئيسية';

                      let resolvedDebitId = null;
                      if (logic.accounts_raw && row.payment_account) {
                          const foundAcc = logic.accounts_raw.find((a: any) => 
                              `${a.code} - ${a.name}` === row.payment_account || a.name === row.payment_account
                          );
                          if (foundAcc) resolvedDebitId = foundAcc.id;
                      }

                      const preparedVoucher = {
                          date: new Date().toISOString().split('T')[0],
                          amount: balance, 
                          debit_account_id: resolvedDebitId, 
                          debit_account_name: row.payment_account, 
                          credit_account_id: MAIN_TREASURY_ID,
                          credit_account_name: MAIN_TREASURY_NAME,
                          partner_id: row.partner_id, 
                          
                          payee_name: row.sub_contractor || row.payee_name || row.creditor_account,
                          
                          site_ref: row.site_ref,
                          description: `سداد مصروف: ${row.description || ''} (فاتورة: ${row.invoice_number || 'غير محدد'})`,
                          payment_method: 'نقدي',
                          reference_no: row.invoice_number, 
                          related_expense_id: row.id 
                      };

                      pvLogic.actions.setCurrentVoucher(preparedVoucher);
                      pvLogic.actions.setIsEditModalOpen(true);
                  }} 
                  className="btn-pay-action"
                  style={{ 
                      background: 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)', 
                      color: 'white', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: '10px', 
                      cursor: pvLogic.state.isEditModalOpen ? 'not-allowed' : 'pointer', 
                      fontWeight: 900, 
                      fontSize: '12px', 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                      opacity: pvLogic.state.isEditModalOpen ? 0.7 : 1 
                  }}
                  onMouseEnter={(e) => { if(!pvLogic.state.isEditModalOpen) e.currentTarget.style.transform = 'translateY(-2px)'}}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  title="إصدار سند صرف فوري"
              >
                  <span style={{ fontSize: '14px' }}>💸</span>
                  صرف السند
              </button>
            )}
          </div>
        );
      }
    }
  ];

  const sidebarActions = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <SecureAction module="expenses" action="create">
        <button className="btn-main-glass gold" onClick={logic.handleAddNew}>➕ إضافة مصروف جديد</button>
      </SecureAction>

      {logic.selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '5px', paddingTop: '15px', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: '5px' }}>
              <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 900, margin: 0 }}>الإجراءات على ({logic.selectedIds.length})</p>
              <button onClick={() => logic.setSelectedIds([])} style={{ background: 'none', border: 'none', color: THEME.primary, fontSize: '10px', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline' }}>إلغاء التحديد</button>
          </div>
          
          <SecureAction module="expenses" action="edit">
              <button 
                  className="btn-main-glass green" 
                  onClick={logic.handleBulkDisburse}
                  disabled={logic.isDisbursing}
              >
                  {logic.isDisbursing ? '⏳ جاري المعالجة...' : `💰 صرف جماعي (${logic.selectedIds.length})`}
              </button>
          </SecureAction>

          <SecureAction module="expenses" action="edit">
            <button className="btn-main-glass blue" onClick={() => logic.setIsBulkFixModalOpen(true)}>🛠️ تصحيح مجمع</button>
          </SecureAction>
          {logic.selectedIds.length === 1 && (
            <SecureAction module="expenses" action="edit">
              <button className="btn-main-glass white" onClick={logic.handleEditSelected}>✏️ تعديل السجل</button>
            </SecureAction>
          )}
          <SecureAction module="expenses" action="post">
            <button className="btn-main-glass green" onClick={logic.handlePostSelected}>🚀 اعتماد وترحيل</button>
          </SecureAction>
          <SecureAction module="expenses" action="post">
            <button className="btn-main-glass yellow" onClick={logic.handleUnpostSelected}>↩️ فك الترحيل</button>
          </SecureAction>
          <SecureAction module="expenses" action="delete">
            <button className="btn-main-glass red" onClick={logic.handleDeleteSelected}>🗑️ حذف نهائي</button>
          </SecureAction>
        </div>
      )}

      <button className="btn-main-glass white" onClick={logic.exportToExcel}>📊 تصدير Excel</button>
    </div>
  );

  return (
    <div className="clean-page">
      <MasterPage icon="💸" title="سجل المصروفات الموحد" subtitle="إدارة التكاليف والمشتريات وتوزيع بنود العمل">
          <RawasiSidebarManager 
            summary={
              <div className="summary-glass-card">
                <span style={{fontSize:'12px', fontWeight:800, color:'#64748b'}}>إجمالي مصروفات الفترة 📉</span>
                <div className="val" style={{fontSize:'24px', fontWeight:900, color: THEME.primary, marginTop:'5px'}}>{formatCurrency(displayedTotal)}</div>
                <div style={{fontSize:'11px', color:'#10b981', fontWeight:800, marginTop:'5px'}}>إجمالي القيود: {displayedExpenses.length}</div>
              </div>
            }
            actions={sidebarActions}
            customFilters={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                <div>
                  <label style={{color: 'white', fontSize: '11px', fontWeight: 900, display: 'block', marginBottom: '8px'}}>تصفية بالتصنيف:</label>
                  <select 
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 800, outline: 'none', cursor: 'pointer', fontSize: '12px', appearance: 'auto' }} 
                      value={categoryFilter || "الكل"}
                      onChange={e => {
                        const val = e.target.value;
                        setCategoryFilter(val === 'الكل' ? null : val);
                      }}
                  >
                    <option value="الكل" style={{color:'#000'}}>📁 كل التصنيفات</option>
                    {MAIN_CATEGORIES.map(c => <option key={c} value={c} style={{color:'#000'}}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{color: 'white', fontSize: '11px', fontWeight: 900, display: 'block', marginBottom: '8px'}}>عرض السجلات:</label>
                  <select 
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 800, outline: 'none', cursor: 'pointer', fontSize: '12px' }} 
                      value={logic.rowsPerPage} 
                      onChange={e => { logic.setRowsPerPage(Number(e.target.value)); logic.setCurrentPage(1); }}
                  >
                    <option value="50" style={{color:'#000'}}>50 سجل</option>
                    <option value="100" style={{color:'#000'}}>100 سجل</option>
                    <option value="500" style={{color:'#000'}}>500 سجل</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ color: 'white', fontSize: '11px', fontWeight: 900, display: 'block', marginBottom: '8px' }}>تصفية حسب الحالة:</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {['الكل', 'معتمد', 'معلق'].map(type => (
                      <button 
                        key={type} 
                        onClick={() => logic.setFilterStatus(type)} 
                        className={`filter-btn ${logic.filterStatus === type ? 'active' : ''}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ color: 'white', fontSize: '11px', fontWeight: 900, display: 'block', marginBottom: '8px' }}>تصفية حسب السداد:</label>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {['الكل', 'مسدد', 'مسدد جزئي', 'غير مسدد'].map(type => (
                      <button 
                        key={type} 
                        onClick={() => logic.setPaymentFilter(type)} 
                        className={`filter-btn ${logic.paymentFilter === type ? 'active' : ''}`}
                        style={{ padding: '6px', fontSize: '10px' }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            }
            watchDeps={[logic.selectedIds, displayedTotal, logic.rowsPerPage, displayedExpenses.length, logic.filterStatus, logic.paymentFilter]}
          />

          <style>{`
            .table-glass-wrapper { background: rgba(255,255,255,0.5); backdrop-filter: blur(10px); border-radius: 24px; padding: 10px; border: 1px solid rgba(255,255,255,0.7); transition: all 0.3s ease; }
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
            .custom-checkbox { width: 20px; height: 20px; accent-color: ${THEME.goldAccent}; cursor: pointer; transition: 0.1s; }
            @keyframes modalEntrance { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
          `}</style>

          {(logic.isLoading || permsLoading) ? (
            <LoadingScreen message="جاري المزامنة..." fullScreen={false} />
          ) : (
            <div className="table-glass-wrapper cinematic-scroll" style={{ overflowX: 'auto' }}>
              <RawasiSmartTable 
                data={sortedExpenses} 
                columns={expenseColumns} 
                onRowClick={(row) => { setPrintData(row); setIsPrintModalOpen(true); }}
                enablePagination={true}
                currentPage={logic.currentPage}
                totalItems={sortedExpenses.length}
                rowsPerPage={logic.rowsPerPage}
                onPageChange={logic.setCurrentPage}
                onRowsChange={logic.setRowsPerPage}
              />
            </div>
          )}

          {/* 🚀 المودالات المدمجة */}
          {mounted && logic.isBulkFixModalOpen && createPortal(
            <div style={{ position: 'fixed', inset: 0, zIndex: 999999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(40, 24, 10, 0.85)', backdropFilter: 'blur(10px)', padding: '50px 20px', overflowY: 'auto' }}>
              <div style={{ position: 'fixed', inset: 0 }} onClick={() => logic.setIsBulkFixModalOpen(false)} />
              <div className="cinematic-scroll" style={{ background: 'rgba(255, 255, 255, 0.95)', borderRadius: '32px', width: '100%', maxWidth: '600px', padding: '40px', position: 'relative', zIndex: 10, margin: 'auto', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)', animation: 'modalEntrance 0.4s forwards' }}>
                <h2 style={{ fontWeight: 900, textAlign: 'center', marginBottom: '30px', color: THEME.brand.coffee, fontSize: '24px' }}>🛠️ تصحيح الحسابات لـ ({logic.selectedIds.length}) سجل</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', zIndex: 50, position: 'relative' }}>
                  <div style={{ zIndex: 60, position: 'relative' }}>
                    <SmartCombo 
                      label="🧾 حساب المصروف (المدين)" 
                      table="accounts" 
                      displayCol="name" 
                      initialDisplay={logic.bulkFixAccounts.creditor_account} 
                      onSelect={(val:any) => {
                        logic.setBulkFixAccounts({
                          ...logic.bulkFixAccounts, 
                          creditor_account: val?.name || val,
                          creditor_account_id: val?.id || null 
                        });
                      }} 
                      strict={true} 
                    />
                  </div>
                  <div style={{ zIndex: 50, position: 'relative' }}>
                    <SmartCombo 
                      label="🏦 حساب السداد (الدائن)" 
                      table="accounts" 
                      displayCol="name" 
                      initialDisplay={logic.bulkFixAccounts.payment_account} 
                      onSelect={(val:any) => {
                        logic.setBulkFixAccounts({
                          ...logic.bulkFixAccounts, 
                          payment_account: val?.name || val,
                          payment_account_id: val?.id || null 
                        });
                      }} 
                      strict={true} 
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', marginTop: '40px' }}>
                  <button onClick={logic.handleBulkFixSave} disabled={logic.isLoading} style={{ flex: 2, padding: '18px', borderRadius: '16px', background: THEME.info, color: 'white', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '16px', boxShadow: `0 10px 25px ${THEME.info}40` }}>{logic.isLoading ? '⏳ جاري الحفظ...' : '✅ تطبيق التعديلات'}</button>
                  <button onClick={()=>logic.setIsBulkFixModalOpen(false)} style={{ flex: 1, padding: '18px', borderRadius: '16px', border: '2px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 900, cursor: 'pointer', fontSize: '16px' }}>إلغاء</button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* 💸 المودال الموحد - وهنا بيحصل التحديث اللحظي للمصروف */}
          {mounted && pvLogic.state.isEditModalOpen && (
              <PaymentVoucherModal 
                isOpen={pvLogic.state.isEditModalOpen}
                onClose={() => pvLogic.actions.setIsEditModalOpen(false)}
                record={pvLogic.state.currentVoucher}
                setRecord={pvLogic.actions.setCurrentVoucher}
                onSave={async (voucherData: any) => {
                    const expenseId = voucherData.related_expense_id;
                    const addedAmount = Number(voucherData.amount || 0);

                    // 1. أخذ نسخة احتياطية من الكاش للتأمين وحساب القيمة بدقة
                    const previousCache = queryClient.getQueryData(['expenses']) as any[];
                    const targetExpense = previousCache?.find((e: any) => String(e.id) === String(expenseId));
                    const newPaidAmount = Number(targetExpense?.paid_amount || 0) + addedAmount;

                    // 2. تحديث الشاشة فوراً (0 ثانية) 🚀
                    if (expenseId) {
                        queryClient.setQueryData(['expenses'], (oldData: any[]) => {
                            if (!oldData) return [];
                            return oldData.map((exp: any) => {
                                if (String(exp.id) === String(expenseId)) {
                                    return { ...exp, paid_amount: newPaidAmount };
                                }
                                return exp;
                            });
                        });
                    }

                    try {
                        // 3. الحفظ الفعلي باستخدام لوجيك السندات
                        await pvLogic.actions.handleSaveVoucher(voucherData);

                        // 4. 🔥 الإجبار: نحدث الفاتورة نفسها في الداتا بيز عشان متصفرش تاني
                        if (expenseId) {
                            await supabase.from('expenses').update({ paid_amount: newPaidAmount }).eq('id', expenseId);
                        }

                    } catch (error) {
                        // 🔙 استرجاع الرقم القديم لو حصل مشكلة
                        queryClient.setQueryData(['expenses'], previousCache);
                        console.error("Voucher save failed:", error);
                    } 
                }}
                isSaving={pvLogic.isLoading}
                partnerBalance={pvLogic.state.partnerBalance}
                isBalanceLoading={pvLogic.state.isBalanceLoading}
              />
          )}

          {mounted && logic.isEditModalOpen && (
              <ExpenseFormModal 
                isOpen={logic.isEditModalOpen} 
                onClose={() => logic.setIsEditModalOpen(false)} 
                record={logic.currentExpense} 
                setRecord={logic.setCurrentExpense} 
                onSave={logic.handleSaveExpense} 
                projects={logic.projects} 
                historicalData={logic.historicalData}
                isSaving={logic.isLoading}
              />
          )}

          {mounted && isPrintModalOpen && (
              <ExpensePrintModal 
                isOpen={isPrintModalOpen} 
                onClose={() => setIsPrintModalOpen(false)} 
                record={printData} 
                projects={logic.projects} 
              />
          )}

      </MasterPage>
    </div>
  );
}
