"use client";
import React, { useMemo, useState, useRef, useEffect } from 'react';
import MasterPage from '@/components/MasterPage';
import { formatCurrency } from '@/lib/helpers';
import { useCashFlowsLogic } from './cash_flows_logic';
import * as XLSX from 'xlsx';
import LoadingScreen from '@/components/LoadingScreen';
import { Download, Upload, Scale, Eye } from 'lucide-react';
import { notify } from '@/lib/notify';

// =========================================================================
// 🧩 مكون ذكي للقائمة المنسدلة متعددة الاختيارات
// =========================================================================
const MultiSelectDropdown = ({ options, selected, onChange, placeholder, title }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: any) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt: string) => opt.toLowerCase().includes(search.toLowerCase()));

    const handleToggle = (opt: string) => {
        if (selected.includes(opt)) {
            onChange(selected.filter((item: string) => item !== opt));
        } else {
            onChange([...selected, opt]);
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', flex: 1, minWidth: '12.5rem' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, marginBottom: '0.375rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{title}</span>
                {selected.length > 0 && (
                    <span 
                        style={{ color: 'var(--status-negative)', cursor: 'pointer', fontSize: 'var(--fs-xs)', background: 'color-mix(in srgb, var(--status-negative) 10%, var(--surface-flat))', padding: '2px 0.375rem', borderRadius: '4px' }}
                        onClick={() => onChange([])}
                    >
                        إلغاء ({selected.length})
                    </span>
                )}
            </div>
            
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{ background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sunken)', padding: '0.75rem 1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s', height: '3.125rem' }}
            >
                <span style={{ fontWeight: 800, color: selected.length ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected.length > 0 ? selected.join('، ') : placeholder}
                </span>
                <span style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
            </div>
            
            {isOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-card)', border: 'none', borderRadius: '14px', marginTop: '0.5rem', zIndex: 50, boxShadow: 'var(--shadow-elevation)', overflow: 'hidden' }}>
                    <div style={{ padding: '0.625rem', background: 'var(--surface-subcard)', borderBottom: '1px solid var(--table-zebra-bg)' }}>
                        <input 
                            type="text" 
                            placeholder="بحث سريع..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sunken)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}
                        />
                    </div>
                    <div className="cashflows-dropdown-scroll" style={{ maxHeight: '13.75rem', overflowY: 'auto', padding: '0.3125rem' }}>
                        {filteredOptions.length > 0 ? filteredOptions.map((opt: string) => (
                            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.625rem', cursor: 'pointer', borderRadius: '6px', background: selected.includes(opt) ? 'var(--accent-soft-bg)' : 'transparent', transition: '0.2s' }}>
                                <input 
                                    type="checkbox" 
                                    checked={selected.includes(opt)} 
                                    onChange={() => handleToggle(opt)} 
                                    style={{ accentColor: 'var(--accent-main)', transform: 'scale(1.2)', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: selected.includes(opt) ? 'var(--accent-ink)' : 'var(--text-primary)' }}>{opt}</span>
                            </label>
                        )) : (
                            <div style={{ padding: '0.9375rem', textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>لا توجد نتائج مطابقة</div>
                        )}
                    </div>
                </div>
            )}
            <style>{`
                .cashflows-dropdown-scroll::-webkit-scrollbar { width: 0.375rem; }
                .cashflows-dropdown-scroll::-webkit-scrollbar-track { background: var(--surface-sunken); border-radius: 4px; }
                .cashflows-dropdown-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
                .cashflows-dropdown-scroll::-webkit-scrollbar-thumb:hover { background: var(--accent-ink); }
            `}</style>
        </div>
    );
};

export default function CashFlowsPage() {
    const logic = useCashFlowsLogic();
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedPartners, setSelectedPartners] = useState<string[]>([]); 
    const [groupBy, setGroupBy] = useState<'partner' | 'date'>('partner');

    const toggleGroup = (groupName: string) => {
        if (expandedGroups.includes(groupName)) {
            setExpandedGroups(expandedGroups.filter(g => g !== groupName));
        } else {
            setExpandedGroups([...expandedGroups, groupName]);
        }
    };

    const uniqueProjects = useMemo(() => {
        const projects = logic.cashFlows.map((row: any) => row.project?.Property).filter(Boolean);
        return Array.from(new Set(projects)) as string[];
    }, [logic.cashFlows]);

    const uniquePartners = useMemo(() => {
        const partners = logic.cashFlows.map((row: any) => row.partner?.name).filter(Boolean);
        return Array.from(new Set(partners)) as string[];
    }, [logic.cashFlows]);

    const parseAmount = (val: any) => Math.abs(Number(String(val).replace(/,/g, '')) || 0);
    
    const getFlowDirection = (row: any) => {
        const type = String(row.flow_type || '').toLowerCase().trim();
        const source = String(row.source_type || '').toLowerCase().trim();
        const rawAmount = Number(String(row.amount).replace(/,/g, '')) || 0;

        if (['inflow', 'in', 'وارد', 'مقبوضات', 'قبض'].includes(type) || source === 'receipt_voucher') return 'inflow';
        if (['outflow', 'out', 'منصرف', 'مدفوعات', 'صرف'].includes(type) || source === 'payment_voucher') return 'outflow';
        
        if (rawAmount > 0) return 'inflow';
        if (rawAmount < 0) return 'outflow';

        return 'inflow';
    };

    // 🚀 الفلترة المحدثة (دقيقة التواريخ وتمنع التكرار نهائياً)
    const filteredData = useMemo(() => {
        // 1. منع التكرار (Deduplication) - بيشيل أي ID مكرر قبل الفلترة
        const uniqueItems = new Map();
        logic.cashFlows.forEach((row: any) => {
            if (row.id) uniqueItems.set(row.id, row);
        });
        const cleanData = Array.from(uniqueItems.values());

        // 2. تطبيق الفلاتر
        return cleanData.filter((row: any) => {
            const searchString = `${row.description || ''} ${row.reference_number || ''} ${row.project?.Property || ''} ${row.partner?.name || ''} ${row.sub_category || ''}`.toLowerCase();
            const matchesSearch = searchString.includes(logic.searchTerm.toLowerCase());

            const direction = getFlowDirection(row);
            const matchesType = logic.filterType === 'all' ? true : direction === logic.filterType;

            // 3. مقارنة التواريخ كأرقام (Timestamp) لضمان دقة 100%
            let matchesDateFrom = true;
            let matchesDateTo = true;

            if (row.transaction_date) {
                const rowDate = new Date(row.transaction_date).setHours(0, 0, 0, 0); // توحيد وقت التاريخ
                
                if (logic.dateFrom) {
                    const fromDate = new Date(logic.dateFrom).setHours(0, 0, 0, 0);
                    matchesDateFrom = rowDate >= fromDate;
                }
                
                if (logic.dateTo) {
                    const toDate = new Date(logic.dateTo).setHours(23, 59, 59, 999);
                    matchesDateTo = rowDate <= toDate;
                }
            } else if (logic.dateFrom || logic.dateTo) {
                return false; 
            }

            const projectName = row.project?.Property;
            const matchesProject = selectedProjects.length === 0 || (projectName && selectedProjects.includes(projectName));

            const partnerName = row.partner?.name;
            const matchesPartner = selectedPartners.length === 0 || (partnerName && selectedPartners.includes(partnerName));

            return matchesSearch && matchesType && matchesDateFrom && matchesDateTo && matchesProject && matchesPartner;
        });
    }, [logic.cashFlows, logic.searchTerm, logic.filterType, logic.dateFrom, logic.dateTo, selectedProjects, selectedPartners]);

    // 🚀 الإحصائيات المحدثة (بتعتمد دلوقتي على filteredData النظيفة والمفلترة)
    const summaryStats = useMemo(() => {
        let totalIn = 0;
        let totalOut = 0;
        let receiptVouchersTotal = 0;
        let paymentVouchersTotal = 0;
        let otherInflowsTotal = 0;
        let otherOutflowsTotal = 0;

        filteredData.forEach((row: any) => {
            const amount = parseAmount(row.amount);
            const direction = getFlowDirection(row);
            const source = String(row.source_type || '').toLowerCase().trim();

            if (direction === 'inflow') {
                totalIn += amount;
                if (source === 'receipt_voucher') receiptVouchersTotal += amount;
                else otherInflowsTotal += amount;
            } else if (direction === 'outflow') {
                totalOut += amount;
                if (source === 'payment_voucher') paymentVouchersTotal += amount;
                else otherOutflowsTotal += amount;
            }
        });

        return { 
            totalIn, 
            totalOut, 
            netCash: totalIn - totalOut,
            receiptVouchersTotal,
            paymentVouchersTotal,
            otherInflowsTotal,
            otherOutflowsTotal
        };
    }, [filteredData]);

    const treeGroupedData = useMemo(() => {
        const groups: { [key: string]: { name: string, totalIn: number, totalOut: number, items: any[] } } = {};

        const sortedData = [...filteredData];
        if (groupBy === 'date') {
            sortedData.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
        }

        sortedData.forEach((row: any) => {
            let groupName = 'بدون تصنيف';
            if (groupBy === 'partner') {
                groupName = row.partner?.name || 'حركات عامة (بدون شريك محدد)';
            } else if (groupBy === 'date') {
                groupName = row.transaction_date 
                    ? new Date(row.transaction_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'تاريخ غير محدد';
            }

            if (!groups[groupName]) {
                groups[groupName] = { name: groupName, totalIn: 0, totalOut: 0, items: [] };
            }

            const amount = parseAmount(row.amount);
            const direction = getFlowDirection(row);

            if (direction === 'inflow') groups[groupName].totalIn += amount;
            else if (direction === 'outflow') groups[groupName].totalOut += amount;
            
            groups[groupName].items.push(row);
        });

        return Object.values(groups);
    }, [filteredData, groupBy]);

    const handleExportExcel = () => {
        if (!filteredData || filteredData.length === 0) return notify("لا توجد بيانات لتصديرها!");

        const excelData = filteredData.map((row: any) => {
            const direction = getFlowDirection(row);
            return {
                'التاريخ': row.transaction_date ? String(row.transaction_date).substring(0, 10) : '---',
                'نوع التدفق': direction === 'inflow' ? 'وارد (+)' : 'منصرف (-)',
                'المبلغ': parseAmount(row.amount),
                'التصنيف': row.category || '---',
                'البيان الفرعي': row.sub_category || '---',
                'طريقة الدفع': row.payment_method || '---',
                'رقم المرجع': row.reference_number || '---',
                'الخزينة/البنك': row.account?.name || '---',
                'المشروع المربوط': row.project?.Property || '---',
                'العميل / المورد': row.partner?.name || '---',
                'ملاحظات': row.description || '---',
                'المصدر': row.source_type === 'receipt_voucher' ? 'سند قبض' : row.source_type === 'payment_voucher' ? 'سند صرف' : 'أخرى'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "التدفقات النقدية");
        
        worksheet['!cols'] = [{wch: 15}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 35}, {wch: 15}, {wch: 15}, {wch: 25}, {wch: 25}, {wch: 25}, {wch: 40}, {wch: 15}];
        worksheet['!dir'] = 'rtl';
        XLSX.writeFile(workbook, `تقرير_التدفقات_النقدية_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil((treeGroupedData.length || 0) / rowsPerPage) || 1;

    useEffect(() => { setCurrentPage(1); }, [filteredData.length, logic.searchTerm, logic.filterType, logic.dateFrom, logic.dateTo, selectedProjects, selectedPartners, groupBy]);

    const paginatedGroups = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return treeGroupedData.slice(startIndex, startIndex + rowsPerPage);
    }, [treeGroupedData, currentPage, rowsPerPage]);

    return (
        <div className="clean-page enterprise-page cashflows-register" style={{ minHeight: '100vh', paddingBottom: '3.125rem' }}>
            <MasterPage title="التدفقات النقدية (Cash Flows)" subtitle="مراقبة حركات السيولة، المقبوضات، والمدفوعات بشكل لحظي وتجميعي">
                
                <style>{`
                    .cashflows-register .summary-card {
                        background: var(--surface-card);
                        border-radius: var(--phi-radius-card, 18px);
                        padding: 1.5625rem;
                        flex: 1 1 13rem;
                        border: none !important;
                        box-shadow: var(--shadow-ambient);
                        position: relative;
                        overflow: hidden;
                    }
                    .cashflows-register .summary-card::before {
                        content: '';
                        position: absolute;
                        top: 0; left: 8%; right: 8%;
                        height: 1.5px;
                        background: var(--specular-beam);
                        pointer-events: none;
                        z-index: 5;
                    }
                    .cashflows-register .summary-card.inflow {
                        background: radial-gradient(ellipse 100% 60% at 50% -10%, color-mix(in srgb, var(--status-positive) 16%, transparent), transparent 75%), var(--surface-card) !important;
                    }
                    .cashflows-register .summary-card.outflow {
                        background: radial-gradient(ellipse 100% 60% at 50% -10%, color-mix(in srgb, var(--status-negative) 16%, transparent), transparent 75%), var(--surface-card) !important;
                    }
                    .cashflows-register .summary-card.net {
                        background: radial-gradient(ellipse 100% 60% at 50% -10%, color-mix(in srgb, var(--action-fill) 18%, transparent), transparent 75%), var(--surface-card) !important;
                    }

                    .cashflows-register .summary-label { font-size: var(--fs-md); font-weight: 900; color: var(--text-primary); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
                    .cashflows-register .summary-val { font-size: var(--fs-3xl); font-weight: 900; color: var(--text-primary); }

                    .cashflows-register .source-breakdown-card {
                        background: var(--surface-card);
                        padding: 1.25rem 1.5rem;
                        border-radius: 16px;
                        border: none !important;
                        box-shadow: var(--shadow-ambient);
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        flex: 1 1 13.75rem;
                        position: relative;
                        overflow: hidden;
                    }
                    .cashflows-register .source-breakdown-card.inflow {
                        background: radial-gradient(ellipse 90% 70% at 0% 50%, color-mix(in srgb, var(--status-positive) 14%, transparent), transparent 80%), var(--surface-card) !important;
                    }
                    .cashflows-register .source-breakdown-card.outflow {
                        background: radial-gradient(ellipse 90% 70% at 0% 50%, color-mix(in srgb, var(--status-negative) 14%, transparent), transparent 80%), var(--surface-card) !important;
                    }
                    .cashflows-register .source-breakdown-title { font-size: var(--fs-sm); font-weight: 900; color: var(--text-primary); margin-bottom: 0.5rem; }
                    .cashflows-register .source-breakdown-val { font-size: var(--fs-xl); font-weight: 900; }

                    .cashflows-register .filter-card-container {
                        display: flex;
                        gap: 0.9375rem;
                        margin-bottom: 1.875rem;
                        background: var(--surface-card);
                        padding: clamp(0.875rem, 3vw, 1.5625rem);
                        border-radius: var(--phi-radius-card, 18px);
                        border: none !important;
                        box-shadow: var(--shadow-ambient);
                        flex-wrap: wrap;
                        align-items: flex-end;
                        position: relative;
                        overflow: hidden;
                    }
                    .cashflows-register .filter-card-container::before {
                        content: '';
                        position: absolute;
                        top: 0; left: 8%; right: 8%;
                        height: 1.5px;
                        background: var(--specular-beam);
                        pointer-events: none;
                    }

                    .cashflows-register .filter-input {
                        width: 100%;
                        padding: 0.75rem 1rem;
                        border-radius: 12px;
                        border: none !important;
                        font-weight: 800;
                        color: var(--text-primary);
                        height: 3.125rem;
                        background: var(--surface-sunken);
                        box-shadow: var(--shadow-sunken);
                        outline: none;
                        transition: all 0.2s ease;
                    }
                    .cashflows-register .filter-input:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 1px; }

                    .cashflows-register .tree-scroll {
                        overflow-x: auto;
                        border: none !important;
                        border-radius: var(--phi-radius-card, 18px);
                        background: var(--surface-card);
                        box-shadow: var(--shadow-ambient);
                        position: relative;
                        overflow: hidden;
                    }
                    .cashflows-register .tree-scroll::before {
                        content: '';
                        position: absolute;
                        top: 0; left: 8%; right: 8%;
                        height: 1.5px;
                        background: var(--specular-beam);
                        pointer-events: none;
                    }
                    .cashflows-register .tree-table { width: 100%; min-width: 42rem; border-collapse: separate; border-spacing: 0; text-align: center; color: var(--text-primary); }
                    .cashflows-register .tree-thead th { padding: 1.25rem 0.9375rem; font-size: var(--fs-lg); font-weight: 900; border: none; }

                    .cashflows-register .master-group-row { cursor: pointer; }
                    .cashflows-register .master-group-row:hover { background: var(--table-row-hover); }
                    .cashflows-register .master-group-row td { padding: 1.25rem 1rem; font-size: var(--fs-lg); font-weight: 900; border-bottom: 1px solid var(--table-zebra-bg); }

                    .cashflows-register .child-tree-container { background: var(--surface-subcard); padding: 1.25rem clamp(0.75rem, 3vw, 2.5rem); border-bottom: 1px solid var(--table-zebra-bg); }
                    .cashflows-register .child-table { width: 100%; border-collapse: separate; border-spacing: 0; background: var(--surface-flat); border-radius: 14px; border: none !important; box-shadow: var(--shadow-elevation); overflow: hidden; }
                    .cashflows-register .child-table th { background: var(--table-head-bg); color: var(--text-primary); padding: 0.9375rem; font-size: var(--fs-sm); font-weight: 900; border-bottom: 1px solid var(--table-zebra-bg); }
                    .cashflows-register .child-table td { padding: 0.9375rem 0.75rem; border-bottom: 1px solid var(--table-zebra-bg); font-size: var(--fs-sm); font-weight: 800; color: var(--text-primary); }
                    .cashflows-register .child-table tr:hover { background: var(--table-row-hover); }

                    .cashflows-register .arrow-icon { display: inline-block; transition: transform 0.3s; margin-inline-end: 0.75rem; color: var(--accent-ink); font-size: var(--fs-lg); background: var(--accent-soft-bg); width: 1.75rem; height: 1.75rem; line-height: 1.75rem; text-align: center; border-radius: 50%; }
                    .cashflows-register .arrow-expanded { transform: rotate(90deg); background: var(--action-fill); color: var(--action-ink); }

                    .cashflows-register .view-toggle-track {
                        display: flex;
                        background: var(--surface-sunken);
                        box-shadow: var(--shadow-sunken);
                        border-radius: 12px;
                        padding: 4px;
                        gap: 4px;
                        border: none !important;
                        flex: 1;
                    }
                    .cashflows-register .view-toggle-btn {
                        flex: 1;
                        padding: 0.625rem 1rem;
                        font-size: var(--fs-sm);
                        font-weight: 800;
                        border: none !important;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                        background: transparent;
                        color: var(--text-secondary);
                    }
                    .cashflows-register .view-toggle-btn.active {
                        background: var(--action-fill) !important;
                        color: var(--action-ink) !important;
                        box-shadow: 0 4px 12px -2px var(--accent-glow);
                    }
                    .cashflows-register .view-toggle-btn:not(.active):hover {
                        background: var(--surface-card-hover);
                        color: var(--text-primary);
                    }
                `}</style>

                {/* 📊 بطاقات الملخص الرئيسية */}
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.9375rem', flexWrap: 'wrap' }}>
                    <div className="summary-card inflow">
                        <div className="summary-label"><span><Download size={16} aria-hidden="true" /></span> إجمالي الوارد (المقبوضات)</div>
                        <div className="summary-val" style={{ color: 'var(--status-positive)' }}>{formatCurrency(summaryStats.totalIn)}</div>
                    </div>
                    
                    <div className="summary-card outflow">
                        <div className="summary-label"><span><Upload size={16} aria-hidden="true" /></span> إجمالي المنصرف (المدفوعات)</div>
                        <div className="summary-val" style={{ color: 'var(--status-negative)' }}>{formatCurrency(summaryStats.totalOut)}</div>
                    </div>

                    <div className="summary-card net">
                        <div className="summary-label"><span><Scale size={16} aria-hidden="true" /></span> صافي التدفق النقدي (Net)</div>
                        <div className="summary-val" style={{ color: summaryStats.netCash >= 0 ? 'var(--status-positive)' : 'var(--status-negative)' }}>
                            {summaryStats.netCash > 0 ? '+' : ''}{formatCurrency(summaryStats.netCash)}
                        </div>
                    </div>

                    {/* 🎛️ أزرار طرق العرض - مدمجة في صف السامري */}
                    <div className="summary-card" style={{ flex: '1.2 1 13rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div className="summary-label"><span><Eye size={16} aria-hidden="true" /></span> طريقة التجميع والعرض</div>
                        <div className="view-toggle-track">
                            <button 
                                className={`view-toggle-btn ${groupBy === 'partner' ? 'active' : ''}`} 
                                onClick={() => {setGroupBy('partner'); setExpandedGroups([]);}}
                            >
                                تجميع بالاسم
                            </button>
                            <button 
                                className={`view-toggle-btn ${groupBy === 'date' ? 'active' : ''}`} 
                                onClick={() => {setGroupBy('date'); setExpandedGroups([]);}}
                            >
                                تجميع بالتاريخ
                            </button>
                        </div>
                    </div>
                </div>

                {/* 🔍 تفاصيل المصادر (Breakdown) */}
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5625rem', flexWrap: 'wrap', padding: '0.3125rem' }}>
                    <div className="source-breakdown-card inflow">
                        <div>
                            <div className="source-breakdown-title">مقبوضات من (سندات القبض)</div>
                            <div className="source-breakdown-val" style={{ color: 'var(--status-positive)' }}>{formatCurrency(summaryStats.receiptVouchersTotal)}</div>
                        </div>
                    </div>

                    <div className="source-breakdown-card outflow">
                        <div>
                            <div className="source-breakdown-title">مدفوعات من (سندات الصرف)</div>
                            <div className="source-breakdown-val" style={{ color: 'var(--status-negative)' }}>{formatCurrency(summaryStats.paymentVouchersTotal)}</div>
                        </div>
                    </div>

                    <div className="source-breakdown-card inflow">
                        <div>
                            <div className="source-breakdown-title">إيداعات من (مصادر أخرى)</div>
                            <div className="source-breakdown-val" style={{ color: 'var(--status-positive)' }}>{formatCurrency(summaryStats.otherInflowsTotal)}</div>
                        </div>
                    </div>

                    <div className="source-breakdown-card outflow">
                        <div>
                            <div className="source-breakdown-title">سحوبات من (مصادر أخرى)</div>
                            <div className="source-breakdown-val" style={{ color: 'var(--status-negative)' }}>{formatCurrency(summaryStats.otherOutflowsTotal)}</div>
                        </div>
                    </div>
                </div>



                {/* 🔍 شريط الفلاتر */}
                <div className="filter-card-container">
                    
                    <div style={{ flex: '1', minWidth: '11.25rem' }}>
                        <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: 'var(--text-secondary)', marginBottom: '0.375rem', display: 'block' }}>بحث عام</label>
                        <input 
                            type="text" 
                            className="filter-input"
                            placeholder="بحث بالبيان، المرجع..." 
                            value={logic.searchTerm}
                            onChange={(e) => logic.setSearchTerm(e.target.value)}
                        />
                    </div>

                    <MultiSelectDropdown 
                        title="التوجيه (الفيلا)"
                        placeholder="كل التوجيهات"
                        options={uniqueProjects}
                        selected={selectedProjects}
                        onChange={setSelectedProjects}
                    />

                    <MultiSelectDropdown 
                        title="الشريك (عميل/مورد)"
                        placeholder="كل الشركاء"
                        options={uniquePartners}
                        selected={selectedPartners}
                        onChange={setSelectedPartners}
                    />
                    
                    <div style={{ width: '9.5rem' }}>
                        <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: 'var(--text-secondary)', marginBottom: '0.375rem', display: 'block' }}>نوع الحركة</label>
                        <select className="filter-input" value={logic.filterType} onChange={(e) => logic.setFilterType(e.target.value)}>
                            <option value="all">كل الحركات</option>
                            <option value="inflow">وارد (مقبوضات)</option>
                            <option value="outflow">منصرف (مدفوعات)</option>
                        </select>
                    </div>

                    <div style={{ width: '9.5rem' }}>
                        <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: 'var(--text-secondary)', marginBottom: '0.375rem', display: 'block' }}>من تاريخ</label>
                        <input type="date" className="filter-input" value={logic.dateFrom} onChange={(e) => logic.setDateFrom(e.target.value)} />
                    </div>

                    <div style={{ width: '9.5rem' }}>
                        <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: 'var(--text-secondary)', marginBottom: '0.375rem', display: 'block' }}>إلى تاريخ</label>
                        <input type="date" className="filter-input" value={logic.dateTo} onChange={(e) => logic.setDateTo(e.target.value)} />
                    </div>

                    <button 
                        onClick={handleExportExcel}
                        className="ent-button ent-primary"
                        style={{ height: '3.125rem', padding: '0 1.25rem' }}
                    >
                        <Download size={16} aria-hidden="true" />
                        <span>تصدير Excel</span>
                    </button>
                </div>

                {/* 🌳 جدول الشجرة التجميعي */}
                {logic.isLoading ? (
                    <LoadingScreen message="جاري تحميل شجرة التدفقات النقدية..." fullScreen={false} />
                ) : (
                    <div className="tree-scroll">
                    <table className="tree-table">
                        <thead className="tree-thead">
                            <tr>
                                <th style={{ textAlign: 'right', width: '35%', paddingRight: '1.875rem' }}>
                                    {groupBy === 'partner' ? 'اسم الشريك (مقاول / مورد / عميل)' : 'التاريخ الزمني'}
                                </th>
                                <th style={{ width: '15%' }}>المقبوضات</th>
                                <th style={{ width: '15%' }}>المدفوعات</th>
                                <th style={{ width: '20%' }}>الصافي</th>
                                <th style={{ width: '15%' }}>الحركات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedGroups.map((group) => {
                                const isExpanded = expandedGroups.includes(group.name);
                                const netGroupAmount = group.totalIn - group.totalOut;

                                return (
                                    <React.Fragment key={group.name}>
                                        <tr className="master-group-row" onClick={() => toggleGroup(group.name)}>
                                            <td style={{ textAlign: 'right', color: 'var(--text-primary)', paddingRight: '1.25rem' }}>
                                                <span className={`arrow-icon ${isExpanded ? 'arrow-expanded' : ''}`}>◀</span>
                                                {group.name}
                                            </td>
                                            <td style={{ color: 'var(--status-positive)' }}>{formatCurrency(group.totalIn)}</td>
                                            <td style={{ color: 'var(--status-negative)' }}>{formatCurrency(group.totalOut)}</td>
                                            <td style={{ color: netGroupAmount >= 0 ? 'var(--status-positive)' : 'var(--status-negative)', fontWeight: 900 }}>
                                                {netGroupAmount > 0 ? '+' : ''}{formatCurrency(netGroupAmount)}
                                            </td>
                                            <td>
                                                <span style={{ background: 'var(--surface-subcard)', padding: '0.375rem 0.9375rem', borderRadius: '14px', fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
                                                    {group.items.length} حركة
                                                </span>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={5} style={{ padding: 0, background: 'transparent' }}>
                                                    <div className="child-tree-container">
                                                        <table className="child-table">
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ width: '12%' }}>التاريخ</th>
                                                                    <th style={{ width: '15%' }}>نوع الحركة</th>
                                                                    <th style={{ width: '15%' }}>المبلغ</th>
                                                                    <th style={{ width: '20%', textAlign: 'right' }}>المشروع / التوجيه</th>
                                                                    <th style={{ width: '23%', textAlign: 'right' }}>البيان المالي والمرجع</th>
                                                                    <th style={{ width: '15%' }}>الخزينة / الحساب البنكي</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {group.items.map((item: any) => {
                                                                    const direction = getFlowDirection(item);
                                                                    const isChildInflow = direction === 'inflow';
                                                                    const itemAmount = parseAmount(item.amount);
                                                                    return (
                                                                        <tr key={item.id}>
                                                                            <td>{item.transaction_date ? String(item.transaction_date).substring(0, 10) : '---'}</td>
                                                                            <td>
                                                                                <span style={{ color: isChildInflow ? 'var(--status-positive)' : 'var(--status-negative)', fontSize: 'var(--fs-xs)', fontWeight: 900, background: isChildInflow ? 'color-mix(in srgb, var(--status-positive) 10%, var(--surface-flat))' : 'color-mix(in srgb, var(--status-negative) 10%, var(--surface-flat))', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
                                                                                    {isChildInflow ? 'إيداع / قبض' : 'صرف / مدفوعات'}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ fontWeight: 900, color: isChildInflow ? 'var(--status-positive)' : 'var(--status-negative)' }}>
                                                                                {isChildInflow ? '+' : '-'}{formatCurrency(itemAmount)}
                                                                            </td>
                                                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--status-info)' }}>
                                                                                {item.project?.Property ? `${item.project.Property}` : '---'}
                                                                            </td>
                                                                            <td style={{ textAlign: 'right' }}>
                                                                                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.sub_category}</div>
                                                                                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                                                    {item.payment_method} {item.reference_number ? `| مرجع: ${item.reference_number}` : ''}
                                                                                </div>
                                                                                {item.description && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{item.description}</div>}
                                                                            </td>
                                                                            <td>
                                                                                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--accent-ink)' }}>
                                                                                    {item.account?.name || 'حساب عام'}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            
                            {treeGroupedData.length > 0 && (
                                <tr style={{ background: 'var(--accent-soft-bg)', backdropFilter: 'blur(5px)' }}>
                                    <td style={{ padding: '1.5625rem', fontWeight: 900, color: 'var(--text-primary)', textAlign: 'left' }}>الإجمالي الكلي للصفحة والفلتر:</td>
                                    <td style={{ fontWeight: 900, color: 'var(--status-positive)', fontSize: 'var(--fs-xl)' }}>{formatCurrency(summaryStats.totalIn)}</td>
                                    <td style={{ fontWeight: 900, color: 'var(--status-negative)', fontSize: 'var(--fs-xl)' }}>{formatCurrency(summaryStats.totalOut)}</td>
                                    <td style={{ fontWeight: 900, color: summaryStats.netCash >= 0 ? 'var(--status-positive)' : 'var(--status-negative)', fontSize: 'var(--fs-xl)' }}>{formatCurrency(summaryStats.netCash)}</td>
                                    <td></td>
                                </tr>
                            )}

                            {treeGroupedData.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '2.5rem', color: 'var(--text-muted)', fontWeight: 900, background: 'var(--surface-card)' }}>لا توجد أي تدفقات نقدية مطابقة للفلاتر الحالية</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                )}

                {/* 🔢 تقسيم الصفحات */}
                {!logic.isLoading && treeGroupedData.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.25rem', padding: '1.25rem', background: 'var(--surface-card)', borderRadius: 'var(--phi-radius-card, 18px)', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
                        <div style={{ fontSize: 'var(--fs-md)', color: 'var(--text-primary)', fontWeight: 900 }}>
                            إجمالي الـ {groupBy === 'partner' ? 'الشركاء' : 'أيام الحركة'}: <b style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-xl)' }}>{treeGroupedData.length}</b>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.9375rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select 
                                value={rowsPerPage} 
                                onChange={(e) => {setRowsPerPage(Number(e.target.value)); setCurrentPage(1);}} 
                                style={{ padding: '0.625rem 0.9375rem', borderRadius: '10px', border: 'none', boxShadow: 'var(--shadow-sunken)', fontWeight: 900, cursor: 'pointer', background: 'var(--surface-sunken)', color: 'var(--text-primary)' }}
                            >
                                <option value={10}>عرض 10 عناصر</option>
                                <option value={50}>عرض 50 عنصر</option>
                                <option value={100}>عرض 100 عنصر</option>
                                <option value={100000}>عرض الكل</option>
                            </select>
                            
                            <div style={{ display: 'flex', gap: '0.625rem' }}>
                                <button 
                                    disabled={currentPage === 1} 
                                    onClick={() => setCurrentPage(p => p - 1)} 
                                    style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', border: 'none', background: currentPage === 1 ? 'var(--surface-sunken)' : 'var(--surface-subcard)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                >
                                    السابق
                                </button>
                                <span style={{ padding: '0.625rem 1.25rem', background: 'var(--surface-sunken)', borderRadius: '10px', fontWeight: 900, border: 'none', boxShadow: 'var(--shadow-sunken)' }}>
                                    {currentPage} / {totalPages}
                                </span>
                                <button 
                                    disabled={currentPage >= totalPages} 
                                    onClick={() => setCurrentPage(p => p + 1)} 
                                    style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', border: 'none', background: currentPage >= totalPages ? 'var(--surface-sunken)' : 'var(--surface-subcard)', color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                >
                                    التالي
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </MasterPage>
        </div>
    );
}