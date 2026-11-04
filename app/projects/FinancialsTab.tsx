import React, { useMemo } from 'react';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import RawasiSmartTable from '@/components/rawasismarttable';
import { StatusBadge } from './SharedUI';
import { Banknote } from 'lucide-react';

export default function FinancialsTab({ logic }: { logic: any }) {
  const financials = logic.projectDetails.invoices || [];
  const kpis = logic.kpis || {};

  // 🧠 حسبة مالية ذكية للتدفق النقدي الشامل (Cash Flow)
  const financialStats = useMemo(() => {
    let clientTotal = 0;
    let subContractorTotal = 0;

    financials.forEach((item: any) => {
      const amount = Number(item.final_amount || 0);
      if (item.display_type?.includes('مقاول')) {
        subContractorTotal += amount;
      } else {
        clientTotal += amount;
      }
    });

    // 🚀 سحب التكاليف الداخلية (مواد + عمالة + ABC) من محرك الـ KPIs
    const internalCosts = Number(kpis.actualCost || 0);
    
    // ⚖️ التدفق النقدي الحقيقي = (إيرادات العميل) - (التزامات مقاولي الباطن + التكاليف الداخلية للشركة)
    const netCashFlow = clientTotal - (subContractorTotal + internalCosts);

    return { clientTotal, subContractorTotal, internalCosts, netCashFlow };
  }, [financials, kpis]);

  const invoiceColumns = [
    { 
        header: 'التاريخ', 
        render: (row: any) => row.date || row.created_at?.split('T')[0] || '---' 
    },
    { 
        header: 'الرقم / النوع', 
        render: (row: any) => (
            <div>
                <strong style={{ color: THEME.primary, fontSize: '14px' }}>
                    {row.display_number || row.invoice_number || '---'}
                </strong>
                <br/>
                <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 900,
                    // 🎨 تمييز لوني دقيق (أحمر للالتزامات، أخضر للإيرادات)
                    color: row.display_type?.includes('مقاول') ? '#991B1B' : '#166534',
                    backgroundColor: row.display_type?.includes('مقاول') ? '#FEE2E2' : '#DCFCE7',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    display: 'inline-block'
                }}>
                    {row.display_type || 'مستخلص عام'}
                </span>
            </div>
        ) 
    },
    {
        header: 'البيان / الوصف',
        render: (row: any) => (
            <span style={{ fontWeight: 700, color: '#475569' }}>
                {row.description || row.notes || 'مستخلص أعمال جارية'}
            </span>
        )
    },
    { 
        header: 'المبلغ الصافي', 
        render: (row: any) => {
            const isSub = row.display_type?.includes('مقاول');
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontWeight: 900, fontSize: '15px', color: isSub ? THEME.danger : THEME.success }}>
                        {isSub ? '-' : '+'}{formatCurrency(row.final_amount || 0)}
                    </span>
                </div>
            );
        }
    },
    { 
        header: 'الحالة', 
        render: (row: any) => <StatusBadge status={row.status} /> 
    },
  ];

  return (
    <div>
      {/* 📊 كروت التحليل المالي الشامل للسيولة النقدية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        
        {/* كارت 1: الإيرادات */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '14px', borderBottom: `4px solid ${THEME.success}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800, marginBottom: '5px' }}>إيرادات المشروع (مستخلصات العميل)</span>
          <strong style={{ fontSize: '22px', color: THEME.success, fontWeight: 900 }}>{formatCurrency(financialStats.clientTotal)}</strong>
        </div>
        
        {/* كارت 2: التزامات الباطن */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '14px', borderBottom: `4px solid ${THEME.danger}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800, marginBottom: '5px' }}>التزامات العقود (مقاولي الباطن)</span>
          <strong style={{ fontSize: '22px', color: THEME.danger, fontWeight: 900 }}>{formatCurrency(financialStats.subContractorTotal)}</strong>
        </div>

        {/* كارت 3: التكاليف الداخلية اللي سحبناها من اللوجيك */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '14px', borderBottom: `4px solid #ea580c`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800, marginBottom: '5px' }}>تكاليف داخلية (مواد + عمالة + ABC)</span>
          <strong style={{ fontSize: '22px', color: '#ea580c', fontWeight: 900 }}>{formatCurrency(financialStats.internalCosts)}</strong>
        </div>

        {/* كارت 4: الخلاصة والتدفق النقدي الفعلي */}
        <div style={{ 
            backgroundColor: financialStats.netCashFlow >= 0 ? '#F0FDF4' : '#FEF2F2', 
            backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '14px', 
            borderBottom: `4px solid ${financialStats.netCashFlow >= 0 ? '#166534' : '#991B1B'}`, 
            boxShadow: '0 4px 15px rgba(0,0,0,0.02)' 
        }}>
          <span style={{ display: 'block', fontSize: '11px', color: financialStats.netCashFlow >= 0 ? '#166534' : '#991B1B', fontWeight: 900, marginBottom: '5px' }}>
            التدفق النقدي (السيولة المتاحة)
          </span>
          <strong style={{ fontSize: '22px', color: financialStats.netCashFlow >= 0 ? '#166534' : '#991B1B', fontWeight: 900, direction: 'ltr' }}>
            {financialStats.netCashFlow > 0 ? '+' : ''}{formatCurrency(financialStats.netCashFlow)}
          </strong>
        </div>

      </div>

      {/* 📋 جدول الحسابات الموحد */}
      <div className="glass-card" style={{ padding: '15px' }}>
        <div style={{ marginBottom: '15px', padding: '0 10px' }}>
            <h3 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900, fontSize: '16px' }}>سجل المستخلصات والمطالبات المالية</h3>
        </div>

        {financials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: 900 }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}><Banknote size={34} aria-hidden="true" /></div>
                لا توجد مستخلصات مالية أو فواتير مسجلة لهذا المشروع حتى الآن.
            </div>
        ) : (
            <RawasiSmartTable data={financials} columns={invoiceColumns} />
        )}
      </div>
    </div>
  );
}