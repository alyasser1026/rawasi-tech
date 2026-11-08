"use client";
import React, { useMemo } from 'react';
import { usePayrollLogic } from './payroll_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiMultiSelect from '@/components/RawasiMultiSelect';
import { tafqeet, formatCurrency } from '@/lib/helpers';
import LoadingScreen from '@/components/LoadingScreen';

const THEME = {
  primary: '#0f172a',    
  accent: '#c2410c',
  success: '#059669',    
  ruby: '#e11d48',       
  slate: '#f8fafc',
  border: '#e2e8f0',
  textMain: '#334155',
  textMuted: '#64748b'
};

export default function PayrollPage() {
  const logic = usePayrollLogic();

  const sidebarActions = useMemo(() => [
    <button 
      key="sync_labor"
      onClick={logic.importLaborLogs} 
      disabled={logic.isSaving || logic.isLoading}
      style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', fontWeight: '900', cursor: logic.isSaving ? 'not-allowed' : 'pointer', width: '100%', opacity: logic.isSaving ? 0.7 : 1, marginBottom: '0.5rem', boxShadow: '0 4px 6px rgba(37,99,235,0.2)' }}
    >
      مزامنة (يوميات، غرامات، مسحوبات)
    </button>,
    
    <button 
      key="print_payroll"
      onClick={() => window.print()}
      style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${THEME.border}`, background: THEME.slate, color: THEME.textMain, fontWeight: 'bold', cursor: 'pointer', width: '100%', marginBottom: '0.5rem' }}
    >
      طباعة المسير الرسمي
    </button>,

    <button 
      key="export_excel"
      onClick={logic.exportToExcel}
      style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${THEME.border}`, background: THEME.slate, color: THEME.textMain, fontWeight: 'bold', cursor: 'pointer', width: '100%', marginBottom: '0.9375rem' }}
    >
      تصدير Excel
    </button>,

    <button 
      key="save_db"
      onClick={logic.savePayrollToDB} 
      disabled={logic.isSaving || logic.isLoading}
      style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', background: THEME.success, color: 'white', fontWeight: 'bold', cursor: logic.isSaving ? 'not-allowed' : 'pointer', width: '100%', opacity: logic.isSaving ? 0.7 : 1, marginBottom: '0.5rem' }}
    >
      {logic.isSaving ? 'جاري الحفظ...' : 'حفظ المسير بالسجلات'}
    </button>,

    <button 
      key="post_journal"
      onClick={logic.postToJournal} 
      disabled={logic.isSaving || logic.isLoading}
      style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', background: THEME.accent, color: 'white', fontWeight: 'bold', cursor: logic.isSaving ? 'not-allowed' : 'pointer', width: '100%', opacity: logic.isSaving ? 0.7 : 1 }}
    >
      ترحيل الرواتب الشهرية المختارة
    </button>,
    <button key="unpost_payroll" onClick={logic.unpostFromJournal} disabled={logic.isSaving || logic.isLoading}
      style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #f59e0b', background: 'white', color: '#92400e', fontWeight: 'bold', width: '100%', marginTop: '0.5rem', cursor: 'pointer' }}>
      فك ترحيل الرواتب الشهرية المختارة
    </button>
  ], [logic.isSaving, logic.isLoading, logic.importLaborLogs, logic.exportToExcel, logic.savePayrollToDB, logic.postToJournal, logic.unpostFromJournal]);

  const columns = useMemo(() => [
    {
      header: 'اسم الكادر / المهنة',
      accessor: 'name',
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ textAlign: 'right', minWidth: '9.375rem' }}>
            <div style={{ fontWeight: '900', color: THEME.primary }}>{row.name}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: THEME.textMuted }}>
               <span style={{ color: row.type === 'عامل يومية' ? THEME.accent : THEME.success, fontWeight: 'bold' }}>{row.type}</span> | {row.job_role || 'بدون مسمى'}
            </div>
          </div>
        );
      }
    },
    {
      header: 'الأساسي',
      accessor: 'base_rate',
      render: (row: any) => {
        if (!row) return null;
        return (
          <input 
            type="number" 
            value={row.base_rate === 0 ? '' : row.base_rate} 
            disabled={row.type !== 'موظف' || row.is_posted}
            onChange={e => logic.updateRecord(row.id, 'base_rate', e.target.value)}
            style={{ width: '4.375rem', textAlign: 'center', border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '0.25rem', fontWeight: 'bold' }}
          />
        );
      }
    },
    {
      header: 'أيام العمل',
      accessor: 'days_worked',
      render: (row: any) => {
        if (!row) return null;
        return (
          <input 
            type="number" 
            readOnly
            value={row.days_worked === 0 ? '' : row.days_worked} 
            onChange={e => logic.updateRecord(row.id, 'days_worked', e.target.value)}
            style={{ width: '3.75rem', textAlign: 'center', border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '0.25rem', fontWeight: 'bold', opacity: row.type !== 'عامل يومية' ? 0.4 : 1 }}
          />
        );
      }
    },
    {
      header: 'بدلات إضافية (+)', // توضيح للمحاسب
      accessor: 'allowances',
      render: (row: any) => {
        if (!row) return null;
        return (
          <input 
            type="number" 
            value={row.allowances === 0 ? '' : row.allowances} 
            disabled={row.type !== 'موظف' || row.is_posted}
            onChange={e => logic.updateRecord(row.id, 'allowances', e.target.value)}
            style={{ width: '4.375rem', textAlign: 'center', color: THEME.success, border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '0.25rem', fontWeight: 'bold' }}
          />
        );
      }
    },
    {
      header: 'خصم غياب (-)', // خصم الغياب الآلي المحسوب من جدول الحضور
      accessor: 'absence_deduction',
      render: (row: any) => {
        if (!row) return null;
        if (row.type !== 'موظف') {
          return <span style={{ color: THEME.textMuted, fontSize: 'var(--fs-xs)' }}>-</span>;
        }
        const deduction = Number(row.absence_deduction || 0);
        const days = Number(row.absence_days || 0);
        return (
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: deduction > 0 ? THEME.ruby : THEME.textMuted, fontWeight: 'bold' }}>
              {deduction > 0 ? `-${deduction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '0'}
            </span>
            {days > 0 && (
              <div style={{ fontSize: '10px', color: THEME.textMuted }}>
                ({days} يوم)
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'غرامات وخصم (-)', // توضيح للمحاسب
      accessor: 'deductions',
      render: (row: any) => {
        if (!row) return null;
        return (
          <input 
            type="number" 
            value={row.deductions === 0 ? '' : row.deductions} 
            readOnly
            title="الجزاءات المرحلة من شاشة الجزاءات"
            onChange={e => logic.updateRecord(row.id, 'deductions', e.target.value)}
            style={{ width: '4.375rem', textAlign: 'center', color: THEME.ruby, border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '0.25rem', fontWeight: 'bold' }}
          />
        );
      }
    },
    {
      header: 'مسحوبات',
      accessor: 'extended_advances',
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ color: row.extended_advances > 0 ? THEME.ruby : THEME.textMuted, fontWeight: '900', background: row.extended_advances > 0 ? '#fff1f2' : 'transparent', padding: '0.25rem', borderRadius: '4px', textAlign: 'center' }}>
            {formatCurrency(row.extended_advances)}
          </div>
        );
      }
    },
    {
      header: 'رصيد سابق',
      accessor: 'previous_balance',
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ fontWeight: 'bold', color: row.previous_balance > 0 ? THEME.primary : THEME.textMuted, textAlign: 'center' }}>
            {formatCurrency(row.previous_balance)}
          </div>
        );
      }
    },
    {
      header: 'الصافي النهائي',
      accessor: 'net_salary',
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ fontWeight: '900', color: 'var(--text-primary, #1e293b)', fontSize: 'var(--fs-md)', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken)', padding: '0.25rem 0.5rem', borderRadius: '8px', textAlign: 'center' }}>
            {formatCurrency(row.net_salary)}
          </div>
        );
      }
    },
    {
      header: 'المبلغ للصرف (-)', // توضيح إن دي الخصم من الرصيد
      accessor: 'amount_to_pay',
      render: (row: any) => {
        if (!row) return null;
        return (
          <input 
            type="number" 
            placeholder="0"
            value={row.amount_to_pay === 0 ? '' : row.amount_to_pay} 
            disabled={row.type !== 'موظف' || row.is_posted}
            onChange={e => logic.updateRecord(row.id, 'amount_to_pay', e.target.value)}
            style={{ width: '5.3125rem', textAlign: 'center', color: 'var(--status-positive, #059669)', border: 'none', borderRadius: '8px', padding: '0.35rem 0.5rem', fontWeight: '900', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken)' }}
          />
        );
      }
    },
    {
      header: 'المتبقي',
      id: 'remaining',
      render: (row: any) => {
        if (!row) return null;
        const remaining = Number(row.net_salary || 0) - Number(row.amount_to_pay || 0);
        return (
          <div style={{ fontWeight: '900', color: remaining > 0 ? THEME.ruby : THEME.success, textAlign: 'center' }}>
            {formatCurrency(remaining)}
          </div>
        );
      }
    },
    {
      header: 'حالة الدفع',
      accessor: 'status',
      render: (row: any) => {
        if (!row) return null;
        return (
          <select 
             value={row.status || 'غير مدفوع'} 
             disabled={row.type !== 'موظف' || row.is_posted}
             onChange={e => logic.updateRecord(row.id, 'status', e.target.value)}
             style={{ border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '0.25rem', fontWeight: 'bold', color: row.status === 'مدفوع' ? THEME.success : THEME.textMuted }}
          >
             <option value="غير مدفوع">غير مدفوع</option>
             <option value="مدفوع">مدفوع</option>
          </select>
        );
      }
    }
  ], [logic]);

  if (logic.isLoading) {
    return (
      <MasterPage title="مسير الرواتب والأجور">
        <LoadingScreen message="جاري تهيئة مسير الرواتب وحساب الأرصدة المتأخرة..." fullScreen={false} />
      </MasterPage>
    );
  }

  return (
    <MasterPage 
      title="مسير الرواتب والأجور"
      description={`إدارة ومراجعة رواتب ويوميات الكوادر واعتمادها المالي - شهر (${logic.selectedMonth} / ${logic.selectedYear})`}
    >
      <p className="no-print" style={{ color: THEME.textMuted, marginBottom: '0.75rem', lineHeight: 1.8 }}>
        الحفظ والترحيل للموظفين الشهريين ضمن الصفوف المعروضة فقط. اليوميات والسلف والجزاءات تُرحّل من شاشاتها وتظهر هنا للمراجعة.
      </p>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; width: 100%; direction: rtl; font-family: 'Cairo', sans-serif; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; text-align: center; }
          .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 6px 3px; }
          .print-table th { background-color: ${THEME.primary} !important; color: white !important; font-weight: 900; }
          .print-table tr:nth-child(even) { background-color: #f8fafc !important; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>

      <div style={{ display: 'flex', gap: '1.25rem' }} className="no-print">
        
        <div style={{ flex: 1, overflowX: 'auto' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9375rem', alignItems: 'center', background: 'var(--surface-card, #ffffff)', padding: '1.25rem', borderRadius: 'var(--phi-radius-card, 18px)', marginBottom: '1.25rem', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
            <div style={{ fontWeight: '900', color: 'var(--text-primary, #1e293b)', fontSize: 'var(--fs-lg)', minWidth: '8.125rem' }}>خيارات المسير:</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken)', padding: '0.45rem 0.9375rem', borderRadius: '12px' }}>
              <label style={{ fontSize: 'var(--fs-sm)', color: THEME.textMuted, fontWeight: 'bold' }}>تاريخ قطع المسحوبات:</label>
              <input 
                type="date" 
                value={logic.cutoffDate} 
                onChange={e => logic.setCutoffDate(e.target.value)} 
                style={{ padding: '0.375rem 0.625rem', borderRadius: '8px', border: 'none', background: 'transparent', fontWeight: 'bold', outline: 'none', color: 'var(--accent-ink, #c2410c)' }}
              />
            </div>

            <button
              type="button"
              onClick={() => logic.setFilterActiveOnly(!logic.filterActiveOnly)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: logic.filterActiveOnly ? 'var(--status-positive, #059669)' : 'var(--surface-sunken, #f8fafc)',
                color: logic.filterActiveOnly ? 'white' : 'var(--text-primary, #1e293b)',
                boxShadow: 'var(--shadow-elevation)',
              }}
            >
              {logic.filterActiveOnly ? 'عرض العمال النشطين فقط' : 'فلترة العمال النشطين (الذين عملوا)'}
            </button>

            <div style={{ flex: 1, minWidth: '18.75rem' }}>
              <RawasiMultiSelect 
                options={logic.employees} 
                selectedIds={logic.selectedEmployeeIds} 
                onChange={logic.setSelectedEmployeeIds} 
                placeholder="اضغط لاختيار موظفين محددين لعرضهم بالمسير..."
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.375rem, 1fr))', gap: '0.9375rem', marginBottom: '1.5625rem' }}>
            <div className="ent-summary-card" style={{ border: 'none', borderRadius: 'var(--phi-radius-card, 18px)', background: 'var(--surface-card, #ffffff)', boxShadow: 'var(--shadow-ambient)' }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary, #64748b)', fontWeight: 'bold' }}>الكوادر المعروضة</div>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: '900', color: 'var(--text-primary, #1e293b)' }}>{logic.filteredRecords.length}</div>
            </div>
            <div className="ent-summary-card" style={{ border: 'none', borderRadius: 'var(--phi-radius-card, 18px)', background: 'var(--surface-card, #ffffff)', boxShadow: 'var(--shadow-ambient)' }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary, #64748b)', fontWeight: 'bold' }}>إجمالي الاستحقاقات (الأساسي)</div>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: '900', color: 'var(--text-primary, #1e293b)' }}>{formatCurrency(logic.totals.current_net + logic.totals.deductions + logic.totals.extended_advances)}</div>
            </div>
            <div className="ent-summary-card" style={{ border: 'none', borderRadius: 'var(--phi-radius-card, 18px)', background: 'var(--surface-card, #ffffff)', boxShadow: 'var(--shadow-ambient)' }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary, #64748b)', fontWeight: 'bold' }}>إجمالي الخصم والمسحوبات</div>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: '900', color: 'var(--status-negative, #ef4444)' }}>{formatCurrency(logic.totals.deductions + logic.totals.extended_advances)}</div>
            </div>
            <div className="ent-summary-card ent-payroll-total" style={{ border: 'none', borderRadius: 'var(--phi-radius-card, 18px)', background: 'var(--surface-card, #ffffff)', boxShadow: 'var(--shadow-ambient)' }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-ink, #c2410c)', fontWeight: 'bold' }}>إجمالي المراد صرفه فعلياً</div>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: '900', color: 'var(--accent-ink, #c2410c)' }}>{formatCurrency(logic.totals.amount_to_pay || 0)}</div>
            </div>
          </div>

          <input type="search" placeholder="ابحث باسم الموظف أو المهنة..." value={logic.globalSearch}
            onChange={e => logic.setGlobalSearch(e.target.value)} aria-label="البحث في المسير"
            style={{ padding: '0.625rem 0.9375rem', width: '100%', marginBottom: '1.25rem', border: 'none', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken)', borderRadius: '12px', height: '2.75rem', fontWeight: 700, color: 'var(--text-primary)', outline: 'none' }} />
          <RawasiSmartTable 
            data={logic.filteredRecords} 
            columns={columns} 
          />
        </div>

        <RawasiSidebarManager actions={sidebarActions}
          watchDeps={[logic.isSaving, logic.isLoading, logic.selectedMonth, logic.selectedYear, logic.cutoffDate, logic.filteredRecords]} />
        
      </div>

      <div className="print-area" style={{ display: 'none' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `4px solid ${THEME.primary}`, paddingBottom: '1.25rem', marginBottom: '1.5625rem' }}>
            <div>
               
               <p style={{ margin: '0.5rem 0 0 0', fontWeight: 700, fontSize: 'var(--fs-md)', color: THEME.textMuted }}>شركة فاي تك للمقاولات | عن شهر ({logic.selectedMonth} / {logic.selectedYear})</p>
               <p style={{ margin: '0.25rem 0 0 0', fontWeight: 600, fontSize: 'var(--fs-sm)', color: THEME.ruby }}>تاريخ القطع للمسحوبات: {logic.cutoffDate}</p>
            </div>
            <img src="/company-logo.svg" alt="Company Logo" style={{ height: '3.75rem', objectFit: 'contain' }} />
         </div>

         <table className="print-table">
            <thead>
               <tr>
                  <th style={{width: '1.875rem'}}>م</th>
                  <th style={{width: '20%'}}>اسم الموظف / العامل</th>
                  <th>الأساسي</th>
                  <th>البدلات</th>
                  <th>خصم غياب</th>
                  <th>غرامات</th>
                  <th>مسحوبات</th>
                  <th>رصيد سابق</th>
                  <th>الصافي النهائي</th>
                  <th style={{color: THEME.accent}}>المبلغ للصرف</th>
                  <th style={{color: THEME.ruby}}>المتبقي</th>
                  <th style={{width: '5.625rem'}}>توقيع المستلم</th>
               </tr>
            </thead>
            <tbody>
               {logic.filteredRecords.map((r, i) => (
                  <tr key={r.id}>
                     <td style={{fontWeight: 900}}>{i + 1}</td>
                     <td style={{ fontWeight: 900, textAlign: 'right' }}>{r.name} <br/><span style={{fontSize:'var(--fs-xs)', color: '#555'}}>{r.job_role}</span></td>
                     <td style={{fontWeight: 700}}>{formatCurrency(r.base_rate)}</td>
                     <td style={{fontWeight: 700}}>{formatCurrency(r.allowances)}</td>
                     <td style={{fontWeight: 700, color: (r.absence_deduction || 0) > 0 ? THEME.ruby : 'inherit'}}>{formatCurrency(r.absence_deduction || 0)}</td>
                     <td style={{fontWeight: 700}}>{formatCurrency(r.deductions)}</td>
                     <td style={{fontWeight: 700, color: r.extended_advances > 0 ? THEME.ruby : 'inherit'}}>{formatCurrency(r.extended_advances)}</td>
                     <td style={{fontWeight: 700}}>{formatCurrency(r.previous_balance)}</td>
                     <td style={{fontWeight: 900}}>{formatCurrency(r.net_salary)}</td>
                     <td style={{fontWeight: 900, fontSize: 'var(--fs-sm)', color: THEME.success}}>{formatCurrency(r.amount_to_pay || 0)}</td>
                     <td style={{fontWeight: 900, fontSize: 'var(--fs-sm)', color: THEME.ruby}}>{formatCurrency(Number(r.net_salary || 0) - Number(r.amount_to_pay || 0))}</td>
                     <td></td>
                  </tr>
               ))}
               <tr style={{ background: THEME.primary, color: 'white', fontWeight: 900, fontSize: 'var(--fs-sm)' }}>
                   <td colSpan={2} style={{ textAlign: 'left', paddingLeft: '1.25rem' }}>الإجمـــــالي الكــــلي:</td>
                   <td>{formatCurrency(logic.totals.current_net + logic.totals.deductions + logic.totals.extended_advances - logic.totals.allowances)}</td>
                   <td>{formatCurrency(logic.totals.allowances)}</td>
                   <td>{formatCurrency(logic.totals.deductions)}</td>
                   <td>{formatCurrency(logic.totals.extended_advances)}</td>
                   <td>{formatCurrency(logic.totals.previous_balances)}</td>
                   <td style={{ fontSize: 'var(--fs-sm)' }}>{formatCurrency(logic.totals.net)}</td>
                   <td style={{ fontSize: 'var(--fs-sm)', color: THEME.accent }}>{formatCurrency(logic.totals.amount_to_pay || 0)}</td>
                   <td style={{ fontSize: 'var(--fs-sm)', color: '#fca5a5' }}>{formatCurrency(logic.totals.net - (logic.totals.amount_to_pay || 0))}</td>
                   <td></td>
               </tr>
            </tbody>
         </table>

         <div style={{ marginTop: '1.25rem', fontSize: 'var(--fs-sm)', fontWeight: 800, background: THEME.slate, padding: '0.75rem', borderRadius: '6px', border: `1px solid ${THEME.border}` }}>
             إجمالي المبالغ المراد صرفها بالحروف: فقط ( {tafqeet(logic.totals.amount_to_pay || 0)} ريال سعودي ) لا غير.
         </div>

         <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3.75rem', fontSize: 'var(--fs-md)', fontWeight: 800, padding: '0 2.5rem' }}>
             <div style={{textAlign: 'center', width: '12.5rem'}}>أعده / محاسب الرواتب<br/><br/><hr style={{borderTop: '2px dashed #94a3b8', margin: '1.875rem 0 0.625rem 0'}}/>الاسم والتوقيع</div>
             <div style={{textAlign: 'center', width: '12.5rem'}}>راجعه / مدير الموارد البشرية<br/><br/><hr style={{borderTop: '2px dashed #94a3b8', margin: '1.875rem 0 0.625rem 0'}}/>الاسم والتوقيع</div>
             <div style={{textAlign: 'center', width: '12.5rem'}}>اعتمده / المدير المالي<br/><br/><hr style={{borderTop: '2px dashed #94a3b8', margin: '1.875rem 0 0.625rem 0'}}/>الاسم والتوقيع</div>
         </div>
      </div>
    </MasterPage>
  );
}
