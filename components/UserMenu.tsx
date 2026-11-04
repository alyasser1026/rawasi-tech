"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { THEME } from '@/lib/theme';
import { Crown, Gem, ShieldCheck, LogOut } from 'lucide-react';

export default function UserCard() {
    // 🚀 تحويله لمكون ذكي بيجيب بياناته بنفسه
    const [profile, setProfile] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // 📥 جلب بيانات المستخدم السيادي أوتوماتيكياً
    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
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
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    // ⏳ الهيكل العظمي أثناء التحميل
    if (!profile) return <div className="skeleton-grand"></div>;

    return (
        <div className="imperial-wrapper" ref={menuRef}>
            
            {/* 🟢 الكارت الإمبراطوري العملاق */}
            <div className={`imperial-trigger ${isOpen ? 'active' : ''}`} 
                 ref={triggerRef}
                 onClick={() => setIsOpen(!isOpen)}>
                
                {/* 📱 إضافة كلاس hidden-on-mobile-text لإخفاء النص في الموبايل */}
                <div className="imperial-info hidden-on-mobile-text">
                    <span className="u-name-grand">{profile.full_name}</span>
                    <div className="u-badge-grand">
                        <span className="crown"><Crown size={16} aria-hidden="true" /></span>
                        {profile.role === 'super_admin' ? 'رئيس مجلس الإدارة' : 'المدير التنفيذي'}
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

            {/* 🎨 نفس ستايلاتك العظمة بالظبط مع تعديل بسيط للموبايل في الآخر */}
            <style>{`
                /* 1. التموضع والحركة السينمائية الأسطورية */
                .imperial-wrapper { 
                    position: relative; 
                    z-index: 99999;
                    animation: grandFloat 5s ease-in-out infinite;
                }

                @keyframes grandFloat {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-5px) rotate(1deg); } /* قللت الحركة شوية عشان السايد بار */
                }

                /* 2. الزرار العملاق (أكبر حجم في السيستم) */
                .imperial-trigger {
                    display: flex; align-items: center; gap: 20px;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(40px);
                    padding: 10px 30px 10px 15px; 
                    border-radius: 100px;
                    border: 3px solid rgba(255,255,255,0.8);
                    cursor: pointer; 
                    transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 20px 50px rgba(0,0,0,0.1), 
                                0 0 30px rgba(194,65,12, 0.15);
                }
                .imperial-trigger:hover, .imperial-trigger.active { 
                    transform: scale(1.05); 
                    border-color: ${THEME.goldAccent};
                    box-shadow: 0 30px 80px rgba(194,65,12, 0.25);
                }
                
                /* 3. النصوص الملكية */
                .imperial-info { display: flex; flex-direction: column; text-align: right; }
                .u-name-grand { 
                    font-size: 22px; 
                    font-weight: 1000; 
                    color: #0f172a; 
                    white-space: nowrap; 
                    letter-spacing: -1px;
                    line-height: 1;
                }
                .u-badge-grand { 
                    font-size: 13px; font-weight: 900; 
                    color: white; 
                    background: linear-gradient(135deg, #c2410c 0%, #52525b 100%);
                    padding: 6px 15px; border-radius: 15px; 
                    margin-top: 6px; display: flex; align-items: center; gap: 8px;
                    width: fit-content; align-self: flex-end;
                    box-shadow: 0 10px 20px rgba(82,82,91, 0.3);
                }

                /* 4. صورة الصقر */
                .avatar-frame-grand { position: relative; width: 75px; height: 75px; flex-shrink: 0; }
                .avatar-frame-grand img { 
                    width: 100%; height: 100%; 
                    border-radius: 50%; object-fit: cover; 
                    border: 4px solid white; 
                    position: relative; z-index: 2;
                    box-shadow: 0 15px 30px rgba(0,0,0,0.2);
                }
                .magical-glow {
                    position: absolute; inset: -10px;
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
                    position: absolute; bottom: 5px; right: 5px; 
                    width: 20px; height: 20px; 
                    background: #10b981; 
                    border: 4px solid white; border-radius: 50%; 
                    box-shadow: 0 0 20px rgba(16, 185, 129, 0.8);
                    z-index: 3;
                }

                /* 5. القائمة المنسدلة (Supreme Menu) */
                .imperial-dropdown {
                    position: absolute; top: 110%; left: 0; width: 340px;
                    background: rgba(255, 255, 255, 0.98);
                    backdrop-filter: blur(30px);
                    border-radius: 14px; padding: 25px;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.3);
                    border: 2px solid rgba(194,65,12, 0.2);
                    z-index: 100000; 
                    transform-origin: top left;
                    animation: supremeShow 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6);
                }
                @keyframes supremeShow {
                    from { opacity: 0; transform: scale(0.5) rotate(-10deg) translateY(-40px); }
                    to { opacity: 1; transform: scale(1) rotate(0) translateY(0); }
                }

                .dropdown-title-c { padding-bottom: 20px; text-align: right; }
                .dropdown-title-c p { margin: 0; font-weight: 1000; font-size: 18px; color: #0f172a; }
                .dropdown-title-c small { color: ${THEME.goldAccent}; font-weight: 800; font-size: 13px; }

                .dropdown-link-g {
                    display: flex; align-items: center; gap: 20px;
                    padding: 18px 25px; border-radius: 14px;
                    font-size: 16px; font-weight: 900; color: #475569;
                    cursor: pointer; transition: 0.3s; direction: rtl;
                }
                .dropdown-link-g:hover { 
                    background: #f8fafc; color: ${THEME.goldAccent}; 
                    transform: translateX(-15px) scale(1.05); 
                }
                .logout-grand { color: #ef4444 !important; background: #fff1f2; margin-top: 20px; }
                .logout-grand:hover { background: #ef4444 !important; color: white !important; }
                
                .imperial-divider { height: 3px; background: #f1f5f9; margin: 15px 0; border-radius: 10px; }
                .skeleton-grand { width: 280px; height: 100px; background: rgba(238, 238, 238, 0.5); border-radius: 100px; animation: pulse 2s infinite; }

                /* 6. التجاوب مع الموبايل (إخفاء النص وترك الصورة السيادية فقط) */
                @media (max-width: 768px) {
                    .hidden-on-mobile-text { display: none !important; }
                    .imperial-trigger { padding: 5px; gap: 0; border-radius: 50%; border: none; background: transparent; box-shadow: none; }
                    .avatar-frame-grand { width: 55px; height: 55px; }
                    .imperial-dropdown { width: 280px; left: auto; right: -10px; transform-origin: top right; }
                }
            `}</style>
        </div>
    );
}