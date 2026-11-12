"use client";
import React, { useMemo } from 'react';
import { useTrialBalanceLogic } from './trial_balance_logic';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { formatCurrency } from '@/lib/helpers';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocSignatures, PHI_DOC_CSS } from '@/components/PrintDocument';
import { currencyCode, currencyName } from '@/lib/currency';

const PRINT_THEME = {
  primary: '#0f172a',
  success: '#059669',
  ruby: '#e11d48'
};

export default function TrialBalancePage() {
  const logic = useTrialBalanceLogic();

  // 🚀 الحل السحري لمشكلة الجافاسكريبت: نتجاهل الكسور الوهمية اللي أقل من هللة/قرش
  const isBalanced = Math.abs((logic.totals.end_debit || 0) - (logic.totals.end_credit || 0)) < 0.01;

  const sidebarActions = useMemo(() => [
    <button 
      key="print_tb"
      onClick={() => window.print()}
      style={{ padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'var(--surface-subcard)', color: 'var(--text-primary)', fontWeight: '900', cursor: 'pointer', width: '100%', marginBottom: '0.5rem', boxShadow: 'var(--shadow-elevation)' }}
    >
      طباعة الميزان الرسمي
    </button>,

    <button 
      key="export_excel"
      onClick={logic.exportToExcel}
      style={{ padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'var(--action-fill)', color: 'var(--action-ink)', fontWeight: '900', cursor: 'pointer', width: '100%', boxShadow: 'var(--shadow-elevation)' }}
    >
      تصدير Excel
    </button>
  ], [logic.exportToExcel]);

  return (
    <MasterPage 
      title="ميزان المراجعة (Trial Balance)" 
      description="عرض الأرصدة الافتتاحية، حركات الفترة، والأرصدة الختامية لجميع الحسابات"
    >
      <style>{`
        /* تنسيقات الشاشة الأساسية - لغة Obsidian Ceramic الخالية من الحواف */
        .trial-balance-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.9375rem;
          align-items: center;
          background: var(--surface-card) !important;
          color: var(--text-primary);
          padding: 1.125rem 1.5rem !important;
          border: none !important;
          box-shadow: var(--shadow-ambient) !important;
          border-radius: var(--phi-radius-card, 18px) !important;
          position: relative !important;
          overflow: hidden !important;
          margin-bottom: 1.25rem;
        }
        .trial-balance-filters::before {
          content: '';
          position: absolute;
          top: 0; left: 8%; right: 8%;
          height: 1.5px;
          background: var(--specular-beam);
          pointer-events: none;
        }
        .trial-balance-date { display: flex; align-items: center; gap: 0.625rem; font-weight: 900; font-size: var(--fs-sm); }
        .trial-balance-date input {
          height: 2.75rem !important;
          padding: 0 0.875rem !important;
          border-radius: 12px !important;
          border: none !important;
          outline: none !important;
          box-shadow: var(--shadow-sunken) !important;
          color: var(--text-primary) !important;
          background: var(--surface-sunken) !important;
          font-weight: 800 !important;
          font-size: var(--fs-sm) !important;
          transition: box-shadow 150ms ease;
        }
        .trial-balance-date input:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 1px; }
        .trial-balance-scroll {
          overflow-x: auto !important;
          border: none !important;
          border-radius: var(--phi-radius-card, 18px) !important;
          box-shadow: var(--shadow-ambient) !important;
          background: var(--surface-card) !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .trial-balance-scroll::before {
          content: '';
          position: absolute;
          top: 0; left: 8%; right: 8%;
          height: 1.5px;
          background: var(--specular-beam);
          pointer-events: none;
        }
        .tb-table { width: 100%; border-collapse: collapse; text-align: center; background: var(--surface-card); color: var(--text-primary); }
        .tb-table th, .tb-table td { border: none !important; border-bottom: 1px solid var(--table-zebra-bg) !important; padding: 0.75rem 0.5rem; font-size: var(--fs-md); }
        .tb-table thead th { background: var(--table-head-bg); color: var(--text-primary); font-weight: 900; }
        .tb-table tbody tr:hover { background: var(--table-row-hover); }
        .tb-table tbody td.text-right { text-align: right; font-weight: 900; }
        .tb-table tbody td.number { font-family: monospace; font-size: var(--fs-sm); font-weight: 900; }
        .tb-table .tb-period { background: var(--table-zebra-bg); }
        .tb-table .tb-totals { background: var(--surface-subcard); font-weight: 900; }
        .tb-table .tb-totals td { border-top: none !important; background: var(--surface-subcard) !important; font-size: var(--fs-lg); }
        .tb-balance-status {
          background: radial-gradient(ellipse 90% 70% at 0% 50%, color-mix(in srgb, var(--status-positive) 14%, transparent), transparent 80%), var(--surface-card) !important;
          border: none !important;
          box-shadow: var(--shadow-ambient) !important;
          border-radius: var(--phi-radius-card, 18px) !important;
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: space-between !important;
          align-items: center !important;
          gap: 0.5rem 1rem !important;
          margin-top: 1.25rem !important;
          padding: 1.25rem 1.5rem !important;
          font-weight: 900 !important;
          color: var(--status-positive) !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .tb-balance-status.unbalanced {
          background: radial-gradient(ellipse 90% 70% at 0% 50%, color-mix(in srgb, var(--status-negative) 14%, transparent), transparent 80%), var(--surface-card) !important;
          color: var(--status-negative) !important;
        }
        .tb-balance-status::before {
          content: '';
          position: absolute;
          top: 0; left: 8%; right: 8%;
          height: 1.5px;
          background: var(--specular-beam);
          pointer-events: none;
        }

        /* تنسيقات الطباعة المعزولة */
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; width: 100%; direction: rtl; font-family: 'Cairo', sans-serif; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; text-align: center; background: #ffffff; }
          .print-table th, .print-table td { border: 1px solid #94a3b8; padding: 6px 4px; }
          .print-table thead th { background-color: #e2e8f0 !important; font-weight: 900; color: #000000 !important; }
          .print-table tr:nth-child(even) { background-color: #f8fafc !important; }
          .print-table td.number { font-family: monospace; font-weight: 900; }
          .print-table td.text-right { text-align: right; font-weight: 900; color: #000000; }
          .print-totals { font-weight: 900 !important; background-color: #cbd5e1 !important; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      <div style={{ display: 'flex', gap: '1.25rem' }} className="no-print">
        
        {/* منطقة المحتوى الرئيسي */}
        <div style={{ flex: 1, minWidth: 0 }}>
          
          {/* لوحة الفلاتر */}
          <div className="trial-balance-filters">
            <div style={{ fontWeight: '900', fontSize: 'var(--fs-lg)', minWidth: '6.25rem' }}>فترة الميزان:</div>
            
            <label className="trial-balance-date">
              <span>من:</span>
              <input 
                type="date" 
                value={logic.startDate} 
                onChange={e => logic.setStartDate(e.target.value)}
              />
            </label>
            
            <label className="trial-balance-date">
              <span>إلى:</span>
              <input 
                type="date" 
                value={logic.endDate} 
                onChange={e => logic.setEndDate(e.target.value)}
              />
            </label>
          </div>

          {/* الجدول والشاشة */}
          {logic.isLoading ? (
            <LoadingScreen message="جاري إعداد ميزان المراجعة وتجميع القيود..." fullScreen={false} />
          ) : (
            <>
              <div className="trial-balance-scroll">
                <table className="tb-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ width: '10%' }}>رقم الحساب</th>
                      <th rowSpan={2} style={{ width: '30%' }}>اسم الحساب</th>
                      <th colSpan={2}>الرصيد الافتتاحي</th>
                      <th colSpan={2}>حركة الفترة</th>
                      <th colSpan={2}>الرصيد الختامي</th>
                    </tr>
                    <tr>
                      <th style={{ color: 'var(--status-positive)' }}>مدين</th>
                      <th style={{ color: 'var(--status-negative)' }}>دائن</th>
                      <th style={{ color: 'var(--status-positive)' }}>مدين</th>
                      <th style={{ color: 'var(--status-negative)' }}>دائن</th>
                      <th style={{ color: 'var(--status-positive)' }}>مدين</th>
                      <th style={{ color: 'var(--status-negative)' }}>دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logic.records.map((r, i) => (
                      <tr key={i}>
                        <td className="number">{r.account_code}</td>
                        <td className="text-right">{r.account_name}</td>
                        
                        <td className="number" style={{ color: r.opening_debit > 0 ? 'var(--status-positive)' : 'var(--text-muted)' }}>{r.opening_debit > 0 ? formatCurrency(r.opening_debit) : '-'}</td>
                        <td className="number" style={{ color: r.opening_credit > 0 ? 'var(--status-negative)' : 'var(--text-muted)' }}>{r.opening_credit > 0 ? formatCurrency(r.opening_credit) : '-'}</td>
                        
                        <td className="number tb-period" style={{ color: r.period_debit > 0 ? 'var(--status-positive)' : 'var(--text-muted)' }}>{r.period_debit > 0 ? formatCurrency(r.period_debit) : '-'}</td>
                        <td className="number tb-period" style={{ color: r.period_credit > 0 ? 'var(--status-negative)' : 'var(--text-muted)' }}>{r.period_credit > 0 ? formatCurrency(r.period_credit) : '-'}</td>
                        
                        <td className="number" style={{ color: r.ending_debit > 0 ? 'var(--status-positive)' : 'var(--text-muted)' }}>{r.ending_debit > 0 ? formatCurrency(r.ending_debit) : '-'}</td>
                        <td className="number" style={{ color: r.ending_credit > 0 ? 'var(--status-negative)' : 'var(--text-muted)' }}>{r.ending_credit > 0 ? formatCurrency(r.ending_credit) : '-'}</td>
                      </tr>
                    ))}
                    
                    {/* صف الإجماليات */}
                    <tr className="tb-totals">
                      <td colSpan={2} style={{ textAlign: 'left', paddingLeft: '1.25rem' }}>الإجمـــالي الكـــلي:</td>
                      <td className="number" style={{ color: 'var(--status-positive)' }}>{formatCurrency(logic.totals.op_debit)}</td>
                      <td className="number" style={{ color: 'var(--status-negative)' }}>{formatCurrency(logic.totals.op_credit)}</td>
                      <td className="number" style={{ color: 'var(--status-positive)' }}>{formatCurrency(logic.totals.per_debit)}</td>
                      <td className="number" style={{ color: 'var(--status-negative)' }}>{formatCurrency(logic.totals.per_credit)}</td>
                      <td className="number" style={{ color: 'var(--status-positive)' }}>{formatCurrency(logic.totals.end_debit)}</td>
                      <td className="number" style={{ color: 'var(--status-negative)' }}>{formatCurrency(logic.totals.end_credit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* مؤشر اتزان الميزان */}
              <div className={`tb-balance-status ${isBalanced ? '' : 'unbalanced'}`}>
                <span>
                  {isBalanced ? 'الميزان متزن تماماً (لا توجد فروق)' : 'يوجد فرق في الميزان! يرجى مراجعة قيود اليومية.'}
                </span>
                {!isBalanced && (
                  <span style={{ fontSize: 'var(--fs-lg)' }}>قيمة الفرق: {formatCurrency(Math.abs(logic.totals.end_debit - logic.totals.end_credit))}</span>
                )}
              </div>
            </>
          )}
        </div>

        <RawasiSidebarManager actions={sidebarActions} />
      </div>

      {/* مساحة الطباعة */}
      <div className="print-area phi-doc phi-print-own-header" style={{ display: 'none' }}>
          <style>{PHI_DOC_CSS}</style>
          <ReportOfficialHeader
            title="ميزان المراجعة (Trial Balance)"
            subtitle={`عن الفترة من ${logic.startDate} إلى ${logic.endDate}`}
            badgeText="تقرير مالي معتمد • FINANCIAL REPORT"
            refLabel="رقم التقرير"
            currency={`${currencyName()} (${currencyCode()})`}
            compact
            details={[
              { label: 'من تاريخ', value: logic.startDate, ltr: true },
              { label: 'إلى تاريخ', value: logic.endDate, ltr: true },
              { label: 'عدد الحسابات', value: String(logic.records.length) },
              { label: 'حالة الميزان', value: isBalanced ? 'متوازن' : 'غير متوازن', accent: !isBalanced },
            ]}
          />

          <table className="print-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '10%', background: '#e2e8f0' }}>رقم الحساب</th>
                <th rowSpan={2} style={{ width: '30%', background: '#e2e8f0' }}>اسم الحساب</th>
                <th colSpan={2} style={{ background: '#f1f5f9' }}>الرصيد الافتتاحي</th>
                <th colSpan={2} style={{ background: '#e2e8f0' }}>حركة الفترة</th>
                <th colSpan={2} style={{ background: '#cbd5e1' }}>الرصيد الختامي</th>
              </tr>
              <tr>
                <th style={{ background: '#f8fafc', color: PRINT_THEME.success }}>مدين</th>
                <th style={{ background: '#f8fafc', color: PRINT_THEME.ruby }}>دائن</th>
                <th style={{ background: '#f1f5f9', color: PRINT_THEME.success }}>مدين</th>
                <th style={{ background: '#f1f5f9', color: PRINT_THEME.ruby }}>دائن</th>
                <th style={{ background: '#e2e8f0', color: PRINT_THEME.success }}>مدين</th>
                <th style={{ background: '#e2e8f0', color: PRINT_THEME.ruby }}>دائن</th>
              </tr>
            </thead>
            <tbody>
              {logic.records.map((r, i) => (
                <tr key={i}>
                  <td className="number">{r.account_code}</td>
                  <td className="text-right">{r.account_name}</td>
                  
                  <td className="number" style={{ color: r.opening_debit > 0 ? PRINT_THEME.success : '#94a3b8' }}>{r.opening_debit > 0 ? formatCurrency(r.opening_debit) : '-'}</td>
                  <td className="number" style={{ color: r.opening_credit > 0 ? PRINT_THEME.ruby : '#94a3b8' }}>{r.opening_credit > 0 ? formatCurrency(r.opening_credit) : '-'}</td>
                  
                  <td className="number" style={{ color: r.period_debit > 0 ? PRINT_THEME.success : '#94a3b8' }}>{r.period_debit > 0 ? formatCurrency(r.period_debit) : '-'}</td>
                  <td className="number" style={{ color: r.period_credit > 0 ? PRINT_THEME.ruby : '#94a3b8' }}>{r.period_credit > 0 ? formatCurrency(r.period_credit) : '-'}</td>
                  
                  <td className="number" style={{ color: r.ending_debit > 0 ? PRINT_THEME.success : '#94a3b8' }}>{r.ending_debit > 0 ? formatCurrency(r.ending_debit) : '-'}</td>
                  <td className="number" style={{ color: r.ending_credit > 0 ? PRINT_THEME.ruby : '#94a3b8' }}>{r.ending_credit > 0 ? formatCurrency(r.ending_credit) : '-'}</td>
                </tr>
              ))}
              <tr className="print-totals" style={{ backgroundColor: isBalanced ? '#cbd5e1' : '#fecaca' }}>
                <td colSpan={2} style={{ textAlign: 'left', paddingLeft: '1.25rem', color: '#000000' }}>الإجمـــالي الكـــلي:</td>
                <td className="number" style={{ color: PRINT_THEME.success }}>{formatCurrency(logic.totals.op_debit)}</td>
                <td className="number" style={{ color: PRINT_THEME.ruby }}>{formatCurrency(logic.totals.op_credit)}</td>
                <td className="number" style={{ color: PRINT_THEME.success }}>{formatCurrency(logic.totals.per_debit)}</td>
                <td className="number" style={{ color: PRINT_THEME.ruby }}>{formatCurrency(logic.totals.per_credit)}</td>
                <td className="number" style={{ color: PRINT_THEME.success }}>{formatCurrency(logic.totals.end_debit)}</td>
                <td className="number" style={{ color: PRINT_THEME.ruby }}>{formatCurrency(logic.totals.end_credit)}</td>
              </tr>
            </tbody>
          </table>

          {/* توقيعات الطباعة */}
          <DocSignatures slots={[
            { title: 'أعدّه', en: 'Accountant' },
            { title: 'اعتمده', en: 'Finance Manager' },
            { title: 'المدير العام', en: 'General Manager' },
          ]} />
      </div>

    </MasterPage>
  );
}