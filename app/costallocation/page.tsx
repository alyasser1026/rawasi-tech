"use client";
import React, { useMemo, useEffect, useState } from 'react';
import { useAllocationViewLogic } from './allocation_logic';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers'; 
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import LoadingScreen from '@/components/LoadingScreen';

// 🎨 مكون تغليف الخلية لضغط المساحات وعرض الجدول بشكل سينمائي مريح للعين
const CompactCell = ({ children, justify = 'flex-start', isBold = false }: { children: React.ReactNode, justify?: string, isBold?: boolean }) => (
    <div style={{ 
        padding: '0.1875rem 0.375rem', borderRadius: '4px', height: '100%', minHeight: '1.625rem', 
        display: 'flex', alignItems: 'center', justifyContent: justify,
        fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontWeight: isBold ? 900 : 600, color: '#1e293b'
    }}>
        {children}
    </div>
);

export default function CostAllocationPage() {
    const logic = useAllocationViewLogic();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // 💎 ربط أعمدة الجدول بالمسميات (Aliases) الخارجة من الـ View بتاعك بالملي
    const tableColumns = useMemo(() => [
        { 
            key: 'month', label: 'شهر التحميل', 
            render: (row: any) => <CompactCell justify="center"><span className="badge-month">{row["شهر التحميل المالي"]}</span></CompactCell> 
        },
        { 
            key: 'villa_boq', label: 'المشروع وبند الموازنة المتأثر', 
            // 🎯 تم دمج الفيلا والبند هنا بشكل احترافي
            render: (row: any) => (
                <CompactCell justify="flex-start">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1875rem' }}>
                        <span style={{ fontWeight: 900, color: '#1e293b', fontSize: 'var(--fs-sm)' }}>
                            {row["اسم الفيلا المحمل عليها"] || 'عام/غير موزع'}
                        </span>
                        <span style={{ fontSize: 'var(--fs-xs)', color: '#c2410c', fontWeight: 800 }}>
                            بند: {row["البند المحمل عليه"] || 'مصروف عام (لم يوجه لبند)'}
                        </span>
                    </div>
                </CompactCell>
            )
        },
        { 
            key: 'category', label: 'التصنيف الرئيسي', 
            render: (row: any) => <CompactCell><span style={{color: THEME.primary}}>{row["التصنيف الرئيسي"]}</span></CompactCell> 
        },
        { 
            key: 'desc', label: 'وصف المصروف', 
            render: (row: any) => <CompactCell><span style={{color: '#475569', fontSize:'var(--fs-xs)'}}>{row["البيان / الوصف"]}</span></CompactCell> 
        },
        { 
            key: 'percentage', label: 'نسبة الاستهلاك', 
            // 🎯 عرض النسبة المئوية لتحميل التكلفة على البند
            render: (row: any) => <CompactCell justify="center"><span style={{ fontWeight: 900, color: '#64748b' }}>{row["نسبة التحميل (%)"]}%</span></CompactCell> 
        },
        { 
            key: 'amount', label: 'التكلفة المحملة للبند', 
            render: (row: any) => (
                <CompactCell justify="center">
                    <strong style={{color: '#16a34a', background: 'rgba(22,163,74,0.08)', padding: '0.25rem 0.625rem', borderRadius: '6px', fontSize:'var(--fs-sm)'}}>
                        {formatCurrency(row["المبلغ المحمل (جنيه)"])}
                    </strong>
                </CompactCell>
            ) 
        },
        { 
            key: 'mechanism', label: 'آلية التوزيع (حسب التواجد)', 
            render: (row: any) => <CompactCell><span className="badge-mechanism">{row["آلية التوزيع"]}</span></CompactCell> 
        }
    ], []);

    return (
        <MasterPage title="شاشة توزيع المصروفات والتكاليف (ABC)" subtitle="توزيع تلقائي لتكاليف الشركة والمشاريع على بنود الموازنة بناءً على حجم تواجد العمالة">
            
            <RawasiSidebarManager 
                summary={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div className="summary-glass-box">
                            <span style={{fontSize:'var(--fs-xs)', fontWeight:800, color:'#64748b'}}>إجمالي المبالغ الموزعة</span>
                            <div style={{fontSize:'var(--fs-xl)', fontWeight:900, color: '#16a34a', marginTop:'0.25rem'}}>{formatCurrency(logic.totalAllocatedAmount)}</div>
                        </div>
                        <div className="summary-glass-box">
                            <span style={{fontSize:'var(--fs-xs)', fontWeight:800, color:'#64748b'}}>عدد القيود المحملة</span>
                            <div style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: THEME.primary, marginTop:'0.25rem'}}>{logic.filteredData.length} قيد</div>
                        </div>
                    </div>
                }
                actions={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'white', display: 'block' }}>تصفية بحسب الشهر المالي</label>
                        <select 
                            value={logic.selectedMonth} 
                            onChange={(e) => logic.setSelectedMonth(e.target.value)} 
                            className="glass-dropdown"
                        >
                            <option value="">كل الشهور المالية</option>
                            {logic.uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                }
                onSearch={logic.setGlobalSearch}
                placeholder="ابحث باسم الفيلا، البند، أو الوصف..."
                watchDeps={[logic.filteredData.length, logic.selectedMonth, logic.totalAllocatedAmount]}
            />

            <style>{`
                /* تنسيقات الشاشة الاحترافية المدمجة */
                .compact-table-holder {
                    width: 100%; overflow-x: hidden !important; zoom: 0.82; background: white; border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.02); padding: 0.5rem;
                }
                .summary-glass-box { background: rgba(255,255,255,0.6); padding: 0.75rem; border-radius: 12px; border: 1px solid rgba(0,0,0,0.04); }
                .glass-dropdown {
                    width: 100%; padding: 0.625rem; border-radius: 10px; background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3); color: #1e293b; font-weight: 700; font-size: var(--fs-sm); outline: none; cursor: pointer;
                }
                .glass-dropdown option { background: white; color: #1e293b; }
                .badge-month { background: #f1f5f9; color: #334155; padding: 2px 0.375rem; border-radius: 4px; font-weight: 900; font-size: var(--fs-xs); border: 1px solid #cbd5e1; }
                .badge-mechanism { background: #eff6ff; color: #2563eb; padding: 0.25rem 0.5rem; border-radius: 6px; font-weight: 800; font-size: var(--fs-xs); border: 1px solid #bfdbfe; word-break: break-all; }
            `}</style>

            {logic.isLoading ? (
                <LoadingScreen message="جاري تشغيل محرك التوزيع وسحب كشف الحساب..." fullScreen={false} />
            ) : (
                <div className="compact-table-holder cinematic-scroll">
                    <RawasiSmartTable 
                        data={logic.filteredData} /* 🎯 التعديل هنا: نبعت الداتا كلها للجدول بدل الداتا المقصوصة */
                        columns={tableColumns}
                        enablePagination={true}
                        currentPage={logic.currentPage}
                        totalItems={logic.filteredData.length}
                        rowsPerPage={logic.rowsPerPage}
                        onPageChange={logic.setCurrentPage}
                        onRowsChange={logic.setRowsPerPage}
                    />
                </div>
            )}
            
        </MasterPage>
    );
}