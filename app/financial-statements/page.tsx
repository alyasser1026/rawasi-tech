"use client";
import { currencySymbol } from '@/lib/currency';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import MasterPage from '@/components/MasterPage';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/helpers';
import { notify } from '@/lib/notify';
import LoadingScreen from '@/components/LoadingScreen';
import styles from './financial-statements.module.css';
import {
  TrendingUp, TrendingDown, Scale, Printer, RefreshCw, Landmark,
  FileSpreadsheet, Calendar, Percent, CheckCircle, AlertTriangle, ShieldCheck
} from 'lucide-react';

export default function FinancialStatementsPage() {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yearStartStr = useMemo(() => `${new Date().getFullYear()}-01-01`, []);

  const [activeTab, setActiveTab] = useState<'income' | 'balance' | 'kpis'>('income');
  const [startDate, setStartDate] = useState(yearStartStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [asOfDate, setAsOfDate] = useState(todayStr);
  const [comparePrev, setComparePrev] = useState(true);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [incomeData, setIncomeData] = useState<any>(null);
  const [balanceData, setBalanceData] = useState<any>(null);
  const [kpiData, setKpiData] = useState<any>(null);
  const [isMigrationPending, setIsMigrationPending] = useState(false);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [incomeRes, balanceRes, kpiRes] = await Promise.all([
        supabase.rpc('get_income_statement_by_period', {
          p_start_date: startDate,
          p_end_date: endDate,
          p_compare_prev: comparePrev
        }),
        supabase.rpc('get_balance_sheet_as_of', {
          p_as_of_date: asOfDate,
          p_compare_prev: comparePrev
        }),
        supabase.rpc('get_financial_kpis', {
          p_start_date: startDate,
          p_end_date: endDate
        })
      ]);

      const isMissingRpc = 
        incomeRes.error?.code === 'PGRST202' || balanceRes.error?.code === 'PGRST202' || kpiRes.error?.code === 'PGRST202';
      setIsMigrationPending(Boolean(isMissingRpc));

      if (incomeRes.error) {
        if (!isMissingRpc) console.error('Income statement RPC error:', incomeRes.error);
      } else {
        setIncomeData(incomeRes.data);
      }

      if (balanceRes.error) {
        console.error('Balance sheet RPC error:', balanceRes.error);
        notify.error('تعذر تحميل بيانات المركز المالي');
      } else {
        setBalanceData(balanceRes.data);
      }

      if (kpiRes.error) {
        console.error('KPIs RPC error:', kpiRes.error);
      } else {
        setKpiData(kpiRes.data);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching financial data:', err);
      notify.error('حدث خطأ أثناء جلب القوائم المالية');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, asOfDate, comparePrev]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    notify.success('تم تحديث القوائم المالية بنجاح');
  };

  const applyPreset = (preset: 'ytd' | 'mtd' | 'prev_year' | 'last_month') => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    if (preset === 'ytd') {
      setStartDate(`${curYear}-01-01`);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'mtd') {
      const mStr = String(curMonth + 1).padStart(2, '0');
      setStartDate(`${curYear}-${mStr}-01`);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'prev_year') {
      setStartDate(`${curYear - 1}-01-01`);
      setEndDate(`${curYear - 1}-12-31`);
    } else if (preset === 'last_month') {
      const prevM = curMonth === 0 ? 11 : curMonth - 1;
      const prevYear = curMonth === 0 ? curYear - 1 : curYear;
      const lastDay = new Date(prevYear, prevM + 1, 0).getDate();
      const mStr = String(prevM + 1).padStart(2, '0');
      setStartDate(`${prevYear}-${mStr}-01`);
      setEndDate(`${prevYear}-${mStr}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  // CSV Export
  const exportToCsv = () => {
    if (!incomeData || !balanceData) return;
    let csvContent = '\uFEFF'; // UTF-8 BOM

    if (activeTab === 'income') {
      csvContent += 'قائمة الدخل عن الفترة من,' + startDate + ',إلى,' + endDate + '\n';
      csvContent += 'القسم,كود الحساب,اسم الحساب,المبلغ (' + currencySymbol() + ')\n';

      (incomeData.sections?.revenues || []).forEach((r: any) => {
        csvContent += `إيرادات,${r.code},"${r.name}",${r.balance}\n`;
      });
      csvContent += `إجمالي الإيرادات,,,${incomeData.summary?.total_revenue}\n`;

      (incomeData.sections?.project_costs || []).forEach((c: any) => {
        csvContent += `تكاليف مباشرة (${c.cost_category}),${c.code},"${c.name}",${c.balance}\n`;
      });
      csvContent += `إجمالي تكاليف المشاريع,,,${incomeData.summary?.total_project_costs}\n`;
      csvContent += `مجمل الربح (الهامش ${incomeData.summary?.gross_margin_pct}%),,,${incomeData.summary?.gross_profit}\n`;

      (incomeData.sections?.admin_expenses || []).forEach((e: any) => {
        csvContent += `مصروفات إدارية,${e.code},"${e.name}",${e.balance}\n`;
      });
      csvContent += `إجمالي المصروفات الإدارية,,,${incomeData.summary?.total_admin_expenses}\n`;
      csvContent += `صافي الدخل (الهامش ${incomeData.summary?.net_margin_pct}%),,,${incomeData.summary?.net_income}\n`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Income_Statement_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      csvContent += 'قائمة المركز المالي في تاريخ,' + asOfDate + '\n';
      csvContent += 'القسم,كود الحساب,اسم الحساب,المبلغ (' + currencySymbol() + ')\n';

      (balanceData.sections?.current_assets || []).forEach((a: any) => {
        csvContent += `أصول متداولة,${a.code},"${a.name}",${a.balance}\n`;
      });
      (balanceData.sections?.fixed_assets || []).forEach((a: any) => {
        csvContent += `أصول ثابتة,${a.code},"${a.name}",${a.balance}\n`;
      });
      csvContent += `إجمالي الأصول,,,${balanceData.summary?.total_assets}\n`;

      (balanceData.sections?.current_liabilities || []).forEach((l: any) => {
        csvContent += `التزامات متداولة,${l.code},"${l.name}",${l.balance}\n`;
      });
      (balanceData.sections?.longterm_liabilities || []).forEach((l: any) => {
        csvContent += `التزامات طويلة الأجل,${l.code},"${l.name}",${l.balance}\n`;
      });
      (balanceData.sections?.equity || []).forEach((e: any) => {
        csvContent += `حقوق ملكية,${e.code},"${e.name}",${e.balance}\n`;
      });
      csvContent += `صافي دخل الفترة,,,${balanceData.summary?.current_period_net_income}\n`;
      csvContent += `إجمالي الالتزامات وحقوق الملكية,,,${balanceData.summary?.total_liabilities_and_equity}\n`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Balance_Sheet_${asOfDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const isBalanced = balanceData?.is_balanced;
  const balanceDiff = Number(balanceData?.difference || 0);

  return (
    <MasterPage
      title="القوائم المالية والمركز المالي"
      subtitle="قائمة الدخل الدقيقة بفترة، والمركز المالي المتزن آلياً، ومؤشرات السيولة"
    >
      <div className={`clean-page enterprise-page ${styles.container}`}>
        <style>{`
          .clean-page.enterprise-page input[type="date"] {
            color-scheme: light;
          }
        `}</style>
        {/* Filter Card */}
        {isMigrationPending && (
          <div style={{
            background: 'rgba(234, 88, 12, 0.08)',
            border: '1px solid rgba(234, 88, 12, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: 'var(--fs-sm)',
            fontWeight: 700
          }}>
            <AlertTriangle size={20} color="#ea580c" />
            <div>
              <strong>تنبيه:</strong> دوال القوائم المالية وقائمة الدخل غير مفعلة بقاعدة البيانات بعد. لتفعيلها فوراً، يرجى تشغيل ملف الميجريشن <code>PACK_2_ASSETS_INVENTORY_RADAR_PROFITABILITY.sql</code> في <strong>Supabase SQL Editor</strong>.
            </div>
          </div>
        )}
        <div className={styles.filterCard}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>من تاريخ (بداية الفترة)</label>
              <input
                type="date"
                className={styles.inputField}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>إلى تاريخ (نهاية الفترة)</label>
              <input
                type="date"
                className={styles.inputField}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>تاريخ المركز المالي (As-of)</label>
              <input
                type="date"
                className={styles.inputField}
                value={asOfDate}
                onChange={e => setAsOfDate(e.target.value)}
              />
            </div>
            <div className={styles.filterGroup} style={{ flexDirection: 'row', alignItems: 'center', minWidth: 'auto', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <input
                type="checkbox"
                id="comparePrev"
                checked={comparePrev}
                onChange={e => setComparePrev(e.target.checked)}
                style={{ accentColor: 'var(--accent-main)', width: '1.125rem', height: '1.125rem', cursor: 'pointer' }}
              />
              <label htmlFor="comparePrev" className={styles.filterLabel} style={{ cursor: 'pointer' }}>
                مقارنة بالفترة السابقة
              </label>
            </div>
            <div className={styles.actionsBar} style={{ marginRight: 'auto' }}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'جاري التحديث...' : 'تحديث الأرقام'}
              </button>
              <button type="button" className={styles.btnSecondary} onClick={exportToCsv}>
                <FileSpreadsheet size={15} />
                تصدير إكسل
              </button>
              <button type="button" className={styles.btnSecondary} onClick={() => window.print()}>
                <Printer size={15} />
                طباعة
              </button>
            </div>
          </div>

          <div className={styles.presetButtons}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary)' }}>فترات سريعة:</span>
            <button type="button" className={styles.presetBtn} onClick={() => applyPreset('ytd')}>السنة الحالية (YTD)</button>
            <button type="button" className={styles.presetBtn} onClick={() => applyPreset('mtd')}>هذا الشهر (MTD)</button>
            <button type="button" className={styles.presetBtn} onClick={() => applyPreset('last_month')}>الشهر الماضي</button>
            <button type="button" className={styles.presetBtn} onClick={() => applyPreset('prev_year')}>السنة السابقة كاملة</button>
          </div>
        </div>

        {/* Global KPI Strip */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>
              <span>إجمالي الإيرادات (Revenues)</span>
              <TrendingUp size={16} color="var(--accent-ink)" />
            </div>
            <div className={styles.kpiValue}>{formatCurrency(incomeData?.summary?.total_revenue || 0)}</div>
            {comparePrev && incomeData?.previous_period && (
              <div className={`${styles.kpiSub} ${incomeData.previous_period.revenue_change >= 0 ? styles.tagPositive : styles.tagNegative}`}>
                {incomeData.previous_period.revenue_change >= 0 ? '▲ +' : '▼ '}
                {incomeData.previous_period.revenue_change_pct}% مقارنة بالفترة السابقة
              </div>
            )}
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>
              <span>مجمل الربح (Gross Profit)</span>
              <Percent size={16} color="var(--status-positive)" />
            </div>
            <div className={styles.kpiValue}>{formatCurrency(incomeData?.summary?.gross_profit || 0)}</div>
            <div className={`${styles.kpiSub} ${incomeData?.summary?.gross_profit >= 0 ? styles.tagPositive : styles.tagNegative}`}>
              هامش مجمل الربح: {incomeData?.summary?.gross_margin_pct || 0}%
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>
              <span>صافي الدخل (Net Income)</span>
              <Scale size={16} color={incomeData?.summary?.net_income >= 0 ? 'var(--status-positive)' : 'var(--status-negative)'} />
            </div>
            <div className={styles.kpiValue} style={{ color: incomeData?.summary?.net_income >= 0 ? 'var(--status-positive)' : 'var(--status-negative)' }}>
              {formatCurrency(incomeData?.summary?.net_income || 0)}
            </div>
            <div className={`${styles.kpiSub} ${incomeData?.summary?.net_income >= 0 ? styles.tagPositive : styles.tagNegative}`}>
              هامش صافي الدخل: {incomeData?.summary?.net_margin_pct || 0}%
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>
              <span>توازن المركز المالي (Balance Sheet)</span>
              {isBalanced ? <CheckCircle size={16} color="var(--status-positive)" /> : <AlertTriangle size={16} color="var(--status-negative)" />}
            </div>
            <div className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>
              {isBalanced ? (
                <span className={styles.tagPositive}>متزنة 100%</span>
              ) : (
                <span className={styles.tagNegative}>فرق: {formatCurrency(balanceDiff)}</span>
              )}
            </div>
            <div className={styles.kpiSub} style={{ color: 'var(--text-secondary)' }}>
              إجمالي الأصول: {formatCurrency(balanceData?.summary?.total_assets || 0)}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabsContainer}>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'income' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('income')}
          >
            <TrendingUp size={16} />
            قائمة الدخل (P&L)
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'balance' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('balance')}
          >
            <Landmark size={16} />
            المركز المالي (Balance Sheet)
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'kpis' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('kpis')}
          >
            <Percent size={16} />
            مؤشرات الأداء والسيولة والتحصيل
          </button>
        </div>

        {loading ? (
          <LoadingScreen message="جاري استخراج القوائم المالية من قيود اليومية المرحّلة..." fullScreen={false} />
        ) : (
          <>
            {/* TAB 1: INCOME STATEMENT */}
            {activeTab === 'income' && incomeData && (
              <div className={styles.statementTableCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <TrendingUp size={20} color="var(--accent-ink)" />
                    قائمة الدخل عن الفترة من {incomeData.period?.start_date} إلى {incomeData.period?.end_date}
                  </div>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    عدد الأيام: {incomeData.period?.duration_days} يوم
                  </span>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.financialTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '120px' }}>كود الحساب</th>
                        <th>بيان الحساب / البند</th>
                        <th style={{ width: '160px', textAlign: 'left' }}>المبلغ بالفترة ({currencySymbol()})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Section 1: Revenues */}
                      <tr className={styles.subtotalRow}>
                        <td colSpan={3}>1. الإيرادات التشغيلية (4)</td>
                      </tr>
                      {(incomeData.sections?.revenues || []).map((r: any) => (
                        <tr key={r.account_id}>
                          <td>{r.code}</td>
                          <td>{r.name}</td>
                          <td className={styles.amountCell}>{formatCurrency(r.balance)}</td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td>—</td>
                        <td>إجمالي الإيرادات</td>
                        <td className={styles.amountCell}>{formatCurrency(incomeData.summary?.total_revenue || 0)}</td>
                      </tr>

                      {/* Section 2: Direct Project Costs */}
                      <tr className={styles.subtotalRow}>
                        <td colSpan={3}>2. تكاليف العمليات والمشاريع المباشرة (51)</td>
                      </tr>
                      {(incomeData.sections?.project_costs || []).map((c: any) => (
                        <tr key={c.account_id}>
                          <td>{c.code}</td>
                          <td>
                            {c.name}
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
                              ({c.cost_category === 'materials' ? 'خامات' :
                                c.cost_category === 'labor' ? 'عمالة مباشرة' :
                                c.cost_category === 'subcontractors' ? 'مقاولو باطن' :
                                c.cost_category === 'equipment' ? 'معدات' :
                                c.cost_category === 'site_expenses' ? 'مصاريف موقع' :
                                c.cost_category === 'depreciation' ? 'إهلاك عمليات' : 'تشغيل'})
                            </span>
                          </td>
                          <td className={styles.amountCell}>{formatCurrency(c.balance)}</td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td>—</td>
                        <td>إجمالي تكاليف المشاريع المباشرة</td>
                        <td className={styles.amountCell}>{formatCurrency(incomeData.summary?.total_project_costs || 0)}</td>
                      </tr>

                      {/* Gross Profit Row */}
                      <tr className={styles.subtotalRow} style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent-ink)' }}>
                        <td>—</td>
                        <td>مجمل الربح (Gross Profit) — الهامش: {incomeData.summary?.gross_margin_pct}%</td>
                        <td className={styles.amountCell} style={{ color: 'var(--accent-ink)' }}>{formatCurrency(incomeData.summary?.gross_profit || 0)}</td>
                      </tr>

                      {/* Section 3: Admin & General Expenses */}
                      <tr className={styles.subtotalRow}>
                        <td colSpan={3}>3. المصروفات العمومية والإدارية (52)</td>
                      </tr>
                      {(incomeData.sections?.admin_expenses || []).map((e: any) => (
                        <tr key={e.account_id}>
                          <td>{e.code}</td>
                          <td>{e.name}</td>
                          <td className={styles.amountCell}>{formatCurrency(e.balance)}</td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td>—</td>
                        <td>إجمالي المصروفات العمومية والإدارية</td>
                        <td className={styles.amountCell}>{formatCurrency(incomeData.summary?.total_admin_expenses || 0)}</td>
                      </tr>

                      {/* Net Income Row */}
                      <tr className={incomeData.summary?.net_income >= 0 ? styles.grandTotalRow : styles.lossTotalRow}>
                        <td>—</td>
                        <td>
                          {incomeData.summary?.net_income >= 0 ? 'صافي الربح للفترة (Net Profit)' : 'صافي الخسارة للفترة (Net Loss)'}
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, marginRight: '0.75rem' }}>
                            (هامش صافي الربح: {incomeData.summary?.net_margin_pct}%)
                          </span>
                        </td>
                        <td className={styles.amountCell}>{formatCurrency(incomeData.summary?.net_income || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: BALANCE SHEET */}
            {activeTab === 'balance' && balanceData && (
              <div className={styles.statementTableCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Landmark size={20} color="var(--status-positive)" />
                    قائمة المركز المالي كما في {balanceData.as_of_date}
                  </div>
                  <div className={`${styles.balanceBadge} ${isBalanced ? styles.balanced : styles.unbalanced}`}>
                    {isBalanced ? (
                      <>
                        <ShieldCheck size={16} />
                        المعادلة المحاسبية متزنة تماماً (الفرق: 0.00 {currencySymbol()})
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} />
                        يوجد فارق توازن: {formatCurrency(balanceDiff)}
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.financialTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '120px' }}>كود الحساب</th>
                        <th>الحساب / البند</th>
                        <th style={{ width: '160px', textAlign: 'left' }}>الرصيد ({currencySymbol()})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ASSETS SECTION */}
                      <tr className={styles.subtotalRow} style={{ background: 'rgba(56, 189, 248, 0.2)' }}>
                        <td colSpan={3}>أولاً: الأصــول (Assets)</td>
                      </tr>

                      {/* Current Assets */}
                      <tr className={styles.subtotalRow}>
                        <td colSpan={3}>1. الأصول المتداولة (12)</td>
                      </tr>
                      {(balanceData.sections?.current_assets || []).map((a: any) => (
                        <tr key={a.account_id}>
                          <td>{a.code}</td>
                          <td>{a.name}</td>
                          <td className={styles.amountCell}>{formatCurrency(a.balance)}</td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td>—</td>
                        <td>إجمالي الأصول المتداولة</td>
                        <td className={styles.amountCell}>{formatCurrency(balanceData.summary?.total_current_assets || 0)}</td>
                      </tr>

                      {/* Fixed Assets */}
                      <tr className={styles.subtotalRow}>
                        <td colSpan={3}>2. الأصول الثابتة بصافي القيمة الدفترية (11)</td>
                      </tr>
                      {(balanceData.sections?.fixed_assets || []).map((a: any) => (
                        <tr key={a.account_id}>
                          <td>{a.code}</td>
                          <td>
                            {a.name}
                            {a.is_contra && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--status-negative)', marginRight: '0.5rem' }}>(مجمع إهلاك - بند مخصوم)</span>}
                          </td>
                          <td className={styles.amountCell} style={{ color: a.is_contra ? 'var(--status-negative)' : 'inherit' }}>
                            {formatCurrency(a.balance)}
                          </td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td>—</td>
                        <td>صافي الأصول الثابتة</td>
                        <td className={styles.amountCell}>{formatCurrency(balanceData.summary?.total_fixed_assets || 0)}</td>
                      </tr>

                      {/* Other Assets if any */}
                      {(balanceData.sections?.other_assets || []).length > 0 && (
                        <>
                          <tr className={styles.subtotalRow}>
                            <td colSpan={3}>3. أصول أخرى</td>
                          </tr>
                          {(balanceData.sections?.other_assets || []).map((a: any) => (
                            <tr key={a.account_id}>
                              <td>{a.code}</td>
                              <td>{a.name}</td>
                              <td className={styles.amountCell}>{formatCurrency(a.balance)}</td>
                            </tr>
                          ))}
                        </>
                      )}

                      {/* Total Assets Row */}
                      <tr className={styles.grandTotalRow}>
                        <td>—</td>
                        <td>إجمالي الأصـــول (Total Assets)</td>
                        <td className={styles.amountCell}>{formatCurrency(balanceData.summary?.total_assets || 0)}</td>
                      </tr>

                      {/* LIABILITIES & EQUITY SECTION */}
                      <tr className={styles.subtotalRow} style={{ background: 'rgba(245, 158, 11, 0.2)' }}>
                        <td colSpan={3}>ثانياً: الالتزامات وحقوق الملكية (Liabilities & Equity)</td>
                      </tr>

                      {/* Current Liabilities */}
                      <tr className={styles.subtotalRow}>
                        <td colSpan={3}>1. الالتزامات المتداولة (21)</td>
                      </tr>
                      {(balanceData.sections?.current_liabilities || []).map((l: any) => (
                        <tr key={l.account_id}>
                          <td>{l.code}</td>
                          <td>{l.name}</td>
                          <td className={styles.amountCell}>{formatCurrency(l.balance)}</td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td>—</td>
                        <td>إجمالي الالتزامات المتداولة</td>
                        <td className={styles.amountCell}>{formatCurrency(balanceData.summary?.total_current_liabilities || 0)}</td>
                      </tr>

                      {/* Long term liabilities if any */}
                      {(balanceData.sections?.longterm_liabilities || []).length > 0 && (
                        <>
                          <tr className={styles.subtotalRow}>
                            <td colSpan={3}>2. الالتزامات غير المتداولة (22)</td>
                          </tr>
                          {(balanceData.sections?.longterm_liabilities || []).map((l: any) => (
                            <tr key={l.account_id}>
                              <td>{l.code}</td>
                              <td>{l.name}</td>
                              <td className={styles.amountCell}>{formatCurrency(l.balance)}</td>
                            </tr>
                          ))}
                        </>
                      )}

                      {/* Equity */}
                      <tr className={styles.subtotalRow}>
                        <td colSpan={3}>3. حقوق الملكية وأرباح الفترة (23)</td>
                      </tr>
                      {(balanceData.sections?.equity || []).map((e: any) => (
                        <tr key={e.account_id}>
                          <td>{e.code}</td>
                          <td>{e.name}</td>
                          <td className={styles.amountCell}>{formatCurrency(e.balance)}</td>
                        </tr>
                      ))}
                      {Number(balanceData.summary?.prior_years_pnl || 0) !== 0 && (
                        <tr>
                          <td>—</td>
                          <td>أرباح / (خسائر) سنوات سابقة مرحّلة</td>
                          <td className={styles.amountCell}>{formatCurrency(balanceData.summary?.prior_years_pnl || 0)}</td>
                        </tr>
                      )}
                      <tr>
                        <td>—</td>
                        <td>صافي ربح / (خسارة) الفترة الحالية</td>
                        <td className={styles.amountCell} style={{ color: Number(balanceData.summary?.current_period_net_income || 0) >= 0 ? 'var(--status-positive)' : 'var(--status-negative)' }}>
                          {formatCurrency(balanceData.summary?.current_period_net_income || 0)}
                        </td>
                      </tr>
                      <tr className={styles.totalRow}>
                        <td>—</td>
                        <td>إجمالي حقوق الملكية وأرباح الفترة</td>
                        <td className={styles.amountCell}>{formatCurrency(balanceData.summary?.total_equity_with_income || 0)}</td>
                      </tr>

                      {/* Total Liabilities & Equity Row */}
                      <tr className={styles.grandTotalRow} style={{ background: isBalanced ? 'radial-gradient(ellipse 90% 70% at 50% -20%, color-mix(in srgb, var(--status-positive) 14%, transparent), transparent 75%), var(--surface-subcard)' : 'radial-gradient(ellipse 90% 70% at 50% -20%, color-mix(in srgb, var(--status-negative) 14%, transparent), transparent 75%), var(--surface-subcard)', color: isBalanced ? 'var(--status-positive)' : 'var(--status-negative)' }}>
                        <td>—</td>
                        <td>إجمالي الالتزامات وحقوق الملكية (Total Liabilities & Equity)</td>
                        <td className={styles.amountCell}>{formatCurrency(balanceData.summary?.total_liabilities_and_equity || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: FINANCIAL KPIS & RATIOS */}
            {activeTab === 'kpis' && kpiData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Liquidity Ratios */}
                <div className={styles.statementTableCard}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <Scale size={20} color="var(--accent-ink)" />
                      مؤشرات السيولة والقدرة على الوفاء بالالتزامات (Liquidity Ratios)
                    </div>
                  </div>
                  <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}>نسبة التداول الحالية (Current Ratio)</div>
                      <div className={styles.kpiValue}>{kpiData.liquidity_metrics?.current_ratio || 0}</div>
                      <div className={styles.kpiSub} style={{ color: Number(kpiData.liquidity_metrics?.current_ratio || 0) >= 1.5 ? 'var(--status-positive)' : 'var(--status-warning)' }}>
                        {Number(kpiData.liquidity_metrics?.current_ratio || 0) >= 1.5 ? 'مستوى سيولة آمن ومريح (> 1.5)' : 'مستوى سيولة يستوجب المراقبة'}
                      </div>
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}>نسبة السيولة السريعة (Quick Ratio)</div>
                      <div className={styles.kpiValue}>{kpiData.liquidity_metrics?.quick_ratio || 0}</div>
                      <div className={styles.kpiSub} style={{ color: Number(kpiData.liquidity_metrics?.quick_ratio || 0) >= 1.0 ? 'var(--status-positive)' : 'var(--status-warning)' }}>
                        (النقدية + الذمم المدينة) / الالتزامات المتداولة
                      </div>
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}>النقدية وما في حكمها بالبنوك</div>
                      <div className={styles.kpiValue}>{formatCurrency(kpiData.liquidity_metrics?.cash_and_banks || 0)}</div>
                      <div className={styles.kpiSub}>جاهزة للوفاء بالمستحقات الفورية</div>
                    </div>
                  </div>
                </div>

                {/* Collection & DSO */}
                <div className={styles.statementTableCard}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <Percent size={20} color="var(--status-positive)" />
                      كفاءة التحصيل وإدارة الذمم المدينة (Collection Rate & DSO)
                    </div>
                  </div>
                  <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}>معدل التحصيل النقدي من الفواتير</div>
                      <div className={styles.kpiValue}>{kpiData.collection_metrics?.collection_rate_pct || 0}%</div>
                      <div className={styles.kpiSub}>
                        المحصل: {formatCurrency(kpiData.collection_metrics?.total_collected || 0)} من أصل {formatCurrency(kpiData.collection_metrics?.total_invoiced || 0)}
                      </div>
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}>متوسط فترة التحصيل بالأيام (DSO)</div>
                      <div className={styles.kpiValue}>{kpiData.collection_metrics?.dso_days || 0} يوم</div>
                      <div className={styles.kpiSub}>
                        رصيد العملاء القائم: {formatCurrency(kpiData.collection_metrics?.ar_balance || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top / Least Profitable Projects */}
                <div className={styles.statementTableCard}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <TrendingUp size={20} color="var(--accent-ink)" />
                      ترتيب المشاريع حسب مساهمتها في الربحية
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {/* Top Profitable */}
                    <div>
                      <h4 style={{ color: 'var(--status-positive)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle size={16} />
                        أعلى 3 مشاريع ربحية
                      </h4>
                      <div className={styles.tableWrapper}>
                        <table className={styles.financialTable}>
                          <thead>
                            <tr>
                              <th>المشروع</th>
                              <th style={{ textAlign: 'left' }}>الإيراد</th>
                              <th style={{ textAlign: 'left' }}>صافي الربح</th>
                              <th>الهامش</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(kpiData.project_rankings?.top_profitable || []).map((p: any) => (
                              <tr key={p.project_id}>
                                <td>{p.project_name}</td>
                                <td className={styles.amountCell}>{formatCurrency(p.revenue)}</td>
                                <td className={styles.amountCell} style={{ color: 'var(--status-positive)' }}>{formatCurrency(p.net_profit)}</td>
                                <td style={{ fontWeight: 600 }}>{p.margin_pct}%</td>
                              </tr>
                            ))}
                            {(kpiData.project_rankings?.top_profitable || []).length === 0 && (
                              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد بيانات</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Least Profitable */}
                    <div>
                      <h4 style={{ color: 'var(--status-negative)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertTriangle size={16} />
                        المشاريع الأقل ربحية أو الأكثر تعثراً
                      </h4>
                      <div className={styles.tableWrapper}>
                        <table className={styles.financialTable}>
                          <thead>
                            <tr>
                              <th>المشروع</th>
                              <th style={{ textAlign: 'left' }}>التكلفة</th>
                              <th style={{ textAlign: 'left' }}>صافي النتيجة</th>
                              <th>الهامش</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(kpiData.project_rankings?.least_profitable || []).map((p: any) => (
                              <tr key={p.project_id}>
                                <td>{p.project_name}</td>
                                <td className={styles.amountCell}>{formatCurrency(p.costs)}</td>
                                <td className={styles.amountCell} style={{ color: p.net_profit >= 0 ? 'var(--status-positive)' : 'var(--status-negative)' }}>
                                  {formatCurrency(p.net_profit)}
                                </td>
                                <td style={{ fontWeight: 600 }}>{p.margin_pct}%</td>
                              </tr>
                            ))}
                            {(kpiData.project_rankings?.least_profitable || []).length === 0 && (
                              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد بيانات</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MasterPage>
  );
}
