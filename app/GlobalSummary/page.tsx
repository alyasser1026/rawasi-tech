"use client";
import React, { useEffect, useState } from 'react';
import { useToast } from '@/lib/toast-context';
import LoadingScreen from '@/components/LoadingScreen';
import { supabase } from '@/lib/supabase';
import { fetchAllSupabaseData, formatCurrency } from '@/lib/helpers';
import GlassContainer from '@/components/GlassContainer';
import { THEME } from '@/lib/theme';
import MasterPage from '@/components/MasterPage';
import PhiIcon from '@/components/PhiIcon';

export default function MasterDashboard() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        finance: { liquidity: 0, receivables: 0, expenses: 0 },
        projects: { totalBudget: 0, actualSpend: 0, progress: 0 },
        labor: { count: 0, monthlyCost: 0, efficiency: 0 },
        audit: { orphans: 0, unbalanced: 0 }
    });

    useEffect(() => {
        const loadMasterData = async () => {
            setLoading(true);
            try {
                // 🚀 سحب البيانات من كافة موديولات النظام (البلدوزر الشامل)
                const [lines, headers, projects, labor, invoices, expenses, receipts] = await Promise.all([
                    fetchAllSupabaseData(supabase, 'journal_lines'),
                    fetchAllSupabaseData(supabase, 'journal_headers'),
                    fetchAllSupabaseData(supabase, 'projects'),
                    fetchAllSupabaseData(supabase, 'labor_daily_logs'),
                    fetchAllSupabaseData(supabase, 'invoices'),
                    fetchAllSupabaseData(supabase, 'expenses'),
                    fetchAllSupabaseData(supabase, 'receipt_vouchers')
                ]);

                // --- 1. التحليل المالي (السيولة والمصروفات) ---
                const cash = lines?.filter(l => l.account_id?.startsWith('11')).reduce((a, c) => a + (Number(c.debit) - Number(c.credit)), 0);
                const totalExp = expenses?.reduce((a, c) => a + Number(c.amount), 0);
                const pendingInvoices = invoices?.filter(i => i.status !== 'مدفوع').reduce((a, c) => a + Number(c.total_amount), 0);

                // --- 2. إدارة المشاريع (الميزانية vs التنفيذ) ---
                const budget = projects?.reduce((a, c) => a + Number(c.total_budget), 0) || 1;
                const laborCosts = labor?.reduce((a, c) => a + Number(c.daily_wage), 0);
                const totalActual = totalExp + laborCosts;

                // --- 3. إدارة العمالة والإنتاجية ---
                const today = new Date().toISOString().split('T')[0];
                const activeNow = labor?.filter(l => l.work_date === today).length;
                const estHours = projects?.reduce((a, c) => a + Number(c.estimated_hours || 0), 0) || 1;
                const actualHours = labor?.reduce((a, c) => a + Number(c.hours_worked || 8), 0) || 1;

                // --- 4. الرقابة والتدقيق (الرادار) ---
                const validIds = new Set(receipts.map(r => String(r.id)));
                const orphans = headers?.filter(h => h.reference_id && !validIds.has(String(h.reference_id))).length;

                setSummary({
                    finance: { liquidity: cash, receivables: pendingInvoices, expenses: totalExp },
                    projects: { totalBudget: budget, actualSpend: totalActual, progress: (totalActual / budget) * 100 },
                    labor: { count: activeNow, monthlyCost: laborCosts, efficiency: (estHours / actualHours) * 100 },
                    audit: { orphans: orphans, unbalanced: 0 }
                });
            } finally {
                setLoading(false);
            }
        };
        loadMasterData();
    }, []);

    if (loading) return <LoadingScreen message="جاري استدعاء الإحصائيات المركزية..." subMessage="نقوم بتجميع بيانات الأقسام بدقة لحظية" />;

    return (
        <MasterPage title="الملخص العام (Global Summary)" subtitle="نظرة شاملة وموحدة لجميع قطاعات النظام">
        
        <div style={{ padding: '1.5625rem', direction: 'rtl', maxWidth: '100rem', margin: '0 auto' }}>
            
            {/* 👑 الهيدر العلوي: شريط المعلومات السريع */}
            <div className="summary-bar fade-in-up" style={{ borderRadius: '14px', marginBottom: '1.875rem' }}>
                <div className="summary-item">
                    <span className="summary-label">صافي السيولة</span>
                    <span className="summary-value" style={{ color: THEME.success }}>{formatCurrency(summary.finance.liquidity)}</span>
                </div>
                <div className="summary-item" style={{ borderRight: '1px solid #ddd' }}>
                    <span className="summary-label">العمالة الحالية</span>
                    <span className="summary-value">{summary.labor.count} عامل</span>
                </div>
                <div className="summary-item" style={{ borderRight: '1px solid #ddd' }}>
                    <span className="summary-label">مشاكل تقنية</span>
                    <span className="summary-value" style={{ color: THEME.danger }}>{summary.audit.orphans} تنبيه</span>
                </div>
            </div>

            {/* 🏎️ صف الـ KPIs الأساسي */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.875rem' }}>
                <KPICard title="إجمالي ميزانية المشاريع" value={summary.projects.totalBudget} icon="🏗️" color={THEME.primary} />
                <KPICard title="تكاليف التشغيل الفعلية" value={summary.projects.actualSpend} icon="📉" color={THEME.danger} />
                <KPICard title="تحصيلات متوقعة" value={summary.finance.receivables} icon="📩" color={THEME.accent} />
                <KPICard title="مؤشر الإنتاجية العام" value={summary.labor.efficiency.toFixed(1) + "%"} isCurrency={false} icon="🚀" color="#8b5cf6" />
            </div>

            {/* 🧩 مصفوفة البيانات الكبرى (The Grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '1.5625rem' }}>
                
                {/* العمود الأيمن: تحليل المشاريع والإنتاجية */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5625rem' }}>
                    <GlassContainer>
                        <h3 style={{ marginBottom: '1.25rem' }}>مراقبة تنفيذ المشاريع (Budget Tracker)</h3>
                        <ProgressBar label="استهلاك الميزانية" percentage={summary.projects.progress} color={THEME.accent} />
                        <ProgressBar label="كفاءة توزيع العمالة" percentage={summary.labor.efficiency} color={THEME.success} />
                        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1.25rem' }}>
                            <div className="kpi-card" style={{ flex: 1, padding: '0.9375rem' }}>
                                <small>تكلفة المواد</small>
                                <h4>{formatCurrency(summary.projects.actualSpend * 0.7)}</h4>
                            </div>
                            <div className="kpi-card" style={{ flex: 1, padding: '0.9375rem' }}>
                                <small>أجور العمالة</small>
                                <h4>{formatCurrency(summary.labor.monthlyCost)}</h4>
                            </div>
                        </div>
                    </GlassContainer>

                    <GlassContainer>
                        <h3 style={{ marginBottom: '1.25rem' }}>ذمم مدينة وحركة التحصيل</h3>
                        <p style={{ color: 'var(--text-muted)' }}>فواتير لم يتم تحصيلها وتؤثر على التدفق النقدي:</p>
                        <h2 style={{ color: THEME.accent, margin: '0.9375rem 0' }}>{formatCurrency(summary.finance.receivables)}</h2>
                        <button className="btn btn-primary">إرسال مطالبات جماعية</button>
                    </GlassContainer>
                </div>

                {/* العمود الأيسر: الإجراءات والرقابة */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5625rem' }}>
                    <GlassContainer style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white' }}>
                        <h3>رادار الرقابة المالية</h3>
                        <div style={{ marginTop: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: '1px solid #334155' }}>
                                <span>قيود يتيمة</span>
                                <span style={{ color: THEME.accent, fontWeight: 900 }}>{summary.audit.orphans}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: '1px solid #334155' }}>
                                <span>حركات غير متزنة</span>
                                <span style={{ color: '#10b981' }}>0</span>
                            </div>
                        </div>
                        <button className="btn" style={{ width: '100%', marginTop: '1.25rem', background: THEME.accent, color: 'white' }}>فتح غرفة العمليات</button>
                    </GlassContainer>

                    <GlassContainer>
                        <h3>وصول سريع</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '0.625rem', marginTop: '0.9375rem' }}>
                            <QuickAction icon="📝" label="قيد جديد" />
                            <QuickAction icon="👷" label="تحضير عمال" />
                            <QuickAction icon="📂" label="التقارير" />
                            <QuickAction icon="⚙️" label="الإعدادات" />
                        </div>
                    </GlassContainer>
                </div>
            </div>
        </div>
        </MasterPage>
    );
}

// مكونات مساعدة
function KPICard({ title, value, icon, color, isCurrency = true }: any) {
    return (
        <div className="kpi-card fade-in-up" style={{ borderRight: `4px solid ${color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-muted)' }}>{title}</span>
                <span style={{ display: 'inline-flex' }}><PhiIcon value={icon} size={20} /></span>
            </div>
            <h2 style={{ color: color, marginTop: '0.625rem' }}>{isCurrency ? formatCurrency(value) : value}</h2>
        </div>
    );
}

function ProgressBar({ label, percentage, color }: any) {
    const safePercent = Math.min(percentage, 100);
    return (
        <div style={{ marginBottom: '0.9375rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', marginBottom: '0.3125rem' }}>
                <span>{label}</span>
                <span style={{ fontWeight: 900 }}>{percentage.toFixed(1)}%</span>
            </div>
            <div style={{ width: '100%', height: '0.5rem', background: '#e2e8f0', borderRadius: '10px' }}>
                <div style={{ width: `${safePercent}%`, height: '100%', background: color, borderRadius: '10px', transition: '1s' }}></div>
            </div>
        </div>
    );
}

function QuickAction({ icon, label }: any) {
    return (
        <div className="btn" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: THEME.primary, padding: '0.9375rem', flexDirection: 'column' }}>
            <span style={{ display: 'inline-flex' }}><PhiIcon value={icon} size={20} /></span>
            <span style={{ fontSize: 'var(--fs-sm)' }}>{label}</span>
        </div>
                );
}