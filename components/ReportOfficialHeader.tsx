'use client';

import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PHI_COMPANY_CONTACTS, type DocumentIssuer } from '@/lib/company-contacts';

/** خانة بيانات في جدول الترويسة: عنوان صغير فوق وقيمة تحت. */
export interface ReportHeaderDetail {
  label: string;
  value?: React.ReactNode;
  /** تاخد عمودين بدل عمود */
  wide?: boolean;
  /** قيمة مالية/مهمة بلون العلامة */
  accent?: boolean;
  /** أرقام وأكواد: اتجاه من الشمال لليمين */
  ltr?: boolean;
}

/** سطر في عمود التحقق تحت الرقم المرجعي (تاريخ الاستحقاق، الحالة…). */
export interface ReportHeaderMeta {
  label: string;
  value?: React.ReactNode;
  ltr?: boolean;
}

export interface ReportOfficialHeaderProps {
  title: string;
  subtitle?: string;
  projectName?: string;
  projectCode?: string;
  unitType?: string;
  locationAddress?: string;
  clientName?: string;
  clientCode?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientVatNumber?: string;
  clientIdNumber?: string;
  engineerName?: string;
  engineerPhone?: string;
  projectManager?: string;
  contractValueText?: string;
  issueDate?: string;
  /** محفوظة للتوافق: العملة مابقتش بتظهر في الترويسة. */
  currency?: string;
  reportRefCode?: string;
  /** محفوظة للتوافق: الشارة مابقتش بتظهر في الترويسة. */
  badgeText?: string;
  compact?: boolean;
  /** خانات إضافية للمستند (رقم السند، المستفيد، طريقة الدفع…) بتتعرض بعد خانات المشروع والعميل. */
  details?: ReportHeaderDetail[];
  /** سطور إضافية تحت تاريخ الإصدار في عمود التحقق. */
  meta?: ReportHeaderMeta[];
  /** عنوان سطر الرقم المرجعي (افتراضي: بدون عنوان، الكود بس). */
  refLabel?: string;
  /** بيانات ضريبية تظهر تحت اسم الشركة (الفاتورة الضريبية بس). من غيرها الترويسة بتعرض فاي تك فقط. */
  issuer?: DocumentIssuer | false;
  /** محتوى QR التحقق بدل المحتوى الافتراضي. */
  qrValue?: string;
  /** عنصر بدل كود التحقق (مثلًا رمز ZATCA في الفاتورة الضريبية). */
  qrNode?: React.ReactNode;
  /** النص تحت الكود (افتراضي: «امسح للتحقق»). */
  qrCaption?: string;
}

/**
 * Generates deterministic Code-128 style bar widths from a reference string
 * so every printed report has a crisp vector linear barcode alongside the QR code.
 */
function buildLinearBarcodeBars(seed: string): Array<{ x: number; w: number }> {
  const clean = (seed || 'PHITECH-2026').toUpperCase();
  const bars: Array<{ x: number; w: number }> = [];
  let cursor = 0;

  const startPattern = [2, 1, 1, 2, 3, 1];
  for (let i = 0; i < startPattern.length; i++) {
    const w = startPattern[i];
    if (i % 2 === 0) bars.push({ x: cursor, w });
    cursor += w;
  }

  for (let idx = 0; idx < clean.length; idx++) {
    const code = clean.charCodeAt(idx);
    const b1 = (code % 3) + 1;
    const s1 = ((code >> 2) % 2) + 1;
    const b2 = ((code >> 3) % 3) + 1;
    const s2 = ((code >> 5) % 2) + 1;
    const b3 = ((code + idx) % 2) + 1;
    const s3 = 1;

    bars.push({ x: cursor, w: b1 });
    cursor += b1 + s1;
    bars.push({ x: cursor, w: b2 });
    cursor += b2 + s2;
    bars.push({ x: cursor, w: b3 });
    cursor += b3 + s3;
  }

  const stopPattern = [2, 3, 1, 1, 2];
  for (let i = 0; i < stopPattern.length; i++) {
    const w = stopPattern[i];
    if (i % 2 === 0) bars.push({ x: cursor, w });
    cursor += w;
  }

  return bars;
}

function cleanValue(val?: string | null): string | undefined {
  if (!val) return undefined;
  const trimmed = String(val).trim();
  if (!trimmed || trimmed === '---' || trimmed === '—' || trimmed === 'غير محدد') return undefined;
  return trimmed;
}

/** «التقرير التنفيذي (Project Executive Dossier)» → عنوان عربي + سطر إنجليزي صغير، عشان العنوان ما يتكسرش في النص. */
function splitTitle(title: string): { ar: string; en?: string } {
  const m = /^(.*?)\s*\(([A-Za-z][^()]*)\)\s*$/.exec(title.trim());
  return m && m[1] ? { ar: m[1].trim(), en: m[2].trim() } : { ar: title };
}

export default function ReportOfficialHeader({
  title,
  subtitle,
  projectName,
  projectCode,
  unitType,
  locationAddress,
  clientName,
  clientCode,
  clientPhone,
  clientAddress,
  clientVatNumber,
  clientIdNumber,
  engineerName,
  engineerPhone,
  projectManager,
  contractValueText,
  issueDate,
  reportRefCode,
  compact = false,
  details: extraDetails,
  meta,
  refLabel,
  issuer,
  qrValue,
  qrNode,
  qrCaption = 'امسح للتحقق',
}: ReportOfficialHeaderProps) {
  // الترويسة باسم فاي تك فقط. البيانات الضريبية بتظهر بس لما المستند يبعتها صراحةً (الفاتورة الضريبية).
  const resolvedIssuer = useMemo<DocumentIssuer | null>(() => (issuer ? issuer : null), [issuer]);
  const issuerName = cleanValue(resolvedIssuer?.nameAr);
  const issuerNameEn = cleanValue(resolvedIssuer?.nameEn);
  const issuerTax = cleanValue(resolvedIssuer?.taxNumber);
  const issuerUnified = cleanValue(resolvedIssuer?.unifiedNumber);
  const issuerAddress = cleanValue(resolvedIssuer?.address);
  const showIssuerName = !!issuerName && issuerName !== PHI_COMPANY_CONTACTS.nameAr;
  const resolvedDate = issueDate || new Date().toLocaleDateString('en-GB');
  const { ar: titleAr, en: titleEn } = splitTitle(title || '');

  const safeProjectName = cleanValue(projectName);
  const safeProjectCode = cleanValue(projectCode);
  const safeUnitType = cleanValue(unitType);
  const safeLocation = cleanValue(locationAddress);
  const safeClientName = cleanValue(clientName);
  const safeClientCode = cleanValue(clientCode);
  const safeClientPhone = cleanValue(clientPhone);
  const safeClientAddress = cleanValue(clientAddress);
  const safeClientVat = cleanValue(clientVatNumber);
  const safeClientId = cleanValue(clientIdNumber);
  const safeEngineerName = cleanValue(engineerName);
  const safeEngineerPhone = cleanValue(engineerPhone);
  const safeProjectManager = cleanValue(projectManager);
  const safeContractValue = cleanValue(contractValueText);

  const resolvedRefCode = useMemo(() => {
    if (reportRefCode) return reportRefCode;
    const dateDigits = resolvedDate.replace(/[^0-9]/g, '').slice(0, 8) || '20261111';
    const projHash = (safeProjectName || title || 'PHI')
      .split('')
      .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 9000 + 1000, 1024);
    return `PHI-REP-${dateDigits}-${projHash}`;
  }, [reportRefCode, resolvedDate, safeProjectName, title]);

  const qrVerificationValue = useMemo(() => {
    if (qrValue) return qrValue;
    const origin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://phi-tech.org';
    return `${origin}/website/verify?doc=${encodeURIComponent(resolvedRefCode)}`;
  }, [qrValue, resolvedRefCode]);

  const barcodeBars = useMemo(() => buildLinearBarcodeBars(resolvedRefCode), [resolvedRefCode]);
  const barcodeTotalWidth = useMemo(() => {
    if (barcodeBars.length === 0) return 120;
    const last = barcodeBars[barcodeBars.length - 1];
    return last.x + last.w;
  }, [barcodeBars]);

  // خانات بيانات المشروع والعميل: كل خانة عنوان صغير فوق وقيمة تحت، بنفس الارتفاع والمحاذاة.
  const details: Array<{ label: string; value: React.ReactNode; wide?: boolean }> = [];
  if (safeProjectName) {
    details.push({
      label: 'المشروع / العقار',
      value: <>{safeProjectName}{safeProjectCode && <span className="phi-orh-tag">{safeProjectCode}</span>}{safeUnitType && <span className="phi-orh-sub"> ({safeUnitType})</span>}</>,
    });
  }
  if (safeClientName) {
    details.push({ label: 'العميل المالك', value: <>{safeClientName}{safeClientCode && <span className="phi-orh-sub"> ({safeClientCode})</span>}</> });
  }
  if (safeClientPhone) details.push({ label: 'جوال العميل', value: <span dir="ltr">{safeClientPhone}</span> });
  if (safeContractValue) details.push({ label: 'قيمة التعاقد', value: <span className="phi-orh-accent">{safeContractValue}</span> });
  if (safeProjectManager) details.push({ label: 'مدير المشروع', value: safeProjectManager });
  if (safeEngineerName) {
    details.push({ label: 'المهندس المشرف', value: <>{safeEngineerName}{safeEngineerPhone && <span className="phi-orh-sub" dir="ltr"> {safeEngineerPhone}</span>}</> });
  }
  if (safeClientVat || safeClientId) {
    details.push({ label: safeClientVat ? 'الرقم الضريبي للعميل' : 'هوية العميل', value: <span dir="ltr">{safeClientVat || safeClientId}</span> });
  }
  if (safeLocation) details.push({ label: 'موقع المشروع', value: safeLocation, wide: true });
  if (safeClientAddress) details.push({ label: 'عنوان العميل', value: safeClientAddress, wide: true });
  for (const d of extraDetails || []) {
    const raw = d.value;
    if (raw === null || raw === undefined || raw === false) continue;
    if (typeof raw === 'string' && !cleanValue(raw)) continue;
    let value: React.ReactNode = raw;
    if (d.ltr) value = <span dir="ltr">{value}</span>;
    if (d.accent) value = <span className="phi-orh-accent">{value}</span>;
    details.push({ label: d.label, value, wide: d.wide });
  }
  const metaRows = (meta || []).filter(m => m.value !== null && m.value !== undefined && !(typeof m.value === 'string' && !cleanValue(m.value)));

  // آخر خانة تكمّل الصف لحد آخره، عشان ما يفضلش جزء فاضي في آخر الجدول (4 أعمدة).
  const cellSpans = details.map(d => (d.wide ? 2 : 1));
  const usedInLastRow = cellSpans.reduce((t, s) => t + s, 0) % 4;
  if (cellSpans.length && usedInLastRow) cellSpans[cellSpans.length - 1] += 4 - usedInLastRow;

  return (
    <header className={`phi-official-report-header phi-orh dossier-keep-together${compact ? ' is-compact' : ''}`} dir="rtl">
      <style>{ORH_CSS}</style>

      <div className="phi-orh-stripe" aria-hidden="true"><span /><span /><span /></div>

      <div className="phi-orh-main">
        {/* الهوية: الشعار مفرّغ + بيانات الشركة */}
        <div className="phi-orh-brand">
          <img src="/brand/phitech-lockup-color.svg" alt="فاي تك PhiTech للمقاولات والتوريدات" className="phi-orh-logo" />
          <div className="phi-orh-company">{PHI_COMPANY_CONTACTS.nameAr}</div>
          <div className="phi-orh-tagline">{PHI_COMPANY_CONTACTS.address}</div>
          {(showIssuerName || issuerTax || issuerUnified || issuerAddress) && (
            <div className="phi-orh-issuer">
              {showIssuerName && <div className="phi-orh-issuer-name">{issuerName}{issuerNameEn && <span dir="ltr">{issuerNameEn}</span>}</div>}
              {(issuerTax || issuerUnified) && (
                <div className="phi-orh-issuer-ids">
                  {issuerTax && <span>الرقم الضريبي <b dir="ltr">{issuerTax}</b></span>}
                  {issuerUnified && <span>الرقم الموحد <b dir="ltr">{issuerUnified}</b></span>}
                </div>
              )}
              {issuerAddress && <div className="phi-orh-issuer-ids"><span>العنوان <b>{issuerAddress}</b></span></div>}
            </div>
          )}
          <div className="phi-orh-contacts" dir="ltr">
            <span>{PHI_COMPANY_CONTACTS.phone1}</span><i>|</i><span>{PHI_COMPANY_CONTACTS.phone2}</span>
          </div>
          <div className="phi-orh-contacts" dir="ltr"><span>{PHI_COMPANY_CONTACTS.email}</span></div>
        </div>

        {/* العنوان */}
        <div className="phi-orh-title">
          <h1>{titleAr}</h1>
          {titleEn && <div className="phi-orh-title-en" dir="ltr">{titleEn}</div>}
          {subtitle && <p>{subtitle}</p>}
        </div>

        {/* التحقق: الباركود + الرقم المرجعي + التاريخ + QR */}
        <div className="phi-orh-verify">
          <div className="phi-orh-ref">
            <svg viewBox={`0 0 ${barcodeTotalWidth} 28`} preserveAspectRatio="none" aria-label={`Barcode ${resolvedRefCode}`}>
              <rect x="0" y="0" width={barcodeTotalWidth} height="28" fill="#ffffff" />
              {barcodeBars.map((bar, idx) => (
                <rect key={idx} x={bar.x} y="1" width={bar.w} height="26" fill="#0f172a" />
              ))}
            </svg>
            {refLabel && <div className="phi-orh-ref-label">{refLabel}</div>}
            <div className="phi-orh-ref-code" dir="ltr">{resolvedRefCode}</div>
            <dl>
              <div><dt>تاريخ الإصدار</dt><dd dir="ltr">{resolvedDate}</dd></div>
              {metaRows.map(m => (
                <div key={m.label}><dt>{m.label}</dt><dd dir={m.ltr ? 'ltr' : undefined}>{m.value}</dd></div>
              ))}
            </dl>
          </div>
          <div className={`phi-orh-qr${qrNode ? ' is-custom' : ''}`}>
            {qrNode || <QRCodeSVG value={qrVerificationValue} size={compact ? 58 : 66} level="M" bgColor="#ffffff" fgColor="#0f172a" />}
            <span>{qrCaption}</span>
          </div>
        </div>
      </div>

      {details.length > 0 && (
        <div className="phi-orh-details">
          {details.map((d, i) => (
            <div key={`${d.label}-${i}`} className="phi-orh-cell" style={cellSpans[i] > 1 ? { gridColumn: `span ${cellSpans[i]}` } : undefined}>
              <span className="phi-orh-label">{d.label}</span>
              <strong className="phi-orh-value">{d.value}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="phi-orh-foot">
        <span>مستند رسمي صادر إلكترونيًا من نظام الرقابة الهندسية والمالية الموحد — {PHI_COMPANY_CONTACTS.nameAr}</span>
        <span dir="ltr">DOC ID: <b>{resolvedRefCode}</b></span>
      </div>
    </header>
  );
}

// مقاسات بالـ px عن قصد: الترويسة للطباعة على A4، ومش لازم تتأثر بزر حجم الواجهة.
const ORH_CSS = `
.phi-orh { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --soft:#f8fafc; --brand:#ea580c; --brand-ink:#c2410c;
  background:#fff; color:var(--ink); border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; margin-bottom:18px; flex-shrink:0;
  break-inside:avoid; page-break-inside:avoid; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-size:11px; line-height:1.5; }
.phi-orh.is-compact { margin-bottom:14px; }
.phi-orh * { box-sizing:border-box; }
.phi-orh-stripe { display:flex; height:6px; }
.phi-orh-stripe span:nth-child(1) { flex:68; background:#0f172a; }
.phi-orh-stripe span:nth-child(2) { flex:24; background:var(--brand); }
.phi-orh-stripe span:nth-child(3) { flex:8; background:#f59e0b; }

.phi-orh-main { display:grid; grid-template-columns: minmax(0,1.15fr) minmax(0,1.2fr) minmax(0,1.05fr); align-items:stretch; }
.phi-orh-main > div { padding:16px 18px; min-width:0; }
.phi-orh.is-compact .phi-orh-main > div { padding:12px 14px; }
.phi-orh-brand { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:4px; border-left:1px solid var(--line); }
.phi-orh-logo { height:74px; width:auto; max-width:100%; object-fit:contain; object-position:center; display:block; background:var(--phi-badge-bg, transparent); /* official light badge: #f7eee2 */ margin:0 auto 6px; }
.phi-orh.is-compact .phi-orh-logo { height:66px; }
.phi-orh.is-compact .phi-orh-contacts { display:none; }
.phi-orh.is-compact .phi-orh-logo { margin-bottom:2px; }
.phi-orh-company { font-weight:900; font-size:12.5px; color:var(--ink); }
.phi-orh-company span { color:var(--muted); font-weight:800; white-space:nowrap; }
.phi-orh-tagline { font-weight:800; font-size:10px; color:var(--brand-ink); }
.phi-orh-contacts { display:flex; flex-wrap:wrap; justify-content:center; gap:4px 6px; font-size:9.5px; font-weight:800; color:#334155; font-variant-numeric:tabular-nums; }
.phi-orh-contacts i { color:#cbd5e1; font-style:normal; }
.phi-orh-issuer { margin-top:4px; padding-top:5px; border-top:1px dashed var(--line); display:flex; flex-direction:column; align-items:center; gap:2px; width:100%; }
.phi-orh-issuer-name { font-weight:900; font-size:10.5px; color:var(--ink); }
.phi-orh-issuer-name span { display:block; font-size:9px; font-weight:800; color:var(--muted); letter-spacing:.2px; }
.phi-orh-issuer-ids { display:flex; flex-wrap:wrap; justify-content:center; gap:2px 10px; font-size:9.5px; font-weight:800; color:var(--muted); }
.phi-orh-issuer-ids b { color:var(--ink); font-weight:900; font-variant-numeric:tabular-nums; }

.phi-orh-title { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:6px; }
.phi-orh-title h1 { margin:2px 0 0; font-size:20px; font-weight:900; line-height:1.35; color:var(--ink); text-wrap:balance; }
.phi-orh.is-compact .phi-orh-title h1 { font-size:17px; }
.phi-orh-title-en { font-size:10px; font-weight:800; letter-spacing:1.4px; text-transform:uppercase; color:var(--muted); }
.phi-orh-title p { margin:0; font-size:11px; font-weight:700; color:#475569; text-wrap:balance; }

.phi-orh-verify { display:flex; align-items:center; justify-content:flex-end; gap:10px; border-right:1px solid var(--line); }
.phi-orh-ref { flex:1; min-width:0; max-width:170px; display:flex; flex-direction:column; align-items:stretch; gap:3px; }
.phi-orh-ref svg { width:100%; height:26px; display:block; }
.phi-orh-ref-label { text-align:center; font-size:9px; font-weight:900; color:var(--muted); }
.phi-orh-ref-code { text-align:center; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:9px; font-weight:800; letter-spacing:.6px; color:var(--ink); }
.phi-orh-ref dl { margin:4px 0 0; padding-top:5px; border-top:1px dashed var(--line); }
.phi-orh-ref dl > div { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:baseline; gap:0 8px; }
.phi-orh-ref dt { color:var(--muted); font-weight:800; font-size:9.5px; white-space:nowrap; }
.phi-orh-ref dd { margin:0; font-weight:900; font-size:10.5px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.phi-orh-qr { display:flex; flex-direction:column; align-items:center; gap:3px; padding:5px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; flex-shrink:0; }
.phi-orh-qr span { font-size:8px; font-weight:900; color:var(--muted); text-align:center; max-width:84px; line-height:1.3; }
.phi-orh-qr.is-custom { border:0; padding:0; background:transparent; }
.phi-orh-qr.is-custom svg, .phi-orh-qr.is-custom canvas, .phi-orh-qr.is-custom img { width:78px !important; height:78px !important; display:block; }

.phi-orh-details { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); border-top:1px solid #cbd5e1; background:var(--soft); margin-left:-1px; margin-bottom:-1px; }
.phi-orh-cell { padding:8px 14px; display:flex; flex-direction:column; gap:2px; min-width:0; border-left:1px solid var(--line); border-bottom:1px solid var(--line); }
.phi-orh-label { color:var(--muted); font-size:9.5px; font-weight:800; }
.phi-orh-value { color:var(--ink); font-size:11.5px; font-weight:900; overflow-wrap:anywhere; }
.phi-orh-tag { display:inline-block; margin-inline-start:6px; padding:0 6px; border-radius:4px; background:#fff7ed; color:var(--brand-ink); font-size:10px; font-weight:900; }
.phi-orh-sub { color:#475569; font-weight:700; font-size:10.5px; }
.phi-orh-accent { color:var(--brand-ink); font-variant-numeric:tabular-nums; }

.phi-orh-foot { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:5px 14px; background:#f1f5f9; border-top:1px solid #cbd5e1; font-size:9.5px; font-weight:700; color:#475569; }
.phi-orh-foot b { color:var(--ink); font-weight:900; }

@media screen and (max-width: 760px) {
  .phi-orh-main { grid-template-columns:1fr; }
  .phi-orh-brand, .phi-orh-verify { border:0; }
  .phi-orh-brand { align-items:center; text-align:center; border-bottom:1px solid var(--line); }
  .phi-orh-logo { object-position:center; }
  .phi-orh-verify { justify-content:center; border-top:1px solid var(--line); }
  .phi-orh-details { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .phi-orh-cell { grid-column:auto !important; }
  .phi-orh-foot { flex-direction:column; align-items:flex-start; }
}
`;
