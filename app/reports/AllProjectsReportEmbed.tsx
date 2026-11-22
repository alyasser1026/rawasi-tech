"use client";
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useReportsLogic } from './reports_logic';
import LoadingScreen from '@/components/LoadingScreen';
import { formatCurrency } from '@/lib/helpers';
import { buildDocumentFileName } from '@/lib/documentFileName';
import AllProjectsPrintModal from './AllProjectsPrintModal';
import {
  ContractWaterfallChart,
  ProjectsPerformanceCharts,
  WorkersContractorsChart,
  CashFlowVouchersCharts,
  CostStructureAndAbcCharts,
} from './ReportExecutiveCharts';
import { ChevronLeft, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';

export default function AllProjectsReportEmbed() {
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

    const projectsSheetData = d.projectsMatrix.map((p: any) => ({
      'المشروع / الفيلا': p.name,
      'النموذج': p.unit_type,
      'المساحة (م2)': p.unit_area,
      'العميل': p.client_name,
      'قيمة التعاقد (BOQ)': p.contract_value,
      'خصم خامات العميل (217)': p.client_materials_deduction,
      'صافي العقد بعد الخامات': p.contract_after_materials,
      'نسبة ضمان الأعمال %': p.retention_percentage,
      'محتجز ضمان الأعمال': p.retention_amount,
      'صافي المستحق التعاقدي (بدون ضمان الأعمال)': p.client_net_ex_retention,
      'المحصّل فعلياً (سندات القبض)': p.receipts_total,
      'المتبقي عند العميل (شامل الضمان)': p.client_remaining,
      'الموازنة المعتمدة (ميزانية المشروع)': p.estimated_budget,
      'موازنة بنود المقايسة (BOQ)': p.boq_estimated_budget,
      'صافي موازنة التنفيذ (بعد خامات العميل)': p.net_execution_budget_ex_client_materials,
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
      'نسبة ضمان الأعمال %': t.overallRetentionPercentage,
      'محتجز ضمان الأعمال': t.totalRetentionAmount,
      'صافي المستحق التعاقدي (بدون ضمان الأعمال)': t.totalClientNetExRetention,
      'المحصّل فعلياً (سندات القبض)': t.totalProjectReceipts,
      'المتبقي عند العميل (شامل الضمان)': t.totalClientRemaining,
      'الموازنة المعتمدة (ميزانية المشروع)': t.totalEstimatedBudget,
      'موازنة بنود المقايسة (BOQ)': t.totalBoqEstimatedBudget,
      'صافي موازنة التنفيذ (بعد خامات العميل)': t.totalNetExecutionBudgetExClientMaterials,
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

    const matSheetData = (d.materialIssuesDetailed || []).map((m: any) => ({
      'المشروع / الفيلا': m.project_name,
      'رقم الإذن / الفاتورة': m.doc_number,
      'التاريخ': m.doc_date,
      'نوع الحركة': m.doc_type,
      'اسم الصنف / الخامة': m.item_name,
      'الكمية': m.quantity,
      'الوحدة': m.unit,
      'سعر الوحدة': m.unit_price,
      'الإجمالي': m.total_price,
      'ملاحظات': m.notes || '---',
    }));
    const wsMat = XLSX.utils.json_to_sheet(matSheetData);
    wsMat['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsMat, 'تفاصيل_الخامات_المنصرفة');

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

  if (logic.isLoading || !d || !t) {
    return <LoadingScreen message="جاري تجميع الحسابات والمصاريف والسندات لجميع المشاريع..." fullScreen={false} />;
  }

  return (
    <div style={{ direction: 'rtl' }}>
      <style>{`
        .embed-rpt-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.9rem;
          flex-wrap: wrap;
          background: var(--surface-card);
          padding: 1rem 1.25rem;
          border-radius: 18px;
          box-shadow: var(--shadow-ambient);
          margin-bottom: 1.25rem;
        }
        .embed-rpt-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
          gap: 0.9rem;
          margin-bottom: 1.25rem;
        }
        .embed-rpt-kpi-card {
          background: var(--surface-card);
          border-radius: 18px;
          padding: 1.1rem 1.25rem;
          box-shadow: var(--shadow-ambient);
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .embed-rpt-kpi-card small {
          font-size: var(--fs-xs);
          font-weight: 800;
          color: var(--text-secondary);
        }
        .embed-rpt-kpi-card strong {
          font-size: var(--fs-xl);
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .embed-rpt-kpi-card span {
          font-size: var(--fs-xs);
          font-weight: 700;
          color: var(--text-muted);
        }
        .embed-rpt-section {
          background: var(--surface-card);
          border-radius: 20px;
          padding: 1.35rem;
          box-shadow: var(--shadow-ambient);
          margin-bottom: 1.35rem;
          overflow-x: auto;
        }
        .embed-rpt-table {
          width: 100%;
          min-width: 62rem;
          border-collapse: collapse;
          text-align: center;
        }
        .embed-rpt-table th {
          background: var(--table-head-bg);
          color: var(--text-secondary);
          padding: 0.85rem 0.6rem;
          font-size: var(--fs-xs);
          font-weight: 900;
          border-bottom: 1px solid var(--table-zebra-bg);
          white-space: nowrap;
        }
        .embed-rpt-table td {
          padding: 0.8rem 0.6rem;
          font-size: var(--fs-sm);
          font-weight: 700;
          color: var(--text-primary);
          border-bottom: 1px solid var(--table-zebra-bg);
          font-variant-numeric: tabular-nums;
          vertical-align: middle;
        }
        .embed-rpt-table tfoot td {
          background: var(--surface-subcard);
          font-weight: 900;
          color: var(--accent-ink);
          border-top: 2px solid rgba(249, 115, 22, 0.35);
        }
        @media print {
          @page { size: A4 landscape; margin: 8mm 10mm; }
          .no-print { display: none !important; }
          .embed-rpt-section { overflow: visible !important; padding: 0.5rem !important; box-shadow: none !important; border: 0 !important; background: #fff !important; }
          .embed-rpt-table { min-width: 0 !important; width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border: 0 !important; font-size: 9px !important; }
          .embed-rpt-table th { background: #1e293b !important; color: #fff !important; border: 0 !important; white-space: normal !important; word-wrap: break-word !important; overflow-wrap: break-word !important; padding: 5px 3px !important; font-size: 9px !important; }
          .embed-rpt-table td { border: 0 !important; white-space: normal !important; word-wrap: break-word !important; overflow-wrap: break-word !important; padding: 5px 3px !important; font-size: 9px !important; }
          .embed-rpt-table tbody tr:nth-child(even) td { background: #f1f5f9 !important; }
        }
      `}</style>

      {/* شريط التحكم والتصدير */}
      <div className="embed-rpt-toolbar no-print">
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 900, color: 'var(--text-primary)' }}>
            التقرير المالي الشامل لجميع المشاريع والحسابات ({d.projectsMatrix.length} فلل)
          </h3>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
            يشمل العقود، خصم خامات العميل، الموازنات، مستخلصات المقاولين، يوميات العمالة، الخامات، المصاريف (ABC)، سندات القبض والصرف، والمتبقي
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={exportFullExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.65rem 1.1rem',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--action-fill)',
              color: 'var(--action-ink)',
              fontWeight: 900,
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet size={16} />
            <span>تصدير Excel (5 شيتات)</span>
          </button>
          <button
            type="button"
            onClick={handlePrintAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.65rem 1.1rem',
              borderRadius: '12px',
              border: '1px solid var(--control-edge, rgba(148, 163, 184, 0.2))',
              background: 'var(--surface-subcard)',
              color: 'var(--text-primary)',
              fontWeight: 900,
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
            }}
          >
            <Printer size={16} />
            <span>طباعة التقرير PDF</span>
          </button>
          <button
            type="button"
            onClick={logic.handleRefresh}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 0.95rem',
              borderRadius: '12px',
              border: '1px solid var(--control-edge, rgba(148, 163, 184, 0.2))',
              background: 'var(--surface-subcard)',
              color: 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* بطاقات الملخص المالي والخزينة */}
      <div className="embed-rpt-kpi-grid">
        <div className="embed-rpt-kpi-card">
          <small>إجمالي عقود المشاريع (BOQ)</small>
          <strong style={{ color: 'var(--accent-ink)' }}>{formatCurrency(t.totalContractValue)}</strong>
          <span>
            خصم خامات (217): {formatCurrency(t.totalClientMaterialsDeduction)} • صافي بعد الخامات:{' '}
            {formatCurrency(t.totalContractAfterMaterials)}
          </span>
        </div>
        <div className="embed-rpt-kpi-card">
          <small>صافي المستحق التعاقدي للمشاريع (بدون ضمان الأعمال)</small>
          <strong style={{ color: 'var(--status-positive, #10b981)' }}>{formatCurrency(t.totalClientNetExRetention)}</strong>
          <span>
            بعد خصم الخامات ({formatCurrency(t.totalClientMaterialsDeduction)}) ثم الضمان ({t.overallRetentionPercentage}%:{' '}
            {formatCurrency(t.totalRetentionAmount)}) • المحصّل فعلياً: {formatCurrency(t.totalProjectReceipts)}
          </span>
        </div>
        <div className="embed-rpt-kpi-card">
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
        <div className="embed-rpt-kpi-card">
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
        <div className="embed-rpt-kpi-card">
          <small>سندات القبض والصرف والسيولة المتبقية</small>
          <strong style={{ color: t.netCashTreasury >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
            {formatCurrency(t.netCashTreasury)}
          </strong>
          <span>
            قبض: {formatCurrency(t.totalReceiptVouchers)} • صرف: {formatCurrency(t.totalPaymentVouchers)}
          </span>
        </div>
      </div>

      <ContractWaterfallChart reportData={d} variant="web" />

      {/* 1. جدول حسابات المشاريع (الفلل) */}
      <div className="embed-rpt-section">
        <h4 style={{ margin: '0 0 0.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>
          1. مصفوفة حسابات المشاريع (الفلل): صافي المستحق التعاقدي والموازنة المعتمدة والتكاليف (اضغط على الفيلا للتفاصيل)
        </h4>
        <ProjectsPerformanceCharts reportData={d} variant="web" />
        <table className="embed-rpt-table">
          <thead>
            <tr>
              <th>المشروع / الفيلا</th>
              <th>النموذج والمساحة</th>
              <th>قيمة التعاقد (BOQ)</th>
              <th>خصم خامات العميل</th>
              <th>ضمان الأعمال</th>
              <th>صافي المستحق التعاقدي (بدون ضمان)</th>
              <th>الموازنة المعتمدة</th>
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
                          width: '1.35rem',
                          height: '1.35rem',
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
                    <td style={{ color: p.retention_amount > 0 ? 'var(--status-warning, #f59e0b)' : 'var(--text-muted)', fontWeight: 800 }}>
                      {formatCurrency(p.retention_amount)}
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {p.retention_percentage > 0 ? `(${p.retention_percentage}%) بعد الخامات` : '(0% بدون ضمان)'}
                      </div>
                    </td>
                    <td style={{ fontWeight: 900, color: 'var(--status-positive, #10b981)' }}>
                      {formatCurrency(p.client_net_ex_retention)}
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        قبل الضمان: {formatCurrency(p.contract_after_materials)} • محصّل بسندات قبض: {formatCurrency(p.receipts_total)}
                        {p.receipts_total > 0 ? ` • متبقي: ${formatCurrency(p.client_remaining)}` : ''}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>
                      {formatCurrency(p.estimated_budget)}
                      {p.budget_source === 'project' &&
                        p.boq_estimated_budget > 0 &&
                        Math.abs(p.boq_estimated_budget - p.estimated_budget) >= 0.01 && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            مقايسة BOQ: {formatCurrency(p.boq_estimated_budget)}
                          </div>
                        )}
                      {p.budget_source === 'boq' && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          (من بنود المقايسة BOQ)
                        </div>
                      )}
                      {p.client_materials_deduction > 0 &&
                        Math.abs(p.net_execution_budget_ex_client_materials - p.estimated_budget) >= 0.01 && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            بعد خامات العميل: {formatCurrency(p.net_execution_budget_ex_client_materials)}
                          </div>
                        )}
                    </td>
                    <td>
                      {formatCurrency(p.labor_total)}
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({p.labor_days} يوم)</div>
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
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        شامل الضمان: {formatCurrency(p.target_profit_budget)} ({p.target_margin_pct}%)
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
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        شامل الضمان: {formatCurrency(p.expected_profit_eac)} ({p.expected_margin_pct}%)
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
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
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
                      <div style={{ fontSize: '0.68rem', color: p.variance_pct >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
                        {p.variance_pct > 0 ? '+' : ''}{p.variance_pct}% • {p.variance_status}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={16} style={{ background: 'var(--surface-sunken)', padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', gap: '0.9rem' }}>
                          <div style={{ background: 'var(--surface-card)', padding: '0.85rem', borderRadius: '12px' }}>
                            <strong style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-xs)' }}>
                              أوامر الشغل والمستخلصات وسندات الصرف ({p.name})
                            </strong>
                            {p.jobOrders.map((jo: any) => (
                              <div key={jo.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.3rem' }}>
                                {jo.order_number} ({jo.contractor_name}): {jo.assigned_qty} × {jo.unit_price} ={' '}
                                <b>{formatCurrency(jo.total_value)}</b>
                              </div>
                            ))}
                            {p.claims.map((clm: any) => (
                              <div key={clm.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.3rem', color: 'var(--status-positive, #10b981)' }}>
                                مستخلص {clm.claim_number} ({clm.contractor_name}): <b>{formatCurrency(clm.net_amount)}</b>
                              </div>
                            ))}
                            {p.paymentVouchers.map((pv: any) => (
                              <div key={pv.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.3rem', color: 'var(--status-warning, #f59e0b)' }}>
                                سند صرف {pv.voucher_number} ({pv.date}): <b>{formatCurrency(pv.amount)}</b>
                              </div>
                            ))}
                          </div>
                          <div style={{ background: 'var(--surface-card)', padding: '0.85rem', borderRadius: '12px' }}>
                            <strong style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-xs)' }}>
                              يوميات العمالة ({p.labor_days} يوم • {formatCurrency(p.labor_total)})
                            </strong>
                            {p.laborLogs.length === 0 ? (
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>لا توجد يوميات مسجلة</div>
                            ) : (
                              p.laborLogs.map((l: any) => (
                                <div key={l.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.25rem' }}>
                                  {l.work_date} — <b>{l.worker_name}</b>: {formatCurrency(l.daily_wage)}
                                </div>
                              ))
                            )}
                          </div>
                          <div style={{ background: 'var(--surface-card)', padding: '0.85rem', borderRadius: '12px' }}>
                            <strong style={{ color: 'var(--status-info, #38bdf8)', fontSize: 'var(--fs-xs)' }}>
                              الخامات المنصرفة وتفاصيل الأصناف ({formatCurrency(p.materials_cost_effective)})
                            </strong>
                            {(p.client_materials_deduction > 0 || p.company_materials_cost > 0) && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                توريد عميل (خصم 217): <b>{formatCurrency(p.client_materials_deduction)}</b> • على حساب الشركة:{' '}
                                <b>{formatCurrency(p.company_materials_cost)}</b>
                              </div>
                            )}
                            {p.materialIssues.length === 0 && p.materialReceipts.length === 0 ? (
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                لا توجد خامات منصرفة على هذه الفيلا
                              </div>
                            ) : p.materialIssues.length > 0 ? (
                              <>
                                {p.materialIssues.map((iss: any) => (
                                  <div key={iss.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.35rem' }}>
                                    <div style={{ color: 'var(--status-info, #38bdf8)', fontWeight: 800 }}>
                                      إذن صرف {iss.issue_number} ({iss.issue_date} • {iss.issue_type || 'صرف خامات'}):{' '}
                                      <b>{formatCurrency(iss.total_amount)}</b>
                                    </div>
                                    {(iss.lines || []).map((line: any) => (
                                      <div key={line.id} style={{ paddingRight: '0.65rem', marginTop: '0.15rem' }}>
                                        • {line.item_name}: {line.quantity} {line.unit || ''} × {formatCurrency(line.unit_price)} ={' '}
                                        <b>{formatCurrency(line.total_price)}</b>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                                {p.materialReceipts.length > 0 && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                    مرتبط بفاتورة توريد:{' '}
                                    {p.materialReceipts
                                      .map((m: any) => `${m.receipt_number} (${m.receipt_type}: ${formatCurrency(m.total_amount)})`)
                                      .join(' ، ')}
                                  </div>
                                )}
                              </>
                            ) : (
                              p.materialReceipts.map((m: any) => (
                                <div key={m.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.35rem' }}>
                                  <div style={{ color: 'var(--status-info, #38bdf8)', fontWeight: 800 }}>
                                    فاتورة خامات {m.receipt_number} ({m.receipt_date} • {m.receipt_type}):{' '}
                                    <b>{formatCurrency(m.total_amount)}</b>
                                  </div>
                                  {(m.lines || []).map((line: any) => (
                                    <div key={line.id} style={{ paddingRight: '0.65rem', marginTop: '0.15rem' }}>
                                      • {line.item_name}: {line.quantity} {line.unit || ''} × {formatCurrency(line.unit_price)} ={' '}
                                      <b>{formatCurrency(line.total_price)}</b>
                                    </div>
                                  ))}
                                </div>
                              ))
                            )}
                          </div>
                          <div style={{ background: 'var(--surface-card)', padding: '0.85rem', borderRadius: '12px' }}>
                            <strong style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-xs)' }}>
                              نصيب الفيلا من المصاريف ({formatCurrency(p.abc_expenses_total)})
                            </strong>
                            {p.expenseAllocations.length === 0 ? (
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>لا توجد مصاريف محملة</div>
                            ) : (
                              p.expenseAllocations.map((a: any) => (
                                <div key={a.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.25rem' }}>
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
              <td>
                {formatCurrency(t.totalRetentionAmount)}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({t.overallRetentionPercentage}%)</div>
              </td>
              <td>
                {formatCurrency(t.totalClientNetExRetention)}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  قبل الضمان: {formatCurrency(t.totalContractAfterMaterials)} • محصّل بسندات قبض: {formatCurrency(t.totalProjectReceipts)}
                  {t.totalClientRemaining !== t.totalContractAfterMaterials
                    ? ` • متبقي: ${formatCurrency(t.totalClientRemaining)}`
                    : ''}
                </div>
              </td>
              <td>
                {formatCurrency(t.totalEstimatedBudget)}
                {t.totalBoqEstimatedBudget > 0 &&
                  Math.abs(t.totalBoqEstimatedBudget - t.totalEstimatedBudget) >= 0.01 && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      مقايسة BOQ: {formatCurrency(t.totalBoqEstimatedBudget)}
                    </div>
                  )}
              </td>
              <td>{formatCurrency(t.totalLaborEarned)}</td>
              <td>{formatCurrency(t.totalClaimsNet)}</td>
              <td>{formatCurrency(t.totalCompanyMaterials)}</td>
              <td>{formatCurrency(t.totalExpensesAmount)}</td>
              <td>{formatCurrency(t.totalActualProjectCosts)}</td>
              <td>
                {t.totalTargetProfitBudgetExRetention > 0 ? '+' : ''}
                {formatCurrency(t.totalTargetProfitBudgetExRetention)}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  شامل الضمان: {formatCurrency(t.totalTargetProfitBudget)} ({t.totalTargetMarginPct}%)
                </div>
              </td>
              <td>
                {t.totalExpectedProfitEacExRetention > 0 ? '+' : ''}
                {formatCurrency(t.totalExpectedProfitEacExRetention)}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  شامل الضمان: {formatCurrency(t.totalExpectedProfitEac)} ({t.totalExpectedMarginPct}%)
                </div>
              </td>
              <td>
                {t.totalActualProfitExRetention > 0 ? '+' : ''}
                {formatCurrency(t.totalActualProfitExRetention)}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  شامل: {formatCurrency(t.totalNetContractMargin)}
                </div>
              </td>
              <td>
                <span dir="ltr">{t.overallDeviationFactor !== null ? t.overallDeviationFactor.toFixed(2) : '---'}</span>
                <div style={{ fontSize: '0.68rem', color: t.overallVariancePct >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
                  {t.overallVariancePct > 0 ? '+' : ''}{t.overallVariancePct}%
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 2. حسابات العمالة والمقاولين والمتبقي */}
      <div className="embed-rpt-section">
        <h4 style={{ margin: '0 0 0.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>
          2. حسابات العمالة ومقاولي الباطن (المستحق • المدفوع • المتبقي)
        </h4>
        <WorkersContractorsChart reportData={d} variant="web" />
        <table className="embed-rpt-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'right' }}>الاسم / الجهة</th>
              <th>النوع</th>
              <th>اليوميات / المستخلصات</th>
              <th>توزيع الفلل</th>
              <th>إجمالي المستحق</th>
              <th>المدفوع بسندات صرف</th>
              <th>الرصيد المتبقي المستحق</th>
            </tr>
          </thead>
          <tbody>
            {d.contractorsSummary.map((c: any) => (
              <tr key={`c-${c.name}`}>
                <td style={{ textAlign: 'right', fontWeight: 900 }}>{c.name}</td>
                <td>مقاول باطن</td>
                <td>{c.claimsCount} مستخلصات</td>
                <td style={{ fontSize: 'var(--fs-xs)' }}>{c.villas.join(' ، ')}</td>
                <td style={{ fontWeight: 900 }}>{formatCurrency(c.claimed)}</td>
                <td style={{ color: 'var(--status-positive, #10b981)', fontWeight: 900 }}>{formatCurrency(c.paid)}</td>
                <td style={{ color: c.remaining > 0 ? 'var(--status-negative, #f43f5e)' : 'var(--status-positive, #10b981)', fontWeight: 900 }}>
                  {formatCurrency(c.remaining)}
                </td>
              </tr>
            ))}
            {d.workersSummary.map((w: any) => (
              <tr key={`w-${w.name}`}>
                <td style={{ textAlign: 'right', fontWeight: 900 }}>{w.name}</td>
                <td>عمالة يومية</td>
                <td>{w.days} يومية</td>
                <td style={{ fontSize: 'var(--fs-xs)' }}>{w.villasText}</td>
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
              <td colSpan={4} style={{ textAlign: 'right' }}>الإجمالي الكلي للعمالة والمقاولين</td>
              <td>{formatCurrency(t.totalLaborEarned + t.totalClaimsNet)}</td>
              <td>{formatCurrency(t.totalLaborPaid + t.totalClaimsPaid)}</td>
              <td>{formatCurrency(t.totalLaborRemaining + t.totalClaimsRemaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 3. سندات القبض وسندات الصرف */}
      <CashFlowVouchersCharts reportData={d} variant="web" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(26rem, 1fr))', gap: '1.25rem' }}>
        <div className="embed-rpt-section">
          <h4 style={{ margin: '0 0 0.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            3. سجل سندات القبض ({d.receiptVouchers.length} سندات — {formatCurrency(t.totalReceiptVouchers)})
          </h4>
          <table className="embed-rpt-table" style={{ minWidth: '30rem' }}>
            <thead>
              <tr>
                <th>رقم السند</th>
                <th>التاريخ</th>
                <th>الجهة</th>
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

        <div className="embed-rpt-section">
          <h4 style={{ margin: '0 0 0.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            4. سجل سندات الصرف ({d.paymentVouchers.length} سنداً — {formatCurrency(t.totalPaymentVouchers)})
          </h4>
          <table className="embed-rpt-table" style={{ minWidth: '32rem' }}>
            <thead>
              <tr>
                <th>رقم السند</th>
                <th>التاريخ</th>
                <th>التصنيف</th>
                <th>المستفيد / البيان</th>
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
                    {v.description ? ` — ${v.description.slice(0, 42)}` : ''}
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

      {/* 5. سجل المصاريف وتوزيعها على الفلل */}
      <div className="embed-rpt-section">
        <h4 style={{ margin: '0 0 0.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>
          5. سجل المصاريف التشغيلية وتوزيعها على الفلل ({d.expenses.length} مصروفاً — {formatCurrency(t.totalExpensesAmount)})
        </h4>
        <CostStructureAndAbcCharts reportData={d} variant="web" />
        <table className="embed-rpt-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>التصنيف</th>
              <th style={{ textAlign: 'right' }}>البيان / التفاصيل</th>
              <th>المبلغ</th>
              <th style={{ textAlign: 'right' }}>التوزيع الفعلي على الفلل (ABC)</th>
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

      {/* مودال المعاينة والطباعة الرسمية الموحدة A4 */}
      <AllProjectsPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        reportData={d}
        selectedProjectId={logic.selectedProjectId}
        dateRange={logic.dateRange}
      />
    </div>
  );
}
