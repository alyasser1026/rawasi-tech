import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('ReportOfficialHeader uses official PHI_COMPANY_CONTACTS, #f7eee2 pearl logo badge, QR code, and linear barcode', () => {
  const headerPath = path.join(rootDir, 'components', 'ReportOfficialHeader.tsx');
  assert.ok(fs.existsSync(headerPath), 'ReportOfficialHeader.tsx must exist');
  const src = fs.readFileSync(headerPath, 'utf8');

  assert.match(src, /PHI_COMPANY_CONTACTS/, 'Must import and use PHI_COMPANY_CONTACTS');
  assert.match(src, /\/brand\/phitech-lockup-color\.svg/, 'Must include official PhiTech logo');
  assert.match(src, /#f7eee2/i, 'Must render logo inside official Light Mode #f7eee2 pearl badge');
  assert.match(src, /QRCodeSVG/, 'Must include scannable QR code');
  assert.match(src, /buildLinearBarcodeBars/, 'Must include vector linear barcode generator');
  assert.match(src, /clientPhone/, 'Must support clientPhone prop');
  assert.match(src, /clientAddress/, 'Must support clientAddress prop');
  assert.match(src, /clientVatNumber/, 'Must support clientVatNumber prop');
  assert.doesNotMatch(src, /101\s*456\s*1199|1113031523/, 'Must not contain invented phone numbers');
});

test('globals.css, brand.css, and enterprise.css force pure white #ffffff print background and multi-page pagination', () => {
  const globalsCss = fs.readFileSync(path.join(rootDir, 'app', 'globals.css'), 'utf8');
  const brandCss = fs.readFileSync(path.join(rootDir, 'app', 'brand.css'), 'utf8');
  const enterpriseCss = fs.readFileSync(path.join(rootDir, 'app', 'enterprise.css'), 'utf8');

  const printBlockIndex = globalsCss.indexOf('@media print');
  assert.ok(printBlockIndex !== -1, '@media print block must exist in globals.css');
  const printSection = globalsCss.slice(printBlockIndex);

  assert.match(printSection, /--bg-canvas:\s*#ffffff\s*!important/i, 'globals.css must override --bg-canvas to #ffffff in @media print');
  assert.match(printSection, /html\.phi-brand:has\(\.enterprise-shell\)\s+body/, 'globals.css must override enterprise-shell body specificity in @media print');
  assert.match(printSection, /height:\s*auto\s*!important/, 'Must set height: auto !important in @media print');
  assert.match(printSection, /overflow:\s*visible\s*!important/, 'Must set overflow: visible !important in @media print');
  assert.doesNotMatch(printSection, /height:\s*100%\s*!important/, 'Must not lock height to 100% in @media print');

  assert.match(brandCss, /--bg-canvas:\s*#ffffff\s*!important/i, 'brand.css must override --bg-canvas to #ffffff in @media print');
  assert.match(enterpriseCss, /--bg-canvas:\s*#ffffff\s*!important/i, 'enterprise.css must override --bg-canvas to #ffffff in @media print');
});

test('ReportsTab and ProjectReportModal integrate printReportElement, ReportOfficialHeader with full client details, and ReportContactFooter', () => {
  const reportsTab = fs.readFileSync(path.join(rootDir, 'app', 'projects', 'ReportsTab.tsx'), 'utf8');
  const reportModal = fs.readFileSync(path.join(rootDir, 'app', 'projects', 'ProjectReportModal.tsx'), 'utf8');
  const printHelper = fs.readFileSync(path.join(rootDir, 'lib', 'printReportElement.ts'), 'utf8');

  assert.match(printHelper, /export function printReportElement/, 'printReportElement helper must exist');
  assert.match(printHelper, /size:\s*A4\s+landscape/i, 'printReportElement must configure A4 landscape');

  assert.match(reportsTab, /printReportElement\('printable-dossier'/, 'ReportsTab must use printReportElement for reliable printing');
  assert.match(reportsTab, /<ReportOfficialHeader/, 'ReportsTab must render ReportOfficialHeader');
  assert.match(reportsTab, /clientPhone=\{clientRecord\.phone/, 'ReportsTab must pass clientPhone to ReportOfficialHeader');
  assert.match(reportsTab, /engineerName=\{project\.engineer_in_charge/, 'ReportsTab must pass real engineer_in_charge field');
  assert.match(reportsTab, /<ReportContactFooter/, 'ReportsTab must render ReportContactFooter');

  assert.match(reportModal, /printReportElement\('printable-report'/, 'ProjectReportModal must use printReportElement for reliable printing');
  assert.match(reportModal, /<ReportOfficialHeader/, 'ProjectReportModal must render ReportOfficialHeader');
  assert.match(reportModal, /clientPhone=\{clientRecord\.phone/, 'ProjectReportModal must pass clientPhone to ReportOfficialHeader');
  assert.match(reportModal, /<ReportContactFooter/, 'ProjectReportModal must render ReportContactFooter');
});
