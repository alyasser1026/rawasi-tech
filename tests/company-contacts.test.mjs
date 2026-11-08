import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Company Contacts: Official Phi Tech contact details are correct and standardized', async () => {
  const filePath = path.resolve('lib/company-contacts.ts');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('phi.tech.eg@gmail.com'), 'Must contain phi.tech.eg@gmail.com');
  assert.ok(content.includes('+201026332733'), 'Must contain +201026332733');
  assert.ok(content.includes('+201558888744'), 'Must contain +201558888744');
});

test('Company Contacts: vCard payload adheres to standard vCard 3.0 specification', async () => {
  const filePath = path.resolve('lib/company-contacts.ts');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('BEGIN:VCARD'), 'vCard must start with BEGIN:VCARD');
  assert.ok(content.includes('VERSION:3.0'), 'vCard version must be 3.0');
  assert.ok(content.includes('FN:Phi Tech'), 'Display name must be Phi Tech');
  assert.ok(content.includes('TEL;TYPE=CELL,VOICE:+201026332733'), 'Cell phone must be formatted for one-touch dial');
  assert.ok(content.includes('TEL;TYPE=WORK,VOICE:+201558888744'), 'Work phone must be formatted for one-touch dial');
  assert.ok(content.includes('EMAIL;TYPE=INTERNET,PREF:phi.tech.eg@gmail.com'), 'Email must be included with internet type');
  assert.ok(content.includes('END:VCARD'), 'vCard must end with END:VCARD');
});

test('Company Contacts: All 9 report modals import and render ReportContactFooter', async () => {
  const reports = [
    'app/projects/ReportsTab.tsx',
    'app/projects/ProjectReportModal.tsx',
    'app/expenses/ExpensePrintModal.tsx',
    'app/PaymentVouchers/PaymentPrintModal.tsx',
    'app/invoices/InvoicePrintModal.tsx',
    'app/materials/MaterialReceiptPrintModal.tsx',
    'app/statement/StatementPrintModal.tsx',
    'app/PartnerBalances/printstatement.tsx',
    'app/subclaims/PrintClaimModal.tsx'
  ];

  for (const relPath of reports) {
    const fullPath = path.resolve(relPath);
    assert.ok(fs.existsSync(fullPath), `Report file must exist: ${relPath}`);
    const code = fs.readFileSync(fullPath, 'utf8');
    assert.ok(
      code.includes('ReportContactFooter'),
      `${relPath} must integrate ReportContactFooter`
    );
  }
});

test('Company Contacts: No obsolete emails or old phone numbers remain in reporting files', async () => {
  const filesToCheck = [
    'app/expenses/ExpensePrintModal.tsx',
    'app/PaymentVouchers/PaymentPrintModal.tsx',
    'app/invoices/InvoicePrintModal.tsx'
  ];

  for (const relPath of filesToCheck) {
    const code = fs.readFileSync(path.resolve(relPath), 'utf8');
    assert.ok(!code.includes('rawasi.alyusr@gmail.com'), `${relPath} still contains obsolete rawasi email`);
    assert.ok(!code.includes('0547606876'), `${relPath} still contains obsolete phone number`);
    assert.ok(!code.includes('0578018944'), `${relPath} still contains obsolete secondary phone number`);
  }
});
