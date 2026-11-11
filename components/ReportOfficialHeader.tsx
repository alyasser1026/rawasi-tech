'use client';

import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface ReportOfficialHeaderProps {
  title: string;
  subtitle?: string;
  projectName?: string;
  clientName?: string;
  engineerName?: string;
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

export default function ReportOfficialHeader({
  title,
  subtitle,
  projectName,
  clientName,
  engineerName,
  contractValueText,
  issueDate,
  currency,
  reportRefCode,
  badgeText = 'وثيقة هندسية ومالية معتمدة • OFFICIAL EXECUTIVE DOSSIER',
  compact = false,
}: ReportOfficialHeaderProps) {
  const resolvedDate = issueDate || new Date().toLocaleDateString('en-GB');

  const resolvedRefCode = useMemo(() => {
    if (reportRefCode) return reportRefCode;
    const dateDigits = resolvedDate.replace(/[^0-9]/g, '').slice(0, 8) || '20261111';
    const projHash = (projectName || title || 'PHI')
      .split('')
      .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 9000 + 1000, 1024);
    return `PHI-REP-${dateDigits}-${projHash}`;
  }, [reportRefCode, resolvedDate, projectName, title]);

  const qrVerificationValue = useMemo(() => {
    const lines = [
      'PHITECH OFFICIAL REPORT | شركة فاي تك للمقاولات والتوريدات',
      `REF: ${resolvedRefCode}`,
      `TITLE: ${title}`,
      projectName ? `PROJECT: ${projectName}` : null,
      clientName ? `CLIENT: ${clientName}` : null,
      `DATE: ${resolvedDate}`,
      'WEB: https://www.phi-tech.org',
      'TEL: +201014561199 / +201113031523',
    ].filter(Boolean);
    return lines.join('\n');
  }, [resolvedRefCode, title, projectName, clientName, resolvedDate]);

  const barcodeBars = useMemo(() => buildLinearBarcodeBars(resolvedRefCode), [resolvedRefCode]);
  const barcodeTotalWidth = useMemo(() => {
    if (barcodeBars.length === 0) return 120;
    const last = barcodeBars[barcodeBars.length - 1];
    return last.x + last.w;
  }, [barcodeBars]);

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

      {/* المحتوى الرئيسي للترويسة: الشعار يميناً، العنوان في المنتصف، الباركود و QR يساراً */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(210px, 1.1fr) minmax(260px, 1.65fr) minmax(215px, 1.05fr)',
          gap: compact ? '0.75rem' : '1rem',
          alignItems: 'center',
          padding: compact ? '0.75rem 1rem' : '0.95rem 1.15rem',
          background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        }}
      >
        {/* القسم الأيمن: الشعار الرسمي والبيانات المؤسسية */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '6px',
            borderLeft: '1px dashed #cbd5e1',
            paddingLeft: '0.85rem',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '4px 10px',
            }}
          >
            <img
              src="/brand/phitech-lockup-color.svg"
              alt="فاي تك PhiTech للمقاولات والتوريدات"
              style={{
                height: compact ? '46px' : '54px',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
          <div style={{ fontWeight: 900, fontSize: '12px', color: '#0f172a', lineHeight: 1.35 }}>
            شركة فاي تك للمقاولات والتوريدات الهندسية
          </div>
          <div style={{ fontWeight: 800, fontSize: '10.5px', color: '#ea580c', lineHeight: 1.3 }}>
            إدارة المشروعات والرقابة المالية • نظام فاي تك الموحد
          </div>
          <div
            dir="ltr"
            style={{
              fontSize: '9.5px',
              fontWeight: 800,
              color: '#475569',
              letterSpacing: '0.2px',
            }}
          >
            www.phi-tech.org • +20 101 456 1199
          </div>
        </div>

        {/* القسم الأوسط: شارة الاعتماد وعنوان التقرير وبيانات المشروع */}
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

          {/* شريط بيانات المشروع المختصر */}
          {(projectName || clientName || engineerName || contractValueText || currency) && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '6px 12px',
                marginTop: '3px',
                padding: '5px 10px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '10.5px',
                fontWeight: 800,
                color: '#334155',
                width: '100%',
              }}
            >
              {projectName && (
                <span>
                  المشروع: <strong style={{ color: '#0f172a' }}>{projectName}</strong>
                </span>
              )}
              {clientName && (
                <span>
                  • المالك: <strong style={{ color: '#0f172a' }}>{clientName}</strong>
                </span>
              )}
              {engineerName && (
                <span>
                  • المهندس: <strong style={{ color: '#0f172a' }}>{engineerName}</strong>
                </span>
              )}
              {contractValueText && (
                <span>
                  • قيمة التعاقد: <strong style={{ color: '#c2410c' }}>{contractValueText}</strong>
                </span>
              )}
              {currency && (
                <span>
                  • العملة: <strong style={{ color: '#0f172a' }}>{currency}</strong>
                </span>
              )}
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
                  fontFamily: 'monospace',
                  color: '#0f172a',
                  letterSpacing: '0.6px',
                  marginTop: '1px',
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
              <span>تاريخ الإصدار:</span>
              <strong dir="ltr" style={{ color: '#0f172a' }}>
                {resolvedDate}
              </strong>
            </div>
          </div>

          {/* QR Code للتحقق الفوري */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: '#ffffff',
              border: '1.5px solid #0f172a',
              borderRadius: '8px',
              padding: '5px',
              flexShrink: 0,
            }}
          >
            <QRCodeSVG
              value={qrVerificationValue}
              size={compact ? 54 : 62}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
            <span
              dir="ltr"
              style={{
                fontSize: '7.5px',
                fontWeight: 900,
                color: '#ea580c',
                marginTop: '2px',
                letterSpacing: '0.4px',
              }}
            >
              SCAN VERIFY
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
