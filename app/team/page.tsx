"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { adminUsersRequest } from '@/lib/admin-api';
import { THEME } from '@/lib/theme';
import { useSidebar } from '@/lib/SidebarContext'; 
import MasterPage from '@/components/MasterPage'; 
import ProfileEditorModal from './profileeditormodal';
import { useRouter } from 'next/navigation'; // 👈 استدعاء الراوتر للطرد
import { Hourglass, Sparkles } from 'lucide-react';
import { notify } from '@/lib/notify';

export default function TeamPage() {
    // ==========================================
    // 1. States & Context
    // ==========================================
    const router = useRouter(); // 👈 تفعيل الراوتر
    const { setSidebarContent } = useSidebar();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // ==========================================
    // 🛡️ 1.5 Security Guard (حارس الأمان)
    // ==========================================
    useEffect(() => {
        const checkAccess = async () => {
            // 1. التأكد من تسجيل الدخول
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login'); // طرد لصفحة الدخول
                return;
            }

            // 2. التأكد من الصلاحيات الإدارية
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, is_admin')
                .eq('id', user.id)
                .single();

            // لو مش أدمن، اطرده للصفحة الرئيسية
            if (profile?.role !== 'admin' && profile?.is_admin !== true) {
                notify("غير مصرح لك بالدخول! هذه الصفحة مخصصة لمديري النظام فقط.");
                router.push('/'); 
            }
        };

        checkAccess();
    }, [router]);

    // ==========================================
    // 2. Data Fetching (With Crash Protection)
    // ==========================================
    const fetchProfiles = async () => {
        setIsLoading(true);
        try {
            // المحاولة الأولى: جلب البيانات مع اسم الشريك
            const { data, error } = await supabase
                .from('profiles')
                .select('*, partners(name)')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setProfiles(data || []);

        } catch (err: any) {
            console.warn("⚠️ فشل جلب العلاقات، جاري المحاولة بدون الشركاء...", err);
            
            // المحاولة الثانية (Fallback): جلب الملفات فقط
            try {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('profiles')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (fallbackError) throw fallbackError;
                setProfiles(fallbackData || []);
                console.log("✅ تم جلب البيانات الأساسية بنجاح كبديل.");
            } catch (fatalErr: any) {
                console.error("❌ Fatal Fetch Error:", fatalErr);
                notify("تعذر الاتصال بقاعدة البيانات. تأكد من اتصال الإنترنت.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        fetchProfiles(); 
    }, []);

    // ==========================================
    // 3. Search & Filters
    // ==========================================
    const filteredProfiles = useMemo(() => {
        if (!searchTerm) return profiles;
        const lowerTerm = searchTerm.toLowerCase();
        return profiles.filter(p => 
            p.full_name?.toLowerCase().includes(lowerTerm) || 
            p.email?.toLowerCase().includes(lowerTerm) ||
            p.username?.toLowerCase().includes(lowerTerm) ||
            p.nickname?.toLowerCase().includes(lowerTerm) ||
            p.partners?.name?.toLowerCase().includes(lowerTerm) 
        );
    }, [profiles, searchTerm]);

    // ==========================================
    // 4. Handlers
    // ==========================================
    const handleCopyInvite = () => {
        const signupLink = `${window.location.origin}/signup`;
        navigator.clipboard.writeText(signupLink);
        notify("تم نسخ رابط الدعوة الرقمية!\nأرسله الآن للموظف أو العميل للتسجيل.");
    };

    const handleBulkToggle = async (action: 'activate_all' | 'suspend_all') => {
        const isSuspending = action === 'suspend_all';
        if (!confirm(`هل أنت متأكد من ${isSuspending ? 'إيقاف' : 'تنشيط'} جميع المستخدمين (ما عدا الإدارة العليا)؟`)) return;

        setIsLoading(true);
        try {
            const res = await adminUsersRequest('PATCH', { action });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            notify(result.message);
            fetchProfiles();
        } catch (error: any) {
            notify(`فشل التحديث: ${error.message}`);
            setIsLoading(false);
        }
    };

    // ==========================================
    // 5. Sidebar Integration
    // ==========================================
    useEffect(() => {
        setSidebarContent({
            actions: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                    <button onClick={() => { setSelectedProfile(null); setIsModalOpen(true); }} className="btn-main-glass gold" style={{ background: THEME.brand.gold, color: THEME.brand.coffee, border: 'none', fontWeight: 900, padding: '0.9375rem' }}>
                        إضافة مستخدم جديد
                    </button>
                    <button onClick={handleCopyInvite} className="btn-main-glass white">
                        نسخ رابط دعوة للتسجيل
                    </button>
                    <div style={{ display: 'flex', gap: '0.625rem' }}>
                        <button onClick={() => handleBulkToggle('suspend_all')} style={{ flex: 1, padding: '0.625rem', background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>
                            إيقاف الكل
                        </button>
                        <button onClick={() => handleBulkToggle('activate_all')} style={{ flex: 1, padding: '0.625rem', background: '#dcfce7', color: '#22c55e', border: '1px solid #bbf7d0', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>
                            تنشيط الكل
                        </button>
                    </div>
                    <button onClick={fetchProfiles} className="btn-main-glass white">
                        تحديث القائمة
                    </button>
                </div>
            ),
            summary: (
                <div className="summary-glass-card" style={{ borderColor: THEME.brand.gold }}>
                    <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي الفريق</span>
                    <div style={{fontSize:'var(--fs-3xl)', fontWeight:900, color: THEME.brand.gold}}>{profiles.length}</div>
                </div>
            ),
            customFilters: (
                <div style={{ marginTop: '0.625rem' }}>
                    <input 
                        type="text"
                        placeholder="ابحث بالاسم، الإيميل، أو الشريك..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, outline: 'none', transition: '0.3s' }}
                        onFocus={(e) => e.target.style.borderColor = THEME.brand.gold}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                    />
                </div>
            )
        });
        return () => setSidebarContent({ actions: null, summary: null, customFilters: null });
    }, [profiles.length, searchTerm, setSidebarContent]);

    // ==========================================
    // 6. UI Render
    // ==========================================
    return (
        <MasterPage title="إدارة الفريق والشركاء" subtitle="تحديد الرتب وتوزيع صلاحيات الوصول للمنصة بأمان">
            
            {/* 🎨 Clean CSS Styles */}
            <style>{`
                .users-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr));
                    gap: 1.5625rem;
                    padding: 0.9375rem 0;
                }
                .user-card {
                    background: rgba(255, 255, 255, 0.6);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.9);
                    border-radius: 14px;
                    padding: 2.1875rem 1.5625rem;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    position: relative;
                    overflow: hidden;
                }
                .user-card:hover {
                    transform: translateY(-8px);
                    background: #ffffff;
                    border-color: ${THEME.brand.gold};
                    box-shadow: 0 25px 50px rgba(0,0,0,0.06);
                }
                .user-card::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 0.25rem;
                    background: linear-gradient(90deg, transparent, ${THEME.brand.gold}, transparent);
                    opacity: 0; transition: 0.4s;
                }
                .user-card:hover::before { opacity: 1; }
                
                .avatar {
                    width: 5.3125rem; height: 5.3125rem; border-radius: 50%;
                    border: 4px solid white; box-shadow: 0 10px 25px rgba(0,0,0,0.08);
                    margin-bottom: 1.125rem; object-fit: cover; background: white;
                }
                .role-tag {
                    font-size: var(--fs-xs); font-weight: 900; padding: 0.375rem 1rem;
                    border-radius: 12px; display: inline-block; margin-top: 0.9375rem;
                    letter-spacing: 0.3px;
                }
                .empty-state {
                    text-align: center; padding: 5rem 1.25rem;
                    background: rgba(255,255,255,0.4); border-radius: 14px;
                    border: 2px dashed ${THEME.brand.gold}40;
                    backdrop-filter: blur(10px);
                }
            `}</style>

            {/* 🔄 Loading State */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '6.25rem', fontWeight: 900, color: THEME.brand.coffee, fontSize: 'var(--fs-xl)' }}>
                    <span style={{ display: 'block', fontSize: 'var(--fs-3xl)', marginBottom: '0.9375rem' }}><Hourglass size={26} aria-hidden="true" /></span>
                    جاري تحميل هويات الكوادر...
                </div>
            
            /* 📭 Empty State */
            ) : profiles.length === 0 ? (
                <div className="empty-state">
                    <div style={{ fontSize: 'var(--fs-display)', marginBottom: '1.25rem' }}><Sparkles size={40} aria-hidden="true" /></div>
                    <h2 style={{ fontWeight: 900, color: THEME.brand.coffee, fontSize: 'var(--fs-2xl)' }}>ابدأ ببناء فريقك الرقمي</h2>
                    <p style={{ color: '#64748b', fontWeight: 600, fontSize: 'var(--fs-lg)', marginBottom: '1.875rem' }}>لم يسجل أي مستخدم في النظام حتى الآن. شارك رابط الدعوة للبدء.</p>
                    <button onClick={handleCopyInvite} style={{ background: THEME.brand.gold, color: THEME.brand.coffee, border: 'none', padding: '1.125rem 2.5rem', borderRadius: '14px', fontSize: 'var(--fs-lg)', fontWeight: 900, cursor: 'pointer', boxShadow: `0 15px 30px ${THEME.brand.gold}30`, transition: '0.3s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                        انسخ رابط الدعوة وانطلق
                    </button>
                </div>
            
            /* 👥 Data State (Cards) */
            ) : (
                <div className="users-grid">
                    {filteredProfiles.length > 0 ? filteredProfiles.map((user) => (
                        <div key={user.id} className="user-card" onClick={() => { setSelectedProfile(user); setIsModalOpen(true); }}>
                            <img 
                                src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.full_name || user.username || 'U'}&background=random&color=fff&bold=true`} 
                                className="avatar" 
                                alt="User Avatar" 
                            />
                            <h3 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.brand.coffee }}>{user.full_name || user.nickname || 'مستخدم غير مسمى'}</h3>
                            <p style={{ margin: '0.375rem 0 0 0', fontSize: 'var(--fs-sm)', color: '#94a3b8', fontWeight: 700 }}>{user.email || user.username}</p>
                            
                            <div className="role-tag" style={{ 
                                background: user.role === 'admin' ? '#fef3c7' : user.role === 'staff' ? '#dcfce7' : user.role === 'contractor' ? '#e0f2fe' : '#f1f5f9',
                                color: user.role === 'admin' ? '#d97706' : user.role === 'staff' ? '#16a34a' : user.role === 'contractor' ? '#0369a1' : '#475569'
                            }}>
                                {user.role === 'admin' ? 'مدير نظام' : user.role === 'staff' ? 'موظف' : user.role === 'contractor' ? 'مقاول' : 'عميل'}
                            </div>

                            {/* مؤشر حالة الحساب */}
                            <div style={{ position: 'absolute', top: '0.9375rem', right: '0.9375rem', width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: user.is_active === false ? '#ef4444' : '#22c55e', boxShadow: `0 0 10px ${user.is_active === false ? '#ef4444' : '#22c55e'}`, border: '2px solid white' }} title={user.is_active === false ? 'حساب موقوف' : 'حساب نشط'} />

                            {user.partners?.name && (
                                <div style={{ marginTop: '1.125rem', fontSize: 'var(--fs-xs)', fontWeight: 900, color: THEME.brand.gold, background: `${THEME.brand.gold}15`, padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
                                    شريك: {user.partners.name}
                                </div>
                            )}
                        </div>
                    )) : (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3.125rem', color: '#94a3b8', fontWeight: 800 }}>
                            لا توجد نتائج مطابقة لبحثك
                        </div>
                    )}
                </div>
            )}

            {/* 🛡️ Editor Modal */}
            {isModalOpen && (
                <ProfileEditorModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    record={selectedProfile}
                    onSave={() => { setIsModalOpen(false); fetchProfiles(); }}
                />
            )}
        </MasterPage>
    );
}
