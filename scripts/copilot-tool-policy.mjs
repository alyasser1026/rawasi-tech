import { TOOL_STATUS, isToolFlagEnabled, registryEntry } from './copilot-tool-registry.mjs';

const CHECKLIST = 'get_engineering_checklist_and_specs';
const LABOR = 'get_labor_daily_logs';
const TAREEHA = 'get_tareeha_deficits';
const DAY_MS = 86_400_000;
const TOOLS_ENABLED = process.env.COPILOT_TOOLS_ENABLED !== 'false';

export function getCopilotDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = type => parts.find(value => value.type === type).value;
  return [part('year'), part('month'), part('day')].join('-');
}

/** Mirrors rawasi_private.can_access: permissions[module] is an action array or an {action: true} map. */
export function hasModulePermission(access, moduleName, action = 'view') {
  const actions = access?.permissions?.[moduleName];
  return Array.isArray(actions) ? actions.includes(action) : actions?.[action] === true;
}

/** Registry-driven gate: status, own flag, company scope and module permission (= the table's RLS module). */
function passesGates(entry, access) {
  if (!entry || !isToolFlagEnabled(entry)) return false;
  if (!entry.requiresCompany && !entry.permission) return true;
  if (!access?.companyId || !access.userId) return false;
  const required = [...(entry.permission ? [entry.permission] : []), ...(entry.requiredPermissions ?? [])];
  return required.every(({ module, action }) => hasModulePermission(access, module, action));
}

function isEnabled(name, access) {
  if (!TOOLS_ENABLED) return false;
  const entry = registryEntry(name);
  const declared = entry?.declaration && (entry.status === TOOL_STATUS.ACTIVE || entry.status === TOOL_STATUS.PILOT);
  return Boolean(declared) && passesGates(entry, access);
}

/** Same gate the model's tool calls go through — for flows outside the model. */
export function canUseCopilotTool(name, access) {
  return isEnabled(name, access);
}

/** Gate for internal (never declared) tools used by server-side flows such as /pdf. */
export function canUseInternalTool(name, access) {
  if (!TOOLS_ENABLED) return false;
  const entry = registryEntry(name);
  return entry?.status === TOOL_STATUS.INTERNAL && passesGates(entry, access);
}

export function getEnabledCopilotDeclarations(declarations, access) {
  if (!TOOLS_ENABLED) return [];
  return declarations.filter(({ name }) => isEnabled(name, access));
}

function safeText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(text) ? text : null;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function getToolArgs(name, supplied, now) {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) return null;
  if (name === CHECKLIST) {
    if (Object.keys(supplied).some(key => !['item_name', 'topic'].includes(key))) return null;
    const item = safeText(supplied.item_name, 120);
    const topic = supplied.topic === undefined ? null : safeText(supplied.topic, 120);
    return item && (topic || supplied.topic === undefined) ? { item_name: item, ...(topic && { topic }) } : null;
  }

  if (name === TAREEHA) {
    // لا تقبل أي args من المستخدم — company_id في الـ closure
    if (Object.keys(supplied).length !== 0) return null;
    return {};
  }

  if (name !== LABOR) return null;
  if (Object.keys(supplied).some(key => !['date', 'start_date', 'end_date', 'worker_name'].includes(key))) return null;
  const { date, start_date: start, end_date: end, worker_name: worker } = supplied;
  const workerName = worker === undefined ? null : safeText(worker, 80);
  if (worker !== undefined && (!workerName || !/^[\p{L}\p{M}\p{N} .'\u2019-]+$/u.test(workerName))) return null;
  const workerFilter = workerName ? { worker_name: workerName } : {};

  if (date !== undefined) {
    if (start !== undefined || end !== undefined) return null;
    if (['today', 'اليوم', 'النهاردة', 'النهارده'].includes(date)) {
      return { date: getCopilotDate(now), ...workerFilter };
    }
    return validDate(date) ? { date, ...workerFilter } : null;
  }

  const first = validDate(start);
  const last = validDate(end);
  if (!first || !last || last < first || last - first >= 31 * DAY_MS) return null;
  return { start_date: start, end_date: end, ...workerFilter };
}

export async function runEnabledCopilotTool(call, tools, access, now = new Date()) {
  if (!TOOLS_ENABLED) return 'الأدوات المتقدمة معطّلة حالياً. افتح فاي تك مباشرةً.';
  const name = call?.name;
  if (!isEnabled(name, access) || !Object.hasOwn(tools, name) || typeof tools[name] !== 'function') {
    return 'العملية دي مش متاحة من البوت بالإعدادات والصلاحيات الحالية. افتح الشاشة المختصة في فاي تك.';
  }
  const args = getToolArgs(name, call.args, now);
  if (!args) {
    if (name === LABOR) return 'حدّد تاريخ اليومية، أو تاريخ بداية ونهاية لفترة لا تتجاوز 31 يومًا. ولو عايز عامل معيّن، اذكر اسمه.';
    if (name === TAREEHA) return 'جرّب تاني — الطلب ده ما بياخدش معطيات إضافية.';
    return 'اذكر اسم البند الهندسي ونوع الفحص المطلوب.';
  }

  let result;
  try {
    result = await tools[name](args);
  } catch {
    return 'مصدر الاستعلام غير متاح حاليًا. جرّب من شاشة فاي تك وتحقق من الصلاحية والاتصال.';
  }
  if (result?.success !== true) {
    return 'ما قدرتش أكمّل الاستعلام. راجع صلاحية المصدر وتوافره في فاي تك.';
  }
  if (name === CHECKLIST) {
    const guidance = result.engineering_guidance;
    if (!result.reference_found || typeof guidance !== 'string' || !guidance.trim() || guidance.trim() === '## undefined') {
      return 'مالقيتش مرجع فحص مطابق للبند. اكتب اسم البند بدقة أو راجع مواصفة المشروع المعتمدة.';
    }
    return 'إرشاد من دليل فاي تك. معايير الاستلام الملزمة تتحدد من مواصفة مشروعك المعتمدة.\n\n' +
      guidance.slice(0, 1450);
  }

  if (name === TAREEHA) {
    const companyLabel = safeText(access.companyName, 100) || access.companyId;
    const period = validDate(result.start_date) && validDate(result.end_date)
      ? result.start_date + ' إلى ' + result.end_date : 'آخر 30 يوم';
    const heading = 'عجوزات الطريحة المستحقة\nالشركة: ' + companyLabel + '\nالفترة: ' + period;
    const count = result.count;
    if (!Number.isSafeInteger(count) || count < 0) return heading + '\nالمصدر ما رجّعش بيانات صالحة.';
    const partialNote = result.partial === true ? '\nالنتيجة جزئية (سجلات كتير في الفترة) — العدد ده أقل حد، راجع شاشة اليوميات للعدد الكامل.' : '';
    if (count === 0) {
      const unrecordedOnly = Number.isSafeInteger(result.no_productivity) && result.no_productivity > 0
        ? '\nسجلات فيها طريحة من غير إنتاجية مسجلة (مش محسوبة): ' + result.no_productivity : '';
      return heading + '\nلا توجد عجوزات مستحقة حالياً.' + partialNote + unrecordedOnly;
    }
    const lines = Array.isArray(result.deficits) && result.deficits.length > 0
      ? '\n\nأبرز العجوزات:\n' + result.deficits.slice(0, 5).map(d => {
          const num = value => (Number.isFinite(Number(value)) ? Number(value) : '—');
          const unit = safeText(d.unit, 20) || '';
          return `• ${validDate(d.work_date) ? d.work_date : '—'} — ${safeText(d.worker_name, 60) || '—'} — ${safeText(d.site_ref, 60) || 'غير محدد'} — ${safeText(d.work_item, 60) || '—'} (المستهدف: ${num(d.expected)} / المنفذ: ${num(d.productivity)} ${unit} — إنجاز ${num(d.achievement)}%)`;
        }).join('\n')
      : '';
    const unrecorded = Number.isSafeInteger(result.no_productivity) && result.no_productivity > 0
      ? '\nسجلات فيها طريحة من غير إنتاجية مسجلة (مش محسوبة): ' + result.no_productivity : '';
    return heading + '\nإجمالي العجوزات: ' + count + partialNote + unrecorded +
      '\nالتعريف: الإنتاجية أقل من الطريحة × الحضور.' + lines;
  }

  const period = args.date || (args.start_date + ' إلى ' + args.end_date);
  const companyLabel = safeText(access.companyName, 100) || access.companyId;
  const heading = 'يوميات العمالة المحفوظة على الخادم\nالشركة: ' + companyLabel + '\nالفترة: ' + period;
  if (result.partial === true) return heading + '\nالنتيجة جزئية، لذلك مش ممكن أعرض إجماليًا موثوقًا. جرّب فترة أقصر أو راجع شاشة اليوميات.';
  if (!Number.isSafeInteger(result.count_records) || result.count_records < 0) {
    return heading + '\nالمصدر ما رجّعش عدد سجلات صالح.';
  }
  if (result.count_records === 0) return heading + '\nلا توجد سجلات يوميات مطابقة للبحث.';

  const logLines = Array.isArray(result.logs) && result.logs.length > 0
    ? '\n\nآخر السجلات:\n' + result.logs.slice(0, 5).map(l =>
        `• ${l.work_date} — ${safeText(l.worker_name, 60) || '—'} — ${safeText(l.site_ref, 60) || 'غير محدد'} — ${safeText(l.work_item, 60) || 'غير محدد'} (حضور: ${l.attendance_value ?? '—'})`
      ).join('\n')
    : '';

  return heading + '\nعدد سجلات اليوميات المطابقة: ' + result.count_records + logLines;
}
