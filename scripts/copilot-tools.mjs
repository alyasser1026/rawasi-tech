import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RETIRED_TOOL_NAMES } from './copilot-tool-registry.mjs';
import { getCopilotDate } from './copilot-tool-policy.mjs';
import { assessTareeha, unassessedReason } from './copilot-tareeha.mjs';

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

/**
 * Read-only Copilot tools. Every tool here is listed in copilot-tool-registry.mjs; company_id always
 * comes from this closure, and Supabase applies RLS for the user's access token.
 * (botToken is accepted for backward compatibility but unused: no tool talks to Telegram.)
 */
export function createCopilotTools({ supabaseUrl, supabaseKey, accessToken, companyId, fetchImpl = fetch } = {}) {
  const restBase = getRestBase(supabaseUrl);
  const hasDataScope = () => Boolean(restBase && typeof companyId === 'string' && UUID.test(companyId) &&
    isPublishableKey(supabaseKey) && isCurrentUserToken(accessToken));

  // Helper for REST queries
  async function fetchRest(endpoint, { exactCount = false } = {}) {
    if (!hasDataScope()) return { error: MISSING_DATA_SCOPE, data: null };
    try {
      const headers = { apikey: supabaseKey, Authorization: 'Bearer ' + accessToken, 'x-company-id': companyId };
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

  // Helper for allow-listed RPCs (same identity headers as fetchRest; RLS + x-company-id scope them).
  async function postRpc(name, body) {
    if (!hasDataScope()) return { error: MISSING_DATA_SCOPE, data: null };
    if (!RPC_ALLOWLIST.has(name)) return { error: SOURCE_UNAVAILABLE, data: null };
    try {
      const res = await fetchImpl(restBase + 'rpc/' + name, {
        method: 'POST',
        headers: {
          apikey: supabaseKey, Authorization: 'Bearer ' + accessToken, 'x-company-id': companyId,
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
    async get_labor_daily_logs({ date, start_date, end_date, worker_name } = {}) {
      const start = parseIsoDate(date ?? start_date);
      const end = parseIsoDate(date ?? end_date);
      if ((date != null && (start_date != null || end_date != null)) ||
        !Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start >= 31 * DAY_MS) {
        return { success: false, error: 'حدّد تاريخًا صحيحًا أو فترة لا تتجاوز 31 يومًا.' };
      }
      const query = new URLSearchParams({
        company_id: 'eq.' + companyId,
        select: 'work_date,worker_name,site_ref,work_item,attendance_value',
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
        query.append('worker_name', 'eq.' + worker_name.trim());
      }

      const { data, error, total } = await fetchRest('labor_daily_logs?' + query, { exactCount: true });
      if (error) return { success: false, error };

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
    },

    // 2. عجوزات الطريحة — التعريف في copilot-tareeha.mjs (الإنتاجية < الطريحة × الحضور).
    // Source: labor_daily_logs (RLS module labor_logs). No tareeha_deficits table exists.
    async get_tareeha_deficits() {
      const end = getCopilotDate();
      const start = new Date(Date.parse(end + 'T00:00:00Z') - (TAREEHA_WINDOW_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
      // company_id always comes from the closure — never from model/user args.
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
    // Identity = the partner record (stable id, exact name, same company). Rows = that partner's daily
    // logs up to the cut-off. Money = the payroll screen's own RPCs, so the totals match it exactly:
    //   earned (posted daily_wage) − violations (posted) − payment vouchers (posted) + previous balance.
    async get_worker_month_statement({ worker_name, month, cutoff_date, include_money = false } = {}) {
      const name = typeof worker_name === 'string' ? worker_name.trim() : '';
      const monthMatch = typeof month === 'string' ? month.match(/^(\d{4})-(0[1-9]|1[0-2])$/) : null;
      const first = monthMatch ? month + '-01' : '';
      if (!WORKER_NAME.test(name) || !monthMatch || !Number.isFinite(parseIsoDate(cutoff_date)) ||
        !String(cutoff_date).startsWith(month + '-') || cutoff_date < first) {
        return { success: false, error: 'حدّد اسم العامل وشهر صحيح.' };
      }

      // 1) Identity from partners (company from the closure).
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

      // 2) That partner's daily logs for the month up to the cut-off.
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

      // 3) Money exactly like the payroll screen (payroll_logic.ts): same RPCs, same formula.
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
