/**
 * Partner WhatsApp phone normalization, Web URL builder, and Arabic operation message formatters.
 */

export type PartnerCountryCode = 'SA' | 'EG';

export type PartnerOperationType =
  | 'payment_voucher'
  | 'receipt_voucher'
  | 'statement'
  | 'statement_line'
  | 'labor_log'
  | 'expense'
  | 'violation'
  | 'material_supply'
  | 'material_issue'
  | 'purchase_order'
  | 'custody';

export interface PartnerMessageDetailLine {
  label: string;
  value: string | number | null | undefined;
}

export interface PartnerOperationMessageInput {
  type: PartnerOperationType;
  partnerName?: string | null;
  companyName?: string | null;
  currencyLabel?: string | null;
  reference?: string | null;
  date?: string | null;
  amount?: number | null;
  status?: string | null;
  project?: string | null;
  description?: string | null;
  extraLines?: PartnerMessageDetailLine[];
}

export function normalizeArabicLookupText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Normalizes Egyptian/Saudi/international phone numbers to digits-only international format
 * (e.g. `201026332733` or `966501234567`) suitable for Meta WhatsApp API & `wa.me`.
 */
export function normalizePartnerPhone(
  phone: string | null | undefined,
  defaultCountry: PartnerCountryCode = 'EG',
): string | null {
  if (!phone) return null;
  let digits = String(phone).trim().replace(/[\s\-().]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    if (/^01[0125]\d{8}$/.test(digits)) {
      digits = '20' + digits.slice(1);
    } else if (/^05\d{8}$/.test(digits)) {
      digits = '966' + digits.slice(1);
    } else {
      digits = (defaultCountry === 'SA' ? '966' : '20') + digits.slice(1);
    }
  } else if (/^5\d{8}$/.test(digits)) {
    digits = '966' + digits;
  } else if (/^1[0125]\d{8}$/.test(digits)) {
    digits = '20' + digits;
  }

  return /^[1-9]\d{8,14}$/.test(digits) ? digits : null;
}

export function formatPhoneForDisplay(
  phone: string | null | undefined,
  defaultCountry: PartnerCountryCode = 'EG',
): string {
  const normalized = normalizePartnerPhone(phone, defaultCountry);
  return normalized ? `+${normalized}` : String(phone ?? '').trim();
}

export function buildWhatsAppWebUrl(
  phone: string | null | undefined,
  message: string,
  defaultCountry: PartnerCountryCode = 'EG',
): string | null {
  const normalized = normalizePartnerPhone(phone, defaultCountry);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export interface PartnerPhoneLookupRow {
  id: string;
  name?: string | null;
  phone?: string | null;
  partner_type?: string | null;
}

export function resolvePartnerFromList(
  partners: PartnerPhoneLookupRow[] | null | undefined,
  query: { partnerId?: string | null; partnerName?: string | null; fallbackPhone?: string | null },
): { partnerId: string | null; partnerName: string; phone: string | null; matched: boolean } {
  const list = Array.isArray(partners) ? partners : [];
  const rawId = query.partnerId ? String(query.partnerId).trim() : '';
  if (rawId) {
    const byId = list.find((p) => String(p.id) === rawId);
    if (byId) {
      return {
        partnerId: String(byId.id),
        partnerName: String(byId.name || query.partnerName || 'الشريك'),
        phone: byId.phone || query.fallbackPhone || null,
        matched: true,
      };
    }
  }

  const targetName = normalizeArabicLookupText(query.partnerName);
  if (targetName) {
    const byName = list.find((p) => normalizeArabicLookupText(p.name) === targetName);
    if (byName) {
      return {
        partnerId: String(byName.id),
        partnerName: String(byName.name || query.partnerName || 'الشريك'),
        phone: byName.phone || query.fallbackPhone || null,
        matched: true,
      };
    }
  }

  return {
    partnerId: rawId || null,
    partnerName: String(query.partnerName || 'الشريك').trim() || 'الشريك',
    phone: query.fallbackPhone || null,
    matched: false,
  };
}

const OPERATION_TITLES: Record<PartnerOperationType, string> = {
  payment_voucher: 'إشعار سند صرف',
  receipt_voucher: 'إشعار سند قبض',
  statement: 'ملخص كشف الحساب',
  statement_line: 'تفاصيل حركة في كشف الحساب',
  labor_log: 'إشعار يومية عمالة ميدانية',
  expense: 'إشعار قيد مصروف',
  violation: 'إشعار خصم / جزاء إداري',
  material_supply: 'إشعار توريد خامات',
  material_issue: 'إشعار إذن صرف خامات',
  purchase_order: 'إشعار أمر شراء خامات',
  custody: 'إشعار عهدة موقع',
};

function formatMessageAmount(amount: number, currencyLabel?: string | null): string {
  const formatted = Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currencyLabel ? `${formatted} ${currencyLabel}` : formatted;
}

export function formatPartnerOperationMessage(input: PartnerOperationMessageInput): string {
  const title = OPERATION_TITLES[input.type] || 'إشعار عملية مالية';
  const greetingName = input.partnerName ? ` ${input.partnerName}` : '';
  const lines: string[] = [
    `*${title}*`,
    `مرحباً${greetingName}،`,
    `نحيطكم علماً بتفاصيل العملية التالية:`,
  ];

  if (input.reference) lines.push(`• الرقم المرجعي: ${input.reference}`);
  if (input.date) lines.push(`• التاريخ: ${input.date}`);
  if (input.project) lines.push(`• المشروع: ${input.project}`);
  if (input.amount !== null && input.amount !== undefined && !Number.isNaN(Number(input.amount))) {
    lines.push(`• المبلغ: ${formatMessageAmount(Number(input.amount), input.currencyLabel)}`);
  }
  if (input.description) lines.push(`• البيان: ${input.description}`);

  if (Array.isArray(input.extraLines)) {
    for (const item of input.extraLines) {
      if (item.value === null || item.value === undefined) continue;
      const str = String(item.value).trim();
      if (!str || str === '---' || str === '-') continue;
      lines.push(`• ${item.label}: ${str}`);
    }
  }

  if (input.status) lines.push(`• الحالة: ${input.status}`);
  lines.push('');
  lines.push(`— ${input.companyName || 'فاي تك للمقاولات والتوريدات'}`);

  return lines.join('\n');
}
