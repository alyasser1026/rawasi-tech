"use client";
import React from 'react';
import { useRevenueLogic } from './revenue_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import { formatCurrency } from '@/lib/helpers';
import { RefreshCw, X, DollarSign, ShieldCheck, Receipt, Layers } from 'lucide-react';

export default function RevenuePage() {
    const logic = useRevenueLogic();

    // 🏗️ تعريف أعمدة الجدول (مركزة على الاستقطاعات والصافي)
    const columns = [
        { 
            header: 'البيان / العميل', 
            render: (row: any) => row ? (
                <div>
                    <div style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{row.partners?.name || 'عميل نقدي'}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>#{row.invoice_number} | {row.description || 'إيراد تشغيل'}</div>
                </div>
            ) : null
        },
        { 
            header: 'التاريخ', 
            render: (row: any) => row ? <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>{new Date(row.date).toLocaleDateString('en-GB')}</span> : null 
        },
        { 
            header: 'خصم الخامات', 
            render: (row: any) => row ? <span style={{ color: 'var(--status-negative)', fontWeight: 800 }}>{formatCurrency(row.materials_discount || 0)}</span> : null 
        },
        { 
            header: 'الضريبة', 
            render: (row: any) => row ? <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>{formatCurrency(row.tax_amount || 0)}</span> : null 
        },
        { 
            header: 'ضمان الأعمال', 
            render: (row: any) => row ? <span style={{ color: 'var(--status-warning)', fontWeight: 900 }}>{formatCurrency(row.guarantee_amount || 0)}</span> : null 
        },
        { 
            header: 'صافي الإيراد المحقق', 
            render: (row: any) => row ? (
                <div style={{ fontWeight: 900, color: 'var(--status-positive)', fontSize: 'var(--fs-md)', background: 'var(--status-positive-soft)', padding: '0.375rem 0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                    {formatCurrency(row.total_amount)}
                </div>
            ) : null
        }
    ];

    const hasActiveFilters = Boolean(logic.globalSearch || logic.dateFrom || logic.dateTo);

    const clearFilters = () => {
        logic.setGlobalSearch('');
        logic.setDateFrom('');
        logic.setDateTo('');
    };

    return (
        <div className="clean-page enterprise-page">
            <MasterPage title="سجل الإيرادات الصافية" subtitle="تحليل التدفقات النقدية المحققة والاستقطاعات الفنية">
                
                <RawasiSidebarManager 
                    summary={
                        <div className="phi-kpi-strip">
                            <div className="phi-kpi tone-success">
                                <div className="phi-kpi-top">
                                    <span className="phi-kpi-label">إجمالي الصافي المحقق (كاش)</span>
                                    <div className="phi-kpi-icon"><DollarSign size={16} aria-hidden="true" /></div>
                                </div>
                                <strong className="phi-kpi-value">{formatCurrency(logic.kpis.netRevenue)}</strong>
                                <span className="phi-kpi-hint">السيولة النقدية الفعلية</span>
                            </div>

                            <div className="phi-kpi tone-warning">
                                <div className="phi-kpi-top">
                                    <span className="phi-kpi-label">ضمان الأعمال (محتجز)</span>
                                    <div className="phi-kpi-icon"><ShieldCheck size={16} aria-hidden="true" /></div>
                                </div>
                                <strong className="phi-kpi-value">{formatCurrency(logic.kpis.totalGuarantee || 0)}</strong>
                                <span className="phi-kpi-hint">مستحقات مؤجلة للعملاء</span>
                            </div>

                            <div className="phi-kpi tone-info">
                                <div className="phi-kpi-top">
                                    <span className="phi-kpi-label">الضرائب المستقطعة</span>
                                    <div className="phi-kpi-icon"><Receipt size={16} aria-hidden="true" /></div>
                                </div>
                                <strong className="phi-kpi-value">{formatCurrency(logic.kpis.totalTax)}</strong>
                                <span className="phi-kpi-hint">إجمالي ضريبة القيمة المضافة</span>
                            </div>

                            <div className="phi-kpi">
                                <div className="phi-kpi-top">
                                    <span className="phi-kpi-label">خصم الخامات والتوريدات</span>
                                    <div className="phi-kpi-icon"><Layers size={16} aria-hidden="true" /></div>
                                </div>
                                <strong className="phi-kpi-value">{formatCurrency(logic.kpis.totalMaterials)}</strong>
                                <span className="phi-kpi-hint">استقطاعات المواد الموردة</span>
                            </div>
                        </div>
                    }
                    actions={
                        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="ent-button ent-primary" onClick={() => logic.refresh()}>
                                <RefreshCw size={15} aria-hidden="true" />
                                <span>تحديث البيانات</span>
                            </button>
                        </div>
                    }
                    customFilters={
                        <div className="revenue-filter-grid">
                            <div className="revenue-filter-field search-field">
                                <label className="revenue-filter-label">بحث عام في الإيرادات:</label>
                                <input 
                                    type="text" 
                                    placeholder="ابحث باسم العميل، رقم الفاتورة، البيان..." 
                                    className="revenue-filter-input" 
                                    value={logic.globalSearch} 
                                    onChange={(e) => logic.setGlobalSearch(e.target.value)} 
                                />
                            </div>

                            <div className="revenue-filter-field">
                                <label className="revenue-filter-label">من تاريخ:</label>
                                <input 
                                    type="date" 
                                    className="revenue-filter-input" 
                                    value={logic.dateFrom} 
                                    onChange={(e) => logic.setDateFrom(e.target.value)} 
                                />
                            </div>

                            <div className="revenue-filter-field">
                                <label className="revenue-filter-label">إلى تاريخ:</label>
                                <input 
                                    type="date" 
                                    className="revenue-filter-input" 
                                    value={logic.dateTo} 
                                    onChange={(e) => logic.setDateTo(e.target.value)} 
                                />
                            </div>

                            {hasActiveFilters && (
                                <div className="revenue-filter-field reset-field">
                                    <button 
                                        type="button" 
                                        className="ent-button ent-warning" 
                                        onClick={clearFilters}
                                        style={{ height: '2.75rem', width: '100%' }}
                                    >
                                        <X size={15} aria-hidden="true" />
                                        <span>مسح الفلاتر</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    }
                    watchDeps={[logic.kpis, logic.globalSearch, logic.dateFrom, logic.dateTo]}
                />

                <style>{`
                    .revenue-filter-grid {
                        display: grid;
                        grid-column: 1 / -1;
                        grid-template-columns: minmax(16rem, 2fr) minmax(11rem, 1fr) minmax(11rem, 1fr) auto;
                        gap: 1rem 1.25rem;
                        width: 100%;
                        align-items: end;
                    }
                    @media (max-width: 900px) {
                        .revenue-filter-grid {
                            grid-template-columns: 1fr 1fr;
                        }
                        .revenue-filter-grid .search-field {
                            grid-column: 1 / -1;
                        }
                    }
                    @media (max-width: 550px) {
                        .revenue-filter-grid {
                            grid-template-columns: 1fr;
                        }
                    }
                    .revenue-filter-field {
                        display: flex;
                        flex-direction: column;
                        gap: 0.375rem;
                        min-width: 0;
                    }
                    .revenue-filter-label {
                        font-size: var(--fs-xs);
                        font-weight: 800;
                        color: var(--text-secondary);
                        margin: 0;
                    }
                    .revenue-filter-input {
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
                        transition: all 0.2s ease;
                    }
                    .revenue-filter-input:focus-visible {
                        outline: 2px solid var(--accent-main);
                        outline-offset: 1px;
                    }
                    .table-glass-wrapper {
                        background: var(--surface-card);
                        border-radius: var(--phi-radius-card, 18px);
                        padding: 0.75rem;
                        border: none !important;
                        box-shadow: var(--shadow-ambient);
                        position: relative;
                        overflow: hidden;
                    }
                    .table-glass-wrapper::before {
                        content: '';
                        position: absolute;
                        top: 0; left: 8%; right: 8%;
                        height: 1.5px;
                        background: var(--specular-beam);
                        pointer-events: none;
                    }
                `}</style>

                <div className="table-glass-wrapper">
                    <RawasiSmartTable 
                        data={logic.data}
                        columns={columns}
                        isLoading={logic.isLoading}
                        enableExport={true}
                        onRefresh={logic.refresh}
                    />
                </div>

            </MasterPage>
        </div>
    );
}
