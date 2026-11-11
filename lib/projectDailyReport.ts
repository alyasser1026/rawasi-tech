import { buildMilestoneSchedule, localToday, toDateStr, type ScheduleSummary } from './milestoneSchedule.ts';

export type ProjectVoucherKind = 'custody' | 'sub_claim' | 'expense' | 'advance' | 'labor_wage' | 'other';

export const VOUCHER_KIND_LABELS: Record<ProjectVoucherKind, string> = {
  labor_wage: 'صرف يوميات عمال',
  custody: 'عُهدة نقدية (حساب 125)',
  sub_claim: 'مستخلص مقاول',
  expense: 'سداد مصروف',
  advance: 'سلفة',
  other: 'سند صرف',
};

const normAr = (s: any) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[أإآءئؤ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ');

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function isHelperWorker(row: any): boolean {
  if (row?.is_helper === true || row?.worker_role_type === 'helper') return true;
  if (row?.is_helper === false || row?.worker_role_type === 'tech') return false;
  const roleText = `${row?.skill_level || ''} ${row?.partner_job_role || ''}`.trim();
  const codeText = String(row?.worker_code || '').toUpperCase();
  return roleText.includes('مساعد') || roleText.includes('عامل عادي') || codeText.startsWith('HLP-');
}

export function classifyProjectVoucher(v: any = {}, partner?: any, debitAccount?: any): ProjectVoucherKind {
  const debitCode = String(debitAccount?.code || v?.debit_account_code || '').trim();
  const debitName = normAr(debitAccount?.name || v?.debit_account?.name || v?.debit_account_name || '');
  const text = normAr(`${v?.description || ''} ${v?.notes || ''}`);
  const partnerType = String(partner?.partner_type || v?.partner?.partner_type || '').trim();

  if (
    Boolean(v?.custody_id) ||
    debitCode === '125' ||
    /عهد/.test(debitName) ||
    /(?:^|\s)(?:عهده|عهد|عُهد[هة]?)(?:\s|$)/u.test(text)
  ) {
    return 'custody';
  }
  if (Boolean(v?.sub_claim_id) || debitCode === '212' || /مستخلص/.test(text)) {
    return 'sub_claim';
  }
  if (Boolean(v?.related_expense_id) || /^سداد مصروف/.test(text) || /^5(?:1[13456789]|2[02-9])/.test(debitCode)) {
    return 'expense';
  }
  if (debitCode === '127' || debitCode === '128' || /(?:^|\s)(?:سلفه|سلف)(?:\s|$)/.test(text)) {
    return 'advance';
  }
  const isWageAccount = debitCode === '216' || debitCode === '512' || debitCode === '521' || /اجور|رواتب/.test(debitName);
  const isWageText = /(?:يوميه|يوميات|اجور|اجر|راتب|رواتب|مستحقات\s*(?:عمال|عامل|موظف))/.test(text);
  const isWorkerWithLabor =
    (partnerType === 'عامل يومية' || partnerType === 'عامل' || partnerType === 'موظف') &&
    /عمال|عامل|فني|صنايعي/.test(text);
  if (isWageAccount || isWageText || isWorkerWithLabor) {
    return 'labor_wage';
  }
  return 'other';
}

export function recordMatchesProject(rec: any, project: any): boolean {
  if (!rec || !project) return false;
  if (rec.project_id && project.id && rec.project_id === project.id) return true;
  if (Array.isArray(rec.project_ids) && project.id && rec.project_ids.includes(project.id)) return true;
  const siteNorm = normAr(rec.site_ref || rec.project_names_text || '');
  if (!siteNorm) return false;
  const candidates = [project.Property, project.project_name, project.project_code].map(normAr).filter(Boolean);
  return candidates.some((c) => siteNorm.includes(c) || c.includes(siteNorm));
}

export interface ProjectDailyReport {
  date: string;
  activeDates: string[];
  hasActivityToday: boolean;
  projectInfo: {
    id: string;
    name: string;
    code: string;
    status: string;
    stage: string;
    clientName: string;
    engineer: string;
    manager: string;
  };
  today: {
    labor: {
      logs: any[];
      count: number;
      techDays: number;
      techCost: number;
      helperDays: number;
      helperCost: number;
      totalDays: number;
      totalCost: number;
    };
    expenses: { items: any[]; count: number; total: number };
    vouchers: { items: any[]; count: number; total: number; wagePayoutsTotal: number; claimsTotal: number; expensesPaidTotal: number };
    custodies: { items: any[]; count: number; total: number };
    receipts: { items: any[]; count: number; total: number };
    materials: { items: any[]; count: number; total: number };
    subClaims: { items: any[]; count: number; total: number };
    siteVisits: { items: any[]; count: number };
    jobOrders: { active: any[]; completed: any[]; all: any[] };
  };
  cumulative: {
    contractValue: number;
    estimatedBudget: number;
    actualLaborCost: number;
    actualExpensesCost: number;
    actualSubcontractorCost: number;
    actualMaterialsCost: number;
    actualAbcAllocated: number;
    totalActualCost: number;
    budgetVariance: number;
    physicalProgress: number;
    totalCashCollected: number;
    paymentSchedule: ScheduleSummary;
    leafBoqItems: any[];
  };
}

export function buildProjectDailyReport(
  project: any,
  details: any = {},
  targetDate: string = localToday(),
  todayForMilestones: string = localToday()
): ProjectDailyReport {
  const dateStr = toDateStr(targetDate) || localToday();

  const allLaborLogs: any[] = details.laborStats?.logs || details.labor_logs || [];
  const allDirectExpenses: any[] = (details.expenses || []).filter((e: any) => e.row_type !== 'labor_direct');
  const allPaymentVouchers: any[] = (details.paymentVouchers || details.payment_vouchers || []).filter(
    (v: any) => !project?.id || recordMatchesProject(v, project) || v._matchedProject === true
  );
  const allProjectReceipts: any[] = details.projectReceipts || details.receipt_vouchers || [];
  const allMaterials: any[] = details.materials || details.materialIssues || [];
  const allSubClaims: any[] = details.subClaims || details.sub_claims || [];
  const allVisits: any[] = details.siteVisits || [];
  const allJobOrders: any[] = details.jobOrders || [];
  const boqList: any[] = details.boq || [];
  const milestones: any[] = details.milestones || [];

  // Collect all active dates for quick jumping
  const dateSet = new Set<string>();
  const addDate = (d: any) => {
    const s = toDateStr(d);
    if (s) dateSet.add(s);
  };
  allLaborLogs.forEach((l) => addDate(l.display_date || l.work_date));
  allDirectExpenses.forEach((e) => addDate(e.exp_date));
  allPaymentVouchers.forEach((v) => addDate(v.date));
  allProjectReceipts.forEach((r) => addDate(r.date));
  allMaterials.forEach((m) => addDate(m.issue_date || m.date));
  allSubClaims.forEach((c) => addDate(c.date));
  allVisits.forEach((v) => addDate(v.visit_date));
  const activeDates = Array.from(dateSet).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  // Filter today's records
  const todayLabor = allLaborLogs.filter((l) => toDateStr(l.display_date || l.work_date) === dateStr);
  let techDays = 0;
  let techCost = 0;
  let helperDays = 0;
  let helperCost = 0;
  const enrichedLabor = todayLabor.map((l) => {
    const days = l.attendance_days != null ? num(l.attendance_days) : (l.attendance_value != null ? num(l.attendance_value) : 1);
    const wage = num(l.daily_wage);
    const amount = l.amount != null ? num(l.amount) : round2(days * wage);
    const helper = isHelperWorker(l);
    if (helper) {
      helperDays = round2(helperDays + days);
      helperCost = round2(helperCost + amount);
    } else {
      techDays = round2(techDays + days);
      techCost = round2(techCost + amount);
    }
    return {
      ...l,
      is_helper: helper,
      role_label: helper ? 'يومية مساعد' : 'يومية فني',
      attendance_days: days,
      daily_wage: wage,
      amount,
    };
  });

  const todayExpenses = allDirectExpenses.filter((e) => toDateStr(e.exp_date) === dateStr);
  const expensesTotal = round2(todayExpenses.reduce((s, e) => s + num(e.total_price || e.amount), 0));

  const todayAllVouchers = allPaymentVouchers.filter((v) => toDateStr(v.date) === dateStr);
  const custodies: any[] = [];
  const vouchers: any[] = [];
  let wagePayoutsTotal = 0;
  let claimsTotal = 0;
  let expensesPaidTotal = 0;

  for (const v of todayAllVouchers) {
    const kind = classifyProjectVoucher(v, v.partner, v.debit_account);
    const amt = num(v.amount);
    const enriched = {
      ...v,
      voucher_kind: kind,
      kind_label: VOUCHER_KIND_LABELS[kind],
      amount: amt,
    };
    if (kind === 'custody') {
      custodies.push(enriched);
    } else {
      vouchers.push(enriched);
      if (kind === 'labor_wage') wagePayoutsTotal = round2(wagePayoutsTotal + amt);
      else if (kind === 'sub_claim') claimsTotal = round2(claimsTotal + amt);
      else if (kind === 'expense') expensesPaidTotal = round2(expensesPaidTotal + amt);
    }
  }

  const todayReceipts = allProjectReceipts.filter((r) => toDateStr(r.date) === dateStr);
  const receiptsTotal = round2(todayReceipts.reduce((s, r) => s + num(r.final_amount ?? r.amount), 0));

  const todayMaterials = allMaterials.filter((m) => toDateStr(m.issue_date || m.date) === dateStr);
  const materialsTotal = round2(todayMaterials.reduce((s, m) => s + num(m.total_amount), 0));

  const todaySubClaims = allSubClaims.filter((c) => toDateStr(c.date) === dateStr);
  const subClaimsTotal = round2(todaySubClaims.reduce((s, c) => s + num(c.net_amount ?? c.final_amount), 0));

  const todayVisits = allVisits.filter((v) => toDateStr(v.visit_date) === dateStr);

  const activeOrders = allJobOrders.filter((o) => !['مكتمل', 'معتمد', 'ملغي', 'ملغى'].includes(String(o.status || '')));
  const completedOrders = allJobOrders.filter((o) => ['مكتمل', 'معتمد'].includes(String(o.status || '')));

  // Cumulative BOQ & Budget
  const leafBoqItems = boqList.filter(
    (b) => (b.item_type === 'فرعي' || !b.item_type) && !boqList.some((c) => c.parent_id === b.id)
  );
  const actualLaborCost = round2(leafBoqItems.reduce((s, b) => s + num(b.actual_labor_cost), 0));
  const actualExpensesCost = round2(leafBoqItems.reduce((s, b) => s + num(b.actual_expenses_cost), 0));
  const actualSubcontractorCost = round2(leafBoqItems.reduce((s, b) => s + num(b.actual_subcontractor_cost), 0));
  const actualMaterialsCost = round2(leafBoqItems.reduce((s, b) => s + num(b.actual_material_cost), 0));
  const actualAbcAllocated = round2(leafBoqItems.reduce((s, b) => s + num(b.allocated_expenses || b.loaded_amount_egp || b.loaded_amount), 0));
  const totalActualCost = round2(actualLaborCost + actualExpensesCost + actualMaterialsCost + actualAbcAllocated);

  const boqEstimated = round2(
    leafBoqItems.reduce(
      (s, b) =>
        s +
        num(b.estimated_labor_cost) +
        num(b.estimated_expenses_cost) +
        num(b.estimated_material_cost) +
        num(b.estimated_subcontractor_cost),
      0
    )
  );
  const estimatedBudget = num(project?.estimated_budget) || boqEstimated;
  const contractValue = num(project?.contract_value);
  const budgetVariance = round2(estimatedBudget - totalActualCost);
  const physicalProgress = round2(num(project?.overall_completion_percentage));

  const paymentSchedule = buildMilestoneSchedule(milestones, allProjectReceipts, todayForMilestones);
  const totalCashCollected = paymentSchedule.totalReceived > 0
    ? paymentSchedule.totalReceived
    : round2(allProjectReceipts.reduce((s, r) => s + num(r.final_amount ?? r.amount), 0));

  const hasActivityToday =
    enrichedLabor.length > 0 ||
    todayExpenses.length > 0 ||
    todayAllVouchers.length > 0 ||
    todayReceipts.length > 0 ||
    todayMaterials.length > 0 ||
    todaySubClaims.length > 0 ||
    todayVisits.length > 0;

  return {
    date: dateStr,
    activeDates,
    hasActivityToday,
    projectInfo: {
      id: project?.id || '',
      name: project?.Property || project?.project_name || project?.project_code || 'المشروع',
      code: project?.project_code || '—',
      status: project?.status || 'غير محدد',
      stage: project?.current_stage || 'غير محدد',
      clientName: project?.client?.name || project?.client_name || 'غير محدد',
      engineer: project?.engineer_in_charge || 'غير محدد',
      manager: project?.project_manager || 'غير محدد',
    },
    today: {
      labor: {
        logs: enrichedLabor,
        count: enrichedLabor.length,
        techDays,
        techCost,
        helperDays,
        helperCost,
        totalDays: round2(techDays + helperDays),
        totalCost: round2(techCost + helperCost),
      },
      expenses: { items: todayExpenses, count: todayExpenses.length, total: expensesTotal },
      vouchers: {
        items: vouchers,
        count: vouchers.length,
        total: round2(vouchers.reduce((s, v) => s + v.amount, 0)),
        wagePayoutsTotal,
        claimsTotal,
        expensesPaidTotal,
      },
      custodies: {
        items: custodies,
        count: custodies.length,
        total: round2(custodies.reduce((s, c) => s + c.amount, 0)),
      },
      receipts: { items: todayReceipts, count: todayReceipts.length, total: receiptsTotal },
      materials: { items: todayMaterials, count: todayMaterials.length, total: materialsTotal },
      subClaims: { items: todaySubClaims, count: todaySubClaims.length, total: subClaimsTotal },
      siteVisits: { items: todayVisits, count: todayVisits.length },
      jobOrders: { active: activeOrders, completed: completedOrders, all: allJobOrders },
    },
    cumulative: {
      contractValue,
      estimatedBudget,
      actualLaborCost,
      actualExpensesCost,
      actualSubcontractorCost,
      actualMaterialsCost,
      actualAbcAllocated,
      totalActualCost,
      budgetVariance,
      physicalProgress,
      totalCashCollected,
      paymentSchedule,
      leafBoqItems,
    },
  };
}
