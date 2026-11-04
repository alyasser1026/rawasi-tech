"use client";
import React, { useState } from 'react';
import { useLaborCostsLogic } from './labor_cost_logic';
import { THEME } from '@/lib/theme';
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
                    <div className="summary-glass-card">
                        <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي تكلفة الميدان الحية</span>
                        <div className="val" style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: THEME.goldAccent, marginTop:'0.3125rem'}}>
                            {formatCurrency(logic.grandTotalLaborCost)}
                        </div>
                    </div>
                }
                actions={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
                        <div className="filter-group">
                            <label style={{fontSize:'var(--fs-xs)', fontWeight:800, color:'#94a3b8', display:'block', marginBottom:'0.3125rem'}}>تصفية بالمشروع</label>
                            <select className="combo-glass" value={logic.selectedProject} onChange={(e)=>logic.setSelectedProject(e.target.value)}>
                                <option value="">كل المشاريع المتاحة</option>
                                {logic.uniqueProjects.map((p, i)=><option key={i} value={p}>{p}</option>)}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label style={{fontSize:'var(--fs-xs)', fontWeight:800, color:'#94a3b8', display:'block', marginBottom:'0.3125rem'}}>تصفية بالشهر المالي</label>
                            <select className="combo-glass" value={logic.selectedMonth} onChange={(e)=>logic.setSelectedMonth(e.target.value)}>
                                <option value="">كل الأشهر</option>
                                {logic.uniqueMonths.map((m, i)=><option key={i} value={m}>{m}</option>)}
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
                    border-radius: 16px;
                    background: white;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.03);
                    border: 1px solid #e2e8f0;
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
                    padding: 0.75rem 0.625rem !important;
                    font-size: var(--fs-sm) !important;
                    white-space: nowrap !important;
                    font-weight: 900 !important;
                    color: #334155 !important;
                    background: #f8fafc !important;
                    border-bottom: 2px solid #e2e8f0 !important;
                    text-align: right;
                }
                
                .labor-scroller td {
                    padding: 0.625rem 0.625rem !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    font-size: var(--fs-sm);
                    font-weight: 700;
                    color: #475569;
                    white-space: nowrap;
                }

                .project-row-head {
                    background: linear-gradient(90deg, #f8fafc, #ffffff) !important;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .project-row-head:hover { background: #f1f5f9 !important; }
                
                .sticky-col-1 { position: sticky !important; right: 0px !important; z-index: 5; background: #fff !important; }
                .sticky-col-2 { position: sticky !important; right: 11.25rem !important; z-index: 5; background: #fff !important; border-left: 2px solid #cbd5e1 !important; box-shadow: -4px 0 8px rgba(0,0,0,0.05); }
                th.sticky-col-1, th.sticky-col-2 { background: #f8fafc !important; }

                .combo-glass { width:100%; padding:0.625rem; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; font-weight:700; outline:none; cursor:pointer; }
                .combo-glass option { background: #1e1b18; color: white; }
                
                /* ستايل أزرار التقليب (Pagination) */
                .pagination-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1.25rem;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                    position: sticky;
                    left: 0;
                }
                .page-btn {
                    background: white;
                    border: 1px solid #cbd5e1;
                    padding: 0.375rem 1rem;
                    border-radius: 8px;
                    font-weight: 800;
                    font-size: var(--fs-sm);
                    color: #334155;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .page-btn:hover:not(:disabled) {
                    background: #e2e8f0;
                    transform: scale(1.05);
                }
                .page-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
                
                .cinematic-scroll::-webkit-scrollbar { height: 0.4375rem; }
                .cinematic-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
                .cinematic-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>

            {logic.isLoading ? (
                <LoadingScreen message="جاري تجميع كشوف الميدان وحساب التكاليف..." fullScreen={false} />
            ) : (
                <div className="labor-scroller cinematic-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th className="sticky-col-1" style={{minWidth:'11.25rem'}}>المشروع / الفيلا</th>
                                <th className="sticky-col-2" style={{minWidth:'7.5rem'}}>تاريخ اليومية</th>
                                <th style={{minWidth:'6.25rem'}}>الشهر المالي</th>
                                <th style={{minWidth:'13.75rem'}}>البند المتأثر بالتشغيل</th>
                                <th style={{minWidth:'6.25rem'}}>عدد العمالة / الأيام</th>
                                <th style={{minWidth:'9.375rem'}}>التكلفة الفعلية</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logic.paginatedGroups.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '1.875rem', color: '#94a3b8' }}>لا توجد بيانات مطابقة للبحث</td>
                                </tr>
                            ) : (
                                logic.paginatedGroups.map((group, idx) => {
                                    const isExpanded = expandedProject === group.projectName;
                                    return (
                                        <React.Fragment key={idx}>
                                            <tr className="project-row-head" onClick={() => setExpandedProject(isExpanded ? null : group.projectName)}>
                                                <td className="sticky-col-1" style={{fontWeight:900, color: THEME.primary, background: '#f8fafc'}}>
                                                    {isExpanded ? '▼' : '►'} {group.projectName}
                                                </td>
                                                <td className="sticky-col-2" style={{color:'#94a3b8', background: '#f8fafc'}}>كشف تفصيلي ↳</td>
                                                <td style={{color:'#94a3b8'}}>--</td>
                                                <td style={{color:'#64748b', fontSize:'var(--fs-xs)'}}>إجمالي يوميات الموقع</td>
                                                <td style={{color:'#1e293b'}}>
                                                    <span style={{background:'#e2e8f0', padding:'0.1875rem 0.5rem', borderRadius:'6px'}}>
                                                        {Number(group.totalWorkers).toFixed(2).replace(/\.00$/, '')} عامل
                                                    </span>
                                                </td>
                                                <td style={{color:'#047857', fontWeight:900, fontSize:'var(--fs-md)', background:'rgba(16, 185, 129, 0.05)'}}>{formatCurrency(group.totalCost)}</td>
                                            </tr>

                                            {isExpanded && group.items.map((item, iIdx) => (
                                                <tr key={item.id || iIdx} style={{background: 'rgba(248,250,252,0.6)'}}>
                                                    <td className="sticky-col-1" style={{paddingRight:'2.1875rem', color:'#94a3b8', fontSize:'var(--fs-xs)', background: 'inherit'}}>↳ تابع: {group.projectName}</td>
                                                    <td className="sticky-col-2" style={{color:'#334155', background: 'inherit'}}>{item["تاريخ اليومية"]}</td>
                                                    <td style={{color:'#64748b'}}>{item["الشهر المالي"]}</td>
                                                    <td style={{color: THEME.goldAccent}}>{item["اسم البند المتأثر"] || 'عام / غير محدد'}</td>
                                                    <td>{Number(item["عدد العمال بالميدان"]).toFixed(2).replace(/\.00$/, '')} عمال</td>
                                                    <td style={{color:'#22c55e'}}>{formatCurrency(item["تكلفة العمالة الفعلية"])}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* 🚀 جزء التقليب (Pagination) اللي كان ناقص */}
                    {totalPages > 1 && (
                        <div className="pagination-footer">
                            <button 
                                className="page-btn" 
                                disabled={logic.currentPage === 1}
                                onClick={() => logic.setCurrentPage(logic.currentPage - 1)}
                            >
                                ◀ السابق
                            </button>
                            
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#64748b' }}>
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