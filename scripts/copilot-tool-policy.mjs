const CHECKLIST = 'get_engineering_checklist_and_specs';
const LABOR = 'get_labor_daily_logs';
const DAY_MS = 86_400_000;

export function getCopilotDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = type => parts.find(value => value.type === type).value;
  return [part('year'), part('month'), part('day')].join('-');
}

function canViewModule(access, moduleName) {
  const actions = access?.permissions?.[moduleName];
  return Array.isArray(actions) ? actions.includes('view') : actions?.view === true;
}

function isEnabled(name, access) {
  return name === CHECKLIST || (name === LABOR && !!access?.companyId && !!access.userId && canViewModule(access, 'labor_logs'));
}

export function getEnabledCopilotDeclarations(declarations, access) {
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
  const name = call?.name;
  if (!isEnabled(name, access) || !Object.hasOwn(tools, name) || typeof tools[name] !== 'function') {
    return 'العملية دي مش متاحة من البوت بالإعدادات والصلاحيات الحالية. افتح الشاشة المختصة في فاي تك.';
  }
  const args = getToolArgs(name, call.args, now);
  if (!args) {
    return name === LABOR
      ? 'حدّد تاريخ اليومية، أو تاريخ بداية ونهاية لفترة لا تتجاوز 31 يومًا. ولو عايز عامل معيّن، اذكر اسمه.'
      : 'اذكر اسم البند الهندسي ونوع الفحص المطلوب.';
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

  const period = args.date || (args.start_date + ' إلى ' + args.end_date);
  const companyLabel = safeText(access.companyName, 100) || access.companyId;
  const heading = 'يوميات العمالة المحفوظة على الخادم\nالشركة: ' + companyLabel + '\nالفترة: ' + period;
  if (result.partial === true) return heading + '\nالنتيجة جزئية، لذلك مش ممكن أعرض إجماليًا موثوقًا. جرّب فترة أقصر أو راجع شاشة اليوميات.';
  if (!Number.isSafeInteger(result.count_records) || result.count_records < 0) {
    return heading + '\nالمصدر ما رجّعش عدد سجلات صالح.';
  }
  if (result.count_records === 0) return heading + '\nلا توجد سجلات يوميات مطابقة للبحث.';
  return heading + '\nعدد سجلات اليوميات المطابقة: ' + result.count_records;
}
