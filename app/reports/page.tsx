"use client";
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useReportsLogic } from './reports_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import KpiStrip from '@/components/KpiStrip';
import LoadingScreen from '@/components/LoadingScreen';
import { formatCurrency } from '@/lib/helpers';
import { buildDocumentFileName } from '@/lib/documentFileName';
import AllProjectsPrintModal from './AllProjectsPrintModal';
import {
  Building2,
  ChevronLeft,
  DollarSign,
  FileSpreadsheet,
  HardHat,
  Layers,
  Printer,
  Receipt,
  RefreshCw,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';

export default function ReportsPage() {
  const logic = useReportsLogic();
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const d = logic.reportData;
  const t = d?.totals;

  const exportFullExcel = () => {
    if (!d || !t) return;
    const wb = XLSX.utils.book_new();

    // 1. شيت ملخص المشاريع
    const projectsSheetData = d.projectsMatrix.map((p: any) => ({
      'المشروع / الفيلا': p.name,
      'النموذج': p.unit_type,
      'المساحة (م2)': p.unit_area,
      'العميل': p.client_name,
      'قيمة التعاقد (BOQ)': p.contract_value,
      'خصم خامات العميل (217)': p.client_materials_deduction,
      'صافي العقد بعد الخامات': p.contract_after_materials,
      'محتجز ضمان الأعمال (10%)': p.retention_amount,
      'المبلغ المستلم (غير شامل ضمان الأعمال)': p.client_net_ex_retention,
      'المتبقي عند العميل (شامل الضمان)': p.client_remaining,
      'الموازنة التقديرية الشاملة': p.estimated_budget,
      'موازنة التنفيذ (بدون خامات العميل)': p.estimated_execution_budget,
      'يوميات العمالة': p.labor_total,
      'عدد اليوميات': p.labor_days,
      'مستخلصات المقاولين': p.claims_total,
      'خامات على حساب الشركة': p.company_materials_cost,
      'المصاريف الموزعة (ABC)': p.abc_expenses_total,
      'تكلفة التنفيذ الفعلية (بدون خامات العميل)': p.total_actual_cost,
      'المتبقي من الموازنة': p.remaining_budget,
      'الربح المستهدف ضمن الموازنة (غير شامل الضمان)': p.target_profit_budget_ex_retention,
      'الربح المستهدف ضمن الموازنة (شامل الضمان)': p.target_profit_budget,
      'الربح المتوقع EAC (غير شامل الضمان)': p.expected_profit_eac_ex_retention,
      'الربح المتوقع EAC (شامل الضمان)': p.expected_profit_eac,
      'هامش الربح المتوقع %': p.expected_margin_pct,
      'الربح الفعلي (غير شامل الضمان)': p.actual_profit_ex_retention,
      'الربح الفعلي (شامل الضمان)': p.net_contract_margin,
      'معامل الانحراف (CPI)': p.deviation_factor ?? '---',
      'نسبة الانحراف %': p.variance_pct,
      'حالة الانحراف': p.variance_status,
      'سندات الصرف المباشرة': p.direct_pv_total,
    }));
    projectsSheetData.push({
      'المشروع / الفيلا': 'الإجمالي العام',
      'النموذج': '---',
      'المساحة (م2)': d.projectsMatrix.reduce((s: number, p: any) => s + p.unit_area, 0),
      'العميل': '---',
      'قيمة التعاقد (BOQ)': t.totalContractValue,
      'خصم خامات العميل (217)': t.totalClientMaterialsDeduction,
      'صافي العقد بعد الخامات': t.totalContractAfterMaterials,
      'محتجز ضمان الأعمال (10%)': t.totalRetentionAmount,
      'المبلغ المستلم (غير شامل ضمان الأعمال)': t.totalClientNetExRetention,
      'المتبقي عند العميل (شامل الضمان)': t.totalClientRemaining,
      'الموازنة التقديرية الشاملة': t.totalEstimatedBudget,
      'موازنة التنفيذ (بدون خامات العميل)': t.totalEstimatedExecutionBudget,
      'يوميات العمالة': t.totalLaborEarned,
      'عدد اليوميات': d.projectsMatrix.reduce((s: number, p: any) => s + p.labor_days, 0),
      'مستخلصات المقاولين': t.totalClaimsNet,
      'خامات على حساب الشركة': t.totalCompanyMaterials,
      'المصاريف الموزعة (ABC)': t.totalExpensesAmount,
      'تكلفة التنفيذ الفعلية (بدون خامات العميل)': t.totalActualProjectCosts,
      'المتبقي من الموازنة': t.totalRemainingBudget,
      'الربح المستهدف ضمن الموازنة (غير شامل الضمان)': t.totalTargetProfitBudgetExRetention,
      'الربح المستهدف ضمن الموازنة (شامل الضمان)': t.totalTargetProfitBudget,
      'الربح المتوقع EAC (غير شامل الضمان)': t.totalExpectedProfitEacExRetention,
      'الربح المتوقع EAC (شامل الضمان)': t.totalExpectedProfitEac,
      'هامش الربح المتوقع %': t.totalExpectedMarginPct,
      'الربح الفعلي (غير شامل الضمان)': t.totalActualProfitExRetention,
      'الربح الفعلي (شامل الضمان)': t.totalNetContractMargin,
      'معامل الانحراف (CPI)': t.overallDeviationFactor ?? '---',
      'نسبة الانحراف %': t.overallVariancePct,
      'حالة الانحراف': t.overallVariancePct >= 0 ? 'ضمن الموازنة' : 'تجاوز للموازنة',
      'سندات الصرف المباشرة': t.pvClaimsTotal,
    });
    const wsProjects = XLSX.utils.json_to_sheet(projectsSheetData);
    wsProjects['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsProjects, 'حسابات_المشاريع');

    // 2. شيت حسابات العمالة والمتبقي
    const workersSheetData = d.workersSummary.map((w: any) => ({
      'اسم العامل / الفني': w.name,
      'عدد الأيام': w.days,
      'إجمالي المستحق (اليوميات)': w.earned,
      'المدفوع بسندات صرف': w.paid,
      'الرصيد المتبقي للعامل': w.remaining,
      'توزيع الفلل': w.villasText,
    }));
    const wsWorkers = XLSX.utils.json_to_sheet(workersSheetData);
    wsWorkers['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsWorkers, 'حسابات_العمالة_والمتبقي');

    // 3. شيت سندات القبض
    const rvSheetData = d.receiptVouchers.map((r: any) => ({
      'رقم السند': r.receipt_number,
      'التاريخ': r.date,
      'المبلغ': Number(r.amount) || 0,
      'الجهة / الشريك': r.partner_name,
      'طريقة الدفع': r.payment_method,
      'المشروع / التوجيه': r.projects_label,
      'الحالة': r.status,
      'البيان': r.notes || '---',
    }));
    const wsRv = XLSX.utils.json_to_sheet(rvSheetData);
    wsRv['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsRv, 'سندات_القبض');

    // 4. شيت سندات الصرف
    const pvSheetData = d.paymentVouchers.map((v: any) => ({
      'رقم السند': v.voucher_number,
      'التاريخ': v.date,
      'المبلغ': Number(v.amount) || 0,
      'التصنيف': v.category,
      'المستفيد': v.partner_name,
      'المشروع': v.projects_label,
      'الحالة': v.is_posted ? 'معتمد' : 'مسودة',
      'البيان': v.description || v.notes || '---',
    }));
    const wsPv = XLSX.utils.json_to_sheet(pvSheetData);
    wsPv['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsPv, 'سندات_الصرف');

    // 5. شيت المصاريف والتوزيع
    const expSheetData = d.expenses.map((e: any) => ({
      'التاريخ': e.exp_date,
      'التصنيف': e.main_category || 'مصروف عام',
      'البيان': e.display_description,
      'المبلغ': e.net_amount,
      'توزيع المصروف على الفلل (ABC)': e.distribution_text,
    }));
    const wsExp = XLSX.utils.json_to_sheet(expSheetData);
    wsExp['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsExp, 'المصاريف_وتوزيعها');

    const { fileName } = buildDocumentFileName({
      docType: 'التقرير_المالي_الشامل_للمشاريع',
      prefix: 'MASTER-FIN',
      seedParts: [d.projectsMatrix.length],
      ext: 'xlsx',
    });
    XLSX.writeFile(wb, fileName);
  };

  const handlePrintAll = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <div className="clean-page print-container">
      <MasterPage
        title="التقرير المالي الشامل للمشاريع والحسابات"
        subtitle="بيان تفصيلي وتراكمي لجميع الفلل، المقايسات، المصاريف، سندات القبض، سندات الصرف، الخامات، العمالة، والأرصدة المتبقية"
      >
        <RawasiSidebarManager
          actions={
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button type="button" className="btn-main-glass gold" onClick={exportFullExcel} disabled={!d}>
                <FileSpreadsheet size={16} aria-hidden="true" />
                <span>تصدير التقرير الشامل (Excel)</span>
              </button>
              <button type="button" className="btn-main-glass rpt-btn-neutral" onClick={handlePrintAll} disabled={!d}>
                <Printer size={16} aria-hidden="true" />
                <span>طباعة التقرير الكامل (PDF)</span>
              </button>
              <button
                type="button"
                className="btn-main-glass rpt-btn-neutral"
                onClick={logic.handleRefresh}
                disabled={logic.isLoading}
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>{logic.isLoading ? 'جاري التحديث...' : 'تحديث البيانات اللحظية'}</span>
              </button>
            </div>
          }
          summary={
            t ? (
              <KpiStrip
                compact
                items={[
                  { label: 'إجمالي عقود المشاريع', amount: t.totalContractValue, tone: 'brand', icon: <Building2 /> },
                  { label: 'المبلغ المستلم (غير شامل ضمان الأعمال)', amount: t.totalClientNetExRetention, tone: 'success', icon: <DollarSign /> },
                  { label: 'إجمالي التكاليف الفعلية', amount: t.totalActualProjectCosts, tone: 'warning', icon: <Layers /> },
                  { label: 'صافي سيولة الخزينة', amount: t.netCashTreasury, tone: 'info', icon: <Wallet /> },
                ]}
              />
            ) : null
          }
          customFilters={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="rpt-filter-label">تصفية حسب المشروع (الفيلا)</label>
                <select
                  className="rpt-input"
                  value={logic.selectedProjectId}
                  onChange={(e) => logic.setSelectedProjectId(e.target.value)}
                >
                  <option value="all">جميع المشاريع ({d?.projectsList?.length || 0} فلل)</option>
                  {(d?.projectsList || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.Property || p.project_name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="rpt-filter-label">من تاريخ</label>
                  <input
                    type="date"
                    className="rpt-input"
                    value={logic.dateRange.start}
                    onChange={(e) => logic.handleDateChange('start', e.target.value)}
                  />
                </div>
                <div>
                  <label className="rpt-filter-label">إلى تاريخ</label>
                  <input
                    type="date"
                    className="rpt-input"
                    value={logic.dateRange.end}
                    onChange={(e) => logic.handleDateChange('end', e.target.value)}
                  />
                </div>
              </div>
              {(logic.dateRange.start || logic.dateRange.end || logic.selectedProjectId !== 'all') && (
                <button type="button" className="btn-main-glass rpt-btn-neutral" onClick={logic.resetFilters}>
                  عرض التقرير التراكمي الكامل
                </button>
              )}
            </div>
          }
          watchDeps={[logic.dateRange, logic.selectedProjectId, logic.activeTab, d]}
        />

        <style>{`
          .rpt-input {
            width: 100%;
            padding: 0.6rem 0.75rem;
            border-radius: 12px;
            background: var(--surface-sunken);
            border: 1px solid var(--control-edge, rgba(148, 163, 184, 0.16));
            box-shadow: var(--shadow-sunken);
            color: var(--text-primary);
            font-weight: 700;
            font-size: var(--fs-sm);
            outline: none;
            color-scheme: var(--native-color-scheme);
          }
          .rpt-input option { background: var(--surface-card); color: var(--text-primary); }
          .rpt-filter-label {
            display: block;
            font-size: var(--fs-xs);
            font-weight: 800;
            color: var(--text-secondary);
            margin-bottom: 0.35rem;
          }
          .btn-main-glass {
            width: 100%;
            padding: 0.75rem 0.9rem;
            border-radius: 12px;
            border: none;
            font-weight: 900;
            cursor: pointer;
            transition: 0.2s;
            font-size: var(--fs-sm);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }
          .rpt-btn-neutral {
            background: var(--surface-subcard);
            color: var(--text-primary);
            border: 1px solid var(--control-edge, rgba(148, 163, 184, 0.16));
          }
          .rpt-kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
            gap: 0.9rem;
            margin-bottom: 1.25rem;
          }
          .rpt-kpi-card {
            background: var(--surface-card);
            border-radius: 18px;
            padding: 1.1rem 1.25rem;
            box-shadow: var(--shadow-ambient);
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
          }
          .rpt-kpi-card small {
            font-size: var(--fs-xs);
            font-weight: 800;
            color: var(--text-secondary);
          }
          .rpt-kpi-card strong {
            font-size: var(--fs-xl);
            font-weight: 900;
            font-variant-numeric: tabular-nums;
          }
          .rpt-kpi-card span {
            font-size: var(--fs-xs);
            font-weight: 700;
            color: var(--text-muted);
          }
          .rpt-tabs {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
            margin-bottom: 1.25rem;
            background: var(--surface-card);
            padding: 0.5rem;
            border-radius: 16px;
            box-shadow: var(--shadow-ambient);
          }
          .rpt-tab-btn {
            padding: 0.6rem 1.1rem;
            border-radius: 11px;
            border: none;
            font-weight: 900;
            font-size: var(--fs-sm);
            cursor: pointer;
            transition: 0.18s;
            background: transparent;
            color: var(--text-secondary);
          }
          .rpt-tab-btn.is-active {
            background: var(--action-fill);
            color: var(--action-ink);
          }
          .rpt-section-card {
            background: var(--surface-card);
            border-radius: 20px;
            padding: 1.35rem;
            box-shadow: var(--shadow-ambient);
            margin-bottom: 1.35rem;
            overflow-x: auto;
          }
          .rpt-section-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid var(--table-zebra-bg);
          }
          .rpt-section-title h3 {
            margin: 0;
            font-size: var(--fs-lg);
            font-weight: 900;
            color: var(--text-primary);
          }
          .rpt-table {
            width: 100%;
            min-width: 58rem;
            border-collapse: collapse;
            text-align: center;
          }
          .rpt-table th {
            background: var(--table-head-bg);
            color: var(--text-secondary);
            padding: 0.85rem 0.65rem;
            font-size: var(--fs-xs);
            font-weight: 900;
            border-bottom: 1px solid var(--table-zebra-bg);
            white-space: nowrap;
          }
          .rpt-table td {
            padding: 0.8rem 0.65rem;
            font-size: var(--fs-sm);
            font-weight: 700;
            color: var(--text-primary);
            border-bottom: 1px solid var(--table-zebra-bg);
            font-variant-numeric: tabular-nums;
            vertical-align: middle;
          }
          .rpt-table tbody tr:hover {
            background: var(--table-row-hover);
          }
          .rpt-table tfoot td {
            background: var(--surface-subcard);
            font-weight: 900;
            color: var(--accent-ink);
            border-top: 2px solid rgba(249, 115, 22, 0.35);
          }
          @media print {
            @page { size: A4 landscape; margin: 8mm 10mm; }
            .no-print { display: none !important; }
            .rpt-section-card, .rpt-kpi-card { background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important; color: #0f172a !important; box-shadow: none !important; border: 0 !important; overflow: visible !important; padding: 0.5rem !important; }
            .rpt-table { min-width: 0 !important; width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border: 0 !important; font-size: 9px !important; }
            .rpt-table th { background: #1e293b !important; color: #fff !important; border: 0 !important; white-space: normal !important; word-wrap: break-word !important; overflow-wrap: break-word !important; padding: 5px 3px !important; font-size: 9px !important; }
            .rpt-table td { color: #0f172a !important; border: 0 !important; white-space: normal !important; word-wrap: break-word !important; overflow-wrap: break-word !important; padding: 5px 3px !important; font-size: 9px !important; }
            .rpt-table tbody tr:nth-child(even) td { background: #f1f5f9 !important; }
          }
        `}</style>

        {logic.isLoading || !d || !t ? (
          <LoadingScreen message="جاري تجميع الحسابات والمصاريف والسندات لجميع المشاريع..." fullScreen={false} />
        ) : (
          <div>
            {/* 📊 المؤشرات المالية والتدفقات النقدية الشاملة */}
            <div className="rpt-kpi-grid">
              <div className="rpt-kpi-card">
                <small>إجمالي عقود المشاريع (BOQ)</small>
                <strong style={{ color: 'var(--accent-ink)' }}>{formatCurrency(t.totalContractValue)}</strong>
                <span>
                  خصم خامات (217): {formatCurrency(t.totalClientMaterialsDeduction)} • صافي بعد الخامات:{' '}
                  {formatCurrency(t.totalContractAfterMaterials)}
                </span>
              </div>
              <div className="rpt-kpi-card">
                <small>المبلغ المستلم للمشاريع (غير شامل ضمان الأعمال)</small>
                <strong style={{ color: 'var(--status-positive, #10b981)' }}>{formatCurrency(t.totalClientNetExRetention)}</strong>
                <span>
                  بعد خصم الخامات ({formatCurrency(t.totalClientMaterialsDeduction)}) ثم خصم ضمان الأعمال 10% ({formatCurrency(t.totalRetentionAmount)})
                </span>
              </div>
              <div className="rpt-kpi-card">
                <small>الربح المتوقع الواقعي EAC (غير شامل الضمان)</small>
                <strong style={{ color: t.totalExpectedProfitEacExRetention >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
                  {t.totalExpectedProfitEacExRetention > 0 ? '+' : ''}
                  {formatCurrency(t.totalExpectedProfitEacExRetention)}
                </strong>
                <span>
                  شامل الضمان: {formatCurrency(t.totalExpectedProfitEac)} ({t.totalExpectedMarginPct}%) • مستهدف الموازنة:{' '}
                  {t.totalTargetProfitBudgetExRetention > 0 ? '+' : ''}
                  {formatCurrency(t.totalTargetProfitBudgetExRetention)}
                </span>
              </div>
              <div className="rpt-kpi-card">
                <small>الربح الفعلي ومعامل الانحراف (CPI)</small>
                <strong style={{ color: t.totalActualProfitExRetention >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
                  {t.totalActualProfitExRetention > 0 ? '+' : ''}
                  {formatCurrency(t.totalActualProfitExRetention)}
                </strong>
                <span>
                  شامل الضمان: {formatCurrency(t.totalNetContractMargin)} • معامل الانحراف:{' '}
                  <b style={{ color: (t.overallDeviationFactor ?? 1) >= 1 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
                    {t.overallDeviationFactor !== null ? t.overallDeviationFactor.toFixed(2) : '---'} ({t.overallVariancePct > 0 ? '+' : ''}{t.overallVariancePct}%)
                  </b>
                </span>
              </div>
              <div className="rpt-kpi-card">
                <small>سندات القبض المستلمة (غير شامل ضمان الأعمال)</small>
                <strong style={{ color: 'var(--status-positive, #10b981)' }}>{formatCurrency(t.totalReceiptVouchers)}</strong>
                <span>صرف: {formatCurrency(t.totalPaymentVouchers)} • سيولة الخزينة: {formatCurrency(t.netCashTreasury)}</span>
              </div>
              <div className="rpt-kpi-card">
                <small>الأرصدة المستحقة للعمالة والمقاولين</small>
                <strong style={{ color: 'var(--status-negative, #f43f5e)' }}>
                  {formatCurrency(t.totalLaborRemaining + t.totalClaimsRemaining)}
                </strong>
                <span>
                  متبقي عمالة: {formatCurrency(t.totalLaborRemaining)} • متبقي مقاولين: {formatCurrency(t.totalClaimsRemaining)}
                </span>
              </div>
            </div>

            {/* تبويبات التقرير */}
            <div className="rpt-tabs no-print">
              {[
                { key: 'all', label: 'التقرير الشامل الكامل' },
                { key: 'projects', label: `حسابات المشاريع (${d.projectsMatrix.length})` },
                { key: 'workers', label: `العمالة والمقاولين والمتبقي (${d.workersSummary.length})` },
                { key: 'vouchers', label: `سندات القبض والصرف (${d.receiptVouchers.length + d.paymentVouchers.length})` },
                { key: 'expenses', label: `المصاريف وتوزيعها (${d.expenses.length})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => logic.setActiveTab(tab.key as any)}
                  className={`rpt-tab-btn ${logic.activeTab === tab.key ? 'is-active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 1️⃣ جدول حسابات جميع المشاريع (الفلل) */}
            {(logic.activeTab === 'all' || logic.activeTab === 'projects') && (
              <div className="rpt-section-card">
                <div className="rpt-section-title">
                  <h3>1. مصفوفة حسابات المشاريع (الفلل) والتكاليف والمبلغ المستلم غير شامل ضمان الأعمال</h3>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    اضغط على أي فيلا لعرض تفاصيل البنود وأوامر الشغل واليوميات والخامات والمصاريف والسندات
                  </span>
                </div>
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>المشروع / الفيلا</th>
                      <th>النموذج والمساحة</th>
                      <th>قيمة التعاقد (BOQ)</th>
                      <th>خصم خامات العميل</th>
                      <th>ضمان الأعمال (10%)</th>
                      <th>المبلغ المستلم (غير شامل ضمان الأعمال)</th>
                      <th>موازنة التنفيذ</th>
                      <th>يوميات العمالة</th>
                      <th>مستخلصات المقاولين</th>
                      <th>خامات الشركة</th>
                      <th>المصاريف (ABC)</th>
                      <th>تكلفة التنفيذ الفعلية</th>
                      <th>الربح المستهدف (الموازنة)</th>
                      <th>الربح المتوقع (EAC)</th>
                      <th>الربح الفعلي</th>
                      <th>معامل الانحراف (CPI)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.projectsMatrix.map((p: any) => {
                      const isExpanded = expandedProjects.includes(p.id);
                      return (
                        <React.Fragment key={p.id}>
                          <tr onClick={() => toggleProject(p.id)} style={{ cursor: 'pointer' }}>
                            <td style={{ textAlign: 'right', fontWeight: 900 }}>
                              <span
                                className="no-print"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '1.4rem',
                                  height: '1.4rem',
                                  borderRadius: '6px',
                                  background: 'var(--accent-soft-bg)',
                                  color: 'var(--accent-ink)',
                                  marginLeft: '0.4rem',
                                  transform: isExpanded ? 'rotate(-90deg)' : 'none',
                                  transition: '0.2s',
                                }}
                              >
                                <ChevronLeft size={13} />
                              </span>
                              {p.name}
                            </td>
                            <td>
                              <span style={{ fontWeight: 800, color: 'var(--accent-ink)' }}>{p.unit_type}</span>
                              {p.unit_area > 0 ? ` • ${p.unit_area} م²` : ''}
                            </td>
                            <td style={{ fontWeight: 900 }}>{formatCurrency(p.contract_value)}</td>
                            <td style={{ color: 'var(--status-info, #38bdf8)' }}>{formatCurrency(p.client_materials_deduction)}</td>
                            <td style={{ color: 'var(--status-warning, #f59e0b)', fontWeight: 800 }}>
                              {formatCurrency(p.retention_amount)}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({p.retention_percentage}%) بعد الخامات</div>
                            </td>
                            <td style={{ fontWeight: 900, color: 'var(--status-positive, #10b981)' }}>
                              {formatCurrency(p.client_net_ex_retention)}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                قبل الضمان: {formatCurrency(p.contract_after_materials)}
                                {p.receipts_total > 0 ? ` • متبقي: ${formatCurrency(p.client_remaining)}` : ''}
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {formatCurrency(p.estimated_execution_budget)}
                              {p.estimated_execution_budget !== p.estimated_budget && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  كلية: {formatCurrency(p.estimated_budget)}
                                </div>
                              )}
                            </td>
                            <td>
                              {formatCurrency(p.labor_total)}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({p.labor_days} يومية)</div>
                            </td>
                            <td>{formatCurrency(p.claims_total)}</td>
                            <td>{formatCurrency(p.company_materials_cost)}</td>
                            <td>{formatCurrency(p.abc_expenses_total)}</td>
                            <td style={{ fontWeight: 900, color: 'var(--status-warning, #f59e0b)' }}>
                              {formatCurrency(p.total_actual_cost)}
                            </td>
                            <td
                              style={{
                                fontWeight: 900,
                                color: p.target_profit_budget_ex_retention >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)',
                              }}
                            >
                              {p.target_profit_budget_ex_retention > 0 ? '+' : ''}
                              {formatCurrency(p.target_profit_budget_ex_retention)}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                شامل: {formatCurrency(p.target_profit_budget)} ({p.target_margin_pct}%)
                              </div>
                            </td>
                            <td
                              style={{
                                fontWeight: 900,
                                color: p.expected_profit_eac_ex_retention >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)',
                              }}
                            >
                              {p.expected_profit_eac_ex_retention > 0 ? '+' : ''}
                              {formatCurrency(p.expected_profit_eac_ex_retention)}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                شامل: {formatCurrency(p.expected_profit_eac)} ({p.expected_margin_pct}%)
                              </div>
                            </td>
                            <td
                              style={{
                                fontWeight: 900,
                                color: p.actual_profit_ex_retention >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)',
                              }}
                            >
                              {p.actual_profit_ex_retention > 0 ? '+' : ''}
                              {formatCurrency(p.actual_profit_ex_retention)}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                شامل: {formatCurrency(p.net_contract_margin)}
                              </div>
                            </td>
                            <td
                              style={{
                                fontWeight: 900,
                                color:
                                  p.deviation_factor === null
                                    ? 'var(--text-muted)'
                                    : p.deviation_factor >= 1
                                      ? 'var(--status-positive, #10b981)'
                                      : 'var(--status-negative, #f43f5e)',
                              }}
                            >
                              <span dir="ltr">{p.deviation_factor !== null ? p.deviation_factor.toFixed(2) : '---'}</span>
                              <div style={{ fontSize: '0.7rem', color: p.variance_pct >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
                                {p.variance_pct > 0 ? '+' : ''}{p.variance_pct}% • {p.variance_status}
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={16} style={{ background: 'var(--surface-sunken)', padding: '1rem 1.25rem', textAlign: 'right' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))', gap: '1rem' }}>
                                  {/* أوامر الشغل والمستخلصات */}
                                  <div style={{ background: 'var(--surface-card)', padding: '0.9rem', borderRadius: '12px' }}>
                                    <div style={{ fontWeight: 900, color: 'var(--accent-ink)', marginBottom: '0.5rem', fontSize: 'var(--fs-sm)' }}>
                                      أوامر الشغل والمستخلصات وسندات الصرف ({p.name})
                                    </div>
                                    {p.jobOrders.map((jo: any) => (
                                      <div key={jo.id} style={{ fontSize: 'var(--fs-xs)', padding: '0.3rem 0', borderBottom: '1px solid var(--table-zebra-bg)' }}>
                                        <b>{jo.order_number}</b> — {jo.contractor_name} • الكمية: {jo.assigned_qty} × {jo.unit_price} ={' '}
                                        <b>{formatCurrency(jo.total_value)}</b>
                                      </div>
                                    ))}
                                    {p.claims.map((clm: any) => (
                                      <div key={clm.id} style={{ fontSize: 'var(--fs-xs)', padding: '0.3rem 0', color: 'var(--status-positive, #10b981)' }}>
                                        مستخلص <b>{clm.claim_number}</b> ({clm.contractor_name}): <b>{formatCurrency(clm.net_amount)}</b>
                                      </div>
                                    ))}
                                    {p.paymentVouchers.map((pv: any) => (
                                      <div key={pv.id} style={{ fontSize: 'var(--fs-xs)', padding: '0.3rem 0', color: 'var(--status-warning, #f59e0b)' }}>
                                        سند صرف <b>{pv.voucher_number}</b> ({pv.date}): <b>{formatCurrency(pv.amount)}</b> — {pv.description}
                                      </div>
                                    ))}
                                  </div>

                                  {/* يوميات العمالة والخامات */}
                                  <div style={{ background: 'var(--surface-card)', padding: '0.9rem', borderRadius: '12px' }}>
                                    <div style={{ fontWeight: 900, color: 'var(--accent-ink)', marginBottom: '0.5rem', fontSize: 'var(--fs-sm)' }}>
                                      يوميات العمالة والخامات ({p.name})
                                    </div>
                                    {p.laborLogs.length === 0 ? (
                                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>لا توجد يوميات مسجلة</div>
                                    ) : (
                                      p.laborLogs.map((l: any) => (
                                        <div key={l.id} style={{ fontSize: 'var(--fs-xs)', padding: '0.25rem 0', borderBottom: '1px solid var(--table-zebra-bg)' }}>
                                          {l.work_date} — <b>{l.worker_name}</b>: {formatCurrency(l.daily_wage)}
                                        </div>
                                      ))
                                    )}
                                    {p.materialReceipts.map((m: any) => (
                                      <div key={m.id} style={{ fontSize: 'var(--fs-xs)', padding: '0.3rem 0', color: 'var(--status-info, #38bdf8)' }}>
                                        فاتورة خامات <b>{m.receipt_number}</b> ({m.receipt_type}): <b>{formatCurrency(m.total_amount)}</b>
                                      </div>
                                    ))}
                                  </div>

                                  {/* نصيب الفيلا من المصاريف الموزعة ABC */}
                                  <div style={{ background: 'var(--surface-card)', padding: '0.9rem', borderRadius: '12px' }}>
                                    <div style={{ fontWeight: 900, color: 'var(--accent-ink)', marginBottom: '0.5rem', fontSize: 'var(--fs-sm)' }}>
                                      نصيب الفيلا من المصاريف التشغيلية ({formatCurrency(p.abc_expenses_total)})
                                    </div>
                                    {p.expenseAllocations.length === 0 ? (
                                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>لا توجد مصاريف محملة</div>
                                    ) : (
                                      p.expenseAllocations.map((a: any) => (
                                        <div key={a.id} style={{ fontSize: 'var(--fs-xs)', padding: '0.25rem 0', borderBottom: '1px solid var(--table-zebra-bg)' }}>
                                          {a['تاريخ المصروف الأصلي']} — {a['البيان / الوصف']} ({a['نسبة التحميل (%)']}%):{' '}
                                          <b>{formatCurrency(a.allocated_amount)}</b>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ textAlign: 'right' }}>الإجمالي العام ({d.projectsMatrix.length} فلل)</td>
                      <td>{d.projectsMatrix.reduce((s: number, p: any) => s + p.unit_area, 0).toFixed(2)} م²</td>
                      <td>{formatCurrency(t.totalContractValue)}</td>
                      <td>{formatCurrency(t.totalClientMaterialsDeduction)}</td>
                      <td>{formatCurrency(t.totalRetentionAmount)}</td>
                      <td>
                        {formatCurrency(t.totalClientNetExRetention)}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          قبل الضمان: {formatCurrency(t.totalContractAfterMaterials)}
                          {t.totalClientRemaining !== t.totalContractAfterMaterials
                            ? ` • متبقي: ${formatCurrency(t.totalClientRemaining)}`
                            : ''}
                        </div>
                      </td>
                      <td>{formatCurrency(t.totalEstimatedExecutionBudget)}</td>
                      <td>{formatCurrency(t.totalLaborEarned)}</td>
                      <td>{formatCurrency(t.totalClaimsNet)}</td>
                      <td>{formatCurrency(t.totalCompanyMaterials)}</td>
                      <td>{formatCurrency(t.totalExpensesAmount)}</td>
                      <td>{formatCurrency(t.totalActualProjectCosts)}</td>
                      <td>
                        {t.totalTargetProfitBudgetExRetention > 0 ? '+' : ''}
                        {formatCurrency(t.totalTargetProfitBudgetExRetention)}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          شامل الضمان: {formatCurrency(t.totalTargetProfitBudget)} ({t.totalTargetMarginPct}%)
                        </div>
                      </td>
                      <td>
                        {t.totalExpectedProfitEacExRetention > 0 ? '+' : ''}
                        {formatCurrency(t.totalExpectedProfitEacExRetention)}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          شامل الضمان: {formatCurrency(t.totalExpectedProfitEac)} ({t.totalExpectedMarginPct}%)
                        </div>
                      </td>
                      <td>
                        {t.totalActualProfitExRetention > 0 ? '+' : ''}
                        {formatCurrency(t.totalActualProfitExRetention)}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          شامل: {formatCurrency(t.totalNetContractMargin)}
                        </div>
                      </td>
                      <td>
                        <span dir="ltr">{t.overallDeviationFactor !== null ? t.overallDeviationFactor.toFixed(2) : '---'}</span>
                        <div style={{ fontSize: '0.7rem', color: t.overallVariancePct >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
                          {t.overallVariancePct > 0 ? '+' : ''}{t.overallVariancePct}%
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* 2️⃣ جدول حسابات العمالة والمقاولين والمتبقي */}
            {(logic.activeTab === 'all' || logic.activeTab === 'workers') && (
              <div className="rpt-section-card">
                <div className="rpt-section-title">
                  <h3>2. حسابات العمالة ومقاولي الباطن (المستحق • المنصرف • المتبقي)</h3>
                </div>
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'right' }}>الاسم / الجهة</th>
                      <th>النوع</th>
                      <th>عدد اليوميات / المستخلصات</th>
                      <th>توزيع العمل على الفلل</th>
                      <th>إجمالي المستحق</th>
                      <th>المدفوع (سندات الصرف)</th>
                      <th>الرصيد المتبقي المستحق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.contractorsSummary.map((c: any) => (
                      <tr key={`con-${c.name}`}>
                        <td style={{ textAlign: 'right', fontWeight: 900 }}>{c.name}</td>
                        <td>
                          <span style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent-ink)', padding: '2px 0.55rem', borderRadius: '999px', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
                            مقاول باطن
                          </span>
                        </td>
                        <td>{c.claimsCount} مستخلصات</td>
                        <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>{c.villas.join(' ، ')}</td>
                        <td style={{ fontWeight: 900 }}>{formatCurrency(c.claimed)}</td>
                        <td style={{ color: 'var(--status-positive, #10b981)', fontWeight: 900 }}>{formatCurrency(c.paid)}</td>
                        <td style={{ color: c.remaining > 0 ? 'var(--status-negative, #f43f5e)' : 'var(--status-positive, #10b981)', fontWeight: 900 }}>
                          {formatCurrency(c.remaining)}
                        </td>
                      </tr>
                    ))}
                    {d.workersSummary.map((w: any) => (
                      <tr key={`wrk-${w.name}`}>
                        <td style={{ textAlign: 'right', fontWeight: 900 }}>{w.name}</td>
                        <td>
                          <span style={{ background: 'rgba(56, 189, 248, 0.14)', color: 'var(--status-info, #38bdf8)', padding: '2px 0.55rem', borderRadius: '999px', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
                            عمالة يومية
                          </span>
                        </td>
                        <td>{w.days} يومية</td>
                        <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>{w.villasText}</td>
                        <td style={{ fontWeight: 900 }}>{formatCurrency(w.earned)}</td>
                        <td style={{ color: 'var(--status-positive, #10b981)', fontWeight: 900 }}>{formatCurrency(w.paid)}</td>
                        <td style={{ color: w.remaining > 0 ? 'var(--status-negative, #f43f5e)' : 'var(--status-positive, #10b981)', fontWeight: 900 }}>
                          {formatCurrency(w.remaining)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ textAlign: 'right' }}>الإجمالي الكلي للعمالة والمقاولين</td>
                      <td>---</td>
                      <td>24 يومية + 5 مستخلصات</td>
                      <td>---</td>
                      <td>{formatCurrency(t.totalLaborEarned + t.totalClaimsNet)}</td>
                      <td>{formatCurrency(t.totalLaborPaid + t.totalClaimsPaid)}</td>
                      <td>{formatCurrency(t.totalLaborRemaining + t.totalClaimsRemaining)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* 3️⃣ جدول سندات القبض وسندات الصرف */}
            {(logic.activeTab === 'all' || logic.activeTab === 'vouchers') && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(28rem, 1fr))', gap: '1.25rem' }}>
                <div className="rpt-section-card">
                  <div className="rpt-section-title">
                    <h3>3. سجل سندات القبض ({d.receiptVouchers.length} سندات)</h3>
                    <strong style={{ color: 'var(--status-positive, #10b981)' }}>{formatCurrency(t.totalReceiptVouchers)}</strong>
                  </div>
                  <table className="rpt-table" style={{ minWidth: '32rem' }}>
                    <thead>
                      <tr>
                        <th>رقم السند</th>
                        <th>التاريخ</th>
                        <th>الجهة / المموّل</th>
                        <th>البيان</th>
                        <th>المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.receiptVouchers.map((r: any) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 900, color: 'var(--accent-ink)' }}>{r.receipt_number}</td>
                          <td>{r.date}</td>
                          <td>{r.partner_name}</td>
                          <td style={{ textAlign: 'right', fontSize: 'var(--fs-xs)' }}>{r.notes || '---'}</td>
                          <td style={{ fontWeight: 900, color: 'var(--status-positive, #10b981)' }}>{formatCurrency(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'right' }}>إجمالي سندات القبض</td>
                        <td>{formatCurrency(t.totalReceiptVouchers)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="rpt-section-card">
                  <div className="rpt-section-title">
                    <h3>4. سجل سندات الصرف ({d.paymentVouchers.length} سنداً)</h3>
                    <strong style={{ color: 'var(--status-negative, #f43f5e)' }}>{formatCurrency(t.totalPaymentVouchers)}</strong>
                  </div>
                  <table className="rpt-table" style={{ minWidth: '36rem' }}>
                    <thead>
                      <tr>
                        <th>رقم السند</th>
                        <th>التاريخ</th>
                        <th>التصنيف</th>
                        <th>المستفيد / المشروع</th>
                        <th>المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.paymentVouchers.map((v: any) => (
                        <tr key={v.id}>
                          <td style={{ fontWeight: 900, color: 'var(--accent-ink)' }}>{v.voucher_number}</td>
                          <td>{v.date}</td>
                          <td style={{ fontSize: 'var(--fs-xs)' }}>{v.category}</td>
                          <td style={{ textAlign: 'right', fontSize: 'var(--fs-xs)' }}>
                            <b>{v.partner_name !== '---' ? v.partner_name : v.projects_label}</b>
                            {v.description ? ` — ${v.description.slice(0, 48)}` : ''}
                          </td>
                          <td style={{ fontWeight: 900, color: 'var(--status-negative, #f43f5e)' }}>{formatCurrency(v.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'right' }}>إجمالي سندات الصرف</td>
                        <td>{formatCurrency(t.totalPaymentVouchers)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 4️⃣ جدول المصاريف وتوزيعها على الفلل */}
            {(logic.activeTab === 'all' || logic.activeTab === 'expenses') && (
              <div className="rpt-section-card">
                <div className="rpt-section-title">
                  <h3>5. سجل المصاريف التشغيلية وتوزيعها على الفلل ({d.expenses.length} مصروفاً)</h3>
                  <strong style={{ color: 'var(--accent-ink)' }}>{formatCurrency(t.totalExpensesAmount)}</strong>
                </div>
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>التصنيف</th>
                      <th style={{ textAlign: 'right' }}>البيان / التفاصيل</th>
                      <th>المبلغ</th>
                      <th style={{ textAlign: 'right' }}>التوزيع الفعلي على المشاريع (ABC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.expenses.map((e: any) => (
                      <tr key={e.id}>
                        <td>{e.exp_date}</td>
                        <td>{e.main_category || 'مصروف عام'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{e.display_description}</td>
                        <td style={{ fontWeight: 900, color: 'var(--accent-ink)' }}>{formatCurrency(e.net_amount)}</td>
                        <td style={{ textAlign: 'right', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                          {e.distribution_text}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right' }}>إجمالي المصاريف التشغيلية الموزعة</td>
                      <td>{formatCurrency(t.totalExpensesAmount)}</td>
                      <td>---</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* مودال المعاينة والطباعة الرسمية الموحدة A4 */}
            <AllProjectsPrintModal
              isOpen={isPrintModalOpen}
              onClose={() => setIsPrintModalOpen(false)}
              reportData={d}
              selectedProjectId={logic.selectedProjectId}
              dateRange={logic.dateRange}
            />
          </div>
        )}
      </MasterPage>
    </div>
  );
}
