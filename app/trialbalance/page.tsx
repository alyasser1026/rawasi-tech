"use client";
import React, { useMemo } from 'react';
import { useTrialBalanceLogic } from './trial_balance_logic';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { formatCurrency } from '@/lib/helpers';

const THEME = {
  primary: '#0f172a',    
  accent: '#c2410c',
  success: '#059669',    // اللون الأخضر للمدين
  ruby: '#e11d48',       // اللون الأحمر للدائن
  slate: '#f8fafc',
  border: '#e2e8f0',
  textMain: '#000000',   
  textMuted: '#64748b'
};

export default function TrialBalancePage() {
  const logic = useTrialBalanceLogic();

  // 🚀 الحل السحري لمشكلة الجافاسكريبت: نتجاهل الكسور الوهمية اللي أقل من هللة/قرش
  const isBalanced = Math.abs((logic.totals.end_debit || 0) - (logic.totals.end_credit || 0)) < 0.01;

  const sidebarActions = useMemo(() => [
    <button 
      key="print_tb"
      onClick={() => window.print()}
      style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`, background: THEME.slate, color: THEME.textMain, fontWeight: '900', cursor: 'pointer', width: '100%', marginBottom: '8px' }}
    >
      🖨️ طباعة الميزان الرسمي
    </button>,

    <button 
      key="export_excel"
      onClick={logic.exportToExcel}
      style={{ padding: '12px', borderRadius: '8px', border: 'none', background: THEME.success, color: '#ffffff', fontWeight: '900', cursor: 'pointer', width: '100%' }}
    >
      📊 تصدير Excel
    </button>
  ], [logic.exportToExcel]);

  return (
    <MasterPage icon="⚖️" 
      title="ميزان المراجعة (Trial Balance)" 
      description="عرض الأرصدة الافتتاحية، حركات الفترة، والأرصدة الختامية لجميع الحسابات"
    >
      <style>{`
        /* تنسيقات الشاشة الأساسية */
        .tb-table { width: 100%; border-collapse: collapse; text-align: center; background: #ffffff; }
        .tb-table th, .tb-table td { border: 1px solid #cbd5e1; padding: 10px 8px; font-size: 14px; }
        
        .tb-table thead th { color: #000000 !important; font-weight: 900; }
        .tb-table tbody td { color: #000000; } 
        .tb-table tbody tr:hover { background-color: #f1f5f9; }
        .tb-table tbody td.text-right { text-align: right; font-weight: 900; }
        .tb-table tbody td.number { font-family: monospace; font-size: 13px; font-weight: 900; }
        
        .tb-totals { font-weight: 900 !important; }
        .tb-totals td { border-top: 3px double #94a3b8 !important; font-size: 15px; }

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

      <div style={{ display: 'flex', gap: '20px' }} className="no-print">
        
        {/* منطقة المحتوى الرئيسي */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          
          {/* لوحة الفلاتر */}
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: '#ffffff', padding: '15px 20px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${THEME.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ fontWeight: '900', color: THEME.primary, fontSize: '15px', minWidth: '100px' }}>📅 فترة الميزان:</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: THEME.slate, padding: '5px 15px', borderRadius: '8px' }}>
              <label style={{ fontSize: '13px', color: THEME.textMain, fontWeight: '900' }}>من:</label>
              <input 
                type="date" 
                value={logic.startDate} 
                onChange={e => logic.setStartDate(e.target.value)} 
                style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontWeight: '900', outline: 'none', color: '#000000', backgroundColor: '#ffffff' }} 
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: THEME.slate, padding: '5px 15px', borderRadius: '8px' }}>
              <label style={{ fontSize: '13px', color: THEME.textMain, fontWeight: '900' }}>إلى:</label>
              <input 
                type="date" 
                value={logic.endDate} 
                onChange={e => logic.setEndDate(e.target.value)} 
                style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontWeight: '900', outline: 'none', color: '#000000', backgroundColor: '#ffffff' }} 
              />
            </div>
          </div>

          {/* الجدول والشاشة */}
          {logic.isLoading ? (
            <LoadingScreen message="جاري إعداد ميزان المراجعة وتجميع القيود..." fullScreen={false} />
          ) : (
            <>
              <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${THEME.border}` }}>
                <table className="tb-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ width: '10%', background: '#e2e8f0' }}>رقم الحساب</th>
                      <th rowSpan={2} style={{ width: '30%', background: '#e2e8f0' }}>اسم الحساب</th>
                      <th colSpan={2} style={{ background: '#f1f5f9' }}>الرصيد الافتتاحي</th>
                      <th colSpan={2} style={{ background: '#e2e8f0' }}>حركة الفترة</th>
                      <th colSpan={2} style={{ background: '#cbd5e1' }}>الرصيد الختامي</th>
                    </tr>
                    <tr>
                      <th style={{ background: '#f8fafc', color: THEME.success }}>مدين</th>
                      <th style={{ background: '#f8fafc', color: THEME.ruby }}>دائن</th>
                      <th style={{ background: '#f1f5f9', color: THEME.success }}>مدين</th>
                      <th style={{ background: '#f1f5f9', color: THEME.ruby }}>دائن</th>
                      <th style={{ background: '#e2e8f0', color: THEME.success }}>مدين</th>
                      <th style={{ background: '#e2e8f0', color: THEME.ruby }}>دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logic.records.map((r, i) => (
                      <tr key={i}>
                        <td className="number">{r.account_code}</td>
                        <td className="text-right">{r.account_name}</td>
                        
                        <td className="number" style={{ color: r.opening_debit > 0 ? THEME.success : '#94a3b8' }}>{r.opening_debit > 0 ? formatCurrency(r.opening_debit) : '-'}</td>
                        <td className="number" style={{ color: r.opening_credit > 0 ? THEME.ruby : '#94a3b8' }}>{r.opening_credit > 0 ? formatCurrency(r.opening_credit) : '-'}</td>
                        
                        <td className="number" style={{ color: r.period_debit > 0 ? THEME.success : '#94a3b8', background: '#f8fafc' }}>{r.period_debit > 0 ? formatCurrency(r.period_debit) : '-'}</td>
                        <td className="number" style={{ color: r.period_credit > 0 ? THEME.ruby : '#94a3b8', background: '#f8fafc' }}>{r.period_credit > 0 ? formatCurrency(r.period_credit) : '-'}</td>
                        
                        <td className="number" style={{ color: r.ending_debit > 0 ? THEME.success : '#94a3b8' }}>{r.ending_debit > 0 ? formatCurrency(r.ending_debit) : '-'}</td>
                        <td className="number" style={{ color: r.ending_credit > 0 ? THEME.ruby : '#94a3b8' }}>{r.ending_credit > 0 ? formatCurrency(r.ending_credit) : '-'}</td>
                      </tr>
                    ))}
                    
                    {/* صف الإجماليات */}
                    <tr className="tb-totals" style={{ backgroundColor: isBalanced ? '#e2e8f0' : '#fee2e2' }}>
                      <td colSpan={2} style={{ textAlign: 'left', paddingLeft: '20px', color: '#000000' }}>الإجمـــالي الكـــلي:</td>
                      <td className="number" style={{ color: THEME.success }}>{formatCurrency(logic.totals.op_debit)}</td>
                      <td className="number" style={{ color: THEME.ruby }}>{formatCurrency(logic.totals.op_credit)}</td>
                      <td className="number" style={{ color: THEME.success }}>{formatCurrency(logic.totals.per_debit)}</td>
                      <td className="number" style={{ color: THEME.ruby }}>{formatCurrency(logic.totals.per_credit)}</td>
                      <td className="number" style={{ color: THEME.success }}>{formatCurrency(logic.totals.end_debit)}</td>
                      <td className="number" style={{ color: THEME.ruby }}>{formatCurrency(logic.totals.end_credit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* مؤشر اتزان الميزان */}
              <div style={{ marginTop: '15px', display: 'flex', gap: '20px' }}>
                  <div style={{ flex: 1, padding: '15px', borderRadius: '8px', background: isBalanced ? '#ecfdf5' : '#fff1f2', border: `2px solid ${isBalanced ? THEME.success : THEME.ruby}`, display: 'flex', justifyContent: 'space-between', fontWeight: '900' }}>
                    <span style={{ color: isBalanced ? THEME.success : THEME.ruby }}>
                      {isBalanced ? '✅ الميزان متزن تماماً (لا توجد فروق)' : '❌ يوجد فرق في الميزان! يرجى مراجعة قيود اليومية.'}
                    </span>
                    {!isBalanced && (
                      <span style={{ color: THEME.ruby, fontSize: '16px' }}>قيمة الفرق: {formatCurrency(Math.abs(logic.totals.end_debit - logic.totals.end_credit))}</span>
                    )}
                  </div>
              </div>
            </>
          )}
        </div>

        <RawasiSidebarManager actions={sidebarActions} />
      </div>

      {/* مساحة الطباعة */}
      <div className="print-area" style={{ display: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `4px solid ${THEME.primary}`, paddingBottom: '15px', marginBottom: '20px' }}>
            <div>
                
                <p style={{ margin: '8px 0 0 0', fontWeight: 700, fontSize: '14px', color: '#000000' }}>شركة فاي تك للمقاولات</p>
                <p style={{ margin: '4px 0 0 0', fontWeight: 900, fontSize: '13px', color: '#000000' }}>عن الفترة من {logic.startDate} إلى {logic.endDate}</p>
            </div>
            <img src="/company-logo.svg" alt="Company Logo" style={{ height: '50px', objectFit: 'contain' }} />
          </div>

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
                <th style={{ background: '#f8fafc', color: THEME.success }}>مدين</th>
                <th style={{ background: '#f8fafc', color: THEME.ruby }}>دائن</th>
                <th style={{ background: '#f1f5f9', color: THEME.success }}>مدين</th>
                <th style={{ background: '#f1f5f9', color: THEME.ruby }}>دائن</th>
                <th style={{ background: '#e2e8f0', color: THEME.success }}>مدين</th>
                <th style={{ background: '#e2e8f0', color: THEME.ruby }}>دائن</th>
              </tr>
            </thead>
            <tbody>
              {logic.records.map((r, i) => (
                <tr key={i}>
                  <td className="number">{r.account_code}</td>
                  <td className="text-right">{r.account_name}</td>
                  
                  <td className="number" style={{ color: r.opening_debit > 0 ? THEME.success : '#94a3b8' }}>{r.opening_debit > 0 ? formatCurrency(r.opening_debit) : '-'}</td>
                  <td className="number" style={{ color: r.opening_credit > 0 ? THEME.ruby : '#94a3b8' }}>{r.opening_credit > 0 ? formatCurrency(r.opening_credit) : '-'}</td>
                  
                  <td className="number" style={{ color: r.period_debit > 0 ? THEME.success : '#94a3b8' }}>{r.period_debit > 0 ? formatCurrency(r.period_debit) : '-'}</td>
                  <td className="number" style={{ color: r.period_credit > 0 ? THEME.ruby : '#94a3b8' }}>{r.period_credit > 0 ? formatCurrency(r.period_credit) : '-'}</td>
                  
                  <td className="number" style={{ color: r.ending_debit > 0 ? THEME.success : '#94a3b8' }}>{r.ending_debit > 0 ? formatCurrency(r.ending_debit) : '-'}</td>
                  <td className="number" style={{ color: r.ending_credit > 0 ? THEME.ruby : '#94a3b8' }}>{r.ending_credit > 0 ? formatCurrency(r.ending_credit) : '-'}</td>
                </tr>
              ))}
              <tr className="print-totals" style={{ backgroundColor: isBalanced ? '#cbd5e1' : '#fecaca' }}>
                <td colSpan={2} style={{ textAlign: 'left', paddingLeft: '20px', color: '#000000' }}>الإجمـــالي الكـــلي:</td>
                <td className="number" style={{ color: THEME.success }}>{formatCurrency(logic.totals.op_debit)}</td>
                <td className="number" style={{ color: THEME.ruby }}>{formatCurrency(logic.totals.op_credit)}</td>
                <td className="number" style={{ color: THEME.success }}>{formatCurrency(logic.totals.per_debit)}</td>
                <td className="number" style={{ color: THEME.ruby }}>{formatCurrency(logic.totals.per_credit)}</td>
                <td className="number" style={{ color: THEME.success }}>{formatCurrency(logic.totals.end_debit)}</td>
                <td className="number" style={{ color: THEME.ruby }}>{formatCurrency(logic.totals.end_credit)}</td>
              </tr>
            </tbody>
          </table>

          {/* توقيعات الطباعة */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', fontSize: '14px', fontWeight: 900, padding: '0 40px', color: '#000000' }}>
              <div style={{textAlign: 'center', width: '200px'}}>أعده / المحاسب المالي<br/><br/><hr style={{borderTop: '2px dashed #000000', margin: '30px 0 10px 0'}}/>الاسم والتوقيع</div>
              <div style={{textAlign: 'center', width: '200px'}}>اعتمده / المدير المالي<br/><br/><hr style={{borderTop: '2px dashed #000000', margin: '30px 0 10px 0'}}/>الاسم والتوقيع</div>
              <div style={{textAlign: 'center', width: '200px'}}>المدير العام<br/><br/><hr style={{borderTop: '2px dashed #000000', margin: '30px 0 10px 0'}}/>الاسم والتوقيع</div>
          </div>
      </div>

    </MasterPage>
  );
}