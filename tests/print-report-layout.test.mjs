import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('ReportOfficialHeader renders PhiTech logo, QR verification code, and linear barcode', () => {
  const headerPath = path.join(rootDir, 'components', 'ReportOfficialHeader.tsx');
  assert.ok(fs.existsSync(headerPath), 'ReportOfficialHeader.tsx must exist');
  const src = fs.readFileSync(headerPath, 'utf8');

  assert.match(src, /\/brand\/phitech-lockup-color\.svg/, 'Must include official PhiTech logo');
  assert.match(src, /QRCodeSVG/, 'Must include scannable QR code');
  assert.match(src, /buildLinearBarcodeBars/, 'Must include vector linear barcode generator');
  assert.match(src, /SCAN VERIFY/, 'Must include QR verification label');
});

test('globals.css @media print enables multi-page pagination and resets sticky blurred table headers', () => {
  const cssPath = path.join(rootDir, 'app', 'globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  const printBlockIndex = css.indexOf('@media print');
  assert.ok(printBlockIndex !== -1, '@media print block must exist in globals.css');
  const printSection = css.slice(printBlockIndex);

  assert.match(printSection, /height:\s*auto\s*!important/, 'Must set height: auto !important in @media print');
  assert.match(printSection, /overflow:\s*visible\s*!important/, 'Must set overflow: visible !important in @media print');
  assert.match(printSection, /backdrop-filter:\s*none\s*!important/, 'Must disable backdrop-filter in @media print');
  assert.doesNotMatch(printSection, /height:\s*100%\s*!important/, 'Must not lock height to 100% in @media print');
});

test('ReportsTab and ProjectReportModal integrate ReportOfficialHeader, professional table styles, and ReportContactFooter', () => {
  const reportsTab = fs.readFileSync(path.join(rootDir, 'app', 'projects', 'ReportsTab.tsx'), 'utf8');
  const reportModal = fs.readFileSync(path.join(rootDir, 'app', 'projects', 'ProjectReportModal.tsx'), 'utf8');

  assert.match(reportsTab, /<ReportOfficialHeader/, 'ReportsTab must render ReportOfficialHeader');
  assert.match(reportsTab, /<ReportContactFooter/, 'ReportsTab must render ReportContactFooter');
  assert.match(reportsTab, /#printable-dossier thead th/, 'ReportsTab must style printable table headers explicitly');
  assert.match(reportsTab, /ختم الشركة والمصادقة/, 'ReportsTab must include official company stamp box');

  assert.match(reportModal, /<ReportOfficialHeader/, 'ProjectReportModal must render ReportOfficialHeader');
  assert.match(reportModal, /<ReportContactFooter/, 'ProjectReportModal must render ReportContactFooter');
  assert.match(reportModal, /#printable-report thead th/, 'ProjectReportModal must style printable table headers explicitly');
});
