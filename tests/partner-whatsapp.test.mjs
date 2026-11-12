import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildWhatsAppWebUrl,
  formatPartnerOperationMessage,
  formatPhoneForDisplay,
  normalizeArabicLookupText,
  normalizePartnerPhone,
  resolvePartnerFromList,
} from '../lib/partnerWhatsApp.ts';

const root = process.cwd();

test('Partner WhatsApp: normalizes Egyptian, Saudi, and international phone numbers', () => {
  assert.equal(normalizePartnerPhone('01026332733', 'EG'), '201026332733');
  assert.equal(normalizePartnerPhone('0501234567', 'EG'), '966501234567');
  assert.equal(normalizePartnerPhone('+966 50 123-4567', 'SA'), '966501234567');
  assert.equal(normalizePartnerPhone('00201122334455', 'EG'), '201122334455');
  assert.equal(normalizePartnerPhone('0551234567', 'SA'), '966551234567');
  assert.equal(normalizePartnerPhone('', 'EG'), null);
  assert.equal(normalizePartnerPhone(null, 'EG'), null);
  assert.equal(normalizePartnerPhone('abc-123', 'EG'), null);

  assert.equal(formatPhoneForDisplay('01026332733', 'EG'), '+201026332733');
});

test('Partner WhatsApp: resolves partner phone by ID or normalized Arabic name fallback', () => {
  const partners = [
    { id: 'p-1', name: 'شركة النور للمقاولات', phone: '01099887766', partner_type: 'sub_contractor' },
    { id: 'p-2', name: 'أحمد إبراهيم محمد', phone: '0507788990', partner_type: 'employee' },
  ];

  const byId = resolvePartnerFromList(partners, {
    partnerId: 'p-1',
    partnerName: 'اسم قديم مختلف',
  });
  assert.equal(byId.matched, true);
  assert.equal(byId.phone, '01099887766');
  assert.equal(byId.partnerName, 'شركة النور للمقاولات');

  assert.equal(normalizeArabicLookupText('احمد ابراهيم محمد'), 'احمد ابراهيم محمد');
  const byName = resolvePartnerFromList(partners, {
    partnerId: null,
    partnerName: 'احمد ابراهيم محمد',
  });
  assert.equal(byName.matched, true);
  assert.equal(byName.partnerId, 'p-2');
  assert.equal(byName.phone, '0507788990');

  const missing = resolvePartnerFromList(partners, {
    partnerId: 'p-999',
    partnerName: 'مورد غير مسجل',
  });
  assert.equal(missing.matched, false);
  assert.equal(missing.phone, null);
});

test('Partner WhatsApp: builds wa.me URL and formats every operation type', () => {
  const operations = [
    'payment_voucher',
    'receipt_voucher',
    'statement',
    'statement_line',
    'labor_log',
    'expense',
    'violation',
    'material_supply',
    'material_issue',
    'purchase_order',
    'custody',
  ];

  for (const opType of operations) {
    const text = formatPartnerOperationMessage({
      type: opType,
      partnerName: 'مقاول الباطن',
      companyName: 'فاي تك للمقاولات',
      currencyLabel: 'ج.م',
      reference: 'REF-001',
      date: '2026-11-12',
      amount: 12500,
      project: 'برج كابيتال',
      description: 'دفعة أعمال خرسانة',
      status: 'معتمد',
      extraLines: [
        { label: 'طريقة الدفع', value: 'نقداً' },
        { label: 'حقل فارغ', value: '---' },
      ],
    });
    assert.ok(text.includes('مقاول الباطن'), `Missing partner name for ${opType}`);
    assert.ok(text.includes('12,500.00 ج.م'), `Missing formatted amount for ${opType}`);
    assert.ok(!text.includes('حقل فارغ'), `Should omit placeholder extraLines for ${opType}`);
  }

  const url = buildWhatsAppWebUrl('01026332733', 'مرحبا بكم', 'EG');
  assert.equal(url, 'https://wa.me/201026332733?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%20%D8%A8%D9%83%D9%85');
});

test('Partner WhatsApp: realtime sync invalidates partners_phones_lookup and all target screens wire SendPartnerMessageButton', () => {
  const syncSrc = fs.readFileSync(path.join(root, 'lib/useRealtimeSync.tsx'), 'utf8');
  assert.ok(syncSrc.includes("'partners_phones_lookup'"), 'useRealtimeSync must invalidate partners_phones_lookup');

  const expectedPages = [
    'app/PaymentVouchers/page.tsx',
    'app/ReceiptVouchers/page.tsx',
    'app/statement/page.tsx',
    'app/labor_logs/page.tsx',
    'app/expenses/page.tsx',
    'app/violations/page.tsx',
    'app/material_issues/page.tsx',
    'app/materials/page.tsx',
    'app/purchase-orders/page.tsx',
    'app/custodies/page.tsx',
  ];

  for (const relPath of expectedPages) {
    const content = fs.readFileSync(path.join(root, relPath), 'utf8');
    assert.ok(
      content.includes('SendPartnerMessageButton'),
      `${relPath} must import and render SendPartnerMessageButton`,
    );
  }
});
