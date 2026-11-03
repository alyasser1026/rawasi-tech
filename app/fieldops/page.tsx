"use client";
import React from 'react';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { useFieldOpsLogic } from './field_ops_logic';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import LoadingScreen from '@/components/LoadingScreen';

export default function FieldOperationsPage() {
    const logic = useFieldOpsLogic();

    const sidebarContent = (
        <div className="summary-glass-card">
            <h4 style={{ color: 'white', margin: '0 0 15px 0', fontSize: '14px' }}>📊 نبض الميدان - اليوم</h4>
            <div style={styles.sideStat}>
                <span>إجمالي العمالة بالمواقع</span>
                <strong>{logic.companyTotals.totalWorkers} عامل</strong>
            </div>
            <div style={styles.sideStat}>
                <span>إجمالي المنصرف اليومي</span>
                <strong style={{ color: THEME.accent }}>{formatCurrency(logic.companyTotals.totalCost)}</strong>
            </div>
            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '20px', textAlign: 'center' }}>
                تحديث تلقائي: {logic.today}
            </p>
        </div>
    );

    return (
        <div className="clean-page">
            <MasterPage title="رادار الميدان الحي" subtitle="متابعة لحظية للعمالة، التكاليف، والتقدم الإنشائي في المواقع">
                
                <RawasiSidebarManager 
                    summary={sidebarContent}
                    watchDeps={[logic.companyTotals]}
                />

                <style>{`
                    .field-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px; padding: 10px; }
                    .site-card { background: rgba(255,255,255,0.7); backdrop-filter: blur(15px); border-radius: 28px; padding: 25px; border: 1px solid rgba(255,255,255,0.8); transition: 0.3s; position: relative; overflow: hidden; }
                    .site-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.1); }
                    .stat-badge { background: #f1f5f9; padding: 10px 15px; borderRadius: 16px; textAlign: center; }
                    .task-pill { background: ${THEME.coffeeDark}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; }
                    .summary-glass-card { background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); }
                `}</style>

                {logic.isLoading ? (
                    <LoadingScreen message="جاري مسح المواقع..." fullScreen={false} />
                ) : (
                    <div className="field-grid">
                        {logic.projectStats.map(site => (
                            <div key={site.id} className="site-card">
                                {/* الهيدر */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900 }}>🏢 {site.Property}</h3>
                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>العميل: {site.client?.name || '---'}</span>
                                    </div>
                                    <div style={{ background: THEME.success + '20', color: THEME.success, padding: '5px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 900, height: 'fit-content' }}>
                                        بث مباشر 🔴
                                    </div>
                                </div>

                                {/* عدادات اليوم */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                                    <div className="stat-badge">
                                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>العمالة اليوم</div>
                                        <div style={{ fontSize: '20px', fontWeight: 900, color: THEME.primary }}>{site.todayWorkers}</div>
                                    </div>
                                    <div className="stat-badge">
                                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>تكلفة اليوم</div>
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: THEME.danger }}>{formatCurrency(site.totalTodayCost)}</div>
                                    </div>
                                </div>

                                {/* المهام الجارية */}
                                <div style={{ marginBottom: '15px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 900, marginBottom: '8px', color: '#475569' }}>🔨 أعمال جارية الآن:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                        {site.activeTasks.length > 0 ? site.activeTasks.map((t: string) => (
                                            <span key={t} className="task-pill">{t}</span>
                                        )) : <span style={{ fontSize: '10px', color: '#94a3b8' }}>لم تُسجل مهام بعد</span>}
                                    </div>
                                </div>

                                {/* شريط التقدم (نسبة الصرف من الميزانية) */}
                                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, marginBottom: '5px' }}>
                                        <span>استهلاك الميزانية الميدانية</span>
                                        <span>{((site.todayLaborCost / (site.estimated_budget / 100)) || 0).toFixed(1)}%</span>
                                    </div>
                                    <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                        <div style={{ width: '45%', height: '100%', background: THEME.goldAccent, borderRadius: '10px' }} />
                                    </div>
                                </div>
                                
                                {/* زر الدخول السريع للمشروع */}
                                <button style={{ width: '100%', marginTop: '20px', padding: '12px', border: 'none', borderRadius: '12px', background: THEME.coffeeDark, color: THEME.goldAccent, fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}>
                                    فتح غرفة عمليات المشروع ⬅️
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
    sideStat: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', marginBottom: '10px', fontSize: '12px', color: 'white', fontWeight: 700 }
};
