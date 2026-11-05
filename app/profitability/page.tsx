"use client";
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import MasterPage from '@/components/MasterPage';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/helpers';
import { notify } from '@/lib/notify';
import LoadingScreen from '@/components/LoadingScreen';
import styles from './profitability.module.css';
import {
  TrendingUp, TrendingDown, Scale, Printer, RefreshCw,
  FileSpreadsheet, ShieldCheck, AlertTriangle, Building2, CheckCircle
} from 'lucide-react';

export default function ProjectProfitabilityPage() {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yearStartStr = useMemo(() => `${new Date().getFullYear()}-01-01`, []);

  const [startDate, setStartDate] = useState(yearStartStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [projectsList, setProjectsList] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profitabilityData, setProfitabilityData] = useState<any>(null);

  // 1. Fetch available projects for dropdown
  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, "Property", project_code')
        .order('project_name', { ascending: true });

      if (error) {
        console.error('Error fetching projects dropdown:', error);
      } else {
        setProjectsList(data || []);
      }
    } catch (err) {
      console.error('Failed to load projects list:', err);
    }
  }, []);

  // 2. Fetch profitability summary from RPC
  const fetchProfitability = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_projects_profitability_summary', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_project_id: selectedProjectId === 'all' ? null : selectedProjectId
      });

      if (error) {
        console.error('Profitability RPC error:', error);
        notify.error('تعذر جلب تقرير ربحية المشاريع');
      } else {
        setProfitabilityData(data);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching profitability:', err);
      notify.error('حدث خطأ أثناء تحميل ربحية المشاريع');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, selectedProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchProfitability();
  }, [fetchProfitability]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProfitability();
    notify.success('تم تحديث أرقام ربحية المشاريع');
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

  // Export to CSV
  const exportToCsv = () => {
    if (!profitabilityData) return;
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += `تقرير ربحية المشاريع ومطابقة الأستاذ العام عن الفترة من,${startDate},إلى,${endDate}\n`;
    csvContent += 'كود المشروع,اسم المشروع,العميل,الحالة,الإيرادات (4),الخامات (511),العمالة (512),مقاولو الباطن (513),المعدات والإهلاك (514/516),مصاريف الموقع والأخرى (515/517),إجمالي التكاليف,صافي الربح,هامش الربح %,قيمة العقد,موازنة المقايسة (BOQ),نسبة الاستهلاك %\n';

    (profitabilityData.projects || []).forEach((p: any) => {
      const equipDeprec = (p.costs?.equipment || 0) + (p.costs?.depreciation || 0);
      const siteOther = (p.costs?.site_expenses || 0) + (p.costs?.other_direct || 0);
      csvContent += `"${p.project_code || ''}","${p.project_name || ''}","${p.client_name || ''}","${p.project_status || ''}",${p.revenue},${p.costs?.materials || 0},${p.costs?.labor || 0},${p.costs?.subcontractors || 0},${equipDeprec},${siteOther},${p.costs?.total || 0},${p.net_profit},${p.margin_pct}%,${p.boq_comparison?.contract_value || 0},${p.boq_comparison?.estimated_cost || 0},${p.boq_comparison?.cost_burn_pct || 0}%\n`;
    });

    if (profitabilityData.unallocated) {
      const u = profitabilityData.unallocated;
      csvContent += `"UNALLOC","${u.title_ar}","—","—",${u.revenue},—,—,—,—,—,${u.costs},${u.net_profit},—,—,—,—\n`;
    }

    if (profitabilityData.summary) {
      const s = profitabilityData.summary;
      csvContent += `"TOTAL","إجمالي العمليات الشامل والمطابق للأستاذ","—","—",${s.total_combined_revenue},—,—,—,—,—,${s.total_combined_costs},${s.total_combined_profit},${s.overall_margin_pct}%,—,—,—\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Projects_Profitability_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isReconciled = profitabilityData?.reconciliation?.is_reconciled;
  const glVariance = Number(profitabilityData?.reconciliation?.variance || 0);

  return (
    <MasterPage
      title="ربحية المشاريع ومطابقة الأستاذ العام"
      subtitle="تحليل تكاليف وإيرادات كل مشروع بمقارنة موازنة المقايسة (BOQ) مع مطابقة 100% للقيود"
    >
      <div className={styles.container}>
        {/* Filter Card */}
        <div className={styles.filterCard}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>المشروع المستهدف</label>
              <select
                className={styles.selectField}
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
              >
                <option value="all">جميع المشاريع النشطة (عرض شامل)</option>
                {projectsList.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.project_name || p["Property"]} {p.project_code ? `(${p.project_code})` : ''}
                  </option>
                ))}
              </select>
            </div>
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
            <div className={styles.actionsBar} style={{ marginRight: 'auto' }}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'جاري التحديث...' : 'تحديث التقرير'}
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
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>فترات سريعة:</span>
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
              <span>إجمالي إيرادات العمليات (Revenues)</span>
              <TrendingUp size={16} color="#38bdf8" />
            </div>
            <div className={styles.kpiValue}>
              {formatCurrency(profitabilityData?.summary?.total_combined_revenue || 0)}
            </div>
            <div className={styles.kpiSub} style={{ color: '#94a3b8' }}>
              المشاريع: {formatCurrency(profitabilityData?.summary?.projects_revenue || 0)} | عام: {formatCurrency(profitabilityData?.summary?.unallocated_revenue || 0)}
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>
              <span>إجمالي التكاليف المباشرة (Direct Costs)</span>
              <TrendingDown size={16} color="#f59e0b" />
            </div>
            <div className={styles.kpiValue}>
              {formatCurrency(profitabilityData?.summary?.total_combined_costs || 0)}
            </div>
            <div className={styles.kpiSub} style={{ color: '#94a3b8' }}>
              المشاريع: {formatCurrency(profitabilityData?.summary?.projects_costs || 0)} | عام: {formatCurrency(profitabilityData?.summary?.unallocated_costs || 0)}
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>
              <span>صافي ربح العمليات (Operating Profit)</span>
              <Scale size={16} color={Number(profitabilityData?.summary?.total_combined_profit || 0) >= 0 ? '#10b981' : '#ef4444'} />
            </div>
            <div
              className={styles.kpiValue}
              style={{ color: Number(profitabilityData?.summary?.total_combined_profit || 0) >= 0 ? '#34d399' : '#f87171' }}
            >
              {formatCurrency(profitabilityData?.summary?.total_combined_profit || 0)}
            </div>
            <div className={styles.kpiSub} style={{ color: Number(profitabilityData?.summary?.total_combined_profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
              الهامش التشغيلي العام: {profitabilityData?.summary?.overall_margin_pct || 0}%
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>
              <span>عدد المشاريع النشطة بالفترة</span>
              <Building2 size={16} color="#a78bfa" />
            </div>
            <div className={styles.kpiValue} style={{ color: '#c4b5fd' }}>
              {profitabilityData?.projects_count || 0} مشروع
            </div>
            <div className={styles.kpiSub} style={{ color: '#94a3b8' }}>
              مشاريع ذات حركة مالية مرحلة
            </div>
          </div>
        </div>

        {/* Reconciliation Status Card */}
        <div className={styles.reconciliationCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>حالة مطابقة الأستاذ العام (GL Invariance Check):</span>
            <div className={isReconciled ? styles.reconciledPill : styles.unreconciledPill}>
              {isReconciled ? (
                <>
                  <ShieldCheck size={16} />
                  مطابقة تامة 100% مع الأستاذ العام (حسابات 4 و 51) — الفارق: 0.00 ر.س
                </>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  يوجد فارق عدم مطابقة: {formatCurrency(glVariance)} ر.س
                </>
              )}
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            إجمالي إيراد الأستاذ (4): {formatCurrency(profitabilityData?.reconciliation?.gl_total_revenue || 0)} |
            إجمالي تكاليف الأستاذ (51): {formatCurrency(profitabilityData?.reconciliation?.gl_total_project_costs || 0)}
          </div>
        </div>

        {loading ? (
          <LoadingScreen message="جاري تحليل تكاليف المشاريع ومطابقة قيود اليومية..." fullScreen={false} />
        ) : (
          <div className={styles.matrixCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Building2 size={20} color="#38bdf8" />
                مصفوفة تكاليف وربحية المشاريع ومقارنة الموازنات (BOQ)
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                الفترة من {profitabilityData?.period?.start_date} إلى {profitabilityData?.period?.end_date}
              </span>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.profitTable}>
                <thead>
                  <tr>
                    <th>كود المشروع</th>
                    <th>اسم المشروع والعميل</th>
                    <th style={{ textAlign: 'left' }}>الإيرادات (4)</th>
                    <th style={{ textAlign: 'left' }}>الخامات (511)</th>
                    <th style={{ textAlign: 'left' }}>العمالة (512)</th>
                    <th style={{ textAlign: 'left' }}>مقاولو الباطن (513)</th>
                    <th style={{ textAlign: 'left' }}>المعدات والإهلاك (514/516)</th>
                    <th style={{ textAlign: 'left' }}>مصاريف الموقع (515)</th>
                    <th style={{ textAlign: 'left' }}>إجمالي التكلفة</th>
                    <th style={{ textAlign: 'left' }}>صافي الربح</th>
                    <th>الهامش %</th>
                    <th style={{ textAlign: 'left' }}>موازنة BOQ</th>
                    <th>استهلاك الموازنة</th>
                  </tr>
                </thead>
                <tbody>
                  {(profitabilityData?.projects || []).map((p: any) => {
                    const equipDeprec = (p.costs?.equipment || 0) + (p.costs?.depreciation || 0);
                    const burnPct = Number(p.boq_comparison?.cost_burn_pct || 0);
                    const isBurnOver = burnPct > 100;
                    const isBurnNear = burnPct >= 80 && burnPct <= 100;

                    return (
                      <tr key={p.project_id}>
                        <td style={{ fontWeight: 600 }}>{p.project_code || '—'}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.project_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {p.client_name ? `العميل: ${p.client_name}` : ''} {p.project_status ? `• ${p.project_status}` : ''}
                          </div>
                        </td>
                        <td className={styles.amountCell} style={{ color: '#38bdf8' }}>{formatCurrency(p.revenue)}</td>
                        <td className={styles.amountCell}>{formatCurrency(p.costs?.materials || 0)}</td>
                        <td className={styles.amountCell}>{formatCurrency(p.costs?.labor || 0)}</td>
                        <td className={styles.amountCell}>{formatCurrency(p.costs?.subcontractors || 0)}</td>
                        <td className={styles.amountCell}>{formatCurrency(equipDeprec)}</td>
                        <td className={styles.amountCell}>{formatCurrency(p.costs?.site_expenses || 0)}</td>
                        <td className={styles.amountCell} style={{ fontWeight: 700, color: '#f59e0b' }}>
                          {formatCurrency(p.costs?.total || 0)}
                        </td>
                        <td
                          className={styles.amountCell}
                          style={{
                            fontWeight: 700,
                            color: Number(p.net_profit || 0) >= 0 ? '#34d399' : '#f87171'
                          }}
                        >
                          {formatCurrency(p.net_profit || 0)}
                        </td>
                        <td style={{ fontWeight: 700, textAlign: 'center', color: Number(p.net_profit || 0) >= 0 ? '#34d399' : '#f87171' }}>
                          {p.margin_pct}%
                        </td>
                        <td className={styles.amountCell} style={{ color: '#cbd5e1' }}>
                          {formatCurrency(p.boq_comparison?.estimated_cost || 0)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isBurnOver ? '#ef4444' : isBurnNear ? '#f59e0b' : '#10b981' }}>
                              {burnPct}%
                            </span>
                            <div className={styles.burnProgress}>
                              <div
                                className={`${styles.burnBar} ${isBurnOver ? styles.burnDanger : isBurnNear ? styles.burnWarning : styles.burnSafe}`}
                                style={{ width: `${Math.min(burnPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {(profitabilityData?.projects || []).length === 0 && (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        لا توجد حركات تكاليف أو إيرادات مسجلة للمشاريع خلال هذه الفترة
                      </td>
                    </tr>
                  )}

                  {/* Unallocated Operational Row */}
                  {profitabilityData?.unallocated && (
                    <tr className={styles.unallocatedRow}>
                      <td style={{ fontWeight: 600 }}>غير محدد</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{profitabilityData.unallocated.title_ar}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          مواد مستودعات مركزية وإهلاك عام غير مرتبط بمشروع معين
                        </div>
                      </td>
                      <td className={styles.amountCell} style={{ color: '#38bdf8' }}>{formatCurrency(profitabilityData.unallocated.revenue || 0)}</td>
                      <td className={styles.amountCell} colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>
                        تكاليف تشغيل عامة موزعة دفترية
                      </td>
                      <td className={styles.amountCell} style={{ fontWeight: 700, color: '#f59e0b' }}>
                        {formatCurrency(profitabilityData.unallocated.costs || 0)}
                      </td>
                      <td
                        className={styles.amountCell}
                        style={{
                          fontWeight: 700,
                          color: Number(profitabilityData.unallocated.net_profit || 0) >= 0 ? '#34d399' : '#f87171'
                        }}
                      >
                        {formatCurrency(profitabilityData.unallocated.net_profit || 0)}
                      </td>
                      <td style={{ textAlign: 'center' }}>—</td>
                      <td className={styles.amountCell}>—</td>
                      <td style={{ textAlign: 'center' }}>—</td>
                    </tr>
                  )}

                  {/* Grand Combined GL Reconciled Row */}
                  {profitabilityData?.summary && (
                    <tr className={styles.glTotalRow}>
                      <td colSpan={2} style={{ fontWeight: 800 }}>
                        الإجمالي الشامل المطابق للأستاذ العام (100% GL Reconciliation)
                      </td>
                      <td className={styles.amountCell} style={{ color: '#38bdf8', fontWeight: 800 }}>
                        {formatCurrency(profitabilityData.summary.total_combined_revenue || 0)}
                      </td>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#7dd3fc', fontWeight: 600 }}>
                        إجمالي تكاليف العمليات المباشرة (حساب 51)
                      </td>
                      <td className={styles.amountCell} style={{ color: '#f59e0b', fontWeight: 800 }}>
                        {formatCurrency(profitabilityData.summary.total_combined_costs || 0)}
                      </td>
                      <td
                        className={styles.amountCell}
                        style={{
                          fontWeight: 800,
                          color: Number(profitabilityData.summary.total_combined_profit || 0) >= 0 ? '#34d399' : '#f87171'
                        }}
                      >
                        {formatCurrency(profitabilityData.summary.total_combined_profit || 0)}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>
                        {profitabilityData.summary.overall_margin_pct}%
                      </td>
                      <td className={styles.amountCell}>—</td>
                      <td style={{ textAlign: 'center' }}>—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MasterPage>
  );
}
