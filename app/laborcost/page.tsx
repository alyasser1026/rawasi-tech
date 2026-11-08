"use client";
import React, { useState } from 'react';
import { useLaborCostsLogic } from './labor_cost_logic';
import { formatCurrency } from '@/lib/helpers';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import LoadingScreen from '@/components/LoadingScreen';

export default function ProjectLaborCostsPage() {
    const logic = useLaborCostsLogic();
    const [expandedProject, setExpandedProject] = useState<string | null>(null);

    // 🧮 حساب إجمالي عدد الصفحات
    const totalPages = Math.ceil(logic.groupedProjects.length / logic.rowsPerPage);

    return (
        <MasterPage title="رادار تكاليف العمالة الميدانية" subtitle="تحليل وتجميع كشوف يوميات العمالة الفعلية مجمعة لكل فيلا ومشروع">
            
            <RawasiSidebarManager 
                summary={
                    <div className="summary-glass-card" style={{ background: 'var(--surface-card, #ffffff)', padding: '1rem', borderRadius: '14px', boxShadow: 'var(--shadow-elevation)', border: 'none' }}>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary, #64748b)' }}>إجمالي تكلفة الميدان الحية</span>
                        <div className="val" style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--accent-ink, #c2410c)', marginTop: '0.3125rem' }}>
                            {formatCurrency(logic.grandTotalLaborCost)}
                        </div>
                    </div>
                }
                actions={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
                        <div className="filter-group">
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '0.375rem' }}>تصفية بالمشروع</label>
                            <select className="combo-glass" value={logic.selectedProject} onChange={(e) => logic.setSelectedProject(e.target.value)}>
                                <option value="">كل المشاريع المتاحة</option>
                                {logic.uniqueProjects.map((p, i) => <option key={i} value={p}>{p}</option>)}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '0.375rem' }}>تصفية بالشهر المالي</label>
                            <select className="combo-glass" value={logic.selectedMonth} onChange={(e) => logic.setSelectedMonth(e.target.value)}>
                                <option value="">كل الأشهر</option>
                                {logic.uniqueMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                }
                onSearch={logic.setGlobalSearch}
                watchDeps={[logic.grandTotalLaborCost, logic.groupedProjects.length]}
            />

            <style>{`
                .labor-scroller {
                    width: 100%;
                    overflow-x: auto !important;
                    border-radius: var(--phi-radius-card, 18px);
                    background: var(--surface-card, #ffffff);
                    box-shadow: var(--shadow-ambient);
                    border: none;
                    display: flex;
                    flex-direction: column;
                }
                
                .labor-scroller table {
                    width: max-content !important;
                    min-width: 100% !important;
                    border-collapse: separate !important;
                    border-spacing: 0 !important;
                }
                
                .labor-scroller th {
                    padding: 0.875rem 1rem !important;
                    font-size: var(--fs-sm) !important;
                    white-space: nowrap !important;
                    font-weight: 800 !important;
                    color: var(--text-secondary, #475569) !important;
                    background: var(--table-head-bg, var(--surface-card, #ffffff)) !important;
                    border-bottom: 1px solid var(--table-zebra-bg, rgba(0,0,0,0.04)) !important;
                    text-align: right;
                }
                
                .labor-scroller td {
                    padding: 0.875rem 1rem !important;
                    border-bottom: 1px solid var(--table-zebra-bg, rgba(0,0,0,0.03)) !important;
                    font-size: var(--fs-sm);
                    font-weight: 700;
                    color: var(--text-primary, #1e293b);
                    white-space: nowrap;
                }

                .project-row-head {
                    background: var(--surface-card, #ffffff) !important;
                    cursor: pointer;
                    transition: background 0.15s ease;
                }
                
                .project-row-head:hover { 
                    background: var(--table-hover-bg, rgba(0,0,0,0.02)) !important; 
                }

                .sticky-col-1 { 
                    position: sticky !important; 
                    right: 0px !important; 
                    z-index: 5; 
                    background: var(--surface-card, #ffffff) !important; 
                }
                .sticky-col-2 { 
                    position: sticky !important; 
                    right: 11.25rem !important; 
                    z-index: 5; 
                    background: var(--surface-card, #ffffff) !important; 
                    border-left: none !important; 
                    box-shadow: -4px 0 12px rgba(0,0,0,0.04); 
                }
                th.sticky-col-1, th.sticky-col-2 { 
                    background: var(--table-head-bg, var(--surface-card, #ffffff)) !important; 
                }

                .combo-glass { 
                    width: 100%; 
                    height: 2.75rem;
                    padding: 0 0.875rem; 
                    border-radius: 12px; 
                    background: var(--surface-sunken, #f8fafc); 
                    border: none; 
                    box-shadow: var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06));
                    color: var(--text-primary, #0f172a); 
                    font-weight: 700; 
                    outline: none; 
                    cursor: pointer; 
                }
                .combo-glass option { 
                    background: var(--surface-card, #ffffff); 
                    color: var(--text-primary, #0f172a); 
                }

                .pagination-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.875rem 1.25rem;
                    background: var(--surface-card, #ffffff);
                    border-top: 1px solid var(--table-zebra-bg, rgba(0,0,0,0.04));
                    border-bottom-left-radius: var(--phi-radius-card, 18px);
                    border-bottom-right-radius: var(--phi-radius-card, 18px);
                }

                .page-btn {
                    background: var(--surface-subcard, #f1f5f9);
                    border: none;
                    box-shadow: var(--shadow-elevation, 0 2px 6px rgba(0,0,0,0.06));
                    padding: 0.5rem 1rem;
                    border-radius: 10px;
                    font-weight: 800;
                    font-size: var(--fs-xs);
                    color: var(--text-primary, #1e293b);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .page-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: var(--shadow-elevation, 0 4px 12px rgba(0,0,0,0.12));
                }

                .page-btn:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                
                .cinematic-scroll::-webkit-scrollbar { height: 0.4375rem; }
                .cinematic-scroll::-webkit-scrollbar-track { background: var(--surface-sunken, #f1f5f9); border-radius: 10px; }
                .cinematic-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
                .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
            `}</style>

            {logic.isLoading ? (
                <LoadingScreen message="جاري تجميع كشوف الميدان وحساب التكاليف..." fullScreen={false} />
            ) : (
                <div className="labor-scroller cinematic-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th className="sticky-col-1" style={{ minWidth: '11.25rem' }}>المشروع / الفيلا</th>
                                <th className="sticky-col-2" style={{ minWidth: '7.5rem' }}>تاريخ اليومية</th>
                                <th style={{ minWidth: '6.25rem' }}>الشهر المالي</th>
                                <th style={{ minWidth: '13.75rem' }}>البند المتأثر بالتشغيل</th>
                                <th style={{ minWidth: '6.25rem' }}>عدد العمالة / الأيام</th>
                                <th style={{ minWidth: '9.375rem' }}>التكلفة الفعلية</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logic.paginatedGroups.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '1.875rem', color: 'var(--text-secondary, #94a3b8)' }}>لا توجد بيانات مطابقة للبحث</td>
                                </tr>
                            ) : (
                                logic.paginatedGroups.map((group, idx) => {
                                    const isExpanded = expandedProject === group.projectName;
                                    return (
                                        <React.Fragment key={idx}>
                                            <tr className="project-row-head" onClick={() => setExpandedProject(isExpanded ? null : group.projectName)}>
                                                <td className="sticky-col-1" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                                                    <span style={{ color: 'var(--accent-ink, #c2410c)', marginInlineEnd: '0.5rem', display: 'inline-block' }}>
                                                        {isExpanded ? '▼' : '►'}
                                                    </span>
                                                    {group.projectName}
                                                </td>
                                                <td className="sticky-col-2" style={{ color: 'var(--text-secondary, #94a3b8)' }}>كشف تفصيلي ↳</td>
                                                <td style={{ color: 'var(--text-secondary, #94a3b8)' }}>--</td>
                                                <td style={{ color: 'var(--text-secondary, #64748b)', fontSize: 'var(--fs-xs)' }}>إجمالي يوميات الموقع</td>
                                                <td style={{ color: 'var(--text-primary, #1e293b)' }}>
                                                    <span style={{ background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 1px 3px rgba(0,0,0,0.05))', padding: '0.25rem 0.625rem', borderRadius: '8px', fontWeight: 800, display: 'inline-block' }}>
                                                        {Number(group.totalWorkers).toFixed(2).replace(/\.00$/, '')} عامل
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: 'var(--fs-md)' }}>
                                                    {formatCurrency(group.totalCost)}
                                                </td>
                                            </tr>

                                            {isExpanded && group.items.map((item, iIdx) => (
                                                <tr key={item.id || iIdx} style={{ background: 'var(--table-zebra-bg, rgba(0,0,0,0.015))' }}>
                                                    <td className="sticky-col-1" style={{ paddingRight: '2.1875rem', color: 'var(--text-secondary, #94a3b8)', fontSize: 'var(--fs-xs)', background: 'inherit' }}>↳ تابع: {group.projectName}</td>
                                                    <td className="sticky-col-2" style={{ color: 'var(--text-primary, #334155)', background: 'inherit' }}>{item["تاريخ اليومية"]}</td>
                                                    <td style={{ color: 'var(--text-secondary, #64748b)' }}>{item["الشهر المالي"]}</td>
                                                    <td style={{ color: 'var(--accent-ink, #c2410c)', fontWeight: 700 }}>{item["اسم البند المتأثر"] || 'عام / غير محدد'}</td>
                                                    <td style={{ color: 'var(--text-primary)' }}>{Number(item["عدد العمال بالميدان"]).toFixed(2).replace(/\.00$/, '')} عمال</td>
                                                    <td style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(item["تكلفة العمالة الفعلية"])}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* 🚀 جزء التقليب (Pagination) */}
                    {totalPages > 1 && (
                        <div className="pagination-footer">
                            <button 
                                className="page-btn" 
                                disabled={logic.currentPage === 1}
                                onClick={() => logic.setCurrentPage(logic.currentPage - 1)}
                            >
                                ◀ السابق
                            </button>
                            
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary, #64748b)' }}>
                                صفحة {logic.currentPage} من {totalPages}
                            </span>

                            <button 
                                className="page-btn" 
                                disabled={logic.currentPage === totalPages}
                                onClick={() => logic.setCurrentPage(logic.currentPage + 1)}
                            >
                                التالي ▶
                            </button>
                        </div>
                    )}
                </div>
            )}
        </MasterPage>
    );
}
