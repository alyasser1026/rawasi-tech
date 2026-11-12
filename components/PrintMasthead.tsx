'use client';

import { memo } from 'react';
import ReportOfficialHeader from './ReportOfficialHeader';

/*
 * ترويسة الطباعة لكل صفحات السيستم (القوائم والتقارير اللي بتتطبع بـ window.print).
 * مخفية على الشاشة، وبتظهر بس في الطباعة أعلى أول صفحة بنفس هوية المستندات الرسمية،
 * ومعاها رقم الصفحة أسفل كل ورقة.
 * الصفحات اللي ليها ترويسة طباعة خاصة بتحط الكلاس "phi-print-own-header" على منطقة الطباعة بتاعتها،
 * وساعتها الترويسة العامة دي بتختفي عشان ما تتكررش.
 */

type Props = { title: string; subtitle?: string };

function PrintMasthead({ title, subtitle }: Props) {
  return (
    <div className="phi-print-masthead" aria-hidden="true">
      <style>{MASTHEAD_CSS}</style>
      <ReportOfficialHeader
        title={title}
        subtitle={subtitle}
        badgeText="تقرير معتمد • OFFICIAL REPORT"
        refLabel="رقم التقرير"
        compact
      />
    </div>
  );
}

export default memo(PrintMasthead);

const MASTHEAD_CSS = `
.phi-print-masthead { display:none; }
@media print {
  @page { margin:12mm 10mm 14mm; @bottom-center { content:"صفحة " counter(page) " من " counter(pages); font-family:'Cairo','Segoe UI',Tahoma,sans-serif; font-size:8.5px; font-weight:700; color:#64748b; } }
  .phi-print-masthead { display:block; margin:0 0 12px; break-inside:avoid; }
  .enterprise-page:has(.phi-print-own-header) .phi-print-masthead,
  body:has(.print-modal-overlay) .phi-print-masthead { display:none !important; }
  .enterprise-page:has(> .phi-print-masthead) > .ent-page-heading { display:none !important; }
  .enterprise-page .ent-table thead, .enterprise-page .rawasi-printable-table thead { display:table-header-group; }
  .enterprise-page .ent-table tr, .enterprise-page .rawasi-printable-table tr { break-inside:avoid; page-break-inside:avoid; }
  .enterprise-page .ent-table thead th, .enterprise-page .rawasi-printable-table thead th {
    background:#0f172a !important; color:#fff !important; font-weight:900 !important;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .enterprise-page .ent-table tbody tr:nth-child(even) td, .enterprise-page .rawasi-printable-table tbody tr:nth-child(even) td {
    background:#f8fafc !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
`;
