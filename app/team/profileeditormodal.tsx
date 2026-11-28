"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import { THEME } from '@/lib/theme';
import { useToast } from '@/lib/toast-context'; 
import SmartCombo from '@/components/SmartCombo'; 
import { adminUsersRequest } from '@/lib/admin-api';
import { Lock, Building2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { notify } from '@/lib/notify';
import { AVAILABLE_LANDING_PAGES } from '@/lib/roleRouter';

export interface CompanyOption {
    id: string;
    code: string;
    name: string;
    currency?: string;
    is_default?: boolean;
}

export interface UserCompanyAssignment {
    company_id: string;
    role: 'admin' | 'member';
    is_default: boolean;
}

interface ProfileEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: any;
    companies?: CompanyOption[];
    initialCompanyAssignments?: UserCompanyAssignment[];
    onSave: () => void;
}

const SOVEREIGN_MODULES = new Set(['settings', 'team', 'companies', 'audit_logs']);

export default function ProfileEditorModal({
    isOpen,
    onClose,
    record,
    companies: companiesProp,
    initialCompanyAssignments,
    onSave,
}: ProfileEditorModalProps) {
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [availableCompanies, setAvailableCompanies] = useState<CompanyOption[]>(companiesProp || []);
    const [companyAssignments, setCompanyAssignments] = useState<UserCompanyAssignment[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    const defaultPermissions: Record<string, any> = {
        default_page: 'auto',
        home: { view: false },
        global_summary: { view: false },
        dashboard: { view: false },
        performance: { view: false },
        financial_center: { view: false },
        financial_statements: { view: false },
        vat_return: { view: false, edit: false },
        accounts: { view: false, create: false, edit: false, delete: false },
        manual_journals: { view: false, create: false, edit: false, delete: false, post: false },
        journal: { view: false, create: false, edit: false, delete: false, post: false },
        ledger: { view: false },
        trialbalance: { view: false },
        journal_errors: { view: false, edit: false },
        cashflows: { view: false },
        ar_aging: { view: false },
        custodies: { view: false, create: false, edit: false, delete: false, post: false },
        cash_closing: { view: false, create: false, edit: false, delete: false, post: false },
        fixed_assets: { view: false, create: false, edit: false, delete: false, post: false },
        audit: { view: false },
        financialplan: { view: false, create: false, edit: false, delete: false, post: false },
        payments: { view: false, create: false, edit: false, delete: false, post: false },
        receipts: { view: false, create: false, edit: false, delete: false, post: false },
        revenue: { view: false, create: false, edit: false, delete: false, post: false },
        expenses: { view: false, create: false, edit: false, delete: false, post: false },
        invoices: { view: false, create: false, edit: false, delete: false, post: false },
        fieldops: { view: false, create: false, edit: false, delete: false, post: false },
        bim_viewer: { view: false },
        job_orders: { view: false, create: false, edit: false, delete: false, post: false },
        projects: { view: false, create: false, edit: false, delete: false },
        requests_handovers: { view: false, create: false, edit: false, delete: false, post: false },
        purchase_orders: { view: false, create: false, edit: false, delete: false, post: false },
        inventory: { view: false, create: false, edit: false, delete: false, post: false },
        materials: { view: false, create: false, edit: false, delete: false, post: false },
        materialitems: { view: false, create: false, edit: false, delete: false },
        material_issues: { view: false, create: false, edit: false, delete: false, post: false },
        subclaims: { view: false, create: false, edit: false, delete: false, post: false },
        subcontractor_costs: { view: false },
        boqcatalog: { view: false, create: false, edit: false, delete: false },
        partners: { view: false, create: false, edit: false, delete: false },
        partner_balances: { view: false },
        statement: { view: false },
        project_overhead: { view: false, create: false, edit: false, delete: false },
        boqbudget: { view: false, create: false, edit: false, delete: false },
        bulk_budget: { view: false, edit: false },
        costallocation: { view: false, create: false, edit: false, delete: false },
        project_ledger: { view: false },
        project_profitability: { view: false },
        employees: { view: false, create: false, edit: false, delete: false },
        team: { view: false, create: false, edit: false, delete: false },
        labor_logs: { view: false, create: false, edit: false, delete: false, post: false },
        attendance: { view: false, create: false, edit: false, delete: false, post: false },
        laborcost: { view: false },
        payroll: { view: false, create: false, edit: false, delete: false, post: false },
        violations: { view: false, create: false, edit: false, delete: false, post: false },
        messages: { view: false, create: false },
        notifications: { view: false, edit: false },
        reports: { view: false, financial: false, operational: false },
        audit_logs: { view: false },
        import: { view: false, create: false },
        companies: { view: false, edit: false },
        settings: { view: false, edit: false },
        profile: { view: false, edit: false }
    };

    const [form, setForm] = useState({
        full_name: '',
        role: 'client',
        email: '',
        phone: '',
        password: '',
        is_active: true,
        linked_partner_id: null,
        permissions: defaultPermissions
    });

    useEffect(() => {
        setMounted(true); 
        if (record && isOpen) {
            const mergedPermissions = JSON.parse(JSON.stringify(defaultPermissions)); 
            
            if (record.permissions) {
                Object.keys(defaultPermissions).forEach((moduleKey) => {
                    if (moduleKey === 'default_page') {
                        if (typeof record.permissions.default_page === 'string') {
                            mergedPermissions.default_page = record.permissions.default_page;
                        }
                        return;
                    }
                    if (record.permissions[moduleKey] && typeof record.permissions[moduleKey] === 'object') {
                        mergedPermissions[moduleKey] = {
                            ...mergedPermissions[moduleKey],
                            ...record.permissions[moduleKey]
                        };
                    }
                });
            }

            setForm({
                full_name: record.full_name || '',
                role: record.role || 'client',
                email: record.email || '',
                phone: record.phone_number || '',
                password: '',
                is_active: record.is_active !== false,
                linked_partner_id: record.linked_partner_id || null, 
                permissions: mergedPermissions
            });
            setCompanyAssignments(
                Array.isArray(initialCompanyAssignments) ? [...initialCompanyAssignments] : []
            );
        } else if (!record && isOpen) {
            setForm({
                full_name: '',
                role: 'client',
                email: '',
                phone: '',
                password: '',
                is_active: true,
                linked_partner_id: null,
                permissions: JSON.parse(JSON.stringify(defaultPermissions))
            });
            setCompanyAssignments([]);
        }
    }, [record, isOpen, initialCompanyAssignments]);

    useEffect(() => {
        if (!isOpen) return;
        if (companiesProp && companiesProp.length > 0) {
            setAvailableCompanies(companiesProp);
            return;
        }
        let cancelled = false;
        const loadCompaniesAndMemberships = async () => {
            setLoadingCompanies(true);
            try {
                const res = await adminUsersRequest('GET');
                const data = await res.json();
                if (cancelled) return;
                if (res.ok && Array.isArray(data?.companies)) {
                    setAvailableCompanies(data.companies);
                    if (record?.id && (!initialCompanyAssignments || initialCompanyAssignments.length === 0) && Array.isArray(data.memberships)) {
                        const userRows = data.memberships
                            .filter((m: any) => m.user_id === record.id)
                            .map((m: any) => ({
                                company_id: m.company_id,
                                role: m.role === 'admin' ? 'admin' : 'member',
                                is_default: Boolean(m.is_default),
                            }));
                        setCompanyAssignments(userRows);
                    }
                }
            } catch {
                // ignore fallback error
            } finally {
                if (!cancelled) setLoadingCompanies(false);
            }
        };
        void loadCompaniesAndMemberships();
        return () => {
            cancelled = true;
        };
    }, [isOpen, companiesProp, record?.id, initialCompanyAssignments]);

    if (!isOpen || !mounted) return null;

    const toggleCompanyAssignment = (companyId: string) => {
        setCompanyAssignments((prev) => {
            const exists = prev.some((c) => c.company_id === companyId);
            if (exists) {
                const filtered = prev.filter((c) => c.company_id !== companyId);
                if (filtered.length > 0 && !filtered.some((c) => c.is_default)) {
                    filtered[0] = { ...filtered[0], is_default: true };
                }
                return filtered;
            }
            return [
                ...prev,
                {
                    company_id: companyId,
                    role: 'member',
                    is_default: prev.length === 0,
                },
            ];
        });
    };

    const setDefaultCompanyAssignment = (companyId: string) => {
        setCompanyAssignments((prev) =>
            prev.map((c) => ({ ...c, is_default: c.company_id === companyId }))
        );
    };

    const setCompanyAssignmentRole = (companyId: string, nextRole: 'admin' | 'member') => {
        setCompanyAssignments((prev) =>
            prev.map((c) => (c.company_id === companyId ? { ...c, role: nextRole } : c))
        );
    };

    const selectAllCompanies = () => {
        if (availableCompanies.length === 0) return;
        const currentDefaultId = companyAssignments.find((c) => c.is_default)?.company_id;
        const preferredDefault =
            (currentDefaultId && availableCompanies.some((c) => c.id === currentDefaultId) && currentDefaultId) ||
            availableCompanies.find((c) => c.is_default)?.id ||
            availableCompanies[0].id;
        setCompanyAssignments(
            availableCompanies.map((c) => {
                const existing = companyAssignments.find((item) => item.company_id === c.id);
                return {
                    company_id: c.id,
                    role: existing?.role || 'member',
                    is_default: c.id === preferredDefault,
                };
            })
        );
    };

    const applyPermissionPreset = (mode: 'operational' | 'all' | 'none') => {
        setForm((prev) => {
            const nextPerms: Record<string, any> = { ...prev.permissions };
            Object.keys(nextPerms).forEach((moduleKey) => {
                if (moduleKey === 'default_page' || typeof nextPerms[moduleKey] !== 'object') return;
                const shouldEnable =
                    mode === 'all' || (mode === 'operational' && !SOVEREIGN_MODULES.has(moduleKey));
                const updatedModule: Record<string, boolean> = {};
                Object.keys(nextPerms[moduleKey]).forEach((act) => {
                    updatedModule[act] = shouldEnable;
                });
                nextPerms[moduleKey] = updatedModule;
            });
            return { ...prev, permissions: nextPerms };
        });
    };

    const togglePerm = (module: string, action: string) => {
        setForm(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [module]: { ...(prev.permissions as any)[module], [action]: !(prev.permissions as any)[module][action] }
            }
        }));
    };

    const toggleAllInModule = (module: string) => {
        const modulePerms = (form.permissions as any)[module];
        const allActive = Object.values(modulePerms).every(v => v === true);
        const newState = !allActive;

        const updatedModule: any = {};
        Object.keys(modulePerms).forEach(key => updatedModule[key] = newState);

        setForm(prev => ({
            ...prev,
            permissions: { ...prev.permissions, [module]: updatedModule }
        }));
    };

    // 💾 دالة الحفظ والتواصل مع مسار API المحمي
    const handleSave = async () => {
        const isNewUser = !record?.id;

        if (isNewUser && (!form.email || !form.password)) {
            notify("يجب إدخال البريد الإلكتروني وكلمة المرور للمستخدم الجديد.");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                userId: record?.id, // undefined in case of new
                email: form.email,
                password: form.password,
                phone: form.phone,
                full_name: form.full_name,
                role: form.role,
                linked_partner_id: form.linked_partner_id,
                permissions: form.permissions,
                is_active: form.is_active,
                company_assignments: companyAssignments,
            };

            const method = isNewUser ? 'POST' : 'PUT';
            const res = await adminUsersRequest(method, payload);

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'حدث خطأ غير معروف');
            }
            
            showToast(`تم ${isNewUser ? 'إنشاء' : 'تحديث'} بيانات "${form.full_name}" بنجاح!`, "success");
            onSave(); 
            
        } catch (error: any) {
            console.error("❌ API Error:", error);
            notify(`عذراً، تعذر الحفظ!\nالسبب: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const moduleNames: any = {
        home: 'شاشة الترحيب والمفضلات',
        global_summary: 'الملخص العام',
        dashboard: 'لوحة القيادة',
        performance: 'مؤشرات الأداء',
        financial_center: 'المركز المالي',
        financial_statements: 'القوائم المالية',
        vat_return: 'إقرار ضريبة القيمة المضافة',
        accounts: 'دليل الحسابات',
        manual_journals: 'القيود اليدوية (تسويات)',
        journal: 'قيود اليومية',
        ledger: 'دفتر الأستاذ',
        trialbalance: 'ميزان المراجعة',
        journal_errors: 'رادار الأخطاء',
        cashflows: 'التدفقات النقدية',
        ar_aging: 'أعمار الذمم والتحصيل',
        custodies: 'عُهد المواقع والموظفين',
        cash_closing: 'إقفال الخزينة اليومي',
        fixed_assets: 'الأصول الثابتة والمعدات',
        audit: 'الرقابة والتنبيهات وصحة البيانات',
        financialplan: 'الخطة المالية',
        payments: 'سندات الصرف',
        receipts: 'سندات القبض',
        revenue: 'الإيرادات',
        expenses: 'المصروفات',
        invoices: 'الفواتير ومطالبات العملاء',
        fieldops: 'العمليات الميدانية',
        bim_viewer: 'استعراض 3D BIM',
        job_orders: 'أوامر الشغل',
        projects: 'غرفة المشاريع',
        requests_handovers: 'الركوستات والتسليمات الهندسية',
        purchase_orders: 'أوامر الشراء ومطابقة التوريد',
        inventory: 'المخزون والجرد وكارت الصنف',
        materials: 'توريد الخامات',
        materialitems: 'أصناف الخامات',
        material_issues: 'صرف الخامات للمواقع',
        subclaims: 'مستخلصات مقاولي الباطن',
        subcontractor_costs: 'تكاليف مقاولي الباطن',
        boqcatalog: 'الدليل الموحد للبنود (BOQ)',
        partners: 'دليل الشركاء',
        partner_balances: 'أرصدة الشركاء',
        statement: 'كشف حساب الشركاء',
        project_overhead: 'تحميل الأوفر هيد',
        boqbudget: 'ميزانية المقايسات',
        bulk_budget: 'تعديل الموازنات الشامل',
        costallocation: 'محرك توزيع التكاليف',
        project_ledger: 'دفتر التكاليف',
        project_profitability: 'ربحية المشاريع ومطابقة الأستاذ',
        employees: 'سجل الموظفين',
        team: 'إدارة فرق العمل (النظام)',
        labor_logs: 'يوميات الميدان',
        attendance: 'حضور وانصراف الموظفين',
        laborcost: 'تكاليف العمالة الميدانية',
        payroll: 'مسيرات الرواتب',
        violations: 'المخالفات والجزاءات',
        messages: 'الرسائل والمحادثات',
        notifications: 'مركز الإشعارات',
        reports: 'التقارير الشاملة',
        audit_logs: 'سجل المراقبة (Audit)',
        import: 'استيراد البيانات',
        companies: 'إدارة المنشآت والشركات',
        settings: 'إعدادات النظام وإدارة الموقع',
        profile: 'الملف الشخصي'
    };

    const isNewUser = !record?.id;

    const modalContent = (
        <div className="phi-modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="phi-modal-scrim" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(10px)' }} onClick={onClose} />

            <style>{`
                @keyframes scaleUp {
                    0% { opacity: 0; transform: scale(0.95) translateY(10px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .profile-modal-box {
                    background: #ffffff; border-radius: 14px; width: 62.5rem; max-width: 95vw; max-height: 90vh;
                    display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.5);
                    direction: rtl; position: relative; z-index: 10; animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .module-card { background: var(--surface-sunken); border-radius: 14px; padding: 1.375rem; margin-bottom: 0.9375rem; border: none; box-shadow: var(--shadow-sunken); transition: 0.2s; }
                .module-card:hover { border-color: ${THEME.primary}; background: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.03); }
                .perm-btn { padding: 0.625rem 1.125rem; border-radius: 12px; font-size: var(--fs-sm); font-weight: 800; cursor: pointer; border: none; background: var(--surface-card); box-shadow: var(--shadow-elevation); color: var(--text-secondary); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
                .perm-btn:hover { border-color: #cbd5e1; color: #1e293b; }
                .perm-btn.active { background: ${THEME.primary}; color: white; border-color: ${THEME.primary}; box-shadow: 0 8px 20px ${THEME.primary}40; }
                .btn-all { font-size: var(--fs-xs); background: var(--surface-sunken); color: var(--text-primary); border: none; box-shadow: var(--shadow-sunken); padding: 0.5rem 0.875rem; border-radius: 10px; cursor: pointer; font-weight: 800; transition: 0.2s; }
                .btn-all:hover { background: #e2e8f0; color: #0f172a; border-color: #cbd5e1; }
                .modal-input { width: 100%; padding: 0.9375rem 1.25rem; border-radius: 16px; border: none; box-shadow: var(--shadow-sunken); font-weight: 800; font-size: var(--fs-md); outline: none; transition: 0.2s; color: var(--text-primary); background: var(--surface-sunken); }
                .modal-input:focus { border-color: ${THEME.primary}; background: white; box-shadow: 0 0 0 4px ${THEME.primary}15; }
                .cinematic-scroll::-webkit-scrollbar { width: 0.5rem; }
                .cinematic-scroll::-webkit-scrollbar-track { background: transparent; }
                .cinematic-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid white; }
                .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>

            <div className="profile-modal-box">
                <div style={{ padding: '1.875rem 2.5rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', flexShrink: 0 }}>
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 900, color: THEME.primary, fontSize: 'var(--fs-2xl)', letterSpacing: '-0.5px' }}>
                            {isNewUser ? 'إضافة مستخدم جديد' : 'إعدادات حساب المستخدم'}
                        </h2>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 600 }}>إدارة وصول المستخدم: <b style={{color: '#1e293b', fontSize: 'var(--fs-md)'}}>{form.full_name || 'مستخدم جديد'}</b></p>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', width: '2.375rem', height: '2.375rem', borderRadius: '50%', cursor: 'pointer', fontWeight: 900, transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>

                <div className="cinematic-scroll" style={{ overflowY: 'auto', padding: '1.875rem 2.5rem', flex: 1, background: '#ffffff' }}>
                    
                    {/* بيانات المصادقة والملف الشخصي */}
                    <div style={{ background: 'var(--surface-sunken)', padding: '1.25rem', borderRadius: '14px', border: 'none', boxShadow: 'var(--shadow-sunken)', marginBottom: '1.875rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontWeight: 900, color: '#0f172a' }}>بيانات الحساب الأساسية</h3>
                            {!isNewUser && (
                                <button 
                                    onClick={() => setForm({...form, is_active: !form.is_active})}
                                    style={{ padding: '0.5rem 1rem', borderRadius: '12px', fontWeight: 900, border: 'none', cursor: 'pointer', background: form.is_active ? '#fee2e2' : '#dcfce7', color: form.is_active ? '#ef4444' : '#22c55e', transition: '0.3s' }}
                                >
                                    {form.is_active ? 'إيقاف الحساب' : 'تنشيط الحساب'}
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13.75rem, 1fr))', gap: '1.25rem' }}>
                            <div>
                                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '0.625rem' }}>الاسم الكامل</label>
                                <input type="text" className="modal-input" value={form.full_name} placeholder="اسم الموظف أو المستخدم..." onChange={e => setForm({...form, full_name: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '0.625rem' }}>البريد الإلكتروني</label>
                                <input type="email" className="modal-input" value={form.email} placeholder="مثال: user@company.com" onChange={e => setForm({...form, email: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '0.625rem' }}>كلمة المرور {isNewUser ? '*' : '(اختياري للتغيير)'}</label>
                                <input type="password" className="modal-input" value={form.password} placeholder={isNewUser ? "كلمة المرور الجديدة" : "اتركه فارغاً للاحتفاظ بالحالية"} onChange={e => setForm({...form, password: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '0.625rem' }}>رقم الجوال</label>
                                <input type="tel" className="modal-input" value={form.phone} placeholder="رقم الموبايل..." onChange={e => setForm({...form, phone: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* بيانات الوظيفة والربط المحاسبي والتوجيه بعد الدخول */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13.75rem, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '0.625rem' }}>الرتبة (System Role)</label>
                            <select className="modal-input" style={{ cursor: 'pointer' }} value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                                <optgroup label="الإدارة العليا">
                                    <option value="super_admin">سوبر أدمن (صلاحيات مطلقة)</option>
                                    <option value="admin">أدمن (إدارة المستخدمين)</option>
                                </optgroup>
                                <optgroup label="التشغيل">
                                    <option value="manager">مدير نظام (عمليات مالية وإدارية)</option>
                                    <option value="staff">موظف (لوحة تحكم خاصة)</option>
                                </optgroup>
                                <optgroup label="الخارج">
                                    <option value="contractor">مقاول (بوابة المقاولين)</option>
                                    <option value="client">عميل (بوابة العملاء)</option>
                                </optgroup>
                            </select>
                        </div>
                        <div style={{ position: 'relative', zIndex: 50 }}> 
                            <SmartCombo 
                                label="الربط المحاسبي (شريك/عميل)"
                                table="partners"
                                displayCol="name"
                                initialDisplay={record?.partners?.name}
                                placeholder="ابحث عن الشريك لربطه..."
                                onSelect={(p: any) => setForm({...form, linked_partner_id: p?.id || null})}
                                enableClear={true}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '0.625rem' }}>
                                🎯 صفحة التوجيه بعد تسجيل الدخول (Landing Route)
                            </label>
                            <select 
                                className="modal-input" 
                                style={{ cursor: 'pointer' }} 
                                value={(form.permissions as any)?.default_page || 'auto'} 
                                onChange={e => setForm({
                                    ...form, 
                                    permissions: {
                                        ...form.permissions,
                                        default_page: e.target.value
                                    }
                                })}
                            >
                                {AVAILABLE_LANDING_PAGES.map(page => (
                                    <option key={page.value} value={page.value}>{page.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 🏢 قسم ربط المستخدم بالشركات وعزل الصلاحيات */}
                    <div style={{ background: 'var(--surface-sunken)', padding: '1.375rem', borderRadius: '14px', boxShadow: 'var(--shadow-sunken)', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                <Building2 size={18} color={THEME.primary} aria-hidden="true" />
                                <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                                    الشركات المربوطة بالمستخدم (عزل البيانات حسب الشركة)
                                </h3>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button type="button" className="btn-all" onClick={selectAllCompanies}>تحديد كل الشركات</button>
                                <button type="button" className="btn-all" onClick={() => setCompanyAssignments([])}>إلغاء ربط كل الشركات</button>
                            </div>
                        </div>

                        {(form.role === 'admin' || form.role === 'super_admin') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff7ed', color: '#9a3412', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: 'var(--fs-xs)', fontWeight: 800, marginBottom: '1rem' }}>
                                <ShieldAlert size={16} aria-hidden="true" />
                                <span>ملاحظة: رتبة (سوبر أدمن / أدمن) تمنح صلاحية الوصول لجميع الشركات تلقائياً. لعزل المستخدم داخل شركات محددة فقط (مثل شركة تيست)، اختر رتبة (موظف staff) أو (مدير نظام manager).</span>
                            </div>
                        )}

                        {loadingCompanies ? (
                            <div style={{ fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 700, padding: '0.75rem 0' }}>
                                جاري تحميل الشركات...
                            </div>
                        ) : availableCompanies.length === 0 ? (
                            <div style={{ fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 700, padding: '0.75rem 0' }}>
                                لا توجد شركات نشطة متاحة حالياً.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17.5rem, 1fr))', gap: '0.75rem' }}>
                                {availableCompanies.map((company) => {
                                    const assigned = companyAssignments.find((a) => a.company_id === company.id);
                                    const isSelected = Boolean(assigned);
                                    return (
                                        <div
                                            key={company.id}
                                            style={{
                                                background: isSelected ? '#ffffff' : 'rgba(255,255,255,0.65)',
                                                borderRadius: '14px',
                                                padding: '1rem',
                                                boxShadow: isSelected
                                                    ? `0 0 0 2px ${THEME.primary}, 0 8px 20px ${THEME.primary}18`
                                                    : 'var(--shadow-elevation)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.75rem',
                                                transition: '0.2s',
                                            }}
                                        >
                                            <div
                                                onClick={() => toggleCompanyAssignment(company.id)}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', cursor: 'pointer' }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}}
                                                        aria-label={`ربط بشركة ${company.name}`}
                                                        style={{ width: '1.1rem', height: '1.1rem', accentColor: THEME.primary, cursor: 'pointer' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontWeight: 900, fontSize: 'var(--fs-md)', color: '#0f172a' }}>{company.name}</div>
                                                        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#64748b' }}>
                                                            الكود: {company.code} {company.currency ? `· ${company.currency}` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                                {assigned?.is_default && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--fs-xs)', fontWeight: 900, background: `${THEME.primary}18`, color: THEME.primary, padding: '0.25rem 0.5rem', borderRadius: '999px' }}>
                                                        <CheckCircle2 size={12} aria-hidden="true" />
                                                        افتراضية
                                                    </span>
                                                )}
                                            </div>

                                            {isSelected && assigned && (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDefaultCompanyAssignment(company.id)}
                                                        className={`perm-btn ${assigned.is_default ? 'active' : ''}`}
                                                        style={{ padding: '0.375rem 0.75rem', fontSize: 'var(--fs-xs)' }}
                                                    >
                                                        {assigned.is_default ? 'الشركة الافتراضية' : 'تعيين كافتراضية'}
                                                    </button>
                                                    <select
                                                        value={assigned.role}
                                                        onChange={(e) => setCompanyAssignmentRole(company.id, e.target.value === 'admin' ? 'admin' : 'member')}
                                                        style={{ padding: '0.375rem 0.625rem', borderRadius: '10px', border: 'none', boxShadow: 'var(--shadow-sunken)', background: 'var(--surface-sunken)', fontWeight: 800, fontSize: 'var(--fs-xs)', color: '#0f172a', cursor: 'pointer' }}
                                                    >
                                                        <option value="member">عضو (Member)</option>
                                                        <option value="admin">مدير شركة (Company Admin)</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5625rem', borderBottom: '2px dashed #f1f5f9', paddingBottom: '0.9375rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <span style={{ fontSize: 'var(--fs-xl)' }}><Lock size={17} aria-hidden="true" /></span>
                            <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#0f172a', margin: 0 }}>مصفوفة الوصول المتقدمة</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button type="button" className="btn-all" onClick={() => applyPermissionPreset('operational')}>
                                تفعيل كل شاشات التشغيل (بدون الإعدادات السيادية)
                            </button>
                            <button type="button" className="btn-all" onClick={() => applyPermissionPreset('all')}>
                                تفعيل الكل
                            </button>
                            <button type="button" className="btn-all" onClick={() => applyPermissionPreset('none')}>
                                إلغاء الكل
                            </button>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(25rem, 1fr))', gap: '0.9375rem' }}>
                        {Object.keys(form.permissions)
                            .filter((module) => module !== 'default_page' && form.permissions[module] && typeof form.permissions[module] === 'object')
                            .map((module) => (
                            <div key={module} className="module-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.125rem', flexWrap: 'wrap', gap: '0.625rem' }}>
                                    <span style={{ fontWeight: 900, fontSize: 'var(--fs-lg)', color: '#1e293b' }}>{moduleNames[module] || module}</span>
                                    <button className="btn-all" onClick={() => toggleAllInModule(module)}>الكل</button>
                                </div>
                                <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                                    {Object.keys((form.permissions as any)[module]).map((action) => (
                                        <button key={action} onClick={() => togglePerm(module, action)} className={`perm-btn ${(form.permissions as any)[module][action] ? 'active' : ''}`}>
                                            {action === 'view' ? 'عرض' : 
                                             action === 'create' ? 'إضافة' : 
                                             action === 'edit' ? 'تعديل' : 
                                             action === 'delete' ? 'حذف' : 
                                             action === 'post' ? 'ترحيل' : 
                                             action === 'financial' ? 'مالي' : 
                                             action === 'operational' ? 'تشغيلي' : action}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '1.5625rem 2.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.9375rem', background: 'white', flexShrink: 0 }}>
                    <button 
                        onClick={handleSave} disabled={isSaving}
                        style={{ flex: 2, padding: '1.125rem', borderRadius: '14px', border: 'none', background: THEME.primary, color: 'white', fontWeight: 900, fontSize: 'var(--fs-lg)', cursor: 'pointer', boxShadow: `0 15px 30px ${THEME.primary}40`, transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    >
                        {isSaving ? 'جاري الحفظ...' : 'اعتماد وحفظ التغييرات'}
                    </button>
                    <button 
                        onClick={onClose} 
                        style={{ flex: 1, padding: '1.125rem', borderRadius: '14px', border: 'none', background: 'var(--surface-subcard)', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-elevation)', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-lg)', transition: '0.2s' }}
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
