"use client";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import SecureAction from '@/components/SecureAction';
import MasterPage from '@/components/MasterPage';
import { useSubClaimsLogic } from './sub_claims_logic';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import RawasiSmartTable from '@/components/rawasismarttable';
import AssignWorkModal from './AssignWorkModal'; 
import ClaimFormModal from './ClaimFormModal'; 
import PrintClaimModal from './PrintClaimModal'; 
import AddContractorModal from './AddContractorModal';
import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import PaymentVoucherModal from '../PaymentVouchers/PaymentVoucherModal';
import { 
  Search, HardHat, ScanSearch, Plus, Download, RotateCw, 
  ArrowRight, FileText, Banknote, Briefcase, Phone, MapPin,
  ClipboardList, CheckCircle2, Clock3, Layers, Filter
} from 'lucide-react';
import PhiIcon from '@/components/PhiIcon';

// 🚀 قائمة منسدلة ذكية للفلاتر المتعددة
const FilterDropdown = ({ title, options, selectedOptions, setSelectedOptions }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: any) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const toggleOption = (opt: string) => {
        if (selectedOptions.includes(opt)) {
            setSelectedOptions(selectedOptions.filter((o: string) => o !== opt));
        } else {
            setSelectedOptions([...selectedOptions, opt]);
        }
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', minWidth: '13.75rem' }}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{ background: 'var(--surface-sunken, #f8fafc)', border: 'none', boxShadow: 'var(--shadow-sunken)', borderRadius: '12px', padding: '0.625rem 0.9375rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: 'var(--fs-sm)', color: selectedOptions.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
                <span>{title} {selectedOptions.length > 0 ? `(${selectedOptions.length})` : ''}</span>
                <span style={{ fontSize: 'var(--fs-xs)', transition: '0.3s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
            </div>
            
            {isOpen && (
                <div style={{ position: 'absolute', top: '110%', right: 0, width: '100%', background: 'var(--surface-card, #ffffff)', border: 'none', borderRadius: '16px', boxShadow: 'var(--shadow-ambient), 0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '15.625rem', overflowY: 'auto', padding: '0.625rem' }}>
                    {options.length === 0 ? <div style={{ padding: '0.625rem', textAlign: 'center', fontSize: 'var(--fs-sm)', color: '#94a3b8' }}>لا يوجد بيانات</div> : null}
                    {options.map((opt: string, idx: number) => (
                        <label 
                            key={idx} 
                            onClick={(e) => { e.preventDefault(); toggleOption(opt); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.625rem', cursor: 'pointer', borderRadius: '8px', transition: '0.2s' }} 
                            className="hover-bg-slate"
                        >
                            <input 
                                type="checkbox" 
                                checked={selectedOptions.includes(opt)}
                                readOnly
                                style={{ accentColor: THEME.primary, width: '1rem', height: '1rem' }}
                            />
                            <span style={{ fontSize: 'var(--fs-sm)', color: '#0f172a', fontWeight: 600 }}>{opt}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function SubContractorClaimsPage() {
    const logic = useSubClaimsLogic();
    const [mounted, setMounted] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState(""); 
    const [assignmentSearch, setAssignmentSearch] = useState("");

    const [selectedVillas, setSelectedVillas] = useState<string[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]); // 🚀 فلتر الحالة

    useEffect(() => { setMounted(true); }, []);

    // 🎯 فلترة قائمة المقاولين
    const filteredContractors = useMemo(() => {
        const list = logic.contractors || [];
        const cleanSearch = searchTerm.trim().toLowerCase();
        if (!cleanSearch) return list;
        return list.filter((c: any) => {
            const nameStr = (c.name || '').toLowerCase();
            const codeStr = (c.code || '').toLowerCase();
            const roleStr = (c.job_role || '').toLowerCase();
            const phoneStr = (c.phone || '').toLowerCase();
            return nameStr.includes(cleanSearch) || codeStr.includes(cleanSearch) || roleStr.includes(cleanSearch) || phoneStr.includes(cleanSearch);
        });
    }, [logic.contractors, searchTerm]);

    // 🚀 استخراج الفلل والبنود والحالات المتاحة للفلترة
    const availableVillas = useMemo(() => {
        if (!logic.assignments) return [];
        return Array.from(new Set(logic.assignments.map((a: any) => a.projects?.Property).filter(Boolean)));
    }, [logic.assignments]);

    const availableItems = useMemo(() => {
        if (!logic.assignments) return [];
        return Array.from(new Set(logic.assignments.map((a: any) => a.boq_item_name).filter(Boolean)));
    }, [logic.assignments]);

    const availableStatuses = useMemo(() => {
        if (!logic.assignments) return [];
        return Array.from(new Set(logic.assignments.map((a: any) => a.assignment_status).filter(Boolean)));
    }, [logic.assignments]);

    // 🎯 فلترة الأعمال الجارية بذكاء
    const filteredAssignments = useMemo(() => {
        let list = logic.assignments || [];

        list = list.map((a: any) => ({
            ...a,
            id: a.assignment_id || a.id
        }));
        
        if (selectedVillas.length > 0) {
            list = list.filter((a: any) => selectedVillas.includes(a.projects?.Property));
        }

        if (selectedItems.length > 0) {
            list = list.filter((a: any) => selectedItems.includes(a.boq_item_name));
        }

        if (selectedStatuses.length > 0) {
            list = list.filter((a: any) => selectedStatuses.includes(a.assignment_status));
        }

        const cleanSearch = assignmentSearch.trim().toLowerCase();
        if (cleanSearch) {
            list = list.filter((a: any) => {
                const projName = (a.projects?.Property || '').toLowerCase();
                const itemName = (a.boq_item_name || '').toLowerCase();
                const orderNum = (a.order_number || '').toLowerCase();
                return projName.includes(cleanSearch) || itemName.includes(cleanSearch) || orderNum.includes(cleanSearch);
            });
        }

        return list;
    }, [logic.assignments, assignmentSearch, selectedVillas, selectedItems, selectedStatuses]);

    useEffect(() => {
        setSelectedVillas([]);
        setSelectedItems([]);
        setSelectedStatuses([]);
        setAssignmentSearch("");
    }, [logic.selectedContractor]);

    if (!mounted) return null;

    // أزرار رأس الصفحة العامة (Header Content)
    const pageHeaderActions = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <button 
                type="button" 
                className="ent-button"
                onClick={logic.refetchAll}
                title="تحديث البيانات لحظياً"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
                <RotateCw size={15} />
                <span>تحديث</span>
            </button>

            <button 
                type="button" 
                className="ent-button"
                onClick={() => {
                    if (!logic.selectedContractor) {
                        logic.exportContractorsExcel();
                    } else if (logic.activeTab === 'assignments') {
                        logic.exportAssignmentsExcel();
                    } else {
                        logic.exportClaimsExcel();
                    }
                }}
                title="تصدير البيانات إلى ملف Excel"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
                <Download size={15} />
                <span>تصدير Excel</span>
            </button>

            <SecureAction module="subclaims" action="create">
                <button 
                    type="button" 
                    className="ent-button ent-primary"
                    onClick={() => logic.setIsAddContractorModalOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}
                >
                    <Plus size={16} />
                    <span>إضافة مقاول جديد</span>
                </button>
            </SecureAction>
        </div>
    );

    const sidebarActions = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
            {logic.selectedContractor ? (
                <>
                    <SecureAction module="job_orders" action="create">
                        <button 
                            onClick={() => {
                                logic.setAssignRecord({ assigned_qty: 1, unit_price: 0 });
                                logic.setIsAssignModalOpen(true);
                            }} 
                            className="btn-main-glass blue"
                        >
                            إسناد أمر تشغيل للمقاول
                        </button>
                    </SecureAction>

                    <SecureAction module="subclaims" action="create">
                        <button 
                            disabled={logic.selectedAssignments.length === 0 || logic.isClaimSaving} 
                            onClick={logic.handleOpenClaimModal}
                            className="btn-main-glass green"
                        >
                            {logic.isClaimSaving ? 'جاري المعالجة...' : `إصدار مستخلص (${logic.selectedAssignments.length})`}
                        </button>
                    </SecureAction>

                    <button 
                        onClick={logic.handleOpenDirectPayment}
                        className="btn-main-glass white"
                        style={{ background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0' }}
                    >
                        صرف دفعة للمقاول
                    </button>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '0.625rem 0' }} />

                    <button 
                        onClick={() => {
                            logic.setSelectedContractor(null);
                            logic.setSelectedAssignments([]);
                        }} 
                        className="btn-main-glass white"
                    >
                        رجوع لقائمة المقاولين
                    </button>
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <SecureAction module="subclaims" action="create">
                        <button 
                            onClick={() => logic.setIsAddContractorModalOpen(true)}
                            className="btn-main-glass blue"
                        >
                            + إضافة مقاول جديد
                        </button>
                    </SecureAction>
                    <button 
                        onClick={logic.exportContractorsExcel}
                        className="btn-main-glass white"
                    >
                        تصدير كشف المقاولين Excel
                    </button>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#f6f8fb', border: '1px dashed #d6dce5', borderRadius: '12px', color: '#4b5563', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
                        اختر مقاولاً من القائمة لعرض ملف الأعمال وإصدار المستخلصات
                    </div>
                </div>
            )}
        </div>
    );

    // 🚀 عواميد السجل
    const historyColumns = [
        { header: 'تاريخ المستخلص', render: (row: any) => row.date },
        { header: 'رقم المستخلص', render: (row: any) => <strong style={{color: THEME.primary}}>{row.claim_number}</strong> },
        { 
            header: 'العقارات / المشاريع', 
            render: (row: any) => {
                const displayNames = row.project_names_text || row.projects?.Property || 'مجمع (عدة عقارات)';
                return (
                    <div style={{ 
                        maxWidth: '12.5rem', whiteSpace: 'normal', lineHeight: '1.6', fontSize: 'var(--fs-xs)', 
                        fontWeight: 900, color: 'var(--accent-ink)', padding: '0.375rem 0.625rem', 
                        borderRadius: '8px', textAlign: 'center', border: 'none', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sunken)'
                    }}>
                        {displayNames}
                    </div>
                );
            } 
        },
        { header: 'الصافي للصرف', render: (row: any) => <strong style={{color: THEME.success, fontSize: 'var(--fs-lg)'}}>{formatCurrency(row.net_amount)}</strong> },
        {
            header: 'ميعاد الاستحقاق',
            render: (row: any) => {
                const net = Number(row.net_amount || 0);
                const paid = Number(row.paid_amount || 0);
                if (paid >= net && net > 0) {
                    return <span style={{ color: '#10b981', fontWeight: 900, fontSize: 'var(--fs-sm)' }}>تمت التسوية</span>;
                }

                const period = row.payment_period_days || 0;
                if (!period) return <span style={{ color: '#94a3b8', fontSize: 'var(--fs-xs)' }}>غير محدد</span>;

                const claimDate = new Date(row.date);
                const dueDate = new Date(claimDate);
                dueDate.setDate(dueDate.getDate() + period);
                
                const today = new Date();
                today.setHours(0, 0, 0, 0); 
                dueDate.setHours(0, 0, 0, 0);

                const diffTime = dueDate.getTime() - today.getTime();
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let color = '#10b981'; 
                let bg = '#ecfdf5';
                let text = `متبقي ${daysLeft} يوم`;
                let icon = '';

                if (daysLeft < 0) {
                    color = '#ef4444'; 
                    bg = '#fef2f2';
                    text = `متأخر ${Math.abs(daysLeft)} يوم!`;
                    icon = '';
                } else if (daysLeft === 0) {
                    color = '#f97316'; 
                    bg = '#fff7ed';
                    text = `يُستحق اليوم!`;
                    icon = '';
                } else if (daysLeft <= 3) {
                    color = '#f59e0b'; 
                    bg = '#fffbeb';
                    icon = '';
                } else if (daysLeft <= 7) {
                    color = '#84cc16'; 
                    bg = '#f7fee7';
                    icon = '';
                }

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800 }}>
                            {dueDate.toISOString().split('T')[0]}
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.25rem 0.625rem', borderRadius: '8px', fontSize: 'var(--fs-xs)',
                            fontWeight: 900, color: color, background: bg, border: `1px solid ${color}40`,
                            whiteSpace: 'nowrap'
                        }}>
                            <PhiIcon value={icon} size={14} /> {text}
                        </div>
                    </div>
                );
            }
        },
        { 
            header: 'حالة السداد', 
            render: (row: any) => {
                const net = Number(row.net_amount || 0);
                const paid = Number(row.paid_amount || 0);
                const remaining = net - paid;

                let status = { label: 'غير مسدد', color: '#ef4444', bg: '#fef2f2' };
                if (paid >= net && net > 0) {
                    status = { label: 'مسدد بالكامل', color: '#16a34a', bg: '#dcfce7' };
                } else if (paid > 0 && paid < net) {
                    status = { label: 'مسدد جزئي', color: '#f59e0b', bg: '#fef3c7' };
                }

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3125rem', alignItems: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.3125rem 0.75rem', borderRadius: '10px', fontSize: 'var(--fs-xs)', fontWeight: 900, color: status.color, background: status.bg, border: `1px solid ${status.color}30` }}>
                            <span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', background: status.color }}></span>
                            {status.label}
                        </div>
                        {paid > 0 && paid < net && (
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 800, background: 'var(--surface-sunken)', padding: '0.25rem 0.5rem', borderRadius: '6px', border: 'none', boxShadow: 'var(--shadow-sunken)', whiteSpace: 'nowrap' }}>
                                سُدد: <span style={{ color: '#16a34a' }}>{formatCurrency(paid)}</span> | متبقي: <span style={{ color: '#ef4444' }}>{formatCurrency(remaining)}</span>
                            </div>
                        )}
                    </div>
                );
            } 
        },
        { 
            header: 'الحالة المحاسبية', 
            render: (row: any) => (
                <span style={{ background: row.is_posted ? '#dcfce7' : '#fef3c7', color: row.is_posted ? '#166534' : '#b45309', padding: '0.3125rem 0.75rem', borderRadius: '10px', fontSize: 'var(--fs-xs)', fontWeight: 900 }}>
                    {row.is_posted ? 'معتمد' : 'مسودة'}
                </span>
            ) 
        },
        {
            header: 'الإجراءات (لحظية)',
            render: (row: any) => {
                const net = Number(row.net_amount || 0);
                const paid = Number(row.paid_amount || 0);
                const isFullyPaid = paid >= net && net > 0;
                const isActionPending = logic.actionMutation.isPending && logic.actionMutation.variables?.id === row.id;

                return (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {row.is_posted && !isFullyPaid && (
                            <button 
                                disabled={logic.isSavingPayment}
                                onClick={() => logic.handleOpenPayment(row)} 
                                style={{ background: '#16a34a', color: 'white', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-xs)', transition: '0.2s', boxShadow: '0 4px 10px rgba(22,163,74,0.3)' }}
                            >
                                {paid > 0 ? 'صرف المتبقي' : 'صرف'}
                            </button>
                        )}
                        <button onClick={() => logic.handlePreparePrint(row)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-xs)', transition: '0.2s' }}>طباعة</button>

                        {!row.is_posted ? (
                            <button 
                                disabled={logic.actionMutation.isPending}
                                onClick={() => logic.actionMutation.mutate({ action: 'post', id: row.id })} 
                                style={{ background: THEME.success, color: 'white', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-xs)', transition: '0.2s', opacity: logic.actionMutation.isPending ? 0.6 : 1 }}
                            >
                                {isActionPending && logic.actionMutation.variables?.action === 'post' ? 'جاري...' : 'ترحيل'}
                            </button>
                        ) : (
                            <button 
                                disabled={logic.actionMutation.isPending}
                                onClick={() => { if(confirm('تأكيد فك ترحيل المستخلص؟ سيتم الاحتفاظ بسندات الصرف والأعمال المرتبطة. يلزم فك ترحيل سنداته أولاً.')) logic.actionMutation.mutate({ action: 'unpost', id: row.id }) }}
                                style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-xs)', transition: '0.2s', opacity: logic.actionMutation.isPending ? 0.6 : 1 }}
                            >
                                {isActionPending && logic.actionMutation.variables?.action === 'unpost' ? 'جاري...' : 'فك الترحيل'}
                            </button>
                        )}

                        <button 
                            disabled={logic.actionMutation.isPending}
                            onClick={() => { if(confirm('تأكيد حذف مستخلص المسودة وإرجاع الأعمال لجاري التنفيذ؟ يجب فك ترحيله ومعالجة سندات الصرف المرتبطة أولاً.')) logic.actionMutation.mutate({ action: 'delete', id: row.id }) }}
                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-xs)', transition: '0.2s', opacity: logic.actionMutation.isPending ? 0.6 : 1 }}
                        >
                            {isActionPending && logic.actionMutation.variables?.action === 'delete' ? 'جاري...' : 'مسح'}
                        </button>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="clean-page">
            <MasterPage 
                enterprise 
                icon={<HardHat />}
                title="المقاولين" 
                subtitle="إدارة عقود مقاولي الباطن، إسناد أوامر التشغيل، ومتابعة المستخلصات وسندات الصرف"
                headerContent={pageHeaderActions}
            >
                
                <RawasiSidebarManager 
                    actions={sidebarActions}
                    watchDeps={[logic.selectedContractor, logic.selectedAssignments.length]}
                />

                <style>{`
                    .btn-main-glass { width: 100%; padding: 0.875rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
                    .btn-main-glass.blue { background: linear-gradient(135deg, rgba(14, 165, 233, 0.8), rgba(2, 132, 199, 0.9)); color: white; }
                    .btn-main-glass.green { background: linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.9)); color: white; }
                    .btn-main-glass.white { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255,255,255,0.8); }
                    .btn-main-glass:disabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(1); }
                    .btn-main-glass:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
                    
                    .search-box-container { margin-bottom: 1.5625rem; background: white; padding: 0.625rem 0.9375rem; border-radius: 14px; border: 1px solid #eee; box-shadow: 0 4px 12px rgba(0,0,0,0.03); display: flex; align-items: center; position: relative; }
                    .search-input-fancy { width: 100%; padding: 0.625rem 2.1875rem 0.625rem 0.625rem; border-radius: 15px; border: 2px solid transparent; outline: none; transition: 0.3s; font-weight: 700; font-size: var(--fs-md); background: #f8fafc; }
                    .search-input-fancy:focus { border-color: ${THEME.primary}80; background: #fff; }
                    .search-icon { position: absolute; right: 1.5625rem; color: #94a3b8; pointer-events: none; }
                    .search-clear-btn { position: absolute; left: 1.5625rem; background: #e2e8f0; border: none; width: 1.5rem; height: 1.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #64748b; cursor: pointer; transition: 0.2s; font-size: var(--fs-xs); }
                    .search-clear-btn:hover { background: #ef4444; color: white; }
                    
                    .tab-btn { padding: 0.75rem 1.5625rem; border-radius: 15px; border: none; font-weight: 900; cursor: pointer; transition: 0.3s; font-size: var(--fs-md); }
                    .tab-btn.active { background: ${THEME.primary}; color: white; box-shadow: 0 10px 20px ${THEME.primary}40; }
                    .tab-btn.inactive { background: var(--surface-card); color: var(--text-secondary); border: none; box-shadow: var(--shadow-elevation); }
                    .tab-btn.inactive:hover { background: #f8fafc; }
                    
                    .hover-bg-slate:hover { background: #f1f5f9; }

                    .contractor-card {
                        background: rgba(255,255,255,0.9);
                        backdrop-filter: blur(15px);
                        border-radius: 16px;
                        padding: 1.5rem;
                        cursor: pointer;
                        border: 1.5px solid #e2e8f0;
                        transition: all 0.25s ease;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.04);
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }
                    .contractor-card:hover {
                        transform: translateY(-4px);
                        border-color: ${THEME.primary};
                        box-shadow: 0 14px 28px rgba(0,0,0,0.08);
                    }
                `}</style>

                {/* KPI Summary Cards */}
                {!logic.selectedContractor ? (
                    <div className="ent-summary-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="ent-summary-card">
                            <div className="ent-summary-top">
                                <span>إجمالي المقاولين المسجلين</span>
                                <div className="ent-summary-icon"><HardHat size={19}/></div>
                            </div>
                            <strong>{logic.stats.totalContractors.toLocaleString('en-US')}</strong>
                            <small>مقاول باطن معتمد في النظام</small>
                        </div>

                        <div className="ent-summary-card">
                            <div className="ent-summary-top">
                                <span>إسناد أوامر التشغيل</span>
                                <div className="ent-summary-icon blue"><ClipboardList size={19}/></div>
                            </div>
                            <strong>ربط العقود والأعمال</strong>
                            <small>إسناد فوري لمهام الفلل والبنود</small>
                        </div>

                        <div className="ent-summary-card">
                            <div className="ent-summary-top">
                                <span>المستخلصات والحصر</span>
                                <div className="ent-summary-icon green"><FileText size={19}/></div>
                            </div>
                            <strong>خصومات وتصفية آلية</strong>
                            <small>خصم الخامات والنثريات من الصافي</small>
                        </div>

                        <div className="ent-summary-card">
                            <div className="ent-summary-top">
                                <span>سداد المستحقات</span>
                                <div className="ent-summary-icon yellow"><Banknote size={19}/></div>
                            </div>
                            <strong>سندات صرف دورية</strong>
                            <small>توجيه آلي لحساب 212 والخزينة</small>
                        </div>
                    </div>
                ) : (
                    <div className="ent-summary-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="ent-summary-card">
                            <div className="ent-summary-top">
                                <span>المقاول المحدد</span>
                                <div className="ent-summary-icon"><HardHat size={19}/></div>
                            </div>
                            <strong style={{ fontSize: '1.2rem', color: THEME.primary }}>{logic.selectedContractor.name}</strong>
                            <small>{logic.selectedContractor.code ? `كود: ${logic.selectedContractor.code} • ` : ''}{logic.selectedContractor.job_role || 'مقاول باطن'}</small>
                        </div>

                        <div className="ent-summary-card">
                            <div className="ent-summary-top">
                                <span>أعمال جاري تنفيذها</span>
                                <div className="ent-summary-icon blue"><ClipboardList size={19}/></div>
                            </div>
                            <strong>{logic.stats.activeAssignmentsCount} بند عمل</strong>
                            <small>إجمالي القيمة: {formatCurrency(logic.stats.totalGrossValue)}</small>
                        </div>

                        <div className="ent-summary-card">
                            <div className="ent-summary-top">
                                <span>سجل المستخلصات</span>
                                <div className="ent-summary-icon green"><FileText size={19}/></div>
                            </div>
                            <strong>{logic.stats.totalClaimsCount} مستخلص</strong>
                            <small>صافي المستخلصات: {formatCurrency(logic.stats.totalClaimsNet)}</small>
                        </div>

                        <div className="ent-summary-card">
                            <div className="ent-summary-top">
                                <span>المتبقي غير مسدد</span>
                                <div className="ent-summary-icon red"><Banknote size={19}/></div>
                            </div>
                            <strong style={{ color: logic.stats.totalClaimsRemaining > 0 ? '#ef4444' : '#16a34a' }}>
                                {formatCurrency(logic.stats.totalClaimsRemaining)}
                            </strong>
                            <small>مسدد للمقاول: {formatCurrency(logic.stats.totalClaimsPaid)}</small>
                        </div>
                    </div>
                )}

                {!logic.selectedContractor ? (
                    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                        {/* Quick Toolbar above Search */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>قائمة المقاولين المعتمدين</span>
                                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>
                                    {filteredContractors.length} مقاول
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="ent-button"
                                    onClick={logic.exportContractorsExcel}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                >
                                    <Download size={15} />
                                    <span>تصدير القائمة Excel</span>
                                </button>
                                <SecureAction module="subclaims" action="create">
                                    <button
                                        type="button"
                                        className="ent-button ent-primary"
                                        onClick={() => logic.setIsAddContractorModalOpen(true)}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                    >
                                        <Plus size={16} />
                                        <span>إضافة مقاول جديد</span>
                                    </button>
                                </SecureAction>
                            </div>
                        </div>

                        <div className="search-box-container">
                            <span className="search-icon"><Search size={16} aria-hidden="true" /></span>
                            <input 
                                type="text" 
                                className="search-input-fancy" 
                                placeholder="ابحث بالاسم، الكود، التخصص، أو رقم الهاتف..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button className="search-clear-btn" onClick={() => setSearchTerm("")}>✖</button>
                            )}
                        </div>

                        {filteredContractors.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(18.5rem, 1fr))', gap: '1.25rem', padding: '0.25rem' }}>
                                {filteredContractors.map((contractor: any) => (
                                    <div 
                                        key={contractor.id} 
                                        onClick={() => logic.setSelectedContractor(contractor)} 
                                        className="contractor-card"
                                    >
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div style={{ 
                                                    width: '46px', 
                                                    height: '46px', 
                                                    borderRadius: '12px', 
                                                    background: '#fef3c7', 
                                                    color: '#b45309', 
                                                    display: 'grid', 
                                                    placeItems: 'center' 
                                                }}>
                                                    <HardHat size={26} aria-hidden="true" />
                                                </div>
                                                {contractor.code && (
                                                    <span style={{ 
                                                        background: 'var(--surface-sunken, #f1f5f9)', 
                                                        color: 'var(--text-secondary, #64748b)', 
                                                        padding: '0.25rem 0.625rem', 
                                                        borderRadius: '8px', 
                                                        fontSize: '0.78rem', 
                                                        fontWeight: 800 
                                                    }}>
                                                        {contractor.code}
                                                    </span>
                                                )}
                                            </div>

                                            <h3 style={{ margin: '0 0 0.5rem 0', color: THEME.primary, fontWeight: 900, fontSize: '1.15rem' }}>
                                                {contractor.name}
                                            </h3>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem', fontSize: '0.84rem', color: '#64748b' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Briefcase size={14} style={{ color: '#94a3b8' }} />
                                                    <span style={{ fontWeight: 700 }}>{contractor.job_role || 'مقاول باطن'}</span>
                                                </div>
                                                {contractor.phone && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <Phone size={14} style={{ color: '#94a3b8' }} />
                                                        <span dir="ltr" style={{ fontWeight: 600 }}>{contractor.phone}</span>
                                                    </div>
                                                )}
                                                {contractor.address && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <MapPin size={14} style={{ color: '#94a3b8' }} />
                                                        <span>{contractor.address}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    logic.setSelectedContractor(contractor);
                                                }}
                                                style={{ 
                                                    flex: 1, 
                                                    background: THEME.accent, 
                                                    color: 'white', 
                                                    padding: '0.625rem', 
                                                    borderRadius: '10px', 
                                                    border: 'none',
                                                    textAlign: 'center', 
                                                    fontSize: 'var(--fs-sm)', 
                                                    fontWeight: 900,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                فتح ملف الأعمال
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    logic.setSelectedContractor(contractor);
                                                    logic.setAssignRecord({ assigned_qty: 1, unit_price: 0 });
                                                    logic.setIsAssignModalOpen(true);
                                                }}
                                                title="إسناد أمر تشغيل سريع"
                                                style={{ 
                                                    background: '#e0f2fe', 
                                                    color: '#0284c7', 
                                                    padding: '0.625rem', 
                                                    borderRadius: '10px', 
                                                    border: 'none',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3.75rem 1.25rem', background: 'white', borderRadius: '14px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                                <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.9375rem' }}><ScanSearch size={38} aria-hidden="true" /></div>
                                <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontWeight: 900 }}>لم نتمكن من العثور على مقاول</h3>
                                <p style={{ margin: '0 0 1rem 0', fontSize: 'var(--fs-md)', fontWeight: 700 }}>تأكد من كتابة الاسم بشكل صحيح أو أضف مقاولاً جديداً الآن.</p>
                                <button
                                    type="button"
                                    className="ent-button ent-primary"
                                    onClick={() => logic.setIsAddContractorModalOpen(true)}
                                >
                                    <Plus size={16} />
                                    <span>إضافة المقاول «{searchTerm}»</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ animation: 'slideUp 0.5s ease-out' }}>
                        {/* Contractor Detailed Header & Primary Action Toolbar */}
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            flexWrap: 'wrap',
                            gap: '1rem',
                            marginBottom: '1.5rem', 
                            background: 'white', 
                            padding: '1.25rem 1.5rem', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '16px', 
                            boxShadow: '0 4px 14px rgba(0,0,0,0.03)' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <button
                                    type="button"
                                    className="ent-button"
                                    onClick={() => {
                                        logic.setSelectedContractor(null);
                                        logic.setSelectedAssignments([]);
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}
                                    title="العودة لقائمة كل المقاولين"
                                >
                                    <ArrowRight size={16} />
                                    <span>كل المقاولين</span>
                                </button>
                                <div>
                                    <h2 style={{ margin: 0, fontWeight: 900, color: THEME.primary, fontSize: '1.35rem' }}>
                                        {logic.selectedContractor.name}
                                    </h2>
                                    <span style={{ fontSize: '0.85rem', color: THEME.accent, fontWeight: 800 }}>
                                        {logic.selectedContractor.code ? `كود: ${logic.selectedContractor.code} • ` : ''}
                                        {logic.selectedContractor.job_role || 'مقاول باطن'}
                                        {logic.selectedContractor.phone ? ` • هاتف: ${logic.selectedContractor.phone}` : ''}
                                    </span>
                                </div>
                            </div>

                            {/* Prominent Action Buttons Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                                <SecureAction module="job_orders" action="create">
                                    <button 
                                        type="button"
                                        className="ent-button ent-primary"
                                        onClick={() => {
                                            logic.setAssignRecord({ assigned_qty: 1, unit_price: 0 });
                                            logic.setIsAssignModalOpen(true);
                                        }}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}
                                    >
                                        <Plus size={16} />
                                        <span>إسناد أمر تشغيل</span>
                                    </button>
                                </SecureAction>

                                <SecureAction module="subclaims" action="create">
                                    <button 
                                        type="button"
                                        className="ent-button ent-success"
                                        disabled={logic.selectedAssignments.length === 0 || logic.isClaimSaving} 
                                        onClick={logic.handleOpenClaimModal}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}
                                    >
                                        <FileText size={16} />
                                        <span>{logic.isClaimSaving ? 'جاري المعالجة...' : `إصدار مستخلص (${logic.selectedAssignments.length})`}</span>
                                    </button>
                                </SecureAction>

                                <button 
                                    type="button"
                                    className="ent-button"
                                    onClick={logic.handleOpenDirectPayment}
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.4rem', 
                                        fontWeight: 800,
                                        background: '#16a34a',
                                        color: '#ffffff',
                                        border: 'none',
                                        boxShadow: '0 4px 10px rgba(22,163,74,0.25)'
                                    }}
                                    title="صرف دفعة أو سداد مستحقات للمقاول"
                                >
                                    <Banknote size={16} />
                                    <span>صرف دفعة</span>
                                </button>

                                <button 
                                    type="button"
                                    className="ent-button"
                                    onClick={() => logic.activeTab === 'assignments' ? logic.exportAssignmentsExcel() : logic.exportClaimsExcel()}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                    title="تصدير بيانات الجدول الحالي إلى Excel"
                                >
                                    <Download size={15} />
                                    <span>تصدير Excel</span>
                                </button>
                            </div>
                        </div>

                        {/* Tabs Bar */}
                        <div style={{ display: 'flex', gap: '0.9375rem', marginBottom: '1.5625rem' }}>
                            <button 
                                className={`tab-btn ${logic.activeTab === 'assignments' ? 'active' : 'inactive'}`} 
                                onClick={() => logic.setActiveTab('assignments')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <ClipboardList size={17} />
                                <span>الأعمال الجارية والإسنادات ({logic.assignments?.length || 0})</span>
                            </button>
                            <button 
                                className={`tab-btn ${logic.activeTab === 'history' ? 'active' : 'inactive'}`} 
                                onClick={() => logic.setActiveTab('history')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <FileText size={17} />
                                <span>سجل المستخلصات والأرشيف ({logic.claimsHistory?.length || 0})</span>
                            </button>
                        </div>

                        {logic.activeTab === 'assignments' && (
                            <div style={{ animation: 'fadeIn 0.3s' }}>
                                <div style={{ background: 'white', padding: '0.9375rem', borderRadius: '14px', marginBottom: '1.25rem', border: '1px solid #eee', display: 'flex', flexWrap: 'wrap', gap: '0.9375rem', alignItems: 'center' }}>
                                    <FilterDropdown 
                                        title="تحديد الفلل" 
                                        options={availableVillas as string[]} 
                                        selectedOptions={selectedVillas} 
                                        setSelectedOptions={setSelectedVillas} 
                                    />
                                    
                                    <FilterDropdown 
                                        title="تحديد البنود" 
                                        options={availableItems as string[]} 
                                        selectedOptions={selectedItems} 
                                        setSelectedOptions={setSelectedItems} 
                                    />

                                    {/* 🚀 فلتر الحالة */}
                                    <FilterDropdown 
                                        title="حالة الإسناد" 
                                        options={availableStatuses as string[]} 
                                        selectedOptions={selectedStatuses} 
                                        setSelectedOptions={setSelectedStatuses} 
                                    />

                                    <div style={{ flex: 1, position: 'relative' }}>
                                        <span className="search-icon" style={{ right: '0.9375rem', top: '0.75rem' }}><Search size={16} aria-hidden="true" /></span>
                                        <input 
                                            type="text" 
                                            className="search-input-fancy" 
                                            style={{ background: '#f1f5f9', border: 'none', padding: '0.75rem 2.5rem 0.75rem 0.625rem' }}
                                            placeholder="بحث سريع (فيلا، بند، رقم أمر)..." 
                                            value={assignmentSearch}
                                            onChange={(e) => setAssignmentSearch(e.target.value)}
                                        />
                                        {assignmentSearch && (
                                            <button className="search-clear-btn" style={{ top: '0.625rem' }} onClick={() => setAssignmentSearch("")}>✖</button>
                                        )}
                                    </div>
                                    
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            // 🚀 تحديد "الجاري تنفيذه فقط" لتسهيل عمل المستخلصات بدون تعارض مع المفوتر
                                            const validIds = filteredAssignments.filter((a: any) => a.assignment_status !== 'مفوتر').map((a:any) => a.id);
                                            const areAllSelected = validIds.length > 0 && validIds.every(id => logic.selectedAssignments.includes(id));

                                            if (areAllSelected || logic.selectedAssignments.length > 0) {
                                                logic.setSelectedAssignments([]);
                                            } else {
                                                logic.setSelectedAssignments(validIds);
                                            }
                                        }}
                                        style={{ background: THEME.primary, color: 'white', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', transition: '0.2s', fontSize: 'var(--fs-sm)' }}
                                    >
                                        تحديد الأعمال الجارية فقط ✓
                                    </button>
                                </div>

                                <div style={{ background: 'white', borderRadius: '14px', padding: '0.625rem', border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                                    <RawasiSmartTable 
                                        data={filteredAssignments} 
                                        isLoading={logic.isAssignLoading}
                                        columns={[
                                            { header: 'أمر التشغيل', render: (row: any) => <strong style={{color: THEME.accent}}>{row.order_number}</strong> },
                                            { header: 'المشروع / البند', render: (row: any) => <div style={{lineHeight:'1.4'}}><span style={{fontWeight: 800}}>{row.projects?.Property}</span><br/><span style={{fontSize:'var(--fs-xs)', color:'#64748b'}}>{row.boq_item_name}</span></div> },
                                            { header: 'الكمية', render: (row: any) => <span style={{ fontWeight: 900 }}>{row.executed_qty}</span> },
                                            { header: 'سعر الوحدة', render: (row: any) => <span style={{ fontWeight: 900, color: '#475569' }}>{formatCurrency(row.unit_price)}</span> },
                                            { header: 'قيمة الأعمال', render: (row: any) => <span style={{ color: THEME.success, fontWeight: 900 }}>{formatCurrency(row.gross_total_amount)}</span> },
                                            { header: 'خصومات الخامات', render: (row: any) => <span style={{ color: THEME.danger, fontWeight: 800 }}>{formatCurrency(row.materials_deduction)}</span> },
                                            { header: 'خصومات النثريات', render: (row: any) => <span style={{ color: THEME.danger, fontWeight: 800 }}>{formatCurrency(row.expenses_deduction)}</span> },
                                            { header: 'الصافي التقريبي', render: (row: any) => <strong style={{ color: THEME.primary }}>{formatCurrency(row.net_before_financial_deductions)}</strong> },
                                            
                                            { 
                                                header: 'الحالة', 
                                                render: (row: any) => (
                                                    <span style={{ 
                                                        background: row.assignment_status === 'مفوتر' ? '#dcfce7' : '#fef3c7', 
                                                        color: row.assignment_status === 'مفوتر' ? '#166534' : '#b45309', 
                                                        padding: '0.25rem 0.625rem', borderRadius: '8px', fontSize: 'var(--fs-xs)', fontWeight: 900,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {row.assignment_status === 'مفوتر' ? 'مفوتر' : 'جاري التنفيذ'}
                                                    </span>
                                                ) 
                                            },

                                            {
                                                header: 'إجراءات',
                                                render: (row: any) => (
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        {row.assignment_status === 'مفوتر' ? (
                                                            <span style={{fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800}}>مغلق (مفوتر)</span>
                                                        ) : (
                                                            <>
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); logic.handleEditAssignment(row); }} 
                                                                    style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.375rem 0.625rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                                                                >
                                                                    تعديل
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => { 
                                                                        e.stopPropagation(); 
                                                                        if(confirm('متأكد من مسح هذا البند وإرجاع أمر التشغيل لتنفيذ ذاتي؟')) logic.deleteAssignment(row.assignment_id); 
                                                                    }} 
                                                                    style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.375rem 0.625rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                                                                >
                                                                    مسح
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )
                                            }
                                        ]}
                                        selectable={true}
                                        selectedIds={logic.selectedAssignments}
                                        onSelectionChange={logic.setSelectedAssignments}
                                    />
                                </div>
                            </div>
                        )}

                        {logic.activeTab === 'history' && (
                            <div style={{ background: 'white', borderRadius: '14px', padding: '0.625rem', border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', animation: 'fadeIn 0.3s' }}>
                                <RawasiSmartTable 
                                    data={logic.claimsHistory} 
                                    isLoading={logic.isHistoryLoading} 
                                    columns={historyColumns} 
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Modals */}
                {logic.isAddContractorModalOpen && (
                    <AddContractorModal 
                        isOpen={logic.isAddContractorModalOpen}
                        onClose={() => logic.setIsAddContractorModalOpen(false)}
                        onSave={logic.handleSaveNewContractor}
                        isSaving={logic.isAddingContractor}
                    />
                )}

                {logic.isAssignModalOpen && (
                    <AssignWorkModal 
                        isOpen={logic.isAssignModalOpen}
                        onClose={() => logic.setIsAssignModalOpen(false)}
                        record={logic.assignRecord}
                        setRecord={logic.setAssignRecord}
                        onSave={logic.handleAssignWork}
                        isSaving={logic.isAssigning} 
                        contractorName={logic.selectedContractor?.name}
                        logic={logic}
                    />
                )}

                {logic.isClaimModalOpen && (
                    <ClaimFormModal 
                        isOpen={logic.isClaimModalOpen}
                        onClose={() => logic.setIsClaimModalOpen(false)}
                        logic={logic} 
                    />
                )}

                {logic.isPrintModalOpen && (
                    <PrintClaimModal 
                        isOpen={logic.isPrintModalOpen}
                        onClose={() => { logic.setIsPrintModalOpen(false); logic.setSelectedPrintClaim(null); }}
                        claim={logic.selectedPrintClaim}
                        assignments={logic.printAssignments} 
                        deductions={logic.printDeductions}
                        contractorName={logic.selectedContractor?.name}
                    />
                )}

                {logic.isPaymentModalOpen && (
                    <PaymentVoucherModal 
                        isOpen={logic.isPaymentModalOpen}
                        onClose={() => logic.setIsPaymentModalOpen(false)}
                        record={logic.paymentRecord}
                        setRecord={logic.setPaymentRecord}
                        onSave={logic.handleSavePayment}
                        isSaving={logic.isSavingPayment}
                        partnerBalance={logic.partnerBalance}
                        isBalanceLoading={logic.isBalanceLoading}
                    />
                )}

            </MasterPage>
        </div>
    );
}
