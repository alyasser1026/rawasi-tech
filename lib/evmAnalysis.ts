// =========================================================================
// 📊 محرك تحليل القيمة المكتسبة والانحراف المالي (EVM Analysis Engine)
// -------------------------------------------------------------------------
// يطبّق معادلات إدارة القيمة المكتسبة القياسية (PMBOK) على خط أساس التكاليف
// المعتمدة في المقايسة (BAC) بدون خلط أسعار البيع مع التكاليف أو احتساب
// الإنفاق الفعلي كنسبة إنجاز:
//   - BAC = إجمالي التكاليف التقديرية المعتمدة (عمالة + باطن + خامات + مصروفات)
//   - PV  = القيمة المخططة حتى تاريخ التقرير بناءً على الجدول الزمني لكل بند
//   - EV  = BAC_item × نسبة الإنجاز الفعلي المحقق (من المقايسة/الكميات/اليوميات)
//   - AC  = التكاليف الفعلية المباشرة + المصروفات الموزعة (ABC)
//   - CV  = EV - AC (انحراف التكلفة: يكون 0 محايداً للبنود التي لم تبدأ بعد)
//   - SV  = EV - PV (انحراف الجدول الزمني)
//   - CPI = EV / AC ، SPI = EV / PV ، EAC = BAC / CPI
// =========================================================================

import { localToday, toDateStr } from './milestoneSchedule.ts';

export type EvmItemStatusKey =
  | 'not_started'
  | 'missing_progress'
  | 'cost_overrun'
  | 'under_budget'
  | 'on_budget';

export type EvmProgressSource = 'status' | 'boq' | 'quantity' | 'labor_log' | 'none';

export interface EvmStatusMeta {
  key: EvmItemStatusKey;
  label: string;
  bg: string;
  color: string;
  border: string;
}

export const EVM_STATUS_META: Record<EvmItemStatusKey, EvmStatusMeta> = {
  not_started:      { key: 'not_started',      label: 'لم يبدأ بعد',              bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  missing_progress: { key: 'missing_progress', label: 'صرف بدون نسبة إنجاز',      bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
  cost_overrun:     { key: 'cost_overrun',     label: 'تجاوز تكاليف',             bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  under_budget:     { key: 'under_budget',     label: 'وفر عن الميزانية',         bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  on_budget:        { key: 'on_budget',        label: 'منضبط مع الميزانية',       bg: '#e0f2fe', color: '#0369a1', border: '#93c5fd' },
};

export interface EvmLeafRow {
  id: string;
  raw: any;
  workItem: string;
  startDate: string;
  endDate: string;
  executionStatus: string;
  contractAmount: number;
  budgetCost: number;
  scheduleProgressRatio: number;
  scheduleProgressPct: number;
  plannedValueToDate: number;
  progressRatio: number;
  progressPct: number;
  progressSource: EvmProgressSource;
  earnedValue: number;
  directActual: number;
  allocatedAbc: number;
  totalActual: number;
  costVariance: number;
  scheduleVariance: number;
  remainingBudget: number;
  pricingMargin: number;
  isPricingDeficit: boolean;
  netProfit: number;
  cpi: number | null;
  spi: number | null;
  needsProgressEntry: boolean;
  status: EvmItemStatusKey;
}

export interface EvmAnalysisSummary {
  asOfDate: string;
  rows: EvmLeafRow[];
  totalContractAmount: number;
  bac: number;
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
  directActualCost: number;
  allocatedAbcCost: number;
  remainingBudget: number;
  costVariance: number;
  scheduleVariance: number;
  totalPricingMargin: number;
  totalNetProfit: number;
  cpi: number | null;
  cpiFormatted: string;
  spi: number | null;
  spiFormatted: string;
  eac: number | null;
  vac: number | null;
  progressPct: number;
  plannedProgressPct: number;
  isCostOverrun: boolean;
  isBehindSchedule: boolean;
  hasStarted: boolean;
  missingProgressCount: number;
  pricingDeficitCount: number;
}

const toNum = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

const isValidIsoDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

const diffDaysUtc = (fromIso: string, toIso: string): number => {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86400000);
};

/**
 * يحسب نسبة الإنجاز الزمني المخطط (0..1) بتاريخ التقرير بناءً على تواريخ البند أو تواريخ المشروع.
 */
export function resolveScheduleRatio(
  itemStartRaw: any,
  itemEndRaw: any,
  projectStartRaw: any,
  projectEndRaw: any,
  asOfDate: string
): number {
  const itemStart = toDateStr(itemStartRaw);
  const itemEnd = toDateStr(itemEndRaw);

  const computeRatio = (start: string, end: string): number => {
    if (asOfDate < start) return 0;
    if (asOfDate >= end) return 1;
    const totalDays = Math.max(1, diffDaysUtc(start, end) + 1);
    const elapsedDays = Math.max(0, Math.min(totalDays, diffDaysUtc(start, asOfDate) + 1));
    return clamp01(elapsedDays / totalDays);
  };

  if (isValidIsoDate(itemStart) && isValidIsoDate(itemEnd) && itemEnd >= itemStart) {
    return computeRatio(itemStart, itemEnd);
  }
  if (isValidIsoDate(itemStart) && !isValidIsoDate(itemEnd)) {
    return asOfDate >= itemStart ? 1 : 0;
  }

  const projStart = toDateStr(projectStartRaw);
  const projEnd = toDateStr(projectEndRaw);
  if (isValidIsoDate(projStart) && isValidIsoDate(projEnd) && projEnd >= projStart) {
    return computeRatio(projStart, projEnd);
  }

  // لا توجد تواريخ مخططة للبند ولا للمشروع: نعتبر كامل ميزانية البند مخططة فورياً
  return 1;
}

/**
 * يستخرج بنود المقايسة التنفيذية (الفرعية/المستقلة بدون صفوف المراحل الأب لتجنب الازدواج).
 */
export function extractEvmLeafItems(boqList: any[] = []): any[] {
  const parentIdsWithChildren = new Set<string>();
  for (const row of boqList) {
    if (row?.parent_id) parentIdsWithChildren.add(String(row.parent_id));
  }
  return boqList.filter((b: any) => {
    if (!b) return false;
    if (parentIdsWithChildren.has(String(b.id))) return false;
    return b.item_type !== 'رئيسي';
  });
}

export interface EvmAnalysisOptions {
  asOfDate?: string;
  project?: any;
  laborLogs?: any[];
}

/**
 * يبني تحليل القيمة المكتسبة والانحراف المالي الكامل للمشروع وبنوده.
 */
export function buildEvmAnalysis(
  boqList: any[] = [],
  options: EvmAnalysisOptions = {}
): EvmAnalysisSummary {
  const asOfDate = options.asOfDate && isValidIsoDate(options.asOfDate) ? options.asOfDate : localToday();
  const project = options.project || {};
  const laborLogs = Array.isArray(options.laborLogs) ? options.laborLogs : [];

  const leafItems = extractEvmLeafItems(boqList);

  // رصد عدد البنود لكل boq_item_id حتى لا يحدث تطابق غامض إذا تكرر نفس بند الكتالوج لأكثر من دور
  const catalogIdCounts = new Map<string, number>();
  for (const item of leafItems) {
    if (item?.boq_item_id) {
      const key = String(item.boq_item_id);
      catalogIdCounts.set(key, (catalogIdCounts.get(key) || 0) + 1);
    }
  }

  // خريطة أقصى نسبة إنجاز مسجلة في يوميات العمالة لكل بند
  const laborPctByBoqId = new Map<string, number>();
  const laborPctByCatalogId = new Map<string, number>();
  for (const log of laborLogs) {
    const pct = toNum(log?.completion_percentage);
    if (pct <= 0) continue;
    const bounded = Math.min(100, pct);
    const directIds = [log?.job_order_boq_id, log?.work_item_id].filter(Boolean).map(String);
    for (const id of directIds) {
      laborPctByBoqId.set(id, Math.max(laborPctByBoqId.get(id) || 0, bounded));
      if (catalogIdCounts.get(id) === 1) {
        laborPctByCatalogId.set(id, Math.max(laborPctByCatalogId.get(id) || 0, bounded));
      }
    }
  }

  const rows: EvmLeafRow[] = leafItems.map((item: any, idx: number) => {
    const itemId = String(item?.id || `row-${idx}`);
    const contractQty = toNum(item?.contract_quantity);
    const actualQty = toNum(item?.actual_quantity);
    const unitPrice = toNum(item?.unit_contract_price);
    const contractAmount = round2(toNum(item?.total_contract_amount) || contractQty * unitPrice);

    const budgetCost = round2(
      toNum(item?.estimated_labor_cost) +
      toNum(item?.estimated_subcontractor_cost) +
      toNum(item?.estimated_material_cost) +
      toNum(item?.estimated_expenses_cost)
    );

    const directActual = round2(
      toNum(item?.actual_labor_cost) +
      toNum(item?.actual_material_cost) +
      toNum(item?.actual_expenses_cost)
    );
    const allocatedAbc = round2(toNum(item?.allocated_expenses));
    const totalActual = round2(directActual + allocatedAbc);

    const scheduleProgressRatio = resolveScheduleRatio(
      item?.start_date,
      item?.end_date,
      project?.start_date,
      project?.end_date,
      asOfDate
    );
    const plannedValueToDate = round2(budgetCost * scheduleProgressRatio);

    // نسبة الإنجاز الفعلي: لا تعتمد أبداً على قسمة الصرف على الميزانية!
    const executionStatus = String(item?.execution_status || '').trim();
    const boqPct = toNum(item?.completed_percentage);
    const qtyPct = contractQty > 0 && actualQty > 0 ? (actualQty / contractQty) * 100 : 0;
    const logPct =
      laborPctByBoqId.get(itemId) ??
      (item?.boq_item_id ? laborPctByCatalogId.get(String(item.boq_item_id)) : undefined) ??
      0;

    let progressRatio = 0;
    let progressSource: EvmProgressSource = 'none';
    if (executionStatus === 'انتهى') {
      progressRatio = 1;
      progressSource = 'status';
    } else if (boqPct > 0) {
      progressRatio = clamp01(boqPct / 100);
      progressSource = 'boq';
    } else if (qtyPct > 0) {
      progressRatio = clamp01(qtyPct / 100);
      progressSource = 'quantity';
    } else if (logPct > 0) {
      progressRatio = clamp01(logPct / 100);
      progressSource = 'labor_log';
    }

    const earnedValue = round2(budgetCost * progressRatio);
    const remainingBudget = round2(budgetCost - totalActual);
    const pricingMargin = round2(contractAmount - budgetCost);
    const isPricingDeficit = contractAmount > 0 && budgetCost > contractAmount;

    const notStartedYet = earnedValue === 0 && totalActual === 0;
    const needsProgressEntry = totalActual > 0 && progressRatio === 0;

    const costVariance = notStartedYet ? 0 : round2(earnedValue - totalActual);
    const scheduleVariance = round2(earnedValue - plannedValueToDate);

    // صافي ربح البند المتسق مع الميزانية والتكاليف المحملة ABC
    const netProfit = totalActual > 0
      ? round2(contractAmount - totalActual)
      : round2(contractAmount - budgetCost);

    const cpi = totalActual > 0 ? round2(earnedValue / totalActual) : null;
    const spi = plannedValueToDate > 0 ? round2(earnedValue / plannedValueToDate) : null;

    let status: EvmItemStatusKey = 'on_budget';
    if (notStartedYet) {
      status = 'not_started';
    } else if (needsProgressEntry && budgetCost > 0) {
      status = 'missing_progress';
    } else if (costVariance < -0.01) {
      status = 'cost_overrun';
    } else if (costVariance > 0.01) {
      status = 'under_budget';
    }

    return {
      id: itemId,
      raw: item,
      workItem: String(item?.work_item || 'بند بدون اسم'),
      startDate: toDateStr(item?.start_date),
      endDate: toDateStr(item?.end_date),
      executionStatus,
      contractAmount,
      budgetCost,
      scheduleProgressRatio,
      scheduleProgressPct: round2(scheduleProgressRatio * 100),
      plannedValueToDate,
      progressRatio,
      progressPct: round2(progressRatio * 100),
      progressSource,
      earnedValue,
      directActual,
      allocatedAbc,
      totalActual,
      costVariance,
      scheduleVariance,
      remainingBudget,
      pricingMargin,
      isPricingDeficit,
      netProfit,
      cpi,
      spi,
      needsProgressEntry,
      status,
    };
  });

  const totalContractAmount = round2(rows.reduce((s, r) => s + r.contractAmount, 0));
  const bac = round2(rows.reduce((s, r) => s + r.budgetCost, 0));
  const plannedValue = round2(rows.reduce((s, r) => s + r.plannedValueToDate, 0));
  const earnedValue = round2(rows.reduce((s, r) => s + r.earnedValue, 0));
  const directActualCost = round2(rows.reduce((s, r) => s + r.directActual, 0));
  const allocatedAbcCost = round2(rows.reduce((s, r) => s + r.allocatedAbc, 0));
  const actualCost = round2(directActualCost + allocatedAbcCost);
  const remainingBudget = round2(bac - actualCost);
  const costVariance = round2(earnedValue - actualCost);
  const scheduleVariance = round2(earnedValue - plannedValue);
  const totalPricingMargin = round2(rows.reduce((s, r) => s + r.pricingMargin, 0));
  const totalNetProfit = round2(rows.reduce((s, r) => s + r.netProfit, 0));

  const cpiRaw = actualCost > 0 ? earnedValue / actualCost : null;
  const spiRaw = plannedValue > 0 ? earnedValue / plannedValue : null;
  const cpi = cpiRaw !== null ? Math.round(cpiRaw * 100) / 100 : null;
  const spi = spiRaw !== null ? Math.round(spiRaw * 100) / 100 : null;

  const eac = cpiRaw !== null && cpiRaw > 0 && earnedValue > 0 ? round2(bac / cpiRaw) : null;
  const vac = eac !== null ? round2(bac - eac) : null;

  const progressPct = bac > 0 ? round2((earnedValue / bac) * 100) : 0;
  const plannedProgressPct = bac > 0 ? round2((plannedValue / bac) * 100) : 0;

  return {
    asOfDate,
    rows,
    totalContractAmount,
    bac,
    plannedValue,
    earnedValue,
    actualCost,
    directActualCost,
    allocatedAbcCost,
    remainingBudget,
    costVariance,
    scheduleVariance,
    totalPricingMargin,
    totalNetProfit,
    cpi,
    cpiFormatted: cpi !== null ? cpi.toFixed(2) : '—',
    spi,
    spiFormatted: spi !== null ? spi.toFixed(2) : '—',
    eac,
    vac,
    progressPct,
    plannedProgressPct,
    isCostOverrun: actualCost > earnedValue,
    isBehindSchedule: earnedValue + 0.01 < plannedValue,
    hasStarted: actualCost > 0 || earnedValue > 0 || plannedValue > 0,
    missingProgressCount: rows.filter(r => r.needsProgressEntry).length,
    pricingDeficitCount: rows.filter(r => r.isPricingDeficit).length,
  };
}
