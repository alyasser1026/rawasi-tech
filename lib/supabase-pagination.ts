/**
 * المحرك الموحد لسحب البيانات من Supabase على دفعات آمنة (1000 صف ثم 1000 صف)
 * مع ترتيب حتمي يمنع تكرار أو سقوط الصفوف بين الصفحات وتقليل الحمل على الشبكة والذاكرة.
 */

export const SUPABASE_PAGE_SIZE = 1000;
export const SUPABASE_DEFAULT_MAX_ROWS = 50_000;

/** خريطة المفاتيح الفريدة لجميع الـ Views في قاعدة البيانات (الجداول الأساسية كلها تستخدم id) */
export const VIEW_PRIMARY_KEY_MAP: Record<string, string> = {
  all_partners_account_summary: 'partner_id',
  boq_budget_distinct: 'id',
  field_live_radar: 'project_id',
  job_order_ledger_view: 'source_id',
  job_order_performance: 'job_order_id',
  journal_master_view: 'line_id',
  partner_balances_summary: 'partner_id',
  partner_statement_ledger: 'line_id',
  subcontractor_claim_engine_view: 'assignment_id',
  vw_advanced_audit: 'error_id',
  vw_inventory_balances_v2: 'item_id',
  vw_project_comprehensive_ledger: 'id',
  vw_project_labor_costs: 'id',
  vw_subcontractor_itemized_costs: 'id',
  vw_unread_counts: 'user_id',
};

export function getRelationPrimaryKey(relationName: string): string {
  return VIEW_PRIMARY_KEY_MAP[relationName] ?? 'id';
}

const FALLBACK_KEY_FIELDS = [
  'id',
  'line_id',
  'assignment_id',
  'partner_id',
  'error_id',
  'job_order_id',
  'source_id',
  'item_id',
  'user_id',
] as const;

export function extractRowKey(row: any, preferredKey?: string): string | null {
  if (row == null || typeof row !== 'object') return null;

  if (preferredKey && row[preferredKey] !== undefined && row[preferredKey] !== null) {
    return String(row[preferredKey]);
  }

  for (const field of FALLBACK_KEY_FIELDS) {
    if (row[field] !== undefined && row[field] !== null) {
      return String(row[field]);
    }
  }

  return null;
}

export function ensureDeterministicOrderOnUrl(url: URL, relationName: string): boolean {
  const select = url.searchParams.get('select') || '';
  if (/\.\s*(count|sum|avg|min|max)\s*\(/i.test(select) || /(?:^|,)\s*count\s*\(/i.test(select)) {
    return false;
  }

  const pk = getRelationPrimaryKey(relationName);
  const currentOrder = url.searchParams.get('order');

  if (!currentOrder) {
    url.searchParams.set('order', `${pk}.asc`);
    return true;
  }

  const orderedCols = currentOrder.split(',').map((seg) => {
    const trimmed = seg.trim();
    const base = trimmed.split('.')[0] || '';
    return base.replace(/^"+|"+$/g, '').trim();
  });

  if (orderedCols.includes(pk)) {
    return false;
  }

  url.searchParams.set('order', `${currentOrder},${pk}.asc`);
  return true;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }
}

/**
 * دالة مساعدة لجلب البيانات من Supabase على مراحل (Pagination: 1000 بـ 1000)
 * لتجاوز حد الـ 1000 صف وحماية البيانات من التكرار في حالة تزامن الإضافات.
 *
 * @param buildQuery دالة تقوم بإرجاع كائن الاستعلام الخاص بـ Supabase (بدون استدعاء .range أو .limit)
 * @param primaryKey الحقل الأساسي المستخدم لمنع التكرار (الافتراضي 'id')
 * @param maxRows الحد الأقصى المتوقع للبيانات كحماية إضافية للذاكرة (الافتراضي 50000)
 * @param step حجم الدفعة في كل طلب (الافتراضي 1000 والحد الأقصى 1000)
 * @param signal AbortSignal اختياري لإلغاء السحب عند إغلاق الصفحة أو تغير الفلاتر
 * @returns مصفوفة تحتوي على جميع البيانات المدمجة والخالية من التكرار
 */
export async function fetchPaginatedData(
  buildQuery: () => any,
  primaryKey: string | ((row: any, index: number) => string) = 'id',
  maxRows: number = SUPABASE_DEFAULT_MAX_ROWS,
  step: number = SUPABASE_PAGE_SIZE,
  signal?: AbortSignal
) {
  const safeStep = Math.min(Math.max(1, Math.floor(step || SUPABASE_PAGE_SIZE)), SUPABASE_PAGE_SIZE);
  const safeMaxRows = Math.max(1, Math.floor(maxRows || SUPABASE_DEFAULT_MAX_ROWS));
  const maxLoops = Math.max(1, Math.ceil(safeMaxRows / safeStep));

  const allData: any[] = [];
  const seenIds = new Set<string>();
  let from = 0;
  let hasMore = true;
  let loopGuard = 0;

  while (hasMore && loopGuard < maxLoops) {
    throwIfAborted(signal);
    loopGuard++;

    const chunkLimit = Math.min(safeStep, safeMaxRows - allData.length);
    if (chunkLimit <= 0) break;

    // استدعاء buildQuery يضمن إنشاء كائن استعلام جديد نظيف في كل دفعة
    const query = buildQuery().range(from, from + chunkLimit - 1);
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    if (data && data.length > 0) {
      let rowIndex = from;
      for (const row of data) {
        const key =
          typeof primaryKey === 'function'
            ? primaryKey(row, rowIndex)
            : extractRowKey(row, primaryKey);

        if (key !== null) {
          if (!seenIds.has(key)) {
            seenIds.add(key);
            allData.push(row);
          }
        } else {
          allData.push(row);
        }
        rowIndex++;
        if (allData.length >= safeMaxRows) break;
      }

      from += data.length;
      if (data.length < chunkLimit || allData.length >= safeMaxRows) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allData.length > safeMaxRows ? allData.slice(0, safeMaxRows) : allData;
}

/**
 * تشغيل مجموعة مهام غير متزامنة بسقف تزامن محدد لمنع ضغط الطلبات المتوازية على Supabase.
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 4
): Promise<T[]> {
  if (!tasks || tasks.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.min(Math.floor(concurrency || 4), tasks.length));
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= tasks.length) return;
      results[idx] = await tasks[idx]();
    }
  };

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
  return results;
}
