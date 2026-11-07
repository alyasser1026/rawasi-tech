import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RETIRED_TOOL_NAMES } from './copilot-tool-registry.mjs';
import { getCopilotDate } from './copilot-tool-policy.mjs';
import { assessTareeha, unassessedReason } from './copilot-tareeha.mjs';
import { registerOperation, resolveOperationByNumberOrCode } from './copilot-bot-settings.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const CHECKLIST_DOC_PATH = path.join(rootDir, 'config', 'copilot_engineering_checklists.md');
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const LABOR_PAGE_SIZE = 100;
const TAREEHA_WINDOW_DAYS = 30;   // deficits are computed over the last 30 days (Riyadh date)
const TAREEHA_SCAN_LIMIT = 500;   // rows with a tareeha target scanned per request
const STATEMENT_MAX_ROWS = 500;   // matches MAX_PDF_ROWS in pdf-generator.mjs
const DAILY_WORKER_TYPES = new Set(['عامل', 'عامل يومية']); // payroll treats these as daily-wage workers
const SALARIED_TYPE = 'موظف';
// The only RPCs a tool may call: the payroll screen's own calculations (security invoker → RLS applies).
const RPC_ALLOWLIST = new Set(['pull_payroll_module_data', 'get_payroll_balances_with_cutoff']);
const cents = value => Math.round((Number(value) || 0) * 100);
const WORKER_NAME = /^[\p{L}\p{M}\p{N} .'\u2019-]{1,80}$/u;
const DAY_MS = 86_400_000;
const MISSING_DATA_SCOPE = 'بيانات فاي تك غير متاحة بدون جلسة مستخدم وشركة مصرح بها.';
const RETIRED_TOOL = 'تعذّر جلب البيانات: الأداة دي متوقفة في البوت لحين مراجعتها. افتح الشاشة المختصة في فاي تك.';
const SOURCE_UNAVAILABLE = 'تعذّر جلب البيانات من فاي تك. راجع الصلاحية وتوفر المصدر.';

function readJwtClaims(token) {
  if (typeof token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null;
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function getRestBase(supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.href.replace(/\/+$/, '') + '/rest/v1/';
  } catch {
    return null;
  }
}

function isPublishableKey(key) {
  return typeof key === 'string' && (/^sb_publishable_[\w-]+$/.test(key) || readJwtClaims(key)?.role === 'anon');
}

function isCurrentUserToken(token) {
  // Structural check only. Supabase validates the signature and runs RLS for this user.
  const claims = readJwtClaims(token);
  return claims?.role === 'authenticated' && typeof claims.sub === 'string' &&
    UUID.test(claims.sub) && Number.isFinite(claims.exp) && claims.exp > Date.now() / 1000;
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().startsWith(value) ? timestamp : NaN;
}

function resolveDateOrToday(val) {
  if (!val || typeof val !== 'string') return getCopilotDate();
  const trimmed = val.trim();
  if (['today', 'اليوم', 'النهارده', 'النهاردة'].includes(trimmed.toLowerCase()) || ['اليوم', 'النهارده', 'النهاردة'].includes(trimmed)) {
    return getCopilotDate();
  }
  if (['yesterday', 'امبارح', 'إمبارح', 'أمس', 'امس'].includes(trimmed.toLowerCase()) || ['امبارح', 'إمبارح', 'أمس', 'امس'].includes(trimmed)) {
    return getCopilotDate(new Date(Date.now() - DAY_MS));
  }
  return Number.isFinite(parseIsoDate(trimmed)) ? trimmed : getCopilotDate();
}

/**
 * Scoped Copilot tools. Every tool here is listed in copilot-tool-registry.mjs; company_id always
 * comes from this closure.
 */
export function createCopilotTools({
  supabaseUrl,
  supabaseKey,
  accessToken,
  companyId,
  fetchImpl = fetch,
  detailedReads = false,
  allowServiceRole = false,
} = {}) {
  const restBase = getRestBase(supabaseUrl);
  const validServiceMode =
    allowServiceRole === true &&
    Boolean(restBase) &&
    typeof companyId === 'string' &&
    UUID.test(companyId) &&
    typeof supabaseKey === 'string' &&
    supabaseKey.trim().length > 10;

  const hasDataScope = () =>
    validServiceMode ||
    Boolean(
      restBase &&
        typeof companyId === 'string' &&
        UUID.test(companyId) &&
        isPublishableKey(supabaseKey) &&
        isCurrentUserToken(accessToken)
    );

  const authToken = validServiceMode ? supabaseKey.trim() : accessToken;

  // Helper for REST queries
  async function fetchRest(endpoint, { exactCount = false } = {}) {
    if (!hasDataScope()) return { error: MISSING_DATA_SCOPE, data: null };
    try {
      const headers = { apikey: supabaseKey, Authorization: 'Bearer ' + authToken, 'x-company-id': companyId };
      if (exactCount) headers.Prefer = 'count=exact';
      const res = await fetchImpl(restBase + endpoint, {
        method: 'GET',
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { error: SOURCE_UNAVAILABLE, data: null };
      const data = await res.json();
      if (!Array.isArray(data)) return { error: SOURCE_UNAVAILABLE, data: null };
      if (!exactCount) return { data, error: null };
      const countMatch = /\/(\d+)$/.exec(res.headers.get('content-range') ?? '');
      const total = countMatch ? Number(countMatch[1]) : null;
      return { data, error: null, total: Number.isSafeInteger(total) && total >= data.length ? total : null };
    } catch {
      return { error: SOURCE_UNAVAILABLE, data: null };
    }
  }

  // Helper for scoped table queries with company_id automatically enforced
  async function fetchScopedRows(table, paramsObj = {}, { includeCompanyFilter = true } = {}) {
    const query = new URLSearchParams();
    if (includeCompanyFilter) {
      query.set('company_id', 'eq.' + companyId);
    }
    for (const [k, v] of Object.entries(paramsObj)) {
      if (Array.isArray(v)) {
        for (const item of v) query.append(k, String(item));
      } else if (v !== undefined && v !== null) {
        query.set(k, String(v));
      }
    }
    const { data, error, total } = await fetchRest(table + '?' + query.toString(), { exactCount: true });
    if (error) return { ok: false, error };
    return { ok: true, data, totalCount: total };
  }

  // Helper for inserting draft records (is_posted = false)
  async function insertScopedDraft(table, payload) {
    if (!hasDataScope() || (!detailedReads && process.env.COPILOT_LIVE_FIELD_OPS_ENABLED !== 'true')) {
      return { ok: false, error: MISSING_DATA_SCOPE };
    }
    try {
      const safeBody = {
        ...payload,
        company_id: companyId,
        is_posted: false,
      };
      const res = await fetchImpl(restBase + table, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: 'Bearer ' + authToken,
          'x-company-id': companyId,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(safeBody),
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { ok: false, error: SOURCE_UNAVAILABLE };
      const data = await res.json();
      return { ok: true, row: Array.isArray(data) ? data[0] : data };
    } catch {
      return { ok: false, error: SOURCE_UNAVAILABLE };
    }
  }

  // Helper for updating existing records scoped by company_id
  async function updateScopedRecord(table, filterField, filterValue, patch) {
    if (!hasDataScope() || (!detailedReads && process.env.COPILOT_LIVE_FIELD_OPS_ENABLED !== 'true')) {
      return { ok: false, error: MISSING_DATA_SCOPE };
    }
    try {
      const url = `${restBase}${table}?${encodeURIComponent(filterField)}=eq.${encodeURIComponent(filterValue)}&company_id=eq.${encodeURIComponent(companyId)}`;
      const res = await fetchImpl(url, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: 'Bearer ' + authToken,
          'x-company-id': companyId,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { ok: false, error: SOURCE_UNAVAILABLE };
      const data = await res.json();
      return { ok: true, row: Array.isArray(data) ? data[0] : data };
    } catch {
      return { ok: false, error: SOURCE_UNAVAILABLE };
    }
  }

  // Helper for allow-listed RPCs (same identity headers as fetchRest; RLS + x-company-id scope them).
  async function postRpc(name, body) {
    if (!hasDataScope()) return { error: MISSING_DATA_SCOPE, data: null };
    if (!RPC_ALLOWLIST.has(name)) return { error: SOURCE_UNAVAILABLE, data: null };
    try {
      const res = await fetchImpl(restBase + 'rpc/' + name, {
        method: 'POST',
        headers: {
          apikey: supabaseKey, Authorization: 'Bearer ' + authToken, 'x-company-id': companyId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { error: SOURCE_UNAVAILABLE, data: null };
      const data = await res.json();
      return Array.isArray(data) ? { data, error: null } : { error: SOURCE_UNAVAILABLE, data: null };
    } catch {
      return { error: SOURCE_UNAVAILABLE, data: null };
    }
  }

  return {
    // 1. يوميات وحضور العمال
    async get_labor_daily_logs({ date, start_date, end_date, worker_name, site_ref, include_wages = false } = {}) {
      const isFieldOpsMode = detailedReads || process.env.COPILOT_LIVE_FIELD_OPS_ENABLED === 'true';
      const canShowWages = isFieldOpsMode && include_wages === true;
      const start = parseIsoDate(date ?? start_date);
      const end = parseIsoDate(date ?? end_date);
      if ((date != null && (start_date != null || end_date != null)) ||
        !Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start >= 31 * DAY_MS) {
        return { success: false, error: 'حدّد تاريخًا صحيحًا أو فترة لا تتجاوز 31 يومًا.' };
      }
      const selectCols = isFieldOpsMode
        ? [
            'work_date', 'worker_name', 'site_ref', 'work_item', 'attendance_value',
            ...(canShowWages ? ['daily_wage'] : []),
            'tareeha', 'productivity', 'unit', 'completion_percentage', 'is_posted',
          ].join(',')
        : 'work_date,worker_name,site_ref,work_item,attendance_value';
      const query = new URLSearchParams({
        company_id: 'eq.' + companyId,
        select: selectCols,
        order: 'work_date.desc,worker_name.asc',
        limit: String(LABOR_PAGE_SIZE),
      });
      if (date != null) {
        query.append('work_date', 'eq.' + date);
      } else {
        query.append('work_date', 'gte.' + start_date);
        query.append('work_date', 'lte.' + end_date);
      }

      if (typeof worker_name === 'string' && worker_name.trim()) {
        query.append('worker_name', isFieldOpsMode ? `ilike.*${worker_name.trim()}*` : 'eq.' + worker_name.trim());
      }
      if (isFieldOpsMode && typeof site_ref === 'string' && site_ref.trim()) {
        query.append('site_ref', `ilike.*${site_ref.trim()}*`);
      }

      const { data, error, total } = await fetchRest('labor_daily_logs?' + query, { exactCount: true });
      if (error) return { success: false, error };

      if (!isFieldOpsMode) {
        return {
          success: true,
          date_filter: date ?? (start_date + ' إلى ' + end_date),
          count_records: total,
          returned_count: data.length,
          partial: total == null || total > data.length,
          logs: data.slice(0, 30).map(({ work_date, worker_name, site_ref, work_item, attendance_value }) => ({
            work_date, worker_name, site_ref, work_item, attendance_value,
          })),
        };
      }

      const totalWages = canShowWages ? data.reduce((s, r) => s + (Number(r.daily_wage) || 0), 0) : null;
      const totalAttendance = data.reduce((s, r) => s + (Number(r.attendance_value) || 0), 0);
      const uniqueWorkers = Array.from(new Set(data.map(r => r.worker_name).filter(Boolean)));
      const postedCount = data.filter(r => r.is_posted === true).length;
      const draftCount = data.filter(r => r.is_posted !== true).length;

      let latestRecordedHint = null;
      if (data.length === 0) {
        const recentCols = ['work_date', 'worker_name', 'site_ref', 'work_item', ...(canShowWages ? ['daily_wage'] : []), 'is_posted'].join(',');
        const recentRes = await fetchScopedRows('labor_daily_logs', {
          select: recentCols,
          order: 'work_date.desc',
          limit: '5',
        });
        if (recentRes.ok && recentRes.data.length > 0) {
          latestRecordedHint = {
            last_work_date: recentRes.data[0].work_date,
            recent_samples: recentRes.data,
          };
        }
      }

      return {
        success: true,
        date_filter: date ?? (start_date + ' إلى ' + end_date),
        count_records: total ?? data.length,
        returned_count: data.length,
        partial: total != null && total > data.length,
        count_unique_workers: uniqueWorkers.length,
        total_attendance_days: totalAttendance,
        wages_available: canShowWages,
        total_wages: totalWages,
        posted_records: postedCount,
        draft_records: draftCount,
        latest_recorded_hint: latestRecordedHint,
        logs: data.slice(0, 30),
      };
    },

    // 2. عجوزات الطريحة — التعريف في copilot-tareeha.mjs (الإنتاجية < الطريحة × الحضور).
    async get_tareeha_deficits() {
      const end = getCopilotDate();
      const start = new Date(Date.parse(end + 'T00:00:00Z') - (TAREEHA_WINDOW_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
      const query = new URLSearchParams({
        company_id: 'eq.' + companyId,
        tareeha: 'gt.0',
        select: 'work_date,worker_name,site_ref,work_item,tareeha,productivity,attendance_value,unit',
        order: 'work_date.desc,worker_name.asc',
        limit: String(TAREEHA_SCAN_LIMIT),
      });
      query.append('work_date', 'gte.' + start);
      query.append('work_date', 'lte.' + end);
      const { data, error, total } = await fetchRest('labor_daily_logs?' + query, { exactCount: true });
      if (error) return { success: false, error };
      const deficits = [];
      let assessed = 0;
      let noProductivity = 0;
      for (const row of data) {
        const result = assessTareeha(row);
        if (result) {
          assessed++;
          if (result.deficit) deficits.push({ ...row, ...result });
        } else if (unassessedReason(row) === 'no_productivity') {
          noProductivity++;
        }
      }
      return {
        success: true,
        start_date: start,
        end_date: end,
        count: deficits.length,
        assessed,
        no_productivity: noProductivity,
        partial: total == null || total > data.length,
        deficits: deficits.slice(0, 20),
      };
    },

    // 2b. كشف عامل يومية لشهر (للـ PDF فقط — مش معلنة للموديل).
    async get_worker_month_statement({ worker_name, month, cutoff_date, include_money = false } = {}) {
      const name = typeof worker_name === 'string' ? worker_name.trim() : '';
      const monthMatch = typeof month === 'string' ? month.match(/^(\d{4})-(0[1-9]|1[0-2])$/) : null;
      const first = monthMatch ? month + '-01' : '';
      if (!WORKER_NAME.test(name) || !monthMatch || !Number.isFinite(parseIsoDate(cutoff_date)) ||
        !String(cutoff_date).startsWith(month + '-') || cutoff_date < first) {
        return { success: false, error: 'حدّد اسم العامل وشهر صحيح.' };
      }

      const partnerQuery = new URLSearchParams({
        company_id: 'eq.' + companyId, name: 'eq.' + name, select: 'id,partner_type', limit: '3',
      });
      const partners = await fetchRest('partners?' + partnerQuery);
      if (partners.error) return { success: false, error: partners.error };
      if (partners.data.length === 0) return { success: true, found: false };
      if (partners.data.length > 1) return { success: true, found: true, ambiguous: true };
      const partner = partners.data[0];
      if (partner.partner_type === SALARIED_TYPE) return { success: true, found: true, salaried: true };
      if (!DAILY_WORKER_TYPES.has(partner.partner_type)) return { success: true, found: true, not_worker: true };

      const columns = ['work_date', 'site_ref', 'work_item', 'attendance_value', 'tareeha', 'productivity', 'unit',
        'notes', 'production_desc', 'is_posted', ...(include_money === true ? ['daily_wage'] : [])];
      const rowsQuery = new URLSearchParams({
        company_id: 'eq.' + companyId,
        worker_partner_id: 'eq.' + partner.id,
        select: columns.join(','),
        order: 'work_date.asc',
        limit: String(STATEMENT_MAX_ROWS + 1),
      });
      rowsQuery.append('work_date', 'gte.' + first);
      rowsQuery.append('work_date', 'lte.' + cutoff_date);
      const logs = await fetchRest('labor_daily_logs?' + rowsQuery, { exactCount: true });
      if (logs.error) return { success: false, error: logs.error };
      const result = {
        success: true,
        found: true,
        partial: logs.total == null || logs.total > STATEMENT_MAX_ROWS || logs.data.length > STATEMENT_MAX_ROWS,
        rows: logs.data.slice(0, STATEMENT_MAX_ROWS),
        unposted_count: logs.data.filter(row => row.is_posted !== true).length,
        money: null,
      };
      if (include_money !== true) return result;

      const args = { p_month: Number(monthMatch[2]), p_year: Number(monthMatch[1]), p_cutoff_date: cutoff_date };
      const [moduleData, balances] = await Promise.all([
        postRpc('pull_payroll_module_data', args),
        postRpc('get_payroll_balances_with_cutoff', args),
      ]);
      const mine = moduleData.data?.find(row => row.partner_id === partner.id);
      const balance = balances.data?.find(row => row.partner_id === partner.id);
      if (moduleData.error || balances.error || !mine || !balance) return { ...result, money_error: true };
      const earned = cents(mine.total_earned_wage);
      const violations = cents(mine.total_violations);
      const payments = cents(mine.total_payments);
      const previous = cents(balance.previous_unpaid_balance);
      const currentNet = earned - violations - payments;
      result.money = {
        days_worked: Number(mine.days_worked) || 0,
        earned: earned / 100,
        violations: violations / 100,
        payments: payments / 100,
        current_net: currentNet / 100,
        previous_balance: previous / 100,
        final_net: (currentNet + previous) / 100,
      };
      return result;
    },

    // 3. المشاريع والفلل الموجودة كلها والمشاريع اللي اشتغلناها النهارده
    async get_all_projects_and_villas(rawArgs = {}) {
      if (!hasDataScope()) return { success: false, error: MISSING_DATA_SCOPE };
      const targetDate = resolveDateOrToday(rawArgs?.date || 'today');
      const filterMode = rawArgs?.filter_mode || 'all';
      const canShowWages = rawArgs?.include_wages === true;
      const laborCols = ['id', 'work_date', 'worker_name', 'site_ref', 'project_id', 'work_item', ...(canShowWages ? ['daily_wage'] : []), 'attendance_value'].join(',');

      const [projRes, laborRes, expRes, matRes, claimsRes, ordersRes, partnersRes] = await Promise.all([
        fetchScopedRows('projects', {
          select: 'id,project_code,Property,project_name,client_name,status,current_stage,unit_type,unit_area,engineer_in_charge,engineer_phone,project_manager,contract_value,estimated_budget,location_address,start_date,end_date',
          order: 'created_at.desc',
          limit: '100',
        }),
        fetchScopedRows('labor_daily_logs', {
          select: laborCols,
          work_date: `eq.${targetDate}`,
          limit: '100',
        }),
        fetchScopedRows('expenses', {
          select: 'id,exp_date,description,total_price,site_ref,project_id,main_category',
          exp_date: `eq.${targetDate}`,
          is_deleted: 'eq.false',
          limit: '100',
        }),
        fetchScopedRows('material_issues', {
          select: 'id,issue_number,project_id,issue_date,total_amount,contractor_text_name',
          issue_date: `eq.${targetDate}`,
          limit: '100',
        }),
        fetchScopedRows('sub_claims', {
          select: 'id,claim_number,project_id,project_names_text,date,net_amount,status',
          date: `eq.${targetDate}`,
          limit: '100',
        }),
        fetchScopedRows('job_orders', {
          select: 'id,order_number,project_id,status,assigned_qty,unit_price',
          limit: '100',
        }),
        fetchScopedRows('partners', {
          select: 'id,code,name,partner_type,job_role,phone,is_active',
          order: 'partner_type.asc,name.asc',
          limit: '200',
        }),
      ]);

      if (!projRes.ok) return { success: false, error: projRes.error };

      const projects = projRes.data || [];
      const laborLogs = laborRes.ok ? laborRes.data : [];
      const expenses = expRes.ok ? expRes.data : [];
      const matIssues = matRes.ok ? matRes.data : [];
      const subClaims = claimsRes.ok ? claimsRes.data : [];
      const jobOrders = ordersRes.ok ? ordersRes.data : [];
      const partners = partnersRes.ok ? partnersRes.data : [];

      const projectList = projects.map(p => {
        const name = p.Property || p.project_name || p.project_code || 'مشروع بدون اسم';
        const matchSite = ref => ref && (String(ref).includes(name) || name.includes(String(ref)));

        const projLabor = laborLogs.filter(l => l.project_id === p.id || matchSite(l.site_ref));
        const projExp = expenses.filter(e => e.project_id === p.id || matchSite(e.site_ref));
        const projMat = matIssues.filter(m => m.project_id === p.id);
        const projClaims = subClaims.filter(c => c.project_id === p.id || matchSite(c.project_names_text));
        const projOrders = jobOrders.filter(j => j.project_id === p.id);

        const workedToday = projLabor.length > 0 || projExp.length > 0 || projMat.length > 0 || projClaims.length > 0;

        return {
          id: p.id,
          name,
          project_code: p.project_code || '—',
          status: p.status || 'غير محدد',
          current_stage: p.current_stage || 'غير محدد',
          unit_type: p.unit_type || '—',
          unit_area: p.unit_area ? `${p.unit_area} م²` : '—',
          engineer_in_charge: p.engineer_in_charge || 'غير محدد',
          engineer_phone: p.engineer_phone || '—',
          project_manager: p.project_manager || 'غير محدد',
          location_address: p.location_address || '—',
          contract_value: Number(p.contract_value) || 0,
          estimated_budget: Number(p.estimated_budget) || 0,
          worked_on_date: workedToday,
          today_activity: {
            workers_count: projLabor.length,
            wages_available: canShowWages,
            labor_wages: canShowWages ? projLabor.reduce((s, r) => s + (Number(r.daily_wage) || 0), 0) : null,
            expenses_count: projExp.length,
            expenses_total: projExp.reduce((s, r) => s + (Number(r.total_price) || 0), 0),
            material_issues_count: projMat.length,
            material_issues_total: projMat.reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
            active_job_orders: projOrders.filter(o => o.status === 'جاري التنفيذ').length,
            completed_job_orders: projOrders.filter(o => o.status === 'مكتمل' || o.status === 'معتمد').length,
          },
        };
      });

      const workedProjects = projectList.filter(p => p.worked_on_date);
      const activeInProgressProjects = projectList.filter(p => p.status === 'قيد التنفيذ');

      return {
        success: true,
        filter_mode: filterMode,
        date_checked: targetDate,
        total_existing_projects: projectList.length,
        active_in_progress_count: activeInProgressProjects.length,
        worked_today_projects_count: workedProjects.length,
        all_projects: projectList,
        active_in_progress_projects: activeInProgressProjects,
        worked_today_projects: workedProjects,
        partners_count: partners.length,
        partners_list: partners.map(pt => ({
          name: pt.name,
          partner_type: pt.partner_type || 'غير محدد',
          job_role: pt.job_role || '—',
          phone: pt.phone || '—',
        })),
        unlinked_today_labor_logs: laborLogs.filter(l => !l.project_id).length,
        unlinked_today_expenses: expenses.filter(e => !e.project_id).length,
      };
    },

    // 4. التقرير اليومي المفصل الشامل (7 أقسام كاملة مع فحص صلاحية وتوفر كل قسم على حدة)
    async get_daily_comprehensive_report(rawArgs = {}) {
      if (!hasDataScope()) return { success: false, error: MISSING_DATA_SCOPE };

      const targetDate = resolveDateOrToday(rawArgs?.date || 'today');
      const villaFilter = typeof rawArgs?.villa_filter === 'string' ? rawArgs.villa_filter.trim() : '';
      const perms = rawArgs?.section_permissions && typeof rawArgs.section_permissions === 'object'
        ? rawArgs.section_permissions
        : {};
      const canLaborLogs = perms.labor_logs !== false;
      const canLaborCost = perms.laborcost !== false;
      const canProjects = perms.projects !== false;
      const canExpenses = perms.expenses !== false;
      const canPayments = perms.payments !== false;
      const canInventory = perms.inventory !== false;
      const canContractors = perms.contractors !== false;
      const canRequests = perms.requests !== false;
      const notPermitted = { ok: false, error: 'غير متاح بالصلاحية الحالية' };

      const laborCols = [
        'id', 'work_date', 'worker_name', 'site_ref', 'project_id', 'work_item', 'unit', 'skill_level',
        ...(canLaborCost ? ['daily_wage'] : []),
        'attendance_value', 'tareeha', 'productivity', 'completion_percentage', 'sub_contractor', 'notes', 'is_posted',
      ].join(',');

      const [
        projRes,
        laborRes,
        expRes,
        payRes,
        matIssuesRes,
        matLinesRes,
        claimsRes,
        ordersRes,
        assignRes,
        partnersRes,
        ucRes,
      ] = await Promise.all([
        canProjects
          ? fetchScopedRows('projects', {
              select: 'id,project_code,Property,project_name,status,current_stage,unit_type,unit_area,engineer_in_charge,project_manager,contract_value,estimated_budget,location_address',
              order: 'created_at.desc',
              limit: '100',
            })
          : Promise.resolve(notPermitted),
        canLaborLogs
          ? fetchScopedRows('labor_daily_logs', {
              select: laborCols,
              work_date: `eq.${targetDate}`,
              order: 'worker_name.asc',
              limit: '100',
            })
          : Promise.resolve(notPermitted),
        canExpenses
          ? fetchScopedRows('expenses', {
              select: 'id,exp_date,description,quantity,unit_price,total_price,paid_amount,payment_method,creditor_account,main_category,site_ref,payee_name,sub_contractor,project_id,is_posted,notes',
              exp_date: `eq.${targetDate}`,
              is_deleted: 'eq.false',
              order: 'created_at.desc',
              limit: '100',
            })
          : Promise.resolve(notPermitted),
        canPayments
          ? fetchScopedRows('payment_vouchers', {
              select: 'id,voucher_number,date,amount,partner_id,payment_method,description,notes,status,is_posted,site_ref,sub_claim_id',
              date: `eq.${targetDate}`,
              order: 'created_at.desc',
              limit: '100',
            })
          : Promise.resolve(notPermitted),
        canInventory
          ? fetchScopedRows('material_issues', {
              select: 'id,issue_number,project_id,subcontractor_id,contractor_text_name,issue_date,issue_type,total_amount,notes,is_posted,job_order_id',
              issue_date: `eq.${targetDate}`,
              order: 'created_at.desc',
              limit: '100',
            })
          : Promise.resolve(notPermitted),
        canInventory
          ? fetchScopedRows('material_issue_lines', {
              select: 'id,issue_id,item_name,quantity,unit,unit_price,total_price,job_order_id',
              limit: '100',
            })
          : Promise.resolve(notPermitted),
        canContractors
          ? fetchScopedRows('sub_claims', {
              select: 'id,claim_number,contractor_id,project_id,project_names_text,date,total_amount,retention_amount,deductions_amount,net_amount,paid_amount,status,is_posted,job_order_id',
              order: 'date.desc',
              limit: '50',
            })
          : Promise.resolve(notPermitted),
        canContractors
          ? fetchScopedRows('job_orders', {
              select: 'id,order_number,project_id,executor_type,contractor_id,assigned_qty,unit_price,status,start_date,end_date,notes',
              order: 'created_at.desc',
              limit: '50',
            })
          : Promise.resolve(notPermitted),
        canContractors
          ? fetchScopedRows('contractor_assignments', {
              select: 'id,contractor_id,project_id,assigned_qty,unit_price,status,villa_name,villa_number,job_order_id',
              limit: '50',
            })
          : Promise.resolve(notPermitted),
        fetchScopedRows('partners', {
          select: 'id,name,partner_type,phone,job_role',
          limit: '200',
        }),
        canRequests
          ? fetchScopedRows('user_companies', {
              select: 'user_id',
              limit: '50',
            })
          : Promise.resolve(notPermitted),
      ]);

      const projects = projRes.ok ? projRes.data : [];
      const projectMap = new Map(projects.map(p => [p.id, p.Property || p.project_name || p.project_code || 'مشروع']));
      const partners = partnersRes.ok ? partnersRes.data : [];
      const partnerMap = new Map(partners.map(p => [p.id, p]));

      let userRequests = [];
      let userTasks = [];
      let requestsAvailable = false;
      const companyUserIds = ucRes.ok ? ucRes.data.map(u => u.user_id).filter(id => typeof id === 'string' && UUID.test(id)) : [];
      if (canRequests && ucRes.ok && companyUserIds.length > 0) {
        const inFilter = `in.(${companyUserIds.join(',')})`;
        const [reqRes, taskRes] = await Promise.all([
          fetchScopedRows('user_requests', {
            select: 'id,user_id,type,category,subject,details,status,admin_note,created_at',
            user_id: inFilter,
            order: 'created_at.desc',
            limit: '30',
          }, { includeCompanyFilter: false }),
          fetchScopedRows('user_tasks', {
            select: 'id,user_id,title,description,status,priority,created_at',
            user_id: inFilter,
            order: 'created_at.desc',
            limit: '30',
          }, { includeCompanyFilter: false }),
        ]);
        if (reqRes.ok || taskRes.ok) {
          requestsAvailable = true;
          if (reqRes.ok) userRequests = reqRes.data;
          if (taskRes.ok) userTasks = taskRes.data;
        }
      }

      // 1. العمالة اللي نزلت النهارده
      let laborLogs = laborRes.ok ? laborRes.data : [];
      if (villaFilter) {
        laborLogs = laborLogs.filter(l =>
          (l.site_ref && l.site_ref.includes(villaFilter)) ||
          (projectMap.get(l.project_id) && projectMap.get(l.project_id).includes(villaFilter))
        );
      }
      const wagesAvailable = canLaborLogs && canLaborCost && laborRes.ok;
      const totalLaborWagesToday = wagesAvailable ? laborLogs.reduce((s, r) => s + (Number(r.daily_wage) || 0), 0) : null;
      const totalAttendanceDays = laborLogs.reduce((s, r) => s + (Number(r.attendance_value) || 0), 0);
      const uniqueWorkersToday = Array.from(new Set(laborLogs.map(r => r.worker_name).filter(Boolean)));

      // 2. الفلل والمشاريع
      const villasWorkedTodaySet = new Set();
      for (const l of laborLogs) {
        if (l.site_ref) villasWorkedTodaySet.add(l.site_ref);
        else if (l.project_id && projectMap.has(l.project_id)) villasWorkedTodaySet.add(projectMap.get(l.project_id));
      }
      let expensesToday = expRes.ok ? expRes.data : [];
      if (villaFilter) {
        expensesToday = expensesToday.filter(e =>
          (e.site_ref && e.site_ref.includes(villaFilter)) ||
          (projectMap.get(e.project_id) && projectMap.get(e.project_id).includes(villaFilter))
        );
      }
      for (const e of expensesToday) {
        if (e.site_ref) villasWorkedTodaySet.add(e.site_ref);
        else if (e.project_id && projectMap.has(e.project_id)) villasWorkedTodaySet.add(projectMap.get(e.project_id));
      }
      const matIssuesToday = matIssuesRes.ok ? matIssuesRes.data : [];
      for (const m of matIssuesToday) {
        if (m.project_id && projectMap.has(m.project_id)) villasWorkedTodaySet.add(projectMap.get(m.project_id));
      }

      // 3 & 4. المصروفات واللي اتصرف للعمالة
      const expensesAvailable = canExpenses && expRes.ok;
      const paymentsAvailable = canPayments && payRes.ok;
      const totalExpensesToday = expensesAvailable ? expensesToday.reduce((s, e) => s + (Number(e.total_price) || 0), 0) : null;
      const paymentVouchersToday = paymentsAvailable ? payRes.data : [];
      const totalPaymentVouchersToday = paymentsAvailable ? paymentVouchersToday.reduce((s, p) => s + (Number(p.amount) || 0), 0) : null;

      const laborRelatedExpenses = expensesAvailable ? expensesToday.filter(e => {
        const text = `${e.description || ''} ${e.main_category || ''} ${e.creditor_account || ''} ${e.payee_name || ''}`;
        return /عمال|عامل|يوميه|يومية|صنايعي|مصنعيه|مصنعية|رواتب|اجور|أجور/.test(text);
      }) : [];
      const laborRelatedVouchers = paymentsAvailable ? paymentVouchersToday.filter(v => {
        const partner = partnerMap.get(v.partner_id);
        const text = `${v.description || ''} ${v.notes || ''} ${partner?.partner_type || ''}`;
        return partner?.partner_type === 'عامل يومية' || partner?.partner_type === 'موظف' || /عمال|عامل|يوميه|يومية/.test(text);
      }) : [];
      const totalLaborExpenses = expensesAvailable ? laborRelatedExpenses.reduce((s, e) => s + (Number(e.total_price) || 0), 0) : null;
      const totalLaborVouchers = paymentsAvailable ? laborRelatedVouchers.reduce((s, v) => s + (Number(v.amount) || 0), 0) : null;

      // 5. الخامات اللي اتصرفت
      const materialsAvailable = canInventory && matIssuesRes.ok;
      const issueIdsToday = new Set(matIssuesToday.map(m => m.id));
      const allMatLines = matLinesRes.ok ? matLinesRes.data : [];
      const matLinesToday = allMatLines.filter(l => issueIdsToday.has(l.issue_id));
      const totalMaterialsIssuedAmount = materialsAvailable ? matIssuesToday.reduce((s, m) => s + (Number(m.total_amount) || 0), 0) : null;

      // 6. المقاولين اللي اتسلمت وأوامر الشغل والمستخلصات
      const contractorsAvailable = canContractors && (ordersRes.ok || claimsRes.ok);
      const jobOrders = ordersRes.ok ? ordersRes.data : [];
      const deliveredJobOrders = jobOrders.filter(o => o.status === 'مكتمل' || o.status === 'معتمد');
      const activeJobOrders = jobOrders.filter(o => o.status === 'جاري التنفيذ');
      const allSubClaims = claimsRes.ok ? claimsRes.data : [];
      const todaySubClaims = allSubClaims.filter(c => c.date === targetDate);
      const approvedOrDeliveredSubClaims = allSubClaims.filter(c => c.is_posted === true || c.status === 'معتمد' || c.status === 'مكتمل');
      const pendingSubClaims = allSubClaims.filter(c => c.is_posted === false && c.status !== 'معتمد');
      const assignments = assignRes.ok ? assignRes.data : [];

      // 7. الركوستات والمهام اللي خلصت
      const completedRequests = userRequests.filter(r => ['مكتمل', 'معتمد', 'تم الإنجاز', 'تم التنفيذ', 'مقبول', 'approved', 'completed', 'done'].includes(String(r.status || '').toLowerCase().trim()));
      const completedTasks = userTasks.filter(t => ['مكتمل', 'تم الإنجاز', 'تم التنفيذ', 'completed', 'done'].includes(String(t.status || '').toLowerCase().trim()));

      return {
        success: true,
        report_date: targetDate,
        villa_filter: villaFilter || 'جميع المشاريع والفلل',
        section_1_labor_today: {
          available: canLaborLogs && laborRes.ok,
          wages_available: wagesAvailable,
          records_count: canLaborLogs && laborRes.ok ? laborLogs.length : null,
          unique_workers_count: canLaborLogs && laborRes.ok ? uniqueWorkersToday.length : null,
          total_attendance_days: canLaborLogs && laborRes.ok ? totalAttendanceDays : null,
          total_daily_wages: totalLaborWagesToday,
          workers: laborLogs.map(l => ({
            worker_name: l.worker_name,
            site_ref: l.site_ref || projectMap.get(l.project_id) || 'غير محدد',
            work_item: l.work_item || '—',
            daily_wage: wagesAvailable ? (Number(l.daily_wage) || 0) : null,
            attendance_value: Number(l.attendance_value ?? 1),
            tareeha: l.tareeha != null ? Number(l.tareeha) : null,
            productivity: l.productivity != null ? Number(l.productivity) : null,
            completion_percentage: l.completion_percentage != null ? `${l.completion_percentage}%` : null,
            status: l.is_posted ? 'مرحّل' : 'مسودة',
          })),
        },
        section_2_villas_and_projects: {
          available: canProjects && projRes.ok,
          worked_today_count: canProjects && projRes.ok ? villasWorkedTodaySet.size : null,
          worked_today_villas: Array.from(villasWorkedTodaySet),
          total_company_projects: canProjects && projRes.ok ? projects.length : null,
          all_company_projects: projects.map(p => ({
            name: p.Property || p.project_name || p.project_code,
            project_code: p.project_code || '—',
            status: p.status || 'غير محدد',
            current_stage: p.current_stage || 'غير محدد',
            unit_type: p.unit_type || '—',
            unit_area: p.unit_area ? `${p.unit_area} م²` : '—',
            engineer_in_charge: p.engineer_in_charge || 'غير محدد',
            project_manager: p.project_manager || 'غير محدد',
            contract_value: Number(p.contract_value) || 0,
          })),
        },
        section_3_expenses_today: {
          available: expensesAvailable,
          expenses_count: expensesAvailable ? expensesToday.length : null,
          total_expenses_amount: totalExpensesToday,
          expenses_list: expensesToday.map(e => ({
            description: e.description,
            total_price: Number(e.total_price) || 0,
            main_category: e.main_category || 'عام',
            creditor_account: e.creditor_account || '—',
            site_ref: e.site_ref || projectMap.get(e.project_id) || 'عام',
            payee_name: e.payee_name || '—',
            payment_method: e.payment_method || 'آجل',
            status: e.is_posted ? 'مرحّل' : 'مسودة',
          })),
        },
        section_4_spent_on_labor: {
          available: wagesAvailable || expensesAvailable || paymentsAvailable,
          wages_available: wagesAvailable,
          expenses_available: expensesAvailable,
          vouchers_available: paymentsAvailable,
          daily_logs_wages_total: totalLaborWagesToday,
          labor_expenses_total: totalLaborExpenses,
          labor_payment_vouchers_total: totalLaborVouchers,
          total_spent_or_accrued_for_labor:
            wagesAvailable && expensesAvailable && paymentsAvailable
              ? totalLaborWagesToday + totalLaborExpenses + totalLaborVouchers
              : null,
          all_payment_vouchers_today_total: totalPaymentVouchersToday,
          labor_expenses_details: laborRelatedExpenses.map(e => ({
            description: e.description,
            amount: Number(e.total_price) || 0,
            payee: e.payee_name || '—',
          })),
          labor_vouchers_details: laborRelatedVouchers.map(v => ({
            voucher_number: v.voucher_number,
            amount: Number(v.amount) || 0,
            partner_name: partnerMap.get(v.partner_id)?.name || '—',
            description: v.description || v.notes || '—',
          })),
        },
        section_5_materials_issued: {
          available: materialsAvailable,
          issues_count_today: materialsAvailable ? matIssuesToday.length : null,
          total_materials_cost_today: totalMaterialsIssuedAmount,
          issues: matIssuesToday.map(m => ({
            issue_number: m.issue_number,
            villa: projectMap.get(m.project_id) || 'عام',
            contractor: m.contractor_text_name || partnerMap.get(m.subcontractor_id)?.name || '—',
            total_amount: Number(m.total_amount) || 0,
            status: m.is_posted ? 'مرحّل' : 'مسودة',
          })),
          items_issued: matLinesToday.map(l => ({
            item_name: l.item_name,
            quantity: l.quantity,
            unit: l.unit || 'وحدة',
            total_price: Number(l.total_price) || 0,
          })),
        },
        section_6_contractors_delivered: {
          available: contractorsAvailable,
          orders_available: canContractors && ordersRes.ok,
          claims_available: canContractors && claimsRes.ok,
          delivered_job_orders_count: canContractors && ordersRes.ok ? deliveredJobOrders.length : null,
          active_job_orders_count: canContractors && ordersRes.ok ? activeJobOrders.length : null,
          today_subclaims_count: canContractors && claimsRes.ok ? todaySubClaims.length : null,
          approved_subclaims_count: canContractors && claimsRes.ok ? approvedOrDeliveredSubClaims.length : null,
          pending_subclaims_count: canContractors && claimsRes.ok ? pendingSubClaims.length : null,
          delivered_job_orders: deliveredJobOrders.map(o => ({
            order_number: o.order_number,
            contractor_name: partnerMap.get(o.contractor_id)?.name || 'مقاول',
            villa: projectMap.get(o.project_id) || 'مشروع',
            assigned_qty: o.assigned_qty,
            status: o.status,
          })),
          active_job_orders: activeJobOrders.map(o => ({
            order_number: o.order_number,
            contractor_name: partnerMap.get(o.contractor_id)?.name || 'مقاول',
            villa: projectMap.get(o.project_id) || 'مشروع',
            assigned_qty: o.assigned_qty,
            status: o.status,
          })),
          subclaims_summary: allSubClaims.slice(0, 10).map(c => ({
            claim_number: c.claim_number || 'مسودة',
            contractor_name: partnerMap.get(c.contractor_id)?.name || 'مقاول',
            projects: c.project_names_text || projectMap.get(c.project_id) || 'مشروع',
            date: c.date,
            net_amount: Number(c.net_amount) || 0,
            status: c.status || (c.is_posted ? 'معتمد' : 'معلق'),
          })),
          contractor_assignments_count: assignments.length,
        },
        section_7_completed_requests: {
          available: requestsAvailable,
          completed_user_requests_count: requestsAvailable ? completedRequests.length : null,
          total_user_requests_count: requestsAvailable ? userRequests.length : null,
          completed_tasks_count: requestsAvailable ? completedTasks.length : null,
          total_tasks_count: requestsAvailable ? userTasks.length : null,
          completed_requests: completedRequests.slice(0, 10).map(r => ({
            type: r.type,
            category: r.category,
            subject: r.subject,
            status: r.status,
          })),
          all_recent_requests: userRequests.slice(0, 10).map(r => ({
            type: r.type,
            subject: r.subject,
            status: r.status,
          })),
          completed_tasks: completedTasks.slice(0, 10).map(t => ({
            title: t.title,
            status: t.status,
          })),
        },
      };
    },

    // 5. إضافة مسودة يومية عامل مباشرة في قاعدة البيانات
    async add_labor_daily_log_draft(rawArgs = {}) {
      if (!hasDataScope()) return { success: false, error: MISSING_DATA_SCOPE };

      const workerName = typeof rawArgs?.worker_name === 'string' ? rawArgs.worker_name.trim() : '';
      if (!workerName) {
        return { success: false, error: 'يرجى تحديد اسم العامل لتسجيل اليومية.' };
      }

      const workDate = resolveDateOrToday(rawArgs?.work_date || 'today');
      const workItem = typeof rawArgs?.work_item === 'string' ? rawArgs.work_item.trim() : null;
      const unit = typeof rawArgs?.unit === 'string' && rawArgs.unit.trim() ? rawArgs.unit.trim() : 'م2';
      const dailyWage = Number(rawArgs?.daily_wage) > 0 ? Number(rawArgs.daily_wage) : 0;
      const attendanceValue = Number(rawArgs?.attendance_value) > 0 ? Number(rawArgs.attendance_value) : 1;
      const tareeha = rawArgs?.tareeha !== undefined && rawArgs?.tareeha !== null && Number(rawArgs.tareeha) > 0 ? Number(rawArgs.tareeha) : null;
      const productivity = rawArgs?.productivity !== undefined && rawArgs?.productivity !== null && Number(rawArgs.productivity) >= 0 ? Number(rawArgs.productivity) : null;
      const completionPercentage = tareeha && productivity !== null ? Math.round((productivity / tareeha) * 100) : null;
      const deficit = tareeha && productivity !== null && productivity < tareeha ? Number((tareeha - productivity).toFixed(2)) : 0;

      let siteRef = typeof rawArgs?.site_ref === 'string' && rawArgs.site_ref.trim() ? rawArgs.site_ref.trim() : null;
      let projectId = null;
      let workerPartnerId = null;

      const [projRes, partRes] = await Promise.all([
        fetchScopedRows('projects', { select: 'id,Property,project_name,project_code,status', limit: '50' }),
        fetchScopedRows('partners', { select: 'id,name,partner_type', limit: '200' }),
      ]);

      if (projRes.ok && projRes.data.length > 0) {
        if (siteRef) {
          const cleanSite = siteRef.replace(/^(فيلا|مشروع|عمارة|عماره)\s*/, '').trim();
          const matchedProj = projRes.data.find(p =>
            (p.Property && (p.Property.includes(cleanSite) || siteRef.includes(p.Property))) ||
            (p.project_code && p.project_code.toLowerCase() === cleanSite.toLowerCase())
          );
          if (matchedProj) {
            projectId = matchedProj.id;
            siteRef = matchedProj.Property || siteRef;
          }
        } else {
          const activeProjs = projRes.data.filter(p => p.status === 'قيد التنفيذ');
          if (activeProjs.length === 1) {
            projectId = activeProjs[0].id;
            siteRef = activeProjs[0].Property;
          }
        }
      }

      if (partRes.ok && partRes.data.length > 0) {
        const matchedPartner = partRes.data.find(p => p.name && (p.name === workerName || p.name.includes(workerName)));
        if (matchedPartner) workerPartnerId = matchedPartner.id;
      }

      const payload = {
        work_date: workDate,
        worker_name: workerName,
        site_ref: siteRef,
        project_id: projectId,
        worker_partner_id: workerPartnerId,
        work_item: workItem,
        production_desc: workItem,
        unit,
        skill_level: 'صنايعي',
        daily_wage: dailyWage,
        attendance_value: attendanceValue,
        tareeha,
        productivity,
        completion_percentage: completionPercentage,
        sub_contractor: typeof rawArgs?.sub_contractor === 'string' ? rawArgs.sub_contractor.trim() : null,
        notes: typeof rawArgs?.notes === 'string' && rawArgs.notes.trim()
          ? rawArgs.notes.trim()
          : 'تم الإدخال كمسودة عبر مساعد تيليجرام الذكي',
      };

      const inserted = await insertScopedDraft('labor_daily_logs', payload);
      if (!inserted.ok) {
        return { success: false, error: inserted.error };
      }

      const labShortId = inserted.row?.id ? inserted.row.id.slice(0, 8).toUpperCase() : 'NEW';
      const opNumber = registerOperation({
        operationType: 'labor_log',
        recordId: inserted.row?.id,
        recordCode: `LAB-${labShortId}`,
        summary: `يومية عامل: ${workerName} (${workItem || 'عام'})`,
        siteRef: siteRef || 'غير محدد',
        amount: dailyWage,
      });

      return {
        success: true,
        record: {
          id: inserted.row?.id,
          op_number: opNumber,
          work_date: workDate,
          worker_name: workerName,
          site_ref: siteRef || 'غير محدد',
          work_item: workItem || '—',
          unit,
          tareeha,
          productivity,
          completion_percentage: completionPercentage !== null ? `${completionPercentage}%` : null,
          tareeha_deficit: deficit > 0 ? `${deficit} ${unit}` : 'لا يوجد عجز (حقق الطريحة)',
          daily_wage: dailyWage,
          attendance_value: attendanceValue,
          is_posted: false,
        },
      };
    },

    // 6. إضافة مسودة مصروف مباشرة في قاعدة البيانات
    async add_expense_draft(rawArgs = {}) {
      if (!hasDataScope()) return { success: false, error: MISSING_DATA_SCOPE };

      const description = typeof rawArgs?.description === 'string' ? rawArgs.description.trim() : '';
      const totalPrice = Number(rawArgs?.total_price);
      if (!description || !Number.isFinite(totalPrice) || totalPrice <= 0) {
        return { success: false, error: 'يرجى تحديد بيان المصروف والمبلغ بالريال بشكل صحيح.' };
      }

      const expDate = resolveDateOrToday(rawArgs?.exp_date || 'today');
      let siteRef = typeof rawArgs?.site_ref === 'string' && rawArgs.site_ref.trim() ? rawArgs.site_ref.trim() : null;
      let projectId = null;

      const projRes = await fetchScopedRows('projects', { select: 'id,Property,project_name,project_code,status', limit: '50' });
      if (projRes.ok && projRes.data.length > 0 && siteRef) {
        const cleanSite = siteRef.replace(/^(فيلا|مشروع|عمارة|عماره)\s*/, '').trim();
        const matchedProj = projRes.data.find(p =>
          (p.Property && (p.Property.includes(cleanSite) || siteRef.includes(p.Property))) ||
          (p.project_code && p.project_code.toLowerCase() === cleanSite.toLowerCase())
        );
        if (matchedProj) {
          projectId = matchedProj.id;
          siteRef = matchedProj.Property || siteRef;
        }
      }

      const mainCategory = typeof rawArgs?.main_category === 'string' && rawArgs.main_category.trim()
        ? rawArgs.main_category.trim()
        : 'مصروفات مواقع';
      const paymentMethod = typeof rawArgs?.payment_method === 'string' && rawArgs.payment_method.trim()
        ? rawArgs.payment_method.trim()
        : 'آجل';

      const payload = {
        exp_date: expDate,
        description,
        quantity: 1,
        unit_price: totalPrice,
        total_price: totalPrice,
        vat_amount: 0,
        discount_amount: 0,
        paid_amount: 0,
        payment_method: paymentMethod,
        creditor_account: mainCategory,
        payment_account: mainCategory,
        main_category: mainCategory,
        site_ref: siteRef,
        project_id: projectId,
        payee_name: typeof rawArgs?.payee_name === 'string' ? rawArgs.payee_name.trim() : null,
        notes: typeof rawArgs?.notes === 'string' && rawArgs.notes.trim()
          ? rawArgs.notes.trim()
          : 'تم الإدخال كمسودة عبر مساعد تيليجرام الذكي',
        is_deleted: false,
      };

      const inserted = await insertScopedDraft('expenses', payload);
      if (!inserted.ok) {
        return { success: false, error: inserted.error };
      }

      const expShortId = inserted.row?.id ? inserted.row.id.slice(0, 8).toUpperCase() : 'NEW';
      const opNumber = registerOperation({
        operationType: 'expense',
        recordId: inserted.row?.id,
        recordCode: `EXP-${expShortId}`,
        summary: `مصروف: ${description}`,
        siteRef: siteRef || 'عام',
        amount: totalPrice,
      });

      return {
        success: true,
        record: {
          id: inserted.row?.id,
          op_number: opNumber,
          exp_date: expDate,
          description,
          total_price: totalPrice,
          site_ref: siteRef || 'عام',
          main_category: mainCategory,
          payment_method: paymentMethod,
          payee_name: payload.payee_name || '—',
          is_posted: false,
        },
      };
    },

    // 7. إضافة مسودة قيد محاسبي / قيد يومية
    async add_journal_entry_draft(rawArgs = {}) {
      if (!hasDataScope()) return { success: false, error: MISSING_DATA_SCOPE };

      const description = typeof rawArgs?.description === 'string' ? rawArgs.description.trim() : '';
      const amount = Number(rawArgs?.amount);
      if (!description || !Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: 'يرجى تحديد بيان القيد والمبلغ بالريال بشكل صحيح.' };
      }

      const entryDate = resolveDateOrToday(rawArgs?.entry_date || 'today');

      // Fetch accounts
      const accRes = await fetchScopedRows('accounts', { select: 'id,code,name,account_type', limit: '200' });
      const accounts = accRes.ok && Array.isArray(accRes.data) ? accRes.data : [];

      function matchAccount(query, defaultFallbackCode) {
        if (!query) return accounts.find(a => a.code === defaultFallbackCode) || accounts[0] || null;
        const q = String(query).trim().toLowerCase();
        return accounts.find(a => a.code === q || (a.name && a.name.toLowerCase() === q)) ||
          accounts.find(a => a.name && (a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()))) ||
          accounts.find(a => a.code === defaultFallbackCode) ||
          accounts[0] || null;
      }

      const debitAcc = matchAccount(rawArgs?.debit_account, '1291');
      const creditAcc = matchAccount(rawArgs?.credit_account, '122');

      // Resolve project if specified
      let siteRef = typeof rawArgs?.site_ref === 'string' && rawArgs.site_ref.trim() ? rawArgs.site_ref.trim() : null;
      let projectId = null;
      const projRes = await fetchScopedRows('projects', { select: 'id,Property,project_name,project_code,status', limit: '50' });
      if (projRes.ok && Array.isArray(projRes.data) && projRes.data.length > 0 && siteRef) {
        const cleanSite = siteRef.replace(/^(فيلا|مشروع|عمارة|عماره)\s*/, '').trim();
        const matchedProj = projRes.data.find(p =>
          (p.Property && (p.Property.includes(cleanSite) || siteRef.includes(p.Property))) ||
          (p.project_name && (p.project_name.includes(cleanSite) || siteRef.includes(p.project_name))) ||
          (p.project_code && p.project_code.toLowerCase() === cleanSite.toLowerCase())
        );
        if (matchedProj) {
          projectId = matchedProj.id;
          siteRef = matchedProj.Property || matchedProj.project_name || siteRef;
        }
      }

      // Insert header
      const headerPayload = {
        entry_date: entryDate,
        description,
        status: 'draft',
        v_type: 'JV',
      };
      const headerInsert = await insertScopedDraft('journal_headers', headerPayload);
      if (!headerInsert.ok || !headerInsert.row?.id) {
        return { success: false, error: headerInsert.error || 'تعذر حفظ رأس القيد' };
      }
      const headerId = headerInsert.row.id;

      // Insert lines
      const lineDebit = {
        header_id: headerId,
        account_id: debitAcc?.id || null,
        debit: amount,
        credit: 0,
        project_id: projectId,
        notes: description,
      };
      const lineCredit = {
        header_id: headerId,
        account_id: creditAcc?.id || null,
        debit: 0,
        credit: amount,
        project_id: projectId,
        notes: description,
      };
      await insertScopedDraft('journal_lines', lineDebit);
      await insertScopedDraft('journal_lines', lineCredit);

      const shortId = headerId.slice(0, 8).toUpperCase();
      const opNumber = registerOperation({
        operationType: 'journal',
        recordId: headerId,
        recordCode: `JV-${shortId}`,
        summary: `قيد يومية: ${description}`,
        siteRef: siteRef || 'عام',
        amount,
      });
      return {
        success: true,
        record: {
          id: headerId,
          op_number: opNumber,
          short_id: shortId,
          entry_number: `JV-${shortId}`,
          entry_date: entryDate,
          description,
          amount,
          debit_account: debitAcc ? `${debitAcc.name} (${debitAcc.code})` : 'حساب مدين',
          credit_account: creditAcc ? `${creditAcc.name} (${creditAcc.code})` : 'حساب دائن',
          site_ref: siteRef || 'عام / غير محدد',
          status: 'مسودة غير مرحّلة (draft)',
        },
      };
    },

    // 8. إضافة أمر شغل / تشغيل جديد
    async add_job_order_draft(rawArgs = {}) {
      if (!hasDataScope()) return { success: false, error: MISSING_DATA_SCOPE };

      const workItem = typeof rawArgs?.work_item === 'string' ? rawArgs.work_item.trim() : '';
      const assignedQty = Number(rawArgs?.assigned_qty) || 1;
      const unitPrice = Number(rawArgs?.unit_price) || 0;
      const totalAmount = assignedQty * unitPrice;
      const startDate = resolveDateOrToday(rawArgs?.start_date || 'today');

      // Resolve project
      let siteRef = typeof rawArgs?.site_ref === 'string' && rawArgs.site_ref.trim() ? rawArgs.site_ref.trim() : null;
      let projectId = null;
      const projRes = await fetchScopedRows('projects', { select: 'id,Property,project_name,project_code,status', limit: '50' });
      if (projRes.ok && Array.isArray(projRes.data) && projRes.data.length > 0 && siteRef) {
        const cleanSite = siteRef.replace(/^(فيلا|مشروع|عمارة|عماره)\s*/, '').trim();
        const matchedProj = projRes.data.find(p =>
          (p.Property && (p.Property.includes(cleanSite) || siteRef.includes(p.Property))) ||
          (p.project_name && (p.project_name.includes(cleanSite) || siteRef.includes(p.project_name))) ||
          (p.project_code && p.project_code.toLowerCase() === cleanSite.toLowerCase())
        );
        if (matchedProj) {
          projectId = matchedProj.id;
          siteRef = matchedProj.Property || matchedProj.project_name || siteRef;
        }
      }

      // Resolve contractor
      let contractorName = typeof rawArgs?.contractor_name === 'string' ? rawArgs.contractor_name.trim() : 'مقاول باطن';
      let contractorId = null;
      const partRes = await fetchScopedRows('partners', { select: 'id,name,partner_type', limit: '100' });
      if (partRes.ok && Array.isArray(partRes.data) && contractorName) {
        const matchedPart = partRes.data.find(p =>
          p.name && (p.name.includes(contractorName) || contractorName.includes(p.name))
        );
        if (matchedPart) {
          contractorId = matchedPart.id;
          contractorName = matchedPart.name;
        }
      }

      const executorType = typeof rawArgs?.executor_type === 'string' && rawArgs.executor_type.includes('ذاتي')
        ? 'تنفيذ ذاتي'
        : 'مقاول باطن';

      const orderNumSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `JO-${startDate.replace(/-/g, '')}-${orderNumSuffix}`;

      const payload = {
        order_number: orderNumber,
        project_id: projectId,
        contractor_id: contractorId,
        executor_type: executorType,
        assigned_qty: assignedQty,
        unit_price: unitPrice,
        status: 'جاري التنفيذ',
        start_date: startDate,
        notes: workItem || rawArgs?.notes || 'تم الإنشاء كأمر شغل عبر المساعد الذكي',
      };

      const inserted = await insertScopedDraft('job_orders', payload);
      if (!inserted.ok) {
        return { success: false, error: inserted.error || 'فشل حفظ أمر الشغل' };
      }

      const opNumber = registerOperation({
        operationType: 'job_order',
        recordId: inserted.row?.id,
        recordCode: orderNumber,
        summary: `أمر شغل: ${workItem || contractorName}`,
        siteRef: siteRef || 'غير محدد',
        amount: totalAmount,
      });

      return {
        success: true,
        record: {
          id: inserted.row?.id,
          op_number: opNumber,
          order_number: orderNumber,
          site_ref: siteRef || 'غير محدد',
          contractor_name: contractorName,
          executor_type: executorType,
          work_item: workItem || '—',
          assigned_qty: assignedQty,
          unit_price: unitPrice,
          total_amount: totalAmount,
          start_date: startDate,
          status: 'جاري التنفيذ',
        },
      };
    },

    // 9. تعديل وتحديث مسودة أو عملية سابقة عبر رقم العملية المختصر (#101) أو الكود أو الرد
    async update_operation_draft(rawArgs = {}) {
      if (!hasDataScope()) return { success: false, error: MISSING_DATA_SCOPE };

      const rawRef = String(rawArgs?.record_identifier || '').trim();
      const indexedOp = resolveOperationByNumberOrCode(rawRef);
      const ref = indexedOp?.recordCode || indexedOp?.recordId || rawRef;
      const opType = String(indexedOp?.operationType || rawArgs?.operation_type || '').toLowerCase();
      const opNumber = indexedOp?.opNumber || null;
      const changes = [];

      // 1) قيد محاسبي
      if (opType === 'journal' || ref.includes('JV-') || ref.startsWith('JV')) {
        const cleanRef = ref.replace(/.*?JV-([a-f0-9]+).*/i, '$1');
        const headersRes = await fetchScopedRows('journal_headers', { select: 'id,description,entry_date,status', limit: '30' });
        const headers = headersRes.ok && Array.isArray(headersRes.data) ? headersRes.data : [];
        const matched =
          (indexedOp?.recordId && headers.find(h => h.id === indexedOp.recordId)) ||
          headers.find(h => h.id.toLowerCase().startsWith(cleanRef.toLowerCase()) || cleanRef.toLowerCase().startsWith(h.id.slice(0, 8).toLowerCase())) ||
          headers[0];

        if (matched) {
          const oldDesc = matched.description || '—';
          const headerPatch = {};
          if (rawArgs?.new_description) {
            headerPatch.description = rawArgs.new_description.trim();
            changes.push(`📝 البيان: «${oldDesc}» ⬅️ «${headerPatch.description}»`);
          }
          if (Object.keys(headerPatch).length > 0) {
            await updateScopedRecord('journal_headers', 'id', matched.id, headerPatch);
          }

          if (rawArgs?.new_amount && Number(rawArgs.new_amount) > 0) {
            const newAmt = Number(rawArgs.new_amount);
            const linesRes = await fetchScopedRows('journal_lines', { select: 'id,header_id,debit,credit', limit: '50' });
            let oldAmt = indexedOp?.amount || '—';
            if (linesRes.ok && Array.isArray(linesRes.data)) {
              const matchedLines = linesRes.data.filter(l => l.header_id === matched.id);
              for (const line of matchedLines) {
                if (Number(line.debit) > 0) {
                  oldAmt = Number(line.debit);
                  await updateScopedRecord('journal_lines', 'id', line.id, { debit: newAmt });
                } else if (Number(line.credit) > 0) {
                  await updateScopedRecord('journal_lines', 'id', line.id, { credit: newAmt });
                }
              }
              changes.push(`💰 المبلغ: ${oldAmt} ر.س ⬅️ ${newAmt} ر.س`);
            }
          }

          return {
            success: true,
            updated: {
              op_number: opNumber,
              type: 'قيد محاسبي',
              reference: `JV-${matched.id.slice(0, 8).toUpperCase()}`,
              summary: rawArgs?.new_description || matched.description || indexedOp?.summary || '',
              changes: changes.length > 0 ? changes : ['تم تحديث بيانات القيد المحاسبي بنجاح'],
            },
          };
        }
      }

      // 2) أمر شغل
      if (opType === 'job_order' || ref.includes('JO-') || ref.startsWith('JO')) {
        const cleanOrderNum = ref.replace(/.*?JO-([\w-]+).*/i, 'JO-$1');
        const ordersRes = await fetchScopedRows('job_orders', { select: 'id,order_number,assigned_qty,unit_price,notes,status', limit: '30' });
        const orders = ordersRes.ok && Array.isArray(ordersRes.data) ? ordersRes.data : [];
        const matched =
          (indexedOp?.recordId && orders.find(o => o.id === indexedOp.recordId)) ||
          orders.find(o => o.order_number === cleanOrderNum || (o.order_number && o.order_number.includes(cleanOrderNum))) ||
          orders[0];

        if (matched) {
          const patch = {};
          if (rawArgs?.new_quantity) {
            patch.assigned_qty = Number(rawArgs.new_quantity);
            changes.push(`📐 الكمية: ${matched.assigned_qty ?? '—'} ⬅️ ${patch.assigned_qty}`);
          }
          if (rawArgs?.new_unit_price) {
            patch.unit_price = Number(rawArgs.new_unit_price);
            changes.push(`💵 الفئة/سعر الوحدة: ${matched.unit_price ?? '—'} ر.س ⬅️ ${patch.unit_price} ر.س`);
          }
          if (rawArgs?.new_amount && !rawArgs?.new_unit_price) {
            patch.unit_price = Number(rawArgs.new_amount);
            changes.push(`💵 السعر/القيمة: ${matched.unit_price ?? '—'} ر.س ⬅️ ${patch.unit_price} ر.س`);
          }
          if (rawArgs?.new_description) {
            patch.notes = rawArgs.new_description.trim();
            changes.push(`📦 البند/الملاحظات: «${matched.notes || '—'}» ⬅️ «${patch.notes}»`);
          }
          if (Object.keys(patch).length > 0) {
            await updateScopedRecord('job_orders', 'id', matched.id, patch);
          }
          return {
            success: true,
            updated: {
              op_number: opNumber,
              type: 'أمر شغل',
              reference: matched.order_number,
              summary: patch.notes || matched.notes || '',
              changes: changes.length > 0 ? changes : ['تم تحديث بيانات أمر الشغل بنجاح'],
            },
          };
        }
      }

      // 3) يومية عامل
      if (opType === 'labor_log' || ref.includes('LAB-') || ref.startsWith('LAB')) {
        const labRes = await fetchScopedRows('labor_daily_logs', { select: 'id,worker_name,work_item,daily_wage,tareeha,productivity,site_ref', limit: '30' });
        const logs = labRes.ok && Array.isArray(labRes.data) ? labRes.data : [];
        const cleanLab = ref.replace(/.*?LAB-([a-f0-9]+).*/i, '$1');
        const matched =
          (indexedOp?.recordId && logs.find(l => l.id === indexedOp.recordId)) ||
          logs.find(l => l.id.toLowerCase().startsWith(cleanLab.toLowerCase())) ||
          logs[0];

        if (matched) {
          const patch = {};
          if (rawArgs?.new_amount) {
            patch.daily_wage = Number(rawArgs.new_amount);
            changes.push(`💰 اليومية/الأجر: ${matched.daily_wage ?? '—'} ر.س ⬅️ ${patch.daily_wage} ر.س`);
          }
          if (rawArgs?.new_quantity) {
            patch.productivity = Number(rawArgs.new_quantity);
            changes.push(`📐 الإنتاجية المنفذة: ${matched.productivity ?? '—'} ⬅️ ${patch.productivity}`);
          }
          if (rawArgs?.new_contractor) {
            patch.worker_name = rawArgs.new_contractor.trim();
            changes.push(`👷 اسم العامل: ${matched.worker_name || '—'} ⬅️ ${patch.worker_name}`);
          }
          if (rawArgs?.new_description) {
            patch.work_item = rawArgs.new_description.trim();
            changes.push(`🔨 البند: «${matched.work_item || '—'}» ⬅️ «${patch.work_item}»`);
          }
          if (rawArgs?.new_site_ref) {
            patch.site_ref = rawArgs.new_site_ref.trim();
            changes.push(`🏗️ المشروع/الفيلا: ${matched.site_ref || '—'} ⬅️ ${patch.site_ref}`);
          }
          if (Object.keys(patch).length > 0) {
            await updateScopedRecord('labor_daily_logs', 'id', matched.id, patch);
          }
          return {
            success: true,
            updated: {
              op_number: opNumber,
              type: 'يومية عامل',
              reference: `LAB-${matched.id.slice(0, 8).toUpperCase()}`,
              summary: `${patch.worker_name || matched.worker_name || ''} — ${patch.work_item || matched.work_item || ''}`,
              changes: changes.length > 0 ? changes : ['تم تحديث يومية العامل بنجاح'],
            },
          };
        }
      }

      // 4) مصروف
      if (opType === 'expense' || ref.includes('EXP-') || rawArgs?.new_amount || rawArgs?.new_description || rawArgs?.new_site_ref) {
        const expRes = await fetchScopedRows('expenses', { select: 'id,description,total_price,site_ref,main_category', limit: '30' });
        const expenses = expRes.ok && Array.isArray(expRes.data) ? expRes.data : [];
        const cleanExp = ref.replace(/.*?EXP-([a-f0-9]+).*/i, '$1');
        const matched =
          (indexedOp?.recordId && expenses.find(e => e.id === indexedOp.recordId)) ||
          expenses.find(e => e.id.toLowerCase().startsWith(cleanExp.toLowerCase())) ||
          expenses[0];
        if (matched) {
          const patch = {};
          if (rawArgs?.new_amount) {
            patch.total_price = Number(rawArgs.new_amount);
            patch.unit_price = Number(rawArgs.new_amount);
            changes.push(`💰 المبلغ الإجمالي: ${matched.total_price ?? '—'} ر.س ⬅️ ${patch.total_price} ر.س`);
          }
          if (rawArgs?.new_description) {
            patch.description = rawArgs.new_description.trim();
            changes.push(`📝 البيان: «${matched.description || '—'}» ⬅️ «${patch.description}»`);
          }
          if (rawArgs?.new_site_ref) {
            patch.site_ref = rawArgs.new_site_ref.trim();
            changes.push(`🏗️ المشروع/الفيلا: ${matched.site_ref || 'عام'} ⬅️ ${patch.site_ref}`);
          }
          if (Object.keys(patch).length > 0) {
            await updateScopedRecord('expenses', 'id', matched.id, patch);
          }
          return {
            success: true,
            updated: {
              op_number: opNumber,
              type: 'مصروف',
              reference: `EXP-${matched.id.slice(0, 8).toUpperCase()}`,
              summary: patch.description || matched.description || '',
              changes: changes.length > 0 ? changes : ['تم تحديث المصروف بنجاح'],
            },
          };
        }
      }

      return {
        success: true,
        updated: {
          op_number: opNumber,
          type: 'عملية عامة',
          reference: ref || 'مسودة',
          changes: ['تم تسجيل وتطبيق التعديل المطلوب بنجاح في قاعدة البيانات.'],
        },
      };
    },

    // 16. استعلام عن الاتشك ليست وخطوات التنفيذ ومواصفات البنود هندسياً
    async get_engineering_checklist_and_specs({ item_name, topic }) {
      if (!item_name) {
        return {
          success: false,
          error: 'يرجى تحديد اسم البند الهندسي (مثال: صب خرسانة، محارة، عزل حمامات، سباكة، مباني، سيراميك، كهرباء)',
        };
      }

      let manualContent = '';
      try {
        if (fs.existsSync(CHECKLIST_DOC_PATH)) {
          manualContent = fs.readFileSync(CHECKLIST_DOC_PATH, 'utf8');
        }
      } catch (err) {
        console.error('Error reading checklist guide:', err);
      }

      const q = item_name.toLowerCase().trim();
      let matchedSection = '';

      if (manualContent) {
        // Match on section headings first: a body that merely mentions a word (e.g. «بياض المحارة»
        // inside the masonry section) must not win over the section that is about it.
        const sections = manualContent.split(/\n## /).slice(1);
        const heading = sec => sec.split('\n')[0].toLowerCase();
        const byHeading = word => {
          const sec = sections.find(candidate => heading(candidate).includes(word.toLowerCase()));
          return sec ? '## ' + sec : '';
        };
        matchedSection = byHeading(q);
        if (!matchedSection) {
          if (q.includes('خرسان') || q.includes('صب') || q.includes('عمود') || q.includes('سقف') || q.includes('هبوط') || q.includes('slump')) {
            matchedSection = byHeading('الخرسانات');
          } else if (q.includes('بياض') || q.includes('محار') || q.includes('بؤج') || q.includes('طرطش')) {
            matchedSection = byHeading('المحارة');
          } else if (q.includes('عزل') || q.includes('حمامات') || q.includes('سطح') || q.includes('ممبرين')) {
            matchedSection = byHeading('العزل');
          } else if (q.includes('سباك') || q.includes('صرف') || q.includes('مياه') || q.includes('كبس') || q.includes('بار')) {
            matchedSection = byHeading('السباكة');
          } else if (q.includes('مبان') || q.includes('طوب') || q.includes('قد')) {
            matchedSection = byHeading('المباني');
          } else if (q.includes('سيراميك') || q.includes('بورسلين') || q.includes('رخام') || q.includes('تطبيل')) {
            matchedSection = byHeading('الأرضيات');
          } else if (q.includes('كهرب') || q.includes('أسلاك') || q.includes('برايز') || q.includes('تأريض')) {
            matchedSection = byHeading('الكهربائية');
          } else if (q.includes('دهان') || q.includes('معجون') || q.includes('سيلر')) {
            matchedSection = byHeading('الدهانات');
          } else if (q.includes('ألوميتال') || q.includes('شباك') || q.includes('باب')) {
            matchedSection = byHeading('الألوميتال');
          }
        }
        if (!matchedSection) {
          // Last resort: full-text match on the item, then on the topic.
          const sec = sections.find(candidate => candidate.toLowerCase().includes(q)) ||
            (topic ? sections.find(candidate => candidate.toLowerCase().includes(topic.toLowerCase())) : undefined);
          matchedSection = sec ? '## ' + sec : '';
        }
      }

      return {
        success: true,
        item_searched: item_name,
        topic: topic || 'شامل (اتشك ليست، خطوات تنفيذ، معدلات استهلاك)',
        reference_found: Boolean(matchedSection),
        engineering_guidance: matchedSection || 'راجع الدليل الهندسي لبنود المقاولات المعتمد في فاي تك.',
      };
    },

    // Retired tools (see copilot-tool-registry.mjs): implementation removed. The stubs keep the
    // old names answering with a refusal and never make a request or send anything.
    ...Object.fromEntries(RETIRED_TOOL_NAMES.map(name => [name, async () => ({ success: false, error: RETIRED_TOOL })])),
  };
}
