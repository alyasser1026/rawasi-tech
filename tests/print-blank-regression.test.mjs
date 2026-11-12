import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

function readRel(relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function collectSourceFiles(dirs) {
    const out = [];
    for (const dir of dirs) {
        const start = path.join(ROOT, dir);
        if (!fs.existsSync(start)) continue;
        const stack = [start];
        while (stack.length > 0) {
            const current = stack.pop();
            for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                } else if (/\.(tsx?|css)$/.test(entry.name)) {
                    out.push(path.relative(ROOT, fullPath).replace(/\\/g, '/'));
                }
            }
        }
    }
    return out;
}

test('no stylesheet hides body or body * via visibility: hidden during print', () => {
    const files = collectSourceFiles(['app', 'components', 'lib']);
    const offenders = [];
    for (const relPath of files) {
        const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
        if (/body\s*\*[^}]*visibility\s*:\s*hidden/i.test(src) || /html\s*,\s*body[^}]*visibility\s*:\s*hidden/i.test(src)) {
            offenders.push(relPath);
        }
    }
    assert.deepEqual(offenders, [], `Found global body visibility:hidden rules in: ${offenders.join(', ')}`);
});

test('lib/printReportElement keeps hidden iframe visible to Chromium print engine and removes aria-hidden', () => {
    const src = readRel('lib/printReportElement.ts');
    assert.doesNotMatch(src, /opacity:\s*0\s*;/i);
    assert.doesNotMatch(src, /width:\s*0\s*;\s*height:\s*0/i);
    assert.match(src, /left:-10000px/);
    assert.match(src, /removeAttribute\(['"]aria-hidden['"]\)/);
    assert.match(src, /clone\.style\.display\s*=\s*['"]block['"]/);
    assert.match(src, /clone\.style\.visibility\s*=\s*['"]visible['"]/);
    assert.match(src, /media=["']print["']\s+onload=/);
    assert.match(src, /requestAnimationFrame/);
});

test('components/rawasismarttable.tsx scopes table isolation safely and unclips scrolling ancestors', () => {
    const src = readRel('components/rawasismarttable.tsx');
    assert.match(src, /body:has\(\.rawasi-printable-table:not\(\.no-print \*\)\)/);
    for (const token of [
        '.phi-boq-report-overlay',
        '.phi-dossier-overlay',
        '#printable-report',
        '#printable-dossier',
        '#printable-a4-sheet',
        '.custody-settlement-modal',
        '.custody-print-area',
        '.phi-boq-report-printing',
        '.phi-dossier-printing',
    ]) {
        assert.ok(src.includes(token), `rawasismarttable.tsx must yield to ${token}`);
    }
    assert.ok(
        !src.includes('.ecs-print-src'),
        'rawasismarttable.tsx must not exclude .ecs-print-src because it stays mounted inside hidden .ecs on /expenses',
    );
    assert.match(src, /\*:has\(\.rawasi-printable-table\)\s*\{\s*overflow:\s*visible\s*!important;/);
});

test('PrintMasthead and PrintDocument keep print content visible on white paper', () => {
    const masthead = readRel('components/PrintMasthead.tsx');
    assert.doesNotMatch(masthead, /className="phi-print-masthead"[^>]*aria-hidden="true"/);
    for (const token of ['.phi-boq-report-overlay', '.phi-dossier-overlay', '#printable-a4-sheet', '.custody-settlement-modal', '.custody-print-area']) {
        assert.ok(masthead.includes(token), `PrintMasthead.tsx must exclude ${token}`);
    }

    const doc = readRel('components/PrintDocument.tsx');
    assert.match(doc, /\.print-modal-overlay/);
    assert.match(doc, /visibility:\s*visible\s*!important/);
});

test('custodies, fixed-assets, and website pages have valid print styles without orphan selectors', () => {
    const custCss = readRel('app/custodies/custodies.module.css');
    assert.doesNotMatch(custCss, /\.printContainer/);

    const custPage = readRel('app/custodies/page.tsx');
    assert.match(custPage, /custody-settlement-modal/);
    assert.match(custPage, /custody-print-area/);

    const assetsCss = readRel('app/fixed-assets/assets.module.css');
    assert.doesNotMatch(assetsCss, /\.printContainer/);

    const websitePage = readRel('app/website/page.tsx');
    assert.match(websitePage, /body:has\(#printable-a4-sheet\)/);
});

test('print modals use clean display isolation, static flow in @media print, and scoped screen overflow', () => {
    const modalFiles = [
        'app/statement/StatementPrintModal.tsx',
        'app/materials/MaterialReceiptPrintModal.tsx',
        'app/expenses/ExpensePrintModal.tsx',
        'app/invoices/InvoicePrintModal.tsx',
        'app/PaymentVouchers/PaymentPrintModal.tsx',
        'app/subclaims/PrintClaimModal.tsx',
    ];
    for (const relPath of modalFiles) {
        const src = readRel(relPath);
        const mediaPrintIdx = src.indexOf('@media print');
        assert.ok(mediaPrintIdx !== -1, `${relPath} must define @media print`);
        const beforeMediaPrint = src.slice(0, mediaPrintIdx);
        assert.doesNotMatch(
            beforeMediaPrint,
            /(?<!@media screen\s*\{\s*)body\s*\{\s*overflow:\s*hidden\s*!important;\s*\}/s,
            `${relPath} must not set unscoped body { overflow: hidden !important; } outside @media screen`,
        );

        const afterMediaPrint = src.slice(mediaPrintIdx);
        assert.doesNotMatch(afterMediaPrint, /height:\s*297mm\s*!important/i, `${relPath} must not clamp height to 297mm in print`);
        assert.doesNotMatch(afterMediaPrint, /height:\s*100%\s*!important/i, `${relPath} must not clamp container height to 100% in print`);
    }

    const statement = readRel('app/statement/StatementPrintModal.tsx');
    const styleStart = statement.indexOf('<style>{`');
    const styleEnd = statement.indexOf('`}</style>', styleStart);
    const cssText = statement.slice(styleStart + 9, styleEnd);
    const openBraces = (cssText.match(/\{/g) || []).length;
    const closeBraces = (cssText.match(/\}/g) || []).length;
    assert.equal(openBraces, closeBraces, 'StatementPrintModal CSS braces must be balanced');
});
