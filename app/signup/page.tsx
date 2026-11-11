"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { THEME } from '@/lib/theme'; 
import Image from 'next/image';
import SmartCombo from '@/components/SmartCombo'; 

export default function SignUpPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // 🧠 مصفوفة الصلاحيات الكاملة (Full Access Master Key)
    const fullAccessPermissions = {
        global_summary: { view: true }, dashboard: { view: true }, financial_center: { view: true }, financial_statements: { view: true },
        accounts: { view: true, create: true, edit: true, delete: true },
        journal: { view: true, create: true, edit: true, delete: true, post: true },
        ledger: { view: true }, trialbalance: { view: true }, journal_errors: { view: true, edit: true }, cashflows: { view: true },
        payments: { view: true, create: true, edit: true, delete: true, post: true },
        receipts: { view: true, create: true, edit: true, delete: true, post: true },
        revenue: { view: true, create: true, edit: true, delete: true, post: true },
        expenses: { view: true, create: true, edit: true, delete: true, post: true },
        invoices: { view: true, create: true, edit: true, delete: true, post: true },
        fieldops: { view: true }, projects: { view: true, create: true, edit: true, delete: true },
        materials: { view: true, create: true, edit: true, delete: true, post: true },
        materialitems: { view: true, create: true, edit: true, delete: true },
        material_issues: { view: true, create: true, edit: true, delete: true, post: true },
        subclaims: { view: true, create: true, edit: true, delete: true, post: true },
        subcontractor_costs: { view: true },
        boqcatalog: { view: true, create: true, edit: true, delete: true },
        partners: { view: true, create: true, edit: true, delete: true },
        partner_balances: { view: true }, statement: { view: true },
        project_overhead: { view: true, create: true, edit: true, delete: true },
        boqbudget: { view: true, create: true, edit: true, delete: true },
        costallocation: { view: true, create: true, edit: true, delete: true },
        project_ledger: { view: true },
        employees: { view: true, create: true, edit: true, delete: true },
        team: { view: true, create: true, edit: true, delete: true },
        labor_logs: { view: true, create: true, edit: true, delete: true, post: true },
        laborcost: { view: true },
        payroll: { view: true, create: true, edit: true, delete: true, post: true },
        violations: { view: true, create: true, edit: true, delete: true },
        reports: { view: true, financial: true, operational: true },
        import: { view: true, create: true },
        settings: { view: true, edit: true },
        profile: { view: true, edit: true }
    };

    const [form, setForm] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'staff', // جعلناه موظف افتراضي بدلاً من عميل
    });

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (form.password !== form.confirmPassword) { setErrorMsg('كلمتا المرور غير متطابقتين!'); return; }
        if (form.password.length < 6) { setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); return; }

        setIsLoading(true);

        try {
            // 1️⃣ إنشاء الحساب في Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: { data: { full_name: form.fullName, role: form.role } }
            });

            if (error) throw error;

            // 2️⃣ إنشاء البروفايل بالصلاحيات الكاملة المكملة
            if (data.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: data.user.id,
                        full_name: form.fullName,
                        email: form.email,
                        role: form.role,
                        is_admin: form.role === 'admin',
                        permissions: fullAccessPermissions // 🛡️ هنا بنرمي كل الصلاحيات
                    });
                
                if (profileError) console.log("RLS Alert:", profileError.message);
            }

            setSuccessMsg('تم إنشاء الحساب بصلاحيات كاملة! جاري التحويل...');
            setTimeout(() => { router.push('/login'); }, 2000);

        } catch (error: any) {
            setErrorMsg(error.message || 'حدث خطأ أثناء التسجيل.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="phi-signup" style={{
            minHeight: '100vh', width: '100vw', display: 'grid', placeItems: 'center',
            background: "linear-gradient(180deg, rgba(10, 12, 16, 0.45), rgba(10, 12, 16, 0.68)), url('/brand/login-bg.webp?v=2') center center / cover no-repeat, #0d0f14",
            fontFamily: "'Cairo', sans-serif", direction: 'rtl', 
            padding: '1.25rem', position: 'relative', overflow: 'hidden'
        }}>
            
            {/* ✨ توهج ذهبي ملكي (بدل الأزرق) */}
            <div className="gold-glow" />

            <style>{`
                .gold-glow {
                    position: absolute; top: 50%; left: 50%; width: 37.5rem; height: 37.5rem;
                    background: radial-gradient(circle, ${THEME.brand.gold}30 0%, transparent 70%);
                    border-radius: 50%; filter: blur(80px);
                    animation: pulseGlow 8s infinite alternate;
                    z-index: 1;
                }
                @keyframes pulseGlow {
                    from { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
                    to { transform: translate(-45%, -45%) scale(1.3); opacity: 0.6; }
                }

                .signup-card {
                    width: 100%; max-width: 30rem; z-index: 10;
                    padding: 3.125rem 2.5rem; border-radius: 14px;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(40px);
                    -webkit-backdrop-filter: blur(40px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 50px 100px rgba(0,0,0,0.4);
                }

                .input-label {
                    font-size: var(--fs-sm); font-weight: 900; color: ${THEME.brand.gold};
                    display: block; margin-bottom: 0.625rem; padding-right: 0.3125rem;
                }

                .custom-input {
                    width: 100%; padding: 1.125rem; border-radius: 14px;
                    background: rgba(0, 0, 0, 0.2); border: 1.5px solid rgba(255, 255, 255, 0.1);
                    color: white; font-weight: 700; font-size: var(--fs-lg); outline: none;
                    transition: 0.3s; margin-bottom: 1.25rem;
                }
                .custom-input:focus { border-color: ${THEME.brand.gold}; background: rgba(0, 0, 0, 0.4); }

                .signup-btn {
                    width: 100%; padding: 1.25rem; border-radius: 14px;
                    background: linear-gradient(135deg, ${THEME.brand.gold}, ${THEME.brand.goldLight});
                    color: ${THEME.brand.coffee}; font-size: var(--fs-lg); font-weight: 900;
                    border: none; cursor: pointer; transition: 0.4s;
                    box-shadow: 0 10px 30px ${THEME.brand.gold}40;
                }
                .signup-btn:hover { transform: translateY(-5px); box-shadow: 0 20px 40px ${THEME.brand.gold}60; }

                .dark-combo .smart-combo-input {
                    background: rgba(0, 0, 0, 0.2) !important;
                    border: 1.5px solid rgba(255, 255, 255, 0.1) !important;
                    color: white !important;
                    border-radius: 14px !important;
                    padding: 1.125rem !important;
                }
            `}</style>

            <div className="signup-card">
                {/* 🍎 هيدر اللوجو الفخم */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ position: 'relative', width: '6.25rem', height: '6.25rem', margin: '0 auto 1.25rem' }}>
                        <Image 
                            src="/phitech-symbol.svg"
                            alt="شعار فاي تك" fill
                            style={{ objectFit: 'contain', filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.4))' }} 
                        />
                    </div>
                    <h2 style={{ color: 'white', margin: 0, fontWeight: 900, fontSize: 'var(--fs-2xl)' }}>بوابة الموظفين والشركاء</h2>
                    <p style={{ color: '#94a3b8', fontSize: 'var(--fs-md)', marginTop: '0.5rem' }}>أنشئ حسابك للوصول إلى كامل صلاحيات النظام</p>
                </div>

                {errorMsg && <div style={{ background: '#7f1d1d40', color: '#fca5a5', padding: '0.9375rem', borderRadius: '15px', marginBottom: '1.25rem', fontSize: 'var(--fs-sm)', textAlign: 'center', border: '1px solid #7f1d1d60' }}>{errorMsg}</div>}
                {successMsg && <div style={{ background: '#064e3b40', color: '#6ee7b7', padding: '0.9375rem', borderRadius: '15px', marginBottom: '1.25rem', fontSize: 'var(--fs-sm)', textAlign: 'center', border: '1px solid #064e3b60' }}>{successMsg}</div>}

                <form onSubmit={handleSignUp}>
                    <label className="input-label">الاسم الكامل</label>
                    <input 
                        type="text" className="custom-input" placeholder="اكتب اسمك كما في الهوية..." required
                        value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})}
                    />
                    
                    <label className="input-label">البريد الإلكتروني</label>
                    <input 
                        type="email" className="custom-input" placeholder="mail@example.com" required
                        value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    />

                    <div style={{ marginBottom: '1.5625rem' }} className="dark-combo">
                        <SmartCombo 
                            label="تحديد صفة الدخول"
                            options={['موظف إداري / مهندس', 'مقاول باطن / مورد', 'عميل / صاحب مشروع']}
                            initialDisplay="موظف إداري / مهندس"
                            onSelect={(val) => {
                                const role = val.includes('موظف') ? 'staff' : val.includes('مقاول') ? 'contractor' : 'client';
                                setForm({...form, role});
                            }}
                            strict={true}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '0.9375rem' }}>
                        <div>
                            <label className="input-label">كلمة المرور</label>
                            <input 
                                type="password" className="custom-input" required
                                value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="input-label">تأكيد الرمز</label>
                            <input 
                                type="password" className="custom-input" required
                                value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})}
                            />
                        </div>
                    </div>

                    <button type="submit" className="signup-btn" disabled={isLoading}>
                        {isLoading ? 'جاري إنشاء هويتك الرقمية...' : 'تفعيل الحساب والصلاحيات'}
                    </button>
                </form>

                <div style={{ marginTop: '2.1875rem', textAlign: 'center', fontSize: 'var(--fs-md)', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5625rem' }}>
                    لديك حساب بالفعل؟{' '}
                    <Link href="/login" style={{ color: THEME.brand.gold, textDecoration: 'none', fontWeight: 900 }}>
                        سجل دخولك الآن
                    </Link>
                </div>
            </div>
        </div>
    );
}
