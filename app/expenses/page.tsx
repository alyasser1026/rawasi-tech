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
import ExpenseCategorySummary from './ExpenseCategorySummary';
import LoadingScreen from '@/components/LoadingScreen';
import { ChevronUp, ChevronDown, ArrowUpDown, Printer, Banknote, Plus, Download, Edit3, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { AttachmentViewButton } from '@/components/TelegramAttachmentField';

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
    return logic.filteredExpenses.filter((item: any) => (String(item.main_category || '').trim() || 'غير مصنف') === categoryFilter);
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
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', userSelect: 'none' }}
          title={`ترتيب حسب ${label}`}
      >
          <span>{label}</span>
          <span style={{ fontSize: 'var(--fs-xs)', opacity: sortConfig?.key === key ? 1 : 0.3 }}>
              {sortConfig?.key === key ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />) : <ArrowUpDown size={14} aria-hidden="true" />}
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
      render: (row: any) => row ? <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{row.exp_date}</span> : null,
      exportValue: (row: any) => row.exp_date || '---' 
    },
    { 
      header: renderSortableHeader('المقاول/المستفيد', 'sub_contractor'), 
      accessor: 'sub_contractor', 
      render: (row: any) => row ? <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.8125rem', maxWidth: '6.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }} title={row.sub_contractor || row.payee_name || '---'}>{row.sub_contractor || row.payee_name || '---'}</span> : null,
      exportValue: (row: any) => row.sub_contractor || row.payee_name || '---'
    },
    { 
      header: renderSortableHeader('التصنيف', 'main_category'), 
      accessor: 'main_category', 
      render: (row: any) => row ? (
        <span style={{ fontSize: '0.6875rem', background: 'var(--accent-soft-bg)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--accent-ink)', fontWeight: 800, whiteSpace: 'nowrap', display: 'inline-block' }}>
          {row.main_category || 'غير مصنف'}
        </span>
      ) : null,
      exportValue: (row: any) => row.main_category || 'غير مصنف'
    },
    { 
      header: renderSortableHeader('المشروع', 'site_ref'), 
      accessor: 'site_ref', 
      render: (row: any) => row ? (
        <span style={{ fontSize: '0.6875rem', background: 'var(--surface-sunken)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 800, whiteSpace: 'nowrap', display: 'inline-block' }}>
          {row.is_auto_distributed ? 'توزيع ذكي' : row.site_ref || 'عام'}
        </span>
      ) : null,
      exportValue: (row: any) => row.is_auto_distributed ? 'توزيع ذكي' : (row.site_ref || 'عام')
    },
    { 
      header: renderSortableHeader('المدين', 'creditor_account'), 
      accessor: 'creditor_account', 
      render: (row: any) => row ? (
        <span style={{ fontSize: '0.6875rem', background: 'var(--surface-sunken)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-primary)', fontWeight: 800, maxWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }} title={row.creditor_account || '---'}>
          {row.creditor_account || '---'}
        </span>
      ) : null,
      exportValue: (row: any) => row.creditor_account || '---'
    },
    { 
      header: renderSortableHeader('الدائن', 'payment_account'), 
      accessor: 'payment_account', 
      render: (row: any) => row ? (
        <span style={{ fontSize: '0.6875rem', background: 'var(--surface-sunken)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-primary)', fontWeight: 800, maxWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }} title={row.payment_account || '---'}>
          {row.payment_account || '---'}
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
        return <span style={{ fontSize: '0.75rem', maxWidth: '6.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', color: 'var(--text-secondary)' }} title={displayDesc || '---'}>{displayDesc || '---'}</span>;
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
      render: (row: any) => row ? <span style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{Number(row.vat_amount || 0).toLocaleString()}</span> : null,
      exportValue: (row: any) => Number(row.vat_amount || 0)
    },
    { 
      header: renderSortableHeader('الخصم', 'discount_amount'), 
      accessor: 'discount_amount', 
      render: (row: any) => row ? <span style={{ color: 'var(--status-negative)', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{Number(row.discount_amount || 0).toLocaleString()}</span> : null,
      exportValue: (row: any) => Number(row.discount_amount || 0)
    },
    { 
      header: renderSortableHeader('الإجمالي', 'total'), 
      accessor: 'total', 
      render: (row: any) => {
        if (!row) return null;
        const total = row.total_price || ((Number(row.quantity || 1) * Number(row.unit_price || 0)) + Number(row.vat_amount || 0) - Number(row.discount_amount || 0));
        return <span style={{ color: 'var(--status-positive)', fontWeight: 900, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{total.toLocaleString()}</span>;
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
        
        let statusText = 'غير مسدد';
        let statusColor = 'var(--status-negative)';
        let statusBg = 'var(--status-negative-soft)';

        if (paid > 0 && paid < total) {
            statusText = 'مسدد جزئي'; statusColor = 'var(--status-warning)'; statusBg = 'var(--status-warning-soft)';
        } else if (paid >= total) {
            statusText = 'مسدد'; statusColor = 'var(--status-positive)'; statusBg = 'var(--status-positive-soft)';
        }

        return (
          <span style={{ display: 'inline-block', background: statusBg, color: statusColor, padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
            {statusText}
          </span>
        );
      },
      exportValue: (row: any) => {
        const total = row.total_price || (Number(row.quantity || 1) * Number(row.unit_price || 0)) + Number(row.vat_amount || 0) - Number(row.discount_amount || 0);
        const paid = Number(row.paid_amount || 0);
        if (paid <= 0) return 'غير مسدد';
        if (paid > 0 && paid < total) return 'مسدد جزئي';
        return 'مسدد';
      }
    },
    {
      header: renderSortableHeader('الحالة', 'is_posted'),
      accessor: 'is_posted',
      render: (row: any) => {
        if (!row) return null;
        return row.is_posted ? 
          <span style={{ display: 'inline-block', background: 'var(--status-positive-soft)', color: 'var(--status-positive)', padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 900, whiteSpace: 'nowrap' }}>معتمد</span> : 
          <span style={{ display: 'inline-block', background: 'var(--status-warning-soft)', color: 'var(--status-warning)', padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 900, whiteSpace: 'nowrap' }}>{row._offline_queued ? 'في الطابور' : 'معلق'}</span>;
      },
      exportValue: (row: any) => row.is_posted ? 'معتمد' : 'معلق'
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
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
            {row.invoice_image && <AttachmentViewButton url={row.invoice_image} label="المرفق" title="معاينة مرفق الفاتورة" />}
            <button 
              onClick={(e) => { e.stopPropagation(); setPrintData(row); setIsPrintModalOpen(true); }} 
              style={{ background: 'var(--surface-sunken)', border: 'none', boxShadow: 'var(--shadow-sunken)', padding: '0.375rem 0.625rem', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', fontSize: 'var(--fs-md)', color: 'var(--text-primary)' }}
              title="طباعة المصروف"
            >
              <Printer size={14} aria-hidden="true" />
            </button>
            {needsPayment && (
             <button 
                  disabled={pvLogic.state.isEditModalOpen} 
                  onClick={(e) => {
                      e.stopPropagation(); 
                      // 🏦 1. تحديد حساب الخزينة الخاص بالشركة الحالية ديناميكياً لتفادي أخطاء قيود الشركات المتعددة
                      let resolvedCreditId = null;
                      let resolvedCreditName = 'الخزينة الرئيسية';
                      if (Array.isArray(logic.accounts_raw) && logic.accounts_raw.length > 0) {
                          const treasuryAcc = logic.accounts_raw.find((a: any) => String(a.code) === '122')
                              || logic.accounts_raw.find((a: any) => (a.name || '').includes('الخزينة الرئيسية'))
                              || logic.accounts_raw.find((a: any) => String(a.code) === '121')
                              || logic.accounts_raw.find((a: any) => (a.name || '').includes('خزينة'))
                              || logic.accounts_raw.find((a: any) => (a.name || '').includes('صندوق'));
                          if (treasuryAcc) {
                              resolvedCreditId = treasuryAcc.id;
                              resolvedCreditName = treasuryAcc.name;
                          }
                      }

                      // 📑 2. تحديد الحساب المدين (المصروف / المورد / الشريك)
                      let resolvedDebitId = null;
                      let resolvedDebitName = row.payment_account || row.creditor_account || '';
                      if (Array.isArray(logic.accounts_raw) && logic.accounts_raw.length > 0) {
                          const candidates = [row.creditor_account, row.payment_account].filter(Boolean);
                          for (const cand of candidates) {
                              const found = logic.accounts_raw.find((a: any) => 
                                  String(a.code) === cand || a.name === cand || `${a.code} - ${a.name}` === cand
                              );
                              if (found && String(found.code) !== '122' && String(found.code) !== '121') {
                                  resolvedDebitId = found.id;
                                  resolvedDebitName = found.name;
                                  break;
                              }
                          }
                          if (!resolvedDebitId && row.payment_account) {
                              const fallback = logic.accounts_raw.find((a: any) => 
                                  String(a.code) === row.payment_account || a.name === row.payment_account || `${a.code} - ${a.name}` === row.payment_account
                              );
                              if (fallback) {
                                  resolvedDebitId = fallback.id;
                                  resolvedDebitName = fallback.name;
                              }
                          }
                      }

                      const preparedVoucher = {
                          date: new Date().toISOString().split('T')[0],
                          amount: balance, 
                          debit_account_id: resolvedDebitId, 
                          debit_account_name: resolvedDebitName, 
                          credit_account_id: resolvedCreditId,
                          credit_account_name: resolvedCreditName,
                          partner_id: row.partner_id || null, 
                          payee_id: row.partner_id || null,
                          payee_name: row.sub_contractor || row.payee_name || row.creditor_account,
                          site_ref: row.site_ref || null,
                          project_ids: row.project_id ? [row.project_id] : (row.project_ids || []),
                          job_order_id: row.job_order_id || null,
                          job_order_number: row.job_order?.order_number || '',
                          description: `سداد مصروف: ${row.description || ''} (فاتورة: ${row.invoice_number || 'غير محدد'})`,
                          payment_method: 'نقدي',
                          reference_no: row.invoice_number || '', 
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
                      padding: '0.5rem 1rem', 
                      borderRadius: '10px', 
                      cursor: pvLogic.state.isEditModalOpen ? 'not-allowed' : 'pointer', 
                      fontWeight: 900, 
                      fontSize: 'var(--fs-sm)', 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                      opacity: pvLogic.state.isEditModalOpen ? 0.7 : 1 
                  }}
                  onMouseEnter={(e) => { if(!pvLogic.state.isEditModalOpen) e.currentTarget.style.transform = 'translateY(-2px)'}}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  title="إصدار سند صرف فوري"
              >
                  <span style={{ fontSize: 'var(--fs-md)' }}><Banknote size={14} aria-hidden="true" /></span>
                  صرف السند
              </button>
            )}
          </div>
        );
      }
    }
  ];

  const sidebarActions = (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.625rem' }}>
      <SecureAction module="expenses" action="create">
        <button className="ent-button ent-primary" onClick={logic.handleAddNew}>
          <Plus size={16} aria-hidden="true" />
          <span>إضافة مصروف جديد</span>
        </button>
      </SecureAction>

      {logic.selectedIds.length > 0 && (
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-sunken)', padding: '0.25rem 0.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0 0.25rem' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 800 }}>({logic.selectedIds.length}) محدد</span>
              <button onClick={() => logic.setSelectedIds([])} style={{ background: 'none', border: 'none', color: 'var(--accent-ink)', fontSize: 'var(--fs-xs)', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>إلغاء</button>
          </div>
          
          <SecureAction module="expenses" action="edit">
              <button 
                  className="ent-button ent-success" 
                  onClick={logic.handleBulkDisburse}
                  disabled={logic.isDisbursing}
              >
                  <Banknote size={14} aria-hidden="true" />
                  <span>{logic.isDisbursing ? 'جاري المعالجة...' : `صرف جماعي (${logic.selectedIds.length})`}</span>
              </button>
          </SecureAction>

          <SecureAction module="expenses" action="edit">
            <button className="ent-button" onClick={() => logic.setIsBulkFixModalOpen(true)}>
              <span>تصحيح مجمع</span>
            </button>
          </SecureAction>
          {logic.selectedIds.length === 1 && (
            <SecureAction module="expenses" action="edit">
              <button className="ent-button" onClick={logic.handleEditSelected}>
                <Edit3 size={14} aria-hidden="true" />
                <span>تعديل السجل</span>
              </button>
            </SecureAction>
          )}
          <SecureAction module="expenses" action="post">
            <button className="ent-button ent-success" onClick={logic.handlePostSelected}>
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>اعتماد وترحيل</span>
            </button>
          </SecureAction>
          <SecureAction module="expenses" action="post">
            <button className="ent-button ent-warning" onClick={logic.handleUnpostSelected}>
              <RotateCcw size={14} aria-hidden="true" />
              <span>فك الترحيل</span>
            </button>
          </SecureAction>
          <SecureAction module="expenses" action="delete">
            <button className="ent-button ent-danger" onClick={logic.handleDeleteSelected}>
              <Trash2 size={14} aria-hidden="true" />
              <span>حذف نهائي</span>
            </button>
          </SecureAction>
        </div>
      )}

      <button className="ent-button" onClick={logic.exportToExcel}>
        <Download size={16} aria-hidden="true" />
        <span>تصدير Excel</span>
      </button>
    </div>
  );

  return (
    <div className="clean-page enterprise-page">
      <MasterPage title="سجل المصروفات الموحد" subtitle="إدارة التكاليف والمشتريات وتوزيع بنود العمل">
          <RawasiSidebarManager 
            summary={
              <div className="summary-glass-card">
                <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'var(--text-secondary)'}}>إجمالي مصروفات الفترة</span>
                <div className="val" style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: 'var(--accent-ink)', marginTop:'0.3125rem'}}>{formatCurrency(displayedTotal)}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--status-positive)', fontWeight:800, marginTop:'0.3125rem'}}>إجمالي القيود: {displayedExpenses.length}</div>
              </div>
            }
            actions={sidebarActions}
            customFilters={
              <div className="expenses-filter-grid">
                <div className="expenses-filter-field">
                  <label className="expenses-filter-label">تصفية بالتصنيف:</label>
                  <select 
                      className="expenses-filter-select"
                      value={categoryFilter || "الكل"}
                      onChange={e => {
                        const val = e.target.value;
                        setCategoryFilter(val === 'الكل' ? null : val);
                      }}
                  >
                    <option value="الكل">كل التصنيفات</option>
                    {MAIN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    {categoryFilter && !MAIN_CATEGORIES.includes(categoryFilter) && <option value={categoryFilter}>{categoryFilter}</option>}
                  </select>
                </div>

                <div className="expenses-filter-field">
                  <label className="expenses-filter-label">عرض السجلات:</label>
                  <select 
                      className="expenses-filter-select"
                      value={logic.rowsPerPage} 
                      onChange={e => { logic.setRowsPerPage(Number(e.target.value)); logic.setCurrentPage(1); }}
                  >
                    <option value="50">50 سجل</option>
                    <option value="100">100 سجل</option>
                    <option value="500">500 سجل</option>
                  </select>
                </div>
                
                <div className="expenses-filter-field">
                  <label className="expenses-filter-label">تصفية حسب الحالة:</label>
                  <div className="expenses-segmented-control" role="group" aria-label="تصفية حسب الحالة">
                    {['الكل', 'معتمد', 'معلق'].map(type => (
                      <button 
                        key={type} 
                        type="button"
                        onClick={() => logic.setFilterStatus(type)} 
                        className={`expenses-segment-btn ${logic.filterStatus === type ? 'active' : ''}`}
                        aria-pressed={logic.filterStatus === type}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="expenses-filter-field">
                  <label className="expenses-filter-label">تصفية حسب السداد:</label>
                  <div className="expenses-segmented-control" role="group" aria-label="تصفية حسب السداد">
                    {['الكل', 'مسدد', 'مسدد جزئي', 'غير مسدد'].map(type => (
                      <button 
                        key={type} 
                        type="button"
                        onClick={() => logic.setPaymentFilter(type)} 
                        className={`expenses-segment-btn ${logic.paymentFilter === type ? 'active' : ''}`}
                        aria-pressed={logic.paymentFilter === type}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            }
            watchDeps={[logic.selectedIds, displayedTotal, logic.rowsPerPage, displayedExpenses.length, logic.filterStatus, logic.paymentFilter, categoryFilter]}
          />

          <style>{`
            .expenses-filter-grid {
              display: grid;
              grid-column: 1 / -1;
              grid-template-columns: minmax(13rem, 1.4fr) minmax(9rem, 0.9fr) minmax(12rem, 1.2fr) minmax(16rem, 1.6fr);
              gap: 1rem 1.25rem;
              width: 100%;
              align-items: end;
            }
            @media (max-width: 1100px) {
              .expenses-filter-grid {
                grid-template-columns: repeat(2, 1fr);
              }
            }
            @media (max-width: 600px) {
              .expenses-filter-grid {
                grid-template-columns: 1fr;
              }
            }
            .expenses-filter-field {
              display: flex;
              flex-direction: column;
              gap: 0.375rem;
              min-width: 0;
            }
            .expenses-filter-label {
              font-size: var(--fs-xs);
              font-weight: 800;
              color: var(--text-secondary);
              margin: 0;
            }
            .expenses-filter-select {
              width: 100%;
              height: 2.75rem;
              padding: 0 0.875rem;
              border-radius: 12px;
              border: none !important;
              background: var(--surface-sunken);
              box-shadow: var(--shadow-sunken);
              color: var(--text-primary);
              font-weight: 800;
              font-size: var(--fs-sm);
              outline: none;
              cursor: pointer;
              appearance: auto;
              transition: all 0.2s ease;
            }
            .expenses-filter-select:focus-visible {
              outline: 2px solid var(--accent-main);
              outline-offset: 1px;
            }
            .expenses-segmented-control {
              display: flex;
              align-items: center;
              background: var(--surface-sunken);
              box-shadow: var(--shadow-sunken);
              border-radius: 12px;
              padding: 4px;
              gap: 4px;
              min-height: 2.75rem;
              box-sizing: border-box;
            }
            .expenses-segment-btn {
              flex: 1;
              min-height: 2.25rem;
              padding: 0 0.5rem;
              border: none !important;
              border-radius: 8px;
              background: transparent;
              color: var(--text-secondary);
              font-size: var(--fs-xs);
              font-weight: 800;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
              white-space: nowrap;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            }
            .expenses-segment-btn:hover:not(.active) {
              background: var(--surface-card-hover);
              color: var(--text-primary);
            }
            .expenses-segment-btn.active {
              background: var(--action-fill) !important;
              color: var(--action-ink) !important;
              box-shadow: 0 4px 12px -2px var(--accent-glow);
            }
            .table-glass-wrapper {
              background: var(--surface-card);
              border-radius: var(--phi-radius-card, 18px);
              padding: 0.75rem;
              border: none !important;
              box-shadow: var(--shadow-ambient);
              position: relative;
              overflow: hidden;
              transition: all 0.3s ease;
            }
            .table-glass-wrapper::before {
              content: '';
              position: absolute;
              top: 0; left: 8%; right: 8%;
              height: 1.5px;
              background: var(--specular-beam);
              pointer-events: none;
            }
            .summary-glass-card {
              background: var(--surface-card);
              border-radius: var(--phi-radius-card, 18px);
              padding: 1.25rem 1.5rem;
              border: none !important;
              box-shadow: var(--shadow-ambient);
              position: relative;
              overflow: hidden;
            }
            .summary-glass-card::before {
              content: '';
              position: absolute;
              top: 0; left: 8%; right: 8%;
              height: 1.5px;
              background: var(--specular-beam);
              pointer-events: none;
            }
            .custom-checkbox { width: 1.25rem; height: 1.25rem; accent-color: var(--accent-main); cursor: pointer; transition: 0.1s; }
            .expenses-compact-table {
              overflow-x: auto;
            }
            .expenses-compact-table .rawasi-printable-table {
              width: 100% !important;
              font-size: 0.78125rem !important;
              border-collapse: separate !important;
              border-spacing: 0 !important;
            }
            .expenses-compact-table .rawasi-printable-table thead th {
              padding: 0.5rem 0.35rem !important;
              font-size: 0.71875rem !important;
              font-weight: 800 !important;
              text-align: center !important;
              white-space: nowrap !important;
              letter-spacing: -0.2px;
            }
            .expenses-compact-table .rawasi-printable-table tbody td {
              padding: 0.375rem 0.35rem !important;
              font-size: 0.78125rem !important;
              text-align: center !important;
              white-space: nowrap !important;
              line-height: 1.25 !important;
            }
            .expenses-compact-table .rawasi-printable-table th:first-child,
            .expenses-compact-table .rawasi-printable-table td:first-child {
              width: 2rem !important;
              padding: 0.375rem 0.2rem !important;
            }
            .expenses-compact-table .rawasi-table-column-label {
              justify-content: center !important;
              gap: 0.2rem !important;
            }
            .expenses-compact-table .rawasi-table-sort-indicator {
              margin-inline-start: 0.15rem !important;
            }

            @keyframes modalEntrance { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
          `}</style>

          {!(logic.isLoading || permsLoading) && (
            <ExpenseCategorySummary
              expenses={logic.filteredExpenses}
              category={categoryFilter}
              onSelectCategory={(c) => { setCategoryFilter(c); logic.setCurrentPage(1); }}
            />
          )}

          {(logic.isLoading || permsLoading) ? (
            <LoadingScreen message="جاري المزامنة..." fullScreen={false} />
          ) : (
            <div className="table-glass-wrapper expenses-compact-table cinematic-scroll" style={{ overflowX: 'auto' }}>
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
            <div style={{ position: 'fixed', inset: 0, zIndex: 999999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(40, 24, 10, 0.85)', backdropFilter: 'blur(10px)', padding: '3.125rem 1.25rem', overflowY: 'auto' }}>
              <div style={{ position: 'fixed', inset: 0 }} onClick={() => logic.setIsBulkFixModalOpen(false)} />
              <div className="cinematic-scroll" style={{ background: 'rgba(255, 255, 255, 0.95)', borderRadius: '14px', width: '100%', maxWidth: '37.5rem', padding: '2.5rem', position: 'relative', zIndex: 10, margin: 'auto', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)', animation: 'modalEntrance 0.4s forwards' }}>
                <h2 style={{ fontWeight: 900, textAlign: 'center', marginBottom: '1.875rem', color: THEME.brand.coffee, fontSize: 'var(--fs-2xl)' }}>تصحيح الحسابات لـ ({logic.selectedIds.length}) سجل</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5625rem', zIndex: 50, position: 'relative' }}>
                  <div style={{ zIndex: 60, position: 'relative' }}>
                    <SmartCombo 
                      label="حساب المصروف (المدين)" 
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
                      label="حساب السداد (الدائن)" 
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
                <div style={{ display: 'flex', gap: '0.9375rem', marginTop: '2.5rem' }}>
                  <button onClick={logic.handleBulkFixSave} disabled={logic.isLoading} style={{ flex: 2, padding: '1.125rem', borderRadius: '16px', background: THEME.info, color: 'white', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-lg)', boxShadow: `0 10px 25px ${THEME.info}40` }}>{logic.isLoading ? 'جاري الحفظ...' : 'تطبيق التعديلات'}</button>
                  <button onClick={()=>logic.setIsBulkFixModalOpen(false)} style={{ flex: 1, padding: '1.125rem', borderRadius: '16px', border: 'none', background: 'var(--surface-subcard)', color: 'var(--text-primary)', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-lg)', boxShadow: 'var(--shadow-elevation)' }}>إلغاء</button>
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

