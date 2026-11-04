"use client";
import React from 'react';
import { useProfileLogic } from '@/app/profile/profile_logic';
import { THEME } from '@/lib/theme';
import LoadingScreen from '@/components/LoadingScreen';
import MasterPage from '@/components/MasterPage';
import { Trophy, Zap, TriangleAlert, Building2, CalendarDays } from 'lucide-react';

export default function PerformancePage() {
    const { 
        isLoading, monthlyKPIs
    } = useProfileLogic();

    const performanceRate = monthlyKPIs?.performanceRate || 0;
    const totalProd = monthlyKPIs?.totalProduction || 0;
    const attendanceRate = monthlyKPIs?.attendanceRate || 0;

    if (isLoading) return <LoadingScreen message="جاري تحميل ملف الأداء..." fullScreen={true} />;

    return (
        <MasterPage title="مؤشرات الأداء التشغيلي والمالي" subtitle="تحليل شامل ومتقدم لأداء الشركة">
                <div className="ent-performance-content">
            <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div className="ent-panel ent-performance-panel">
                    <h3 style={{ margin: '0 0 35px 0', color: THEME.primary, fontWeight: 900, fontSize: '24px', textAlign: 'center' }}>ملف تقييم الأداء والإنتاجية</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px' }}>
                        
                        {/* 🌟 كفاءة الأداء */}
                        <div style={{ background: `rgba(${performanceRate >= 100 ? '16, 185, 129' : performanceRate >= 80 ? '245, 158, 11' : '239, 68, 68'}, 0.05)`, padding: '30px', borderRadius: '14px', textAlign: 'center', border: `2px solid rgba(${performanceRate >= 100 ? '16, 185, 129' : performanceRate >= 80 ? '245, 158, 11' : '239, 68, 68'}, 0.3)` }}>
                            <div style={{ fontSize: '50px', marginBottom: '15px' }}>{performanceRate >= 100 ? <Trophy size={40} aria-hidden="true" /> : performanceRate >= 80 ? <Zap size={40} aria-hidden="true" /> : <TriangleAlert size={40} aria-hidden="true" />}</div>
                            <p style={{ margin: 0, fontSize: '18px', color: performanceRate >= 100 ? THEME.success : performanceRate >= 80 ? '#f59e0b' : THEME.danger, fontWeight: 900 }}>تقييم كفاءة الإنتاج</p>
                            <h3 style={{ margin: '15px 0 0 0', fontWeight: 900, fontSize: '55px', color: THEME.brand.coffee }}>{performanceRate}%</h3>
                            <p style={{ margin: '15px 0 0 0', fontSize: '14px', color: '#64748b', fontWeight: 700, lineHeight: 1.6 }}>
                                {performanceRate >= 100 ? 'أداء ممتاز! يحقق أو يتجاوز التريحة المطلوبة' : performanceRate >= 80 ? 'أداء جيد جداً. قريب جداً من الهدف' : 'أداء ضعيف. يحتاج إلى تحسين لتغطية التريحة'}
                            </p>
                        </div>

                        {/* 📦 الإنتاجية المنجزة vs المطلوبة */}
                        <div style={{ background: 'rgba(194,65,12, 0.05)', padding: '30px', borderRadius: '14px', textAlign: 'center', border: `2px solid ${THEME.goldAccent}50` }}>
                            <div style={{ fontSize: '50px', marginBottom: '15px' }}><Building2 size={40} aria-hidden="true" /></div>
                            <p style={{ margin: 0, fontSize: '18px', color: THEME.goldAccent, fontWeight: 900 }}>الإنتاجية (المنجزة / المطلوبة)</p>
                            <div style={{ fontSize: '45px', fontWeight: 900, color: THEME.brand.coffee, direction: 'ltr', marginTop: '15px' }}>
                                <span style={{ color: THEME.success }}>{totalProd}</span>
                                <span style={{ color: '#cbd5e1', margin: '0 10px' }}>/</span>
                                <span style={{ color: THEME.danger }}>{(monthlyKPIs?.itemBreakdown || []).reduce((sum: number, b: any) => sum + b.totalTareeha, 0)}</span>
                            </div>
                            <p style={{ margin: '15px 0 0 0', fontSize: '14px', color: '#64748b', fontWeight: 700, lineHeight: 1.6 }}>إجمالي الوحدات التي تم إنجازها مقابل التريحة المستهدفة للعمل الفني عبر كافة البنود.</p>
                        </div>

                        {/* 📅 نسبة التزام الحضور */}
                        <div style={{ background: 'rgba(15, 23, 42, 0.05)', padding: '30px', borderRadius: '14px', textAlign: 'center', border: `2px solid rgba(15, 23, 42, 0.1)` }}>
                            <div style={{ fontSize: '50px', marginBottom: '15px' }}><CalendarDays size={40} aria-hidden="true" /></div>
                            <p style={{ margin: 0, fontSize: '18px', color: THEME.primary, fontWeight: 900 }}>نسبة التزام الحضور</p>
                            <h3 style={{ margin: '15px 0 0 0', fontWeight: 900, fontSize: '55px', color: THEME.primary }}>{attendanceRate}%</h3>
                            <p style={{ margin: '15px 0 0 0', fontSize: '14px', color: '#64748b', fontWeight: 700, lineHeight: 1.6 }}>حضر <strong style={{color: THEME.primary}}>{monthlyKPIs?.daysWorked || 0}</strong> يوم عمل من أصل <strong style={{color: THEME.danger}}>{monthlyKPIs?.expectedDays || 0}</strong> يوم عمل متوقع (حتى آخر شهر عمل فيه).</p>
                        </div>

                    </div>

                    {/* تفصيل الإنتاجية لكل بند */}
                    {(monthlyKPIs?.itemBreakdown || []).length > 0 && (
                        <div style={{ marginTop: '40px', background: 'rgba(252, 248, 241, 0.8)', padding: '25px', borderRadius: '14px', border: `1px solid ${THEME.accent}` }}>
                            <h4 style={{ color: THEME.accent, margin: '0 0 20px 0', fontSize: '18px', fontWeight: 900 }}>تفصيل التقييم حسب البند</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {(monthlyKPIs?.itemBreakdown || []).map((b: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '15px 20px', borderRadius: '15px', border: '1px solid rgba(194,65,12, 0.2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{ background: `rgba(${b.percentage >= 100 ? '16, 185, 129' : b.percentage >= 80 ? '245, 158, 11' : '239, 68, 68'}, 0.1)`, color: b.percentage >= 100 ? THEME.success : b.percentage >= 80 ? '#f59e0b' : THEME.danger, width: '50px', height: '50px', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 900, fontSize: '16px' }}>
                                                {b.percentage}%
                                            </div>
                                            <div>
                                                <h5 style={{ margin: 0, color: THEME.brand.coffee, fontSize: '16px', fontWeight: 900 }}>{b.item}</h5>
                                                <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '13px', fontWeight: 700 }}>النسبة تعكس التريحة المسجلة في الموازنة</p>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'left', direction: 'ltr' }}>
                                            <span style={{ fontWeight: 900, color: THEME.success, fontSize: '20px' }}>{b.totalProd}</span>
                                            <span style={{ color: '#cbd5e1', margin: '0 5px', fontSize: '18px' }}>/</span>
                                            <span style={{ fontWeight: 900, color: THEME.danger, fontSize: '20px' }}>{b.totalTareeha}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* قائمة الحضور حسب الشهر */}
                    {(monthlyKPIs?.attendanceBreakdown || []).length > 0 && (
                        <div style={{ marginTop: '20px', background: 'rgba(241, 245, 249, 0.8)', padding: '25px', borderRadius: '14px', border: `1px solid #cbd5e1` }}>
                            <h4 style={{ color: THEME.primary, margin: '0 0 20px 0', fontSize: '18px', fontWeight: 900 }}>تفصيل الحضور حسب الشهر</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                                {(monthlyKPIs?.attendanceBreakdown || []).map((m: any, idx: number) => (
                                    <div key={idx} style={{ background: 'white', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <h5 style={{ margin: 0, color: '#334155', fontSize: '15px', fontWeight: 900 }}>{m.month}</h5>
                                            <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '13px', fontWeight: 700 }}>حضر <strong style={{color: THEME.primary}}>{m.daysWorked}</strong> يوم من أصل {m.expectedDays || 26}</p>
                                        </div>
                                        <div style={{ background: `rgba(${m.percentage >= 100 ? '16, 185, 129' : m.percentage >= 80 ? '245, 158, 11' : '239, 68, 68'}, 0.1)`, color: m.percentage >= 100 ? THEME.success : m.percentage >= 80 ? '#f59e0b' : THEME.danger, padding: '8px 12px', borderRadius: '10px', fontWeight: 900, fontSize: '16px' }}>
                                            {m.percentage}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
                    </MasterPage>
    );
}
