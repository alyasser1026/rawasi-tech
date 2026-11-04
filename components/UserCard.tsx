"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { THEME } from '@/lib/theme';
import { Crown, Gem, ShieldCheck, LogOut } from 'lucide-react';

export default function UserCard() {
    const [profile, setProfile] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // 🚀 جلب بيانات المستخدم الذاتية
    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // بنجيب الداتا من الميتا داتا أو بنحط قيم افتراضية فخمة
                setProfile({
                    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'القيادة العليا',
                    role: user.user_metadata?.role || 'super_admin',
                    avatar_url: user.user_metadata?.avatar_url || ''
                });
            }
        };
        fetchUserData();
    }, []);

    // 🖱️ إغلاق القائمة عند الضغط خارجها
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    // ⏳ الهيكل العظمي أثناء التحميل (Skeleton)
    if (!profile) return <div className="skeleton-grand"></div>;

    return (
        <div className="imperial-wrapper" ref={menuRef}>
            
            {/* 🟢 الكارت الإمبراطوري العملاق */}
            <div className={`imperial-trigger ${isOpen ? 'active' : ''}`} 
                 ref={triggerRef}
                 onClick={() => setIsOpen(!isOpen)}>
                
                <div className="imperial-info hidden-on-mobile-text">
                    <span className="u-name-grand">{profile.full_name}</span>
                    <div className="u-badge-grand">
                        <span className="crown"><Crown size={16} aria-hidden="true" /></span>
                        {profile.role === 'super_admin' ? 'رئيس مجلس الإدارة' : 
                         profile.role === 'admin' ? 'المدير التنفيذي' : 'المراقب العام'}
                    </div>
                </div>
                
                <div className="avatar-frame-grand">
                    <div className="magical-glow"></div>
                    <img 
                        src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.full_name}&background=C5A059&color=fff&bold=true&size=128`} 
                        alt="Grand Master" 
                    />
                    <div className="active-pulse-grand"></div>
                </div>
            </div>

            {/* 🔽 القائمة المنسدلة السينمائية */}
            {isOpen && (
                <div className="imperial-dropdown">
                    <div className="dropdown-title-c">
                        <p>لوحة تحكم القيادة العليا</p>
                        <small>{profile.full_name}</small>
                    </div>
                    
                    <div className="dropdown-link-g" onClick={() => { router.push('/profile'); setIsOpen(false); }}>
                        <span className="icon"><Gem size={16} aria-hidden="true" /></span> البروفايل الملكي
                    </div>
                    
                    <div className="dropdown-link-g" onClick={() => { router.push('/settings'); setIsOpen(false); }}>
                        <span className="icon"><ShieldCheck size={16} aria-hidden="true" /></span> إعدادات المنصة السيادية
                    </div>

                    <div className="imperial-divider"></div>
                    
                    <div className="dropdown-link-g logout-grand" onClick={handleLogout}>
                        <span className="icon"><LogOut size={16} aria-hidden="true" /></span> تسجيل الخروج النهائي
                    </div>
                </div>
            )}

            <style>{`
                /* 1. التموضع والحركة السينمائية الأسطورية */
                .imperial-wrapper { 
                    position: relative; 
                    z-index: 99999;
                    animation: grandFloat 5s ease-in-out infinite;
                }

                @keyframes grandFloat {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-5px) rotate(1deg); }
                }

                /* 2. الزرار العملاق */
                .imperial-trigger {
                    display: flex; align-items: center; gap: 1.25rem;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(20px);
                    padding: 0.625rem 1.5625rem 0.625rem 0.625rem; 
                    border-radius: 100px;
                    border: 2px solid rgba(255,255,255,0.8);
                    cursor: pointer; 
                    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.1), 
                                0 0 20px rgba(194,65,12, 0.15);
                }
                .imperial-trigger:hover, .imperial-trigger.active { 
                    transform: scale(1.05); 
                    border-color: ${THEME.goldAccent};
                    box-shadow: 0 20px 50px rgba(194,65,12, 0.25);
                }
                
                /* 3. النصوص الملكية */
                .imperial-info { display: flex; flex-direction: column; text-align: right; }
                .u-name-grand { 
                    font-size: var(--fs-xl); 
                    font-weight: 1000; 
                    color: #0f172a; 
                    white-space: nowrap; 
                    letter-spacing: -0.5px;
                    line-height: 1.2;
                }
                .u-badge-grand { 
                    font-size: var(--fs-sm); font-weight: 900; 
                    color: white; 
                    background: linear-gradient(135deg, #c2410c 0%, #52525b 100%);
                    padding: 0.25rem 0.75rem; border-radius: 15px; 
                    margin-top: 0.3125rem; display: flex; align-items: center; gap: 0.375rem;
                    width: fit-content; align-self: flex-end;
                    box-shadow: 0 5px 15px rgba(82,82,91, 0.3);
                }

                /* 4. صورة الصقر */
                .avatar-frame-grand { position: relative; width: 4.0625rem; height: 4.0625rem; flex-shrink: 0; }
                .avatar-frame-grand img { 
                    width: 100%; height: 100%; 
                    border-radius: 50%; object-fit: cover; 
                    border: 3px solid white; 
                    position: relative; z-index: 2;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                }
                .magical-glow {
                    position: absolute; inset: -0.5rem;
                    background: conic-gradient(from 0deg, transparent, ${THEME.goldAccent}, transparent);
                    border-radius: 50%;
                    animation: rotateGlow 3s linear infinite;
                    z-index: 1; opacity: 0.6;
                }
                @keyframes rotateGlow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .active-pulse-grand { 
                    position: absolute; bottom: 0.25rem; right: 0.25rem; 
                    width: 1rem; height: 1rem; 
                    background: #10b981; 
                    border: 3px solid white; border-radius: 50%; 
                    box-shadow: 0 0 15px rgba(16, 185, 129, 0.8);
                    z-index: 3;
                }

                /* 5. القائمة المنسدلة (Supreme Menu) */
                .imperial-dropdown {
                    position: absolute; top: 120%; left: 0; width: 20rem;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(25px);
                    border-radius: 14px; padding: 1.5625rem;
                    box-shadow: 0 30px 80px rgba(0,0,0,0.2);
                    border: 2px solid rgba(194,65,12, 0.2);
                    z-index: 100000; 
                    transform-origin: top left;
                    animation: supremeShow 0.5s cubic-bezier(0.68, -0.6, 0.32, 1.6);
                }
                @keyframes supremeShow {
                    from { opacity: 0; transform: scale(0.6) rotate(-5deg) translateY(-30px); }
                    to { opacity: 1; transform: scale(1) rotate(0) translateY(0); }
                }

                .dropdown-title-c { padding-bottom: 0.9375rem; text-align: right; }
                .dropdown-title-c p { margin: 0; font-weight: 1000; font-size: var(--fs-xl); color: #0f172a; }
                .dropdown-title-c small { color: ${THEME.goldAccent}; font-weight: 800; font-size: var(--fs-sm); }

                .dropdown-link-g {
                    display: flex; align-items: center; gap: 0.9375rem;
                    padding: 1rem 1.25rem; border-radius: 14px;
                    font-size: var(--fs-lg); font-weight: 900; color: #475569;
                    cursor: pointer; transition: 0.3s; direction: rtl;
                }
                .dropdown-link-g:hover { 
                    background: #f8fafc; color: ${THEME.goldAccent}; 
                    transform: translateX(-10px) scale(1.02); 
                }
                .logout-grand { color: #ef4444 !important; background: #fff1f2; margin-top: 0.9375rem; }
                .logout-grand:hover { background: #ef4444 !important; color: white !important; }
                
                .imperial-divider { height: 2px; background: #f1f5f9; margin: 0.9375rem 0; border-radius: 10px; }
                .skeleton-grand { width: 15.625rem; height: 5rem; background: rgba(226, 232, 240, 0.5); border-radius: 100px; animation: pulse 2s infinite; }

                /* تجاوب الموبايل (إخفاء النص في الشاشات الصغيرة وترك الصورة المضيئة فقط) */
                @media (max-width: 768px) {
                    .hidden-on-mobile-text { display: none !important; }
                    .imperial-trigger { padding: 0.3125rem; gap: 0; }
                    .avatar-frame-grand { width: 3.4375rem; height: 3.4375rem; }
                    .imperial-dropdown { width: 17.5rem; right: -3.125rem; left: auto; transform-origin: top right; }
                }
            `}</style>
        </div>
    );
}