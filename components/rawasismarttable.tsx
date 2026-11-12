"use client";
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { ArrowDown, ArrowUp, Download, Printer } from 'lucide-react';

// 🟢 التعديل الأهم: تغيير النوع ليقبل React.ReactNode (مثل الـ Checkbox) بالإضافة للنصوص
interface Column {
    header?: React.ReactNode | string; 
    label?: React.ReactNode | string;
    key?: string;
    accessor?: string;
    render?: (row: any) => React.ReactNode;
    // 🚀 الإضافة الجديدة: دالة مخصصة لاستخراج البيانات النظيفة للإكسيل
    exportValue?: (row: any) => string | number; 
    // 🚀 الإضافة الجديدة: التحكم بإخفاء أعمدة معينة من الإكسيل
    excludeFromExport?: boolean;
}

interface RawasiSmartTableProps {
    title?: string;
    data: any[];
    columns: Column[];
    fileName?: string;
    selectable?: boolean;
    selectedIds?: any[];
    rowKey?: string;
    onSelectionChange?: (ids: any[]) => void;
    onRowClick?: (row: any) => void;
    emptyMessage?: string;
    
    // 🚀 خصائص الـ Pagination المدمجة
    enablePagination?: boolean;
    currentPage?: number;
    totalItems?: number;
    rowsPerPage?: number;
    onPageChange?: (page: number) => void;
    onRowsChange?: (rows: number) => void;
    
    // 🚀 خصائص إضافية مفقودة
    isLoading?: boolean;
    enableExport?: boolean;
    onRefresh?: (options?: any) => Promise<any> | void;
    onSearch?: (term: string) => void;
    searchPlaceholder?: string;
}

export default function RawasiSmartTable({ 
    title, data, columns, fileName = 'Phi_Tech_Report',
    selectable, selectedIds = [], rowKey = 'id', onSelectionChange, onRowClick, emptyMessage,
    
    enablePagination = true,
    currentPage: externalPage,
    totalItems: externalTotal,
    rowsPerPage: externalRowsPerPage,
    onPageChange,
    onRowsChange
}: RawasiSmartTableProps) {
    
    // 🧮 Internal state for pagination if not provided by parent
    const [internalPage, setInternalPage] = useState(1);
    const [internalRowsPerPage, setInternalRowsPerPage] = useState(50);

    const handlePageChange = (p: number) => {
        setInternalPage(p);
        if (onPageChange) onPageChange(p);
    };

    const handleRowsChange = (r: number) => {
        setInternalRowsPerPage(r);
        setInternalPage(1);
        if (onRowsChange) onRowsChange(r);
    };

    // 🚀 محرك الفرز (Sorting Engine)
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (accessorOrKey: string | undefined) => {
        if (!accessorOrKey) return;
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === accessorOrKey && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key: accessorOrKey, direction });
    };

    // 🚀 معالجة البيانات للفرز (يتم على جميع البيانات بالخلفية ليكون سريعاً ولا يعطل المتصفح)
    const sortedData = useMemo(() => {
        let sortableItems = [...data];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (aValue == null) aValue = '';
                if (bValue == null) bValue = '';

                // معالجة الأرقام والنصوص بشكل صحيح
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }

                if (aValue.toString().toLowerCase() < bValue.toString().toLowerCase()) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue.toString().toLowerCase() > bValue.toString().toLowerCase()) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [data, sortConfig]);

    // 🧮 حساب عدد الصفحات الديناميكي
    const activePage = externalPage !== undefined ? externalPage : internalPage;
    const activeRows = externalRowsPerPage !== undefined ? externalRowsPerPage : internalRowsPerPage;
    const activeTotal = externalTotal || sortedData.length;
    const totalPages = Math.ceil(activeTotal / activeRows) || 1;

    // 🚀 محرك القص (Pagination Engine): لضمان عدم تهنيج المتصفح عند إرسال آلاف السجلات
    const paginatedData = useMemo(() => {
        if (!enablePagination) return sortedData;
        const startIndex = (activePage - 1) * activeRows;
        return sortedData.slice(startIndex, startIndex + activeRows);
    }, [sortedData, enablePagination, activePage, activeRows]);

    const exportToExcel = () => {
        if (!data || data.length === 0) return toast.error('عفواً، لا توجد بيانات للتصدير');
        const toastId = toast.loading('جاري تحضير ملف Excel...');
        try {
            // يتم التصدير من `sortedData` لضمان تصدير جميع البيانات (وليس فقط المقطوعة) وبنفس ترتيب الفرز
            const exportData = sortedData.map(row => {
                const newRow: any = {};
                columns.forEach(col => { 
                    // تخطي أعمدة الإجراءات والتحديد من الإكسيل
                    if (col.excludeFromExport || col.accessor === 'actions' || col.key === 'actions') return;

                    // إذا كان الهيدر عبارة عن كود React، لا تقم بتصديره كاسم عمود (استخدم مفتاح بديل)
                    const headerName = typeof col.label === 'string' ? col.label : (typeof col.header === 'string' ? col.header : col.accessor || 'Column');
                    const keyName = col.key || col.accessor || '';
                    
                    // استخدام دالة exportValue إذا وجدت، وإلا استخدام القيمة المباشرة
                    let val = col.exportValue ? col.exportValue(row) : (keyName ? row[keyName] : undefined);
                    
                    newRow[headerName] = val !== undefined && val !== null ? val : '---'; 
                });
                return newRow;
            });
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "التقرير");
            XLSX.writeFile(workbook, `${fileName}_${new Date().toLocaleDateString('en-GB')}.xlsx`);
            toast.success('تم تصدير ملف Excel بنجاح', { id: toastId });
        } catch (error) {
            toast.error('حدث خطأ أثناء التصدير', { id: toastId });
        }
    };

    const exportToPDF = () => {
        if (!data || data.length === 0) return toast.error('عفواً، لا توجد بيانات للتصدير');
        const toastId = toast.loading('جاري تحضير ملف PDF...');
        try {
            // استخدام نافذة الطباعة كحل أمثل للغة العربية
            window.print();
            toast.success('تم فتح نافذة الطباعة بنجاح', { id: toastId });
        } catch (error) {
            toast.error('حدث خطأ أثناء التصدير', { id: toastId });
        }
    };

    const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
    const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

    return (
        <div className="rawasi-table-wrapper">
            
            {/* 🛠️ شريط أدوات الجدول (أزرار التصدير والعنوان) */}
            <div className="table-toolbar hide-on-print">
                <div className="rawasi-table-exports">
                    <button onClick={exportToExcel} className="rawasi-table-button"><Download size={15} aria-hidden="true" /> Excel</button>
                    <button onClick={exportToPDF} className="rawasi-table-button"><Printer size={15} aria-hidden="true" /> PDF</button>
                </div>
            </div>

            <div className="rawasi-table-scroll">
                <table className="rawasi-printable-table">
                    <thead>
                        <tr>
                            {selectable && (
                                <th className="rawasi-table-check hide-on-print">
                                    <input 
                                        type="checkbox" 
                                        onChange={(e) => {
                                            // 🚀 تم تغييرها للتعامل مع البيانات المعروضة في الصفحة فقط عند التحديد السريع
                                            if (e.target.checked) onSelectionChange?.(paginatedData.map(i => i.id));
                                            else onSelectionChange?.([]);
                                        }}
                                        checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length}
                                        className="rawasi-table-checkbox"
                                    />
                                </th>
                            )}
                            {columns.map((col, idx) => {
                                const sortKey = col.key || col.accessor;
                                const isSorted = sortConfig?.key === sortKey;
                                
                                return (
                                    <th 
                                        key={idx} 
                                        onClick={() => handleSort(sortKey)}
                                        className={sortKey ? 'rawasi-table-sortable' : undefined}
                                        aria-sort={isSorted ? (sortConfig?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                                        title={sortKey ? `فرز حسب ${typeof col.label === 'string' ? col.label : (typeof col.header === 'string' ? col.header : '')}` : ''}
                                    >
                                        <div className="rawasi-table-column-label">
                                            {/* 🟢 الآن يمكن رسم الـ Checkbox هنا بدون أخطاء */}
                                            {col.label || col.header}
                                            
                                            {/* مؤشر الفرز */}
                                            {sortKey && (
                                                <span className={`rawasi-table-sort-indicator ${isSorted ? 'is-sorted' : ''}`} aria-hidden="true">
                                                    {sortConfig?.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                        {paginatedData.length === 0 ? (
                            <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="rawasi-table-empty">{emptyMessage || 'لا توجد بيانات'}</td></tr>
                        ) : (
                            // 🚀 رسم البيانات المقطوعة فقط لمنع تهنيج المتصفح
                            paginatedData.map((row, rowIndex) => (
                                <motion.tr 
                                    key={row._unique_key || row[rowKey] || rowIndex}
                                    variants={itemVariants} 
                                    onClick={() => onRowClick?.(row)} 
                                    className="table-row-hover"
                                    data-clickable={onRowClick ? 'true' : undefined}
                                    data-selected={selectable && selectedIds.includes(row[rowKey]) ? 'true' : undefined}
                                >
                                    {selectable && (
                                        <td className="rawasi-table-check hide-on-print" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.includes(row[rowKey])}
                                                onChange={() => {
                                                    const newSelection = selectedIds.includes(row[rowKey])
                                                        ? selectedIds.filter(id => id !== row[rowKey])
                                                        : [...selectedIds, row[rowKey]];
                                                    onSelectionChange?.(newSelection);
                                                }}
                                                className="rawasi-table-checkbox"
                                            />
                                        </td>
                                    )}
                                    {columns.map((col, colIndex) => (
                                        <td key={colIndex}>
                                            {col.render ? col.render(row) : (row[col.key || col.accessor || ''] || '---')}
                                        </td>
                                    ))}
                                </motion.tr>
                            ))
                        )}
                    </motion.tbody>
                </table>
            </div>

            {enablePagination && activeTotal > 0 && (
                <div className="rawasi-table-footer hide-on-print">
                    <div className="rawasi-table-page-size">
                        <span>عرض:</span>
                        <select 
                            value={activeRows} 
                            onChange={(e) => handleRowsChange(Number(e.target.value))}
                            className="rawasi-table-page-select"
                            aria-label="عدد السجلات في الصفحة"
                        >
                            <option value="50">50 سجل</option>
                            <option value="100">100 سجل</option>
                            <option value="500">500 سجل</option>
                        </select>
                        <span className="rawasi-table-total">من إجمالي {activeTotal}</span>
                    </div>

                    <div className="rawasi-table-pagination">
                        <button 
                            disabled={activePage === 1} 
                            onClick={(e) => { e.stopPropagation(); handlePageChange(activePage - 1); }} 
                            className="rawasi-table-button"
                        >
                            السابق
                        </button>
                        <div className="rawasi-table-page-number" aria-live="polite">
                            صفحة {activePage} من {totalPages}
                        </div>
                        <button 
                            disabled={activePage >= totalPages} 
                            onClick={(e) => { e.stopPropagation(); handlePageChange(activePage + 1); }} 
                            className="rawasi-table-button"
                        >
                            التالي
                        </button>
                    </div>
                </div>
            )}

            {/* 🎨 CSS للطباعة ولتأثيرات الهوفر */}
            <style>{`
                @media print {
                    /* الطباعة بتطلع الجدول بس + ترويسة الطباعة الرسمية فوقه (من غير فراغات مكان العناصر المخفية).
                       الصفحات اللي ليها منطقة طباعة خاصة أو مستند مفتوح بتتطبع بطريقتها هي. */
                    body:not(:has(.print-modal-overlay, .phi-print-own-header, .print-area, .print-only)) *:not(:has(.rawasi-printable-table, .phi-print-masthead)):not(.rawasi-printable-table):not(.rawasi-printable-table *):not(.phi-print-masthead):not(.phi-print-masthead *):not(style):not(script) { display: none !important; }
                    .rawasi-printable-table { width: 100%; }
                    .hide-on-print { display: none !important; }
                    /* إخفاء عمود التحديد والـ Actions عند الطباعة */
                    .rawasi-printable-table th:first-child, .rawasi-printable-table td:first-child { display: none !important; }
                    .rawasi-printable-table { border: 1px solid #000; }
                    .rawasi-printable-table th, .rawasi-printable-table td { border: 1px solid #000; padding: 8px; }
                }
            `}</style>
        </div>
    );
}
