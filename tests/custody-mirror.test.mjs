import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isCustodyAccountLike,
  normalizeArabicAccountText,
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
