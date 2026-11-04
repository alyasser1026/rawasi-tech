"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import SecureAction from '@/components/SecureAction';
import * as XLSX from 'xlsx'; // 🚀 استدعاء مكتبة الإكسل
import { useMaterialsLogic } from './materials_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { formatCurrency } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import MaterialInvoiceModal from './MaterialInvoiceModal';
import MaterialReceiptPrintModal from './MaterialReceiptPrintModal';
// 🚀 تم تصحيح المسار ليقرأ المودال من فولدر material_issues
import DispenseMaterialModal from '../material_issues/DispenseMaterialModal'; 
import { useConfirm } from '@/components/ConfirmContext'; 
// 🚀 استدعاء مودال الصرف المجمع الجديد
import BulkDispenseModal from './BulkDispenseModal'; 
import LoadingScreen from '@/components/LoadingScreen';
import KpiStrip from '@/components/KpiStrip';
import { FileText, ListChecks, Package } from 'lucide-react';
import { notify } from '@/lib/notify';

// =========================================================================
// 🧩 مكون القائمة المنسدلة متعددة الاختيارات مع بحث (Custom Dropdown)
// =========================================================================
const MultiSelectDropdown = ({ options, selected, onChange, placeholder, title, accentColor }: any) => {
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
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, marginBottom: '6px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span>{title}</span>
                {selected.length > 0 && (
                    <span 
                        style={{ color: '#ef4444', cursor: 'pointer', fontSize: 'var(--fs-xs)', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px' }} 
                        onClick={() => onChange([])}
                    >
                        إلغاء ({selected.length})
                    </span>
                )}
            </div>
            
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="glass-input-field"
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '45px', padding: '0 12px' }}
            >
                <span style={{ fontWeight: 800, color: selected.length ? '#1e293b' : '#94a3b8', fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected.length > 0 ? selected.join('، ') : placeholder}
                </span>
                <span style={{ color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', fontSize: 'var(--fs-xs)' }}>▼</span>
            </div>
            
            {isOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: `1px solid #e2e8f0`, borderRadius: '12px', marginTop: '8px', zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ padding: '8px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <input 
                            type="text" 
                            placeholder="بحث سريع..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700, color: '#1e293b' }}
                        />
                    </div>
                    <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', padding: '5px' }}>
                        {filteredOptions.length > 0 ? filteredOptions.map((opt: string) => (
                            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px', background: selected.includes(opt) ? `${accentColor}15` : 'transparent', transition: '0.2s' }}>
                                <input 
                                    type="checkbox" 
                                    checked={selected.includes(opt)} 
                                    onChange={() => handleToggle(opt)} 
                                    style={{ accentColor: accentColor, transform: 'scale(1.2)', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: selected.includes(opt) ? accentColor : '#334155' }}>{opt}</span>
                            </label>
                        )) : (
                            <div style={{ padding: '15px', textAlign: 'center', fontSize: 'var(--fs-sm)', color: '#94a3b8', fontWeight: 700 }}>لا توجد نتائج</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// =========================================================================
// 🚀 الصفحة الرئيسية
// =========================================================================
export default function MaterialsPage() {
    const logic = useMaterialsLogic();
    const { showConfirm } = useConfirm(); 

    // حالة التحكم في فتح وإغلاق الشجرة التجميعية للفواتير
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    const toggleGroup = (groupId: string) => {
        if (expandedGroups.includes(groupId)) {
            setExpandedGroups(expandedGroups.filter(id => id !== groupId));
        } else {
            setExpandedGroups([...expandedGroups, groupId]);
        }
    };

    // 🚀 الفلاتر المتقدمة (Multi-Select State)
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    // استخراج القوائم الفريدة للفلاتر من البيانات
    const uniqueProjects = useMemo(() => Array.from(new Set((logic.data || []).map((r: any) => r.project?.Property).filter(Boolean))) as string[], [logic.data]);
    const uniqueSuppliers = useMemo(() => Array.from(new Set((logic.data || []).map((r: any) => r.supplier?.name).filter(Boolean))) as string[], [logic.data]);
    const uniqueItems = useMemo(() => Array.from(new Set((logic.data || []).map((r: any) => r.work_item || r.item_name).filter(Boolean))) as string[], [logic.data]);

    // =========================================================================
    // 🔍 فلترة البيانات محلياً بناءً على التشيك بوكس
    // =========================================================================
    const locallyFilteredData = useMemo(() => {
        let data = logic.data || [];

        if (selectedProjects.length > 0) {
            data = data.filter((r: any) => selectedProjects.includes(r.project?.Property));
        }
        if (selectedSuppliers.length > 0) {
            data = data.filter((r: any) => selectedSuppliers.includes(r.supplier?.name));
        }
        if (selectedItems.length > 0) {
            data = data.filter((r: any) => selectedItems.includes(r.work_item || r.item_name));
        }

        return data;
    }, [logic.data, selectedProjects, selectedSuppliers, selectedItems]);

    // حساب الإجمالي اللحظي للفلاتر الحالية
    const filteredTotalCost = useMemo(() => {
        return locallyFilteredData.reduce((sum: number, row: any) => sum + (Number(row.total_price) || 0), 0);
    }, [locallyFilteredData]);

    // =========================================================================
    // 🌳 تجميع الحركات أوتوماتيكياً وتحويلها لشجرة ماليّة بناءً على (رقم الفاتورة)
    // =========================================================================
    const groupedData = useMemo(() => {
        const groups: { [key: string]: any } = {};

        locallyFilteredData.forEach((row: any) => {
            const id = row.receipt_id || row.id; 
            if (!groups[id]) {
                groups[id] = {
                    id: id,
                    receipt_id: id,
                    receipt_no: row.receipt_no,
                    exp_date: row.exp_date,
                    receipt_type: row.receipt_type,
                    project: row.project,
                    project_id: row.project_id, // 🚀 نحتاج هذا للـ Dispense
                    supplier: row.supplier,
                    account: row.account,
                    is_posted: row.is_posted,
                    total_receipt_price: 0,
                    items: [],
                    _selected: logic.selectedIds?.includes(id)
                };
            }
            groups[id].total_receipt_price += Number(row.total_price) || 0;
            // 🚀 دمج معلومات الفاتورة الأب مع السطر عشان نستخدمها في مودال الصرف
            groups[id].items.push({
                ...row,
                quantity: row.quantity || 0, // ✅ تأكيد قراءة كمية التوريد من الـ Line الأصلي
                available_qty: row.available_qty !== undefined ? row.available_qty : (row.quantity || 0), // ✅ تحديد صريح للكمية المتاحة لو موجودة، وإلا تاخد الـ quantity العادية
                project_id: row.project_id || groups[id].project_id
            });
        });

        return Object.values(groups);
    }, [locallyFilteredData, logic.selectedIds]);

    // =========================================================================
    // 🔢 نظام تقسيم الصفحات (Pagination)
    // =========================================================================
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    // تصفير الصفحة عند تغير الفلاتر أو البيانات
    React.useEffect(() => {
        setCurrentPage(1);
    }, [groupedData.length, selectedProjects, selectedSuppliers, selectedItems]);

    const totalPages = Math.ceil((groupedData.length || 0) / rowsPerPage) || 1;

    const paginatedGroups = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return groupedData.slice(startIndex, startIndex + rowsPerPage);
    }, [groupedData, currentPage, rowsPerPage]);

    // =========================================================================
    // 📥 دوال التصدير (Excel & PDF)
    // ==========================================
    const exportToExcel = () => {
        const excelData: any[] = [];
        groupedData.forEach((group: any) => {
            group.items.forEach((item: any) => {
                excelData.push({
                    "رقم الفاتورة": group.receipt_no || '---',
                    "تاريخ الفاتورة": group.exp_date,
                    "المشروع": group.project?.Property || '---',
                    "المورد": group.supplier?.name || '---',
                    "نوع الفاتورة": group.receipt_type || '---',
                    "الخامة الموردة": item.work_item || item.item_name,
                    "الكمية": item.quantity,
                    "الوحدة": item.unit,
                    "سعر الوحدة": Number(item.unit_price || 0),
                    "إجمالي السطر": Number(item.total_price || 0),
                    "الحالة المحاسبية": group.is_posted ? 'معتمد' : 'مسودة'
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير التوريدات");

        if (!worksheet["!cols"]) worksheet["!cols"] = [];
        worksheet["!cols"] = [
            { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ];
        worksheet['!dir'] = 'rtl';

        XLSX.writeFile(workbook, `Material_Receipts_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handlePrintPDF = () => {
        const allGroupIds = groupedData.map((g: any) => g.id);
        setExpandedGroups(allGroupIds);
        setTimeout(() => {
            window.print();
        }, 500);
    };

    return (
        <div className="clean-page print-container">
            <MasterPage title="مركز توريد خامات المشاريع" subtitle="إصدار فواتير الخامات، توجيهها للمشاريع، وربطها بحسابات الموردين والعملاء للخصم التلقائي">
                
                <RawasiSidebarManager 
                    actions={
                        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button onClick={logic.openAddModal} className="btn-main-glass gold">
                                إصدار فاتورة توريد جديدة
                            </button>
                            
                            {/* 🚀 زر الصرف المجمع الجديد */}
                            {logic.selectedLineItems?.length > 0 && (
                                <button 
                                    onClick={() => logic.setIsBulkDispenseModalOpen(true)} 
                                    className="btn-main-glass" 
                                    style={{ background: '#0284c7', color: 'white', border: '2px solid #38bdf8' }}
                                >
                                    صرف مجمع للمحدد ({logic.selectedLineItems.length})
                                </button>
                            )}
                            
                            {logic.selectedIds?.length === 1 && (
                                <button 
                                    onClick={logic.handleEditSelected} 
                                    className="btn-main-glass" 
                                    style={{ background: '#3b82f6', color: 'white' }}
                                >
                                    تعديل الفاتورة المحددة
                                </button>
                            )}

                            {logic.selectedIds?.length > 0 && (
                                <>
                                    <button 
                                        onClick={() => logic.handleBulkAction('post')} 
                                        className="btn-main-glass" 
                                        style={{ background: THEME.success, color: 'white' }}
                                    >
                                        ترحيل المحدد ({logic.selectedIds.length})
                                    </button>
                                    <button 
                                        onClick={() => logic.handleBulkAction('unpost')} 
                                        className="btn-main-glass" 
                                        style={{ background: '#f59e0b', color: 'white' }}
                                    >
                                        فك ترحيل المحدد ({logic.selectedIds.length})
                                    </button>
                                    
                                    <button 
                                        onClick={() => { 
                                            showConfirm({
                                                title: 'مسح فواتير التوريد',
                                                message: `تحذير: هل أنت متأكد من مسح الفواتير التابعة لـ ${logic.selectedIds.length} فاتورة محددة بشكل نهائي؟`,
                                                type: 'danger',
                                                onConfirm: () => logic.handleBulkAction('delete')
                                            });
                                        }} 
                                        className="btn-main-glass" 
                                        style={{ background: '#ef4444', color: 'white' }}
                                    >
                                        مسح المحدد ({logic.selectedIds.length})
                                    </button>
                                </>
                            )}

                            <hr style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '10px 0' }} />
                            
                            <button onClick={exportToExcel} className="btn-main-glass" style={{ background: '#10b981', color: 'white' }}>
                                تصدير الخامات (Excel)
                            </button>
                            <button onClick={handlePrintPDF} className="btn-main-glass" style={{ background: '#6366f1', color: 'white' }}>
                                طباعة التقرير (PDF)
                            </button>
                        </div>
                    }
                    summary={
                        <KpiStrip compact items={[
                            { label: 'قيمة الخامات (حسب التصفية)', amount: filteredTotalCost, tone: 'brand', icon: <Package /> },
                            { label: 'الفواتير المعروضة', value: groupedData.length.toLocaleString('ar-EG'), tone: 'info', icon: <FileText /> },
                            { label: 'المحدد للصرف', value: (logic.selectedLineItems?.length || 0).toLocaleString('ar-EG'), tone: 'neutral', icon: <ListChecks />, hint: 'سطور خامات' },
                        ]} />
                    }
                    customFilters={
                        <div>
                    <MultiSelectDropdown 
                        title="فلتر المشاريع (الفلل)"
                        placeholder="كل المشاريع"
                        options={uniqueProjects}
                        selected={selectedProjects}
                        onChange={setSelectedProjects}
                        accentColor={THEME.primary || '#2563eb'}
                    />

                    <MultiSelectDropdown 
                        title="فلتر الموردين"
                        placeholder="كل الموردين"
                        options={uniqueSuppliers}
                        selected={selectedSuppliers}
                        onChange={setSelectedSuppliers}
                        accentColor="#8b5cf6"
                    />

                    <MultiSelectDropdown 
                        title="فلتر الخامات الموردة"
                        placeholder="كل الخامات"
                        options={uniqueItems}
                        selected={selectedItems}
                        onChange={setSelectedItems}
                        accentColor={THEME.goldAccent || '#d97706'}
                    />

                    <div>
                        <label style={{ fontSize: 'var(--fs-xs)', color: '#475569', marginBottom: '6px', display: 'block', fontWeight: 900 }}>ترتيب العرض</label>
                        <select className="glass-input-field" aria-label="ترتيب العرض" value={logic.sortBy} onChange={e => logic.setSortBy(e.target.value)}>
                            <option value="newest">الأحدث إضافة</option>
                            <option value="oldest">الأقدم</option>
                            <option value="highest_price">السعر: الأعلى أولاً</option>
                            <option value="lowest_price">السعر: الأقل أولاً</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', color: '#475569', marginBottom: '6px', display: 'block', fontWeight: 900 }}>من تاريخ</label>
                            <input type="date" className="glass-input-field" value={logic.dateFrom} onChange={e => logic.setDateFrom(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', color: '#475569', marginBottom: '6px', display: 'block', fontWeight: 900 }}>إلى تاريخ</label>
                            <input type="date" className="glass-input-field" value={logic.dateTo} onChange={e => logic.setDateTo(e.target.value)} />
                        </div>
                    </div>
                        </div>
                    }
                    onSearch={(value) => logic.setGlobalSearch(value)}
                    placeholder="ابحث برقم الفاتورة أو البيان…"
                    watchDeps={[logic.globalSearch, logic.dateFrom, logic.dateTo, logic.selectedIds, logic.sortBy, currentPage, rowsPerPage, groupedData, selectedProjects, selectedSuppliers, selectedItems, logic.selectedLineItems]}
                />

                <style>{`
                    /* ستايل الفلتر الزجاجي الأبيض المضيء */
                    .apple-glass-filter-bar {
                        background: rgba(255, 255, 255, 0.75);
                        backdrop-filter: blur(20px);
                        -webkit-backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.8);
                        border-radius: 16px;
                        padding: 20px;
                        margin-bottom: 20px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        align-items: flex-end;
                    }

                    .glass-input-field { 
                        width: 100%; 
                        padding: 10px 12px; 
                        border-radius: 10px; 
                        background: rgba(255, 255, 255, 0.9); 
                        border: 1px solid #cbd5e1; 
                        outline: none; 
                        font-weight: 700; 
                        color: #1e293b; 
                        transition: 0.3s; 
                    }
                    .glass-input-field:focus { 
                        border-color: ${THEME.goldAccent}; 
                        box-shadow: 0 0 0 3px rgba(202, 138, 4, 0.15); 
                        background: #fff;
                    }
                    
                    .btn-main-glass { width: 100%; padding: 12px; border-radius: 12px; border: none; font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); }
                    .btn-main-glass.gold { background: ${THEME.goldAccent}; color: white; }
                    .btn-main-glass:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    
                    .kpi-box { padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); }
                    .kpi-box span { font-size: var(--fs-xs); opacity: 0.8; }
                    .kpi-box strong { display: block; font-size: var(--fs-xl); color: white; margin-top: 5px; }
                    .kpi-box.danger { border-right: 4px solid #ef4444; }
                    .kpi-box.danger strong { color: #ef4444; }

                    /* ستايل شجرة الجداول الاحترافي */
                    .tree-table { width: 100%; border-collapse: collapse; text-align: center; background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
                    .tree-thead { background: #ffffff; color: white; }
                    .tree-thead th { padding: 15px; font-size: var(--fs-sm); font-weight: 900; }
                    
                    .master-group-row { cursor: pointer; border-bottom: 2px solid #f1f5f9; background: #ffffff; transition: 0.2s; }
                    .master-group-row:hover { background: #f8fafc; }
                    .master-group-row td { padding: 12px; font-size: var(--fs-md); font-weight: 800; }

                    .child-tree-container { background: #f8fafc; padding: 15px 30px; border-bottom: 2px solid #e2e8f0; }
                    .child-table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.9); border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; }
                    .child-table th { background: #475569; color: white; padding: 10px; font-size: var(--fs-xs); font-weight: 900; }
                    .child-table td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: var(--fs-sm); font-weight: 700; color: #334155; }
                    
                    .arrow-icon { display: inline-block; transition: transform 0.2s; margin-left: 8px; color: ${THEME.goldAccent || '#c2410c'}; font-size: var(--fs-md); }
                    .arrow-expanded { transform: rotate(90deg); }

                    /* تنسيقات الطباعة */
                    @media print {
                        @page { size: A4 landscape; margin: 10mm; }
                        body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .no-print { display: none !important; }
                        .print-container { padding: 0 !important; }
                        .apple-glass-filter-bar { display: none !important; }
                        .tree-table { border: 1px solid #000; }
                        .tree-thead th { background: #eee !important; color: #000 !important; border: 1px solid #000; }
                        .master-group-row td { border: 1px solid #000; }
                        .child-table th { background: #ccc !important; color: #000 !important; border: 1px solid #000; }
                        .child-table td { border: 1px solid #000; }
                    }
                `}</style>

                {/* 🌳 جدول الشجرة التجميعي الذكي بناءً على الفاتورة */}
                <div>
                    {logic.isLoading ? (
                        <LoadingScreen message="جاري تحميل فواتير التوريد..." fullScreen={false} />
                    ) : (
                        <table className="tree-table">
                            <thead className="tree-thead">
                                <tr>
                                    <th className="no-print" style={{ width: '5%' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={paginatedGroups.length > 0 && paginatedGroups.every(g => g._selected)}
                                            onChange={logic.handleSelectAll}
                                            style={{ transform: 'scale(1.4)', cursor: 'pointer', accentColor: THEME.goldAccent }}
                                        />
                                    </th>
                                    <th style={{ width: '15%' }}>رقم الفاتورة</th>
                                    <th style={{ width: '15%' }}>التاريخ والنوع</th>
                                    <th style={{ width: '20%' }}>التوجيه والمورد</th>
                                    <th style={{ width: '15%' }}>الحالة المحاسبية</th>
                                    <th style={{ width: '15%' }}>إجمالي الفاتورة</th>
                                    <th className="no-print" style={{ width: '15%' }}>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedGroups.map((group) => {
                                    const isExpanded = expandedGroups.includes(group.id);

                                    return (
                                        <React.Fragment key={group.id}>
                                            <tr className="master-group-row" onClick={(e) => {
                                                const target = e.target as HTMLElement;
                                                if (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT') {
                                                    toggleGroup(group.id);
                                                }
                                            }}>
                                                <td className="no-print">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={group._selected}
                                                        onChange={() => logic.handleSelectRow(group.id)} 
                                                        style={{ transform: 'scale(1.4)', cursor: 'pointer', accentColor: THEME.goldAccent }}
                                                    />
                                                </td>
                                                <td>
                                                    <span className={`arrow-icon no-print ${isExpanded ? 'arrow-expanded' : ''}`}>◀</span>
                                                    <div style={{ display: 'inline-block', fontWeight: 900, color: THEME.coffeeDark, background: THEME.sandDark, padding: '4px 10px', borderRadius: '8px', fontSize: 'var(--fs-sm)' }}>
                                                        #{group.receipt_no || '---'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 900, color: '#1e293b', marginBottom: '4px', fontSize: 'var(--fs-sm)' }}>{group.exp_date}</div>
                                                    <span style={{ fontSize: 'var(--fs-xs)', background: group.receipt_type === 'توريد عميل' ? '#dbeafe' : '#fef3c7', color: group.receipt_type === 'توريد عميل' ? '#1d4ed8' : '#d97706', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                                                        {group.receipt_type || 'توريد شركة'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 800, color: THEME.coffeeDark, fontSize: 'var(--fs-sm)' }}>{group.project?.Property || '---'}</div>
                                                    <div style={{ fontSize: 'var(--fs-xs)', color: THEME.ruby, marginTop: '2px', fontWeight: 700 }}>{group.supplier?.name || '---'}</div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', color: '#475569' }}>
                                                            {group.account?.name || '---'}
                                                        </span>
                                                        <span style={{ background: group.is_posted ? '#dcfce7' : '#fef2f2', color: group.is_posted ? '#166534' : '#dc2626', padding: '2px 8px', borderRadius: '6px', fontSize: 'var(--fs-xs)', fontWeight: 900 }}>
                                                            {group.is_posted ? 'معتمد' : 'مسودة'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 900, color: THEME.danger, fontSize: 'var(--fs-lg)' }}>
                                                        {formatCurrency(group.total_receipt_price)}
                                                    </span>
                                                </td>
                                                <td className="no-print">
                                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                logic.setPrintReceiptId(group.id); 
                                                                logic.setIsPrintModalOpen(true); 
                                                            }} 
                                                            style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 900, color: THEME.primary, fontSize: 'var(--fs-xs)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                                        >
                                                            طباعة الفاتورة
                                                        </button>
                                                        
                                                        {!group.is_posted ? (
                                                            <>
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation(); 
                                                                        if (typeof logic.handleEdit === 'function') {
                                                                            logic.handleEdit(group.id);
                                                                        } else if (typeof logic.handleEditSelected === 'function') {
                                                                            logic.setSelectedIds([group.id]);
                                                                            setTimeout(() => logic.handleEditSelected(), 50);
                                                                        }
                                                                    }} 
                                                                    style={{ padding: '6px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 900, fontSize: 'var(--fs-xs)', boxShadow: '0 2px 4px rgba(59,130,246,0.2)' }}
                                                                >
                                                                    تعديل
                                                                </button>

                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (typeof logic.handleAction === 'function') {
                                                                            logic.handleAction('post', group.id);
                                                                        } else if (typeof logic.handleBulkAction === 'function') {
                                                                            logic.setSelectedIds([group.id]);
                                                                            setTimeout(() => logic.handleBulkAction('post'), 50);
                                                                        }
                                                                    }} 
                                                                    disabled={logic.isActionPending} 
                                                                    style={{ padding: '6px 10px', background: THEME.success, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 900, fontSize: 'var(--fs-xs)', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}
                                                                >
                                                                    ترحيل
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (typeof logic.handleAction === 'function') {
                                                                        logic.handleAction('unpost', group.id);
                                                                    } else if (typeof logic.handleBulkAction === 'function') {
                                                                        logic.setSelectedIds([group.id]);
                                                                        setTimeout(() => logic.handleBulkAction('unpost'), 50);
                                                                    }
                                                                }} 
                                                                disabled={logic.isActionPending} 
                                                                style={{ padding: '6px 15px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 900, fontSize: 'var(--fs-xs)', boxShadow: '0 2px 4px rgba(245,158,11,0.2)' }}
                                                            >
                                                                فك
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={7} style={{ padding: 0 }}>
                                                        <div className="child-tree-container">
                                                            <table className="child-table">
                                                                <thead>
    <tr>
        {/* 🚀 خانة التحديد المجمعة */}
        <th className="no-print" style={{ width: '5%', textAlign: 'center' }}>تحديد</th>
        <th style={{ width: '25%', textAlign: 'right' }}>الخامة الموردة</th>
        <th style={{ width: '20%' }}>توجيه الميزانية (BOQ)</th>
        <th style={{ width: '15%' }}>الكمية الموردة (الفاتورة)</th>
        <th style={{ width: '15%' }}>سعر الوحدة</th>
        <th style={{ width: '15%' }}>إجمالي السطر</th>
        <th className="no-print" style={{ width: '10%', textAlign: 'center' }}>إجراءات السطر</th>
    </tr>
</thead>
                                                                <tbody>
                                                                    {group.items.map((item: any, idx: number) => (
                                                                        <tr key={idx} style={{ background: logic.selectedLineItems?.find((i:any)=>i.id===item.id) ? '#e0f2fe' : 'transparent', transition: '0.2s' }}>
                                                                            <td className="no-print" style={{ textAlign: 'center' }}>
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    
                                                                                    checked={!!logic.selectedLineItems?.find((i:any)=>i.id===item.id)}
                                                                                    onChange={(e) => { if (!group.is_posted) { e.preventDefault(); notify('عفواً، الفاتورة غير مرحلة. يجب ترحيل الفاتورة أولاً لتتمكن من الصرف منها.'); return; } if (item.available_qty <= 0) { e.preventDefault(); notify('عفواً، الكمية المتاحة صفر.'); return; } logic.handleToggleLineSelection(item); }}
                                                                                    style={{ transform: 'scale(1.3)', cursor: (!group.is_posted || item.available_qty <= 0) ? 'not-allowed' : 'pointer', accentColor: '#0284c7' }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ textAlign: 'right', fontWeight: 800, color: THEME.primary }}>
                                                                                {item.work_item || item.item_name}
                                                                            </td>
                                                                            <td>
                                                                                <span style={{ color: THEME.goldAccent, fontWeight: 700, fontSize: 'var(--fs-xs)' }}>
                                                                                    {item.boq_item || 'بدون توجيه'}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ fontWeight: 900 }}>
                                                                                {item.quantity} <span style={{fontSize:'var(--fs-xs)', color:'#94a3b8'}}>{item.unit}</span>
                                                                            </td>
                                                                            <td style={{ fontWeight: 800 }}>{formatCurrency(item.unit_price)}</td>
                                                                            <td style={{ fontWeight: 900, color: THEME.danger }}>{formatCurrency(item.total_price)}</td>
                                                                            
                                                                            <td className="no-print" style={{ textAlign: 'center' }}>
                                                                                <button 
                                                                                    onClick={(e) => { 
                                                                                        e.stopPropagation(); 
                                                                                        logic.handleOpenDispense(item); 
                                                                                    }}
                                                                                    
                                                                                    title={!group.is_posted ? "يجب ترحيل الفاتورة أولاً لصرف الخامات" : ""}
                                                                                    style={{ 
                                                                                        background: (group.is_posted && item.available_qty > 0) ? '#3b82f6' : '#cbd5e1', 
                                                                                        color: 'white', border: 'none', padding: '6px 12px', 
                                                                                        borderRadius: '6px', fontWeight: 800, 
                                                                                        cursor: (group.is_posted && item.available_qty > 0) ? 'pointer' : 'not-allowed', 
                                                                                        fontSize: 'var(--fs-xs)', transition: '0.2s', whiteSpace: 'nowrap'
                                                                                    }}
                                                                                >
                                                                                    {item.available_qty > 0 ? 'صرف' : 'رصيد نفذ'}
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {groupedData.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ padding: '30px', color: '#94a3b8', fontWeight: 900 }}>لا توجد فواتير مطابقة للبحث</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* 🔢 نظام الترقيم والصفحات */}
                {!logic.isLoading && groupedData.length > 0 && (
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', padding: '15px', background: 'white', borderRadius: '12px', border: `1px solid ${THEME.sandDark}`, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', color: THEME.coffeeMain, fontWeight: 900 }}>
                            إجمالي الفواتير المطابقة: <b style={{ color: THEME.danger, fontSize: 'var(--fs-lg)' }}>{groupedData.length}</b> فاتورة
                        </div>
                        
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <select 
                                value={rowsPerPage} 
                                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} 
                                style={{ padding: '8px 12px', borderRadius: '8px', border: `2px solid ${THEME.sandDark}`, outline: 'none', fontWeight: 900, color: THEME.coffeeDark, cursor: 'pointer' }}
                            >
                                <option value={10}>عرض 10 فواتير</option>
                                <option value={50}>عرض 50 فاتورة</option>
                                <option value={100}>عرض 100 فاتورة</option>
                                <option value={100000}>عرض الكل (للطباعة)</option>
                            </select>
                            
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    disabled={currentPage === 1} 
                                    onClick={() => setCurrentPage(p => p - 1)} 
                                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: currentPage === 1 ? THEME.sandLight : THEME.coffeeMain, color: currentPage === 1 ? '#94a3b8' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                >
                                    السابق
                                </button>
                                <span style={{ padding: '8px 16px', background: THEME.sandLight, borderRadius: '8px', fontWeight: 900, color: THEME.coffeeDark, border: `1px solid ${THEME.sandDark}` }}>
                                    {currentPage} / {totalPages || 1}
                                </span>
                                <button 
                                    disabled={currentPage >= totalPages} 
                                    onClick={() => setCurrentPage(p => p + 1)} 
                                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: currentPage >= totalPages ? THEME.sandLight : THEME.coffeeMain, color: currentPage >= totalPages ? '#94a3b8' : 'white', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                >
                                    التالي
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <MaterialInvoiceModal 
                    isOpen={logic.isModalOpen} 
                    onClose={() => logic.setIsModalOpen(false)} 
                    logic={logic} 
                />

                <MaterialReceiptPrintModal 
                    isOpen={logic.isPrintModalOpen} 
                    onClose={() => logic.setIsPrintModalOpen(false)} 
                    logic={logic}
                    receiptId={logic.printReceiptId}
                />

                <DispenseMaterialModal 
                    isOpen={logic.isDispenseModalOpen} 
                    onClose={() => logic.setIsDispenseModalOpen(false)} 
                    invoiceItem={logic.selectedInvoiceItem} 
                    onSave={(data: any) => logic.dispenseMaterialMutation.mutate(data)} 
                    isSaving={logic.dispenseMaterialMutation.isPending} 
                />

                {/* 🚀 إدراج المودال الجديد الخاص بالصرف المجمع */}
                <BulkDispenseModal 
                    isOpen={logic.isBulkDispenseModalOpen} 
                    onClose={() => logic.setIsBulkDispenseModalOpen(false)} 
                    selectedLines={logic.selectedLineItems} 
                    onSave={(data: any) => logic.bulkDispenseMutation.mutate(data)} 
                    isSaving={logic.bulkDispenseMutation.isPending} 
                />

            </MasterPage>
        </div>
    );
}