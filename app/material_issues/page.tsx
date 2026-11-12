"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import SecureAction from '@/components/SecureAction';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import { formatCurrency } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import { useMaterialIssuesLogic } from './material_issues_logic';
import MaterialIssueModal from './MaterialIssueModal';
import { useConfirm } from '@/components/ConfirmContext';
import * as XLSX from 'xlsx'; // 🚀 استدعاء مكتبة الإكسل
import { notify } from '@/lib/notify';
import SendPartnerMessageButton from '@/components/SendPartnerMessageButton';

// =========================================================================
// 🧩 مكون ذكي للقائمة المنسدلة متعددة الاختيارات مع بحث (Custom Dropdown)
// =========================================================================
const MultiSelectDropdown = ({ options, selected, onChange, placeholder, title, accentColor }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // إغلاق القائمة عند الضغط خارجها
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
        <div ref={dropdownRef} className="no-print" style={{ position: 'relative', flex: 1, minWidth: '15.625rem' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, marginBottom: '0.375rem', color: 'var(--text-secondary, #475569)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{title}</span>
                {selected.length > 0 && (
                    <span 
                        style={{ color: 'var(--status-negative, #ef4444)', cursor: 'pointer', fontSize: 'var(--fs-xs)', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 0.5rem', borderRadius: '6px', fontWeight: 800 }} 
                        onClick={() => onChange([])}
                    >
                        إلغاء التحديد ({selected.length})
                    </span>
                )}
            </div>
            
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{ background: 'var(--surface-sunken, #f8fafc)', padding: '0.625rem 0.9375rem', borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '2.75rem', transition: '0.2s' }}
            >
                <span style={{ fontWeight: 800, color: selected.length ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #94a3b8)', fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected.length > 0 ? selected.join('، ') : placeholder}
                </span>
                <span style={{ color: 'var(--text-secondary, #94a3b8)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', fontSize: 'var(--fs-xs)' }}>▼</span>
            </div>
            
            {isOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-card, #ffffff)', border: 'none', borderRadius: '16px', marginTop: '0.5rem', zIndex: 50, boxShadow: 'var(--shadow-ambient, 0 10px 25px rgba(0,0,0,0.1)), 0 20px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
                    <div style={{ padding: '0.625rem 0.75rem', background: 'var(--surface-card, #ffffff)' }}>
                        <input 
                            type="text" 
                            placeholder="بحث سريع..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', height: '2.5rem', padding: '0 0.75rem', background: 'var(--surface-sunken, #f8fafc)', border: 'none', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', borderRadius: '10px', outline: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}
                        />
                    </div>
                    <div className="custom-scrollbar" style={{ maxHeight: '13.75rem', overflowY: 'auto', padding: '0.375rem' }}>
                        {filteredOptions.length > 0 ? filteredOptions.map((opt: string) => (
                            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.625rem', cursor: 'pointer', borderRadius: '8px', background: selected.includes(opt) ? 'var(--accent-soft-bg, rgba(37,99,235,0.1))' : 'transparent', transition: '0.2s' }}>
                                <input 
                                    type="checkbox" 
                                    checked={selected.includes(opt)} 
                                    onChange={() => handleToggle(opt)} 
                                    style={{ accentColor: accentColor || 'var(--accent-ink, #c2410c)', transform: 'scale(1.2)', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: selected.includes(opt) ? (accentColor || 'var(--accent-ink, #c2410c)') : 'var(--text-primary, #334155)' }}>{opt}</span>
                            </label>
                        )) : (
                            <div style={{ padding: '0.9375rem', textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary, #94a3b8)', fontWeight: 700 }}>لا توجد نتائج مطابقة</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function MaterialIssuesPage() {
    const logic = useMaterialIssuesLogic();
    const { showConfirm } = useConfirm();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); 
    const [filterType, setFilterType] = useState('all'); 
    
    // الفلاتر المتقدمة (متعددة الاختيارات)
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedBoqs, setSelectedBoqs] = useState<string[]>([]);

    // استخراج الفلل والبنود الفريدة
    const uniqueProjects = useMemo(() => {
        const projects = (logic.issues || []).map((i: any) => i.project_name).filter(Boolean);
        return Array.from(new Set(projects)) as string[];
    }, [logic.issues]);

    const uniqueBoqs = useMemo(() => {
        const boqs = (logic.issues || []).map((i: any) => i.boq_item).filter(Boolean);
        return Array.from(new Set(boqs)) as string[];
    }, [logic.issues]);

    // تطبيق كل الفلاتر
    const filteredIssues = useMemo(() => {
        return (logic.issues || []).filter((issue: any) => {
            const searchString = `${issue.item_name || ''} ${issue.issue_number || ''} ${issue.project_name || ''} ${issue.subcontractor_name || ''} ${issue.contractor_text_name || ''}`.toLowerCase();
            const matchesSearch = searchString.includes(searchTerm.toLowerCase());

            const isPosted = issue.is_posted === true;
            const matchesStatus = filterStatus === 'all' 
                ? true 
                : filterStatus === 'معتمد' ? isPosted 
                : !isPosted;

            const issueType = issue.issue_type || 'صرف لمقاول';
            const matchesType = filterType === 'all'
                ? true
                : filterType === 'subcontractor' ? issueType === 'صرف لمقاول'
                : issueType === 'استهلاك مباشر';

            const matchesProject = selectedProjects.length === 0 || selectedProjects.includes(issue.project_name);
            const matchesBoq = selectedBoqs.length === 0 || selectedBoqs.includes(issue.boq_item);

            return matchesSearch && matchesStatus && matchesType && matchesProject && matchesBoq;
        });
    }, [logic.issues, searchTerm, filterStatus, filterType, selectedProjects, selectedBoqs]);

    // ==========================================
    // 📥 دوال التصدير (Excel & PDF)
    // ==========================================
    const handleExportExcel = () => {
        if (!filteredIssues || filteredIssues.length === 0) {
            notify("لا توجد بيانات لتصديرها!");
            return;
        }

        const excelData = filteredIssues.map((issue: any) => ({
            'رقم الإذن': issue.issue_number || '---',
            'التاريخ': issue.issue_date || '---',
            'نوع الصرف': issue.issue_type || 'صرف لمقاول',
            'المشروع (الفيلا)': issue.project_name || '---',
            'المقاول المستلم': issue.subcontractor_name || issue.contractor_text_name || '---',
            'اسم الخامة': issue.item_name || '---',
            'الكمية': issue.quantity || 0,
            'الوحدة': issue.unit || '---',
            'سعر الوحدة': Number(issue.unit_price || 0),
            'الإجمالي': Number(issue.total_price || 0),
            'مربوط ببند (BOQ)': issue.boq_item || '---',
            'الحالة المحاسبية': issue.is_posted ? 'معتمد ومقيد' : 'مسودة'
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير منصرف الخامات");
        
        const wscols = [
            {wch: 15}, {wch: 15}, {wch: 15}, {wch: 25}, {wch: 30}, 
            {wch: 35}, {wch: 10}, {wch: 10}, {wch: 15}, {wch: 15}, 
            {wch: 30}, {wch: 15}
        ];
        worksheet['!cols'] = wscols;
        worksheet['!dir'] = 'rtl'; // لدعم اللغة العربية من اليمين لليسار

        XLSX.writeFile(workbook, `تقرير_صرف_خامات_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handlePrintPDF = () => {
        setTimeout(() => {
            window.print();
        }, 500);
    };

    const summaryStats = useMemo(() => {
        let total = 0, posted = 0, draft = 0, subcontractor = 0, direct = 0;

        filteredIssues.forEach((issue: any) => {
            const amount = Number(issue.total_price || 0);
            total += amount;
            
            if (issue.is_posted === true) posted += amount;
            else draft += amount;

            if ((issue.issue_type || 'صرف لمقاول') === 'صرف لمقاول') subcontractor += amount;
            else direct += amount;
        });

        return { total, posted, draft, subcontractor, direct };
    }, [filteredIssues]);

    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [filteredIssues.length, searchTerm, filterStatus, filterType, selectedProjects, selectedBoqs]);

    const totalPages = Math.ceil((filteredIssues.length || 0) / rowsPerPage) || 1;

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        const sliced = filteredIssues.slice(startIndex, startIndex + rowsPerPage);
        
        return sliced.map((row: any) => ({
            ...row,
            _selected: logic.selectedIds?.includes(row.id) || false
        }));
    }, [filteredIssues, currentPage, rowsPerPage, logic.selectedIds]);

    const columns = [
        {
            header: (
                <div className="no-print">
                    <input 
                        type="checkbox" 
                        checked={paginatedData.length > 0 && paginatedData.every(r => r._selected)}
                        onChange={logic.handleSelectAll}
                        style={{ transform: 'scale(1.4)', cursor: 'pointer', accentColor: THEME.goldAccent || '#c2410c' }}
                    />
                </div>
            ),
            render: (row: any) => row ? (
                <div className="no-print">
                    <input 
                        type="checkbox" 
                        checked={row._selected}
                        onChange={() => logic.handleSelectRow(row.id)}
                        style={{ transform: 'scale(1.4)', cursor: 'pointer', accentColor: THEME.goldAccent || '#c2410c' }}
                    />
                </div>
            ) : null
        },
        { 
            header: 'رقم الإذن', 
            render: (row: any) => (
                <div style={{ fontWeight: 900, color: 'var(--text-primary, #2d1a11)', background: 'var(--surface-sunken, #f8fafc)', padding: '0.25rem 0.625rem', borderRadius: '8px', fontSize: 'var(--fs-sm)', textAlign: 'center', border: 'none', boxShadow: 'var(--shadow-sunken, inset 0 1px 3px rgba(0,0,0,0.05))', minWidth: '5.3125rem' }}>
                    #{row.issue_number || '---'}
                </div>
            )
        },
        { 
            header: 'التاريخ ونوع الصرف', 
            render: (row: any) => {
                const iType = row.issue_type || 'صرف لمقاول';
                return (
                    <div>
                        <div style={{ fontWeight: 900, color: '#1e293b', marginBottom: '0.25rem', fontSize: 'var(--fs-sm)' }}>{row.issue_date}</div>
                        <span style={{ fontSize: 'var(--fs-xs)', background: iType === 'صرف لمقاول' ? '#fee2e2' : '#f0fdf4', color: iType === 'صرف لمقاول' ? '#dc2626' : '#166534', padding: '2px 0.5rem', borderRadius: '6px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                            {iType}
                        </span>
                    </div>
                );
            }
        },
        { 
            header: 'الخامة المنصرفة', 
            render: (row: any) => (
                <div style={{ minWidth: '8.75rem' }}>
                    <strong style={{ color: '#2563eb', fontSize: 'var(--fs-md)', display: 'block' }}>{row.item_name}</strong>
                    <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 900 }}>
                        {row.quantity} {row.unit || 'وحدة'} | {formatCurrency(row.unit_price)}
                    </span>
                </div>
            )
        },
        { 
            header: 'التوجيه (مشروع / مقاول)', 
            render: (row: any) => (
                <div style={{ minWidth: '9.375rem' }}>
                    <div style={{ fontWeight: 800, color: THEME.coffeeDark || '#2d1a11', fontSize: 'var(--fs-sm)' }}>{row.project_name || '---'}</div>
                    {row.boq_item && <div style={{ fontSize: 'var(--fs-xs)', color: THEME.goldAccent || '#c2410c', marginTop: '2px', fontWeight: 700 }}>{row.boq_item}</div>}
                    {(row.subcontractor_name || row.contractor_text_name) && (
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#be123c', marginTop: '2px', fontWeight: 700 }}>
                            {row.subcontractor_name || row.contractor_text_name}
                        </div>
                    )}
                </div>
            )
        },
        { 
            header: 'الإجمالي', 
            render: (row: any) => <span style={{ fontWeight: 900, color: '#ef4444', fontSize: 'var(--fs-md)' }}>{formatCurrency(row.total_price)}</span>
        },
        { 
            header: 'الحالة المحاسبية', 
            render: (row: any) => (
                 <span style={{ background: row.is_posted === true ? '#dcfce7' : '#fef2f2', color: row.is_posted === true ? '#166534' : '#dc2626', padding: '2px 0.5rem', borderRadius: '6px', fontSize: 'var(--fs-xs)', fontWeight: 900 }}>
                    {row.is_posted === true ? 'معتمد' : 'مسودة'}
                </span>
            )
        },
        {
            header: 'إرسال',
            excludeFromExport: true,
            render: (row: any) => {
                if (!row) return null;
                return (
                    <SendPartnerMessageButton
                        partnerId={row.subcontractor_id}
                        partnerName={row.subcontractor_name || row.contractor_text_name}
                        operation={{
                            type: 'material_issue',
                            reference: row.issue_number,
                            date: row.issue_date,
                            project: row.project_name,
                            amount: row.total_price,
                            description: row.item_name || 'إذن صرف خامات',
                            status: row.is_posted === true ? 'معتمد' : 'مسودة',
                            extraLines: [
                                { label: 'الكمية', value: row.quantity ? `${row.quantity} ${row.unit || ''}`.trim() : null },
                                { label: 'بند المقايسة', value: row.boq_item },
                                { label: 'نوع الصرف', value: row.issue_type },
                            ],
                        }}
                    />
                );
            }
        }
    ];

    return (
        <div className="clean-page enterprise-page print-container">
            <MasterPage title="صرف الخامات للمواقع" subtitle="إدارة مسحوبات المقاولين واستهلاك المواد وتوجيه التكاليف للبنود">
                
                <RawasiSidebarManager 
                    actions={
                        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', width: '100%' }}>
                            {(logic.selectedIds || []).length === 0 ? (
                                <>
                                    <button 
                                        onClick={() => {
                                            logic.setIssueData({ items: [{boq_item_id: null, item_id: null, item_name:'', quantity:1, available_qty:0, old_qty:0, unit_price:0, total_price:0}] });
                                            logic.setEditingIssueId(null);
                                            logic.setIsModalOpen(true);
                                        }} 
                                        className="btn-main-glass"
                                    >
                                        تسجيل إذن صرف جديد
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.625rem', borderRadius: '8px', textAlign: 'center', color: THEME.goldAccent || '#c2410c', fontWeight: 900, fontSize: 'var(--fs-sm)', border: 'none', boxShadow: 'var(--shadow-sunken, inset 0 1px 3px rgba(0,0,0,0.1))' }}>
                                        ✓ تم تحديد ({logic.selectedIds.length}) أسطر خامات
                                    </div>
                                    
                                    <button onClick={logic.handleOpenEdit} className="btn-action-glass edit">
                                        تعديل إذن الصرف المحدد
                                    </button>

                                    <button onClick={() => logic.handleBatchAction('post')} disabled={logic.isActionPending} className="btn-action-glass post">
                                        ترحيل الفواتير المحددة
                                    </button>

                                    <button onClick={() => logic.handleBatchAction('unpost')} disabled={logic.isActionPending} className="btn-action-glass unpost">
                                        فك ترحيل الفواتير المحددة
                                    </button>

                                    <button 
                                        onClick={() => { 
                                            showConfirm({
                                                title: 'مسح أذونات الصرف',
                                                message: `تحذير: هل أنت متأكد من مسح الفواتير التابعة لـ ${logic.selectedIds.length} سطر محدد بشكل نهائي؟`,
                                                type: 'danger',
                                                onConfirm: () => logic.handleBatchAction('delete')
                                            });
                                        }} 
                                        disabled={logic.isActionPending} 
                                        className="btn-action-glass delete"
                                    >
                                        مسح الفواتير المحددة
                                    </button>
                                </>
                            )}
                            
                            <hr style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '0.625rem 0' }} />
                            
                            <button onClick={handleExportExcel} className="btn-action-glass print" style={{ background: '#10b981', color: 'white' }}>
                                تصدير البيانات (Excel)
                            </button>
                            <button onClick={handlePrintPDF} className="btn-action-glass print" style={{ background: '#3b82f6', color: 'white' }}>
                                طباعة التقرير (PDF)
                            </button>
                        </div>
                    }
                    summary={
                        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            <div className="summary-card total">
                                <span className="label">إجمالي تكلفة الخامات المفلترة</span>
                                <span className="value">{formatCurrency(summaryStats.total)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.625rem' }}>
                                <div className="summary-card posted">
                                    <span className="label">تم ترحيله</span>
                                    <span className="value-sm">{formatCurrency(summaryStats.posted)}</span>
                                </div>
                                <div className="summary-card draft">
                                    <span className="label">قيد المراجعة</span>
                                    <span className="value-sm">{formatCurrency(summaryStats.draft)}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.625rem' }}>
                                <div className="summary-card subcontractor">
                                    <span className="label">مسحوبات مقاولين</span>
                                    <span className="value-sm">{formatCurrency(summaryStats.subcontractor)}</span>
                                </div>
                                <div className="summary-card direct">
                                    <span className="label">استهلاك مباشر</span>
                                    <span className="value-sm">{formatCurrency(summaryStats.direct)}</span>
                                </div>
                            </div>
                        </div>
                    }
                    watchDeps={[logic.selectedIds, logic.isActionPending, logic.issues, currentPage, rowsPerPage, summaryStats, selectedProjects, selectedBoqs]}
                />

                <style>{`
                    .btn-main-glass { background: linear-gradient(135deg, #2563eb, #1e40af); color: white; width: 100%; padding: 0.875rem; border-radius: 12px; border: none; font-weight: 900; cursor: pointer; transition: 0.3s; }
                    .btn-main-glass:hover { filter: brightness(1.2); transform: translateY(-2px); }
                    
                    .btn-action-glass { width: 100%; padding: 0.75rem; border-radius: 10px; border: none; font-weight: 900; cursor: pointer; transition: 0.3s; font-size: var(--fs-sm); }
                    .btn-action-glass:disabled { opacity: 0.5; cursor: not-allowed; }
                    .btn-action-glass:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.2); }
                    
                    .btn-action-glass.edit { background: linear-gradient(135deg, ${THEME.goldAccent || '#c2410c'}, #b48a2e); color: white; box-shadow: 0 4px 15px rgba(202, 138, 4, 0.3); }
                    .btn-action-glass.post { background: linear-gradient(135deg, #10b981, #059669); color: white; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
                    .btn-action-glass.unpost { background: rgba(245, 158, 11, 0.15); color: #d97706; border: none; }
                    .btn-action-glass.delete { background: rgba(239, 68, 68, 0.15); color: #dc2626; border: none; }

                    .summary-card { background: var(--surface-card, rgba(255,255,255,0.05)); border-radius: 14px; padding: 0.875rem; display: flex; flex-direction: column; justify-content: center; border: none; box-shadow: var(--shadow-elevation, 0 4px 12px rgba(0,0,0,0.08)); flex: 1; }
                    .summary-card .label { font-size: var(--fs-xs); font-weight: 900; opacity: 0.8; margin-bottom: 0.25rem; }
                    .summary-card .value { font-size: var(--fs-xl); font-weight: 900; }
                    .summary-card .value-sm { font-size: var(--fs-sm); font-weight: 900; }
                    
                    .summary-card.total { background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(30,64,175,0.15)); color: var(--accent-ink, #60a5fa); border: none; }
                    .summary-card.posted { background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.12)); color: #10b981; border: none; }
                    .summary-card.draft { background: linear-gradient(135deg, rgba(245,158,11,0.12), rgba(180,83,9,0.12)); color: #f59e0b; border: none; }
                    .summary-card.subcontractor { background: linear-gradient(135deg, rgba(225,29,72,0.12), rgba(159,18,57,0.12)); color: #f43f5e; border: none; }
                    .summary-card.direct { background: linear-gradient(135deg, rgba(139,92,246,0.12), rgba(91,33,182,0.12)); color: #8b5cf6; border: none; }

                    /* Custom Scrollbar for Dropdowns */
                    .custom-scrollbar::-webkit-scrollbar { width: 0.375rem; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

                    /* تنسيقات الطباعة */
                    @media print {
                        @page { size: A4 landscape; margin: 10mm; }
                        body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .no-print { display: none !important; }
                        .print-container { padding: 0 !important; }
                        .table-container { box-shadow: none !important; border: 1px solid #000; }
                        table th { background-color: #f1f5f9 !important; color: #000 !important; border: 1px solid #000; }
                        table td { border: 1px solid #000; }
                    }
                `}</style>

                {/* 🔍 أدوات البحث والتصفية المتقدمة */}
                <div className="no-print enterprise-card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    marginBottom: '1.25rem',
                    background: 'var(--surface-card, #ffffff)',
                    padding: '1.25rem',
                    borderRadius: 'var(--phi-radius-card, 18px)',
                    boxShadow: 'var(--shadow-ambient)',
                    border: 'none',
                    position: 'relative'
                }}>
                    {/* الصف الأول: البحث العام والحالات والتوجيه */}
                    <div style={{ display: 'flex', gap: '0.9375rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1', minWidth: '15.625rem' }}>
                            <input 
                                type="text" 
                                placeholder="بحث باسم الخامة، رقم الإذن، المشروع، المقاول..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', height: '2.75rem', padding: '0.625rem 0.9375rem', borderRadius: '12px', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', border: 'none', outline: 'none', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}
                            />
                        </div>
                        <div style={{ width: '12.5rem' }}>
                            <select 
                                value={filterStatus} 
                                onChange={(e) => setFilterStatus(e.target.value)}
                                style={{ width: '100%', height: '2.75rem', padding: '0 0.9375rem', borderRadius: '12px', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', border: 'none', outline: 'none', fontWeight: 800, color: 'var(--text-primary, #1e293b)' }}
                            >
                                <option value="all">كل الحالات المحاسبية</option>
                                <option value="posted">معتمد</option>
                                <option value="draft">مسودة قيد المراجعة</option>
                            </select>
                        </div>
                        <div style={{ width: '12.5rem' }}>
                            <select 
                                value={filterType} 
                                onChange={(e) => setFilterType(e.target.value)}
                                style={{ width: '100%', height: '2.75rem', padding: '0 0.9375rem', borderRadius: '12px', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', border: 'none', outline: 'none', fontWeight: 800, color: 'var(--text-primary, #1e293b)' }}
                            >
                                <option value="all">كل أنواع التوجيه</option>
                                <option value="subcontractor">مسحوبات مقاولين</option>
                                <option value="direct">استهلاك مباشر</option>
                            </select>
                        </div>
                    </div>

                    {/* الصف الثاني: الفلاتر المتقدمة (Multi-Select Dropdowns) */}
                    <div style={{ display: 'flex', gap: '0.9375rem', flexWrap: 'wrap' }}>
                        <MultiSelectDropdown 
                            title="فلترة بأسماء الفلل والعقارات"
                            placeholder="اختر الفلل..."
                            options={uniqueProjects}
                            selected={selectedProjects}
                            onChange={setSelectedProjects}
                            accentColor="#2563eb"
                        />
                        
                        <MultiSelectDropdown 
                            title="فلترة ببنود الميزانية المربوطة"
                            placeholder="اختر البنود..."
                            options={uniqueBoqs}
                            selected={selectedBoqs}
                            onChange={setSelectedBoqs}
                            accentColor="#d97706"
                        />
                    </div>
                </div>

                <RawasiSmartTable 
                    data={paginatedData}
                    columns={columns}
                    isLoading={logic.isLoading}
                />

                {!logic.isLoading && filteredIssues.length > 0 && (
                    <div className="no-print enterprise-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem 1.25rem', background: 'var(--surface-card, #ffffff)', borderRadius: 'var(--phi-radius-card, 18px)', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary, #334155)', fontWeight: 800 }}>
                            إجمالي السجلات المفلترة: <b style={{ color: 'var(--status-negative, #ef4444)', fontSize: 'var(--fs-lg)', marginInlineStart: '0.25rem' }}>{filteredIssues.length}</b>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.9375rem', alignItems: 'center' }}>
                            <select 
                                value={rowsPerPage} 
                                onChange={(e) => {setRowsPerPage(Number(e.target.value)); setCurrentPage(1);}} 
                                style={{ height: '2.5rem', padding: '0 0.75rem', borderRadius: '10px', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', border: 'none', outline: 'none', fontWeight: 800, color: 'var(--text-primary, #1e293b)', cursor: 'pointer' }}
                            >
                                <option value={50}>عرض 50 سجل</option>
                                <option value={100}>عرض 100 سجل</option>
                                <option value={500}>عرض 500 سجل</option>
                                <option value={100000}>عرض الكل (للطباعة)</option>
                            </select>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button 
                                    disabled={currentPage === 1} 
                                    onClick={() => setCurrentPage(p => p - 1)} 
                                    style={{ height: '2.5rem', padding: '0 1rem', borderRadius: '10px', border: 'none', background: currentPage === 1 ? 'var(--surface-sunken, #f8fafc)' : 'var(--accent-ink, #475569)', color: currentPage === 1 ? 'var(--text-secondary, #94a3b8)' : '#ffffff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 800, boxShadow: currentPage === 1 ? 'none' : 'var(--shadow-elevation, 0 4px 12px rgba(0,0,0,0.15))', transition: '0.2s' }}
                                >
                                    السابق
                                </button>
                                <span style={{ display: 'inline-flex', alignItems: 'center', height: '2.5rem', padding: '0 1rem', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', borderRadius: '10px', fontWeight: 800, color: 'var(--text-primary, #1e293b)', border: 'none' }}>
                                    {currentPage} / {totalPages}
                                </span>
                                <button 
                                    disabled={currentPage >= totalPages} 
                                    onClick={() => setCurrentPage(p => p + 1)} 
                                    style={{ height: '2.5rem', padding: '0 1rem', borderRadius: '10px', border: 'none', background: currentPage >= totalPages ? 'var(--surface-sunken, #f8fafc)' : 'var(--accent-ink, #475569)', color: currentPage >= totalPages ? 'var(--text-secondary, #94a3b8)' : '#ffffff', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', fontWeight: 800, boxShadow: currentPage >= totalPages ? 'none' : 'var(--shadow-elevation, 0 4px 12px rgba(0,0,0,0.15))', transition: '0.2s' }}
                                >
                                    التالي
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <MaterialIssueModal 
                    isOpen={logic.isModalOpen} 
                    onClose={() => logic.setIsModalOpen(false)} 
                    logic={logic} 
                />

            </MasterPage>
        </div>
    );
}