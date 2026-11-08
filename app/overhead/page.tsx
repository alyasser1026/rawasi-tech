"use client";
import React, { useState } from 'react';
import { useOverheadAllocationsLogic } from './overhead_logic';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import LoadingScreen from '@/components/LoadingScreen';
import { FolderOpen, Folder } from 'lucide-react';

// 🏗️ مكون داخلي لكارت المشروع (Accordion)
const ProjectGroupCard = ({ group }: { group: any }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`project-accordion ${expanded ? 'expanded' : ''}`}>
            {/* الهيدر: اسم المشروع والإجمالي */}
            <div className="accordion-header" onClick={() => setExpanded(!expanded)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div className="icon-box">{expanded ? <FolderOpen size={16} aria-hidden="true" /> : <Folder size={16} aria-hidden="true" />}</div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#1e293b' }}>
                            {group.projectName}
                        </h3>
                        <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>
                            {group.items.length} حركات مالية
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: 'var(--fs-xs)', color: '#dc2626', fontWeight: 800, display: 'block' }}>إجمالي المُحمل</span>
                        <strong style={{ fontSize: 'var(--fs-lg)', color: '#b91c1c', fontWeight: 900 }}>
                            {formatCurrency(group.totalAmount)}
                        </strong>
                    </div>
                    <div className="toggle-arrow">{expanded ? '▲' : '▼'}</div>
                </div>
            </div>

            {/* الجسم الداخلي: جدول التفاصيل */}
            {expanded && (
                <div className="accordion-body cinematic-scroll">
                    <table className="nested-table">
                        <thead>
                            <tr>
                                <th>الشهر</th>
                                <th>التصنيف</th>
                                <th>البيان والوصف</th>
                                <th style={{textAlign:'center'}}>قيمة الفاتورة الأصلية</th>
                                <th style={{textAlign:'center'}}>نصيب المشروع</th>
                                <th style={{textAlign:'center'}}>نسبة التحميل</th>
                                <th>آلية التوزيع</th>
                            </tr>
                        </thead>
                        <tbody>
                            {group.items.map((item: any, idx: number) => (
                                <tr key={item.id || idx}>
                                    <td style={{width:'5rem'}}><span className="badge-month">{item["شهر التحميل المالي"]}</span></td>
                                    <td style={{width:'7.5rem'}}><span className="badge-category">{item["التصنيف الرئيسي"]}</span></td>
                                    <td><span style={{fontSize:'var(--fs-xs)', color:'#334155', fontWeight:700}}>{item["البيان / الوصف"]}</span></td>
                                    <td align="center"><span style={{color: '#94a3b8', textDecoration: 'line-through', fontSize:'var(--fs-xs)'}}>{formatCurrency(item["قيمة الفاتورة الأصلية (ر.س)"])}</span></td>
                                    <td align="center"><strong style={{color: '#b91c1c', fontSize:'var(--fs-sm)'}}>{formatCurrency(item["المبلغ المحمل (ر.س)"])}</strong></td>
                                    <td align="center"><span className="badge-percentage">{item["نسبة التحميل (%)"]}%</span></td>
                                    <td><span className="badge-mechanism">{item["آلية التوزيع"]}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default function ProjectOverheadPage() {
    const logic = useOverheadAllocationsLogic();

    return (
        <MasterPage title="تحميل التكاليف غير المباشرة (Overhead)" subtitle="عرض هرمي تحليلي لنصيب كل مشروع من المصروفات الإدارية والعمومية وتفاصيلها">
            
            <RawasiSidebarManager 
                summary={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        <div className="summary-glass-box border-red">
                            <span style={{fontSize:'var(--fs-xs)', fontWeight:800, color:'#dc2626'}}>إجمالي الأوفر هيد لجميع المشاريع</span>
                            <div style={{fontSize:'var(--fs-xl)', fontWeight:900, color: '#b91c1c', marginTop:'0.25rem'}}>{formatCurrency(logic.totalAllocatedOverhead)}</div>
                        </div>
                        <div className="summary-glass-box">
                            <span style={{fontSize:'var(--fs-xs)', fontWeight:800, color:'#64748b'}}>عدد المشاريع النشطة</span>
                            <div style={{fontSize:'var(--fs-xl)', fontWeight:900, color: '#1e293b', marginTop:'0.25rem'}}>{logic.groupedProjects.length} مشروع</div>
                        </div>
                    </div>
                }
                actions={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: 'white', display: 'block', marginBottom: '0.25rem' }}>تصفية بحسب المشروع</label>
                            <select value={logic.selectedProject} onChange={(e) => logic.setSelectedProject(e.target.value)} className="glass-dropdown">
                                <option value="">كل المشاريع</option>
                                {logic.uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: 'white', display: 'block', marginBottom: '0.25rem' }}>تصفية بحسب الشهر المالي</label>
                            <select value={logic.selectedMonth} onChange={(e) => logic.setSelectedMonth(e.target.value)} className="glass-dropdown">
                                <option value="">كل الشهور</option>
                                {logic.uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                }
                onSearch={logic.setGlobalSearch}
                placeholder="ابحث بالبيان، التصنيف أو المشروع..."
                watchDeps={[logic.filteredData.length, logic.selectedMonth, logic.selectedProject, logic.totalAllocatedOverhead]}
            />

            <style>{`
                .project-accordion { background: var(--surface-card); border-radius: var(--phi-radius-card, 18px); margin-bottom: 0.75rem; border: none; overflow: hidden; transition: all 0.2s ease; box-shadow: var(--shadow-ambient); }
                .project-accordion.expanded { border-color: #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 1rem; }
                
                .accordion-header { padding: 0.875rem 1.25rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: var(--surface-card); transition: all 0.2s ease; }
                .accordion-header:hover { background: #f1f5f9; }
                
                .icon-box { background: var(--surface-sunken); border: none; box-shadow: var(--shadow-sunken); border-radius: 8px; width: 2.25rem; height: 2.25rem; display: flex; align-items: center; justify-content: center; font-size: var(--fs-xl); }
                .toggle-arrow { font-size: var(--fs-sm); color: #94a3b8; background: #e2e8f0; width: 1.5rem; height: 1.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
                
                .accordion-body { padding: 0 1rem 1rem 1rem; background: var(--surface-card); border-top: 1px solid var(--table-zebra-bg, rgba(0,0,0,0.04)); overflow-x: auto; zoom: 0.9; }
                
                .nested-table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
                .nested-table th { background: var(--surface-sunken); color: var(--text-secondary); font-weight: 800; font-size: var(--fs-xs); padding: 0.625rem; text-align: right; border-bottom: 1px solid var(--table-zebra-bg, rgba(0,0,0,0.04)); white-space: nowrap; }
                .nested-table td { padding: 0.625rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                .nested-table tr:hover td { background: #f8fafc; }
                
                .summary-glass-box { background: rgba(255,255,255,0.8); padding: 0.625rem 0.75rem; border-radius: 12px; border: 1px solid rgba(0,0,0,0.04); }
                .summary-glass-box.border-red { border-left: 4px solid #dc2626; background: rgba(254,242,242,0.7); }
                .glass-dropdown { width: 100%; padding: 0.625rem; border-radius: 8px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: #1e293b; font-weight: 700; font-size: var(--fs-sm); outline: none; cursor: pointer; }
                .badge-month { background: #f1f5f9; color: #334155; padding: 0.1875rem 0.5rem; border-radius: 6px; font-weight: 800; font-size: var(--fs-xs); border: 1px solid #cbd5e1; display: inline-block; }
                .badge-category { background: rgba(79,70,229,0.06); color: #4f46e5; padding: 0.1875rem 0.5rem; border-radius: 6px; font-weight: 800; font-size: var(--fs-xs); display: inline-block; }
                .badge-percentage { background: #fef3c7; color: #b45309; padding: 0.1875rem 0.5rem; border-radius: 6px; font-weight: 900; font-size: var(--fs-xs); display: inline-block; }
                .badge-mechanism { background: #eff6ff; color: #2563eb; padding: 0.1875rem 0.5rem; border-radius: 6px; font-weight: 700; font-size: var(--fs-xs); border: 1px solid #bfdbfe; display: inline-block; }
            `}</style>

            {logic.isLoading ? (
                <LoadingScreen message="جاري تحليل وهندسة التكاليف..." fullScreen={false} />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {logic.paginatedGroups.map((group: any) => (
                        <ProjectGroupCard key={group.projectName} group={group} />
                    ))}

                    {/* Pagination البسيط للمشاريع */}
                    {logic.groupedProjects.length > logic.rowsPerPage && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.625rem', marginTop: '1.25rem' }}>
                            <button 
                                disabled={logic.currentPage === 1} 
                                onClick={() => logic.setCurrentPage(p => p - 1)}
                                style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: 'none', background: 'var(--surface-subcard)', boxShadow: 'var(--shadow-elevation)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 800 }}
                            >
                                السابق
                            </button>
                            <span style={{ padding: '0.5rem 1rem', fontWeight: 900, color: '#334155' }}>
                                صفحة {logic.currentPage} من {Math.ceil(logic.groupedProjects.length / logic.rowsPerPage)}
                            </span>
                            <button 
                                disabled={logic.currentPage === Math.ceil(logic.groupedProjects.length / logic.rowsPerPage)} 
                                onClick={() => logic.setCurrentPage(p => p + 1)}
                                style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: 'none', background: 'var(--surface-subcard)', boxShadow: 'var(--shadow-elevation)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 800 }}
                            >
                                التالي
                            </button>
                        </div>
                    )}
                </div>
            )}
            
        </MasterPage>
    );
}