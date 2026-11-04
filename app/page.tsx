"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { THEME } from '@/lib/theme';
import { usePermissions } from '@/lib/PermissionsContext';
import SecureAction from '@/components/SecureAction';
import LoadingScreen from '@/components/LoadingScreen';
import MasterPage from '@/components/MasterPage';
import { menuGroups } from '@/lib/menuData';
import { getSectionStyle } from '@/lib/section-colors';
import { Plus } from 'lucide-react';
import { MenuIcon } from '@/components/NavigationIcon';
import { useDisplayName } from '@/hooks/useDisplayName';

const MOTIVATIONAL_MESSAGES = [
    "يوم جديد لنجاحات مبهرة، توكل على الله وانطلق!",
    "النجاح يبدأ بخطوة، وأنت الآن في المسار الصحيح!",
    "الأرقام لا تكذب، اجعل أرقام اليوم أفضل من الأمس!",
    "كل مجهود صغير يتراكم ليصنع إنجازاً عظيماً!",
    "فاي تك تكبر بجهودكم، شكراً لعملكم الرائع!",
    "الدقة في العمل هي أساس الثقة، حافظ على تميزك!",
    "اجعل هدفك اليوم هو التميز، لا مجرد الإنجاز!",
    "لا حدود لما يمكنك تحقيقه اليوم، انطلق بثقة!",
    "من جدّ وجد، ومن زرع حصد! العمل الجاد لا يخون!",
    "بثقتنا بالله وبجهودكم، نحن نبني المستقبل!"
];

const DEFAULT_FAVORITES = ['global_summary', 'dashboard', 'journal', 'accounts', 'projects'];

export default function WelcomeHomePage() {
    const { role, can, loading: permsLoading, profile } = usePermissions();
    const [greeting, setGreeting] = useState('');
    const [quote, setQuote] = useState('');
    const [favorites, setFavorites] = useState<string[]>([]);
    const [isFavModalOpen, setIsFavModalOpen] = useState(false);
    const [tempFavorites, setTempFavorites] = useState<string[]>([]);

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('صباح الخير');
        else if (hour < 18) setGreeting('طاب مساؤك');
        else setGreeting('مساء الخير');

        setQuote(MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]);
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem('rawasi_fav_pages');
        if (saved) {
            setFavorites(JSON.parse(saved));
        } else {
            setFavorites(DEFAULT_FAVORITES);
        }
    }, [profile?.id]);

    const saveFavorites = () => {
        setFavorites(tempFavorites);
        localStorage.setItem('rawasi_fav_pages', JSON.stringify(tempFavorites));
        setIsFavModalOpen(false);
    };

    const openFavModal = () => {
        setTempFavorites(favorites);
        setIsFavModalOpen(true);
    };

    const toggleFav = (id: string) => {
        if (tempFavorites.includes(id)) {
            setTempFavorites(tempFavorites.filter(f => f !== id));
        } else {
            setTempFavorites([...tempFavorites, id]);
        }
    };

    if (permsLoading) {
        return <LoadingScreen message="جاري تحضير مساحة العمل..." fullScreen={false} />;
    }

    const displayName = useDisplayName();
    const firstNameOnly = displayName.firstName;
    const roleTitle = role === 'super_admin' ? 'المدير العام' : role === 'admin' ? 'مدير النظام' : 'مستخدم النظام';

    // مسطح لعناصر القائمة لسهولة البحث
    const allItems = menuGroups.flatMap(g => g.items);
    
    // العناصر المسموح للمستخدم رؤيتها
    const allowedItems = allItems.filter(item => {
        if (role === 'super_admin' || role === 'admin') return true;
        if (['home', 'profile', 'messages', 'notifications'].includes(item.id)) return true;
        return can(item.id, 'view');
    });

    const favItems = favorites.flatMap(id => {
        const item = allowedItems.find(i => i.id === id);
        return item ? [item] : [];
    });

    return (
        <MasterPage title="الصفحة الرئيسية" subtitle="بوابة الإدارة المركزية لفاي تك">
        <div className="welcome-page-wrapper">
            <style>{`
                .welcome-page-wrapper {
                    padding: 30px;
                    direction: rtl;
                    min-height: calc(100vh - 80px);
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                    background: radial-gradient(circle at top right, rgba(194,65,12, 0.05), transparent 400px),
                                radial-gradient(circle at bottom left, rgba(39,39,42, 0.03), transparent 400px);
                }

                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .hero-glass-card {
                    background: rgba(255,255,255,0.7);
                    backdrop-filter: blur(25px);
                    border: 1px solid rgba(255,255,255,1);
                    border-radius: 14px;
                    padding: 50px 40px;
                    text-align: center;
                    box-shadow: 0 15px 50px rgba(0,0,0,0.03), inset 0 0 0 1px rgba(255,255,255,0.5);
                    animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    position: relative;
                    overflow: hidden;
                }
                .hero-glass-card::before {
                    content: ''; position: absolute; top: 0; right: 0; left: 0; height: 5px;
                    background: linear-gradient(90deg, ${THEME.goldAccent}, ${THEME.coffeeDark});
                }

                .welcome-title {
                    font-size: var(--fs-3xl);
                    font-weight: 900;
                    color: ${THEME.coffeeDark};
                    margin: 0 0 15px 0;
                    letter-spacing: -1px;
                }
                
                .welcome-profile-hint { margin: -10px 0 24px; font-size: var(--fs-sm); color: #687180; }
                .welcome-profile-hint a { color: #c2410c; font-weight: 800; text-decoration: none; }
                .welcome-profile-hint a:hover { text-decoration: underline; }
                .welcome-subtitle {
                    color: #64748b;
                    font-size: var(--fs-xl);
                    font-weight: 700;
                    max-width: 600px;
                    margin: 0 auto 40px auto;
                    line-height: 1.7;
                    font-style: italic;
                }

                .modules-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 20px;
                    max-width: 1100px;
                    margin: 0 auto;
                }

                .module-card {
                    background: white;
                    border: 1px solid #f1f5f9;
                    border-radius: 14px;
                    padding: 30px 20px;
                    text-align: center;
                    text-decoration: none;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.02);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                    position: relative;
                    overflow: hidden;
                }
                .module-card::after {
                    content: ''; position: absolute; inset: 0;
                    background: linear-gradient(135deg, rgba(194,65,12, 0.1), transparent);
                    opacity: 0; transition: 0.3s;
                }
                .module-card:hover {
                    transform: translateY(-10px) scale(1.02);
                    box-shadow: 0 20px 40px rgba(194,65,12, 0.1);
                    border-color: ${THEME.goldAccent};
                }
                .module-card:hover::after { opacity: 1; }
                
                .module-icon {
                    width: 70px; height: 70px;
                    background: #f8fafc;
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: var(--fs-3xl);
                    transition: 0.3s;
                    position: relative; z-index: 1;
                }
                .module-card:hover .module-icon {
                    background: ${THEME.goldAccent}20;
                    transform: rotate(10deg) scale(1.15);
                }
                .module-title { color: ${THEME.coffeeDark}; font-weight: 900; font-size: var(--fs-lg); margin: 0; position: relative; z-index: 1; }

                .add-fav-card {
                    background: transparent;
                    border: 2px dashed #cbd5e1;
                    border-radius: 14px;
                    padding: 30px 20px;
                    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px;
                    cursor: pointer; transition: 0.3s;
                }
                .add-fav-card:hover {
                    border-color: ${THEME.goldAccent};
                    background: rgba(194,65,12, 0.05);
                    transform: translateY(-5px);
                }
                .add-fav-icon { font-size: var(--fs-3xl); color: #cbd5e1; transition: 0.3s; }
                .add-fav-card:hover .add-fav-icon { color: ${THEME.goldAccent}; transform: scale(1.2); }
                .add-fav-title { font-weight: 800; color: #94a3b8; font-size: var(--fs-lg); transition: 0.3s; }
                .add-fav-card:hover .add-fav-title { color: ${THEME.goldAccent}; }

                /* Fav Modal Styles */
                .fav-modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
                    z-index: 99999; display: flex; align-items: center; justify-content: center;
                    animation: fadeIn 0.3s ease;
                }
                .fav-modal {
                    background: white; border-radius: 14px; width: 90%; max-width: 700px; max-height: 85vh;
                    display: flex; flex-direction: column; overflow: hidden;
                    box-shadow: 0 25px 50px rgba(0,0,0,0.25);
                    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .fav-modal-header {
                    padding: 20px 25px; border-bottom: 1px solid #f1f5f9;
                    display: flex; justify-content: space-between; align-items: center;
                    background: #f8fafc;
                }
                .fav-modal-content {
                    padding: 25px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;
                }
                .fav-modal-footer {
                    padding: 20px 25px; border-top: 1px solid #f1f5f9;
                    display: flex; justify-content: flex-end; gap: 10px; background: #f8fafc;
                }
                
                .fav-group-title { font-weight: 900; color: ${THEME.coffeeDark}; margin-bottom: 10px; font-size: var(--fs-lg); border-bottom: 2px solid #f1f5f9; padding-bottom: 5px; }
                .fav-items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
                
                .fav-item-check {
                    display: flex; align-items: center; gap: 10px; padding: 12px 15px;
                    border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: 0.2s;
                }
                .fav-item-check:hover { background: #f8fafc; border-color: #cbd5e1; }
                .fav-item-check.selected { border-color: ${THEME.goldAccent}; background: rgba(194,65,12, 0.05); }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

                @media (max-width: 768px) {
                    .hero-glass-card { padding: 30px 20px; border-radius: 14px; }
                    .welcome-title { font-size: var(--fs-2xl); }
                    .welcome-subtitle { font-size: var(--fs-md); }
                    .modules-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
                    .module-card { padding: 20px 10px; }
                    .module-icon { width: 50px; height: 50px; font-size: var(--fs-2xl); }
                    .module-title { font-size: var(--fs-md); }
                }
            `}</style>

            <div className="hero-glass-card">
                <div style={{ display: 'inline-block', padding: '8px 20px', background: `${THEME.goldAccent}20`, color: THEME.coffeeDark, borderRadius: '14px', fontWeight: 900, fontSize: 'var(--fs-md)', marginBottom: '20px' }}>
                    {roleTitle}
                </div>

                <h1 className="welcome-title">{greeting}، {firstNameOnly}</h1>
                <p className="welcome-subtitle">{quote}</p>
                {!permsLoading && !displayName.hasProfileName && <p className="welcome-profile-hint">لم تُكمل اسمك في الملف الشخصي بعد. <Link href="/profile">أكمل بياناتك</Link> ليظهر اسمك في التحيات والتقارير.</p>}

                <div style={{ textAlign: 'right', marginBottom: '15px' }}>
                    <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.coffeeDark }}>الصفحات المفضلة</h2>
                </div>

                <div className="modules-grid">
                    {favItems.map((item, idx) => (
                        <Link key={idx} href={item.path} className="module-card" style={getSectionStyle(item.path)}>
                            <div className="module-icon"><MenuIcon id={item.id} size={24} /></div>
                            <h3 className="module-title">{item.title}</h3>
                        </Link>
                    ))}

                    <button type="button" className="add-fav-card" onClick={openFavModal}>
                        <div className="add-fav-icon"><Plus size={16} aria-hidden="true" /></div>
                        <div className="add-fav-title">تخصيص المفضلة</div>
                    </button>
                </div>
            </div>

            {/* Fav Modal */}
            {isFavModalOpen && (
                <div className="fav-modal-overlay" onClick={() => setIsFavModalOpen(false)}>
                    <div className="fav-modal" onClick={e => e.stopPropagation()}>
                        <div className="fav-modal-header">
                            <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.coffeeDark }}>تخصيص الصفحات المفضلة</h2>
                            <button onClick={() => setIsFavModalOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 'var(--fs-xl)', cursor: 'pointer' }}>✖</button>
                        </div>
                        <div className="fav-modal-content">
                            {menuGroups.map((group, gIdx) => {
                                const groupAllowedItems = group.items.filter(item => allowedItems.some(ai => ai.id === item.id));
                                if (groupAllowedItems.length === 0) return null;
                                return (
                                    <div key={gIdx}>
                                        <div className="fav-group-title">{group.group}</div>
                                        <div className="fav-items-grid">
                                            {groupAllowedItems.map((item, iIdx) => {
                                                const isSelected = tempFavorites.includes(item.id);
                                                return (
                                                    <div 
                                                        key={iIdx} 
                                                        className={`fav-item-check ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => toggleFav(item.id)}
                                                    >
                                                        <div style={{ display: 'inline-flex', color: THEME.goldAccent }}><MenuIcon id={item.id} size={20} /></div>
                                                        <div style={{ fontWeight: 800, color: '#1e293b', flex: 1 }}>{item.title}</div>
                                                        <div style={{ width: '20px', height: '20px', borderRadius: '5px', border: `2px solid ${isSelected ? THEME.goldAccent : '#cbd5e1'}`, background: isSelected ? THEME.goldAccent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {isSelected && <span style={{ color: 'white', fontSize: 'var(--fs-md)' }}>✔</span>}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="fav-modal-footer">
                            <button onClick={() => setIsFavModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#475569', fontWeight: 800, cursor: 'pointer' }}>إلغاء</button>
                            <button onClick={saveFavorites} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: THEME.goldAccent, color: 'white', fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 10px ${THEME.goldAccent}60` }}>حفظ التغييرات</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 'var(--fs-sm)', paddingBottom: '10px' }}>
                تم تأمين الجلسة الخاصة بك | فاي تك © {new Date().getFullYear()}
            </div>
        </div>
        </MasterPage>
    );
}
