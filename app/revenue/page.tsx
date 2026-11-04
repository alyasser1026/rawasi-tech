"use client";
import React from 'react';
import { useRevenueLogic } from './revenue_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';

export default function RevenuePage() {
    const logic = useRevenueLogic();

    // 🏗️ تعريف أعمدة الجدول (مركزة على الاستقطاعات والصافي)
    const columns = [
        { 
            header: 'البيان / العميل', 
            render: (row: any) => row ? (
                <div>
                    <div style={{ fontWeight: 900, color: THEME.primary }}>{row.partners?.name || 'عميل نقدي'}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>#{row.invoice_number} | {row.description || 'إيراد تشغيل'}</div>
                </div>
            ) : null
        },
        { header: 'التاريخ', render: (row: any) => row ? new Date(row.date).toLocaleDateString('ar-EG') : null },
        { 
            header: 'خصم الخامات', 
            render: (row: any) => row ? <span style={{ color: THEME.ruby }}>{formatCurrency(row.materials_discount || 0)}</span> : null 
        },
        { 
            header: 'الضريبة', 
            render: (row: any) => row ? <span style={{ color: '#64748b' }}>{formatCurrency(row.tax_amount || 0)}</span> : null 
        },
        { 
            header: 'ضمان الأعمال', 
            render: (row: any) => row ? <span style={{ color: THEME.warning, fontWeight: 700 }}>{formatCurrency(row.guarantee_amount || 0)}</span> : null 
        },
        { 
            header: 'صافي الإيراد المحقق', 
            render: (row: any) => row ? (
                <div style={{ fontWeight: 900, color: THEME.success, fontSize: '14px', background: '#f0fdf4', padding: '6px 12px', borderRadius: '10px', textAlign: 'center' }}>
                    {formatCurrency(row.total_amount)}
                </div>
            ) : null
        }
    ];

    return (
        <MasterPage title="سجل الإيرادات الصافية" subtitle="تحليل التدفقات النقدية المحققة والاستقطاعات الفنية">
            
            <RawasiSidebarManager 
                summary={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'white' }}>
                        
                        {/* 💰 الصافي المحقق - أخضر */}
                        <div className="kpi-box success">
                            <span>إجمالي الصافي المحقق (كاش)</span>
                            <strong>{formatCurrency(logic.kpis.netRevenue)}</strong>
                        </div>

                        {/* 🛡️ الرقم المطلوب: إجمالي ضمان الأعمال - ذهبي/تحذيري */}
                        <div className="kpi-box warning">
                            <span>إجمالي ضمان الأعمال (محتجز)</span>
                            <strong>{formatCurrency(logic.kpis.totalGuarantee || 0)}</strong>
                        </div>

                        {/* 🏛️ إجمالي الضرائب - سكني */}
                        <div className="kpi-box secondary">
                            <span>إجمالي الضرائب المستقطعة</span>
                            <strong>{formatCurrency(logic.kpis.totalTax)}</strong>
                        </div>
                        
                    </div>
                }
                customFilters={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input 
                            type="text" 
                            placeholder="بحث سريع..." 
                            className="glass-input" 
                            value={logic.globalSearch} 
                            onChange={(e) => logic.setGlobalSearch(e.target.value)} 
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '5px' }}>
                            <input type="date" className="glass-input" value={logic.dateFrom} onChange={(e) => logic.setDateFrom(e.target.value)} />
                            <input type="date" className="glass-input" value={logic.dateTo} onChange={(e) => logic.setDateTo(e.target.value)} />
                        </div>
                    </div>
                }
                watchDeps={[logic.kpis, logic.globalSearch]}
            />

            <RawasiSmartTable 
                data={logic.data}
                columns={columns}
                isLoading={logic.isLoading}
                enableExport={true}
                onRefresh={logic.refresh}
            />

            <style>{`
                .kpi-box { background: rgba(255,255,255,0.08); padding: 18px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.15); }
                .kpi-box span { display: block; font-size: 11px; opacity: 0.8; color: #cbd5e1; font-weight: 800; margin-bottom: 5px; }
                .kpi-box strong { display: block; font-size: 22px; color: ${THEME.goldAccent}; }
                .kpi-box.success { border-right: 4px solid #4ade80; background: rgba(74, 222, 128, 0.05); }
                .kpi-box.success strong { color: #4ade80; }
                .kpi-box.warning { border-right: 4px solid #fbbf24; background: rgba(251, 191, 36, 0.05); }
                .kpi-box.warning strong { color: #fbbf24; }
                .kpi-box.secondary { border-right: 4px solid #94a3b8; }
                .glass-input { width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; color: white; outline: none; font-size: 13px; }
            `}</style>

        </MasterPage>
    );
}