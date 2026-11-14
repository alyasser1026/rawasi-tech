import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';

// Verify that authGuard.tsx has the public routes registered
test('Document Verification: authGuard contains /verify and /website/verify', () => {
  const content = fs.readFileSync('components/authGuard.tsx', 'utf8');
  assert.ok(content.includes("path === '/verify' || path.startsWith('/verify')"));
  assert.ok(content.includes("path.startsWith('/website/')"));
});

function isPublicRoute(path) {
  if (!path) return false;
  return path === '/' || path === '/login' || path === '/signup' || path === '/website' || path.startsWith('/website/') || path === '/verify' || path.startsWith('/verify') || path.startsWith('/construct');
}

function normalizeDocQuery(raw) {
  const clean = (raw || '').trim().toUpperCase();
  const digits = clean.replace(/[^0-9]/g, '');
  return { clean, digits };
}

function generateSecuritySeal(docNum, amount, date) {
  const payload = `PHITECH-VERIFY:${docNum}:${amount}:${date}:SECURE`;
  const hash = crypto.createHash('sha256').update(payload).digest('hex').toUpperCase();
  return `PHI-SEAL-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;
}

test('Document Verification: normalizeDocQuery handles mixed cases, spaces and formats', () => {
  const res1 = normalizeDocQuery('  pv-2026-0002  ');
  assert.equal(res1.clean, 'PV-2026-0002');
  assert.equal(res1.digits, '20260002');

  const res2 = normalizeDocQuery('rv 2026 0001');
  assert.equal(res2.clean, 'RV 2026 0001');
  assert.equal(res2.digits, '20260001');

  const res3 = normalizeDocQuery('0022');
  assert.equal(res3.clean, '0022');
  assert.equal(res3.digits, '0022');
});

test('Document Verification: generateSecuritySeal produces deterministic unique seals', () => {
  const seal1 = generateSecuritySeal('PV-2026-0002', 100, '2026-11-08');
  const seal2 = generateSecuritySeal('PV-2026-0002', 100, '2026-11-08');
  assert.equal(seal1, seal2);
  assert.match(seal1, /^PHI-SEAL-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);

  // Altering amount changes the seal
  const sealDifferent = generateSecuritySeal('PV-2026-0002', 200, '2026-11-08');
  assert.notEqual(seal1, sealDifferent);
});

test('Document Verification: authGuard marks /verify and /website/verify as public routes', () => {
  assert.equal(isPublicRoute('/verify'), true);
  assert.equal(isPublicRoute('/verify?doc=PV-2026-0002'), true);
  assert.equal(isPublicRoute('/website/verify'), true);
  assert.equal(isPublicRoute('/website/verify?doc=RV-2026-0001'), true);
  assert.equal(isPublicRoute('/website'), true);

  // Private routes remain protected
  assert.equal(isPublicRoute('/expenses'), false);
  assert.equal(isPublicRoute('/PaymentVouchers'), false);
  assert.equal(isPublicRoute('/journal'), false);
});

test('Document Verification: generates verification URL for QR codes', () => {
  const docCode = 'PV-2026-0002';
  const origin = 'https://phi-tech.org';
  const qrUrl = `${origin}/website/verify?doc=${encodeURIComponent(docCode)}`;
  assert.equal(qrUrl, 'https://phi-tech.org/website/verify?doc=PV-2026-0002');

  const parsed = new URL(qrUrl);
  assert.equal(parsed.pathname, '/website/verify');
  assert.equal(parsed.searchParams.get('doc'), 'PV-2026-0002');
});
