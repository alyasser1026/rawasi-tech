"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, RefreshCw, Landmark, Wallet, Building2, CircleCheck, CirclePause, Clock3, ChartColumn, ChartPie, Banknote, FileText, Users, ShieldCheck, CircleAlert } from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import { THEME } from '@/lib/theme';
import { useDashboardLogic } from './dashboard_logic';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = [THEME.goldAccent, '#2563eb', '#059669', '#ca8a04', '#7c3aed', '#db2777', '#475569'];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const logic = useDashboardLogic();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const moduleLabels: Record<string, string> = {
    expenses: 'المصروفات العامة',
    invoices: 'مستخلصات العملاء',
    labor: 'يوميات العمالة',
    payments: 'سندات الصرف',
    receipts: 'سندات القبض',
    advances: 'سلف الموظفين',
    deductions: 'الجزاءات والمخالفات',
    subClaims: 'مقاولي الباطن',
    materialReceipts: 'توريد الخامات'
  };

  return (
    <MasterPage enterprise icon={<LayoutDashboard/>} title="لوحة القيادة" subtitle="نظرة شاملة على المركز المالي والمشاريع وحركة المستندات" headerContent={<button type="button" className="ent-button" onClick={() => void queryClient.invalidateQueries({ queryKey: ['dashboard_stats_comprehensive'] })} disabled={logic.isLoading}><RefreshCw size={16}/>تحديث البيانات</button>}>
      
      {logic.isLoading ? (
        <LoadingScreen message="جاري معالجة البيانات المالية..." subMessage="نقوم الآن بتجميع وتحليل البيانات من جميع الأقسام..." fullScreen={false} />
      ) : (
        <div className="phi-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '2.1875rem', paddingBottom: '3.125rem' }}>
          
          {/* 🏛️ القسم الأول: المركز المالي */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
              <h3 className="section-title"><Landmark size={18}/> المركز المالي</h3>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#64748b', background: '#f1f5f9', padding: '0.375rem 0.9375rem', borderRadius: '14px' }}>من السجلات الحالية</span>
            </div>
            <div className="premium-grid-3">
              <div className="premium-card financial-stat assets">
                <div className="card-header-flex">
                  <div className="icon-wrapper" style={{ background: 'linear-gradient(135deg, #10b98120, #05966920)', color: '#10b981' }}><Landmark size={23}/></div>
                  <span className="trend-badge positive">أصول وممتلكات</span>
                </div>
                <p className="card-subtitle">إجمالي الأصول</p>
                <h2 className="card-value gradient-text-green">{logic.formatCurrency(logic.stats?.totals?.totalAssets || 0)}</h2>
              </div>

              <div className="premium-card financial-stat liabilities">
                <div className="card-header-flex">
                  <div className="icon-wrapper" style={{ background: 'linear-gradient(135deg, #ef444420, #dc262620)', color: '#ef4444' }}><Landmark size={23}/></div>
                  <span className="trend-badge negative">خصوم متداولة</span>
                </div>
                <p className="card-subtitle">إجمالي الالتزامات</p>
                <h2 className="card-value gradient-text-red">{logic.formatCurrency(logic.stats?.totals?.totalLiabilities || 0)}</h2>
              </div>

              <div className="premium-card financial-stat equity">
                <div className="card-header-flex">
                  <div className="icon-wrapper" style={{ background: `linear-gradient(135deg, ${THEME.goldAccent}20, #b4530920)`, color: THEME.goldAccent }}><Wallet size={23}/></div>
                  <span className="trend-badge neutral">رأس المال العامل</span>
                </div>
                <p className="card-subtitle">صافي القيمة التقديرية</p>
                <h2 className="card-value gradient-text-gold">{logic.formatCurrency((logic.stats?.totals?.totalAssets || 0) - (logic.stats?.totals?.totalLiabilities || 0))}</h2>
              </div>
            </div>
          </div>

          {/* 🚀 القسم الجديد: حالة المشاريع والعقارات (الفلل) */}
          <div>
            <h3 className="section-title"><Building2 size={18}/> حالة المشاريع والعقارات</h3>
            <div className="premium-grid-4">
              {logic.stats?.projectsStatusData?.map((statusObj: any, index: number) => {
                // تحديد لون الأيقونة والاسم ديناميكياً حسب الحالة
                let colorClass = 'blue';
                let icon = <Building2 size={21}/>;
                if (statusObj.name.includes('مكتمل')) { colorClass = 'green'; icon = <CircleCheck size={21}/>; }
                else if (statusObj.name.includes('متوقف')) { colorClass = 'red'; icon = <CirclePause size={21}/>; }
                else if (statusObj.name.includes('دراسة') || statusObj.name.includes('تجهيز')) { colorClass = 'orange'; icon = <Clock3 size={21}/>; }

                return (
                  <div key={index} className="mini-stat-card">
                    <div className={`mini-icon ${colorClass}`}>{icon}</div>
                    <div>
                      <p>{statusObj.name}</p>
                      <h3>{statusObj.value} <span className="currency">مشروع/فيلا</span></h3>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 📊 القسم الثاني: الرسوم البيانية الاستراتيجية */}
          <div className="premium-grid-2">
            
            {/* 1. التدفق النقدي */}
            <div className="premium-card">
              <h3 className="section-title" style={{ fontSize: 'var(--fs-xl)' }}><ChartColumn size={18}/> التدفق النقدي والسيولة</h3>
              <div style={{ height: '20rem', width: '100%', marginTop: '1.25rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={logic.stats?.cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.3}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#64748b', fontWeight: 800 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: 800 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 900, direction: 'rtl', padding: '15px' }} formatter={(value: any) => [logic.formatCurrency(value), '']} />
                    <Legend wrapperStyle={{ fontSize: '13px', fontWeight: 900, paddingTop: '10px' }} />
                    <Bar dataKey="income" name="إجمالي الإيرادات" fill="url(#colorIncome)" radius={[8, 8, 0, 0]} barSize={40} />
                    <Bar dataKey="expense" name="إجمالي التكاليف" fill="url(#colorExpense)" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. تحليل التكاليف */}
            <div className="premium-card">
              <h3 className="section-title" style={{ fontSize: 'var(--fs-xl)' }}><ChartPie size={18}/> توزيع التكاليف</h3>
              <div style={{ height: '20rem', width: '100%', display: 'flex', alignItems: 'center', marginTop: '1.25rem' }}>
                {!logic.stats?.expensesByCategory || logic.stats.expensesByCategory.length === 0 ? (
                    <div style={{width:'100%', textAlign:'center', color:'#94a3b8', fontWeight:900}}>لا توجد تكاليف مسجلة بعد</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                          data={logic.stats.expensesByCategory}
                          cx="50%" cy="50%"
                          innerRadius={85} outerRadius={120}
                          paddingAngle={6}
                          dataKey="value"
                          stroke="none"
                          label={({ name, percent = 0 }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                          labelLine={false}
                          style={{ fontWeight: 900, fontSize: 'var(--fs-sm)', fill: THEME.coffeeDark }}
                        >
                        {logic.stats.expensesByCategory.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.1))' }} />
                        ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 900, direction: 'rtl', padding: '15px' }} formatter={(value: any) => [logic.formatCurrency(value), '']} />
                    </PieChart>
                    </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* 🚀 القسم الجديد: أداء أوامر الشغل */}
          <div style={{ marginTop: '1.875rem', marginBottom: '1.875rem' }}>
            <div className="premium-card" style={{ width: '100%' }}>
              <h3 className="section-title"><ChartColumn size={18}/> الميزانية والتكلفة الفعلية لأوامر الشغل</h3>
              <div style={{ height: '21.875rem', width: '100%', marginTop: '1.25rem' }}>
                {!logic.stats?.jobOrdersPerformance || logic.stats.jobOrdersPerformance.length === 0 ? (
                    <div style={{width:'100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color:'#94a3b8', fontWeight:900}}>لا توجد بيانات لأوامر الشغل أو لم يتم تسجيل تكاليف عليها بعد</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={logic.stats.jobOrdersPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 900, direction: 'rtl' }}
                            formatter={(value, name) => [typeof value === 'string' || typeof value === 'number' ? logic.formatCurrency(value) : (value || []).map(item => logic.formatCurrency(item)).join(' – '), name]}
                        />
                        <Legend wrapperStyle={{ fontWeight: 900, fontSize: '14px', paddingTop: '20px' }} />
                        <Bar dataKey="budget" name="الميزانية المعتمدة" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={30} />
                        <Bar dataKey="actual" name="التكلفة الفعلية" fill={THEME.goldAccent} radius={[6, 6, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* 🚀 القسم الثالث: مؤشرات الأداء السريعة (ماليات) */}
          <div>
            <h3 className="section-title"><Wallet size={18}/> الأداء التشغيلي</h3>
            <div className="premium-grid-4">
              <div className="mini-stat-card">
                <div className="mini-icon blue"><Building2 size={22}/></div>
                <div>
                  <p>مشاريع نشطة (جاري العمل بها)</p>
                  <h3>{logic.stats?.totals?.activeProjects || 0}</h3>
                </div>
              </div>
              <div className="mini-stat-card">
                <div className="mini-icon red"><Banknote size={22}/></div>
                <div>
                  <p>تكاليف ومصروفات إجمالية</p>
                  <h3>{logic.formatCurrency(logic.stats?.totals?.totalExpenses || 0)}</h3>
                </div>
              </div>
              <div className="mini-stat-card">
                <div className="mini-icon green"><FileText size={22}/></div>
                <div>
                  <p>مستخلصات وإيرادات معتمدة</p>
                  <h3>{logic.formatCurrency(logic.stats?.totals?.totalInvoices || 0)}</h3>
                </div>
              </div>
              <div className="mini-stat-card">
                <div className="mini-icon orange"><Users size={22}/></div>
                <div>
                  <p>أجور عمالة مباشرة</p>
                  <h3>{logic.formatCurrency(logic.stats?.totals?.totalWages || 0)}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* ⚖️ القسم الرابع: الرادار الأمني */}
          <div>
            <h3 className="section-title"><ShieldCheck size={18}/> متابعة اعتماد المستندات</h3>
            <div className="health-rings-grid">
              {Object.entries(logic.stats?.postingCharts || {}).map(([key, chartData]: [string, any]) => {
                const total = chartData[0].value + chartData[1].value;
                const percent = total === 0 ? 0 : Math.round((chartData[0].value / total) * 100);
                const isWarning = percent < 100 && total > 0;

                return (
                  <div key={key} className={`health-ring-card ${isWarning ? 'warning-glow' : ''}`}>
                    <div style={{ position: 'relative', width: '5rem', height: '5rem' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={total === 0 ? [{value: 1}] : chartData}
                            innerRadius={28} outerRadius={38}
                            dataKey="value" stroke="none" startAngle={90} endAngle={-270}
                          >
                            {total === 0 ? <Cell fill="#f1f5f9" /> : (
                              <>
                                <Cell fill={THEME.success} /> 
                                <Cell fill="#f1f5f9" />
                              </>
                            )}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="ring-center-text">
                        {total === 0 ? '-' : `${percent}%`}
                      </div>
                    </div>
                    <div className="ring-info">
                      <h4>{moduleLabels[key] || key}</h4>
                      <p>{chartData[1].value} معلق من أصل {total}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 🚨 القسم الخامس: المهام العاجلة */}
          <div className="premium-card alerts-container" style={{ border: '1px solid #fecaca' }}>
            <div className="alerts-header">
              <h3 className="section-title" style={{ margin: 0, color: '#b91c1c' }}><CircleAlert size={18}/> مستندات تحتاج اعتمادًا</h3>
              <span className="alerts-badge">
                {logic.stats?.alerts?.length || 0} مهام
              </span>
            </div>
            
            <div className="alerts-list">
              {!logic.stats?.alerts || logic.stats.alerts.length === 0 ? (
                  <div className="empty-alerts">
                      لا توجد مستندات معلقة ضمن البيانات المعروضة.
                  </div>
              ) : (
                  logic.stats.alerts.map((task: any, idx: number) => (
                  <div key={idx} className="alert-row">
                      <div className="alert-content">
                        <div className={`pulse-dot ${task.type}`} />
                        <span>{task.title}</span>
                      </div>
                      <button onClick={() => router.push(task.route)} className="action-btn">
                        استعراض المستندات ➔
                      </button>
                  </div>
                  ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* 🎨 CSS Styles */}
      <style>{`
        /* Typography & Globals */
        .phi-dashboard .section-title { font-size: var(--fs-xl); color: ${THEME.coffeeDark}; font-weight: 900; margin: 0 0 1.25rem 0; display: flex; align-items: center; gap: 0.625rem; }
        
        /* Grids */
        .phi-dashboard .premium-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(17.5rem, 1fr)); gap: 1.5625rem; }
        .phi-dashboard .premium-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(28.125rem, 1fr)); gap: 1.5625rem; }
        .phi-dashboard .premium-grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(13.75rem, 1fr)); gap: 1.25rem; }
        .phi-dashboard .health-rings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(13.75rem, 1fr)); gap: 1.25rem; }

        /* Premium Cards */
        .phi-dashboard .premium-card { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 1); border-radius: 14px; padding: 1.875rem; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.05); transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .phi-dashboard .premium-card:hover { transform: translateY(-5px); box-shadow: 0 30px 60px -15px rgba(0,0,0,0.08); }

        /* Card Internals */
        .phi-dashboard .card-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
        .phi-dashboard .icon-wrapper { width: 3.125rem; height: 3.125rem; border-radius: 16px; display: flex; justify-content: center; align-items: center; font-size: var(--fs-2xl); }
        .phi-dashboard .trend-badge { font-size: var(--fs-xs); font-weight: 900; padding: 0.375rem 0.75rem; border-radius: 14px; }
        .phi-dashboard .trend-badge.positive { background: #f0fdf4; color: #16a34a; }
        .phi-dashboard .trend-badge.negative { background: #fef2f2; color: #dc2626; }
        .phi-dashboard .trend-badge.neutral { background: #f8fafc; color: #475569; }
        .phi-dashboard .card-subtitle { margin: 0 0 0.3125rem 0; font-size: var(--fs-md); color: #64748b; font-weight: 800; }
        .phi-dashboard .card-value { margin: 0; font-size: var(--fs-3xl); font-weight: 900; letter-spacing: -0.5px; }

        /* Gradients */
        .phi-dashboard .gradient-text-green { background: linear-gradient(to left, #059669, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .phi-dashboard .gradient-text-red { background: linear-gradient(to left, #dc2626, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .phi-dashboard .gradient-text-gold { background: linear-gradient(to left, #c2410c, #c2410c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

        /* Mini Stat Cards */
        .phi-dashboard .mini-stat-card { background: white; border-radius: 14px; padding: 1.25rem; display: flex; align-items: center; gap: 0.9375rem; border: 1px solid #f1f5f9; box-shadow: 0 10px 20px -10px rgba(0,0,0,0.03); transition: 0.3s; }
        .phi-dashboard .mini-stat-card:hover { border-color: ${THEME.goldAccent}; transform: translateY(-3px); }
        .phi-dashboard .mini-stat-card p { margin: 0; font-size: var(--fs-sm); color: #64748b; font-weight: 800; }
        .phi-dashboard .mini-stat-card h3 { margin: 0.3125rem 0 0 0; font-size: var(--fs-xl); font-weight: 900; color: ${THEME.coffeeDark}; display: flex; align-items: baseline; gap: 0.3125rem;}
        .phi-dashboard .mini-icon { width: 2.8125rem; height: 2.8125rem; border-radius: 14px; display: flex; justify-content: center; align-items: center; font-size: var(--fs-xl); }
        .phi-dashboard .mini-icon.blue { background: #eff6ff; color: #3b82f6; }
        .phi-dashboard .mini-icon.red { background: #fef2f2; color: #ef4444; }
        .phi-dashboard .mini-icon.green { background: #f0fdf4; color: #10b981; }
        .phi-dashboard .mini-icon.orange { background: #fffbeb; color: #f59e0b; }
        .phi-dashboard .currency { font-size: var(--fs-xs); color: #94a3b8; font-weight: 700; }

        /* Health Rings */
        .phi-dashboard .health-ring-card { background: white; padding: 0.9375rem; border-radius: 14px; display: flex; align-items: center; gap: 0.9375rem; border: 1px solid #f1f5f9; box-shadow: 0 4px 10px rgba(0,0,0,0.02); transition: 0.3s; }
        .phi-dashboard .health-ring-card.warning-glow { border-color: #fde68a; background: #fffbeb; }
        .phi-dashboard .health-ring-card:hover { transform: scale(1.02); }
        .phi-dashboard .ring-center-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: var(--fs-sm); font-weight: 900; color: ${THEME.coffeeDark}; }
        .phi-dashboard .ring-info h4 { margin: 0 0 0.25rem 0; font-size: var(--fs-sm); font-weight: 900; color: ${THEME.coffeeDark}; }
        .phi-dashboard .ring-info p { margin: 0; font-size: var(--fs-xs); font-weight: 800; color: #94a3b8; }

        /* Alerts Inbox */
        .phi-dashboard .alerts-container { background: #fef2f2 !important; border-radius: 14px; padding: 1.875rem; }
        .phi-dashboard .alerts-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5625rem; }
        .phi-dashboard .alerts-badge { font-size: var(--fs-sm); background: #ef4444; color: white; padding: 0.375rem 1rem; border-radius: 14px; font-weight: 900; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3); }
        .phi-dashboard .alerts-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .phi-dashboard .alert-row { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5625rem; background: white; border-radius: 16px; border: 1px solid #fecaca; transition: 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
        .phi-dashboard .alert-row:hover { transform: translateX(-5px); border-color: #ef4444; box-shadow: 0 8px 20px rgba(239, 68, 68, 0.1); }
        .phi-dashboard .alert-content { display: flex; align-items: center; gap: 0.9375rem; font-size: var(--fs-md); font-weight: 900; color: #1e293b; }
        .phi-dashboard .action-btn { background: white; border: 2px solid #e2e8f0; padding: 0.625rem 1.25rem; border-radius: 12px; font-size: var(--fs-sm); font-weight: 900; color: #475569; cursor: pointer; transition: 0.2s; }
        .phi-dashboard .action-btn:hover { background: #ef4444; color: white; border-color: #ef4444; }
        .phi-dashboard .empty-alerts { padding: 1.875rem; text-align: center; background: #f0fdf4; border-radius: 14px; color: #166534; font-weight: 900; border: 2px dashed #bbf7d0; font-size: var(--fs-lg); }

        /* Pulse Animation */
        .phi-dashboard .pulse-dot { width: 0.75rem; height: 0.75rem; border-radius: 50%; }
        .phi-dashboard .pulse-dot.danger { background: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); animation: pulse-red 2s infinite; }
        .phi-dashboard .pulse-dot.warning { background: #f59e0b; box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); animation: pulse-orange 2s infinite; }
        
        @keyframes pulse-red { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes pulse-orange { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

        /* Loader */
        .phi-dashboard .loader-spinner { width: 3.125rem; height: 3.125rem; border: 5px solid #f3f3f3; border-top: 5px solid ${THEME.goldAccent}; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Scoped PHI TECH dashboard surfaces; figures and financial logic are unchanged. */
        .phi-dashboard > div { min-width: 0; }
        .phi-dashboard .premium-grid-3 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 16.25rem), 1fr)); gap: 1.25rem; }
        .phi-dashboard .premium-grid-2 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 24.375rem), 1fr)); gap: 1.25rem; }
        .phi-dashboard .premium-grid-4, .phi-dashboard .health-rings-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 13.75rem), 1fr)); }
        .phi-dashboard .premium-card { min-width: 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; box-shadow: 0 5px 22px #27272a08; backdrop-filter: none; -webkit-backdrop-filter: none; padding: 1.625rem; }
        .phi-dashboard .premium-card:hover { transform: translateY(-2px); box-shadow: 0 9px 28px #27272a0d; }
        .phi-dashboard .financial-stat { position: relative; overflow: hidden; border-top: 3px solid var(--stat-accent); background: radial-gradient(ellipse at 0% 0%, var(--stat-tint), transparent 70%), #ffffff; }
        .phi-dashboard .financial-stat.assets { --stat-accent: #059669; --stat-tint: #ecfdf5; }
        .phi-dashboard .financial-stat.liabilities { --stat-accent: #e11d48; --stat-tint: #fff1f2; }
        .phi-dashboard .financial-stat.equity { --stat-accent: #ea580c; --stat-tint: #fff7ed; }
        .phi-dashboard .financial-stat .icon-wrapper { width: 3.25rem; height: 3.25rem; border: 1px solid var(--stat-tint); border-radius: 16px; }
        .phi-dashboard .trend-badge { font-size: var(--fs-sm); font-weight: 700; }
        .phi-dashboard .trend-badge.positive { color: #047857; background: #ecfdf5; }
        .phi-dashboard .trend-badge.negative { color: #be123c; background: #fff1f2; }
        .phi-dashboard .trend-badge.neutral { color: #9a3412; background: #fff7ed; }
        .phi-dashboard .card-subtitle { color: #52525b; font-weight: 700; margin-bottom: 0.625rem; }
        .phi-dashboard .card-value { font-size: clamp(24px, 2.5vw, 32px); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; letter-spacing: -.7px; }
        .phi-dashboard .gradient-text-green { background: none; color: #047857; -webkit-text-fill-color: currentColor; }
        .phi-dashboard .gradient-text-red { background: none; color: #be123c; -webkit-text-fill-color: currentColor; }
        .phi-dashboard .gradient-text-gold { background: none; color: #c2410c; -webkit-text-fill-color: currentColor; }
        .phi-dashboard .mini-stat-card { min-width: 0; background: linear-gradient(145deg, #ffffff, #fafbff); border: 1px solid #e5e7eb; border-radius: 17px; box-shadow: 0 3px 15px #27272a05; }
        .phi-dashboard .mini-stat-card:hover { border-color: #d4d4d8; transform: translateY(-2px); }
        .phi-dashboard .mini-stat-card p { color: #52525b; font-size: var(--fs-sm); line-height: 1.7; }
        .phi-dashboard .mini-stat-card h3 { color: #27272a; flex-wrap: wrap; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        .phi-dashboard .mini-icon { flex-shrink: 0; border: 1px solid #ffffff; box-shadow: 0 3px 8px #27272a06; }
        .phi-dashboard .mini-icon.blue { color: #1d4ed8; background: #eff6ff; }
        .phi-dashboard .mini-icon.green { color: #047857; background: #ecfdf5; }
        .phi-dashboard .mini-icon.red { color: #be123c; background: #fff1f2; }
        .phi-dashboard .mini-icon.orange { color: #c2410c; background: #fff7ed; }
        .phi-dashboard .health-ring-card { border-color: #e5e7eb; border-radius: 17px; box-shadow: 0 3px 15px #27272a05; }
        .phi-dashboard .health-ring-card:hover { transform: translateY(-2px); }
        .phi-dashboard .health-ring-card.warning-glow { border-color: #fcd34d; background: #fffbeb; }
        .phi-dashboard .ring-info p, .phi-dashboard .currency { color: #71717a; }
        .phi-dashboard .section-title { color: #27272a; font-size: var(--fs-xl); }
        .phi-dashboard .alerts-container { border-radius: 14px; }
        .phi-dashboard .alerts-header { flex-wrap: wrap; gap: 0.75rem; }
        .phi-dashboard .alert-row { gap: 0.75rem; flex-wrap: wrap; }
        .phi-dashboard .action-btn { min-height: 2.75rem; }
        .phi-dashboard .alerts-badge { background: #be123c; box-shadow: none; }
        @media (max-width: 600px) {
          .phi-dashboard .premium-card { padding: 1.25rem 1rem; }
          .phi-dashboard .premium-grid-3, .phi-dashboard .premium-grid-4, .phi-dashboard .premium-grid-2, .phi-dashboard .health-rings-grid { gap: 0.875rem; }
          .phi-dashboard .card-value { font-size: var(--fs-2xl); }
          .phi-dashboard .section-title { font-size: var(--fs-xl); }
        }
        @media (prefers-reduced-motion: reduce) {
          .phi-dashboard *, .phi-dashboard *::before, .phi-dashboard *::after { animation: none !important; transition: none !important; }
          .phi-dashboard .premium-card:hover, .phi-dashboard .mini-stat-card:hover, .phi-dashboard .health-ring-card:hover, .phi-dashboard .alert-row:hover { transform: none; }
        }
        html.low-graphics-mode .phi-dashboard .premium-card, html.low-graphics-mode .phi-dashboard .mini-stat-card { background: white; }
        html.low-graphics-mode .phi-dashboard .premium-card:hover, html.low-graphics-mode .phi-dashboard .mini-stat-card:hover, html.low-graphics-mode .phi-dashboard .health-ring-card:hover, html.low-graphics-mode .phi-dashboard .alert-row:hover { transform: none; }
        @media print {
          .phi-dashboard .premium-card, .phi-dashboard .mini-stat-card, .phi-dashboard .health-ring-card { background: white; box-shadow: none; break-inside: avoid; }
          .phi-dashboard .premium-card:hover, .phi-dashboard .mini-stat-card:hover, .phi-dashboard .health-ring-card:hover { transform: none; }
          .phi-dashboard .card-value { -webkit-text-fill-color: currentColor; }
        }
      `}</style>
    </MasterPage>
  );
}
