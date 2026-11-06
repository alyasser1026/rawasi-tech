"use client";
import React, { useState } from 'react';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { useFieldOpsLogic } from './field_ops_logic';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import LoadingScreen from '@/components/LoadingScreen';
import FieldRadarMap from '@/components/maps/FieldRadarMap';
import { LayoutGrid, MapPin, Building2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function FieldOperationsPage() {
    const logic = useFieldOpsLogic();
    const router = useRouter();
    const [activeView, setActiveView] = useState<'grid' | 'map'>('grid');

    const sidebarContent = (
        <div className="summary-glass-card">
            <h4 style={{ color: THEME.coffeeDark, margin: '0 0 0.9375rem 0', fontSize: 'var(--fs-md)' }}>نبض الميدان - اليوم</h4>
            <div style={styles.sideStat}>
                <span>إجمالي العمالة بالمواقع</span>
                <strong>{logic.companyTotals.totalWorkers} عامل</strong>
            </div>
            <div style={styles.sideStat}>
                <span>إجمالي المنصرف اليومي</span>
                <strong style={{ color: THEME.accent }}>{formatCurrency(logic.companyTotals.totalCost)}</strong>
            </div>
            <div style={styles.sideStat}>
                <span>المشاريع الميدانية النشطة</span>
                <strong style={{ color: THEME.primary }}>{logic.projectStats.length} مشروع</strong>
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', marginTop: '1.25rem', textAlign: 'center' }}>
                تحديث تلقائي: {logic.today}
            </p>
        </div>
    );

    const handleSelectProject = (projectId: string) => {
        router.push(`/projects`);
    };

    return (
        <div className="clean-page">
            <MasterPage title="رادار الميدان الحي" subtitle="متابعة لحظية للعمالة، التكاليف، والتقدم الإنشائي وتغطية الخرائط الجغرافية">
                
                <RawasiSidebarManager 
                    summary={sidebarContent}
                    watchDeps={[logic.companyTotals]}
                />

                <style>{`
                    .field-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr)); gap: 1.5625rem; padding: 0.625rem; }
                    .site-card { background: rgba(255,255,255,0.7); backdrop-filter: blur(15px); border-radius: 14px; padding: 1.5625rem; border: 1px solid rgba(255,255,255,0.8); transition: 0.3s; position: relative; overflow: hidden; }
                    .site-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.1); }
                    .stat-badge { background: #f1f5f9; padding: 0.625rem 0.9375rem; border-radius: 16px; text-align: center; }
                    .task-pill { background: ${THEME.coffeeDark}; color: white; padding: 0.25rem 0.625rem; border-radius: 6px; font-size: var(--fs-xs); font-weight: 800; }
                    .summary-glass-card { background: rgba(255, 255, 255, 0.1); padding: 1.25rem; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.2); }
                    .view-switch-tab { display: inline-flex; background: rgba(0,0,0,0.06); padding: 4px; border-radius: 12px; margin-bottom: 1.25rem; gap: 4px; }
                    .view-switch-btn { border: none; background: transparent; padding: 8px 16px; border-radius: 10px; font-weight: 800; font-size: var(--fs-xs, 12px); cursor: pointer; display: flex; align-items: center; gap: 6px; color: #64748b; transition: all 0.2s ease; }
                    .view-switch-btn.active { background: #fff; color: ${THEME.primary}; box-shadow: 0 4px 12px rgba(0,0,0,0.08); font-weight: 900; }
                `}</style>

                {/* View Switcher Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '0.9375rem' }}>
                    <div className="view-switch-tab">
                        <button 
                            className={`view-switch-btn ${activeView === 'grid' ? 'active' : ''}`}
                            onClick={() => setActiveView('grid')}
                        >
                            <LayoutGrid size={15} />
                            شبكة بطاقات المواقع ({logic.projectStats.length})
                        </button>
                        <button 
                            className={`view-switch-btn ${activeView === 'map' ? 'active' : ''}`}
                            onClick={() => setActiveView('map')}
                        >
                            <MapPin size={15} />
                            رادار الخريطة والتغطية الجغرافية 🗺️
                        </button>
                    </div>

                    {activeView === 'map' && (
                        <div style={{ fontSize: 'var(--fs-xs, 12px)', color: '#64748b', fontWeight: 800 }}>
                            مفتوح المصدر بالكامل (OpenStreetMap / Leaflet) • مجاني 100% بدون أي فواتير أو اشتراكات
                        </div>
                    )}
                </div>

                {logic.isLoading ? (
                    <LoadingScreen message="جاري مسح المواقع وحساب التكاليف..." fullScreen={false} />
                ) : activeView === 'map' ? (
                    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        <FieldRadarMap 
                            projects={logic.projectStats}
                            siteVisits={logic.siteVisits}
                            onSelectProject={handleSelectProject}
                            height="660px"
                        />
                    </div>
                ) : (
                    <div className="field-grid">
                        {logic.projectStats.map(site => (
                            <div key={site.id} className="site-card">
                                {/* الهيدر */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900 }}>{site.Property}</h3>
                                        <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>العميل: {site.client?.name || '---'}</span>
                                    </div>
                                    <div style={{ background: THEME.success + '20', color: THEME.success, padding: '0.3125rem 0.75rem', borderRadius: '10px', fontSize: 'var(--fs-xs)', fontWeight: 900, height: 'fit-content' }}>
                                        بث مباشر
                                    </div>
                                </div>

                                {/* عدادات اليوم */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '0.9375rem', marginBottom: '1.25rem' }}>
                                    <div className="stat-badge">
                                        <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800 }}>العمالة اليوم</div>
                                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.primary }}>{site.todayWorkers}</div>
                                    </div>
                                    <div className="stat-badge">
                                        <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800 }}>تكلفة اليوم</div>
                                        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: THEME.danger }}>{formatCurrency(site.totalTodayCost)}</div>
                                    </div>
                                </div>

                                {/* المهام الجارية */}
                                <div style={{ marginBottom: '0.9375rem' }}>
                                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, marginBottom: '0.5rem', color: '#475569' }}>أعمال جارية الآن:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3125rem' }}>
                                        {site.activeTasks.length > 0 ? site.activeTasks.map((t: string) => (
                                            <span key={t} className="task-pill">{t}</span>
                                        )) : <span style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8' }}>لم تُسجل مهام بعد</span>}
                                    </div>
                                </div>

                                {/* شريط التقدم (نسبة الصرف من الميزانية) */}
                                <div style={{ marginTop: '1.25rem', paddingTop: '0.9375rem', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', fontWeight: 800, marginBottom: '0.3125rem' }}>
                                        <span>استهلاك الميزانية الميدانية</span>
                                        <span>{((site.todayLaborCost / (site.estimated_budget / 100)) || 0).toFixed(1)}%</span>
                                    </div>
                                    <div style={{ height: '0.375rem', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                        <div style={{ width: '45%', height: '100%', background: THEME.goldAccent, borderRadius: '10px' }} />
                                    </div>
                                </div>
                                
                                {/* زر الدخول السريع للمشروع */}
                                <button 
                                    onClick={() => router.push('/projects')}
                                    style={{ width: '100%', marginTop: '1.25rem', padding: '0.75rem', border: 'none', borderRadius: '12px', background: THEME.coffeeDark, color: THEME.goldAccent, fontWeight: 900, cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <Building2 size={16} />
                                    فتح غرفة عمليات المشروع
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </MasterPage>
        </div>
    );
}

const styles = {
    sideStat: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f3f5f8', padding: '0.75rem', borderRadius: '12px', marginBottom: '0.625rem', fontSize: 'var(--fs-sm)', color: THEME.coffeeDark, fontWeight: 700 }
};
