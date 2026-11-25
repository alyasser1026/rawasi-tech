export interface HandoffContact {
  ready: boolean;
  name: string;
  phone: string;
  missingFields: Array<'name' | 'phone'>;
  prompt: string;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase().trim();
}

function normalizeDigits(value: unknown): string {
  return String(value ?? '').replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0));
}

/** A placeholder visitor label is not customer contact information. */
export function getHandoffContact(rawName: unknown, rawPhone: unknown): HandoffContact {
  const name = String(rawName ?? '').trim().slice(0, 80);
  const phone = normalizeDigits(rawPhone).trim().slice(0, 30);
  const normalizedName = normalizeText(name);
  const placeholders = new Set(['زائر', 'زائر جديد', 'زائر الموقع', 'عميل', 'عميل المتجر', 'عميل جديد', 'visitor', 'guest', 'customer']);
  const hasName = /[\p{L}].*[\p{L}]/u.test(name) && !placeholders.has(normalizedName);
  const digits = phone.replace(/\D/g, '');
  const hasPhone = /^\+?[\d\s().-]+$/.test(phone) && digits.length >= 8 && digits.length <= 15 && !/^(\d)\1+$/.test(digits);
  const missingFields: HandoffContact['missingFields'] = [];
  if (!hasName) missingFields.push('name');
  if (!hasPhone) missingFields.push('phone');
  const prompt = !hasName && !hasPhone
    ? 'لو تحب أحوّل استفسارك للفريق، اكتب اسمك ورقم جوال صحيح للتواصل. لم يتم إرسال طلب متابعة بعد.'
    : !hasName
      ? 'اكتب اسمك لإكمال بيانات التواصل قبل إرسال طلب المتابعة للفريق.'
      : !hasPhone
        ? 'اكتب رقم جوال صحيح لإكمال بيانات التواصل قبل إرسال طلب المتابعة للفريق.'
        : 'بيانات التواصل مكتملة. يمكن إرسال طلب المتابعة بعد تأكيدك، ولا يُعد الطلب مسجلًا قبل نجاح الحفظ أو الإرسال.';
  return { ready: hasName && hasPhone, name, phone, missingFields, prompt };
}

/** Model-provided contact fields must be grounded in a form value or the customer's own words. */
export function getVerifiedActionContact(args: Record<string, unknown>, context: {
  customerName?: string;
  customerPhone?: string;
  customerMessages?: string[];
}): HandoffContact {
  const name = String(context.customerName || args.customerName || args.customer_name || '').trim();
  const phone = String(context.customerPhone || args.customerPhone || args.customer_phone || '').trim();
  const evidence = (context.customerMessages || []).slice(-8);
  const nameEvidenced = Boolean(context.customerName?.trim()) || evidence.some(message => normalizeText(message).includes(normalizeText(name)));
  const phoneDigits = normalizeDigits(phone).replace(/\D/g, '');
  const phoneEvidenced = Boolean(context.customerPhone?.trim()) || evidence.some(message => normalizeDigits(message).replace(/\D/g, '').includes(phoneDigits));
  return getHandoffContact(nameEvidenced ? name : '', phoneEvidenced ? phone : '');
}

export function hasExplicitHandoffRequest(message: string): boolean {
  const text = normalizeText(message);
  return /(?:حولني|حولوني|حوّلني|تحويل|اتكلم مع|اكلم|كلموني|يكلموني|يتواصل معايا|يتواصل معي|تواصل معايا|تواصل معي|تواصل مع).{0,32}(?:مهندس|المهندس|فريق|الفريق|مبيعات|المبيعات|مسؤول|بشر|موظف|خدمه العملاء)/.test(text)
    || /(?:عايز|عاوز|اريد|محتاج).{0,15}(?:مهندس|موظف|بني ادم).{0,15}(?:يكلمني|يتواصل|اكلمه)/.test(text)
    || /(?:speak|talk|connect|transfer|escalate).{0,24}(?:human|person|agent|engineer|sales|support)/i.test(text)
    || /(?:call me|contact me|human please|engineer please)/i.test(text);
}

export function hasExplicitSubmissionRequest(message: string): boolean {
  const text = normalizeText(message);
  return /(?:اكد|أكد|ثبت|نفذ|سجل|اكمل|اعمل|اتمم).{0,12}(?:الطلب|طلبي|الحجز|حجزي)/.test(text)
    || /(?:احجز|احجزلي|احجز لي|عايز اطلب|عاوز اطلب|اريد طلب|اريد شراء|اشتريه|اشتريهم|اطلب الان)/.test(text)
    || /(?:confirm|place|submit|complete).{0,12}(?:my |the )?(?:order|booking)|(?:book (?:an? )?(?:inspection|visit|service))/.test(text);
}

export function hasActionRefusal(message: string): boolean {
  const text = normalizeText(message);
  return /(?:مش عايز|مش عاوز|لا اريد|مش موافق|بلاش|الغي|الغاء|من غير|بدون).{0,24}(?:تحويل|تواصل|اتصال|طلب|حجز|تكلم|مهندس|تتصل)/.test(text)
    || /(?:متتصل|ما تتصل|متكلمن|ماتكلمن|ما تكلمن|متحولنيش|ما تحولنيش|متبعتش|ما تبعتش)/.test(text)
    || /^(?:لا|لا شكرا|لاء|مش دلوقتي|بعدين|not now|no thanks)(?:[.!؟،\s]|$)/.test(text)
    || /(?:do not|don't|dont|cancel|no).{0,24}(?:call|contact|transfer|handoff|order|booking|escalat)/.test(text);
}

function resolveConsent(messages: string[], accepts: (message: string) => boolean): boolean {
  let allowed = false;
  for (const message of messages.slice(-8)) {
    if (hasActionRefusal(message)) allowed = false;
    else if (accepts(message)) allowed = true;
  }
  return allowed;
}

export const resolveHandoffConsent = (userMessages: string[]): boolean => resolveConsent(userMessages, hasExplicitHandoffRequest);
export const resolveSubmissionConsent = (userMessages: string[]): boolean => resolveConsent(userMessages, hasExplicitSubmissionRequest);

const HANDOFF_SUCCESS = /(?:تم\s+(?:تحويل|ارسال|إرسال|تسجيل)|حو[ّ]?لت|سجلت|سجّلت|بعت(?:ت)?|اتحول).{0,65}(?:مهندس|فريق|مبيعات|مختص|استفسار|متابعه|متابعة|طلب|بيانات|تفاصيل)|(?:هيتواصل|هيكلمك|سيتواصل|سيتصل).{0,45}(?:المهندس|الفريق|المختص)|(?:transferred|forwarded|escalated|registered|submitted).{0,35}(?:request|engineer|team|sales|contact)/i;
const SUBMISSION_SUCCESS = /(?:تم\s+(?:تسجيل|حجز|تثبيت|تاكيد|تأكيد|ارسال|إرسال)|سجلت|سجّلت|حجزت|ثبت|اكدت|أكدت).{0,30}(?:طلب(?:ك)?|حجز(?:ك)?|معاينه|معاينة|صيانه|صيانة|زياره|زيارة)|(?:order|booking|inspection).{0,25}(?:confirmed|booked|submitted|registered)|(?:confirmed|booked|submitted).{0,25}(?:order|booking|inspection)/i;

/** The model can describe a proposed action, but cannot manufacture its completion. */
export function enforceActionClaims(reply: string, state: {
  customerName?: string;
  customerPhone?: string;
  handoffConfirmed: boolean;
  submissionConfirmed: boolean;
}): string {
  const normalized = normalizeText(reply);
  const contact = getHandoffContact(state.customerName, state.customerPhone);
  const submissionText = normalized.replace(/طلب(?:ك)?\s+(?:التواصل|المتابعه|التحويل)/g, 'استفسار');
  if (!state.submissionConfirmed && SUBMISSION_SUCCESS.test(submissionText)) {
    return contact.ready
      ? 'أقدر أساعدك في تجهيز الطلب أو حجز المعاينة. لم يتم تأكيد طلب أو حجز بعد؛ أكّد الإجراء المطلوب أولًا.'
      : contact.prompt;
  }
  if (!state.handoffConfirmed && HANDOFF_SUCCESS.test(normalized)) {
    return contact.ready
      ? 'أقدر أحوّل استفسارك للفريق لو تحب. لم يتم تأكيد إرسال طلب متابعة بعد.'
      : contact.prompt;
  }
  return reply;
}
