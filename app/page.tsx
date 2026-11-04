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
                    padding: 1.875rem;
                    direction: rtl;
                    min-height: calc(100vh - 5rem);
                    display: flex;
                    flex-direction: column;
                    gap: 1.875rem;
                }

                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .hero-glass-card {
                    background: var(--surface-card);
                    border: none;
                    border-radius: 28px;
                    padding: 3.125rem 2.5rem;
                    text-align: center;
                    box-shadow: var(--shadow-ambient);
                    animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    position: relative;
                    overflow: hidden;
                }
                .hero-glass-card::before {
                    content: ''; position: absolute; top: 0; right: 10%; left: 10%; height: 2px;
                    background: var(--specular-beam);
                }

                .welcome-title {
                    font-size: var(--fs-3xl);
                    font-weight: 900;
                    color: var(--text-primary);
                    margin: 0 0 0.9375rem 0;
                    letter-spacing: -1px;
                }
                
                .welcome-profile-hint { margin: -0.625rem 0 1.5rem; font-size: var(--fs-sm); color: var(--text-secondary); }
                .welcome-profile-hint a { color: var(--accent-main); font-weight: 800; text-decoration: none; }
                .welcome-profile-hint a:hover { text-decoration: underline; }
                .welcome-subtitle {
                    color: var(--text-secondary);
                    font-size: var(--fs-xl);
                    font-weight: 700;
                    max-width: 37.5rem;
                    margin: 0 auto 2.5rem auto;
                    line-height: 1.7;
                    font-style: italic;
                }

                .modules-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(11.25rem, 1fr));
                    gap: 1.25rem;
                    max-width: 68.75rem;
                    margin: 0 auto;
                }

                .module-card {
                    background: var(--surface-card);
                    border: none;
                    border-radius: 22px;
                    padding: 1.875rem 1.25rem;
                    text-align: center;
                    text-decoration: none;
                    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: var(--shadow-elevation);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.9375rem;
                    position: relative;
                    overflow: hidden;
                }
                .module-card::before {
                    content: ''; position: absolute; top: 0; left: 15%; right: 15%; height: 1.5px;
                    background: var(--specular-beam-soft); pointer-events: none;
                }
                .module-card:hover {
                    transform: translateY(-6px);
                    box-shadow: var(--shadow-ambient);
                    background: var(--surface-card-hover);
                }
                
                .module-icon {
                    width: 4.375rem; height: 4.375rem;
                    background: var(--surface-sunken);
                    box-shadow: var(--shadow-sunken);
                    color: var(--accent-main);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: var(--fs-3xl);
                    transition: 0.3s;
                    position: relative; z-index: 1;
                }
                .module-card:hover .module-icon {
                    transform: scale(1.1);
                    color: var(--accent-bright);
                }
                .module-title { color: var(--text-primary); font-weight: 800; font-size: var(--fs-lg); margin: 0; position: relative; z-index: 1; }

                .add-fav-card {
                    background: var(--surface-subcard);
                    border: 1.5px dashed var(--accent-glow);
                    border-radius: 22px;
                    padding: 1.875rem 1.25rem;
                    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.9375rem;
                    cursor: pointer; transition: 0.3s;
                    box-shadow: var(--shadow-elevation);
                }
                .add-fav-card:hover {
                    border-color: var(--accent-main);
                    background: var(--surface-card-hover);
                    transform: translateY(-5px);
                }
                .add-fav-icon { font-size: var(--fs-3xl); color: var(--text-secondary); transition: 0.3s; }
                .add-fav-card:hover .add-fav-icon { color: var(--accent-main); transform: scale(1.2); }
                .add-fav-title { font-weight: 800; color: var(--text-secondary); font-size: var(--fs-lg); transition: 0.3s; }
                .add-fav-card:hover .add-fav-title { color: var(--accent-main); }

                /* Fav Modal Styles */
                .fav-modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(16px);
                    z-index: 99999; display: flex; align-items: center; justify-content: center;
                    animation: fadeIn 0.3s ease;
                }
                .fav-modal {
                    background: var(--surface-card); border-radius: 24px; width: 90%; max-width: 43.75rem; max-height: 85vh;
                    display: flex; flex-direction: column; overflow: hidden;
                    border: none;
                    box-shadow: var(--shadow-elevation);
                    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    position: relative;
                }
                .fav-modal-header {
                    padding: 1.25rem 1.5625rem; border-bottom: 1px solid var(--table-zebra-bg);
                    display: flex; justify-content: space-between; align-items: center;
                    background: var(--surface-subcard);
                }
                .fav-modal-content {
                    padding: 1.5625rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1.25rem;
                }
                .fav-modal-footer {
                    padding: 1.25rem 1.5625rem; border-top: 1px solid var(--table-zebra-bg);
                    display: flex; justify-content: flex-end; gap: 0.625rem; background: var(--surface-subcard);
                }
                
                .fav-group-title { font-weight: 900; color: var(--text-primary); margin-bottom: 0.625rem; font-size: var(--fs-lg); border-bottom: 2px solid var(--table-zebra-bg); padding-bottom: 0.3125rem; }
                .fav-items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr)); gap: 0.625rem; }
                
                .fav-item-check {
                    display: flex; align-items: center; gap: 0.625rem; padding: 0.75rem 0.9375rem;
                    border: none; border-radius: 14px; cursor: pointer; transition: 0.2s;
                    background: var(--surface-sunken);
                    box-shadow: var(--shadow-sunken);
                }
                .fav-item-check:hover { background: var(--surface-card-hover); }
                .fav-item-check.selected { box-shadow: var(--shadow-sunken), 0 0 0 2px var(--accent-glow); background: var(--accent-soft-bg); }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

                @media (max-width: 768px) {
                    .hero-glass-card { padding: 1.875rem 1.25rem; border-radius: 20px; }
                    .welcome-title { font-size: var(--fs-2xl); }
                    .welcome-subtitle { font-size: var(--fs-md); }
                    .modules-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
                    .module-card { padding: 1.25rem 0.625rem; }
                    .module-icon { width: 3.125rem; height: 3.125rem; font-size: var(--fs-2xl); }
                    .module-title { font-size: var(--fs-md); }
                }
            `}</style>

            <div className="hero-glass-card">
                <div style={{ display: 'inline-block', padding: '0.5rem 1.25rem', background: 'var(--accent-soft-bg)', color: 'var(--accent-main)', borderRadius: '14px', fontWeight: 900, fontSize: 'var(--fs-md)', marginBottom: '1.25rem', boxShadow: '0 4px 14px var(--accent-glow)' }}>
                    {roleTitle}
                </div>

                <h1 className="welcome-title">{greeting}، {firstNameOnly}</h1>
                <p className="welcome-subtitle">{quote}</p>
                {!permsLoading && !displayName.hasProfileName && <p className="welcome-profile-hint">لم تُكمل اسمك في الملف الشخصي بعد. <Link href="/profile">أكمل بياناتك</Link> ليظهر اسمك في التحيات والتقارير.</p>}

                <div style={{ textAlign: 'right', marginBottom: '0.9375rem' }}>
                    <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)' }}>الصفحات المفضلة</h2>
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
                            <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)' }}>تخصيص الصفحات المفضلة</h2>
                            <button onClick={() => setIsFavModalOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 'var(--fs-xl)', cursor: 'pointer', color: 'var(--text-secondary)' }}>✖</button>
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
                                                        <div style={{ display: 'inline-flex', color: 'var(--accent-main)' }}><MenuIcon id={item.id} size={20} /></div>
                                                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', flex: 1 }}>{item.title}</div>
                                                        <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '5px', border: `2px solid ${isSelected ? 'var(--accent-main)' : 'var(--text-muted)'}`, background: isSelected ? 'var(--accent-main)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                            <button onClick={() => setIsFavModalOpen(false)} style={{ padding: '0.625rem 1.25rem', borderRadius: '12px', border: 'none', background: 'var(--surface-sunken)', color: 'var(--text-secondary)', fontWeight: 800, cursor: 'pointer' }}>إلغاء</button>
                            <button onClick={saveFavorites} style={{ padding: '0.625rem 1.25rem', borderRadius: '12px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 10px var(--accent-glow)' }}>حفظ التغييرات</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--fs-sm)', paddingBottom: '0.625rem' }}>
                تم تأمين الجلسة الخاصة بك | فاي تك © {new Date().getFullYear()}
            </div>
        </div>
        </MasterPage>
    );
}
