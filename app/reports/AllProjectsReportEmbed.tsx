"use client";
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useReportsLogic } from './reports_logic';
import LoadingScreen from '@/components/LoadingScreen';
import { formatCurrency } from '@/lib/helpers';
import { buildDocumentFileName } from '@/lib/documentFileName';
import { printWithDocumentTitle } from '@/lib/printWithTitle';
import { ChevronLeft, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';

export default function AllProjectsReportEmbed() {
  const logic = useReportsLogic();
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);

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
      'الموازنة التقديرية': p.estimated_budget,
      'مستخلصات المقاولين': p.claims_total,
      'يوميات العمالة': p.labor_total,
      'عدد اليوميات': p.labor_days,
      'توريد وصرف الخامات': p.materials_cost_effective,
      'المصاريف الموزعة (ABC)': p.abc_expenses_total,
      'إجمالي التكلفة الفعلية': p.total_actual_cost,
      'المتبقي من الموازنة': p.remaining_budget,
      'صافي هامش العقد (المتبقي من العقد)': p.net_contract_margin,
      'سندات الصرف المباشرة': p.direct_pv_total,
    }));
    projectsSheetData.push({
      'المشروع / الفيلا': 'الإجمالي العام',
      'النموذج': '---',
      'المساحة (م2)': d.projectsMatrix.reduce((s: number, p: any) => s + p.unit_area, 0),
      'العميل': '---',
      'قيمة التعاقد (BOQ)': t.totalContractValue,
      'الموازنة التقديرية': t.totalEstimatedBudget,
      'مستخلصات المقاولين': t.totalClaimsNet,
      'يوميات العمالة': t.totalLaborEarned,
      'عدد اليوميات': d.projectsMatrix.reduce((s: number, p: any) => s + p.labor_days, 0),
      'توريد وصرف الخامات': t.totalCustomerMaterials,
      'المصاريف الموزعة (ABC)': t.totalExpensesAmount,
      'إجمالي التكلفة الفعلية': t.totalActualProjectCosts,
      'المتبقي من الموازنة': t.totalRemainingBudget,
      'صافي هامش العقد (المتبقي من العقد)': t.totalNetContractMargin,
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

    const { fileName } = buildDocumentFileName({
      docType: 'التقرير_المالي_الشامل_للمشاريع',
      prefix: 'MASTER-FIN',
      seedParts: [d.projectsMatrix.length],
      ext: 'xlsx',
    });
    XLSX.writeFile(wb, fileName);
  };

  const handlePrintAll = () => {
    if (d) {
      setExpandedProjects(d.projectsMatrix.map((p: any) => p.id));
    }
    setTimeout(() => {
      printWithDocumentTitle({
        docType: 'التقرير_المالي_الشامل_للمشاريع_والحسابات',
        prefix: 'MASTER-FIN',
        seedParts: [d?.projectsMatrix?.length || 0],
      });
    }, 350);
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
          min-width: 56rem;
          border-collapse: collapse;
          text-align: center;
        }
        .embed-rpt-table th {
          background: var(--table-head-bg);
          color: var(--text-secondary);
          padding: 0.85rem 0.65rem;
          font-size: var(--fs-xs);
          font-weight: 900;
          border-bottom: 1px solid var(--table-zebra-bg);
          white-space: nowrap;
        }
        .embed-rpt-table td {
          padding: 0.8rem 0.65rem;
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
      `}</style>

      {/* شريط التحكم والتصدير */}
      <div className="embed-rpt-toolbar no-print">
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 900, color: 'var(--text-primary)' }}>
            التقرير المالي الشامل لجميع المشاريع والحسابات ({d.projectsMatrix.length} فلل)
          </h3>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
            يشمل العقود، الموازنات، مستخلصات المقاولين، يوميات العمالة، الخامات، المصاريف (ABC)، سندات القبض والصرف، والمتبقي
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
          <span>الموازنة التقديرية: {formatCurrency(t.totalEstimatedBudget)}</span>
        </div>
        <div className="embed-rpt-kpi-card">
          <small>إجمالي التكاليف الفعلية للمشاريع</small>
          <strong style={{ color: 'var(--status-warning, #f59e0b)' }}>{formatCurrency(t.totalActualProjectCosts)}</strong>
          <span>صافي المتبقي من العقود: {formatCurrency(t.totalNetContractMargin)}</span>
        </div>
        <div className="embed-rpt-kpi-card">
          <small>إجمالي سندات القبض (الوارد للخزينة)</small>
          <strong style={{ color: 'var(--status-positive, #10b981)' }}>{formatCurrency(t.totalReceiptVouchers)}</strong>
          <span>عدد السندات: {d.receiptVouchers.length} سند قبض</span>
        </div>
        <div className="embed-rpt-kpi-card">
          <small>إجمالي سندات الصرف (المنصرف نقداً)</small>
          <strong style={{ color: 'var(--status-negative, #f43f5e)' }}>{formatCurrency(t.totalPaymentVouchers)}</strong>
          <span>
            مقاولين: {formatCurrency(t.pvClaimsTotal)} • مصاريف: {formatCurrency(t.pvExpensesTotal)} • عمال:{' '}
            {formatCurrency(t.pvWorkersTotal)}
          </span>
        </div>
        <div className="embed-rpt-kpi-card">
          <small>السيولة المتبقية بالخزينة (قبض - صرف)</small>
          <strong style={{ color: t.netCashTreasury >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
            {formatCurrency(t.netCashTreasury)}
          </strong>
          <span>رصيد الخزينة النقدي الفعلي المتاح</span>
        </div>
        <div className="embed-rpt-kpi-card">
          <small>المتبقي المستحق للعمالة والمقاولين</small>
          <strong style={{ color: 'var(--status-negative, #f43f5e)' }}>
            {formatCurrency(t.totalLaborRemaining + t.totalClaimsRemaining)}
          </strong>
          <span>
            متبقي عمالة: {formatCurrency(t.totalLaborRemaining)} • متبقي مقاولين: {formatCurrency(t.totalClaimsRemaining)}
          </span>
        </div>
      </div>

      {/* 1. جدول حسابات المشاريع (الفلل) */}
      <div className="embed-rpt-section">
        <h4 style={{ margin: '0 0 0.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>
          1. مصفوفة حسابات المشاريع (الفلل) والتكاليف والمتبقي (اضغط على الفيلا للتفاصيل)
        </h4>
        <table className="embed-rpt-table">
          <thead>
            <tr>
              <th>المشروع / الفيلا</th>
              <th>النموذج والمساحة</th>
              <th>قيمة التعاقد (BOQ)</th>
              <th>الموازنة التقديرية</th>
              <th>مستخلصات المقاولين</th>
              <th>يوميات العمالة</th>
              <th>الخامات المحملة</th>
              <th>المصاريف (ABC)</th>
              <th>إجمالي التكلفة الفعلية</th>
              <th>سندات الصرف المباشرة</th>
              <th>المتبقي من الموازنة</th>
              <th>صافي المتبقي من العقد</th>
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
                    <td style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.estimated_budget)}</td>
                    <td>{formatCurrency(p.claims_total)}</td>
                    <td>
                      {formatCurrency(p.labor_total)} ({p.labor_days} يوم)
                    </td>
                    <td>{formatCurrency(p.materials_cost_effective)}</td>
                    <td>{formatCurrency(p.abc_expenses_total)}</td>
                    <td style={{ fontWeight: 900, color: 'var(--status-warning, #f59e0b)' }}>
                      {formatCurrency(p.total_actual_cost)}
                    </td>
                    <td>{formatCurrency(p.direct_pv_total)}</td>
                    <td
                      style={{
                        fontWeight: 900,
                        color: p.remaining_budget >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)',
                      }}
                    >
                      {formatCurrency(p.remaining_budget)}
                    </td>
                    <td
                      style={{
                        fontWeight: 900,
                        color: p.net_contract_margin >= 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)',
                      }}
                    >
                      {formatCurrency(p.net_contract_margin)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={12} style={{ background: 'var(--surface-sunken)', padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '0.9rem' }}>
                          <div style={{ background: 'var(--surface-card)', padding: '0.85rem', borderRadius: '12px' }}>
                            <strong style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-xs)' }}>أوامر الشغل والمستخلصات وسندات الصرف</strong>
                            {p.jobOrders.map((jo: any) => (
                              <div key={jo.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.3rem' }}>
                                {jo.order_number} ({jo.contractor_name}): {formatCurrency(jo.total_value)}
                              </div>
                            ))}
                            {p.claims.map((clm: any) => (
                              <div key={clm.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.3rem', color: 'var(--status-positive, #10b981)' }}>
                                مستخلص {clm.claim_number}: {formatCurrency(clm.net_amount)}
                              </div>
                            ))}
                            {p.paymentVouchers.map((pv: any) => (
                              <div key={pv.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.3rem', color: 'var(--status-warning, #f59e0b)' }}>
                                سند صرف {pv.voucher_number}: {formatCurrency(pv.amount)}
                              </div>
                            ))}
                          </div>
                          <div style={{ background: 'var(--surface-card)', padding: '0.85rem', borderRadius: '12px' }}>
                            <strong style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-xs)' }}>يوميات العمالة والخامات</strong>
                            {p.laborLogs.map((l: any) => (
                              <div key={l.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.25rem' }}>
                                {l.work_date} — {l.worker_name}: {formatCurrency(l.daily_wage)}
                              </div>
                            ))}
                            {p.materialReceipts.map((m: any) => (
                              <div key={m.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.25rem', color: 'var(--status-info, #38bdf8)' }}>
                                فاتورة خامات {m.receipt_number}: {formatCurrency(m.total_amount)}
                              </div>
                            ))}
                          </div>
                          <div style={{ background: 'var(--surface-card)', padding: '0.85rem', borderRadius: '12px' }}>
                            <strong style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-xs)' }}>
                              نصيب الفيلا من المصاريف ({formatCurrency(p.abc_expenses_total)})
                            </strong>
                            {p.expenseAllocations.map((a: any) => (
                              <div key={a.id} style={{ fontSize: 'var(--fs-xs)', marginTop: '0.25rem' }}>
                                {a['تاريخ المصروف الأصلي']} — {a['البيان / الوصف']}: {formatCurrency(a.allocated_amount)}
                              </div>
                            ))}
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
              <td>{formatCurrency(t.totalEstimatedBudget)}</td>
              <td>{formatCurrency(t.totalClaimsNet)}</td>
              <td>{formatCurrency(t.totalLaborEarned)}</td>
              <td>{formatCurrency(t.totalCustomerMaterials)}</td>
              <td>{formatCurrency(t.totalExpensesAmount)}</td>
              <td>{formatCurrency(t.totalActualProjectCosts)}</td>
              <td>{formatCurrency(t.pvClaimsTotal)}</td>
              <td>{formatCurrency(t.totalRemainingBudget)}</td>
              <td>{formatCurrency(t.totalNetContractMargin)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 2. حسابات العمالة والمقاولين والمتبقي */}
      <div className="embed-rpt-section">
        <h4 style={{ margin: '0 0 0.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>
          2. حسابات العمالة ومقاولي الباطن (المستحق • المدفوع • المتبقي)
        </h4>
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
              <td colSpan={4} style={{ textAlign: 'right' }}>الإجمالي الكلي</td>
              <td>{formatCurrency(t.totalLaborEarned + t.totalClaimsNet)}</td>
              <td>{formatCurrency(t.totalLaborPaid + t.totalClaimsPaid)}</td>
              <td>{formatCurrency(t.totalLaborRemaining + t.totalClaimsRemaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 3. سندات القبض وسندات الصرف */}
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
          </table>
        </div>
      </div>
    </div>
  );
}
