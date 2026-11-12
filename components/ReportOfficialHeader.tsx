'use client';

import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PHI_COMPANY_CONTACTS } from '@/lib/company-contacts';

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
  currency?: string;
  reportRefCode?: string;
  badgeText?: string;
  compact?: boolean;
}

/**
 * Generates deterministic Code-128 style bar widths from a reference string
 * so every printed report has a crisp vector linear barcode alongside the QR code.
 */
function buildLinearBarcodeBars(seed: string): Array<{ x: number; w: number }> {
  const clean = (seed || 'PHITECH-2026').toUpperCase();
  const bars: Array<{ x: number; w: number }> = [];
  let cursor = 0;

  // Start guard pattern
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

  // Stop guard pattern
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
  currency,
  reportRefCode,
  badgeText = 'وثيقة هندسية ومالية معتمدة • OFFICIAL EXECUTIVE DOSSIER',
  compact = false,
}: ReportOfficialHeaderProps) {
  const resolvedDate = issueDate || new Date().toLocaleDateString('en-GB');

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
    const lines = [
      `${PHI_COMPANY_CONTACTS.nameAr} | ${PHI_COMPANY_CONTACTS.nameEn}`,
      `REF: ${resolvedRefCode}`,
      `TITLE: ${title}`,
      safeProjectName ? `PROJECT: ${safeProjectName}${safeProjectCode ? ` (${safeProjectCode})` : ''}` : null,
      safeClientName ? `CLIENT: ${safeClientName}${safeClientPhone ? ` - ${safeClientPhone}` : ''}` : null,
      safeEngineerName ? `ENGINEER: ${safeEngineerName}${safeEngineerPhone ? ` - ${safeEngineerPhone}` : ''}` : null,
      `DATE: ${resolvedDate}`,
      `TEL: ${PHI_COMPANY_CONTACTS.phone1} | ${PHI_COMPANY_CONTACTS.phone2}`,
      `EMAIL: ${PHI_COMPANY_CONTACTS.email}`,
    ].filter(Boolean);
    return lines.join('\n');
  }, [
    resolvedRefCode,
    title,
    safeProjectName,
    safeProjectCode,
    safeClientName,
    safeClientPhone,
    safeEngineerName,
    safeEngineerPhone,
    resolvedDate,
  ]);

  const barcodeBars = useMemo(() => buildLinearBarcodeBars(resolvedRefCode), [resolvedRefCode]);
  const barcodeTotalWidth = useMemo(() => {
    if (barcodeBars.length === 0) return 120;
    const last = barcodeBars[barcodeBars.length - 1];
    return last.x + last.w;
  }, [barcodeBars]);

  const hasClientOrProjectDetails = Boolean(
    safeProjectName ||
      safeProjectCode ||
      safeClientName ||
      safeClientPhone ||
      safeClientAddress ||
      safeClientVat ||
      safeEngineerName ||
      safeContractValue
  );

  return (
    <header
      className="phi-official-report-header dossier-keep-together"
      dir="rtl"
      style={{
        background: '#ffffff',
        color: '#0f172a',
        border: '1.5px solid #cbd5e1',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: compact ? '0.9rem' : '1.15rem',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
      }}
    >
      {/* شريط الهوية السيادي العلوي المزدوج */}
      <div
        style={{
          display: 'flex',
          height: '7px',
          width: '100%',
          background: '#0f172a',
        }}
      >
        <div style={{ width: '68%', background: '#0f172a' }} />
        <div style={{ width: '24%', background: '#ea580c' }} />
        <div style={{ width: '8%', background: '#f59e0b' }} />
      </div>

      {/* المحتوى الرئيسي للترويسة: الشعار الرسمي يميناً، العنوان في المنتصف، الباركود و QR يساراً */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(225px, 1.15fr) minmax(250px, 1.6fr) minmax(215px, 1.05fr)',
          gap: compact ? '0.75rem' : '1rem',
          alignItems: 'center',
          padding: compact ? '0.75rem 1rem' : '0.95rem 1.15rem',
          background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        }}
      >
        {/* القسم الأيمن: الشعار الرسمي المعتمد لفاي تك (مفرّغ) وبيانات التواصل الحقيقية */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '5px',
            borderLeft: '1px dashed #cbd5e1',
            paddingLeft: '0.85rem',
          }}
        >
          {/* الشعار الرسمي مفرّغ (خلفية شفافة) بدون إطار، بمقاس ثابت يناسب الطباعة */}
          <img
            src="/brand/phitech-lockup-color.svg"
            alt="فاي تك PhiTech للمقاولات والتوريدات"
            style={{
              height: compact ? '54px' : '64px',
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              objectPosition: 'right center',
              display: 'block',
              background: 'transparent',
              marginBottom: '2px',
            }}
          />
          <div style={{ fontWeight: 900, fontSize: '12px', color: '#0f172a', lineHeight: 1.35 }}>
            {PHI_COMPANY_CONTACTS.nameAr} ({PHI_COMPANY_CONTACTS.nameEn})
          </div>
          <div style={{ fontWeight: 800, fontSize: '10px', color: '#ea580c', lineHeight: 1.3 }}>
            للمقاولات والتوريدات الهندسية • {PHI_COMPANY_CONTACTS.address}
          </div>
          <div
            dir="ltr"
            style={{
              fontSize: '9.5px',
              fontWeight: 900,
              color: '#334155',
              letterSpacing: '0.2px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            <span>{PHI_COMPANY_CONTACTS.phone1}</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>{PHI_COMPANY_CONTACTS.phone2}</span>
          </div>
          <div
            dir="ltr"
            style={{
              fontSize: '9px',
              fontWeight: 800,
              color: '#64748b',
            }}
          >
            {PHI_COMPANY_CONTACTS.email}
          </div>
        </div>

        {/* القسم الأوسط: شارة الاعتماد وعنوان التقرير */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '6px',
            padding: '0 0.35rem',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '9.5px',
              fontWeight: 900,
              padding: '3px 12px',
              borderRadius: '999px',
              letterSpacing: '0.3px',
            }}
          >
            <span style={{ color: '#fb923c' }}>●</span>
            <span>{badgeText}</span>
          </div>

          <h1
            style={{
              margin: 0,
              color: '#0f172a',
              fontWeight: 900,
              fontSize: compact ? '17px' : '19px',
              lineHeight: 1.3,
            }}
          >
            {title}
          </h1>

          {subtitle && (
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>
              {subtitle}
            </div>
          )}

          {currency && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '10px',
                fontWeight: 800,
                color: '#334155',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '999px',
                padding: '2px 10px',
              }}
            >
              <span>تاريخ الإصدار: <strong dir="ltr" style={{ color: '#0f172a' }}>{resolvedDate}</strong></span>
              <span>•</span>
              <span>العملة المعتمدة: <strong style={{ color: '#c2410c' }}>{currency}</strong></span>
            </div>
          )}
        </div>

        {/* القسم الأيسر: رمز التحقق QR + الباركود الخطي الرسمي + الرقم المرجعي */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            borderRight: '1px dashed #cbd5e1',
            paddingRight: '0.85rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              flex: 1,
            }}
          >
            {/* الباركود الخطي Code-128 SVG */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '4px 6px 2px 6px',
                width: '100%',
                maxWidth: '150px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <svg
                viewBox={`0 0 ${barcodeTotalWidth} 28`}
                style={{ width: '100%', height: '24px', display: 'block' }}
                aria-label={`Barcode ${resolvedRefCode}`}
              >
                <rect x="0" y="0" width={barcodeTotalWidth} height="28" fill="#ffffff" />
                {barcodeBars.map((bar, idx) => (
                  <rect
                    key={idx}
                    x={bar.x}
                    y="1"
                    width={bar.w}
                    height="26"
                    fill="#0f172a"
                  />
                ))}
              </svg>
              <div
                dir="ltr"
                style={{
                  fontSize: '8.5px',
                  fontWeight: 900,
                  color: '#0f172a',
                  letterSpacing: '0.7px',
                  marginTop: '1px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {resolvedRefCode}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: '150px',
                fontSize: '9.5px',
                fontWeight: 800,
                color: '#475569',
              }}
            >
              <span>الإصدار:</span>
              <strong dir="ltr" style={{ color: '#0f172a' }}>
                {resolvedDate}
              </strong>
            </div>
          </div>

          {/* QR Code للتحقق الإلكتروني */}
          <div
            style={{
              background: '#ffffff',
              border: '1.5px solid #0f172a',
              borderRadius: '8px',
              padding: '5px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              flexShrink: 0,
            }}
          >
            <QRCodeSVG
              value={qrVerificationValue}
              size={compact ? 52 : 60}
              level="M"
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
            <span
              style={{
                fontSize: '7.5px',
                fontWeight: 900,
                color: '#0f172a',
                letterSpacing: '0.3px',
              }}
            >
              QR VERIFIED
            </span>
          </div>
        </div>
      </div>

      {/* بطاقة بيانات العميل المالك والمشروع (تظهر تلقائياً عند توفر بيانات العميل أو المشروع) */}
      {hasClientOrProjectDetails && (
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid #cbd5e1',
            padding: '7px 14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '6px 14px',
            fontSize: '10.5px',
            color: '#334155',
          }}
        >
          {safeProjectName && (
            <div>
              <span style={{ color: '#64748b', fontWeight: 800 }}>المشروع / العقار: </span>
              <strong style={{ color: '#0f172a', fontWeight: 900 }}>{safeProjectName}</strong>
              {safeProjectCode && (
                <span style={{ color: '#c2410c', fontWeight: 900, marginRight: '4px' }}>
                  [{safeProjectCode}]
                </span>
              )}
              {safeUnitType && (
                <span style={{ color: '#475569', fontWeight: 800, marginRight: '4px' }}>
                  ({safeUnitType})
                </span>
              )}
            </div>
          )}

          {safeClientName && (
            <div>
              <span style={{ color: '#64748b', fontWeight: 800 }}>العميل المالك: </span>
              <strong style={{ color: '#0f172a', fontWeight: 900 }}>{safeClientName}</strong>
              {safeClientCode && (
                <span style={{ color: '#475569', fontWeight: 800, marginRight: '4px' }}>
                  ({safeClientCode})
                </span>
              )}
            </div>
          )}

          {safeClientPhone && (
            <div>
              <span style={{ color: '#64748b', fontWeight: 800 }}>جوال العميل: </span>
              <strong dir="ltr" style={{ color: '#0f172a', fontWeight: 900 }}>
                {safeClientPhone}
              </strong>
            </div>
          )}

          {safeClientAddress && (
            <div>
              <span style={{ color: '#64748b', fontWeight: 800 }}>عنوان العميل: </span>
              <strong style={{ color: '#0f172a', fontWeight: 900 }}>{safeClientAddress}</strong>
            </div>
          )}

          {(safeClientVat || safeClientId) && (
            <div>
              <span style={{ color: '#64748b', fontWeight: 800 }}>
                {safeClientVat ? 'الرقم الضريبي للعميل: ' : 'هوية العميل: '}
              </span>
              <strong dir="ltr" style={{ color: '#0f172a', fontWeight: 900 }}>
                {safeClientVat || safeClientId}
              </strong>
            </div>
          )}

          {safeContractValue && (
            <div>
              <span style={{ color: '#64748b', fontWeight: 800 }}>قيمة التعاقد: </span>
              <strong style={{ color: '#c2410c', fontWeight: 900 }}>{safeContractValue}</strong>
            </div>
          )}

          {safeEngineerName && (
            <div>
              <span style={{ color: '#64748b', fontWeight: 800 }}>المهندس المشرف: </span>
              <strong style={{ color: '#0f172a', fontWeight: 900 }}>{safeEngineerName}</strong>
              {safeEngineerPhone && (
                <span dir="ltr" style={{ color: '#475569', fontWeight: 800, marginRight: '4px' }}>
                  ({safeEngineerPhone})
                </span>
              )}
            </div>
          )}

          {safeProjectManager && (
            <div>
              <span style={{ color: '#64748b', fontWeight: 800 }}>مدير المشروع: </span>
              <strong style={{ color: '#0f172a', fontWeight: 900 }}>{safeProjectManager}</strong>
            </div>
          )}

          {safeLocation && (
            <div>
              <span style={{ color: '#64748b', fontWeight: 800 }}>موقع المشروع: </span>
              <strong style={{ color: '#0f172a', fontWeight: 900 }}>{safeLocation}</strong>
            </div>
          )}
        </div>
      )}

      {/* شريط سفلي رفيع لتأكيد الموثوقية */}
      <div
        style={{
          background: '#f1f5f9',
          borderTop: '1px solid #cbd5e1',
          padding: '4px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '9.5px',
          fontWeight: 800,
          color: '#475569',
        }}
      >
        <span>
          ● مستند رسمي صادر إلكترونياً من نظام الرقابة الهندسية والمالية الموحد — {PHI_COMPANY_CONTACTS.nameAr}
        </span>
        <span dir="ltr" style={{ color: '#0f172a', fontWeight: 900 }}>
          DOC ID: {resolvedRefCode}
        </span>
      </div>
    </header>
  );
}
