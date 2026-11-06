import { getCopilotDate } from './copilot-tool-policy.mjs';

const ENTRY_TTL_MS = 20 * 60 * 1000;
const APP_URL = 'https://rawasi-tech.vercel.app';
const BACK = '⬅️ رجوع';
const CANCEL = '✖️ إلغاء';
const SKIP = '⏭️ تخطّي';
const KEEP = '✓ كما هو';
const DONE = '✓ إنهاء المعاينة';
const TODAY = 'اليوم';
const NO_KEYBOARD = { remove_keyboard: true };

const date = { key: 'date', label: 'التاريخ', prompt: 'اكتب التاريخ بالصيغة YYYY-MM-DD أو اختار «اليوم».', type: 'date' };
const project = { key: 'project', label: 'المشروع', prompt: 'اكتب اسم المشروع، أو تخطّى لو العملية عامة.', optional: true };
const order = { key: 'order', label: 'أمر الشغل', prompt: 'اكتب رقم أمر الشغل للمشروع اللي اخترته.', dependsOn: 'project' };
const amount = { key: 'amount', label: 'المبلغ (ريال)', prompt: 'اكتب المبلغ بالريال، مثل 350 أو 350.50.', type: 'amount' };
const voucherMethod = { key: 'method', label: 'طريقة الدفع', prompt: 'اختار طريقة الدفع.', options: ['نقدي', 'تحويل بنكي', 'شيك'] };
const voucherNote = { key: 'description', label: 'البيان', prompt: 'اكتب بيان السند لو موجود.', optional: true };

const forms = {
  expense: {
    label: 'مصروف', path: '/expenses', button: 'إضافة مصروف جديد',
    fields: [date, project, order,
      { key: 'payee', label: 'المستفيد', prompt: 'اكتب اسم المستفيد لو موجود.', optional: true },
      { key: 'description', label: 'البيان', prompt: 'اكتب سبب المصروف، مثل نقل خامات للموقع.' },
      { ...amount, label: 'إجمالي المصروف حسب المستند (ريال)', prompt: 'اكتب الإجمالي النهائي من المستند، مثل 350 أو 350.50.' },
      { key: 'method', label: 'طريقة القيد', prompt: 'اختار طريقة القيد.', options: ['آجل', 'تسوية داخلية', 'عهدة'] },
    ],
    finish: 'في الشاشة اختار التصنيف وحساب المصروف. أدخل الكمية وسعر الوحدة والضريبة والخصم من المستند، واستخدم الإجمالي للمطابقة.',
  },
  receipt: {
    label: 'سند قبض', path: '/ReceiptVouchers', button: 'سند قبض جديد',
    fields: [date, { key: 'payer', label: 'الدافع', prompt: 'اكتب اسم العميل أو الطرف الدافع.' }, amount, voucherMethod,
      { key: 'invoice', label: 'رقم الفاتورة', prompt: 'لو التحصيل لفاتورة، اكتب رقمها. لو مفيش، اختار تخطّي.', optional: true },
      project, order, voucherNote,
    ],
    finish: 'في الشاشة اختار العميل والفاتورة والحسابات من بيانات الشركة، وراجع المبلغ قبل الحفظ.',
  },
  payment: {
    label: 'سند صرف', path: '/PaymentVouchers', button: 'سند صرف جديد',
    fields: [date, { key: 'payee', label: 'المستفيد', prompt: 'اكتب اسم المستفيد أو المستلم المباشر.' }, amount, voucherMethod,
      { key: 'reference', label: 'رقم المرجع', prompt: 'لو فيه رقم تحويل أو شيك، اكتبه. لو مفيش، اختار تخطّي.', optional: true },
      project, order, voucherNote,
    ],
    finish: 'في الشاشة اختار المستفيد من بيانات الشركة، وراجع الحسابات واحفظ السند كمسودة.',
  },
};

const normalize = value => value.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().trim();
const asciiDigits = value => value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 0x0f));

function keyboard(rows) {
  return { keyboard: rows, resize_keyboard: true, one_time_keyboard: true };
}

function formType(value) {
  return Object.keys(forms).find(key => value === key || value === normalize(forms[key].label) || value === normalize(forms[key].label + ' جديد'));
}

function startCommand(value) {
  const command = value.match(/^\/add(?:\s+(.*))?$/);
  if (command) return command[1] ?? '';
  return value.match(/^(?:اضافه|اضف|اضيف|ضيف|عاوز اضيف|عايز اضيف)\s+(عمليه|مستند|مصروف|سند قبض|سند صرف)$/)?.[1];
}

function readValue(field, input, now) {
  if (field.type === 'date') {
    const value = [TODAY, 'النهارده'].includes(input) ? getCopilotDate(new Date(now)) : asciiDigits(input).replace(/\//g, '-');
    if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  }
  if (field.type === 'amount') {
    const value = asciiDigits(input).replace('٫', '.');
    return /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0 ? Number(value).toFixed(2) : null;
  }
  if (field.options) {
    const value = normalize(input);
    if (field === voucherMethod && ['كاش', 'نقدي (كاش)'].includes(value)) return 'نقدي';
    return field.options.find(option => normalize(option) === value) ?? null;
  }
  const value = input.replace(/\s+/g, ' ').trim();
  return value && value.length <= 150 ? value : null;
}

function visibleFields(form, values) {
  return form.fields.filter(field => !field.dependsOn || values[field.dependsOn]);
}

function show(session, notice = '') {
  if (!session.type) {
    return { text: notice + 'اختار نوع العملية عشان تبدأ تجهيز المسودة.', replyMarkup: keyboard([
      Object.values(forms).map(form => form.label), [CANCEL],
    ]) };
  }

  const form = forms[session.type];
  const fields = visibleFields(form, session.values);
  const field = fields[session.index];
  if (!field) {
    const rows = fields.map(item => `• ${item.label}: ${session.values[item.key] ?? '—'}`);
    const paymentHint = session.type === 'expense' && session.values.method === 'عهدة'
      ? 'اختار العهدة المفتوحة المرتبطة بالمصروف.'
      : 'راجع الحساب الدائن في الشاشة.';
    return {
      text: [notice + `معاينة ${form.label} — جاهزة للمراجعة`, ...rows, '',
        `في فاي تك، اختار الشركة واضغط «${form.button}» لإدخال البيانات وحفظها.`, form.finish,
        ...(session.type === 'expense' ? [paymentHint] : []), APP_URL + form.path, '',
        'الحفظ من شاشة فاي تك. ارجع لتعديل البيانات أو اختار إنهاء المعاينة.'].join('\n'),
      replyMarkup: keyboard([[BACK, DONE], [CANCEL]]),
    };
  }

  const previous = session.values[field.key];
  const choices = field.options ?? (field.type === 'date' ? [TODAY] : []);
  const controls = [...(field.optional ? [SKIP] : []), ...(previous ? [KEEP] : []), BACK, CANCEL];
  const suffix = previous ? `\nالقيمة الحالية: ${previous}` : '';
  return {
    text: `${notice}${form.label} · خطوة ${session.index + 1} من ${fields.length}\n${field.label}\n${field.prompt}${suffix}`,
    replyMarkup: keyboard([...(choices.length ? [choices] : []), controls]),
  };
}

export function createCopilotEntryForms({ now = Date.now } = {}) {
  // The worker accepts one configured private chat, with the same chat and sender ID.
  let active = null;

  function clear({ chatId, userId }) {
    if (!active || active.chatId !== chatId || active.userId !== userId) return false;
    active = null;
    return true;
  }

  function handle({ chatId, userId }, input = '') {
    if (!Number.isSafeInteger(chatId) || chatId < 1 || chatId !== userId) return null;
    const text = input.trim();
    const value = normalize(text);
    const time = now();
    const session = active?.chatId === chatId && active.userId === userId ? active : null;
    const command = startCommand(value);
    const starting = command !== undefined;

    if (['/new', '/reset', '/help', '/start'].includes(value) || /^\/ask\s+\S/.test(value)) return null;
    if (text === CANCEL || value === '/cancel') {
      return { text: clear({ chatId, userId }) ? 'ألغيت معاينة العملية.' : 'مفيش معاينة مفتوحة. اكتب /add للبدء.', replyMarkup: NO_KEYBOARD };
    }
    if (session && time - session.updatedAt >= ENTRY_TTL_MS) {
      clear({ chatId, userId });
      if (!starting) return { text: 'انتهت مدة المعاينة. اكتب /add عشان تبدأ من جديد.', replyMarkup: NO_KEYBOARD };
    } else if (starting && session?.type) {
      return show(session, 'فيه معاينة مفتوحة. كمّلها أو اختار «إلغاء» قبل ما تبدأ واحدة جديدة.\n\n');
    }

    if (starting) {
      active = { chatId, userId, type: formType(command), index: 0, values: {}, updatedAt: time };
      return show(active);
    }
    if (!session) {
      return [BACK, DONE, KEEP, SKIP, '/back', '/done', '/skip', '/resume'].includes(text)
        ? { text: 'مفيش معاينة مفتوحة. اكتب /add للبدء.', replyMarkup: NO_KEYBOARD }
        : null;
    }
    session.updatedAt = time;
    if (value === '/resume') return show(session);

    if (!session.type) {
      session.type = formType(value);
      return show(session, session.type ? '' : 'اختار نوع من القائمة.\n\n');
    }

    const form = forms[session.type];
    const field = visibleFields(form, session.values)[session.index];
    if (text === BACK || value === '/back') {
      if (session.index > 0) session.index--;
      else if (Object.keys(session.values).length === 0) session.type = null;
      else return show(session, 'دي أول خطوة. تقدر تعدّلها أو تلغي المعاينة.\n\n');
      return show(session);
    }
    if (!field) {
      if (text === DONE || value === '/done') {
        clear({ chatId, userId });
        return { text: 'انتهت المعاينة. تقدر ترجع للملخص فوق أو تبدأ عملية جديدة بـ /add.', replyMarkup: NO_KEYBOARD };
      }
      return show(session, 'اختار «رجوع» للتعديل أو «إنهاء المعاينة».\n\n');
    }

    const skipping = text === SKIP || value === '/skip';
    const previous = session.values[field.key];
    if (!text) return show(session, 'اكتب الإجابة كنص أو استخدم الاختيارات.\n\n');
    if (skipping && !field.optional) return show(session, 'الخانة دي مطلوبة.\n\n');
    if (text === DONE || (value.startsWith('/') && !skipping)) {
      return show(session, 'كمّل الخانة الحالية، أو اختار رجوع أو إلغاء.\n\n');
    }
    const next = skipping ? null : text === KEEP ? previous : readValue(field, text, time);
    if (next == null && !skipping) return show(session, 'اكتب قيمة صحيحة للخانة دي.\n\n');
    if (next !== previous) {
      session.values[field.key] = next;
      for (const dependent of form.fields.filter(item => item.dependsOn === field.key)) delete session.values[dependent.key];
    }
    session.index++;
    return show(session);
  }

  return { handle, clear };
}
