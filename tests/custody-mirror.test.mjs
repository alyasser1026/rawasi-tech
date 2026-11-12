import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isCustodyAccountLike,
  normalizeArabicAccountText,
  pickDefaultOpenCustodyForPartner,
  validateCustodyPaymentVoucherDraft,
} from '../lib/custodyMirror.ts';

test('Custody Mirror: detects account 125 and custody Arabic account names', () => {
  assert.equal(isCustodyAccountLike({ code: '125', name: 'عُهد الموظفين والمواقع' }), true);
  assert.equal(isCustodyAccountLike({ code: '1251', name: 'عهدة موقع برج كابيتال' }), true);
  assert.equal(isCustodyAccountLike({ code: null, name: 'عُهد الموظفين والمواقع' }), true);
  assert.equal(isCustodyAccountLike('125 - عهدة مهندسين'), true);
  assert.equal(isCustodyAccountLike({ code: '512', name: 'أجور ومرتبات عمالة الموقع' }), false);
  assert.equal(isCustodyAccountLike({ code: '122', name: 'الخزينة الرئيسية' }), false);
  assert.equal(isCustodyAccountLike(null), false);
});

test('Custody Mirror: normalizes Arabic diacritics and letter variants consistently', () => {
  assert.equal(normalizeArabicAccountText('عُهد الموظفين'), 'عهد الموظفين');
  assert.equal(normalizeArabicAccountText('إعتماد عهدة'), 'اعتماد عهده');
});

test('Custody Mirror: requires partner (payee) when payment voucher debits custody account 125', () => {
  const missingPartner = validateCustodyPaymentVoucherDraft({
    debitAccountCode: '125',
    debitAccountName: 'عُهد الموظفين والمواقع',
    partnerId: null,
  });
  assert.equal(missingPartner.isCustody, true);
  assert.equal(missingPartner.valid, false);
  assert.ok(missingPartner.error && missingPartner.error.includes('المستفيد'));

  const validCustody = validateCustodyPaymentVoucherDraft({
    debitAccountCode: '125',
    debitAccountName: 'عُهد الموظفين والمواقع',
    partnerId: '207eade1-de0b-4b4f-8947-767f01e020c0',
  });
  assert.equal(validCustody.isCustody, true);
  assert.equal(validCustody.valid, true);
  assert.equal(validCustody.error, null);

  const nonCustodyWithoutPartner = validateCustodyPaymentVoucherDraft({
    debitAccountCode: '512',
    debitAccountName: 'أجور عمال',
    partnerId: null,
  });
  assert.equal(nonCustodyWithoutPartner.isCustody, false);
  assert.equal(nonCustodyWithoutPartner.valid, true);
});

test('Custody Mirror: Realtime and React Query hooks keep both modules synchronized', () => {
  const realtime = fs.readFileSync('lib/useRealtimeSync.tsx', 'utf8');
  assert.match(realtime, /site_custodies:\s*\[[^\n]*'payment_vouchers'/);
  assert.match(realtime, /payment_vouchers:\s*\[[^\n]*'site_custodies_summary'/);

  const engine = fs.readFileSync('lib/accounting_engine.ts', 'utf8');
  assert.match(engine, /site_custodies_summary/);
});

test('Custody Mirror (Credit Side): requires custodyPartnerId when credit account is custody 125 and rejects custody on both sides', () => {
  const missingHolder = validateCustodyPaymentVoucherDraft({
    debitAccountCode: '216',
    debitAccountName: 'رواتب وأجور مستحقة',
    creditAccountCode: '125',
    creditAccountName: 'عُهد الموظفين والمواقع',
    partnerId: 'payee-1',
    custodyPartnerId: null,
  });
  assert.equal(missingHolder.isCustody, false);
  assert.equal(missingHolder.isCreditCustody, true);
  assert.equal(missingHolder.creditValid, false);
  assert.equal(missingHolder.valid, false);
  assert.ok(missingHolder.creditError && missingHolder.creditError.includes('صاحب العهدة'));

  const validCredit = validateCustodyPaymentVoucherDraft({
    debitAccountCode: '216',
    debitAccountName: 'رواتب وأجور مستحقة',
    creditAccountCode: '125',
    creditAccountName: 'عُهد الموظفين والمواقع',
    partnerId: 'payee-1',
    custodyPartnerId: 'holder-1',
  });
  assert.equal(validCredit.isCreditCustody, true);
  assert.equal(validCredit.creditValid, true);
  assert.equal(validCredit.valid, true);
  assert.equal(validCredit.error, null);

  const bothSides = validateCustodyPaymentVoucherDraft({
    debitAccountCode: '125',
    debitAccountName: 'عُهد الموظفين والمواقع',
    creditAccountCode: '125',
    creditAccountName: 'عُهد الموظفين والمواقع',
    partnerId: 'payee-1',
    custodyPartnerId: 'holder-1',
  });
  assert.equal(bothSides.bothSidesCustody, true);
  assert.equal(bothSides.valid, false);
});

test('Custody Mirror (Credit Side): picks best matching open custody for partner and wires modal, logic, and custodies page', () => {
  const picked = pickDefaultOpenCustodyForPartner(
    [
      { id: 'c1', partner_id: 'h1', project_id: 'p2', remaining_amount: 400, status: 'open', opened_date: '2026-11-01' },
      { id: 'c2', partner_id: 'h1', project_id: 'p1', remaining_amount: 2000, status: 'open', opened_date: '2026-11-05' },
      { id: 'c3', partner_id: 'h2', project_id: 'p1', remaining_amount: 5000, status: 'open', opened_date: '2026-11-01' },
    ],
    'h1',
    1000,
    'p1',
  );
  assert.equal(picked?.id, 'c2');

  const modalSrc = fs.readFileSync('app/PaymentVouchers/PaymentVoucherModal.tsx', 'utf8');
  assert.match(modalSrc, /custody_partner_id/);
  assert.match(modalSrc, /custodyStatus\.isCreditCustody/);

  const logicSrc = fs.readFileSync('app/PaymentVouchers/payment_vouchers_logic.ts', 'utf8');
  assert.match(logicSrc, /custody_partner_id/);

  const custodiesSrc = fs.readFileSync('app/custodies/page.tsx', 'utf8');
  assert.match(custodiesSrc, /disbursement_vouchers/);
});

test('Custody Mirror: PostgREST schema cache resolves custody_partner_id join on payment_vouchers', async () => {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const env = Object.fromEntries(
    envContent
      .split(/\r?\n/)
      .filter((l) => l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  const selectParam =
    '*,payee:partners!partner_id(name),custody_partner:partners!custody_partner_id(name),credit_account:accounts!credit_account_id(name,code),debit_account:accounts!debit_account_id(name,code)';
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/payment_vouchers?select=${encodeURIComponent(selectParam)}&order=date.desc,created_at.desc&offset=0&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  assert.equal(res.status, 200, `Expected 200 from PostgREST, got ${res.status}: ${await res.text()}`);
});
