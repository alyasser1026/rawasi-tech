import React from 'react';
import { formatCurrency } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import { Printer } from 'lucide-react';

export default function ProjectReportModal({ isOpen, onClose, logic, boqStats, flatBoqData }: any) {
  if (!isOpen) return null;

  const project = logic.selectedProject || {};
  const expenses = logic.projectDetails?.expenses || []; 
  const today = new Date().toLocaleDateString('ar-EG');

  // حساب إجمالي المصروفات الفعلية لتذييل الجدول
  const totalActualExpenses = expenses.reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* 🚀 كود CSS السحري للطباعة المرفق داخل المودال */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; background: white; }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 15mm; } /* خليناها بالعرض عشان الأعمدة الكتير تبان بوضوح */
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div className="bg-white rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative">
        
        {/* شريط التحكم (يختفي في الطباعة) */}
        <div className="no-print sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10">
          <h2 style={{ color: THEME.coffeeDark, fontWeight: 900, fontSize: 'var(--fs-xl)', margin: 0 }}>معاينة التقرير المالي والتحليلي (يشمل تكاليف ABC)</h2>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button onClick={() => window.print()} style={{ backgroundColor: THEME.primary, color: 'white', padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: 800, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span><Printer size={16} aria-hidden="true" /></span> طباعة الآن
            </button>
            <button onClick={onClose} style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: 800 }}>
              إغلاق
            </button>
          </div>
        </div>

        {/* 📄 بداية الورقة الرسمية (التي ستطبع) */}
        <div id="printable-report" style={{ padding: '2.5rem', color: '#1e293b', direction: 'rtl', backgroundColor: 'white' }}>
          
          {/* الترويسة Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `3px solid ${THEME.primary}`, paddingBottom: '1.25rem', marginBottom: '1.875rem' }}>
            <div>
              <h1 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900, fontSize: 'var(--fs-2xl)' }}>التقرير المالي والتحليلي للمشروع</h1>
              <p style={{ margin: '0.3125rem 0 0 0', color: '#64748b', fontWeight: 800 }}>تاريخ الإصدار: {today}</p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ margin: 0, color: THEME.primary, fontWeight: 900 }}>إدارة المشاريع والتكاليف</h2>
              <p style={{ margin: '0.3125rem 0 0 0', color: '#64748b', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>نظام الرقابة المالية (ABC Costing)</p>
            </div>
          </div>

          {/* بيانات المشروع */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.875rem', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div><strong style={{ color: '#64748b' }}>اسم المشروع / العقار:</strong> <span style={{ fontWeight: 900, fontSize: 'var(--fs-lg)' }}>{project.Property}</span></div>
            <div><strong style={{ color: '#64748b' }}>العميل المالك:</strong> <span style={{ fontWeight: 900 }}>{project.client?.name || 'غير محدد'}</span></div>
            <div><strong style={{ color: '#64748b' }}>حالة المشروع:</strong> <span style={{ fontWeight: 900 }}>{project.status}</span></div>
            <div><strong style={{ color: '#64748b' }}>المهندس المسئول:</strong> <span style={{ fontWeight: 900 }}>{project.engineer_in_charge || 'غير محدد'}</span></div>
          </div>

          {/* ملخص التحليل المالي الكلي */}
          <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.625rem', color: THEME.coffeeDark, fontWeight: 900 }}>الملخص المالي والتكاليف الموزعة</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.9375rem', marginBottom: '2.5rem' }}>
            <div style={{ padding: '0.9375rem', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800 }}>إجمالي قيمة التعاقد</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: THEME.coffeeDark }}>{formatCurrency(boqStats.totalContractValue)}</div>
            </div>
            <div style={{ padding: '0.9375rem', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800 }}>إجمالي الميزانية المعتمدة</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: THEME.danger }}>{formatCurrency(boqStats.totalEstimatedCosts)}</div>
            </div>
            {/* 🚀 إجمالي التوزيعات ABC */}
            <div style={{ padding: '0.9375rem', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center', backgroundColor: '#F3E8FF' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: '#6B21A8', fontWeight: 800 }}>المصروفات الموزعة (ABC)</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#9333EA' }}>{formatCurrency(boqStats.totalAllocatedExpensesABC)}</div>
            </div>
            <div style={{ padding: '0.9375rem', border: `1px solid ${boqStats.isLoss ? THEME.danger : THEME.success}`, backgroundColor: boqStats.isLoss ? '#FEF2F2' : '#F0FDF4', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: boqStats.isLoss ? THEME.danger : '#166534', fontWeight: 800 }}>{boqStats.isLoss ? 'خسارة المشروع' : 'صافي الأرباح الحقيقية'}</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: boqStats.isLoss ? THEME.danger : THEME.success }}>{formatCurrency(boqStats.totalNetProfit)}</div>
            </div>
            <div style={{ padding: '0.9375rem', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800 }}>هامش الربح الفعلي</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#1e293b', direction: 'ltr' }}>{boqStats.profitMargin}%</div>
            </div>
          </div>

          {/* 📋 جدول المقايسة المطور (ABC) */}
          <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.625rem', color: THEME.coffeeDark, fontWeight: 900 }}>تفاصيل التكاليف والأرباح لكل بند (WBS & ABC)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2.5rem', fontSize: 'var(--fs-xs)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '0.625rem', textAlign: 'right', fontWeight: 900, width: '20%' }}>البند / المرحلة</th>
                <th style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900 }}>إجمالي البيع</th>
                <th style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900 }}>عمالة فعلية</th>
                <th style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900 }}>خامات فعلية</th>
                <th style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900 }}>مصاريف مباشرة</th>
                <th style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900, color: '#6B21A8' }}>الموزع (ABC)</th>
                <th style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900 }}>إجمالي التكلفة</th>
                <th style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900 }}>صافي الربح</th>
              </tr>
            </thead>
            <tbody>
              {flatBoqData.map((row: any, idx: number) => {
                const isMain = row.item_type === 'رئيسي';
                const itemRevenue = Number(row.total_contract_amount || 0);
                const actualLabor = Number(row.actual_labor_cost || 0) + Number(row.actual_operational_cost || 0);
                const actualMaterial = Number(row.actual_material_cost || 0);
                const actualDirectExp = Number(row.actual_expenses_cost || 0);
                const allocatedABC = Number(row.allocated_expenses || 0);
                
                const totalItemCost = actualLabor + actualMaterial + actualDirectExp + allocatedABC;
                const netProfit = Number(row.item_net_profit || 0);

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: isMain ? '#f1f5f9' : 'transparent' }}>
                    <td style={{ padding: '0.625rem', fontWeight: isMain ? 900 : 700, color: isMain ? THEME.coffeeDark : '#475569' }}>
                      {isMain ? `${row.work_item}` : `${row.work_item}`}
                    </td>
                    <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900, color: THEME.coffeeDark }}>{formatCurrency(itemRevenue)}</td>
                    <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 800, color: '#0369A1' }}>{formatCurrency(actualLabor)}</td>
                    <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 800, color: THEME.goldAccent }}>{formatCurrency(actualMaterial)}</td>
                    <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 800, color: '#ea580c' }}>{formatCurrency(actualDirectExp)}</td>
                    <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900, color: '#9333EA', backgroundColor: isMain ? 'transparent' : '#F3E8FF' }}>{formatCurrency(allocatedABC)}</td>
                    <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900, color: THEME.danger }}>{formatCurrency(totalItemCost)}</td>
                    <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900, color: netProfit < 0 ? THEME.danger : THEME.success }}>
                      {formatCurrency(netProfit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* التوقيعات Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3.75rem', paddingTop: '1.25rem', pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', width: '12.5rem' }}>
              <strong style={{ display: 'block', color: THEME.coffeeDark, marginBottom: '2.5rem' }}>المهندس المسئول</strong>
              <div style={{ borderBottom: '1px solid #94a3b8' }}></div>
            </div>
            <div style={{ textAlign: 'center', width: '12.5rem' }}>
              <strong style={{ display: 'block', color: THEME.coffeeDark, marginBottom: '2.5rem' }}>المدير المالي</strong>
              <div style={{ borderBottom: '1px solid #94a3b8' }}></div>
            </div>
            <div style={{ textAlign: 'center', width: '12.5rem' }}>
              <strong style={{ display: 'block', color: THEME.coffeeDark, marginBottom: '2.5rem' }}>اعتماد الإدارة</strong>
              <div style={{ borderBottom: '1px solid #94a3b8' }}></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}