"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import { THEME } from '@/lib/theme';
import { useToast } from '@/lib/toast-context'; 
import SmartCombo from '@/components/SmartCombo'; 
import { adminUsersRequest } from '@/lib/admin-api';

interface ProfileEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: any; 
    onSave: () => void;
}

export default function ProfileEditorModal({ isOpen, onClose, record, onSave }: ProfileEditorModalProps) {
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [mounted, setMounted] = useState(false); 

    const defaultPermissions = {
        global_summary: { view: false },
        dashboard: { view: false },
        financial_center: { view: false },
        financial_statements: { view: false },
        accounts: { view: false, create: false, edit: false, delete: false },
        journal: { view: false, create: false, edit: false, delete: false, post: false },
        ledger: { view: false },
        trialbalance: { view: false },
        journal_errors: { view: false, edit: false },
        cashflows: { view: false },
        payments: { view: false, create: false, edit: false, delete: false, post: false },
        receipts: { view: false, create: false, edit: false, delete: false, post: false },
        revenue: { view: false, create: false, edit: false, delete: false, post: false },
        expenses: { view: false, create: false, edit: false, delete: false, post: false },
        invoices: { view: false, create: false, edit: false, delete: false, post: false },
        fieldops: { view: false, create: false, edit: false, delete: false, post: false },
        job_orders: { view: false, create: false, edit: false, delete: false, post: false },
        projects: { view: false, create: false, edit: false, delete: false },
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
        costallocation: { view: false, create: false, edit: false, delete: false },
        project_ledger: { view: false },
        employees: { view: false, create: false, edit: false, delete: false },
        team: { view: false, create: false, edit: false, delete: false },
        labor_logs: { view: false, create: false, edit: false, delete: false, post: false },
        laborcost: { view: false },
        payroll: { view: false, create: false, edit: false, delete: false, post: false },
        violations: { view: false, create: false, edit: false, delete: false, post: false },
        reports: { view: false, financial: false, operational: false },
        audit_logs: { view: false },
        import: { view: false, create: false },
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
                    if (record.permissions[moduleKey]) {
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
                email: record.email || '', // افترض أنه تم جلب الايميل، وفي حالة عدم الجلب يظل فارغاً
                phone: record.phone_number || '', // رقم الجوال من الـ profile
                password: '', // لا يظهر الباسورد القديم
                is_active: record.is_active !== false, // الافتراضي نشط
                linked_partner_id: record.linked_partner_id || null, 
                permissions: mergedPermissions
            });
        } else if (!record && isOpen) {
            // حالة الإنشاء الجديد
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
        }
    }, [record, isOpen]);

    if (!isOpen || !mounted) return null;

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
            alert("❌ يجب إدخال البريد الإلكتروني وكلمة المرور للمستخدم الجديد.");
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
                is_active: form.is_active
            };

            const method = isNewUser ? 'POST' : 'PUT';
            const res = await adminUsersRequest(method, payload);

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'حدث خطأ غير معروف');
            }
            
            showToast(`✅ تم ${isNewUser ? 'إنشاء' : 'تحديث'} بيانات "${form.full_name}" بنجاح!`, "success");
            onSave(); 
            
        } catch (error: any) {
            console.error("❌ API Error:", error);
            alert(`❌ عذراً، تعذر الحفظ!\nالسبب: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const moduleNames: any = {
        global_summary: '📊 الملخص العام',
        dashboard: '🖥️ لوحة القيادة',
        financial_center: '🏦 المركز المالي',
        financial_statements: '🏛️ القوائم المالية',
        accounts: '🗂️ دليل الحسابات',
        journal: '📝 قيود اليومية',
        ledger: '📒 دفتر الأستاذ',
        trialbalance: '⚖️ ميزان المراجعة',
        journal_errors: '🛡️ رادار الأخطاء',
        cashflows: '🔄 التدفقات النقدية',
        payments: '🔴 سندات الصرف',
        receipts: '🟢 سندات القبض',
        revenue: '📈 الإيرادات',
        expenses: '📉 المصروفات',
        invoices: '🧾 الفواتير ومطالبات العملاء',
        fieldops: '📡 العمليات الميدانية',
        job_orders: '🛠️ أوامر الشغل',
        projects: '🏗️ غرفة المشاريع',
        materials: '🧱 توريد الخامات',
        materialitems: '📦 أصناف الخامات',
        material_issues: '🚚 صرف الخامات للمواقع',
        subclaims: '📑 مستخلصات مقاولي الباطن',
        subcontractor_costs: '💵 تكاليف مقاولي الباطن',
        boqcatalog: '📚 الدليل الموحد للبنود (BOQ)',
        partners: '🤝 دليل الشركاء',
        partner_balances: '⚖️ أرصدة الشركاء',
        statement: '📑 كشف حساب الشركاء',
        project_overhead: '🦅 تحميل الأوفر هيد',
        boqbudget: '💼 ميزانية المقايسات',
        costallocation: '🧮 محرك توزيع التكاليف',
        project_ledger: '📋 دفتر التكاليف',
        employees: '👔 سجل الموظفين',
        team: '👥 إدارة فرق العمل',
        labor_logs: '👷 يوميات الميدان',
        laborcost: '💰 تكاليف العمالة الميدانية',
        payroll: '💵 مسيرات الرواتب',
        violations: '⚠️ المخالفات والجزاءات',
        reports: '📊 التقارير الشاملة',
        audit_logs: '🕵️ سجل المراقبة (Audit)',
        import: '📥 استيراد البيانات',
        settings: '⚙️ إعدادات النظام',
        profile: '👤 الملف الشخصي'
    };

    const isNewUser = !record?.id;

    const modalContent = (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(10px)' }} onClick={onClose} />

            <style>{`
                @keyframes scaleUp {
                    0% { opacity: 0; transform: scale(0.95) translateY(10px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .profile-modal-box {
                    background: #ffffff; border-radius: 32px; width: 1000px; max-width: 95vw; max-height: 90vh;
                    display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.5);
                    direction: rtl; position: relative; z-index: 10; animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .module-card { background: #f8fafc; border-radius: 20px; padding: 22px; margin-bottom: 15px; border: 1px solid #e2e8f0; transition: 0.3s; }
                .module-card:hover { border-color: ${THEME.primary}; background: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.03); }
                .perm-btn { padding: 10px 18px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; border: 2px solid #e2e8f0; background: white; color: #64748b; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
                .perm-btn:hover { border-color: #cbd5e1; color: #1e293b; }
                .perm-btn.active { background: ${THEME.primary}; color: white; border-color: ${THEME.primary}; box-shadow: 0 8px 20px ${THEME.primary}40; }
                .btn-all { font-size: 11px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-weight: 900; transition: 0.2s; }
                .btn-all:hover { background: #e2e8f0; color: #0f172a; border-color: #cbd5e1; }
                .modal-input { width: 100%; padding: 15px 20px; border-radius: 16px; border: 2px solid #e2e8f0; font-weight: 800; font-size: 14px; outline: none; transition: 0.3s; color: #1e293b; background: #f8fafc; }
                .modal-input:focus { border-color: ${THEME.primary}; background: white; box-shadow: 0 0 0 4px ${THEME.primary}15; }
                .cinematic-scroll::-webkit-scrollbar { width: 8px; }
                .cinematic-scroll::-webkit-scrollbar-track { background: transparent; }
                .cinematic-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid white; }
                .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>

            <div className="profile-modal-box">
                <div style={{ padding: '30px 40px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', flexShrink: 0 }}>
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 900, color: THEME.primary, fontSize: '24px', letterSpacing: '-0.5px' }}>
                            {isNewUser ? '➕ إضافة مستخدم جديد' : '🛡️ إعدادات حساب المستخدم'}
                        </h2>
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>إدارة وصول المستخدم: <b style={{color: '#1e293b', fontSize: '14px'}}>{form.full_name || 'مستخدم جديد'}</b></p>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', width: '38px', height: '38px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900, transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>

                <div className="cinematic-scroll" style={{ overflowY: 'auto', padding: '30px 40px', flex: 1, background: '#ffffff' }}>
                    
                    {/* بيانات المصادقة والملف الشخصي */}
                    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontWeight: 900, color: '#0f172a' }}>بيانات الحساب الأساسية</h3>
                            {!isNewUser && (
                                <button 
                                    onClick={() => setForm({...form, is_active: !form.is_active})}
                                    style={{ padding: '8px 16px', borderRadius: '12px', fontWeight: 900, border: 'none', cursor: 'pointer', background: form.is_active ? '#fee2e2' : '#dcfce7', color: form.is_active ? '#ef4444' : '#22c55e', transition: '0.3s' }}
                                >
                                    {form.is_active ? '🚫 إيقاف الحساب' : '✅ تنشيط الحساب'}
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                            <div>
                                <label style={{ fontSize: '13px', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '10px' }}>الاسم الكامل</label>
                                <input type="text" className="modal-input" value={form.full_name} placeholder="اسم الموظف أو المستخدم..." onChange={e => setForm({...form, full_name: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: '13px', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '10px' }}>البريد الإلكتروني</label>
                                <input type="email" className="modal-input" value={form.email} placeholder="مثال: user@company.com" onChange={e => setForm({...form, email: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: '13px', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '10px' }}>كلمة المرور {isNewUser ? '*' : '(اختياري للتغيير)'}</label>
                                <input type="password" className="modal-input" value={form.password} placeholder={isNewUser ? "كلمة المرور الجديدة" : "اتركه فارغاً للاحتفاظ بالحالية"} onChange={e => setForm({...form, password: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: '13px', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '10px' }}>رقم الجوال</label>
                                <input type="tel" className="modal-input" value={form.phone} placeholder="رقم الموبايل..." onChange={e => setForm({...form, phone: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* بيانات الوظيفة والربط المحاسبي */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                        <div>
                            <label style={{ fontSize: '13px', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '10px' }}>الرتبة (System Role)</label>
                            <select className="modal-input" style={{ cursor: 'pointer' }} value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                                <optgroup label="الإدارة العليا">
                                    <option value="super_admin">👑 سوبر أدمن (صلاحيات مطلقة)</option>
                                    <option value="admin">🛡️ أدمن (إدارة المستخدمين)</option>
                                </optgroup>
                                <optgroup label="التشغيل">
                                    <option value="manager">💼 مدير نظام (عمليات مالية وإدارية)</option>
                                    <option value="staff">👨‍💻 موظف (لوحة تحكم خاصة)</option>
                                </optgroup>
                                <optgroup label="الخارج">
                                    <option value="contractor">👷 مقاول (بوابة المقاولين)</option>
                                    <option value="client">👤 عميل (بوابة العملاء)</option>
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
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px', borderBottom: '2px dashed #f1f5f9', paddingBottom: '15px' }}>
                        <span style={{ fontSize: '20px' }}>🔐</span>
                        <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>مصفوفة الوصول المتقدمة</h3>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '15px' }}>
                        {Object.keys(form.permissions).map((module) => (
                            <div key={module} className="module-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                                    <span style={{ fontWeight: 900, fontSize: '15px', color: '#1e293b' }}>{moduleNames[module] || module}</span>
                                    <button className="btn-all" onClick={() => toggleAllInModule(module)}>الكل</button>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {Object.keys((form.permissions as any)[module]).map((action) => (
                                        <button key={action} onClick={() => togglePerm(module, action)} className={`perm-btn ${(form.permissions as any)[module][action] ? 'active' : ''}`}>
                                            {action === 'view' ? '👁️ عرض' : 
                                             action === 'create' ? '➕ إضافة' : 
                                             action === 'edit' ? '📝 تعديل' : 
                                             action === 'delete' ? '🗑️ حذف' : 
                                             action === 'post' ? '🚀 ترحيل' : 
                                             action === 'financial' ? '💰 مالي' : 
                                             action === 'operational' ? '⚙️ تشغيلي' : action}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '25px 40px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '15px', background: 'white', flexShrink: 0 }}>
                    <button 
                        onClick={handleSave} disabled={isSaving}
                        style={{ flex: 2, padding: '18px', borderRadius: '18px', border: 'none', background: THEME.primary, color: 'white', fontWeight: 900, fontSize: '16px', cursor: 'pointer', boxShadow: `0 15px 30px ${THEME.primary}40`, transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    >
                        {isSaving ? '⏳ جاري الحفظ...' : '✅ اعتماد وحفظ التغييرات'}
                    </button>
                    <button 
                        onClick={onClose} 
                        style={{ flex: 1, padding: '18px', borderRadius: '18px', border: '2px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 900, cursor: 'pointer', fontSize: '16px', transition: '0.3s' }}
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
