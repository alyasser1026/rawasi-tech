// components/ReportContactFooter.tsx
"use client";

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Mail, Phone, QrCode } from 'lucide-react';
import { PHI_COMPANY_CONTACTS } from '@/lib/company-contacts';
import { THEME } from '@/lib/theme';

interface ReportContactFooterProps {
  /** حجم كود الـ QR بالبكسل (افتراضي 64) */
  qrSize?: number;
  /** نمط التنسيق: صف أفقي كامل (افتراضي) أو مضغوط للسندات الصغيرة */
  layout?: 'row' | 'compact' | 'minimal';
  /** لون الثيم أو التحديد */
  accentColor?: string;
  /** إضافة نص إضافي اختياري مثل العنوان */
  customAddress?: string;
  /** إخفاء أو إظهار الباركود */
  showQr?: boolean;
  /** ستايل مخصص */
  style?: React.CSSProperties;
  /** كلاس مخصص */
  className?: string;
}

export default function ReportContactFooter({
  qrSize = 64,
  layout = 'row',
  accentColor,
  customAddress,
  showQr = true,
  style,
  className = ''
}: ReportContactFooterProps) {
  const brandColor = accentColor || THEME.primary || '#0f172a';

  if (layout === 'minimal') {
    return (
      <div
        className={`report-contact-footer ${className}`}
        style={{
          borderTop: '1px solid #e2e8f0',
          paddingTop: '8px',
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#475569',
          pageBreakInside: 'avoid',
          ...style
        }}
      >
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>Phi Tech:</span>
          <span style={{ direction: 'ltr', unicodeBidi: 'embed', fontWeight: 700 }}>
            {PHI_COMPANY_CONTACTS.phone1} | {PHI_COMPANY_CONTACTS.phone2}
          </span>
          <span style={{ fontWeight: 700 }}>{PHI_COMPANY_CONTACTS.email}</span>
        </div>
        {showQr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8' }}>جهات الاتصال:</span>
            <QRCodeSVG
              value={PHI_COMPANY_CONTACTS.vCard}
              size={36}
              level="M"
              fgColor="#0f172a"
              bgColor="#ffffff"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`report-contact-footer ${className}`}
      style={{
        marginTop: 'auto',
        paddingTop: '14px',
        borderTop: '2px solid #e2e8f0',
        pageBreakInside: 'avoid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        direction: 'rtl',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        ...style
      }}
    >
      {/* 📞 بيانات الاتصال الرسمية */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 900, color: brandColor, fontSize: '13px' }}>
            Phi Tech للحلول والإنشاءات
          </span>
          {customAddress && (
            <span style={{ color: '#64748b', fontSize: '11px' }}>
              &nbsp;|&nbsp; {customAddress}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', marginTop: '2px' }}>
          {/* الهاتف 1 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Phone size={13} color={brandColor} style={{ flexShrink: 0 }} />
            <a
              href={`tel:${PHI_COMPANY_CONTACTS.phone1}`}
              style={{
                direction: 'ltr',
                unicodeBidi: 'embed',
                fontWeight: 800,
                fontSize: '12px',
                color: '#1e293b',
                textDecoration: 'none'
              }}
            >
              {PHI_COMPANY_CONTACTS.phone1}
            </a>
          </div>

          {/* الهاتف 2 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Phone size={13} color={brandColor} style={{ flexShrink: 0 }} />
            <a
              href={`tel:${PHI_COMPANY_CONTACTS.phone2}`}
              style={{
                direction: 'ltr',
                unicodeBidi: 'embed',
                fontWeight: 800,
                fontSize: '12px',
                color: '#1e293b',
                textDecoration: 'none'
              }}
            >
              {PHI_COMPANY_CONTACTS.phone2}
            </a>
          </div>

          {/* البريد الإلكتروني */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Mail size={13} color={brandColor} style={{ flexShrink: 0 }} />
            <a
              href={`mailto:${PHI_COMPANY_CONTACTS.email}`}
              style={{
                fontWeight: 800,
                fontSize: '12px',
                color: '#1e293b',
                textDecoration: 'none'
              }}
            >
              {PHI_COMPANY_CONTACTS.email}
            </a>
          </div>
        </div>
      </div>

      {/* 📱 باركود جهات الاتصال الذكي (vCard Contact QR) */}
      {showQr && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '6px 10px',
            borderRadius: '10px',
            flexShrink: 0
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>
              جهة الاتصال
            </div>
            <div style={{ fontSize: '8px', color: '#64748b', whiteSpace: 'nowrap' }}>
              امسح بالكاميرا
            </div>
          </div>
          <div
            style={{
              padding: '2px',
              background: 'white',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <QRCodeSVG
              value={PHI_COMPANY_CONTACTS.vCard}
              size={qrSize}
              level="M"
              fgColor="#0f172a"
              bgColor="#ffffff"
            />
          </div>
        </div>
      )}
    </div>
  );
}
