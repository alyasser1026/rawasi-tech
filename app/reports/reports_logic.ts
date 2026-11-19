"use client";
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActiveCompanyId, supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/CompanyContext';
import { useToast } from '@/lib/toast-context';
import { fetchAllSupabaseData } from '@/lib/helpers';
import {
  computeDailyWorkerExpenseAllocations,
  getExpenseNetAmount,
  getExpenseDisplayDescription,
} from '@/lib/dailyWorkerExpenseAllocation';

const round2 = (n: number) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export function useReportsLogic() {
  const { showToast } = useToast();
  const { activeCompanyId: contextCompanyId } = useCompany();
  const activeCompanyId = contextCompanyId || getActiveCompanyId() || '72918f4d-10c3-43a0-884e-2f84f1224335';

  // فلتر التاريخ (فارغ افتراضياً لعرض التقرير التراكمي الشامل لكل الفترات)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'projects' | 'workers' | 'vouchers' | 'expenses'>('all');

  const { data: rawData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['comprehensive_projects_report', activeCompanyId],
    queryFn: async () => {
      const [
        projects,
        boq_budget,
        job_orders,
        receipt_vouchers,
        payment_vouchers,
        sub_claims,
        labor_daily_logs,
        material_receipts,
        material_issues,
        expenses,
        partners,
      ] = await Promise.all([
        fetchAllSupabaseData(supabase, 'projects', '*', 'created_at', true),
        fetchAllSupabaseData(supabase, 'boq_budget', '*', 'created_at', true),
        fetchAllSupabaseData(supabase, 'job_orders', '*', 'created_at', true),
        fetchAllSupabaseData(supabase, 'receipt_vouchers', '*', 'date', false),
        fetchAllSupabaseData(supabase, 'payment_vouchers', '*', 'date', false),
        fetchAllSupabaseData(supabase, 'sub_claims', '*', 'date', false),
        fetchAllSupabaseData(supabase, 'labor_daily_logs', '*', 'work_date', false),
        fetchAllSupabaseData(supabase, 'material_receipts', '*', 'receipt_date', false),
        fetchAllSupabaseData(supabase, 'material_issues', '*', 'issue_date', false),
        fetchAllSupabaseData(supabase, 'expenses', '*', 'exp_date', false),
        fetchAllSupabaseData(supabase, 'partners', 'id,name,partner_type,company_id', 'created_at', false),
      ]);

      const byCompany = (rows: any[]) =>
        (rows || []).filter((r: any) => !r.company_id || !activeCompanyId || String(r.company_id) === String(activeCompanyId));

      return {
        projects: byCompany(projects),
        boq_budget: byCompany(boq_budget),
        job_orders: byCompany(job_orders),
        receipt_vouchers: byCompany(receipt_vouchers),
        payment_vouchers: byCompany(payment_vouchers),
        sub_claims: byCompany(sub_claims),
        labor_daily_logs: byCompany(labor_daily_logs),
        material_receipts: byCompany(material_receipts),
        material_issues: byCompany(material_issues),
        expenses: byCompany(expenses).filter((e: any) => !e.is_deleted),
        partners: byCompany(partners),
      };
    },
    staleTime: 60 * 1000,
  });

  const inDateRange = (dateStr?: string | null) => {
    if (!dateStr) return true;
    const d = String(dateStr).split('T')[0];
    if (dateRange.start && d < dateRange.start) return false;
    if (dateRange.end && d > dateRange.end) return false;
    return true;
  };

  const reportData = useMemo(() => {
    if (!rawData) return null;

    const partnerMap = new Map<string, { name: string; type: string }>();
    rawData.partners.forEach((p: any) => {
      partnerMap.set(String(p.id), { name: p.name || 'غير محدد', type: p.partner_type || '' });
    });

    const projectMap = new Map<string, any>();
    rawData.projects.forEach((p: any) => {
      projectMap.set(String(p.id), p);
    });

    const receiptVouchers = rawData.receipt_vouchers.filter((r: any) => inDateRange(r.date));
    const paymentVouchers = rawData.payment_vouchers.filter((v: any) => inDateRange(v.date));
    const subClaims = rawData.sub_claims.filter((c: any) => inDateRange(c.date));
    const laborLogs = rawData.labor_daily_logs.filter((l: any) => inDateRange(l.work_date));
    const materialReceipts = rawData.material_receipts.filter((m: any) => inDateRange(m.receipt_date));
    const materialIssues = rawData.material_issues.filter((m: any) => inDateRange(m.issue_date));
    const expenses = rawData.expenses.filter((e: any) => inDateRange(e.exp_date));

    // توزيع المصاريف المشتركة (ABC) على المشاريع حسب يوميات العمالة
    const abcAllocations = computeDailyWorkerExpenseAllocations({
      expenses,
      laborLogs: rawData.labor_daily_logs,
      jobOrders: rawData.job_orders,
      projects: rawData.projects,
      boqItems: rawData.boq_budget,
      activeCompanyId,
    });

    const projectsMatrix = rawData.projects
      .filter((p: any) => selectedProjectId === 'all' || String(p.id) === String(selectedProjectId))
      .map((p: any) => {
        const pid = String(p.id);
        const pName = p.Property || p.project_name || 'مشروع بدون اسم';
        const clientName = partnerMap.get(String(p.client_id))?.name || p.client_name || 'شركة المواطن الدولية';

        const allBoqs = rawData.boq_budget.filter((b: any) => String(b.project_id) === pid);
        // 🎯 احتساب البنود الفرعية (التنفيذية) فقط لمنع ازدواجية البنود الرئيسية الأب
        const leafBoqs = allBoqs.filter(
          (b: any) =>
            !allBoqs.some((child: any) => String(child.parent_id) === String(b.id)) &&
            (b.item_type === 'فرعي' || !b.item_type || allBoqs.length === 1)
        );
        const boqsToSum = leafBoqs.length > 0 ? leafBoqs : allBoqs;

        const boqContractValue = round2(
          boqsToSum.reduce(
            (s: number, b: any) =>
              s + (Number(b.total_contract_amount) || (Number(b.contract_quantity) || 0) * (Number(b.unit_contract_price) || 0)),
            0
          )
        );
        const contractValue = boqContractValue > 0 ? boqContractValue : round2(Number(p.contract_value) || 0);

        // محتجز ضمان الأعمال (10% أو حسب نسبة كل بند في المقايسة)
        const boqRetentionAmount = round2(
          boqsToSum.reduce((s: number, b: any) => {
            const itemContract =
              Number(b.total_contract_amount) || (Number(b.contract_quantity) || 0) * (Number(b.unit_contract_price) || 0);
            const itemRet =
              Number(b.actual_retention_amount) || round2((itemContract * (Number(b.retention_percentage) || 10)) / 100);
            return s + itemRet;
          }, 0)
        );
        const retentionAmount = boqRetentionAmount > 0 ? boqRetentionAmount : round2(contractValue * 0.1);
        const retentionPercentage =
          contractValue > 0 ? round2((retentionAmount / contractValue) * 100) : Number(boqsToSum[0]?.retention_percentage) || 10;
        const netContractExRetention = round2(contractValue - retentionAmount);

        const estLabor = round2(boqsToSum.reduce((s: number, b: any) => s + (Number(b.estimated_labor_cost) || 0), 0));
        const estMaterials = round2(boqsToSum.reduce((s: number, b: any) => s + (Number(b.estimated_material_cost) || 0), 0));
        const estExpenses = round2(boqsToSum.reduce((s: number, b: any) => s + (Number(b.estimated_expenses_cost) || 0), 0));
        const estSubcontractors = round2(
          boqsToSum.reduce((s: number, b: any) => s + (Number(b.estimated_subcontractor_cost) || 0), 0)
        );
        const estimatedBudget =
          round2(estLabor + estMaterials + estExpenses + estSubcontractors) || round2(Number(p.estimated_budget) || 0);

        const jobOrders = rawData.job_orders
          .filter((j: any) => String(j.project_id) === pid)
          .map((j: any) => ({
            ...j,
            contractor_name: j.contractor_id ? partnerMap.get(String(j.contractor_id))?.name || 'مقاول' : 'تنفيذ ذاتي',
            total_value: round2((Number(j.assigned_qty) || 0) * (Number(j.unit_price) || 0)),
          }));

        const pReceipts = receiptVouchers.filter(
          (r: any) => Array.isArray(r.project_ids) && r.project_ids.map(String).includes(pid)
        );
        const receiptsTotal = round2(pReceipts.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0));

        const pClaims = subClaims
          .filter(
            (c: any) =>
              String(c.project_id) === pid || (Array.isArray(c.project_ids) && c.project_ids.map(String).includes(pid))
          )
          .map((c: any) => ({
            ...c,
            contractor_name: partnerMap.get(String(c.contractor_id))?.name || 'مقاول باطن',
          }));
        const claimsTotal = round2(pClaims.reduce((s: number, c: any) => s + (Number(c.net_amount) || 0), 0));

        const pLabor = laborLogs.filter((l: any) => String(l.project_id) === pid || l.site_ref === pName);
        const laborDays = round2(pLabor.reduce((s: number, l: any) => s + (Number(l.attendance_value) || 1), 0));
        const laborTotal = round2(pLabor.reduce((s: number, l: any) => s + (Number(l.daily_wage) || 0), 0));

        const pMatReceipts = materialReceipts
          .filter((m: any) => String(m.project_id) === pid)
          .map((m: any) => ({
            ...m,
            supplier_name: partnerMap.get(String(m.supplier_id))?.name || '---',
          }));
        const materialsReceivedTotal = round2(
          pMatReceipts.reduce((s: number, m: any) => s + (Number(m.total_amount) || 0), 0)
        );
        const clientMaterialsDeduction = round2(
          pMatReceipts
            .filter((m: any) => m.receipt_type === 'توريد عميل')
            .reduce((s: number, m: any) => s + (Number(m.total_amount) || 0), 0)
        );

        const pMatIssues = materialIssues.filter((m: any) => String(m.project_id) === pid);
        const materialsIssuedTotal = round2(
          pMatIssues.reduce((s: number, m: any) => s + (Number(m.total_amount) || 0), 0)
        );
        // منع ازدواجية الخامات إذا تم توريدها وصرفها لنفس المشروع
        const materialsCostEffective = materialsIssuedTotal > 0 ? materialsIssuedTotal : materialsReceivedTotal;

        const pAbcAllocs = abcAllocations.filter((a) => String(a.project_id) === pid);
        const abcExpensesTotal = round2(pAbcAllocs.reduce((s, a) => s + (Number(a.allocated_amount) || 0), 0));

        const pDirectPvs = paymentVouchers
          .filter(
            (v: any) =>
              (Array.isArray(v.project_ids) && v.project_ids.map(String).includes(pid)) || v.site_ref === pName
          )
          .map((v: any) => ({
            ...v,
            partner_name: partnerMap.get(String(v.partner_id))?.name || '---',
          }));
        const directPaymentVouchersTotal = round2(
          pDirectPvs.reduce((s: number, v: any) => s + (Number(v.amount) || 0), 0)
        );

        // إجمالي التكلفة الفعلية المحملة على المشروع
        const totalActualCost = round2(claimsTotal + laborTotal + materialsCostEffective + abcExpensesTotal);
        const remainingBudget = round2(estimatedBudget - totalActualCost);
        const netContractMargin = round2(contractValue - totalActualCost);
        const actualProfitExRetention = round2(netContractExRetention - totalActualCost);
        const actualMarginPct = contractValue > 0 ? round2((netContractMargin / contractValue) * 100) : 0;

        // الربح المتوقع الواقعي عند الإنجاز (EAC = العقد - الأكبر من الموازنة أو التكلفة الفعلية)
        const forecastedCostEac = round2(Math.max(estimatedBudget, totalActualCost));
        const expectedProfitEac = round2(contractValue - forecastedCostEac);
        const expectedProfitEacExRetention = round2(netContractExRetention - forecastedCostEac);
        const expectedMarginPct = contractValue > 0 ? round2((expectedProfitEac / contractValue) * 100) : 0;
        const expectedMarginExRetentionPct =
          netContractExRetention > 0 ? round2((expectedProfitEacExRetention / netContractExRetention) * 100) : 0;

        // معامل الانحراف (CPI = الموازنة / الفعلي) ونسبة الانحراف %
        const deviationFactor = totalActualCost > 0 ? round2(estimatedBudget / totalActualCost) : null;
        const variancePct =
          estimatedBudget > 0 ? round2(((estimatedBudget - totalActualCost) / estimatedBudget) * 100) : 0;
        const varianceStatus =
          totalActualCost === 0
            ? 'لم يُصرف'
            : remainingBudget >= 0
              ? 'ضمن الموازنة'
              : deviationFactor !== null && deviationFactor < 0.85
                ? 'تجاوز حاد'
                : 'تجاوز طفيف';

        // صافي المتبقي عند العميل بعد خصم خامات العميل وسندات قبض العميل (شامل الضمان)
        const clientRemaining = round2(contractValue - clientMaterialsDeduction - receiptsTotal);
        // المبلغ المستلم / الصافي غير شامل ضمان الأعمال (بعد خصم ضمان الأعمال 10% وخامات العميل)
        const clientNetExRetention = round2(contractValue - retentionAmount - clientMaterialsDeduction);

        return {
          id: pid,
          name: pName,
          unit_type: p.unit_type || '---',
          unit_area: Number(p.unit_area) || 0,
          client_name: clientName,
          status: p.status || 'قيد التنفيذ',
          current_stage: p.current_stage || '---',
          contract_value: contractValue,
          retention_percentage: retentionPercentage,
          retention_amount: retentionAmount,
          net_contract_ex_retention: netContractExRetention,
          client_materials_deduction: clientMaterialsDeduction,
          client_remaining: clientRemaining,
          client_net_ex_retention: clientNetExRetention,
          estimated_budget: estimatedBudget,
          est_labor: estLabor,
          est_materials: estMaterials,
          est_expenses: estExpenses,
          est_subcontractors: estSubcontractors,
          receipts_total: receiptsTotal,
          claims_total: claimsTotal,
          direct_pv_total: directPaymentVouchersTotal,
          labor_days: laborDays,
          labor_total: laborTotal,
          materials_received_total: materialsReceivedTotal,
          materials_issued_total: materialsIssuedTotal,
          materials_cost_effective: materialsCostEffective,
          abc_expenses_total: abcExpensesTotal,
          total_actual_cost: totalActualCost,
          forecasted_cost_eac: forecastedCostEac,
          remaining_budget: remainingBudget,
          net_contract_margin: netContractMargin,
          actual_profit_ex_retention: actualProfitExRetention,
          actual_margin_pct: actualMarginPct,
          expected_profit_eac: expectedProfitEac,
          expected_profit_eac_ex_retention: expectedProfitEacExRetention,
          expected_margin_pct: expectedMarginPct,
          expected_margin_ex_retention_pct: expectedMarginExRetentionPct,
          deviation_factor: deviationFactor,
          variance_pct: variancePct,
          variance_status: varianceStatus,
          // التفاصيل الفرعية
          boqs: boqsToSum,
          jobOrders,
          receipts: pReceipts,
          claims: pClaims,
          laborLogs: pLabor,
          materialReceipts: pMatReceipts,
          materialIssues: pMatIssues,
          expenseAllocations: pAbcAllocs,
          paymentVouchers: pDirectPvs,
        };
      });

    // حسابات العمالة (المستحق والمدفوع والمتبقي لكل عامل)
    const workerMap = new Map<
      string,
      { name: string; days: number; earned: number; paid: number; remaining: number; villas: Record<string, number> }
    >();

    laborLogs.forEach((l: any) => {
      const name = (partnerMap.get(String(l.worker_partner_id))?.name || l.worker_name || 'عامل').trim();
      const cur = workerMap.get(name) || {
        name,
        days: 0,
        earned: 0,
        paid: 0,
        remaining: 0,
        villas: {} as Record<string, number>,
      };
      cur.days = round2(cur.days + (Number(l.attendance_value) || 1));
      const wage = Number(l.daily_wage) || 0;
      cur.earned = round2(cur.earned + wage);
      const vName = String(projectMap.get(String(l.project_id))?.Property || l.site_ref || 'عام');
      cur.villas[vName] = round2((cur.villas[vName] || 0) + wage);
      workerMap.set(name, cur);
    });

    paymentVouchers.forEach((pv: any) => {
      if (!pv.sub_claim_id && !pv.related_expense_id && pv.partner_id) {
        const pInfo = partnerMap.get(String(pv.partner_id));
        const name = (pInfo?.name || '').trim();
        if (name) {
          const cur = workerMap.get(name) || {
            name,
            days: 0,
            earned: 0,
            paid: 0,
            remaining: 0,
            villas: {} as Record<string, number>,
          };
          cur.paid = round2(cur.paid + (Number(pv.amount) || 0));
          workerMap.set(name, cur);
        }
      }
    });

    const workersSummary = Array.from(workerMap.values())
      .map((w) => ({
        ...w,
        remaining: round2(w.earned - w.paid),
        villasText: Object.entries(w.villas)
          .map(([v, amt]) => `${v} (${amt})`)
          .join(' ، '),
      }))
      .sort((a, b) => b.earned - a.earned);

    // حسابات مقاولي الباطن
    const contractorMap = new Map<
      string,
      { name: string; claimsCount: number; claimed: number; paid: number; remaining: number; villas: string[] }
    >();

    subClaims.forEach((c: any) => {
      const name = (partnerMap.get(String(c.contractor_id))?.name || 'مقاول باطن').trim();
      const cur = contractorMap.get(name) || { name, claimsCount: 0, claimed: 0, paid: 0, remaining: 0, villas: [] };
      cur.claimsCount += 1;
      cur.claimed = round2(cur.claimed + (Number(c.net_amount) || 0));
      const vName = projectMap.get(String(c.project_id))?.Property || c.project_names_text || '';
      if (vName && !cur.villas.includes(vName)) cur.villas.push(vName);
      contractorMap.set(name, cur);
    });

    paymentVouchers.forEach((pv: any) => {
      if (pv.sub_claim_id) {
        const name = (partnerMap.get(String(pv.partner_id))?.name || 'مقاول باطن').trim();
        const cur = contractorMap.get(name) || { name, claimsCount: 0, claimed: 0, paid: 0, remaining: 0, villas: [] };
        cur.paid = round2(cur.paid + (Number(pv.amount) || 0));
        contractorMap.set(name, cur);
      }
    });

    const contractorsSummary = Array.from(contractorMap.values()).map((c) => ({
      ...c,
      remaining: round2(c.claimed - c.paid),
    }));

    // تجهيز قوائم السندات والمصاريف للعرض والتصدير
    const enrichedReceipts = receiptVouchers.map((r: any) => ({
      ...r,
      partner_name: partnerMap.get(String(r.partner_id))?.name || '---',
      projects_label:
        Array.isArray(r.project_ids) && r.project_ids.length > 0
          ? r.project_ids.map((id: any) => projectMap.get(String(id))?.Property || id).join(' ، ')
          : 'خزينة عامة / تمويل عهدة',
    }));

    const enrichedPayments = paymentVouchers.map((v: any) => {
      let category = 'صرف عام';
      if (v.sub_claim_id) category = 'سداد مستخلص مقاول';
      else if (v.related_expense_id) category = 'سداد مصروف تشغيلي';
      else if (v.partner_id) category = 'دفعة / يوميات عمالة';

      const projectsLabel =
        Array.isArray(v.project_ids) && v.project_ids.length > 0
          ? v.project_ids.map((id: any) => projectMap.get(String(id))?.Property || id).join(' ، ')
          : v.site_ref || (v.related_expense_id ? 'موزع تلقائياً (ABC)' : 'عام');

      return {
        ...v,
        partner_name: partnerMap.get(String(v.partner_id))?.name || '---',
        category,
        projects_label: projectsLabel,
      };
    });

    const enrichedExpenses = expenses.map((e: any) => {
      const amount = getExpenseNetAmount(e);
      const desc = getExpenseDisplayDescription(e);
      const expAllocs = abcAllocations.filter((a) => String(a.expense_id) === String(e.id));
      const distributionText =
        expAllocs.length > 0
          ? expAllocs.map((a) => `${a['اسم الفيلا المحمل عليها']}: ${a.allocated_amount}`).join(' | ')
          : projectMap.get(String(e.project_id))?.Property || e.site_ref || 'عام';

      return {
        ...e,
        net_amount: amount,
        display_description: desc,
        distribution_text: distributionText,
      };
    });

    // الإجماليات العامة للنظام
    const totalContractValue = round2(projectsMatrix.reduce((s, p) => s + p.contract_value, 0));
    const totalRetentionAmount = round2(projectsMatrix.reduce((s, p) => s + p.retention_amount, 0));
    const totalNetContractExRetention = round2(
      projectsMatrix.reduce((s, p) => s + p.net_contract_ex_retention, 0)
    );
    const totalClientMaterialsDeduction = round2(
      projectsMatrix.reduce((s, p) => s + p.client_materials_deduction, 0)
    );
    const totalClientRemaining = round2(projectsMatrix.reduce((s, p) => s + p.client_remaining, 0));
    const totalClientNetExRetention = round2(
      projectsMatrix.reduce((s, p) => s + p.client_net_ex_retention, 0)
    );
    const totalEstimatedBudget = round2(projectsMatrix.reduce((s, p) => s + p.estimated_budget, 0));
    const totalActualProjectCosts = round2(projectsMatrix.reduce((s, p) => s + p.total_actual_cost, 0));
    const totalForecastedCostEac = round2(projectsMatrix.reduce((s, p) => s + p.forecasted_cost_eac, 0));
    const totalRemainingBudget = round2(totalEstimatedBudget - totalActualProjectCosts);
    const totalNetContractMargin = round2(totalContractValue - totalActualProjectCosts);
    const totalActualProfitExRetention = round2(totalNetContractExRetention - totalActualProjectCosts);
    const totalActualMarginPct =
      totalContractValue > 0 ? round2((totalNetContractMargin / totalContractValue) * 100) : 0;

    const totalExpectedProfitEac = round2(projectsMatrix.reduce((s, p) => s + p.expected_profit_eac, 0));
    const totalExpectedProfitEacExRetention = round2(
      projectsMatrix.reduce((s, p) => s + p.expected_profit_eac_ex_retention, 0)
    );
    const totalExpectedMarginPct =
      totalContractValue > 0 ? round2((totalExpectedProfitEac / totalContractValue) * 100) : 0;
    const totalExpectedMarginExRetentionPct =
      totalNetContractExRetention > 0
        ? round2((totalExpectedProfitEacExRetention / totalNetContractExRetention) * 100)
        : 0;

    const overallDeviationFactor =
      totalActualProjectCosts > 0 ? round2(totalEstimatedBudget / totalActualProjectCosts) : null;
    const overallVariancePct =
      totalEstimatedBudget > 0
        ? round2(((totalEstimatedBudget - totalActualProjectCosts) / totalEstimatedBudget) * 100)
        : 0;
    const overrunProjects = projectsMatrix.filter((p) => p.remaining_budget < 0 || p.expected_profit_eac < 0);

    const totalReceiptVouchers = round2(enrichedReceipts.reduce((s, r) => s + (Number(r.amount) || 0), 0));
    const totalPaymentVouchers = round2(enrichedPayments.reduce((s, v) => s + (Number(v.amount) || 0), 0));
    const pvClaimsTotal = round2(
      enrichedPayments.filter((v) => v.sub_claim_id).reduce((s, v) => s + (Number(v.amount) || 0), 0)
    );
    const pvExpensesTotal = round2(
      enrichedPayments.filter((v) => v.related_expense_id).reduce((s, v) => s + (Number(v.amount) || 0), 0)
    );
    const pvWorkersTotal = round2(
      enrichedPayments
        .filter((v) => !v.sub_claim_id && !v.related_expense_id)
        .reduce((s, v) => s + (Number(v.amount) || 0), 0)
    );

    const netCashTreasury = round2(totalReceiptVouchers - totalPaymentVouchers);
    const totalLaborEarned = round2(workersSummary.reduce((s, w) => s + w.earned, 0));
    const totalLaborPaid = round2(workersSummary.reduce((s, w) => s + w.paid, 0));
    const totalLaborRemaining = round2(totalLaborEarned - totalLaborPaid);

    const totalClaimsNet = round2(contractorsSummary.reduce((s, c) => s + c.claimed, 0));
    const totalClaimsPaid = round2(contractorsSummary.reduce((s, c) => s + c.paid, 0));
    const totalClaimsRemaining = round2(totalClaimsNet - totalClaimsPaid);

    const totalExpensesAmount = round2(enrichedExpenses.reduce((s, e) => s + e.net_amount, 0));
    const totalCustomerMaterials = totalClientMaterialsDeduction;

    return {
      projectsList: rawData.projects,
      projectsMatrix,
      workersSummary,
      contractorsSummary,
      receiptVouchers: enrichedReceipts,
      paymentVouchers: enrichedPayments,
      expenses: enrichedExpenses,
      abcAllocations,
      totals: {
        totalContractValue,
        totalRetentionAmount,
        totalNetContractExRetention,
        totalClientMaterialsDeduction,
        totalClientRemaining,
        totalClientNetExRetention,
        totalEstimatedBudget,
        totalActualProjectCosts,
        totalForecastedCostEac,
        totalRemainingBudget,
        totalNetContractMargin,
        totalActualProfitExRetention,
        totalActualMarginPct,
        totalExpectedProfitEac,
        totalExpectedProfitEacExRetention,
        totalExpectedMarginPct,
        totalExpectedMarginExRetentionPct,
        overallDeviationFactor,
        overallVariancePct,
        overrunProjectsCount: overrunProjects.length,
        totalReceiptVouchers,
        totalPaymentVouchers,
        pvClaimsTotal,
        pvExpensesTotal,
        pvWorkersTotal,
        netCashTreasury,
        totalLaborEarned,
        totalLaborPaid,
        totalLaborRemaining,
        totalClaimsNet,
        totalClaimsPaid,
        totalClaimsRemaining,
        totalExpensesAmount,
        totalCustomerMaterials,
      },
    };
  }, [rawData, dateRange.start, dateRange.end, selectedProjectId, activeCompanyId]);

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setDateRange({ start: '', end: '' });
    setSelectedProjectId('all');
  };

  const handleRefresh = () => {
    refetch();
    showToast('تم تحديث التقرير المالي الشامل بنجاح', 'success');
  };

  return {
    reportData,
    isLoading: isLoading || isRefetching,
    dateRange,
    handleDateChange,
    selectedProjectId,
    setSelectedProjectId,
    activeTab,
    setActiveTab,
    resetFilters,
    handleRefresh,
  };
}
