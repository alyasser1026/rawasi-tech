import { getRelationPrimaryKey, runWithConcurrency } from './supabase-pagination';

export interface DailyExpenseAllocationRow {
  id: string;
  expense_id: string;
  company_id: string | null;
  project_id: string | null;
  job_order_id: string | null;
  boq_budget_id: string | null;
  boq_item_id: string | null;
  source_has_project: boolean;
  source_has_job_order: boolean;
  allocation_basis:
    | 'daily_workers'
    | 'nearest_day_workers'
    | 'monthly_workers_fallback'
    | 'company_workers_fallback'
    | 'villa_orders_fallback';
  'كود الحركة المرجعي': string;
  'رقم أمر التشغيل': string;
  'شهر التحميل المالي': string;
  'تاريخ المصروف الأصلي': string;
  'اسم الفيلا المحمل عليها': string;
  'البند المحمل عليه': string;
  'التصنيف الرئيسي': string;
  'البيان / الوصف': string;
  'وصف المصروف التلقائي': string;
  'قيمة الفاتورة الأصلية (ر.س)': number;
  'عمال اليوم للأمر': number;
  'إجمالي عمال اليوم': number;
  'يوميات الشهر للأمر': number | null;
  'نسبة التحميل (%)': number;
  'المبلغ المحمل (ر.س)': number;
  'المبلغ المحمل (جنيه)': number;
  loaded_amount: number;
  allocated_amount: number;
  worker_count: number;
  total_workers_in_pool: number;
  'آلية التوزيع': string;
  'آلية التوزيع الهندسية': string;
}

export interface ComputeDailyExpenseAllocationInput {
  expenses: any[];
  laborLogs?: any[];
  attendance?: any[];
  jobOrders?: any[];
  projects?: any[];
  boqItems?: any[];
  activeCompanyId?: string | null;
}

export interface FetchDailyExpenseAllocationsOptions {
  companyId?: string | null;
  projectId?: string | null;
  jobOrderId?: string | null;
  month?: string | null;
  villaName?: string | null;
  category?: string | null;
}

const round2 = (n: number): number => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const normalizeText = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');

export function getExpenseNetAmount(exp: any): number {
  if (!exp) return 0;
  let lines = exp.lines_data;
  if (typeof lines === 'string') {
    try {
      lines = JSON.parse(lines);
    } catch {
      lines = [];
    }
  }
  if (Array.isArray(lines) && lines.length > 0) {
    const linesBase = lines.reduce((sum: number, l: any) => {
      const lineTotal =
        Number(l?.total_price || 0) ||
        Number(l?.quantity ?? 1) * Number(l?.unit_price ?? 0);
      return sum + lineTotal;
    }, 0);
    if (linesBase > 0) {
      const explicitTotal = Number(exp.total_price || 0);
      if (explicitTotal > 0) return round2(explicitTotal);
      return round2(
        Math.max(0, linesBase + Number(exp.vat_amount || 0) - Number(exp.discount_amount || 0))
      );
    }
  }

  const explicitTotal = Number(exp.total_price || exp.amount || 0);
  if (explicitTotal > 0) {
    const extraTax = exp.total_price ? 0 : Number(exp.tax_amount ?? exp.vat_amount ?? 0);
    const extraDisc = exp.total_price ? 0 : Number(exp.discount_amount ?? 0);
    return round2(Math.max(0, explicitTotal + extraTax - extraDisc));
  }

  const qty = Number(exp.quantity ?? 1);
  const price = Number(exp.unit_price ?? 0);
  const vat = Number(exp.vat_amount ?? exp.tax_amount ?? 0);
  const disc = Number(exp.discount_amount ?? 0);
  const computed = qty * price + vat - disc;
  if (computed > 0) return round2(computed);

  const paid = Number(exp.paid_amount ?? 0);
  return paid > 0 ? round2(paid) : 0;
}

export function getExpenseDisplayDescription(exp: any): string {
  const direct = String(exp?.description ?? '').trim();
  if (direct) return direct;
  let lines = exp?.lines_data;
  if (typeof lines === 'string') {
    try {
      lines = JSON.parse(lines);
    } catch {
      lines = [];
    }
  }
  if (Array.isArray(lines) && lines.length > 0) {
    const joined = lines
      .map((l: any) => l?.description || l?.item_name || l?.work_item)
      .filter(Boolean)
      .join(' + ');
    if (joined.trim()) return joined.trim();
  }
  return String(exp?.main_category || exp?.notes || 'مصروف عام').trim();
}

export function isExpenseEligibleForDailyWorkerAllocation(exp: any): boolean {
  if (!exp) return false;
  if (exp.is_deleted === true) return false;
  if (exp.row_type === 'labor_direct' || exp.row_type === 'labor_allocated') return false;
  // Direct subcontractor ledger deductions are charged to the contractor claim, not general villa overhead
  if (
    exp.creditor_account === 'التزام مقاولي الباطن' &&
    exp.project_id &&
    exp.job_order_id
  ) {
    return false;
  }
  // An expense needs allocation if it has no villa (project_id) OR no job order (job_order_id)
  const hasProject = Boolean(exp.project_id && String(exp.project_id).trim() !== '');
  const hasJobOrder = Boolean(exp.job_order_id && String(exp.job_order_id).trim() !== '');
  if (hasProject && hasJobOrder) return false;

  return getExpenseNetAmount(exp) > 0;
}

interface ResolvedLaborTarget {
  companyId: string | null;
  workDate: string;
  workMonth: string;
  projectId: string;
  jobOrderId: string | null;
  boqBudgetId: string | null;
  workers: number;
}

interface GroupedTargetShare {
  projectId: string;
  jobOrderId: string | null;
  boqBudgetId: string | null;
  workers: number;
}

/**
 * Pure calculation engine that distributes unassigned expenses (missing project_id or job_order_id)
 * onto villas (projects) and job orders according to the day (exp_date = work_date) and proportional
 * to the number of workers (عدد العمالة) on each villa & job order on that day.
 */
export function computeDailyWorkerExpenseAllocations(
  input: ComputeDailyExpenseAllocationInput
): DailyExpenseAllocationRow[] {
  const {
    expenses = [],
    jobOrders = [],
    projects = [],
    boqItems = [],
    activeCompanyId = null,
  } = input;
  const laborLogs = input.laborLogs ?? input.attendance ?? [];

  const projectsById = new Map<string, any>();
  const projectsByNormName = new Map<string, any>();
  for (const p of projects) {
    if (!p?.id) continue;
    projectsById.set(String(p.id), p);
    const propName = normalizeText(p.Property || p.project_name || p.name);
    if (propName) projectsByNormName.set(propName, p);
  }

  const jobOrdersById = new Map<string, any>();
  const jobOrdersByProject = new Map<string, any[]>();
  for (const jo of jobOrders) {
    if (!jo?.id) continue;
    const joId = String(jo.id);
    jobOrdersById.set(joId, jo);
    if (jo.project_id) {
      const pid = String(jo.project_id);
      const list = jobOrdersByProject.get(pid) || [];
      list.push(jo);
      jobOrdersByProject.set(pid, list);
    }
  }

  const boqById = new Map<string, any>();
  const boqByItemId = new Map<string, any>();
  const leafBoqByProject = new Map<string, any[]>();
  const parentIds = new Set<string>(
    boqItems.map((b: any) => (b?.parent_id ? String(b.parent_id) : '')).filter(Boolean)
  );

  for (const b of boqItems) {
    if (!b?.id) continue;
    const bid = String(b.id);
    boqById.set(bid, b);
    if (b.boq_item_id) {
      boqByItemId.set(`${b.project_id || ''}:${b.boq_item_id}`, b);
    }
    const isLeaf = b.item_type === 'فرعي' || (!b.item_type && !parentIds.has(bid));
    if (isLeaf && b.project_id) {
      const pid = String(b.project_id);
      const list = leafBoqByProject.get(pid) || [];
      list.push(b);
      leafBoqByProject.set(pid, list);
    }
  }

  // Resolve each labor log into a concrete (projectId, jobOrderId, boqBudgetId, workers)
  const resolvedLogs: ResolvedLaborTarget[] = [];
  for (const l of laborLogs) {
    if (!l) continue;
    const workDate = String(l.work_date || '').split('T')[0];
    if (!workDate) continue;
    const workMonth = workDate.slice(0, 7);

    const rawJoId = l.job_order_id ? String(l.job_order_id) : null;
    let jo = rawJoId ? jobOrdersById.get(rawJoId) : null;

    let projectId: string | null = l.project_id
      ? String(l.project_id)
      : jo?.project_id
      ? String(jo.project_id)
      : null;

    if (!projectId && l.site_ref) {
      const matchedProj = projectsByNormName.get(normalizeText(l.site_ref));
      if (matchedProj?.id) projectId = String(matchedProj.id);
    }

    if (!projectId) continue;

    // If job_order_id was not explicitly set on the labor log, resolve from the villa's job orders
    if (!jo) {
      const projectJos = jobOrdersByProject.get(projectId) || [];
      if (projectJos.length === 1) {
        jo = projectJos[0];
      } else if (projectJos.length > 1) {
        if (l.work_item_id) {
          const matchedBoq =
            boqById.get(String(l.work_item_id)) ||
            boqByItemId.get(`${projectId}:${l.work_item_id}`);
          if (matchedBoq) {
            jo =
              projectJos.find(
                (cand) =>
                  String(cand.boq_budget_id) === String(matchedBoq.id) ||
                  String(cand.boq_budget_id) === String(matchedBoq.boq_item_id)
              ) || null;
          }
        }
        if (!jo) {
          jo =
            projectJos.find((cand) => cand.status === 'جاري التنفيذ') ||
            projectJos[0];
        }
      }
    }

    const jobOrderId = jo?.id ? String(jo.id) : rawJoId;
    let boqBudgetId: string | null = jo?.boq_budget_id ? String(jo.boq_budget_id) : null;

    if (boqBudgetId && !boqById.has(boqBudgetId)) {
      const mapped = boqByItemId.get(`${projectId}:${boqBudgetId}`);
      if (mapped?.id) boqBudgetId = String(mapped.id);
    }

    if (!boqBudgetId && l.work_item_id) {
      const matchedBoq =
        boqById.get(String(l.work_item_id)) ||
        boqByItemId.get(`${projectId}:${l.work_item_id}`);
      if (matchedBoq?.id) boqBudgetId = String(matchedBoq.id);
    }

    if (!boqBudgetId) {
      const leaves = leafBoqByProject.get(projectId) || [];
      if (leaves.length > 0) boqBudgetId = String(leaves[0].id);
    }

    const projObj = projectsById.get(projectId);
    const companyId: string | null =
      (l.company_id ? String(l.company_id) : null) ||
      (projObj?.company_id ? String(projObj.company_id) : null) ||
      (jo?.company_id ? String(jo.company_id) : null);

    // Worker count (عدد العمالة): use number_of_workers when > 0, else attendance_value, else 1
    const explicitWorkers = Number(l.number_of_workers || 0);
    const attendanceWorkers = Number(l.attendance_value || 0);
    const workers = explicitWorkers > 0 ? explicitWorkers : attendanceWorkers > 0 ? attendanceWorkers : 1;

    resolvedLogs.push({
      companyId,
      workDate,
      workMonth,
      projectId,
      jobOrderId,
      boqBudgetId,
      workers,
    });
  }

  // Precompute monthly workers per (companyId, month, projectId, jobOrderId) for metadata display
  const monthlyOrderWorkersMap = new Map<string, number>();
  for (const rl of resolvedLogs) {
    const key = `${rl.companyId || 'all'}|${rl.workMonth}|${rl.projectId}|${rl.jobOrderId || 'none'}`;
    monthlyOrderWorkersMap.set(key, (monthlyOrderWorkersMap.get(key) || 0) + rl.workers);
  }

  const groupLogsToShares = (logsSubset: ResolvedLaborTarget[]): GroupedTargetShare[] => {
    const map = new Map<string, GroupedTargetShare>();
    for (const rl of logsSubset) {
      const key = `${rl.projectId}|${rl.jobOrderId || ''}`;
      const existing = map.get(key);
      if (existing) {
        existing.workers += rl.workers;
        if (!existing.boqBudgetId && rl.boqBudgetId) {
          existing.boqBudgetId = rl.boqBudgetId;
        }
      } else {
        map.set(key, {
          projectId: rl.projectId,
          jobOrderId: rl.jobOrderId,
          boqBudgetId: rl.boqBudgetId,
          workers: rl.workers,
        });
      }
    }
    return Array.from(map.values()).filter((g) => g.workers > 0);
  };

  const results: DailyExpenseAllocationRow[] = [];

  for (const exp of expenses) {
    if (!isExpenseEligibleForDailyWorkerAllocation(exp)) continue;

    const expId = String(exp.id);
    const expDate = String(exp.exp_date || exp.created_at || '').split('T')[0];
    if (!expDate) continue;
    const expMonth = expDate.slice(0, 7);
    const originalAmount = getExpenseNetAmount(exp);
    if (originalAmount <= 0) continue;

    const expCompanyId: string | null = exp.company_id
      ? String(exp.company_id)
      : activeCompanyId
      ? String(activeCompanyId)
      : null;

    if (activeCompanyId && expCompanyId && expCompanyId !== String(activeCompanyId)) {
      continue;
    }

    let resolvedProjectId: string | null = exp.project_id ? String(exp.project_id) : null;
    const resolvedJobOrderId: string | null = exp.job_order_id ? String(exp.job_order_id) : null;

    // If site_ref names a specific villa while project_id was left null, resolve project_id
    if (!resolvedProjectId && exp.site_ref && !exp.is_auto_distributed) {
      const normSite = normalizeText(exp.site_ref);
      if (normSite && normSite !== 'عام' && normSite !== 'توزيع ذكي') {
        const matchedProj = projectsByNormName.get(normSite);
        if (matchedProj?.id) {
          resolvedProjectId = String(matchedProj.id);
        }
      }
    }

    // Case C: Job order is specified, but project_id is missing -> 100% on that job order's villa
    if (!resolvedProjectId && resolvedJobOrderId) {
      const jo = jobOrdersById.get(resolvedJobOrderId);
      if (jo?.project_id) {
        const pid = String(jo.project_id);
        const proj = projectsById.get(pid);
        const boqId = jo.boq_budget_id ? String(jo.boq_budget_id) : null;
        const boqObj = boqId ? boqById.get(boqId) : null;
        const desc = getExpenseDisplayDescription(exp);
        const villaName = proj?.Property || proj?.project_name || exp.site_ref || 'فيلا غير محددة';
        const workItemName = boqObj?.work_item || jo.notes || 'بند أمر الشغل';
        const mech = 'تحميل مباشر على أمر الشغل المحدد (100%)';

        results.push({
          id: `${expId}-${resolvedJobOrderId}`,
          expense_id: expId,
          company_id: expCompanyId || proj?.company_id || null,
          project_id: pid,
          job_order_id: resolvedJobOrderId,
          boq_budget_id: boqId,
          boq_item_id: boqObj?.boq_item_id || boqId,
          source_has_project: false,
          source_has_job_order: true,
          allocation_basis: 'daily_workers',
          'كود الحركة المرجعي': expId,
          'رقم أمر التشغيل': jo.order_number || 'أمر شغل مباشر',
          'شهر التحميل المالي': expMonth,
          'تاريخ المصروف الأصلي': expDate,
          'اسم الفيلا المحمل عليها': villaName,
          'البند المحمل عليه': workItemName,
          'التصنيف الرئيسي': exp.main_category || 'مصروف عام',
          'البيان / الوصف': desc,
          'وصف المصروف التلقائي': `[${jo.order_number || 'أمر شغل'}] ${desc}`,
          'قيمة الفاتورة الأصلية (ر.س)': originalAmount,
          'عمال اليوم للأمر': 1,
          'إجمالي عمال اليوم': 1,
          'يوميات الشهر للأمر': 1,
          'نسبة التحميل (%)': 100,
          'المبلغ المحمل (ر.س)': originalAmount,
          'المبلغ المحمل (جنيه)': originalAmount,
          loaded_amount: originalAmount,
          allocated_amount: originalAmount,
          worker_count: 1,
          total_workers_in_pool: 1,
          'آلية التوزيع': mech,
          'آلية التوزيع الهندسية': mech,
        });
        continue;
      }
    }

    // Filter candidate labor logs by company (and by project if project_id is specified on the expense)
    const companyLogs = resolvedLogs.filter((rl) => {
      if (expCompanyId && rl.companyId && rl.companyId !== expCompanyId) {
        return false;
      }
      if (resolvedProjectId) {
        return rl.projectId === resolvedProjectId;
      }
      return true;
    });

    // 1. Primary Strategy: Same Day Workers (work_date === exp_date)
    const sameDayLogs = companyLogs.filter((rl) => rl.workDate === expDate);
    let shares = groupLogsToShares(sameDayLogs);
    let basis: DailyExpenseAllocationRow['allocation_basis'] = 'daily_workers';
    let referenceDateUsed = expDate;

    // 2. Fallback Strategy A: If 0 workers on exact exp_date, check if there are workers in the same month
    if (shares.length === 0) {
      const sameMonthLogs = companyLogs.filter((rl) => rl.workMonth === expMonth);
      shares = groupLogsToShares(sameMonthLogs);
      if (shares.length > 0) {
        basis = 'monthly_workers_fallback';
      }
    }

    // 3. Fallback Strategy B: Nearest working day / all company labor logs (e.g. pre-project expenses in prior month)
    if (shares.length === 0 && companyLogs.length > 0) {
      // Find the closest workDate to expDate
      const expTime = new Date(expDate).getTime();
      let closestDate = companyLogs[0].workDate;
      let minDiff = Math.abs(new Date(closestDate).getTime() - expTime);
      for (const rl of companyLogs) {
        const diff = Math.abs(new Date(rl.workDate).getTime() - expTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestDate = rl.workDate;
        }
      }
      const nearestDayLogs = companyLogs.filter((rl) => rl.workDate === closestDate);
      shares = groupLogsToShares(nearestDayLogs);
      referenceDateUsed = closestDate;
      basis = 'nearest_day_workers';
    }

    // 4. Fallback Strategy C: If a specific villa was chosen (resolvedProjectId) and it has 0 labor logs ever,
    // distribute across that villa's job orders (or leaf BOQ items)
    if (shares.length === 0 && resolvedProjectId) {
      const villaJos = jobOrdersByProject.get(resolvedProjectId) || [];
      if (villaJos.length > 0) {
        shares = villaJos.map((jo) => ({
          projectId: resolvedProjectId!,
          jobOrderId: String(jo.id),
          boqBudgetId: jo.boq_budget_id ? String(jo.boq_budget_id) : null,
          workers: 1,
        }));
      } else {
        const leaves = leafBoqByProject.get(resolvedProjectId) || [];
        shares = [
          {
            projectId: resolvedProjectId,
            jobOrderId: null,
            boqBudgetId: leaves[0]?.id ? String(leaves[0].id) : null,
            workers: 1,
          },
        ];
      }
      basis = 'villa_orders_fallback';
    }

    if (shares.length === 0) continue;

    const totalWorkers = shares.reduce((sum, s) => sum + s.workers, 0);
    if (totalWorkers <= 0) continue;

    const desc = getExpenseDisplayDescription(exp);
    let allocatedRunningSum = 0;

    shares.forEach((share, idx) => {
      const isLast = idx === shares.length - 1;
      const ratio = share.workers / totalWorkers;
      const percentage = round2(ratio * 100);
      const allocatedAmount = isLast
        ? round2(Math.max(0, originalAmount - allocatedRunningSum))
        : round2(originalAmount * ratio);
      allocatedRunningSum = round2(allocatedRunningSum + allocatedAmount);

      const proj = projectsById.get(share.projectId);
      const jo = share.jobOrderId ? jobOrdersById.get(share.jobOrderId) : null;

      let resolvedBoqId = share.boqBudgetId || (jo?.boq_budget_id ? String(jo.boq_budget_id) : null);
      if (resolvedBoqId && !boqById.has(resolvedBoqId)) {
        const mapped = boqByItemId.get(`${share.projectId}:${resolvedBoqId}`);
        if (mapped?.id) resolvedBoqId = String(mapped.id);
      }
      if (!resolvedBoqId) {
        const leaves = leafBoqByProject.get(share.projectId) || [];
        if (leaves.length > 0) resolvedBoqId = String(leaves[0].id);
      }

      const boqObj = resolvedBoqId ? boqById.get(resolvedBoqId) : null;
      const villaName =
        proj?.Property || proj?.project_name || proj?.name || exp.site_ref || 'فيلا غير محددة';
      const orderNumber = jo?.order_number || 'عام للفيلا';
      const workItemName =
        boqObj?.work_item || jo?.notes || 'بند تشغيلي محمل بالعمالة';

      const monthWorkersKey = `${expCompanyId || proj?.company_id || 'all'}|${expMonth}|${share.projectId}|${share.jobOrderId || 'none'}`;
      const monthlyWorkers = monthlyOrderWorkersMap.get(monthWorkersKey) ?? share.workers;

      let mechanismLabel = '';
      if (basis === 'daily_workers') {
        mechanismLabel = `توزيع يومي حسب عدد العمالة (${share.workers} من ${totalWorkers} عامل بيوم ${expDate})`;
      } else if (basis === 'nearest_day_workers') {
        mechanismLabel = `توزيع يومي حسب عدد العمالة (${share.workers} من ${totalWorkers} عامل - أقرب يوم عمل ${referenceDateUsed})`;
      } else if (basis === 'monthly_workers_fallback') {
        mechanismLabel = `توزيع حسب عدد العمالة (${share.workers} من ${totalWorkers} يومية بالشهر لعدم وجود يومية بتاريخ ${expDate})`;
      } else {
        mechanismLabel = `توزيع على أوامر شغل الفيلا (${share.workers} من ${totalWorkers})`;
      }

      const targetKey = share.jobOrderId || share.boqBudgetId || share.projectId;

      results.push({
        id: `${expId}-${targetKey}`,
        expense_id: expId,
        company_id: expCompanyId || proj?.company_id || null,
        project_id: share.projectId,
        job_order_id: share.jobOrderId,
        boq_budget_id: resolvedBoqId,
        boq_item_id: boqObj?.boq_item_id || resolvedBoqId,
        source_has_project: Boolean(exp.project_id),
        source_has_job_order: Boolean(exp.job_order_id),
        allocation_basis: basis,
        'كود الحركة المرجعي': expId,
        'رقم أمر التشغيل': orderNumber,
        'شهر التحميل المالي': expMonth,
        'تاريخ المصروف الأصلي': expDate,
        'اسم الفيلا المحمل عليها': villaName,
        'البند المحمل عليه': workItemName,
        'التصنيف الرئيسي': exp.main_category || 'مصروف عام',
        'البيان / الوصف': desc,
        'وصف المصروف التلقائي': `[${orderNumber}] ${desc} (${share.workers} من ${totalWorkers} عامل)`,
        'قيمة الفاتورة الأصلية (ر.س)': originalAmount,
        'عمال اليوم للأمر': basis === 'daily_workers' || basis === 'nearest_day_workers' ? share.workers : 0,
        'إجمالي عمال اليوم': totalWorkers,
        'يوميات الشهر للأمر': monthlyWorkers,
        'نسبة التحميل (%)': percentage,
        'المبلغ المحمل (ر.س)': allocatedAmount,
        'المبلغ المحمل (جنيه)': allocatedAmount,
        loaded_amount: allocatedAmount,
        allocated_amount: allocatedAmount,
        worker_count: share.workers,
        total_workers_in_pool: totalWorkers,
        'آلية التوزيع': mechanismLabel,
        'آلية التوزيع الهندسية': mechanismLabel,
      });
    });
  }

  return results.sort((a, b) => {
    const dateCmp = String(b['تاريخ المصروف الأصلي'] || '').localeCompare(
      String(a['تاريخ المصروف الأصلي'] || '')
    );
    if (dateCmp !== 0) return dateCmp;
    return String(a.id).localeCompare(String(b.id));
  });
}

async function fetchAllTableRows(
  supabaseClient: any,
  tableName: string,
  selectColumns: string
): Promise<any[]> {
  const allRows: any[] = [];
  const seenIds = new Set<string>();
  const pk = getRelationPrimaryKey(tableName);
  const step = 1000;
  let from = 0;
  let loopGuard = 0;

  while (loopGuard < 50) {
    loopGuard++;
    const { data, error } = await supabaseClient
      .from(tableName)
      .select(selectColumns)
      .order(pk, { ascending: true })
      .range(from, from + step - 1);

    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.length === 0) break;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const key = row?.[pk] != null ? String(row[pk]) : row?.id != null ? String(row.id) : `${from + i}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        allRows.push(row);
      }
    }

    if (data.length < step) break;
    from += data.length;
  }

  return allRows;
}

/**
 * Fetches expenses, labor_daily_logs, job_orders, projects, and boq_budget from Supabase
 * and computes the daily worker-proportional expense allocations.
 */
export async function fetchDailyWorkerExpenseAllocations(
  supabaseClient: any,
  options: FetchDailyExpenseAllocationsOptions = {}
): Promise<DailyExpenseAllocationRow[]> {
  const [expenses, laborLogs, jobOrders, projects, boqItems] = await runWithConcurrency([
    () => fetchAllTableRows(
      supabaseClient,
      'expenses',
      'id, company_id, exp_date, created_at, main_category, description, notes, lines_data, quantity, unit_price, vat_amount, discount_amount, total_price, paid_amount, project_id, job_order_id, site_ref, creditor_account, is_auto_distributed, is_deducted_from_contractor, is_deleted'
    ),
    () => fetchAllTableRows(
      supabaseClient,
      'labor_daily_logs',
      'id, company_id, work_date, worker_name, site_ref, project_id, job_order_id, work_item_id, attendance_value, number_of_workers, daily_wage'
    ),
    () => fetchAllTableRows(
      supabaseClient,
      'job_orders',
      'id, company_id, order_number, project_id, boq_budget_id, status, notes'
    ),
    () => fetchAllTableRows(
      supabaseClient,
      'projects',
      'id, company_id, Property, project_name, status'
    ),
    () => fetchAllTableRows(
      supabaseClient,
      'boq_budget',
      'id, project_id, boq_item_id, parent_id, item_type, work_item'
    ),
  ], 3);

  let rows = computeDailyWorkerExpenseAllocations({
    expenses: expenses || [],
    laborLogs: laborLogs || [],
    jobOrders: jobOrders || [],
    projects: projects || [],
    boqItems: boqItems || [],
    activeCompanyId: options.companyId || null,
  });

  if (options.projectId) {
    rows = rows.filter((r) => String(r.project_id) === String(options.projectId));
  }
  if (options.jobOrderId) {
    rows = rows.filter((r) => String(r.job_order_id) === String(options.jobOrderId));
  }
  if (options.month && options.month !== 'الكل') {
    rows = rows.filter((r) => r['شهر التحميل المالي'] === options.month);
  }
  if (options.villaName && options.villaName !== 'الكل') {
    rows = rows.filter((r) => r['اسم الفيلا المحمل عليها'] === options.villaName);
  }
  if (options.category && options.category !== 'الكل') {
    rows = rows.filter((r) => r['التصنيف الرئيسي'] === options.category);
  }

  return rows;
}
