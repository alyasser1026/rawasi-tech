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
      style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', fontWeight: '900', cursor: logic.isSaving ? 'not-allowed' : 'pointer', width: '100%', opacity: logic.isSaving ? 0.7 : 1, marginBottom: '8px', boxShadow: '0 4px 6px rgba(37,99,235,0.2)' }}
    >
      مزامنة (يوميات، غرامات، مسحوبات)
    </button>,
    
    <button 
      key="print_payroll"
      onClick={() => window.print()}
      style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`, background: THEME.slate, color: THEME.textMain, fontWeight: 'bold', cursor: 'pointer', width: '100%', marginBottom: '8px' }}
    >
      طباعة المسير الرسمي
    </button>,

    <button 
      key="export_excel"
      onClick={logic.exportToExcel}
      style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`, background: THEME.slate, color: THEME.textMain, fontWeight: 'bold', cursor: 'pointer', width: '100%', marginBottom: '15px' }}
    >
      تصدير Excel
    </button>,

    <button 
      key="save_db"
      onClick={logic.savePayrollToDB} 
      disabled={logic.isSaving || logic.isLoading}
      style={{ padding: '12px', borderRadius: '8px', border: 'none', background: THEME.success, color: 'white', fontWeight: 'bold', cursor: logic.isSaving ? 'not-allowed' : 'pointer', width: '100%', opacity: logic.isSaving ? 0.7 : 1, marginBottom: '8px' }}
    >
      {logic.isSaving ? 'جاري الحفظ...' : 'حفظ المسير بالسجلات'}
    </button>,

    <button 
      key="post_journal"
      onClick={logic.postToJournal} 
      disabled={logic.isSaving || logic.isLoading}
      style={{ padding: '12px', borderRadius: '8px', border: 'none', background: THEME.accent, color: 'white', fontWeight: 'bold', cursor: logic.isSaving ? 'not-allowed' : 'pointer', width: '100%', opacity: logic.isSaving ? 0.7 : 1 }}
    >
      ترحيل الرواتب الشهرية المختارة
    </button>,
    <button key="unpost_payroll" onClick={logic.unpostFromJournal} disabled={logic.isSaving || logic.isLoading}
      style={{ padding: '12px', borderRadius: '8px', border: '1px solid #f59e0b', background: 'white', color: '#92400e', fontWeight: 'bold', width: '100%', marginTop: '8px', cursor: 'pointer' }}>
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
          <div style={{ textAlign: 'right', minWidth: '150px' }}>
            <div style={{ fontWeight: '900', color: THEME.primary }}>{row.name}</div>
            <div style={{ fontSize: '11px', color: THEME.textMuted }}>
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
            style={{ width: '70px', textAlign: 'center', border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '4px', fontWeight: 'bold' }}
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
            style={{ width: '60px', textAlign: 'center', border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '4px', fontWeight: 'bold', opacity: row.type !== 'عامل يومية' ? 0.4 : 1 }}
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
            style={{ width: '70px', textAlign: 'center', color: THEME.success, border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '4px', fontWeight: 'bold' }}
          />
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
            style={{ width: '70px', textAlign: 'center', color: THEME.ruby, border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '4px', fontWeight: 'bold' }}
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
          <div style={{ color: row.extended_advances > 0 ? THEME.ruby : THEME.textMuted, fontWeight: '900', background: row.extended_advances > 0 ? '#fff1f2' : 'transparent', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
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
          <div style={{ fontWeight: '900', color: 'white', fontSize: '14px', background: THEME.primary, padding: '4px 8px', borderRadius: '6px', textAlign: 'center' }}>
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
            style={{ width: '85px', textAlign: 'center', color: THEME.success, border: `2px solid ${THEME.success}`, borderRadius: '6px', padding: '4px', fontWeight: '900', background: '#ecfdf5' }}
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
             style={{ border: `1px solid ${THEME.border}`, borderRadius: '6px', padding: '4px', fontWeight: 'bold', color: row.status === 'مدفوع' ? THEME.success : THEME.textMuted }}
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
      <p className="no-print" style={{ color: THEME.textMuted, marginBottom: '12px', lineHeight: 1.8 }}>
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

      <div style={{ display: 'flex', gap: '20px' }} className="no-print">
        
        <div style={{ flex: 1, overflowX: 'auto' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', background: 'white', padding: '15px 20px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${THEME.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ fontWeight: '900', color: THEME.primary, fontSize: '15px', minWidth: '130px' }}>خيارات المسير:</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: THEME.slate, padding: '5px 15px', borderRadius: '8px' }}>
              <label style={{ fontSize: '13px', color: THEME.textMuted, fontWeight: 'bold' }}>تاريخ قطع المسحوبات:</label>
              <input 
                type="date" 
                value={logic.cutoffDate} 
                onChange={e => logic.setCutoffDate(e.target.value)} 
                style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontWeight: 'bold', outline: 'none', color: THEME.ruby }}
              />
            </div>

            <button
              type="button"
              onClick={() => logic.setFilterActiveOnly(!logic.filterActiveOnly)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: `1px solid ${logic.filterActiveOnly ? THEME.success : THEME.border}`,
                background: logic.filterActiveOnly ? THEME.success : 'white',
                color: logic.filterActiveOnly ? 'white' : THEME.textMain,
                fontWeight: '900',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: logic.filterActiveOnly ? '0 2px 4px rgba(5,150,105,0.2)' : 'none'
              }}
            >
              {logic.filterActiveOnly ? 'عرض العمال النشطين فقط' : 'فلترة العمال النشطين (الذين عملوا)'}
            </button>

            <div style={{ flex: 1, minWidth: '300px' }}>
              <RawasiMultiSelect 
                options={logic.employees} 
                selectedIds={logic.selectedEmployeeIds} 
                onChange={logic.setSelectedEmployeeIds} 
                placeholder="اضغط لاختيار موظفين محددين لعرضهم بالمسير..."
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <div className="ent-summary-card" style={{ borderBottom: `4px solid ${THEME.primary}` }}>
              <div style={{ fontSize: '13px', color: THEME.textMuted, fontWeight: 'bold' }}>الكوادر المعروضة</div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: THEME.primary }}>{logic.filteredRecords.length}</div>
            </div>
            <div className="ent-summary-card" style={{ borderBottom: `4px solid ${THEME.primary}` }}>
              <div style={{ fontSize: '13px', color: THEME.textMuted, fontWeight: 'bold' }}>إجمالي الاستحقاقات (الأساسي)</div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: THEME.primary }}>{formatCurrency(logic.totals.current_net + logic.totals.deductions + logic.totals.extended_advances)}</div>
            </div>
            <div className="ent-summary-card" style={{ borderBottom: `4px solid ${THEME.ruby}` }}>
              <div style={{ fontSize: '13px', color: THEME.textMuted, fontWeight: 'bold' }}>إجمالي الخصم والمسحوبات</div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: THEME.ruby }}>{formatCurrency(logic.totals.deductions + logic.totals.extended_advances)}</div>
            </div>
            <div className="ent-summary-card ent-payroll-total" style={{ borderBottom: `4px solid ${THEME.accent}` }}>
              <div style={{ fontSize: '13px', color: '#047857', fontWeight: 'bold' }}>إجمالي المراد صرفه فعلياً</div>
              <div style={{ fontSize: '24px', fontWeight: '900' }}>{formatCurrency(logic.totals.amount_to_pay || 0)}</div>
            </div>
          </div>

          <input type="search" placeholder="ابحث باسم الموظف أو المهنة..." value={logic.globalSearch}
            onChange={e => logic.setGlobalSearch(e.target.value)} aria-label="البحث في المسير"
            style={{ padding: '10px', width: '100%', marginBottom: '12px', border: `1px solid ${THEME.border}`, borderRadius: '8px' }} />
          <RawasiSmartTable 
            data={logic.filteredRecords} 
            columns={columns} 
          />
        </div>

        <RawasiSidebarManager actions={sidebarActions}
          watchDeps={[logic.isSaving, logic.isLoading, logic.selectedMonth, logic.selectedYear, logic.cutoffDate, logic.filteredRecords]} />
        
      </div>

      <div className="print-area" style={{ display: 'none' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `4px solid ${THEME.primary}`, paddingBottom: '20px', marginBottom: '25px' }}>
            <div>
               
               <p style={{ margin: '8px 0 0 0', fontWeight: 700, fontSize: '14px', color: THEME.textMuted }}>شركة فاي تك للمقاولات | عن شهر ({logic.selectedMonth} / {logic.selectedYear})</p>
               <p style={{ margin: '4px 0 0 0', fontWeight: 600, fontSize: '12px', color: THEME.ruby }}>تاريخ القطع للمسحوبات: {logic.cutoffDate}</p>
            </div>
            <img src="/company-logo.svg" alt="Company Logo" style={{ height: '60px', objectFit: 'contain' }} />
         </div>

         <table className="print-table">
            <thead>
               <tr>
                  <th style={{width: '30px'}}>م</th>
                  <th style={{width: '20%'}}>اسم الموظف / العامل</th>
                  <th>الأساسي</th>
                  <th>البدلات</th>
                  <th>غرامات</th>
                  <th>مسحوبات</th>
                  <th>رصيد سابق</th>
                  <th>الصافي النهائي</th>
                  <th style={{color: THEME.accent}}>المبلغ للصرف</th>
                  <th style={{color: THEME.ruby}}>المتبقي</th>
                  <th style={{width: '90px'}}>توقيع المستلم</th>
               </tr>
            </thead>
            <tbody>
               {logic.filteredRecords.map((r, i) => (
                  <tr key={r.id}>
                     <td style={{fontWeight: 900}}>{i + 1}</td>
                     <td style={{ fontWeight: 900, textAlign: 'right' }}>{r.name} <br/><span style={{fontSize:'10px', color: '#555'}}>{r.job_role}</span></td>
                     <td style={{fontWeight: 700}}>{formatCurrency(r.base_rate)}</td>
                     <td style={{fontWeight: 700}}>{formatCurrency(r.allowances)}</td>
                     <td style={{fontWeight: 700}}>{formatCurrency(r.deductions)}</td>
                     <td style={{fontWeight: 700, color: r.extended_advances > 0 ? THEME.ruby : 'inherit'}}>{formatCurrency(r.extended_advances)}</td>
                     <td style={{fontWeight: 700}}>{formatCurrency(r.previous_balance)}</td>
                     <td style={{fontWeight: 900}}>{formatCurrency(r.net_salary)}</td>
                     <td style={{fontWeight: 900, fontSize: '12px', color: THEME.success}}>{formatCurrency(r.amount_to_pay || 0)}</td>
                     <td style={{fontWeight: 900, fontSize: '12px', color: THEME.ruby}}>{formatCurrency(Number(r.net_salary || 0) - Number(r.amount_to_pay || 0))}</td>
                     <td></td>
                  </tr>
               ))}
               <tr style={{ background: THEME.primary, color: 'white', fontWeight: 900, fontSize: '12px' }}>
                   <td colSpan={2} style={{ textAlign: 'left', paddingLeft: '20px' }}>الإجمـــــالي الكــــلي:</td>
                   <td>{formatCurrency(logic.totals.current_net + logic.totals.deductions + logic.totals.extended_advances - logic.totals.allowances)}</td>
                   <td>{formatCurrency(logic.totals.allowances)}</td>
                   <td>{formatCurrency(logic.totals.deductions)}</td>
                   <td>{formatCurrency(logic.totals.extended_advances)}</td>
                   <td>{formatCurrency(logic.totals.previous_balances)}</td>
                   <td style={{ fontSize: '13px' }}>{formatCurrency(logic.totals.net)}</td>
                   <td style={{ fontSize: '13px', color: THEME.accent }}>{formatCurrency(logic.totals.amount_to_pay || 0)}</td>
                   <td style={{ fontSize: '13px', color: '#fca5a5' }}>{formatCurrency(logic.totals.net - (logic.totals.amount_to_pay || 0))}</td>
                   <td></td>
               </tr>
            </tbody>
         </table>

         <div style={{ marginTop: '20px', fontSize: '13px', fontWeight: 800, background: THEME.slate, padding: '12px', borderRadius: '6px', border: `1px solid ${THEME.border}` }}>
             إجمالي المبالغ المراد صرفها بالحروف: فقط ( {tafqeet(logic.totals.amount_to_pay || 0)} ريال سعودي ) لا غير.
         </div>

         <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', fontSize: '14px', fontWeight: 800, padding: '0 40px' }}>
             <div style={{textAlign: 'center', width: '200px'}}>أعده / محاسب الرواتب<br/><br/><hr style={{borderTop: '2px dashed #94a3b8', margin: '30px 0 10px 0'}}/>الاسم والتوقيع</div>
             <div style={{textAlign: 'center', width: '200px'}}>راجعه / مدير الموارد البشرية<br/><br/><hr style={{borderTop: '2px dashed #94a3b8', margin: '30px 0 10px 0'}}/>الاسم والتوقيع</div>
             <div style={{textAlign: 'center', width: '200px'}}>اعتمده / المدير المالي<br/><br/><hr style={{borderTop: '2px dashed #94a3b8', margin: '30px 0 10px 0'}}/>الاسم والتوقيع</div>
         </div>
      </div>
    </MasterPage>
  );
}
