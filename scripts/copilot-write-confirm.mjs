// ✅ تأكيد عمليات الكتابة بخطوتين: البوت يعرض ملخص بالقيم اللي هتتنفذ بالظبط، ومفيش كتابة في
// قاعدة البيانات غير بعد ضغط «تأكيد» من نفس المستخدم في نفس المحادثة ونفس الشركة.
// التأكيد مرة واحدة بس، وبيسقط بعد مدة، وأي اقتراح جديد من نفس المستخدم بيلغي القديم.
import { randomBytes } from 'crypto';

export const WRITE_TOOL_NAMES = Object.freeze(new Set([
  'add_labor_daily_log_draft',
  'add_expense_draft',
  'add_payment_voucher_draft',
  'add_journal_entry_draft',
  'add_job_order_draft',
  'add_partner',
  'update_operation_draft',
]));

export const DEFAULT_CONFIRM_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING = 200;

export const isWriteCall = (call) => Boolean(call && WRITE_TOOL_NAMES.has(call.name));

const TOOL_TITLES = Object.freeze({
  add_labor_daily_log_draft: '👷 يومية عامل',
  add_expense_draft: '💸 مصروف',
  add_payment_voucher_draft: '🧾 سند صرف',
  add_journal_entry_draft: '📒 قيد يومية',
  add_job_order_draft: '📋 أمر شغل',
  add_partner: '🤝 شريك جديد',
  update_operation_draft: '✏️ تعديل عملية',
});

// الترتيب هنا = ترتيب العرض. أي حقل مش هنا بيظهر في الآخر باسمه.
const FIELD_LABELS = Object.freeze({
  record_identifier: 'العملية',
  worker_name: 'العامل', helper_name: 'المساعد', name: 'الاسم', job_role: 'المهنة', partner_type: 'النوع',
  contractor_name: 'المقاول', sub_contractor: 'مقاول الباطن', payee_name: 'المستفيد', executor_type: 'نوع التنفيذ',
  site_ref: 'الفيلا / المشروع', job_order: 'أمر الشغل', job_order_id: 'معرّف أمر الشغل',
  work_item: 'البند', description: 'البيان', main_category: 'التصنيف',
  work_date: 'التاريخ', exp_date: 'التاريخ', entry_date: 'التاريخ', date: 'التاريخ', start_date: 'تاريخ البدء',
  attendance_value: 'الحضور', skill_level: 'المستوى', tareeha: 'الطريحة', productivity: 'الإنتاجية', unit: 'الوحدة',
  quantity: 'الكمية', assigned_qty: 'الكمية', unit_price: 'سعر الوحدة',
  daily_wage: 'اليومية', helper_wage: 'يومية المساعد', amount: 'المبلغ', total_price: 'الإجمالي', vat_amount: 'الضريبة',
  payment_method: 'طريقة الدفع', debit_account: 'الحساب المدين', credit_account: 'الحساب الدائن',
  creditor_account: 'حساب المدين', payment_account: 'حساب الدائن', reference_no: 'رقم المرجع',
  phone: 'الجوال', identity_number: 'رقم الهوية', vat_number: 'الرقم الضريبي', code: 'الكود', address: 'العنوان',
  new_description: 'البيان الجديد', new_amount: 'المبلغ الجديد', new_quantity: 'الكمية الجديدة',
  new_unit_price: 'سعر الوحدة الجديد', new_site_ref: 'الفيلا الجديدة', new_contractor: 'المقاول الجديد',
  new_account: 'الحساب الجديد', new_notes: 'ملاحظات جديدة',
  is_paid: 'مدفوع', paid_amount: 'المدفوع', discount_amount: 'الخصم',
  notes: 'ملاحظات',
});
const LABEL_ORDER = Object.keys(FIELD_LABELS);

function formatValue(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 200);
  return String(v).replace(/\s+/g, ' ').trim().slice(0, 200);
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

// نسخة مجمّدة من الطلب: ده بالظبط اللي اتعرض وده بالظبط اللي هيتنفذ.
export function freezeCalls(calls) {
  return deepFreeze(calls.map(c => ({ name: String(c.name), args: structuredClone(c.args ?? {}) })));
}

export function formatCallSummary(call, index = null) {
  const args = call.args && typeof call.args === 'object' ? call.args : {};
  const keys = Object.keys(args)
    .filter(k => formatValue(args[k]) !== '')
    .sort((a, b) => {
      const ia = LABEL_ORDER.indexOf(a); const ib = LABEL_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  const head = `${index != null ? `${index}) ` : ''}${TOOL_TITLES[call.name] || call.name}`;
  const lines = keys.map(k => `   • ${FIELD_LABELS[k] || k}: ${formatValue(args[k])}`);
  return [head, ...(lines.length ? lines : ['   • (من غير تفاصيل إضافية)'])].join('\n');
}

export function formatConfirmationText(calls, { companyLabel = '', ttlMs = DEFAULT_CONFIRM_TTL_MS } = {}) {
  const many = calls.length > 1;
  return [
    `📝 مراجعة قبل التسجيل${companyLabel ? ` — ${companyLabel}` : ''}`,
    many ? `هيتسجل ${calls.length} عمليات كمسودات:` : 'هيتسجل كمسودة:',
    '────────────────────────────',
    ...calls.map((c, i) => formatCallSummary(c, many ? i + 1 : null)),
    '────────────────────────────',
    `اضغط «✅ تأكيد» للتسجيل أو «✖️ إلغاء». الطلب ده صالح ${Math.round(ttlMs / 60000)} دقايق.`,
    'لو فيه حاجة غلط، ابعت التعديل في رسالة جديدة وهيظهرلك ملخص جديد بدل ده.',
  ].join('\n');
}

export function buildConfirmMarkup(id) {
  return {
    inline_keyboard: [[
      { text: '✅ تأكيد', callback_data: `cfm:y:${id}` },
      { text: '✖️ إلغاء', callback_data: `cfm:n:${id}` },
    ]],
  };
}

export function resolveConfirmCallback(data) {
  const m = /^cfm:(y|n):([0-9a-f]{16})$/.exec(String(data || ''));
  return m ? { action: m[1] === 'y' ? 'confirm' : 'cancel', id: m[2] } : null;
}

const actorKey = (chatId, userId) => `${chatId}:${userId}`;

/**
 * مخزن الطلبات المعلقة (في الذاكرة — إعادة تشغيل البوت = كل الطلبات تسقط، وده الآمن).
 * take() بيشيل الطلب قبل التنفيذ، فالضغطة التانية ما تلاقيهوش.
 */
export function createPendingWrites({ ttlMs = DEFAULT_CONFIRM_TTL_MS, now = Date.now, newId = () => randomBytes(8).toString('hex') } = {}) {
  const pending = new Map(); // id -> entry
  const byActor = new Map(); // chat:user -> id
  const settled = new Map(); // id -> 'done' | 'cancelled' | 'superseded' (عشان رسالة أوضح للضغطة التانية)

  const remember = (id, status) => {
    settled.set(id, status);
    if (settled.size > MAX_PENDING) settled.delete(settled.keys().next().value);
  };
  const drop = (id, status) => {
    const e = pending.get(id);
    if (!e) return;
    pending.delete(id);
    if (byActor.get(actorKey(e.chatId, e.userId)) === id) byActor.delete(actorKey(e.chatId, e.userId));
    remember(id, status);
  };
  const purge = () => {
    const t = now();
    for (const [id, e] of pending) if (t - e.createdAt >= ttlMs) drop(id, 'expired');
  };

  function create({ chatId, userId, companyId, calls }) {
    if (!Number.isSafeInteger(chatId) || chatId === 0 || !Number.isSafeInteger(userId) || userId <= 0) {
      throw new TypeError('confirmation requires a chat and a real user');
    }
    if (typeof companyId !== 'string' || !companyId) throw new TypeError('confirmation requires a company');
    if (!Array.isArray(calls) || calls.length === 0 || !calls.every(isWriteCall)) throw new TypeError('only write calls need confirmation');
    purge();
    const prev = byActor.get(actorKey(chatId, userId));
    if (prev) drop(prev, 'superseded');
    let id = newId();
    while (pending.has(id) || settled.has(id)) id = newId();
    const entry = Object.freeze({ id, chatId, userId, companyId, calls: freezeCalls(calls), createdAt: now() });
    pending.set(id, entry);
    byActor.set(actorKey(chatId, userId), id);
    if (pending.size > MAX_PENDING) drop(pending.keys().next().value, 'expired');
    return entry;
  }

  // بيرجع { status: 'ok', entry } أو سبب الرفض. الرفض لمستخدم تاني ما بيستهلكش الطلب.
  function take({ id, chatId, userId }) {
    const e = pending.get(id);
    if (!e) return { status: settled.get(id) || 'not_found' };
    if (e.chatId !== chatId || e.userId !== userId) return { status: 'wrong_user' };
    if (now() - e.createdAt >= ttlMs) { drop(id, 'expired'); return { status: 'expired' }; }
    drop(id, 'done');
    return { status: 'ok', entry: e };
  }

  function cancel({ id, chatId, userId }) {
    const e = pending.get(id);
    if (!e) return { status: settled.get(id) || 'not_found' };
    if (e.chatId !== chatId || e.userId !== userId) return { status: 'wrong_user' };
    drop(id, 'cancelled');
    return { status: 'ok' };
  }

  return { create, take, cancel, size: () => (purge(), pending.size) };
}

export const CONFIRM_STATUS_MESSAGES = Object.freeze({
  done: 'الطلب ده اتنفذ قبل كده.',
  cancelled: 'الطلب ده اتلغى.',
  superseded: 'الطلب ده اتستبدل بملخص أحدث — استخدم آخر ملخص.',
  expired: 'الطلب ده انتهت صلاحيته. ابعت العملية تاني.',
  not_found: 'الطلب ده مش موجود (ممكن البوت اتعمله إعادة تشغيل). ابعت العملية تاني.',
  wrong_user: 'التأكيد ده لصاحب الطلب بس.',
  company_changed: 'الشركة النشطة اتغيّرت بعد الملخص. ابعت العملية تاني على الشركة الحالية.',
});
