'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

/*
 * عناصر موحّدة لكل نماذج الطباعة (السندات، الفواتير، المستخلصات، كشوف الحساب، الأذونات).
 * بتشتغل مع ReportOfficialHeader عشان كل مستند يطلع بنفس الهوية:
 * جدول بنود برأس غامق، صندوق إجماليات، المبلغ كتابةً، وخانات توقيع واعتماد.
 *
 * الاستخدام: حط الكلاس "phi-doc" على ورقة A4، وضيف <style>{PHI_DOC_CSS}</style> مرة واحدة،
 * والجدول ياخد className="phi-doc-table".
 * المقاسات بالـ px عن قصد: الورقة للطباعة على A4 ومش لازم تتأثر بزر حجم الواجهة.
 */

export type DocTone = 'tax' | 'discount' | 'positive' | 'warn' | 'muted';

/** عنوان قسم داخل المستند: «أولًا: بيان الأعمال المنجزة» + سطر إنجليزي صغير. */
export function DocSection({ title, en }: { title: React.ReactNode; en?: string }) {
  return (
    <div className="phi-doc-section">
      <strong>{title}</strong>
      {en && <span dir="ltr">{en}</span>}
    </div>
  );
}

/** المبلغ الإجمالي كتابةً (التفقيط). */
export function DocWords({ text, label = 'المبلغ كتابةً • Amount in words' }: { text: React.ReactNode; label?: string }) {
  return (
    <div className="phi-doc-words">
      <small>{label}</small>
      <p>{text}</p>
    </div>
  );
}

/** ملاحظة أو إقرار (إقرار استلام، شروط الصرف…). */
export function DocNote({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="phi-doc-note">
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

export interface DocTotalRow {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: DocTone;
  hidden?: boolean;
}

/** صندوق الإجماليات: سطور فرعية وبعدها سطر الصافي بخلفية غامقة. */
export function DocTotals({ rows, grand }: { rows: DocTotalRow[]; grand?: { label: React.ReactNode; value: React.ReactNode } }) {
  return (
    <div className="phi-doc-totals">
      {rows.filter(r => !r.hidden).map((r, i) => (
        <div key={i} className={r.tone ? `is-${r.tone}` : undefined}>
          <span>{r.label}</span>
          <b>{r.value}</b>
        </div>
      ))}
      {grand && (
        <div className="is-grand">
          <span>{grand.label}</span>
          <b>{grand.value}</b>
        </div>
      )}
    </div>
  );
}

/** شريط المبلغ الكبير (سند صرف / قبض). */
export function DocAmount({ label, value, tone = 'default' }: { label: React.ReactNode; value: React.ReactNode; tone?: 'default' | 'out' | 'in' }) {
  return (
    <div className={`phi-doc-amount is-${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export interface DocStat {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: DocTone;
  /** خانة مميزة بخلفية غامقة (الرصيد النهائي مثلًا) */
  highlight?: boolean;
}

/** صف مؤشرات (أرصدة، إجماليات، أيام حضور…) فوق جدول الحركات. */
export function DocStats({ items }: { items: DocStat[] }) {
  return (
    <div className="phi-doc-stats" style={{ ['--cols' as string]: String(Math.max(1, Math.min(items.length, 4))) } as React.CSSProperties}>
      {items.map((it, i) => (
        <div key={i} className={[it.tone ? `is-${it.tone}` : '', it.highlight ? 'is-highlight' : ''].filter(Boolean).join(' ') || undefined}>
          <small>{it.label}</small>
          <b>{it.value}</b>
        </div>
      ))}
    </div>
  );
}

export interface DocSignatureSlot {
  title: string;
  en?: string;
  /** اسم صاحب التوقيع (لو معروف) */
  name?: React.ReactNode;
  /** لو موجود، الخانة بتبقى «اعتماد إلكتروني» بكود QR بدل سطر التوقيع */
  qrValue?: string;
  date?: string;
}

/** خانات التوقيع والاعتماد في آخر المستند. */
export function DocSignatures({ slots }: { slots: DocSignatureSlot[] }) {
  return (
    <div className="phi-doc-signs" style={{ ['--cols' as string]: String(Math.max(1, Math.min(slots.length, 4))) } as React.CSSProperties}>
      {slots.map((s, i) => (
        <div key={i} className={`phi-doc-sign${s.qrValue ? ' is-digital' : ''}`}>
          <h4>{s.title}{s.en && <span dir="ltr">{s.en}</span>}</h4>
          {s.qrValue ? (
            <>
              <QRCodeSVG value={s.qrValue} size={52} level="M" bgColor="#ffffff" fgColor="#0f172a" />
              {s.name && <div className="phi-doc-sign-who">{s.name}</div>}
              <div className="phi-doc-sign-meta">معتمد إلكترونيًا{s.date ? <> • <bdi>{s.date}</bdi></> : null}</div>
            </>
          ) : (
            <>
              <div className="phi-doc-sign-line" />
              <div className="phi-doc-sign-meta">{s.name || 'الاسم والتوقيع'}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export const PHI_DOC_CSS = `
.phi-doc { --d-ink:#0f172a; --d-muted:#64748b; --d-line:#e2e8f0; --d-edge:#cbd5e1; --d-soft:#f8fafc; --d-brand:#ea580c; --d-brand-ink:#c2410c;
  color:var(--d-ink); font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.phi-doc, .phi-doc * { box-sizing:border-box; }
.phi-doc > * { flex-shrink:0; }

.phi-doc-section { display:flex; align-items:center; gap:8px; margin:16px 0 8px; break-after:avoid; page-break-after:avoid; }
.phi-doc-section::before { content:''; width:4px; height:15px; border-radius:2px; background:var(--d-brand); flex-shrink:0; }
.phi-doc-section strong { font-size:12.5px; font-weight:900; color:var(--d-ink); white-space:nowrap; }
.phi-doc-section span { font-size:9px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:var(--d-muted); white-space:nowrap; }
.phi-doc-section::after { content:''; flex:1; height:1px; background:var(--d-line); }

.phi-doc .phi-doc-table { width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--d-edge); border-radius:10px; overflow:hidden; margin:0 0 16px; font-size:11.5px; background:#fff; }
.phi-doc .phi-doc-table thead { display:table-header-group; }
.phi-doc .phi-doc-table thead th { background:var(--d-ink); color:#fff; font-weight:900; font-size:10.5px; line-height:1.4; padding:9px 10px; text-align:center; border:0; letter-spacing:.2px; }
.phi-doc .phi-doc-table tbody td { padding:8px 10px; border:0; border-top:1px solid var(--d-line); text-align:center; color:#1e293b; font-weight:700; font-variant-numeric:tabular-nums; vertical-align:middle; background:#fff; }
.phi-doc .phi-doc-table tbody tr:first-child td { border-top:0; }
.phi-doc .phi-doc-table tbody tr:nth-child(even) td { background:var(--d-soft); }
.phi-doc .phi-doc-table tfoot td { background:#f1f5f9; color:var(--d-ink); font-weight:900; border:0; border-top:2px solid var(--d-ink); padding:9px 10px; text-align:center; font-variant-numeric:tabular-nums; }
.phi-doc .phi-doc-table th.is-start, .phi-doc .phi-doc-table td.is-start { text-align:right; }
.phi-doc .phi-doc-table td.is-strong { font-weight:900; color:var(--d-ink); }
.phi-doc .phi-doc-table td.is-muted { color:#94a3b8; }
.phi-doc .phi-doc-table td.balance-cell, .phi-doc .phi-doc-table td.is-nowrap { white-space:nowrap; font-weight:900; }
.phi-doc .phi-doc-table td small { display:block; margin-top:2px; font-size:10px; font-weight:700; color:var(--d-muted); }
.phi-doc .phi-doc-table tr { break-inside:avoid; page-break-inside:avoid; }

.phi-doc-summary { display:grid; grid-template-columns:minmax(0,1fr) 290px; gap:16px; align-items:start; margin:4px 0 16px; break-inside:avoid; page-break-inside:avoid; }
.phi-doc-summary > .phi-doc-stack { display:flex; flex-direction:column; gap:12px; min-width:0; }

.phi-doc-words { background:var(--d-soft); border:1px solid var(--d-line); border-right:4px solid var(--d-brand); border-radius:10px; padding:10px 14px; }
.phi-doc-words small { display:block; font-size:9.5px; font-weight:900; color:var(--d-muted); margin-bottom:3px; }
.phi-doc-words p { margin:0; font-size:12.5px; font-weight:900; line-height:1.75; color:var(--d-ink); }

.phi-doc-note { border:1px dashed var(--d-edge); border-radius:10px; padding:10px 14px; font-size:10.5px; font-weight:700; line-height:1.8; color:#475569; background:#fff; }
.phi-doc-note strong { display:block; margin-bottom:3px; font-size:11.5px; font-weight:900; color:var(--d-ink); }

.phi-doc-totals { border:1px solid var(--d-edge); border-radius:10px; overflow:hidden; background:#fff; }
.phi-doc-totals > div { display:flex; justify-content:space-between; align-items:baseline; gap:12px; padding:7px 14px; font-size:11.5px; font-weight:800; color:#334155; border-bottom:1px solid var(--d-line); }
.phi-doc-totals > div:last-child { border-bottom:0; }
.phi-doc-totals b { font-weight:900; color:var(--d-ink); font-variant-numeric:tabular-nums; white-space:nowrap; }
.phi-doc-totals .is-tax, .phi-doc-totals .is-tax b { color:#0369a1; }
.phi-doc-totals .is-discount, .phi-doc-totals .is-discount b { color:#b91c1c; }
.phi-doc-totals .is-positive, .phi-doc-totals .is-positive b { color:#15803d; }
.phi-doc-totals .is-warn { background:#fffbeb; }
.phi-doc-totals .is-warn, .phi-doc-totals .is-warn b { color:#b45309; }
.phi-doc-totals .is-muted, .phi-doc-totals .is-muted b { color:var(--d-muted); }
.phi-doc-totals .is-grand { background:var(--d-ink); color:#fff; font-size:13.5px; font-weight:900; padding:10px 14px; }
.phi-doc-totals .is-grand b { color:#fdba74; font-size:15px; }

.phi-doc-stats { display:grid; grid-template-columns:repeat(var(--cols,4), minmax(0,1fr)); gap:8px; margin:0 0 10px; break-inside:avoid; }
.phi-doc-stats > div { border:1px solid var(--d-line); border-radius:10px; padding:8px 12px; background:var(--d-soft); display:flex; flex-direction:column; gap:2px; min-width:0; }
.phi-doc-stats small { font-size:9.5px; font-weight:800; color:var(--d-muted); }
.phi-doc-stats b { font-size:13px; font-weight:900; color:var(--d-ink); font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.phi-doc-stats .is-positive b { color:#15803d; }
.phi-doc-stats .is-discount b { color:#b91c1c; }
.phi-doc-stats .is-tax b { color:#0369a1; }
.phi-doc-stats .is-warn b { color:#b45309; }
.phi-doc-stats .is-highlight { background:var(--d-ink); border-color:var(--d-ink); }
.phi-doc-stats .is-highlight small { color:#cbd5e1; }
.phi-doc-stats .is-highlight b { color:#fdba74; }
.phi-doc-stats .is-highlight.is-positive b { color:#86efac; }
.phi-doc-stats .is-highlight.is-discount b { color:#fca5a5; }

.phi-doc-amount { display:flex; align-items:stretch; border:1px solid var(--d-edge); border-radius:12px; overflow:hidden; margin:0 0 14px; background:#fff; break-inside:avoid; }
.phi-doc-amount span { display:flex; align-items:center; padding:12px 18px; background:var(--d-ink); color:#fff; font-size:12.5px; font-weight:900; white-space:nowrap; }
.phi-doc-amount b { flex:1; display:flex; align-items:center; justify-content:flex-end; padding:10px 20px; font-size:24px; font-weight:900; color:var(--d-ink); font-variant-numeric:tabular-nums; }
.phi-doc-amount.is-out b { color:#b91c1c; }
.phi-doc-amount.is-in b { color:#15803d; }

.phi-doc-signs { display:grid; grid-template-columns:repeat(var(--cols,4), minmax(0,1fr)); gap:12px; margin-top:18px; break-inside:avoid; page-break-inside:avoid; }
.phi-doc-sign { border:1px solid var(--d-line); border-radius:10px; padding:9px 12px 8px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:4px; min-height:92px; background:#fff; }
.phi-doc-sign h4 { margin:0; font-size:11px; font-weight:900; color:var(--d-ink); }
.phi-doc-sign h4 span { display:block; margin-top:1px; font-size:8.5px; font-weight:800; letter-spacing:.8px; text-transform:uppercase; color:var(--d-muted); }
.phi-doc-sign-line { margin-top:auto; width:86%; border-bottom:1.5px solid #94a3b8; }
.phi-doc-sign-who { font-size:10.5px; font-weight:900; color:var(--d-brand-ink); }
.phi-doc-sign-meta { font-size:9px; font-weight:800; color:var(--d-muted); }
.phi-doc-sign.is-digital { border-color:#fed7aa; background:#fffaf5; }

/* ورقة المستند: صفحة A4 بهوامش ثابتة، ولو البنود كتير بتكمّل على صفحات تانية بدل ما تتقص. */
@page phi-doc-a4 { size: A4 portrait; margin: 10mm 0; @bottom-center { content:"صفحة " counter(page) " من " counter(pages); font-family:'Cairo','Segoe UI',Tahoma,sans-serif; font-size:8px; font-weight:700; color:#94a3b8; } }
@media print {
  .print-modal-overlay:has(.phi-doc) { background:#fff !important; backdrop-filter:none !important; }
  body:has(> .print-modal-overlay .phi-doc-page) > *:not(.print-modal-overlay) { display:none !important; }
  html:has(.phi-doc-page), html:has(.phi-doc-page) body { width:auto !important; height:auto !important; overflow:visible !important; }
  .print-modal-overlay:has(.phi-doc-page) { position:static !important; inset:auto !important; width:auto !important; height:auto !important; padding:0 !important; margin:0 !important; overflow:visible !important; display:block !important; background:#fff !important; backdrop-filter:none !important; }
  .phi-doc-page { page:phi-doc-a4; box-sizing:border-box !important; position:static !important; width:auto !important; height:auto !important; min-height:276mm !important; margin:0 !important; padding:0 14mm !important; overflow:visible !important; box-shadow:none !important; border:0 !important; border-radius:0 !important; display:flex !important; flex-direction:column !important; break-inside:auto !important; page-break-inside:auto !important; }
}

@media screen and (max-width: 760px) {
  .phi-doc-summary { grid-template-columns:1fr; }
  .phi-doc-signs, .phi-doc-stats { grid-template-columns:repeat(2, minmax(0,1fr)); }
}
`;
