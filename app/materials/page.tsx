"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { buildDocumentFileName } from '@/lib/documentFileName';
import { printWithDocumentTitle } from '@/lib/printWithTitle';
import { useMaterialsLogic } from './materials_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { formatCurrency } from '@/lib/helpers';
import MaterialInvoiceModal from './MaterialInvoiceModal';
import MaterialReceiptPrintModal from './MaterialReceiptPrintModal';
import DispenseMaterialModal from '../material_issues/DispenseMaterialModal';
import { useConfirm } from '@/components/ConfirmContext';
import BulkDispenseModal from './BulkDispenseModal';
import LoadingScreen from '@/components/LoadingScreen';
import KpiStrip from '@/components/KpiStrip';
import { ChevronDown, ChevronLeft, FileText, ListChecks, Package } from 'lucide-react';
import { notify } from '@/lib/notify';
import SendPartnerMessageButton from '@/components/SendPartnerMessageButton';

// =========================================================================
// 🧩 مكون القائمة المنسدلة متعددة الاختيارات مع بحث (Unified Theme Dropdown)
// =========================================================================
const MultiSelectDropdown = ({ options, selected, onChange, placeholder, title }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{title}</span>
                {selected.length > 0 && (
                    <button
                        type="button"
                        style={{
                            color: 'var(--status-negative, #f43f5e)',
                            cursor: 'pointer',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 800,
                            background: 'rgba(244, 63, 94, 0.12)',
                            border: 'none',
                            padding: '2px 0.45rem',
                            borderRadius: '6px',
                        }}
                        onClick={() => onChange([])}
                    >
                        إلغاء ({selected.length})
                    </button>
                )}
            </div>

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="glass-input-field"
                style={{
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    height: '2.75rem',
                    padding: '0 0.75rem',
                    textAlign: 'right',
                }}
            >
                <span
                    style={{
                        fontWeight: 700,
                        color: selected.length ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: 'var(--fs-sm)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {selected.length > 0 ? selected.join('، ') : placeholder}
                </span>
                <ChevronDown
                    size={15}
                    aria-hidden="true"
                    style={{
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                    }}
                />
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 0.4rem)',
                        left: 0,
                        right: 0,
                        background: 'var(--surface-card)',
                        border: '1px solid var(--control-edge, rgba(148, 163, 184, 0.2))',
                        borderRadius: '14px',
                        zIndex: 9999,
                        boxShadow: 'var(--shadow-ambient)',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ padding: '0.5rem', background: 'var(--surface-subcard)', borderBottom: '1px solid rgba(148, 163, 184, 0.12)' }}>
                        <input
                            type="text"
                            placeholder="بحث سريع..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-input-field"
                            style={{ height: '2.35rem', padding: '0 0.75rem', fontSize: 'var(--fs-sm)' }}
                        />
                    </div>
                    <div className="custom-scrollbar" style={{ maxHeight: '12.5rem', overflowY: 'auto', padding: '0.35rem' }}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt: string) => {
                                const isChecked = selected.includes(opt);
                                return (
                                    <label
                                        key={opt}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.6rem',
                                            padding: '0.5rem 0.65rem',
                                            cursor: 'pointer',
                                            borderRadius: '8px',
                                            background: isChecked ? 'var(--accent-soft-bg)' : 'transparent',
                                            transition: 'background 0.15s ease',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggle(opt)}
                                            style={{ accentColor: 'var(--accent-main, #f97316)', transform: 'scale(1.1)', cursor: 'pointer' }}
                                        />
                                        <span
                                            style={{
                                                fontSize: 'var(--fs-sm)',
                                                fontWeight: isChecked ? 800 : 700,
                                                color: isChecked ? 'var(--accent-ink)' : 'var(--text-primary)',
                                            }}
                                        >
                                            {opt}
                                        </span>
                                    </label>
                                );
                            })
                        ) : (
                            <div style={{ padding: '0.9rem', textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>
                                لا توجد نتائج
                            </div>
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
            setExpandedGroups(expandedGroups.filter((id) => id !== groupId));
        } else {
            setExpandedGroups([...expandedGroups, groupId]);
        }
    };

    // 🚀 الفلاتر المتقدمة (Multi-Select State)
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    // استخراج القوائم الفريدة للفلاتر من البيانات
    const uniqueProjects = useMemo(
        () => Array.from(new Set((logic.data || []).map((r: any) => r.project?.Property).filter(Boolean))) as string[],
        [logic.data]
    );
    const uniqueSuppliers = useMemo(
        () => Array.from(new Set((logic.data || []).map((r: any) => r.supplier?.name).filter(Boolean))) as string[],
        [logic.data]
    );
    const uniqueItems = useMemo(
        () => Array.from(new Set((logic.data || []).map((r: any) => r.work_item || r.item_name).filter(Boolean))) as string[],
        [logic.data]
    );

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
                    project_id: row.project_id,
                    job_order_id: row.job_order_id,
                    supplier: row.supplier,
                    account: row.account,
                    is_posted: row.is_posted,
                    total_receipt_price: 0,
                    items: [],
                    _selected: logic.selectedIds?.includes(id),
                };
            }
            groups[id].total_receipt_price += Number(row.total_price) || 0;
            groups[id].items.push({
                ...row,
                quantity: row.quantity || 0,
                available_qty: row.available_qty !== undefined ? row.available_qty : row.quantity || 0,
                project_id: row.project_id || groups[id].project_id,
                project: row.project || groups[id].project,
                job_order_id: row.job_order_id || groups[id].job_order_id || null,
            });
        });

        return Object.values(groups);
    }, [locallyFilteredData, logic.selectedIds]);

    // =========================================================================
    // 🔢 نظام تقسيم الصفحات (Pagination)
    // =========================================================================
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

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
    // =========================================================================
    const exportToExcel = () => {
        const excelData: any[] = [];
        groupedData.forEach((group: any) => {
            group.items.forEach((item: any) => {
                excelData.push({
                    'رقم الفاتورة': group.receipt_no || '---',
                    'تاريخ الفاتورة': group.exp_date,
                    'المشروع': group.project?.Property || '---',
                    'المورد': group.supplier?.name || '---',
                    'نوع الفاتورة': group.receipt_type || '---',
                    'الخامة الموردة': item.work_item || item.item_name,
                    'الكمية': item.quantity,
                    'الوحدة': item.unit,
                    'سعر الوحدة': Number(item.unit_price || 0),
                    'إجمالي السطر': Number(item.total_price || 0),
                    'الحالة المحاسبية': group.is_posted ? 'معتمد' : 'مسودة',
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير التوريدات');

        if (!worksheet['!cols']) worksheet['!cols'] = [];
        worksheet['!cols'] = [
            { wch: 15 },
            { wch: 15 },
            { wch: 25 },
            { wch: 25 },
            { wch: 15 },
            { wch: 35 },
            { wch: 10 },
            { wch: 10 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
        ];
        worksheet['!dir'] = 'rtl';

        const { fileName } = buildDocumentFileName({
            docType: 'تقرير_توريدات_الخامات',
            prefix: 'MRN',
            seedParts: [groupedData.length],
            ext: 'xlsx',
        });
        XLSX.writeFile(workbook, fileName);
    };

    const handlePrintPDF = () => {
        const allGroupIds = groupedData.map((g: any) => g.id);
        setExpandedGroups(allGroupIds);
        setTimeout(() => {
            printWithDocumentTitle({
                docType: 'تقرير_توريدات_الخامات',
                prefix: 'MRN',
                seedParts: [groupedData.length],
            });
        }, 500);
    };

    return (
        <div className="clean-page print-container">
            <MasterPage
                title="مركز توريد خامات المشاريع"
                subtitle="إصدار فواتير الخامات، توجيهها للمشاريع، وربطها بحسابات الموردين والعملاء للخصم التلقائي"
            >
                <RawasiSidebarManager
                    actions={
                        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button type="button" onClick={logic.openAddModal} className="btn-main-glass gold">
                                إصدار فاتورة توريد جديدة
                            </button>

                            {logic.selectedLineItems?.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => logic.setIsBulkDispenseModalOpen(true)}
                                    className="btn-main-glass mat-btn-info"
                                >
                                    صرف مجمع للمحدد ({logic.selectedLineItems.length})
                                </button>
                            )}

                            {logic.selectedIds?.length === 1 && (
                                <button
                                    type="button"
                                    onClick={logic.handleEditSelected}
                                    className="btn-main-glass mat-btn-edit"
                                >
                                    تعديل الفاتورة المحددة
                                </button>
                            )}

                            {logic.selectedIds?.length > 0 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => logic.handleBulkAction('post')}
                                        className="btn-main-glass mat-btn-success"
                                    >
                                        ترحيل المحدد ({logic.selectedIds.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => logic.handleBulkAction('unpost')}
                                        className="btn-main-glass mat-btn-warning"
                                    >
                                        فك ترحيل المحدد ({logic.selectedIds.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            showConfirm({
                                                title: 'مسح فواتير التوريد',
                                                message: `تحذير: هل أنت متأكد من مسح الفواتير التابعة لـ ${logic.selectedIds.length} فاتورة محددة بشكل نهائي؟`,
                                                type: 'danger',
                                                onConfirm: () => logic.handleBulkAction('delete'),
                                            });
                                        }}
                                        className="btn-main-glass mat-btn-danger"
                                    >
                                        مسح المحدد ({logic.selectedIds.length})
                                    </button>
                                </>
                            )}

                            <hr style={{ border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.16)', margin: '0.5rem 0' }} />

                            <button type="button" onClick={exportToExcel} className="btn-main-glass mat-btn-neutral">
                                تصدير الخامات (Excel)
                            </button>
                            <button type="button" onClick={handlePrintPDF} className="btn-main-glass mat-btn-neutral">
                                طباعة التقرير (PDF)
                            </button>
                        </div>
                    }
                    summary={
                        <KpiStrip
                            compact
                            items={[
                                { label: 'قيمة الخامات (حسب التصفية)', amount: filteredTotalCost, tone: 'brand', icon: <Package /> },
                                { label: 'الفواتير المعروضة', value: groupedData.length.toLocaleString('en-US'), tone: 'info', icon: <FileText /> },
                                {
                                    label: 'المحدد للصرف',
                                    value: (logic.selectedLineItems?.length || 0).toLocaleString('en-US'),
                                    tone: 'neutral',
                                    icon: <ListChecks />,
                                    hint: 'سطور خامات',
                                },
                            ]}
                        />
                    }
                    customFilters={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <MultiSelectDropdown
                                title="فلتر المشاريع (الفلل)"
                                placeholder="كل المشاريع"
                                options={uniqueProjects}
                                selected={selectedProjects}
                                onChange={setSelectedProjects}
                            />

                            <MultiSelectDropdown
                                title="فلتر الموردين"
                                placeholder="كل الموردين"
                                options={uniqueSuppliers}
                                selected={selectedSuppliers}
                                onChange={setSelectedSuppliers}
                            />

                            <MultiSelectDropdown
                                title="فلتر الخامات الموردة"
                                placeholder="كل الخامات"
                                options={uniqueItems}
                                selected={selectedItems}
                                onChange={setSelectedItems}
                            />

                            <div>
                                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block', fontWeight: 800 }}>
                                    ترتيب العرض
                                </label>
                                <select
                                    className="glass-input-field"
                                    aria-label="ترتيب العرض"
                                    value={logic.sortBy}
                                    onChange={(e) => logic.setSortBy(e.target.value)}
                                >
                                    <option value="newest">الأحدث إضافة</option>
                                    <option value="oldest">الأقدم</option>
                                    <option value="highest_price">السعر: الأعلى أولاً</option>
                                    <option value="lowest_price">السعر: الأقل أولاً</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10.5rem, 1fr))', gap: '0.5rem' }}>
                                <div>
                                    <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block', fontWeight: 800 }}>
                                        من تاريخ
                                    </label>
                                    <input
                                        type="date"
                                        className="glass-input-field"
                                        value={logic.dateFrom}
                                        onChange={(e) => logic.setDateFrom(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block', fontWeight: 800 }}>
                                        إلى تاريخ
                                    </label>
                                    <input
                                        type="date"
                                        className="glass-input-field"
                                        value={logic.dateTo}
                                        onChange={(e) => logic.setDateTo(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    }
                    onSearch={(value) => logic.setGlobalSearch(value)}
                    placeholder="ابحث برقم الفاتورة أو البيان…"
                    watchDeps={[
                        logic.globalSearch,
                        logic.dateFrom,
                        logic.dateTo,
                        logic.selectedIds,
                        logic.sortBy,
                        currentPage,
                        rowsPerPage,
                        groupedData,
                        selectedProjects,
                        selectedSuppliers,
                        selectedItems,
                        logic.selectedLineItems,
                    ]}
                />

                <style>{`
                    .glass-input-field {
                        width: 100%;
                        padding: 0.6rem 0.75rem;
                        border-radius: 12px;
                        background: var(--surface-sunken);
                        border: 1px solid var(--control-edge, rgba(148, 163, 184, 0.14));
                        box-shadow: var(--shadow-sunken);
                        outline: none;
                        font-weight: 700;
                        font-size: var(--fs-sm);
                        color: var(--text-primary);
                        color-scheme: var(--native-color-scheme);
                        transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    }
                    .glass-input-field option {
                        background: var(--surface-card);
                        color: var(--text-primary);
                    }
                    .glass-input-field:focus {
                        border-color: var(--accent-main, #f97316);
                        box-shadow: var(--shadow-sunken), 0 0 0 2px var(--accent-glow);
                    }

                    .btn-main-glass {
                        width: 100%;
                        padding: 0.72rem 0.9rem;
                        border-radius: 12px;
                        border: none;
                        font-weight: 900;
                        cursor: pointer;
                        transition: transform 0.18s ease, filter 0.18s ease, background 0.18s ease;
                        font-size: var(--fs-sm);
                    }
                    .btn-main-glass:hover:not(:disabled) {
                        filter: brightness(1.08);
                    }
                    .mat-btn-info {
                        background: rgba(14, 165, 233, 0.16);
                        color: var(--status-info, #38bdf8);
                        border: 1px solid rgba(56, 189, 248, 0.35);
                    }
                    .mat-btn-edit {
                        background: rgba(59, 130, 246, 0.16);
                        color: #60a5fa;
                        border: 1px solid rgba(96, 165, 250, 0.35);
                    }
                    .mat-btn-success {
                        background: rgba(16, 185, 129, 0.16);
                        color: var(--status-positive, #10b981);
                        border: 1px solid rgba(16, 185, 129, 0.35);
                    }
                    .mat-btn-warning {
                        background: rgba(245, 158, 11, 0.16);
                        color: var(--status-warning, #f59e0b);
                        border: 1px solid rgba(245, 158, 11, 0.35);
                    }
                    .mat-btn-danger {
                        background: rgba(244, 63, 94, 0.16);
                        color: var(--status-negative, #f43f5e);
                        border: 1px solid rgba(244, 63, 94, 0.35);
                    }
                    .mat-btn-neutral {
                        background: var(--surface-subcard);
                        color: var(--text-primary);
                        border: 1px solid var(--control-edge, rgba(148, 163, 184, 0.16));
                    }

                    /* 🌟 حاوية الجدول الموحدة مع نظام الأوبسيديان والوضع الفاتح */
                    .materials-table-shell {
                        position: relative;
                        width: 100%;
                        overflow-x: auto;
                        background: var(--surface-card);
                        border-radius: 20px;
                        box-shadow: var(--shadow-ambient);
                        backdrop-filter: blur(20px);
                        -webkit-backdrop-filter: blur(20px);
                    }
                    .materials-table-shell::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 8%;
                        right: 8%;
                        height: 1.5px;
                        background: var(--specular-beam);
                        pointer-events: none;
                        z-index: 2;
                    }

                    .tree-table {
                        width: 100%;
                        min-width: 56rem;
                        border-collapse: collapse;
                        text-align: center;
                        color: var(--text-primary);
                    }
                    .tree-thead th {
                        background: var(--table-head-bg);
                        color: var(--text-secondary);
                        padding: 0.95rem 0.75rem;
                        font-size: var(--fs-xs);
                        font-weight: 900;
                        letter-spacing: 0.01em;
                        border-bottom: 1px solid var(--table-zebra-bg);
                        white-space: nowrap;
                    }

                    .master-group-row {
                        cursor: pointer;
                        background: transparent;
                        border-bottom: 1px solid var(--table-zebra-bg);
                        transition: background 0.18s ease;
                    }
                    .master-group-row:hover {
                        background: var(--table-row-hover);
                    }
                    .master-group-row[data-selected="true"] {
                        background: var(--accent-soft-bg);
                    }
                    .master-group-row td {
                        padding: 0.85rem 0.75rem;
                        font-size: var(--fs-sm);
                        font-weight: 700;
                        color: var(--text-primary);
                        vertical-align: middle;
                    }

                    .child-tree-container {
                        background: var(--surface-sunken);
                        padding: 1rem 1.5rem;
                        border-bottom: 1px solid var(--table-zebra-bg);
                    }
                    .child-table {
                        width: 100%;
                        border-collapse: collapse;
                        background: var(--surface-card);
                        border-radius: 14px;
                        border: 1px solid var(--control-edge, rgba(148, 163, 184, 0.14));
                        overflow: hidden;
                    }
                    .child-table th {
                        background: var(--table-head-bg);
                        color: var(--text-secondary);
                        padding: 0.7rem 0.65rem;
                        font-size: var(--fs-xs);
                        font-weight: 900;
                        border-bottom: 1px solid var(--table-zebra-bg);
                    }
                    .child-table td {
                        padding: 0.75rem 0.65rem;
                        border-bottom: 1px solid var(--table-zebra-bg);
                        font-size: var(--fs-sm);
                        font-weight: 700;
                        color: var(--text-primary);
                        font-variant-numeric: tabular-nums;
                    }
                    .child-table tbody tr:last-child td {
                        border-bottom: none;
                    }

                    .arrow-icon {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 1.5rem;
                        height: 1.5rem;
                        border-radius: 6px;
                        margin-left: 0.45rem;
                        color: var(--accent-ink);
                        background: var(--accent-soft-bg);
                        transition: transform 0.2s ease;
                        vertical-align: middle;
                    }
                    .arrow-expanded {
                        transform: rotate(-90deg);
                    }

                    .mat-row-action {
                        padding: 0.38rem 0.7rem;
                        border-radius: 8px;
                        border: 1px solid transparent;
                        cursor: pointer;
                        font-weight: 800;
                        font-size: var(--fs-xs);
                        transition: filter 0.15s ease, background 0.15s ease;
                        white-space: nowrap;
                    }
                    .mat-row-action:hover:not(:disabled) {
                        filter: brightness(1.1);
                    }
                    .mat-row-action:disabled {
                        opacity: 0.55;
                        cursor: not-allowed;
                    }

                    /* تنسيقات الطباعة */
                    @media print {
                        @page { size: A4 landscape; margin: 10mm; }
                        body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .no-print { display: none !important; }
                        .print-container { padding: 0 !important; }
                        .materials-table-shell { background: white !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
                        .materials-table-shell::before { display: none !important; }
                        .tree-table { min-width: 0 !important; border: 1px solid #000; color: #000 !important; }
                        .tree-thead th { background: #eee !important; color: #000 !important; border: 1px solid #000; }
                        .master-group-row td { border: 1px solid #000; color: #000 !important; }
                        .child-tree-container { background: #fafafa !important; padding: 0.5rem !important; }
                        .child-table { background: white !important; border: 1px solid #000 !important; }
                        .child-table th { background: #ddd !important; color: #000 !important; border: 1px solid #000; }
                        .child-table td { border: 1px solid #000; color: #000 !important; }
                    }
                `}</style>

                {/* 🌳 جدول الشجرة التجميعي الذكي بناءً على الفاتورة */}
                <div className="materials-table-shell">
                    {logic.isLoading ? (
                        <LoadingScreen message="جاري تحميل فواتير التوريد..." fullScreen={false} />
                    ) : (
                        <table className="tree-table">
                            <thead className="tree-thead">
                                <tr>
                                    <th className="no-print" style={{ width: '5%' }}>
                                        <input
                                            type="checkbox"
                                            checked={paginatedGroups.length > 0 && paginatedGroups.every((g) => g._selected)}
                                            onChange={logic.handleSelectAll}
                                            style={{ transform: 'scale(1.25)', cursor: 'pointer', accentColor: 'var(--accent-main, #f97316)' }}
                                        />
                                    </th>
                                    <th style={{ width: '16%' }}>رقم الفاتورة</th>
                                    <th style={{ width: '14%' }}>التاريخ والنوع</th>
                                    <th style={{ width: '21%' }}>التوجيه والمورد</th>
                                    <th style={{ width: '15%' }}>الحالة المحاسبية</th>
                                    <th style={{ width: '14%' }}>إجمالي الفاتورة</th>
                                    <th className="no-print" style={{ width: '15%' }}>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedGroups.map((group) => {
                                    const isExpanded = expandedGroups.includes(group.id);
                                    const isClientSupply = group.receipt_type === 'توريد عميل';

                                    return (
                                        <React.Fragment key={group.id}>
                                            <tr
                                                className="master-group-row"
                                                data-selected={group._selected ? 'true' : 'false'}
                                                onClick={(e) => {
                                                    const target = e.target as HTMLElement;
                                                    if (!target.closest('button, input, a')) {
                                                        toggleGroup(group.id);
                                                    }
                                                }}
                                            >
                                                <td className="no-print">
                                                    <input
                                                        type="checkbox"
                                                        checked={group._selected}
                                                        onChange={() => logic.handleSelectRow(group.id)}
                                                        style={{ transform: 'scale(1.25)', cursor: 'pointer', accentColor: 'var(--accent-main, #f97316)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span className={`arrow-icon no-print ${isExpanded ? 'arrow-expanded' : ''}`}>
                                                            <ChevronLeft size={14} aria-hidden="true" />
                                                        </span>
                                                        <span
                                                            style={{
                                                                display: 'inline-block',
                                                                fontWeight: 900,
                                                                color: 'var(--accent-ink)',
                                                                background: 'var(--accent-soft-bg)',
                                                                padding: '0.28rem 0.65rem',
                                                                borderRadius: '8px',
                                                                fontSize: 'var(--fs-sm)',
                                                                fontVariantNumeric: 'tabular-nums',
                                                            }}
                                                        >
                                                            #{group.receipt_no || '---'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem', fontSize: 'var(--fs-sm)', fontVariantNumeric: 'tabular-nums' }}>
                                                        {group.exp_date}
                                                    </div>
                                                    <span
                                                        style={{
                                                            fontSize: 'var(--fs-xs)',
                                                            background: isClientSupply ? 'rgba(56, 189, 248, 0.14)' : 'var(--accent-soft-bg)',
                                                            color: isClientSupply ? 'var(--status-info, #38bdf8)' : 'var(--accent-ink)',
                                                            padding: '2px 0.55rem',
                                                            borderRadius: '999px',
                                                            fontWeight: 800,
                                                            display: 'inline-block',
                                                        }}
                                                    >
                                                        {group.receipt_type || 'توريد شركة'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }}>
                                                        {group.project?.Property || '---'}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: 700 }}>
                                                        {group.supplier?.name || '---'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                                                        <span
                                                            style={{
                                                                fontSize: 'var(--fs-xs)',
                                                                fontWeight: 700,
                                                                background: 'var(--surface-subcard)',
                                                                padding: '2px 0.55rem',
                                                                borderRadius: '6px',
                                                                color: 'var(--text-secondary)',
                                                            }}
                                                        >
                                                            {group.account?.name || (isClientSupply ? 'حساب 217 • خامات عملاء' : '---')}
                                                        </span>
                                                        <span
                                                            style={{
                                                                background: group.is_posted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.14)',
                                                                color: group.is_posted ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)',
                                                                padding: '2px 0.6rem',
                                                                borderRadius: '999px',
                                                                fontSize: 'var(--fs-xs)',
                                                                fontWeight: 900,
                                                            }}
                                                        >
                                                            {group.is_posted ? 'معتمد' : 'مسودة'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 900, color: 'var(--accent-ink)', fontSize: 'var(--fs-md)', fontVariantNumeric: 'tabular-nums' }}>
                                                        {formatCurrency(group.total_receipt_price)}
                                                    </span>
                                                </td>
                                                <td className="no-print">
                                                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                                                        <button
                                                            type="button"
                                                            className="mat-row-action"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                logic.setPrintReceiptId(group.id);
                                                                logic.setIsPrintModalOpen(true);
                                                            }}
                                                            style={{
                                                                background: 'var(--surface-subcard)',
                                                                color: 'var(--text-primary)',
                                                                borderColor: 'var(--control-edge, rgba(148, 163, 184, 0.18))',
                                                            }}
                                                        >
                                                            طباعة
                                                        </button>

                                                        <SendPartnerMessageButton
                                                            partnerId={group.supplier?.id}
                                                            partnerName={group.supplier?.name}
                                                            operation={{
                                                                type: 'material_supply',
                                                                reference: group.receipt_no,
                                                                date: group.exp_date,
                                                                project: group.project?.Property,
                                                                amount: group.total_receipt_price,
                                                                description: `${group.receipt_type || 'فاتورة توريد خامات'} (${group.items?.length || 0} أصناف)`,
                                                                status: group.is_posted ? 'معتمد' : 'مسودة',
                                                                extraLines: [
                                                                    {
                                                                        label: 'الأصناف',
                                                                        value: (group.items || [])
                                                                            .slice(0, 4)
                                                                            .map((i: any) => `${i.item_name} (${i.quantity} ${i.unit || ''})`.trim())
                                                                            .join('، '),
                                                                    },
                                                                ],
                                                            }}
                                                        />

                                                        {!group.is_posted ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="mat-row-action"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (typeof logic.handleEdit === 'function') {
                                                                            logic.handleEdit(group.id);
                                                                        } else if (typeof logic.handleEditSelected === 'function') {
                                                                            logic.setSelectedIds([group.id]);
                                                                            setTimeout(() => logic.handleEditSelected(), 50);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        background: 'rgba(59, 130, 246, 0.16)',
                                                                        color: '#60a5fa',
                                                                        borderColor: 'rgba(96, 165, 250, 0.35)',
                                                                    }}
                                                                >
                                                                    تعديل
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className="mat-row-action"
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
                                                                    style={{
                                                                        background: 'rgba(16, 185, 129, 0.16)',
                                                                        color: 'var(--status-positive, #10b981)',
                                                                        borderColor: 'rgba(16, 185, 129, 0.35)',
                                                                    }}
                                                                >
                                                                    ترحيل
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="mat-row-action"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const availableItems = (group.items || []).filter((i: any) => Number(i.available_qty) > 0);
                                                                        if (availableItems.length === 0) {
                                                                            notify('عفواً، رصيد جميع أصناف هذه الفاتورة صفر بالمخزن.');
                                                                            return;
                                                                        }
                                                                        if (availableItems.length === 1) {
                                                                            logic.handleOpenDispense(availableItems[0]);
                                                                        } else {
                                                                            logic.setSelectedLineItems(availableItems);
                                                                            logic.setIsBulkDispenseModalOpen(true);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        background: 'var(--action-fill)',
                                                                        color: 'var(--action-ink)',
                                                                    }}
                                                                >
                                                                    صرف
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className="mat-row-action"
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
                                                                    style={{
                                                                        background: 'rgba(245, 158, 11, 0.16)',
                                                                        color: 'var(--status-warning, #f59e0b)',
                                                                        borderColor: 'rgba(245, 158, 11, 0.35)',
                                                                        padding: '0.38rem 0.85rem',
                                                                    }}
                                                                >
                                                                    فك
                                                                </button>
                                                            </>
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
                                                                        <th className="no-print" style={{ width: '6%', textAlign: 'center' }}>تحديد</th>
                                                                        <th style={{ width: '25%', textAlign: 'right' }}>الخامة الموردة</th>
                                                                        <th style={{ width: '20%' }}>توجيه الميزانية (BOQ)</th>
                                                                        <th style={{ width: '14%' }}>الكمية الموردة</th>
                                                                        <th style={{ width: '13%' }}>سعر الوحدة</th>
                                                                        <th style={{ width: '13%' }}>إجمالي السطر</th>
                                                                        <th className="no-print" style={{ width: '9%', textAlign: 'center' }}>الصرف</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {group.items.map((item: any, idx: number) => {
                                                                        const isLineSelected = !!logic.selectedLineItems?.find((i: any) => i.id === item.id);
                                                                        const canDispense = group.is_posted && item.available_qty > 0;
                                                                        return (
                                                                            <tr
                                                                                key={item.id || idx}
                                                                                style={{
                                                                                    background: isLineSelected ? 'var(--accent-soft-bg)' : 'transparent',
                                                                                    transition: 'background 0.18s ease',
                                                                                }}
                                                                            >
                                                                                <td className="no-print" style={{ textAlign: 'center' }}>
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isLineSelected}
                                                                                        onChange={(e) => {
                                                                                            if (!group.is_posted) {
                                                                                                e.preventDefault();
                                                                                                notify('عفواً، الفاتورة غير مرحلة. يجب ترحيل الفاتورة أولاً لتتمكن من الصرف منها.');
                                                                                                return;
                                                                                            }
                                                                                            if (item.available_qty <= 0) {
                                                                                                e.preventDefault();
                                                                                                notify('عفواً، الكمية المتاحة صفر.');
                                                                                                return;
                                                                                            }
                                                                                            logic.handleToggleLineSelection(item);
                                                                                        }}
                                                                                        style={{
                                                                                            transform: 'scale(1.2)',
                                                                                            cursor: !canDispense ? 'not-allowed' : 'pointer',
                                                                                            accentColor: 'var(--accent-main, #f97316)',
                                                                                        }}
                                                                                    />
                                                                                </td>
                                                                                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                                                                                    {item.work_item || item.item_name}
                                                                                </td>
                                                                                <td>
                                                                                    <span style={{ color: 'var(--accent-ink)', fontWeight: 700, fontSize: 'var(--fs-xs)' }}>
                                                                                        {item.boq_item || 'بدون توجيه'}
                                                                                    </span>
                                                                                </td>
                                                                                <td style={{ fontWeight: 900, color: 'var(--text-primary)' }}>
                                                                                    {item.quantity}{' '}
                                                                                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>
                                                                                        {item.unit}
                                                                                    </span>
                                                                                </td>
                                                                                <td style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                                                                                    {formatCurrency(item.unit_price)}
                                                                                </td>
                                                                                <td style={{ fontWeight: 900, color: 'var(--accent-ink)' }}>
                                                                                    {formatCurrency(item.total_price)}
                                                                                </td>
                                                                                <td className="no-print" style={{ textAlign: 'center' }}>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="mat-row-action"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            logic.handleOpenDispense(item);
                                                                                        }}
                                                                                        title={!group.is_posted ? 'يجب ترحيل الفاتورة أولاً لصرف الخامات' : ''}
                                                                                        style={{
                                                                                            background: canDispense ? 'var(--action-fill)' : 'var(--surface-subcard)',
                                                                                            color: canDispense ? 'var(--action-ink)' : 'var(--text-muted)',
                                                                                            cursor: canDispense ? 'pointer' : 'not-allowed',
                                                                                        }}
                                                                                    >
                                                                                        {item.available_qty > 0 ? 'صرف' : 'رصيد نفذ'}
                                                                                    </button>
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
                                {groupedData.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ padding: '2.25rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                                            لا توجد فواتير مطابقة للبحث
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* 🔢 نظام الترقيم والصفحات */}
                {!logic.isLoading && groupedData.length > 0 && (
                    <div
                        className="no-print"
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            marginTop: '1rem',
                            padding: '0.9rem 1.25rem',
                            background: 'var(--surface-card)',
                            borderRadius: '16px',
                            boxShadow: 'var(--shadow-ambient)',
                        }}
                    >
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 800 }}>
                            إجمالي الفواتير المطابقة:{' '}
                            <b style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-lg)', fontVariantNumeric: 'tabular-nums' }}>
                                {groupedData.length}
                            </b>{' '}
                            فاتورة
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setRowsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="glass-input-field"
                                style={{ width: 'auto', minWidth: '9.5rem', cursor: 'pointer', padding: '0.45rem 0.75rem' }}
                            >
                                <option value={10}>عرض 10 فواتير</option>
                                <option value={50}>عرض 50 فاتورة</option>
                                <option value={100}>عرض 100 فاتورة</option>
                                <option value={100000}>عرض الكل (للطباعة)</option>
                            </select>

                            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p) => p - 1)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: currentPage === 1 ? 'var(--surface-subcard)' : 'var(--action-fill)',
                                        color: currentPage === 1 ? 'var(--text-muted)' : 'var(--action-ink)',
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                        fontWeight: 900,
                                        fontSize: 'var(--fs-sm)',
                                        transition: '0.2s',
                                    }}
                                >
                                    السابق
                                </button>
                                <span
                                    style={{
                                        padding: '0.5rem 0.95rem',
                                        background: 'var(--surface-sunken)',
                                        boxShadow: 'var(--shadow-sunken)',
                                        borderRadius: '10px',
                                        fontWeight: 900,
                                        color: 'var(--text-primary)',
                                        fontSize: 'var(--fs-sm)',
                                        fontVariantNumeric: 'tabular-nums',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {currentPage} / {totalPages || 1}
                                </span>
                                <button
                                    type="button"
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setCurrentPage((p) => p + 1)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: currentPage >= totalPages ? 'var(--surface-subcard)' : 'var(--action-fill)',
                                        color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--action-ink)',
                                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                                        fontWeight: 900,
                                        fontSize: 'var(--fs-sm)',
                                        transition: '0.2s',
                                    }}
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
