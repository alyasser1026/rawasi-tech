/**
 * Helpers for synchronizing Payment Vouchers (حساب العهد 125) and Site Custodies.
 */

export interface CustodyAccountRef {
  code?: string | null;
  name?: string | null;
}

export function normalizeArabicAccountText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

export function isCustodyAccountLike(
  account: CustodyAccountRef | string | null | undefined,
): boolean {
  if (!account) return false;
  if (typeof account === 'string') {
    const trimmed = account.trim();
    if (/^125\b/.test(trimmed)) return true;
    const norm = normalizeArabicAccountText(trimmed);
    return norm.includes('عهد');
  }
  const code = String(account.code ?? '').trim();
  if (/^125/.test(code)) return true;
  const name = String(account.name ?? '').trim();
  if (/^125\b/.test(name)) return true;
  const normName = normalizeArabicAccountText(name);
  return normName.includes('عهد');
}

export function validateCustodyPaymentVoucherDraft(input: {
  debitAccount?: CustodyAccountRef | string | null;
  debitAccountCode?: string | null;
  debitAccountName?: string | null;
  partnerId?: string | null;
}): { isCustody: boolean; valid: boolean; error: string | null } {
  const isCustody =
    isCustodyAccountLike({
      code: input.debitAccountCode ?? (typeof input.debitAccount === 'object' ? input.debitAccount?.code : undefined),
      name: input.debitAccountName ?? (typeof input.debitAccount === 'object' ? input.debitAccount?.name : input.debitAccount),
    });

  if (!isCustody) {
    return { isCustody: false, valid: true, error: null };
  }

  const hasPartner = Boolean(input.partnerId && String(input.partnerId).trim());
  if (!hasPartner) {
    return {
      isCustody: true,
      valid: false,
      error: 'يلزم تحديد المستفيد (المهندس / الموظف صاحب العهدة) عند توجيه سند الصرف لحساب العهد (125).',
    };
  }

  return { isCustody: true, valid: true, error: null };
}
