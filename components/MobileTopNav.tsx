"use client";
import React from 'react';
import { THEME } from '@/lib/theme';

interface MobileTopNavProps {
    title: string;
    subtitle?: string;
}

export default function MobileTopNav({ title, subtitle }: MobileTopNavProps) {
    const handleToggleSidebar = () => {
        // 🚀 الكود ده بيضيف كلاس للـ body عشان السايد بار يفتح (حسب مكتبة فاي تك)
        document.body.classList.toggle('mobile-sidebar-active');
    };

    return (
        <>
            <style>{`
                /* إخفاء البار في الشاشات الكبيرة */
                .mobile-top-nav { display: none; }
                
                /* إظهار وتنسيق البار في الجوال فقط */
                @media (max-width: 768px) {
                    .mobile-top-nav {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 15px 20px;
                        background: rgba(255, 255, 255, 0.75);
                        backdrop-filter: blur(25px);
                        border-bottom: 1px solid rgba(255,255,255,0.6);
                        position: sticky;
                        top: 0;
                        z-index: 1000;
                        border-radius: 0 0 24px 24px;
                        margin: -10px -10px 20px -10px; /* لتغطية الحواف */
                        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
                    }
                    .mobile-menu-btn {
                        background: linear-gradient(135deg, ${THEME.primary}, #0f172a);
                        border: none;
                        border-radius: 12px;
                        width: 40px;
                        height: 40px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 20px;
                        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                        cursor: pointer;
                        transition: 0.2s;
                    }
                    .mobile-menu-btn:active { transform: scale(0.9); }
                }
            `}</style>

            <div className="mobile-top-nav">
                <div>
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: THEME.primary }}>{title}</h1>
                    {subtitle && <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800 }}>{subtitle}</p>}
                </div>
                <button className="mobile-menu-btn" onClick={handleToggleSidebar}>
                    ☰
                </button>
            </div>
        </>
    );
}