import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildContentDispositionAttachment,
  buildDocumentFileName,
  computeReportRefCode,
  extractArabicDocType,
  formatDateDigits,
  sanitizeFileNameSegment,
} from '../lib/documentFileName.ts';

const ROOT = process.cwd();
const readRel = (relPath) => fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('sanitizeFileNameSegment strips unsafe path characters and preserves Arabic/alphanumeric text', () => {
  assert.equal(sanitizeFileNameSegment('INV/2026:001*?<>|'), 'INV-2026-001');
  assert.equal(sanitizeFileNameSegment('   سند   قبض رقم 12  '), 'سند_قبض_رقم_12');
  assert.equal(sanitizeFileNameSegment('---'), '');
  assert.equal(sanitizeFileNameSegment('—'), '');
});

test('extractArabicDocType removes trailing English parenthetical labels', () => {
  assert.equal(extractArabicDocType('سند قبض (Receipt Voucher)'), 'سند قبض');
  assert.equal(extractArabicDocType('التقرير التنفيذي (Project Dossier)'), 'التقرير التنفيذي');
  assert.equal(extractArabicDocType('ميزان المراجعة'), 'ميزان المراجعة');
});

test('formatDateDigits normalizes DD/MM/YYYY, YYYY-MM-DD, and ISO strings into YYYYMMDD', () => {
  assert.equal(formatDateDigits('16/11/2026'), '20261116');
  assert.equal(formatDateDigits('2026-11-16T08:30:00Z'), '20261116');
  assert.equal(formatDateDigits('2026-1-5'), '20260105');
});

test('computeReportRefCode preserves explicit DB numbers and generates deterministic prefixed report codes otherwise', () => {
  assert.equal(computeReportRefCode({ explicitCode: 'PV-2026-041', prefix: 'PV' }), 'PV-2026-041');
  assert.equal(computeReportRefCode({ explicitCode: 'INV/2026/09', prefix: 'INV' }), 'INV-2026-09');

  const autoA = computeReportRefCode({
    prefix: 'TB',
    issueDate: '2026-11-16',
    seedParts: ['2026-01-01', '2026-11-16'],
  });
  const autoB = computeReportRefCode({
    prefix: 'TB',
    issueDate: '2026-11-16',
    seedParts: ['2026-01-01', '2026-11-16'],
  });
  const autoDifferentScope = computeReportRefCode({
    prefix: 'TB',
    issueDate: '2026-11-16',
    seedParts: ['2026-10-01', '2026-11-16'],
  });

  assert.match(autoA, /^TB-20261116-\d{4}$/);
  assert.equal(autoA, autoB);
  assert.notEqual(autoA, autoDifferentScope);
});

test('buildDocumentFileName always includes both document type and voucher/report number', () => {
  const payment = buildDocumentFileName({
    docType: 'سند صرف (Payment Voucher)',
    docNumber: 'PV-104',
    subject: 'شركة النور',
    prefix: 'PV',
    ext: 'pdf',
  });
  assert.equal(payment.docType, 'سند_صرف');
  assert.equal(payment.refCode, 'PV-104');
  assert.equal(payment.fileName, 'سند_صرف_PV-104_شركة_النور.pdf');

  const trialBalance = buildDocumentFileName({
    docType: 'تقرير ميزان المراجعة',
    prefix: 'TB',
    issueDate: '2026-11-16',
    seedParts: ['2026-01-01', '2026-11-16'],
    ext: 'xlsx',
  });
  assert.ok(trialBalance.fileName.startsWith('تقرير_ميزان_المراجعة_TB-20261116-'));
  assert.ok(trialBalance.fileName.endsWith('.xlsx'));
  assert.match(trialBalance.refCode, /^TB-20261116-\d{4}$/);
});

test('buildContentDispositionAttachment encodes UTF-8 Arabic filename and ASCII fallback cleanly', () => {
  const header = buildContentDispositionAttachment('كشف_حساب_تفصيلي_STM-20261116-1234.pdf');
  assert.match(header, /^attachment; filename="[^"]+"; filename\*=UTF-8''/);
  assert.ok(header.includes(encodeURIComponent('كشف_حساب_تفصيلي_STM-20261116-1234.pdf')));
});

test('ReportOfficialHeader, printReportElement, RawasiSmartTable, PrintModals, and exports use unified document naming', () => {
  const officialHeader = readRel('components/ReportOfficialHeader.tsx');
  assert.match(officialHeader, /computeReportRefCode/);
  assert.match(officialHeader, /buildDocumentFileName/);
  assert.match(officialHeader, /data-phi-doc-title=\{officialFileMeta\.baseName\}/);
  assert.match(officialHeader, /data-phi-doc-ref=\{resolvedRefCode\}/);
  assert.match(officialHeader, /installGlobalPrintTitleSync/);

  const smartTable = readRel('components/rawasismarttable.tsx');
  assert.match(smartTable, /buildDocumentFileName/);
  assert.match(smartTable, /printWithDocumentTitle/);
  assert.doesNotMatch(smartTable, /toLocaleDateString\('en-GB'\)\.xlsx/);

  const statementApi = readRel('app/api/print-statement/route.ts');
  assert.match(statementApi, /buildContentDispositionAttachment/);
  assert.doesNotMatch(statementApi, /filename=statement\.pdf/);

  const printHelper = readRel('lib/printReportElement.ts');
  assert.match(printHelper, /buildDocumentFileName/);
  assert.match(printHelper, /data-phi-doc-ref/);

  const modals = [
    'app/expenses/ExpensePrintModal.tsx',
    'app/PaymentVouchers/PaymentPrintModal.tsx',
    'app/ReceiptVouchers/ReceiptPrintModal.tsx',
    'app/invoices/InvoicePrintModal.tsx',
    'app/materials/MaterialReceiptPrintModal.tsx',
    'app/subclaims/PrintClaimModal.tsx',
    'app/statement/StatementPrintModal.tsx',
    'app/PartnerBalances/printstatement.tsx',
    'app/custodies/page.tsx',
    'components/DocumentVerificationView.tsx',
  ];
  for (const rel of modals) {
    const src = readRel(rel);
    assert.match(src, /printWithDocumentTitle/, `${rel} must use printWithDocumentTitle`);
  }

  const partnerLogic = readRel('app/partners/partners_logic.ts');
  assert.doesNotMatch(partnerLogic, /RYC_Data_/);
  assert.match(partnerLogic, /buildDocumentFileName/);

  const laborLogic = readRel('app/labor_logs/labor_logs_logic.ts');
  assert.doesNotMatch(laborLogic, /writeFile\(wb,\s*["']يوميات_العمالة\.xlsx["']\)/);
  assert.match(laborLogic, /buildDocumentFileName/);

  for (const rel of [
    'app/accounts/accounts_logic.ts',
    'app/ar-aging/agingModel.ts',
    'app/attendance/attendance_logic.ts',
    'app/audit/audit_logic.ts',
    'app/cashflows/page.tsx',
    'app/expenses/AdvancedExpenseAllocation/page.tsx',
    'app/financial-statements/page.tsx',
    'app/financialplan/page.tsx',
    'app/import/page.tsx',
    'app/journal-errors/JournalErrors_logic.ts',
    'app/materials/page.tsx',
    'app/material_issues/page.tsx',
    'app/PartnerBalances/page.tsx',
    'app/PaymentVouchers/page.tsx',
    'app/payroll/payroll_logic.ts',
    'app/profitability/page.tsx',
    'app/settings/backup_logic.ts',
    'app/statement/statement_logic.ts',
    'app/subclaims/sub_claims_logic.ts',
    'app/trialbalance/trial_balance_logic.ts',
    'app/vat-return/vatReturnModel.ts',
  ]) {
    assert.match(readRel(rel), /buildDocumentFileName/, `${rel} must build report file names with buildDocumentFileName`);
  }
});
