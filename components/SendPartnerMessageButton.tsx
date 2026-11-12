"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Phone,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/CompanyContext';
import { notify } from '@/lib/notify';
import { usePartnerPhones } from '@/lib/usePartnerPhones';
import {
  PartnerCountryCode,
  PartnerOperationMessageInput,
  buildWhatsAppWebUrl,
  formatPartnerOperationMessage,
  formatPhoneForDisplay,
  normalizePartnerPhone,
  resolvePartnerFromList,
} from '@/lib/partnerWhatsApp';

export type PartnerMessageOperationPayload = Omit<
  PartnerOperationMessageInput,
  'partnerName' | 'companyName' | 'currencyLabel'
>;

export interface SendPartnerMessageButtonProps {
  partnerId?: string | null;
  partnerName?: string | null;
  phone?: string | null;
  operation: PartnerMessageOperationPayload;
  variant?: 'icon' | 'compact' | 'button';
  label?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export default function SendPartnerMessageButton({
  partnerId,
  partnerName,
  phone: explicitPhone,
  operation,
  variant = 'icon',
  label = 'إرسال للبارتنر',
  disabled = false,
  className = '',
  style,
  title,
}: SendPartnerMessageButtonProps) {
  const { activeCompany, activeCompanyId } = useCompany();
  const { data: partners = [], isLoading: loadingPartners } = usePartnerPhones();

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{
    kind: 'success' | 'fallback' | 'error';
    text: string;
    fallbackUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultCountry: PartnerCountryCode =
    activeCompany?.country === 'SA' || activeCompany?.currency === 'SAR' ? 'SA' : 'EG';

  const currencyLabel = activeCompany?.currency === 'SAR' ? 'ر.س' : 'ج.م';

  const resolved = useMemo(
    () =>
      resolvePartnerFromList(partners, {
        partnerId,
        partnerName,
        fallbackPhone: explicitPhone ?? null,
      }),
    [partners, partnerId, partnerName, explicitPhone],
  );

  const normalizedPhone = useMemo(
    () => normalizePartnerPhone(resolved.phone, defaultCountry),
    [resolved.phone, defaultCountry],
  );

  const displayPhone = useMemo(
    () => formatPhoneForDisplay(resolved.phone, defaultCountry),
    [resolved.phone, defaultCountry],
  );

  const buildDefaultMessage = () =>
    formatPartnerOperationMessage({
      ...operation,
      partnerName: resolved.partnerName || partnerName || null,
      companyName: activeCompany?.name || null,
      currencyLabel,
    });

  const waWebUrl = useMemo(
    () => buildWhatsAppWebUrl(normalizedPhone, messageText, defaultCountry),
    [normalizedPhone, messageText, defaultCountry],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled) return;
    setMessageText(buildDefaultMessage());
    setSendFeedback(null);
    setIsOpen(true);
  };

  const handleDirectSend = async () => {
    if (!activeCompanyId) {
      notify('لم يتم تحديد الشركة الحالية', 'error');
      return;
    }
    if (!normalizedPhone) {
      notify('لا يوجد رقم هاتف صالح مسجل لهذا البارتنر في صفحة الشركاء', 'warning');
      return;
    }
    const cleanText = messageText.trim();
    if (!cleanText) {
      notify('يرجى كتابة نص الرسالة قبل الإرسال', 'warning');
      return;
    }

    setIsSending(true);
    setSendFeedback(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        notify('انتهت جلسة الدخول، يرجى إعادة تسجيل الدخول', 'error');
        return;
      }

      const res = await fetch('/api/whatsapp/send-partner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          companyId: activeCompanyId,
          partnerId: resolved.partnerId || partnerId || '',
          partnerName: resolved.partnerName || partnerName || '',
          message: cleanText,
          defaultCountry,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (payload?.ok && payload?.mode === 'cloud_api') {
        setSendFeedback({
          kind: 'success',
          text: `تم إرسال الإشعار بنجاح إلى ${payload.partnerName || resolved.partnerName} (${displayPhone}).`,
          fallbackUrl: payload.fallbackUrl || waWebUrl,
        });
        notify(`تم إرسال العملية عبر واتساب إلى ${resolved.partnerName}`, 'success');
      } else if (payload?.mode === 'fallback_web') {
        setSendFeedback({
          kind: 'fallback',
          text:
            payload.error ||
            'تعذر الإرسال الآلي عبر WhatsApp API (قد يكون خارج نافذة الـ 24 ساعة). اضغط "فتح واتساب ويب" للإرسال الفوري.',
          fallbackUrl: payload.fallbackUrl || waWebUrl,
        });
      } else {
        setSendFeedback({
          kind: 'error',
          text: payload?.error || 'تعذر إرسال الرسالة عبر الخادم.',
          fallbackUrl: waWebUrl,
        });
      }
    } catch (err: any) {
      setSendFeedback({
        kind: 'error',
        text: err?.message || 'حدث خطأ أثناء الاتصال بخدمة واتساب.',
        fallbackUrl: waWebUrl,
      });
    } finally {
      setIsSending(false);
    }
  };

  const hasPartnerRef = Boolean(
    (partnerId && String(partnerId).trim()) || (partnerName && String(partnerName).trim()),
  );

  const computedTitle =
    title ||
    (normalizedPhone
      ? `إرسال العملية إلى ${resolved.partnerName} (${displayPhone})`
      : hasPartnerRef
        ? `إرسال للبارتنر (${resolved.partnerName}) — لا يوجد رقم مسجل`
        : 'إرسال تفاصيل العملية إلى البارتنر');

  const triggerStyle: React.CSSProperties =
    variant === 'button'
      ? {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.45rem',
          padding: '0.625rem 1rem',
          borderRadius: '12px',
          border: 'none',
          background: normalizedPhone ? 'rgba(16, 185, 129, 0.14)' : 'var(--surface-sunken)',
          color: normalizedPhone ? '#059669' : 'var(--text-secondary)',
          fontWeight: 800,
          fontSize: 'var(--fs-sm)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: 'var(--shadow-elevation)',
          opacity: disabled ? 0.55 : 1,
          transition: '0.2s ease',
          ...style,
        }
      : variant === 'compact'
        ? {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.32rem 0.6rem',
            borderRadius: '8px',
            border: 'none',
            background: normalizedPhone ? 'rgba(16, 185, 129, 0.13)' : 'var(--surface-sunken)',
            color: normalizedPhone ? '#059669' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: 'var(--fs-xs)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--shadow-sunken)',
            opacity: disabled ? 0.55 : 1,
            transition: '0.2s ease',
            ...style,
          }
        : {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.375rem 0.5rem',
            borderRadius: '8px',
            border: 'none',
            background: normalizedPhone ? 'rgba(16, 185, 129, 0.13)' : 'var(--surface-sunken)',
            color: normalizedPhone ? '#059669' : 'var(--text-muted)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--shadow-sunken)',
            opacity: disabled ? 0.55 : 1,
            transition: '0.2s ease',
            ...style,
          };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        title={computedTitle}
        aria-label={computedTitle}
        className={`no-print ${className}`.trim()}
        style={triggerStyle}
      >
        <MessageCircle size={variant === 'button' ? 16 : 14} aria-hidden="true" />
        {(variant === 'button' || variant === 'compact') && <span>{label}</span>}
      </button>

      {mounted &&
        isOpen &&
        createPortal(
          <div
            className="no-print"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(12, 9, 7, 0.62)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              direction: 'rtl',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '540px',
                background: 'var(--surface-card, #ffffff)',
                color: 'var(--text-primary, #1f2937)',
                borderRadius: '18px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                  background: 'var(--surface-subcard, rgba(0,0,0,0.02))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.14)',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MessageCircle size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 'var(--fs-md)' }}>
                      إرسال تفاصيل العملية للبارتنر
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                      رقم الهاتف مسحوب تلقائياً من ملف الشريك بصفحة البارتنر
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="إغلاق"
                  style={{
                    background: 'var(--surface-sunken)',
                    border: 'none',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '1.15rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {/* Partner Info Card */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    padding: '0.8rem 0.95rem',
                    borderRadius: '12px',
                    background: 'var(--surface-sunken)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      البارتنر / الطرف المرتبط
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <UserCheck size={14} style={{ color: '#059669' }} />
                      <span>{resolved.partnerName || partnerName || 'غير محدد'}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      رقم الواتساب / الجوال
                    </div>
                    <div
                      dir="ltr"
                      style={{
                        fontWeight: 800,
                        fontSize: 'var(--fs-sm)',
                        textAlign: 'right',
                        color: normalizedPhone ? '#059669' : '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '0.35rem',
                      }}
                    >
                      <span>
                        {loadingPartners
                          ? 'جاري الجلب...'
                          : normalizedPhone
                            ? displayPhone
                            : 'لا يوجد رقم مسجل'}
                      </span>
                      <Phone size={14} />
                    </div>
                  </div>
                </div>

                {!loadingPartners && !normalizedPhone && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#b91c1c',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      lineHeight: 1.6,
                    }}
                  >
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      لا يوجد رقم هاتف صالح مسجل في ملف ({resolved.partnerName}) بصفحة البارتنر.{' '}
                      <Link
                        href="/partners"
                        style={{ textDecoration: 'underline', fontWeight: 900, color: 'inherit' }}
                      >
                        افتح صفحة الشركاء لإضافة الرقم
                      </Link>
                    </div>
                  </div>
                )}

                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.35rem',
                    }}
                  >
                    <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary)' }}>
                      نص الرسالة (قابل للتعديل قبل الإرسال):
                    </label>
                    <button
                      type="button"
                      onClick={() => setMessageText(buildDefaultMessage())}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 800,
                        color: 'var(--accent-primary, #f97316)',
                        cursor: 'pointer',
                      }}
                    >
                      إعادة الصياغة التلقائية
                    </button>
                  </div>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={8}
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                      background: 'var(--surface-sunken)',
                      color: 'var(--text-primary)',
                      padding: '0.75rem',
                      fontSize: 'var(--fs-sm)',
                      lineHeight: 1.65,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {sendFeedback && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.55rem',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '12px',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      lineHeight: 1.55,
                      background:
                        sendFeedback.kind === 'success'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : sendFeedback.kind === 'fallback'
                            ? 'rgba(245, 158, 11, 0.14)'
                            : 'rgba(239, 68, 68, 0.12)',
                      color:
                        sendFeedback.kind === 'success'
                          ? '#047857'
                          : sendFeedback.kind === 'fallback'
                            ? '#b45309'
                            : '#b91c1c',
                    }}
                  >
                    {sendFeedback.kind === 'success' ? (
                      <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div>{sendFeedback.text}</div>
                      {sendFeedback.fallbackUrl && sendFeedback.kind !== 'success' && (
                        <a
                          href={sendFeedback.fallbackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            marginTop: '0.45rem',
                            fontWeight: 900,
                            textDecoration: 'underline',
                            color: 'inherit',
                          }}
                        >
                          <ExternalLink size={13} />
                          <span>فتح المحادثة مباشرة في واتساب ويب الآن</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.6rem',
                  padding: '0.9rem 1.25rem',
                  borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                  background: 'var(--surface-subcard, rgba(0,0,0,0.02))',
                }}
              >
                {waWebUrl ? (
                  <a
                    href={waWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.58rem 0.9rem',
                      borderRadius: '10px',
                      background: 'var(--surface-sunken)',
                      color: '#059669',
                      fontWeight: 800,
                      fontSize: 'var(--fs-xs)',
                      textDecoration: 'none',
                      boxShadow: 'var(--shadow-sunken)',
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>فتح في واتساب ويب</span>
                  </a>
                ) : (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                    سجّل رقم الشريك لتفعيل الإرسال
                  </span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    style={{
                      padding: '0.58rem 0.95rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'var(--surface-sunken)',
                      color: 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: 'var(--fs-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    إغلاق
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectSend}
                    disabled={isSending || !normalizedPhone || !messageText.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.6rem 1.1rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: !normalizedPhone ? '#94a3b8' : '#059669',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 'var(--fs-xs)',
                      cursor: isSending || !normalizedPhone ? 'not-allowed' : 'pointer',
                      opacity: isSending || !normalizedPhone ? 0.65 : 1,
                    }}
                  >
                    <Send size={14} />
                    <span>{isSending ? 'جاري الإرسال...' : 'إرسال عبر WhatsApp API'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
