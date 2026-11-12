/**
 * Helpers for synchronizing Payment Vouchers (حساب العهد 125) and Site Custodies.
 * Supports BOTH:
 *  - Debit side (إصدار / تمويل عهدة: debit_account = 125)
 *  - Credit side (سداد من حساب عهدة: credit_account = 125, linked to `custody_partner_id` & `custody_id`)
 */

export interface CustodyAccountRef {
  code?: string | null;
  name?: string | null;
}

export interface OpenCustodyCandidate {
  id: string;
  custody_number?: string | null;
  title?: string | null;
  partner_id: string;
  project_id?: string | null;
  remaining_amount?: number | null;
  status?: string | null;
  opened_date?: string | null;
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

export function pickDefaultOpenCustodyForPartner(
  custodies: OpenCustodyCandidate[] | null | undefined,
  partnerId: string | null | undefined,
  amount?: number | null,
  projectId?: string | null,
): OpenCustodyCandidate | null {
  if (!partnerId || !Array.isArray(custodies) || custodies.length === 0) return null;
  const pid = String(partnerId).trim();
  const candidates = custodies.filter(
    (c) => String(c.partner_id) === pid && (!c.status || c.status === 'open'),
  );
  if (candidates.length === 0) return null;

  const targetAmount = Number(amount || 0);
  const scored = [...candidates].sort((a, b) => {
    const aProj = projectId && a.project_id === projectId ? 1 : 0;
    const bProj = projectId && b.project_id === projectId ? 1 : 0;
    if (aProj !== bProj) return bProj - aProj;

    const aCovers = Number(a.remaining_amount || 0) >= targetAmount ? 1 : 0;
    const bCovers = Number(b.remaining_amount || 0) >= targetAmount ? 1 : 0;
    if (aCovers !== bCovers) return bCovers - aCovers;

    const aPos = Number(a.remaining_amount || 0) > 0 ? 1 : 0;
    const bPos = Number(b.remaining_amount || 0) > 0 ? 1 : 0;
    if (aPos !== bPos) return bPos - aPos;

    return String(a.opened_date || '').localeCompare(String(b.opened_date || ''));
  });

  return scored[0] || null;
}

export function validateCustodyPaymentVoucherDraft(input: {
  debitAccount?: CustodyAccountRef | string | null;
  debitAccountCode?: string | null;
  debitAccountName?: string | null;
  partnerId?: string | null;
  creditAccount?: CustodyAccountRef | string | null;
  creditAccountCode?: string | null;
  creditAccountName?: string | null;
  custodyPartnerId?: string | null;
}): {
  isCustody: boolean;
  isCreditCustody: boolean;
  bothSidesCustody: boolean;
  debitValid: boolean;
  creditValid: boolean;
  valid: boolean;
  error: string | null;
  creditError: string | null;
} {
  const isDebitCustody = isCustodyAccountLike({
    code:
      input.debitAccountCode ??
      (typeof input.debitAccount === 'object' ? input.debitAccount?.code : undefined),
    name:
      input.debitAccountName ??
      (typeof input.debitAccount === 'object' ? input.debitAccount?.name : input.debitAccount),
  });

  const isCreditCustody = isCustodyAccountLike({
    code:
      input.creditAccountCode ??
      (typeof input.creditAccount === 'object' ? input.creditAccount?.code : undefined),
    name:
      input.creditAccountName ??
      (typeof input.creditAccount === 'object' ? input.creditAccount?.name : input.creditAccount),
  });

  const bothSidesCustody = isDebitCustody && isCreditCustody;
  const hasPartner = Boolean(input.partnerId && String(input.partnerId).trim());
  const hasCustodyPartner = Boolean(
    input.custodyPartnerId && String(input.custodyPartnerId).trim(),
  );

  const debitValid = !isDebitCustody || hasPartner;
  const creditValid = !isCreditCustody || hasCustodyPartner;

  let debitError: string | null = null;
  let creditError: string | null = null;

  if (bothSidesCustody) {
    debitError = 'لا يمكن اختيار حساب العُهد في الجانب المدين والدائن معاً في نفس السند.';
  } else {
    if (!debitValid) {
      debitError =
        'يلزم تحديد المستفيد (المهندس / الموظف صاحب العهدة) عند توجيه سند الصرف لحساب العهد (125).';
    }
    if (!creditValid) {
      creditError =
        'يلزم تحديد صاحب العهدة (الشخص اللي العهدة في ذمته) عند السداد من حساب العهد (125).';
    }
  }

  const valid = !bothSidesCustody && debitValid && creditValid;
  const error = debitError || creditError;

  return {
    isCustody: isDebitCustody,
    isCreditCustody,
    bothSidesCustody,
    debitValid: !bothSidesCustody && debitValid,
    creditValid: !bothSidesCustody && creditValid,
    valid,
    error,
    creditError: bothSidesCustody ? debitError : creditError,
  };
}
