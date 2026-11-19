"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/helpers';
import { currencyCode, currencyName } from '@/lib/currency';
import { printWithDocumentTitle } from '@/lib/printWithTitle';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import ReportContactFooter from '@/components/ReportContactFooter';
import { DocNote, DocSection, DocSignatures, DocStats, DocTotals, PHI_DOC_CSS } from '@/components/PrintDocument';
import { CheckSquare, Printer, Square, X } from 'lucide-react';

interface AllProjectsPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: any;
  selectedProjectId?: string;
  dateRange?: { start: string; end: string };
}

export default function AllProjectsPrintModal({
  isOpen,
  onClose,
  reportData,
  selectedProjectId = 'all',
  dateRange,
}: AllProjectsPrintModalProps) {
  const [mounted, setMounted] = useState(false);
  const [sections, setSections] = useState({
    kpis: true,
    projectsMatrix: true,
    projectDetails: true,
    workersAndContractors: true,
    vouchers: true,
    expenses: true,
    signatures: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || !reportData || !reportData.totals) return null;

  const d = reportData;
  const t = d.totals;

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedProjectObj =
    selectedProjectId && selectedProjectId !== 'all'
      ? (d.projectsList || []).find((p: any) => p.id === selectedProjectId)
      : null;

  const scopeLabel = selectedProjectObj
    ? `${selectedProjectObj.Property || selectedProjectObj.project_name}`
    : `جميع المشاريع والفلل (${d.projectsMatrix.length} مشاريع)`;

  const periodLabel =
    dateRange?.start || dateRange?.end
      ? `من ${dateRange?.start || 'البداية'} إلى ${dateRange?.end || 'اليوم'}`
      : 'تراكمي شامل حتى تاريخه';

  const issueDateStr = new Date().toLocaleDateString('en-GB');
  const totalArea = d.projectsMatrix.reduce((s: number, p: any) => s + (Number(p.unit_area) || 0), 0);
  const totalLaborDays = d.projectsMatrix.reduce((s: number, p: any) => s + (Number(p.labor_days) || 0), 0);

  const handlePrintNow = () => {
    printWithDocumentTitle({
      docType: 'التقرير_المالي_الشامل_للمشاريع_والحسابات',
      prefix: 'MASTER-FIN',
      subject: selectedProjectObj ? selectedProjectObj.Property : 'جميع_المشاريع',
      seedParts: [d.projectsMatrix.length, t.totalContractValue],
    });
  };

  return createPortal(
    <div
      className="print-modal-overlay"
      onClick={onClose}
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'block',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        padding: '16px 14px 48px',
        direction: 'rtl',
      }}
    >
      {/* شريط التحكم العلوي في المعاينة (ثابت بالأعلى أثناء النزول بالماوس ولا يظهر في الطباعة) */}
      <div
        className="no-print"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          width: '100%',
          maxWidth: '277mm',
          margin: '0 auto 14px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '14px',
          padding: '12px 16px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          color: '#0f172a',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
              معاينة الطباعة الرسمية — التقرير المالي الشامل للمشاريع والحسابات (A4 Landscape)
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#64748b', fontWeight: 700 }}>
              منسق بالكامل داخل إطار الورقة الرسمية A4 مع ترويسة وباركود وتوقيعات فاي تك المعتمدة
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handlePrintNow}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '10px',
                border: 'none',
                background: '#ea580c',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
              }}
            >
              <Printer size={16} />
              <span>طباعة / حفظ PDF الآن</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              <X size={15} />
              <span>إغلاق</span>
            </button>
          </div>
        </div>

        {/* خيارات إظهار/إخفاء أقسام التقرير المطبوع */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            paddingTop: '8px',
            borderTop: '1px dashed #e2e8f0',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#475569', marginLeft: '4px' }}>أقسام الطباعة:</span>
          {[
            { key: 'kpis', label: 'المؤشرات المالية' },
            { key: 'projectsMatrix', label: 'مصفوفة المشاريع (الفلل)' },
            { key: 'projectDetails', label: 'تفصيل حركات الفلل' },
            { key: 'workersAndContractors', label: 'العمالة والمقاولين' },
            { key: 'vouchers', label: 'سندات القبض والصرف' },
            { key: 'expenses', label: 'المصاريف وتوزيعها (ABC)' },
            { key: 'signatures', label: 'التوقيعات والاعتماد' },
          ].map((item) => {
            const active = sections[item.key as keyof typeof sections];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleSection(item.key as keyof typeof sections)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${active ? '#ea580c' : '#cbd5e1'}`,
                  background: active ? '#fff7ed' : '#f8fafc',
                  color: active ? '#c2410c' : '#64748b',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {active ? <CheckSquare size={13} /> : <Square size={13} />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <style>{PHI_DOC_CSS}</style>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 10mm;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            background-image: none !important;
            color: #0f172a !important;
            overflow: visible !important;
          }
          body > *:not(.print-modal-overlay) {
            display: none !important;
          }
          .no-print {
            display: none !important;
          }
          .print-modal-overlay {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            display: block !important;
            overflow: visible !important;
            visibility: visible !important;
          }
          #printable-all-projects-report {
            position: static !important;
            display: block !important;
            max-width: 100% !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
            overflow: visible !important;
            visibility: visible !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          #printable-all-projects-report * {
            visibility: visible !important;
            border: 0 !important;
            border-top: 0 !important;
            border-bottom: 0 !important;
            border-left: 0 !important;
            border-right: 0 !important;
            outline: 0 !important;
          }
          #printable-all-projects-report table {
            border-collapse: separate !important;
            border-spacing: 0 !important;
          }
        }
      `}</style>

      {/* 📄 الورقة الرسمية المطبوعة (محكمة داخل إطار A4 Landscape وقابلة للتمرير الكامل بالماوس) */}
      <div
        id="printable-all-projects-report"
        className="print-page phi-doc"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '277mm',
          height: 'auto',
          minHeight: 'fit-content',
          maxHeight: 'none',
          margin: '0 auto',
          background: '#ffffff',
          color: '#0f172a',
          padding: '10mm 11mm',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
          boxSizing: 'border-box',
          overflow: 'visible',
          direction: 'rtl',
        }}
      >
        <style>{`
          #printable-all-projects-report {
            font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif !important;
            color: #0f172a !important;
            background: #ffffff !important;
            width: 100% !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-all-projects-report * {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* إزالة جميع الحدود من الترويسة والكونتينرات والبطاقات والاعتماد على تدرج واختلاف الألوان فقط */
          #printable-all-projects-report .phi-orh {
            border: 0 !important;
            border-radius: 14px !important;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
            margin-bottom: 12px !important;
          }
          #printable-all-projects-report .phi-orh-brand,
          #printable-all-projects-report .phi-orh-verify,
          #printable-all-projects-report .phi-orh-qr,
          #printable-all-projects-report .phi-orh-details,
          #printable-all-projects-report .phi-orh-cell,
          #printable-all-projects-report .phi-orh-foot {
            border: 0 !important;
          }
          #printable-all-projects-report .phi-orh-qr {
            background: #ffffff !important;
            border-radius: 10px !important;
            padding: 6px !important;
          }
          #printable-all-projects-report .phi-orh-details {
            background: linear-gradient(270deg, #fff7ed 0%, #f8fafc 50%, #f1f5f9 100%) !important;
            margin: 0 !important;
            gap: 2px !important;
          }
          #printable-all-projects-report .phi-orh-cell {
            background: rgba(255, 255, 255, 0.55) !important;
          }
          #printable-all-projects-report .phi-orh-foot {
            background: linear-gradient(90deg, #0f172a 0%, #1e293b 65%, #334155 100%) !important;
            color: #e2e8f0 !important;
          }
          #printable-all-projects-report .phi-orh-foot b {
            color: #fdba74 !important;
          }

          /* شريط المؤشرات بدون حدود - تدرجات ألوان ناعمة */
          #printable-all-projects-report .phi-doc-stats {
            gap: 8px !important;
            margin: 0 0 12px 0 !important;
          }
          #printable-all-projects-report .phi-doc-stats > div {
            border: 0 !important;
            border-radius: 10px !important;
            background: linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%) !important;
            padding: 8px 10px !important;
          }
          #printable-all-projects-report .phi-doc-stats > div.is-highlight {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%) !important;
          }
          #printable-all-projects-report .phi-doc-stats > div.is-positive {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important;
          }
          #printable-all-projects-report .phi-doc-stats > div.is-warn {
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;
          }
          #printable-all-projects-report .phi-doc-stats > div.is-tax {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important;
          }
          #printable-all-projects-report .phi-doc-stats > div.is-discount {
            background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%) !important;
          }

          /* عناوين الأقسام بدون خطوط - شريط متدرج */
          #printable-all-projects-report .phi-doc-section {
            margin: 12px 0 7px !important;
            padding: 6px 10px !important;
            border-radius: 8px !important;
            background: linear-gradient(270deg, #fff7ed 0%, #f1f5f9 65%, #f8fafc 100%) !important;
          }
          #printable-all-projects-report .phi-doc-section::after {
            display: none !important;
          }

          /* الجداول بدون أي حدود للخانات أو الإطار - تباين وتدرج ألوان فقط */
          #printable-all-projects-report table,
          #printable-all-projects-report .phi-master-table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
            border: 0 !important;
            border-radius: 10px !important;
            overflow: hidden !important;
            margin: 0 0 12px 0 !important;
            background: #ffffff !important;
            font-size: 9.5px !important;
            line-height: 1.35 !important;
          }
          #printable-all-projects-report .phi-master-table thead {
            display: table-header-group !important;
          }
          #printable-all-projects-report .phi-master-table tfoot {
            display: table-footer-group !important;
          }
          #printable-all-projects-report .phi-master-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border: 0 !important;
          }
          #printable-all-projects-report .phi-master-table thead tr {
            background: linear-gradient(90deg, #0f172a 0%, #1e293b 65%, #334155 100%) !important;
          }
          #printable-all-projects-report .phi-master-table thead th {
            background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            font-size: 9.5px !important;
            padding: 7px 4px !important;
            border: 0 !important;
            text-align: center !important;
            vertical-align: middle !important;
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          #printable-all-projects-report .phi-master-table tbody td {
            padding: 6px 4px !important;
            border: 0 !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            font-size: 9.5px !important;
            text-align: center !important;
            vertical-align: middle !important;
            font-variant-numeric: tabular-nums !important;
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          #printable-all-projects-report .phi-master-table tbody tr:nth-child(even) td {
            background: #f1f5f9 !important;
          }
          #printable-all-projects-report .phi-master-table tbody tr:nth-child(odd) td {
            background: #ffffff !important;
          }
          #printable-all-projects-report .phi-master-table tfoot tr {
            background: linear-gradient(90deg, #fff7ed 0%, #ffedd5 55%, #fef3c7 100%) !important;
          }
          #printable-all-projects-report .phi-master-table tfoot td {
            background: linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%) !important;
            color: #0f172a !important;
            font-weight: 900 !important;
            font-size: 9.5px !important;
            padding: 7px 4px !important;
            border: 0 !important;
            text-align: center !important;
            vertical-align: middle !important;
            font-variant-numeric: tabular-nums !important;
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          #printable-all-projects-report .phi-master-table.is-projects-matrix thead th,
          #printable-all-projects-report .phi-master-table.is-projects-matrix tbody td,
          #printable-all-projects-report .phi-master-table.is-projects-matrix tfoot td {
            font-size: 8.3px !important;
            padding: 5px 2.5px !important;
          }
          #printable-all-projects-report .phi-amt {
            white-space: nowrap !important;
            display: inline-block;
          }
          #printable-all-projects-report .phi-master-table th.is-right,
          #printable-all-projects-report .phi-master-table td.is-right {
            text-align: right !important;
            padding-right: 7px !important;
          }

          /* كروت التفاصيل والإجماليات والتوقيعات بدون حدود */
          #printable-all-projects-report .phi-doc-summary {
            display: grid !important;
            grid-template-columns: minmax(0, 1.08fr) minmax(390px, 0.92fr) !important;
            gap: 14px !important;
            align-items: stretch !important;
            margin: 8px 0 10px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          #printable-all-projects-report .phi-doc-summary > .phi-doc-stack {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            gap: 10px !important;
            min-width: 0 !important;
          }
          #printable-all-projects-report .phi-doc-note {
            border: 0 !important;
            border-radius: 10px !important;
            background: linear-gradient(135deg, #fff7ed 0%, #f8fafc 100%) !important;
          }
          #printable-all-projects-report .phi-doc-totals {
            border: 0 !important;
            border-radius: 10px !important;
            background: #f8fafc !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          #printable-all-projects-report .phi-doc-totals > div {
            border: 0 !important;
            padding: 6px 12px !important;
            font-size: 10.5px !important;
            line-height: 1.4 !important;
            align-items: center !important;
            gap: 10px !important;
          }
          #printable-all-projects-report .phi-doc-totals > div:nth-child(even):not(.is-grand) {
            background: #f1f5f9 !important;
          }
          #printable-all-projects-report .phi-doc-totals > div:nth-child(odd):not(.is-grand) {
            background: #ffffff !important;
          }
          #printable-all-projects-report .phi-doc-totals .is-grand {
            background: linear-gradient(90deg, #0f172a 0%, #1e293b 65%, #334155 100%) !important;
            padding: 9px 12px !important;
            font-size: 12px !important;
          }
          #printable-all-projects-report .phi-doc-totals .is-grand b {
            font-size: 13.5px !important;
          }
          #printable-all-projects-report .phi-doc-signs {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-top: 0 !important;
            flex: 1 !important;
            align-items: stretch !important;
          }
          #printable-all-projects-report .phi-doc-sign {
            width: auto !important;
            min-width: 0 !important;
            min-height: 112px !important;
            padding: 10px 8px 9px !important;
            border: 0 !important;
            border-radius: 10px !important;
            background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%) !important;
          }
          #printable-all-projects-report .phi-doc-sign h4 {
            font-size: 10px !important;
          }
          #printable-all-projects-report .phi-doc-sign h4 span {
            font-size: 7.5px !important;
          }
          #printable-all-projects-report .phi-doc-sign-line {
            border-bottom: 0 !important;
            height: 2px !important;
            background: linear-gradient(90deg, transparent 0%, #cbd5e1 25%, #94a3b8 50%, #cbd5e1 75%, transparent 100%) !important;
          }
          #printable-all-projects-report .report-contact-footer {
            border: 0 !important;
            border-radius: 10px !important;
            background: linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%) !important;
            padding: 8px 12px !important;
          }

          #printable-all-projects-report .phi-villa-card-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            width: 100% !important;
          }
          #printable-all-projects-report .phi-vouchers-two-col {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
            width: 100% !important;
            align-items: start !important;
          }
        `}</style>

        {/* 1️⃣ الترويسة الرسمية الموحدة لشركة فاي تك */}
        <ReportOfficialHeader
          title="التقرير المالي الشامل للمشاريع والحسابات (Master Financial Dossier)"
          subtitle="بيان رقابي ومحاسبي معتمد لعقود المشاريع، الموازنات، التكاليف الفعلية، المبلغ المستلم (غير شامل ضمان الأعمال)، وسندات الخزينة"
          refPrefix="MASTER-FIN"
          issueDate={issueDateStr}
          currency={`${currencyName()} (${currencyCode()})`}
          compact
          details={[
            { label: 'نطاق المشاريع المشمولة', value: scopeLabel },
            { label: 'المبلغ المستلم (غير شامل ضمان الأعمال)', value: formatCurrency(t.totalClientNetExRetention), accent: true },
            { label: 'محتجز ضمان الأعمال (10%)', value: formatCurrency(t.totalRetentionAmount) },
            { label: 'صافي السيولة المتبقية بالخزينة', value: formatCurrency(t.netCashTreasury), accent: true },
          ]}
          meta={[
            { label: 'الفترة المالية', value: periodLabel },
            { label: 'سندات القبض والصرف', value: `${d.receiptVouchers.length} قبض / ${d.paymentVouchers.length} صرف` },
          ]}
        />

        {/* 2️⃣ شريط المؤشرات المالية والتدفقات النقدية (6 بطاقات متناسقة بدون حدود وبألوان متدرجة) */}
        {sections.kpis && (
          <DocStats
            items={[
              {
                label: `إجمالي عقود المشاريع (بعد الخامات: ${formatCurrency(t.totalContractAfterMaterials)})`,
                value: formatCurrency(t.totalContractValue),
                highlight: true,
              },
              {
                label: `المبلغ المستلم (بعد الخامات وضمان 10%: ${formatCurrency(t.totalRetentionAmount)})`,
                value: formatCurrency(t.totalClientNetExRetention),
                tone: 'tax',
              },
              {
                label: `الربح المتوقع EAC بدون ضمان (مستهدف الموازنة: ${t.totalTargetProfitBudgetExRetention > 0 ? '+' : ''}${formatCurrency(t.totalTargetProfitBudgetExRetention)})`,
                value: `${t.totalExpectedProfitEacExRetention > 0 ? '+' : ''}${formatCurrency(t.totalExpectedProfitEacExRetention)}`,
                tone: t.totalExpectedProfitEacExRetention >= 0 ? 'positive' : 'discount',
              },
              {
                label: `الربح الفعلي بدون ضمان (شامل: ${formatCurrency(t.totalNetContractMargin)})`,
                value: `${t.totalActualProfitExRetention > 0 ? '+' : ''}${formatCurrency(t.totalActualProfitExRetention)}`,
                tone: t.totalActualProfitExRetention >= 0 ? 'positive' : 'discount',
              },
              {
                label: `معامل الانحراف (CPI) • نسبة الانحراف: ${t.overallVariancePct > 0 ? '+' : ''}${t.overallVariancePct}%`,
                value: t.overallDeviationFactor !== null ? `${t.overallDeviationFactor.toFixed(2)}` : '---',
                tone: (t.overallDeviationFactor ?? 1) >= 1 ? 'positive' : 'warn',
              },
              {
                label: `صافي سيولة الخزينة (قبض ${formatCurrency(t.totalReceiptVouchers)} - صرف ${formatCurrency(t.totalPaymentVouchers)})`,
                value: formatCurrency(t.netCashTreasury),
                tone: t.netCashTreasury >= 0 ? 'positive' : 'discount',
              },
            ]}
          />
        )}

        {/* 3️⃣ القسم الأول: مصفوفة حسابات المشاريع (الفلل) والأرباح المتوقعة والفعلية ومعامل الانحراف */}
        {sections.projectsMatrix && (
          <div>
            <DocSection
              title="1. مصفوفة المشاريع (الفلل): المبلغ المستلم، التكاليف، الربح المتوقع (EAC)، الربح الفعلي، ومعامل الانحراف"
              en="Projects Profit & Variance Matrix"
            />
            <table className="phi-master-table is-projects-matrix">
              <colgroup>
                <col style={{ width: '8.6%' }} />
                <col style={{ width: '6.8%' }} />
                <col style={{ width: '5.8%' }} />
                <col style={{ width: '6.2%' }} />
                <col style={{ width: '7.2%' }} />
                <col style={{ width: '6.6%' }} />
                <col style={{ width: '7.8%' }} />
                <col style={{ width: '7.2%' }} />
                <col style={{ width: '6.8%' }} />
                <col style={{ width: '7.6%' }} />
                <col style={{ width: '7.8%' }} />
                <col style={{ width: '7.4%' }} />
                <col style={{ width: '7.4%' }} />
                <col style={{ width: '6.8%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="is-right">المشروع / النموذج</th>
                  <th>قيمة التعاقد (BOQ)</th>
                  <th>خصم خامات (217)</th>
                  <th>ضمان الأعمال (10%)</th>
                  <th>المبلغ المستلم (بدون ضمان)</th>
                  <th>موازنة التنفيذ</th>
                  <th>عمالة ومقاولين</th>
                  <th>خامات شركة و ABC</th>
                  <th>تكلفة التنفيذ الفعلية</th>
                  <th>الربح المستهدف (الموازنة)</th>
                  <th>الربح المتوقع EAC</th>
                  <th>الربح الفعلي</th>
                  <th>معامل الانحراف (CPI)</th>
                  <th>وفر / عجز الموازنة</th>
                </tr>
              </thead>
              <tbody>
                {d.projectsMatrix.map((p: any) => (
                  <tr key={p.id}>
                    <td className="is-right" style={{ fontWeight: 900 }}>
                      <div>{p.name}</div>
                      <div style={{ fontSize: '7.6px', color: '#475569', fontWeight: 800 }}>
                        {p.unit_type}
                        {p.unit_area > 0 ? ` • ${p.unit_area} م²` : ''}
                      </div>
                    </td>
                    <td style={{ fontWeight: 900 }}>
                      <span className="phi-amt">{formatCurrency(p.contract_value)}</span>
                    </td>
                    <td style={{ color: '#0369a1', fontWeight: 800 }}>
                      <span className="phi-amt">{formatCurrency(p.client_materials_deduction)}</span>
                    </td>
                    <td style={{ color: '#b45309', fontWeight: 800 }}>
                      <div className="phi-amt">{formatCurrency(p.retention_amount)}</div>
                      <div style={{ fontSize: '7.2px', color: '#64748b' }}>({p.retention_percentage}%) بعد الخامات</div>
                    </td>
                    <td style={{ color: '#15803d', fontWeight: 900 }}>
                      <div className="phi-amt">{formatCurrency(p.client_net_ex_retention)}</div>
                      <div style={{ fontSize: '7.2px', color: '#64748b' }}>
                        قبل الضمان: {formatCurrency(p.contract_after_materials)}
                        {p.receipts_total > 0 ? ` • متبقي: ${formatCurrency(p.client_remaining)}` : ''}
                      </div>
                    </td>
                    <td style={{ fontWeight: 800 }}>
                      <div className="phi-amt">{formatCurrency(p.estimated_execution_budget)}</div>
                      {p.estimated_execution_budget !== p.estimated_budget && (
                        <div style={{ fontSize: '7.2px', color: '#64748b' }}>
                          كلية: {formatCurrency(p.estimated_budget)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 800 }}>
                        عمالة: <span className="phi-amt">{formatCurrency(p.labor_total)}</span> ({p.labor_days}ي)
                      </div>
                      <div style={{ fontSize: '7.4px', color: '#475569' }}>
                        مقاول: <span className="phi-amt">{formatCurrency(p.claims_total)}</span>
                      </div>
                    </td>
                    <td>
                      <div>خامات شركة: {formatCurrency(p.company_materials_cost)}</div>
                      <div style={{ fontSize: '7.4px', color: '#475569' }}>ABC: {formatCurrency(p.abc_expenses_total)}</div>
                    </td>
                    <td style={{ fontWeight: 900, color: '#b45309' }}>
                      <span className="phi-amt">{formatCurrency(p.total_actual_cost)}</span>
                    </td>
                    <td style={{ fontWeight: 900, color: p.target_profit_budget_ex_retention >= 0 ? '#15803d' : '#b91c1c' }}>
                      <div className="phi-amt">
                        {p.target_profit_budget_ex_retention > 0 ? '+' : ''}
                        {formatCurrency(p.target_profit_budget_ex_retention)}
                      </div>
                      <div style={{ fontSize: '7.2px', color: '#475569' }}>
                        شامل: {formatCurrency(p.target_profit_budget)} ({p.target_margin_pct}%)
                      </div>
                    </td>
                    <td style={{ fontWeight: 900, color: p.expected_profit_eac_ex_retention >= 0 ? '#15803d' : '#b91c1c' }}>
                      <div className="phi-amt">
                        {p.expected_profit_eac_ex_retention > 0 ? '+' : ''}
                        {formatCurrency(p.expected_profit_eac_ex_retention)}
                      </div>
                      <div style={{ fontSize: '7.2px', color: '#475569' }}>
                        شامل: {formatCurrency(p.expected_profit_eac)} ({p.expected_margin_pct}%)
                      </div>
                    </td>
                    <td style={{ fontWeight: 900, color: p.actual_profit_ex_retention >= 0 ? '#15803d' : '#b91c1c' }}>
                      <div className="phi-amt">
                        {p.actual_profit_ex_retention > 0 ? '+' : ''}
                        {formatCurrency(p.actual_profit_ex_retention)}
                      </div>
                      <div style={{ fontSize: '7.2px', color: '#475569' }}>شامل: {formatCurrency(p.net_contract_margin)}</div>
                    </td>
                    <td
                      style={{
                        fontWeight: 900,
                        color: p.deviation_factor === null ? '#64748b' : p.deviation_factor >= 1 ? '#15803d' : '#b91c1c',
                      }}
                    >
                      <div dir="ltr">{p.deviation_factor !== null ? p.deviation_factor.toFixed(2) : '---'}</div>
                      <div style={{ fontSize: '7.2px', color: p.variance_pct >= 0 ? '#15803d' : '#b91c1c' }}>
                        {p.variance_pct > 0 ? '+' : ''}
                        {p.variance_pct}% • {p.variance_status}
                      </div>
                    </td>
                    <td style={{ fontWeight: 900, color: p.remaining_budget >= 0 ? '#15803d' : '#b91c1c' }}>
                      <span className="phi-amt">
                        {p.remaining_budget > 0 ? '+' : ''}
                        {formatCurrency(p.remaining_budget)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="is-right">
                    الإجمالي العام ({d.projectsMatrix.length} فلل • {totalArea.toFixed(0)} م²)
                  </td>
                  <td>
                    <span className="phi-amt">{formatCurrency(t.totalContractValue)}</span>
                  </td>
                  <td style={{ color: '#0369a1' }}>
                    <span className="phi-amt">{formatCurrency(t.totalClientMaterialsDeduction)}</span>
                  </td>
                  <td style={{ color: '#b45309' }}>
                    <span className="phi-amt">{formatCurrency(t.totalRetentionAmount)}</span>
                  </td>
                  <td style={{ color: '#15803d' }}>
                    <div className="phi-amt">{formatCurrency(t.totalClientNetExRetention)}</div>
                    <div style={{ fontSize: '7.2px', color: '#475569' }}>
                      قبل الضمان: {formatCurrency(t.totalContractAfterMaterials)}
                      {t.totalClientRemaining !== t.totalContractAfterMaterials
                        ? ` • متبقي: ${formatCurrency(t.totalClientRemaining)}`
                        : ''}
                    </div>
                  </td>
                  <td>
                    <span className="phi-amt">{formatCurrency(t.totalEstimatedExecutionBudget)}</span>
                  </td>
                  <td>
                    <div>
                      عمالة: <span className="phi-amt">{formatCurrency(t.totalLaborEarned)}</span> ({totalLaborDays}ي)
                    </div>
                    <div style={{ fontSize: '7.4px', color: '#475569' }}>
                      مقاول: <span className="phi-amt">{formatCurrency(t.totalClaimsNet)}</span>
                    </div>
                  </td>
                  <td>
                    <span className="phi-amt">{formatCurrency(t.totalCompanyMaterials + t.totalExpensesAmount)}</span>
                  </td>
                  <td style={{ color: '#b45309' }}>
                    <span className="phi-amt">{formatCurrency(t.totalActualProjectCosts)}</span>
                  </td>
                  <td style={{ color: t.totalTargetProfitBudgetExRetention >= 0 ? '#15803d' : '#b91c1c' }}>
                    <div className="phi-amt">
                      {t.totalTargetProfitBudgetExRetention > 0 ? '+' : ''}
                      {formatCurrency(t.totalTargetProfitBudgetExRetention)}
                    </div>
                    <div style={{ fontSize: '7.2px', color: '#475569' }}>
                      شامل: {formatCurrency(t.totalTargetProfitBudget)} ({t.totalTargetMarginPct}%)
                    </div>
                  </td>
                  <td style={{ color: t.totalExpectedProfitEacExRetention >= 0 ? '#15803d' : '#b91c1c' }}>
                    <div className="phi-amt">
                      {t.totalExpectedProfitEacExRetention > 0 ? '+' : ''}
                      {formatCurrency(t.totalExpectedProfitEacExRetention)}
                    </div>
                    <div style={{ fontSize: '7.2px', color: '#475569' }}>
                      شامل: {formatCurrency(t.totalExpectedProfitEac)} ({t.totalExpectedMarginPct}%)
                    </div>
                  </td>
                  <td style={{ color: t.totalActualProfitExRetention >= 0 ? '#15803d' : '#b91c1c' }}>
                    <div className="phi-amt">
                      {t.totalActualProfitExRetention > 0 ? '+' : ''}
                      {formatCurrency(t.totalActualProfitExRetention)}
                    </div>
                    <div style={{ fontSize: '7.2px', color: '#475569' }}>شامل: {formatCurrency(t.totalNetContractMargin)}</div>
                  </td>
                  <td style={{ color: (t.overallDeviationFactor ?? 1) >= 1 ? '#15803d' : '#b91c1c' }}>
                    <div dir="ltr">{t.overallDeviationFactor !== null ? t.overallDeviationFactor.toFixed(2) : '---'}</div>
                    <div style={{ fontSize: '7.2px' }}>
                      {t.overallVariancePct > 0 ? '+' : ''}
                      {t.overallVariancePct}%
                    </div>
                  </td>
                  <td style={{ color: t.totalRemainingBudget >= 0 ? '#15803d' : '#b91c1c' }}>
                    <span className="phi-amt">
                      {t.totalRemainingBudget > 0 ? '+' : ''}
                      {formatCurrency(t.totalRemainingBudget)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 3️⃣-ب تفصيل أوامر الشغل والمستخلصات واليوميات والخامات والمصاريف لكل فيلا */}
        {sections.projectDetails && (
          <div>
            <DocSection
              title="1-ب. تفصيل أوامر الشغل والمستخلصات والعمالة والخامات والمصاريف لكل مشروع"
              en="Per-Project Breakdown"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {d.projectsMatrix
                .filter(
                  (p: any) =>
                    p.jobOrders.length > 0 ||
                    p.claims.length > 0 ||
                    p.laborLogs.length > 0 ||
                    p.materialIssues.length > 0 ||
                    p.materialReceipts.length > 0 ||
                    p.expenseAllocations.length > 0
                )
                .map((p: any) => (
                  <div
                    key={`detail-${p.id}`}
                    className="dossier-keep-together"
                    style={{
                      border: 'none',
                      borderRadius: '10px',
                      background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                      padding: '8px 10px',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'linear-gradient(270deg, #fff7ed 0%, #eef2f7 100%)',
                        borderRadius: '7px',
                        padding: '5px 8px',
                        marginBottom: '7px',
                        fontSize: '10px',
                        fontWeight: 900,
                      }}
                    >
                      <span style={{ color: '#0f172a' }}>
                        {p.name} ({p.unit_type} • {p.unit_area} م²)
                      </span>
                      <span style={{ color: '#475569', fontSize: '9px' }}>
                        العقد: <b>{formatCurrency(p.contract_value)}</b> | خصم خامات:{' '}
                        <b style={{ color: '#0369a1' }}>{formatCurrency(p.client_materials_deduction)}</b> | ضمان ({p.retention_percentage}%):{' '}
                        <b style={{ color: '#b45309' }}>{formatCurrency(p.retention_amount)}</b> | المبلغ المستلم:{' '}
                        <b style={{ color: '#15803d' }}>{formatCurrency(p.client_net_ex_retention)}</b> | التكلفة الفعلية:{' '}
                        <b style={{ color: '#b45309' }}>{formatCurrency(p.total_actual_cost)}</b>
                      </span>
                    </div>

                    <div className="phi-villa-card-grid">
                      {/* العمود 1: أوامر الشغل والمستخلصات وسندات الصرف */}
                      <div
                        style={{
                          background: 'linear-gradient(180deg, #ffffff 0%, #fff7ed 100%)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 9px',
                          fontSize: '8.8px',
                          lineHeight: 1.5,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ fontWeight: 900, color: '#c2410c', marginBottom: '4px', fontSize: '9.2px' }}>
                          أوامر الشغل والمستخلصات وسندات الصرف
                        </div>
                        {p.jobOrders.length === 0 && p.claims.length === 0 && p.paymentVouchers.length === 0 ? (
                          <div style={{ color: '#94a3b8' }}>لا توجد أوامر شغل أو مستخلصات</div>
                        ) : (
                          <>
                            {p.jobOrders.map((jo: any) => (
                              <div key={jo.id} style={{ padding: '2px 0' }}>
                                <b>{jo.order_number}</b> ({jo.contractor_name}): {jo.assigned_qty} × {jo.unit_price} ={' '}
                                <b>{formatCurrency(jo.total_value)}</b>
                              </div>
                            ))}
                            {p.claims.map((clm: any) => (
                              <div key={clm.id} style={{ color: '#15803d', padding: '2px 0' }}>
                                • مستخلص <b>{clm.claim_number}</b> ({clm.contractor_name}): <b>{formatCurrency(clm.net_amount)}</b>
                              </div>
                            ))}
                            {p.paymentVouchers.map((pv: any) => (
                              <div key={pv.id} style={{ color: '#b45309', padding: '2px 0' }}>
                                • سند صرف <b>{pv.voucher_number}</b> ({pv.date}): <b>{formatCurrency(pv.amount)}</b>
                              </div>
                            ))}
                          </>
                        )}
                      </div>

                      {/* العمود 2: يوميات العمالة */}
                      <div
                        style={{
                          background: 'linear-gradient(180deg, #ffffff 0%, #ecfdf5 100%)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 9px',
                          fontSize: '8.8px',
                          lineHeight: 1.5,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ fontWeight: 900, color: '#047857', marginBottom: '4px', fontSize: '9.2px' }}>
                          يوميات العمالة ({p.labor_days} يوم • {formatCurrency(p.labor_total)})
                        </div>
                        {p.laborLogs.length === 0 ? (
                          <div style={{ color: '#94a3b8' }}>لا توجد يوميات عمالة مسجلة</div>
                        ) : (
                          p.laborLogs.map((l: any) => (
                            <div key={l.id} style={{ padding: '2px 0' }}>
                              {l.work_date} — <b>{l.worker_name}</b>: <b>{formatCurrency(l.daily_wage)}</b>
                            </div>
                          ))
                        )}
                      </div>

                      {/* العمود 3: الخامات المنصرفة وتفاصيل الأصناف */}
                      <div
                        style={{
                          background: 'linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 9px',
                          fontSize: '8.8px',
                          lineHeight: 1.5,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ fontWeight: 900, color: '#0369a1', marginBottom: '4px', fontSize: '9.2px' }}>
                          الخامات المنصرفة وتفاصيل الأصناف ({formatCurrency(p.materials_cost_effective)})
                        </div>
                        {(p.client_materials_deduction > 0 || p.company_materials_cost > 0) && (
                          <div style={{ fontSize: '7.8px', color: '#475569', marginBottom: '4px' }}>
                            توريد عميل (خصم 217): <b>{formatCurrency(p.client_materials_deduction)}</b> • على حساب الشركة:{' '}
                            <b>{formatCurrency(p.company_materials_cost)}</b>
                          </div>
                        )}
                        {p.materialIssues.length === 0 && p.materialReceipts.length === 0 ? (
                          <div style={{ color: '#94a3b8' }}>لا توجد خامات منصرفة على هذه الفيلا</div>
                        ) : p.materialIssues.length > 0 ? (
                          <>
                            {p.materialIssues.map((iss: any) => (
                              <div key={iss.id} style={{ padding: '2px 0' }}>
                                <div style={{ color: '#0369a1', fontWeight: 800 }}>
                                  إذن صرف <b>{iss.issue_number}</b> ({iss.issue_date} • {iss.issue_type || 'صرف خامات'}):{' '}
                                  <b>{formatCurrency(iss.total_amount)}</b>
                                </div>
                                {(iss.lines || []).map((line: any) => (
                                  <div key={line.id} style={{ paddingRight: '8px', fontSize: '8.3px', color: '#1e293b' }}>
                                    • {line.item_name}: {line.quantity} {line.unit || ''} × {formatCurrency(line.unit_price)} ={' '}
                                    <b>{formatCurrency(line.total_price)}</b>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {p.materialReceipts.length > 0 && (
                              <div style={{ fontSize: '7.6px', color: '#64748b', marginTop: '3px' }}>
                                مرتبط بفاتورة توريد:{' '}
                                {p.materialReceipts
                                  .map((m: any) => `${m.receipt_number} (${m.receipt_type}: ${formatCurrency(m.total_amount)})`)
                                  .join(' ، ')}
                              </div>
                            )}
                          </>
                        ) : (
                          p.materialReceipts.map((m: any) => (
                            <div key={m.id} style={{ padding: '2px 0' }}>
                              <div style={{ color: '#0369a1', fontWeight: 800 }}>
                                فاتورة خامات <b>{m.receipt_number}</b> ({m.receipt_date} • {m.receipt_type}):{' '}
                                <b>{formatCurrency(m.total_amount)}</b>
                              </div>
                              {(m.lines || []).map((line: any) => (
                                <div key={line.id} style={{ paddingRight: '8px', fontSize: '8.3px', color: '#1e293b' }}>
                                  • {line.item_name}: {line.quantity} {line.unit || ''} × {formatCurrency(line.unit_price)} ={' '}
                                  <b>{formatCurrency(line.total_price)}</b>
                                </div>
                              ))}
                            </div>
                          ))
                        )}
                      </div>

                      {/* العمود 3: نصيب الفيلا من المصاريف الموزعة ABC */}
                      <div
                        style={{
                          background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 9px',
                          fontSize: '8.8px',
                          lineHeight: 1.5,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: '4px', fontSize: '9.2px' }}>
                          نصيب الفيلا من المصاريف ({formatCurrency(p.abc_expenses_total)})
                        </div>
                        {p.expenseAllocations.length === 0 ? (
                          <div style={{ color: '#94a3b8' }}>لا توجد مصاريف محملة</div>
                        ) : (
                          p.expenseAllocations.map((a: any) => (
                            <div key={a.id} style={{ padding: '2px 0' }}>
                              {a['تاريخ المصروف الأصلي']} — {a['البيان / الوصف']} ({a['نسبة التحميل (%)']}%):{' '}
                              <b>{formatCurrency(a.allocated_amount)}</b>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 4️⃣ القسم الثاني: حسابات العمالة ومقاولي الباطن والأرصدة المتبقية */}
        {sections.workersAndContractors && (
          <div>
            <DocSection
              title="2. بيان حسابات العمالة ومقاولي الباطن (المستحق • المنصرف • المتبقي)"
              en="Contractors & Labor Balances"
            />
            <table className="phi-master-table">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '23%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="is-right">الاسم / الجهة المستفيدة</th>
                  <th>التصنيف</th>
                  <th>عدد اليوميات / المستخلصات</th>
                  <th className="is-right">توزيع العمل على الفلل</th>
                  <th>إجمالي المستحق</th>
                  <th>المدفوع بسندات صرف</th>
                  <th>الرصيد المتبقي المستحق</th>
                </tr>
              </thead>
              <tbody>
                {d.contractorsSummary.map((c: any) => (
                  <tr key={`p-con-${c.name}`}>
                    <td className="is-right" style={{ fontWeight: 900 }}>{c.name}</td>
                    <td>مقاول باطن</td>
                    <td>{c.claimsCount} مستخلصات</td>
                    <td className="is-right">{c.villas.join(' ، ')}</td>
                    <td style={{ fontWeight: 900 }}>{formatCurrency(c.claimed)}</td>
                    <td style={{ color: '#15803d', fontWeight: 900 }}>{formatCurrency(c.paid)}</td>
                    <td style={{ color: c.remaining > 0 ? '#b91c1c' : '#15803d', fontWeight: 900 }}>
                      {formatCurrency(c.remaining)}
                    </td>
                  </tr>
                ))}
                {d.workersSummary.map((w: any) => (
                  <tr key={`p-wrk-${w.name}`}>
                    <td className="is-right" style={{ fontWeight: 900 }}>{w.name}</td>
                    <td>عمالة يومية</td>
                    <td>{w.days} يومية</td>
                    <td className="is-right">{w.villasText}</td>
                    <td style={{ fontWeight: 900 }}>{formatCurrency(w.earned)}</td>
                    <td style={{ color: '#15803d', fontWeight: 900 }}>{formatCurrency(w.paid)}</td>
                    <td style={{ color: w.remaining > 0 ? '#b91c1c' : '#15803d', fontWeight: 900 }}>
                      {formatCurrency(w.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="is-right">
                    الإجمالي الكلي لمستحقات العمالة ومقاولي الباطن
                  </td>
                  <td>{formatCurrency(t.totalLaborEarned + t.totalClaimsNet)}</td>
                  <td style={{ color: '#15803d' }}>{formatCurrency(t.totalLaborPaid + t.totalClaimsPaid)}</td>
                  <td style={{ color: '#b91c1c' }}>{formatCurrency(t.totalLaborRemaining + t.totalClaimsRemaining)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 5️⃣ القسم الثالث والرابع: سجل سندات القبض وسجل سندات الصرف */}
        {sections.vouchers && (
          <div className="phi-vouchers-two-col">
            <div>
              <DocSection
                title={`3. سجل سندات القبض (${d.receiptVouchers.length} سندات)`}
                en="Receipt Vouchers"
              />
              <table className="phi-master-table">
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>رقم السند</th>
                    <th>التاريخ</th>
                    <th>الجهة / المموّل</th>
                    <th className="is-right">البيان</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {d.receiptVouchers.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 900, color: '#c2410c' }}>{r.receipt_number}</td>
                      <td>{r.date}</td>
                      <td style={{ fontWeight: 800 }}>{r.partner_name}</td>
                      <td className="is-right">{r.notes || '---'}</td>
                      <td style={{ fontWeight: 900, color: '#15803d' }}>{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="is-right">إجمالي سندات القبض الواردة</td>
                    <td style={{ color: '#15803d' }}>{formatCurrency(t.totalReceiptVouchers)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div>
              <DocSection
                title={`4. سجل سندات الصرف (${d.paymentVouchers.length} سنداً)`}
                en="Payment Vouchers"
              />
              <table className="phi-master-table">
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '31%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>رقم السند</th>
                    <th>التاريخ</th>
                    <th>التصنيف</th>
                    <th className="is-right">المستفيد / البيان</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {d.paymentVouchers.map((v: any) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 900, color: '#c2410c' }}>{v.voucher_number}</td>
                      <td>{v.date}</td>
                      <td>{v.category}</td>
                      <td className="is-right">
                        <b>{v.partner_name !== '---' ? v.partner_name : v.projects_label}</b>
                        {v.description ? ` — ${v.description}` : ''}
                      </td>
                      <td style={{ fontWeight: 900, color: '#b91c1c' }}>{formatCurrency(v.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="is-right">إجمالي سندات الصرف المنصرفة</td>
                    <td style={{ color: '#b91c1c' }}>{formatCurrency(t.totalPaymentVouchers)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* 6️⃣ القسم الخامس: سجل المصاريف التشغيلية وتوزيعها على الفلل (ABC) */}
        {sections.expenses && (
          <div>
            <DocSection
              title={`5. سجل المصاريف التشغيلية وتوزيعها الفعلي على المشاريع (${d.expenses.length} مصروفاً)`}
              en="Operating Expenses & ABC Allocation"
            />
            <table className="phi-master-table">
              <colgroup>
                <col style={{ width: '11%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '37%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>التصنيف</th>
                  <th className="is-right">البيان / التفاصيل</th>
                  <th>المبلغ</th>
                  <th className="is-right">التوزيع الفعلي على المشاريع (ABC)</th>
                </tr>
              </thead>
              <tbody>
                {d.expenses.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.exp_date}</td>
                    <td>{e.main_category || 'مصروف عام'}</td>
                    <td className="is-right" style={{ fontWeight: 800 }}>{e.display_description}</td>
                    <td style={{ fontWeight: 900, color: '#c2410c' }}>{formatCurrency(e.net_amount)}</td>
                    <td className="is-right" style={{ color: '#334155' }}>{e.distribution_text}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="is-right">إجمالي المصاريف التشغيلية الموزعة على الفلل</td>
                  <td style={{ color: '#c2410c' }}>{formatCurrency(t.totalExpensesAmount)}</td>
                  <td className="is-right">موزعة بالكامل على مراكز تكلفة المشاريع</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 7️⃣ الملخص الختامي والإقرار المحاسبي + التوقيعات في نفس المساحة */}
        <div className="phi-doc-summary" style={{ marginTop: '8px' }}>
          <div className="phi-doc-stack">
            <DocNote title="إقرار المطابقة المالية والمحاسبية الشاملة">
              تم إعداد هذا التقرير آلياً من واقع السجلات المحاسبية والمقايسات التعاقدية (BOQ) ومستخلصات مقاولي الباطن ويوميات العمالة وفواتير الخامات وسندات الخزينة المعتمدة. تم احتساب صافي المشاريع بالترتيب المحاسبي: قيمة العقد ({formatCurrency(t.totalContractValue)}) ← خصم خامات توريد العميل حساب 217 ({formatCurrency(t.totalClientMaterialsDeduction)}) لمرة واحدة فقط دون تكرار في التكاليف أو العمالة ← صافي العقد بعد الخامات ({formatCurrency(t.totalContractAfterMaterials)}) ← خصم محتجز ضمان الأعمال 10% ({formatCurrency(t.totalRetentionAmount)}) ← المبلغ المستلم غير شامل الضمان ({formatCurrency(t.totalClientNetExRetention)}).
            </DocNote>
            {sections.signatures && (
              <DocSignatures
                slots={[
                  { title: 'المحاسب المالي', en: 'Financial Accountant' },
                  { title: 'مدير إدارة المشروعات', en: 'Projects Manager (PMO)' },
                  { title: 'اعتماد المدير العام', en: 'General Manager Approval' },
                ]}
              />
            )}
          </div>
          <DocTotals
            rows={[
              { label: 'إجمالي عقود المشاريع (BOQ)', value: formatCurrency(t.totalContractValue) },
              { label: '(-) خصم خامات العميل (حساب 217)', value: formatCurrency(t.totalClientMaterialsDeduction), tone: 'warn' },
              { label: '(=) صافي العقود بعد خصم الخامات', value: formatCurrency(t.totalContractAfterMaterials) },
              { label: '(-) محتجز ضمان الأعمال (10% بعد الخامات)', value: formatCurrency(t.totalRetentionAmount), tone: 'warn' },
              { label: '(=) المبلغ المستلم للمشاريع (غير شامل ضمان الأعمال)', value: formatCurrency(t.totalClientNetExRetention), tone: 'tax' },
              {
                label: `الربح المستهدف ضمن الموازنة غير شامل الضمان (شامل: ${formatCurrency(t.totalTargetProfitBudget)} • ${t.totalTargetMarginPct}%)`,
                value: `${t.totalTargetProfitBudgetExRetention > 0 ? '+' : ''}${formatCurrency(t.totalTargetProfitBudgetExRetention)}`,
                tone: t.totalTargetProfitBudgetExRetention >= 0 ? 'positive' : 'discount',
              },
              {
                label: `الربح المتوقع EAC غير شامل الضمان (شامل: ${formatCurrency(t.totalExpectedProfitEac)} • ${t.totalExpectedMarginPct}%)`,
                value: `${t.totalExpectedProfitEacExRetention > 0 ? '+' : ''}${formatCurrency(t.totalExpectedProfitEacExRetention)}`,
                tone: t.totalExpectedProfitEacExRetention >= 0 ? 'positive' : 'discount',
              },
              {
                label: `الربح الفعلي حتى الآن غير شامل الضمان (شامل: ${formatCurrency(t.totalNetContractMargin)})`,
                value: `${t.totalActualProfitExRetention > 0 ? '+' : ''}${formatCurrency(t.totalActualProfitExRetention)}`,
                tone: t.totalActualProfitExRetention >= 0 ? 'positive' : 'discount',
              },
              {
                label: `معامل الانحراف العام (CPI) • نسبة الانحراف عن الموازنة`,
                value: `${t.overallDeviationFactor !== null ? t.overallDeviationFactor.toFixed(2) : '---'} (${t.overallVariancePct > 0 ? '+' : ''}${t.overallVariancePct}%)`,
                tone: (t.overallDeviationFactor ?? 1) >= 1 ? 'positive' : 'discount',
              },
            ]}
            grand={{
              label: 'صافي السيولة المتبقية بالخزينة',
              value: formatCurrency(t.netCashTreasury),
            }}
          />
        </div>

        {/* 9️⃣ الفوتر الرسمي لجهات الاتصال وباركود vCard */}
        <ReportContactFooter layout="minimal" style={{ marginTop: '12px' }} />
      </div>
    </div>,
    document.body
  );
}
