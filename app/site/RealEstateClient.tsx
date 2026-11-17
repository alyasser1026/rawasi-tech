"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CSS } from './site-styles';
import { mergeContent, type SiteContentOverride } from './site-content';
import type { WebsiteProperty } from './store-catalog';
import { CartDrawer, useCustomerCart } from './CartDrawer';
import PublicHeader, { PUBLIC_NAV_ITEMS } from './PublicHeader';
import LoginModal from './LoginModal';
import FloatingContactChat from './FloatingContactChat';
import { rememberVisitorContact } from '@/lib/client-device-info';

export default function RealEstateClient({ content }: { content?: SiteContentOverride }) {
  const { SITE, PROPERTIES, PROMO_BANNER } = mergeContent(content);
  const [loginOpen, setLoginOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedProperty, setSelectedProperty] = useState<WebsiteProperty | null>(null);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState('');

  const cart = useCustomerCart(() => setLoginOpen(true));

  const filteredProps = useMemo(() => {
    if (filterType === 'all') return PROPERTIES;
    return PROPERTIES.filter((p) => p.type === filterType);
  }, [PROPERTIES, filterType]);

  const openPropertyModal = (prop: WebsiteProperty) => {
    setSelectedProperty(prop);
    setSubmittedRef(null);
    setErrMsg('');
    if (cart.user) {
      if (cart.user.fullName && !leadName) setLeadName(cart.user.fullName);
      if (cart.user.phone && !leadPhone) setLeadPhone(cart.user.phone);
    }
  };

  const handlePropertySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;
    if (!leadName.trim() || leadPhone.replace(/\D/g, '').length < 8) {
      setErrMsg('يرجى إدخال الاسم الكامل ورقم الجوال الصحيح للتواصل');
      return;
    }

    setErrMsg('');
    setSubmitting(true);
    try {
      rememberVisitorContact({ name: leadName.trim(), phone: leadPhone.trim() });
      const res = await fetch('/api/website-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'property_inquiry',
          userId: cart.user?.id || null,
          customerName: leadName.trim(),
          customerPhone: leadPhone.trim(),
          customerEmail: cart.user?.email || '',
          notes: leadNotes.trim(),
          property: {
            code: selectedProperty.code,
            title: selectedProperty.title,
            areaSqm: selectedProperty.areaSqm,
            price: selectedProperty.price,
            currency: selectedProperty.currency,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'تعذر تسجيل الطلب حالياً');
      }
      setSubmittedRef(data.refCode || 'PRP-2026');
    } catch (err: any) {
      setErrMsg(err?.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const cleanWa = (SITE.contact.whatsapp || '201558888744').replace(/\D/g, '') || '201558888744';

  return (
    <div className={`pw ${loginOpen ? 'has-modal-blur' : ''}`} dir="rtl">
      <style>{CSS}</style>
      <style>{`
        .re-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }
        .re-card {
          background: #141a23;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 22px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .re-card:hover {
          transform: translateY(-3px);
          border-color: rgba(201, 119, 45, 0.48);
          box-shadow: 0 22px 46px -22px rgba(0, 0, 0, 0.65);
        }
        .re-specs-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin: 12px 0;
        }
        @media (max-width: 900px) {
          .re-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 680px) {
          .re-specs-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      {/* Unified Light Header (matches Homepage Standard) */}
      <PublicHeader
        siteName={SITE.name}
        siteNameEn={SITE.nameEn}
        activeKey="real-estate"
        cartCount={cart.totalCount}
        onOpenCart={() => cart.setCartOpen(true)}
        userName={cart.user?.fullName}
        userEmail={cart.user?.email}
        portalHref={cart.portalHref}
        onOpenLogin={() => (cart.user ? cart.setCartOpen(true) : setLoginOpen(true))}
        onSignOut={cart.signOut}
      />

      {/* Unified Light Hero (matches Homepage Standard) */}
      <section className="pw-unified-hero">
        <div className="pw-wrap">
          {PROMO_BANNER.enabled && (
            <div className="pw-unified-promo">{PROMO_BANNER.text}</div>
          )}

          <nav className="pw-unified-crumb" aria-label="مسار التنقل">
            <Link href="/">الرئيسية</Link>
            <span className="sep">/</span>
            <Link href="/sections/real-estate">قسم العقارات</Link>
            <span className="sep">/</span>
            <span>العروض والوحدات المتاحة</span>
          </nav>

          <div className="pw-head" style={{ marginBottom: '26px' }}>
            <p className="pw-eyebrow">العروض العقارية والوحدات السكنية والتجارية — فاي تك</p>
            <h1>
              امتلك وحدتك السكنية أو التجارية{' '}
              <span style={{ color: 'var(--o)' }}>بتنفيذ وتشطيب هندسي موثّق</span>
            </h1>
            <p>
              شقق تمليك، وحدات دوبلكس، ومعارض تجارية بمواقع استراتيجية وتصميمات معمارية مدروسة، مع إمكانية استلام وحدتك
              كاملة التشطيب والسمارت هوم بأنظمة سداد مرنة.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            <Link
              href="/sections/contracting?view=tower3d"
              className="pw-btn pw-btn-primary"
              style={{ minHeight: '44px', padding: '0 20px', fontSize: '0.9rem' }}
            >
              🏙️ استعرض المجسم المعماري 3D والمساقط للوحدات
            </Link>
            <Link
              href="/sections/real-estate"
              className="pw-btn pw-btn-ghost"
              style={{ minHeight: '44px', padding: '0 18px', fontSize: '0.88rem' }}
            >
              📐 حاسبة المقدم والأقساط
            </Link>
            <Link
              href="/store"
              className="pw-btn pw-btn-ghost"
              style={{ minHeight: '44px', padding: '0 18px', fontSize: '0.88rem' }}
            >
              🛒 متجر مواد التشطيب والسمارت هوم ←
            </Link>
          </div>
        </div>
      </section>

      <main className="pw-wrap" style={{ paddingTop: '28px', paddingBottom: '64px' }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {[
            { id: 'all', label: `جميع الوحدات (${PROPERTIES.length})` },
            { id: 'apartment', label: '🏢 شقق سكنية' },
            { id: 'duplex', label: '🏡 دوبلكس وفيلات' },
            { id: 'commercial', label: '🏪 تجاري وإداري' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              style={{
                padding: '9px 18px',
                borderRadius: '12px',
                border: filterType === tab.id ? '1.5px solid #e08d3c' : '1.5px solid rgba(255, 255, 255, 0.1)',
                background: filterType === tab.id ? 'linear-gradient(135deg, #c9772d, #e08d3c)' : '#141a23',
                color: filterType === tab.id ? '#ffffff' : '#f1f5f9',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Properties Grid / Empty State */}
        {filteredProps.length === 0 ? (
          <div
            style={{
              background: '#141a23',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '38px 24px',
              textAlign: 'center',
              maxWidth: '640px',
              margin: '12px auto',
            }}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🏢</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, marginBottom: '8px', color: '#f8fafc' }}>
              لا توجد وحدات مطابقة حالياً في هذا التصنيف
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '18px', lineHeight: 1.7 }}>
              يتم تحديث قائمة الوحدات المتاحة باستمرار. يمكنك استعراض المجسم المعماري 3D أو التواصل مع مستشار العقارات لمعرفة الطرح القادم.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              <Link href="/sections/contracting?view=tower3d" className="pw-btn pw-btn-primary">
                🏙️ استعرض المجسم المعماري 3D
              </Link>
              <a
                href={`https://wa.me/${cleanWa}?text=${encodeURIComponent('مرحباً فاي تك، أستفسر عن الوحدات العقارية المتاحة والطرح القادم')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pw-btn pw-btn-ghost"
              >
                💬 استفسر عبر واتساب
              </a>
            </div>
          </div>
        ) : (
        <div className="re-grid">
          {filteredProps.map((prop) => {
            const downPaymentVal = prop.downPaymentPct
              ? Math.round((prop.price * prop.downPaymentPct) / 100)
              : null;
            const statusMeta =
              prop.status === 'available'
                ? { label: 'متاحة للحجز', bg: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }
                : prop.status === 'reserved'
                  ? { label: 'محجوزة مبدئياً', bg: 'rgba(245, 158, 11, 0.2)', color: '#fde68a' }
                  : { label: 'تم البيع', bg: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' };

            return (
              <article key={prop.id} className="re-card">
                <div>
                  {/* Image or Architectural Header */}
                  {prop.imageUrl ? (
                    <div style={{ position: 'relative', height: '220px', overflow: 'hidden', background: '#0b0e13' }}>
                      <img
                        src={prop.imageUrl}
                        alt={prop.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: 'rgba(11, 14, 19, 0.85)',
                          backdropFilter: 'blur(6px)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          color: statusMeta.color,
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 900,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '18px 22px',
                        background: 'linear-gradient(135deg, rgba(201, 119, 45, 0.16) 0%, #0d1118 100%)',
                        borderBottom: '1px solid rgba(201, 119, 45, 0.25)',
                        color: '#f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            color: '#f3a85b',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            display: 'block',
                          }}
                        >
                          {prop.code} · {prop.typeLabel}
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>
                          📍 {prop.city} — {prop.location}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {prop.badge && (
                          <span
                            style={{
                              background: '#c9772d',
                              color: '#fff',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 900,
                            }}
                          >
                            {prop.badge}
                          </span>
                        )}
                        <span
                          style={{
                            background: statusMeta.bg,
                            color: statusMeta.color,
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Body */}
                  <div style={{ padding: '20px 22px' }}>
                    <h3 style={{ fontSize: '1.16rem', fontWeight: 900, lineHeight: 1.38, marginBottom: '6px', color: '#f8fafc' }}>
                      {prop.title}
                    </h3>
                    <p style={{ fontSize: '0.86rem', color: '#94a3b8', marginBottom: '12px', lineHeight: 1.55 }}>
                      {prop.subtitle}
                    </p>

                    <div className="re-specs-row">
                      <div style={{ background: '#0d1118', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '8px 10px' }}>
                        <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>المساحة الإجمالية</small>
                        <strong style={{ fontSize: '0.92rem', color: '#f3a85b' }}>{prop.areaSqm} م²</strong>
                      </div>
                      {prop.bedrooms > 0 && (
                        <div style={{ background: '#0d1118', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '8px 10px' }}>
                          <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>التقسيم الداخلي</small>
                          <strong style={{ fontSize: '0.86rem', color: '#f1f5f9' }}>
                            {prop.bedrooms} غرف · {prop.bathrooms} حمام
                          </strong>
                        </div>
                      )}
                      <div style={{ background: '#0d1118', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '8px 10px' }}>
                        <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>الأدوار والاستلام</small>
                        <strong style={{ fontSize: '0.82rem', color: '#f1f5f9' }}>{prop.deliveryLabel}</strong>
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'rgba(201, 119, 45, 0.14)',
                        border: '1px solid rgba(201, 119, 45, 0.34)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: '#fed7aa',
                        marginBottom: '12px',
                      }}
                    >
                      ✨ مستوى التشطيب: {prop.finishingLabel} ({prop.floorLabel})
                    </div>

                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '5px', margin: 0, padding: 0 }}>
                      {prop.features.map((f) => (
                        <li
                          key={f}
                          style={{
                            fontSize: '0.82rem',
                            color: '#cbd5e1',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '7px',
                            fontWeight: 700,
                          }}
                        >
                          <span style={{ color: '#e08d3c', fontWeight: 900 }}>✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer Price & CTA */}
                <div
                  style={{
                    padding: '16px 22px 20px',
                    background: '#0d1118',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      {prop.price > 0 ? (
                        <>
                          {prop.oldPrice && prop.oldPrice > prop.price && (
                            <span style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'line-through', display: 'block' }}>
                              {prop.oldPrice.toLocaleString('en-US')} {prop.currency}
                            </span>
                          )}
                          <strong style={{ fontSize: '1.38rem', fontWeight: 900, color: '#f3a85b' }}>
                            {prop.price.toLocaleString('en-US')} {prop.currency}
                          </strong>
                        </>
                      ) : (
                        <strong style={{ fontSize: '1.12rem', fontWeight: 900, color: '#f3a85b' }}>
                          السعر عند التواصل / عرض مالي
                        </strong>
                      )}
                    </div>

                    {prop.downPaymentPct ? (
                      <div style={{ textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.14)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.35)' }}>
                        مقدم {prop.downPaymentPct}%{downPaymentVal && downPaymentVal > 0 ? ` (${downPaymentVal.toLocaleString('en-US')} ${prop.currency})` : ''}
                        {prop.installmentYears ? ` · تقسيط ${prop.installmentYears} سنوات` : ''}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => openPropertyModal(prop)}
                      disabled={prop.status === 'sold'}
                      style={{
                        flex: 1,
                        padding: '11px 16px',
                        borderRadius: '12px',
                        border: 'none',
                        background:
                          prop.status === 'sold'
                            ? '#334155'
                            : 'linear-gradient(135deg, #c9772d 0%, #e08d3c 100%)',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '0.86rem',
                        cursor: prop.status === 'sold' ? 'not-allowed' : 'pointer',
                      }}
                    >
                      📅 حجز معاينة / طلب عرض مالي
                    </button>

                    <a
                      href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(
                        `مرحباً فاي تك، أستفسر عن الوحدة العقارية (${prop.code} - ${prop.title})`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '11px 14px',
                        borderRadius: '12px',
                        border: '1px solid rgba(52, 211, 153, 0.42)',
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: '#6ee7b7',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      💬 واتساب
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        )}
      </main>

      {/* Property Inquiry / Booking Modal */}
      {selectedProperty && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99985,
            background: 'rgba(9,12,18,0.68)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSelectedProperty(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#141a23',
              color: '#f1f5f9',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '20px',
              padding: '22px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {submittedRef ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '2.5rem' }}>🎉</div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#6ee7b7' }}>
                  تم تسجيل طلب المعاينة والعرض المالي!
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  رقم الطلب: <strong style={{ fontFamily: 'monospace', color: '#f1f5f9' }}>{submittedRef}</strong>
                  <br />
                  تم إشعار الإدارة العقارية والهندسية في فاي تك فوراً، وسيتواصل معك مستشار المبيعات على الرقم{' '}
                  <strong dir="ltr">{leadPhone}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedProperty(null)}
                  style={{
                    padding: '11px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#c9772d',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handlePropertySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc' }}>
                    📅 طلب معاينة / حجز وحدة عقارية
                  </strong>
                  <button
                    type="button"
                    onClick={() => setSelectedProperty(null)}
                    style={{ border: '1px solid rgba(255,255,255,0.12)', background: '#0d1118', color: '#cbd5e1', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontWeight: 800 }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ background: 'rgba(201, 119, 45, 0.14)', border: '1px solid rgba(201, 119, 45, 0.34)', borderRadius: '12px', padding: '10px 12px', fontSize: '0.82rem', color: '#fed7aa' }}>
                  <strong style={{ color: '#f3a85b', display: 'block' }}>{selectedProperty.title}</strong>
                  <span>
                    المساحة: {selectedProperty.areaSqm} م²
                    {selectedProperty.price > 0
                      ? ` · السعر: ${selectedProperty.price.toLocaleString('en-US')} ${selectedProperty.currency}`
                      : ' · طلب عرض مالي ومعاينة'}
                  </span>
                </div>

                <input
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="الاسم الكامل *"
                  required
                  style={{ padding: '11px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', background: '#0d1118', color: '#f1f5f9', fontSize: '16px', fontWeight: 700 }}
                />

                <input
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="رقم الجوال (للتواصل والواتساب) *"
                  dir="ltr"
                  inputMode="tel"
                  required
                  style={{ padding: '11px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', background: '#0d1118', color: '#f1f5f9', fontSize: '16px', fontWeight: 700, textAlign: 'right' }}
                />

                <textarea
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder="ملاحظاتك (مثال: الموعد المناسب للمعاينة أو الاستفسار عن خطة التقسيط والتشطيب)"
                  rows={3}
                  style={{ padding: '11px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', background: '#0d1118', color: '#f1f5f9', fontSize: '16px' }}
                />

                {errMsg && <div style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 700 }}>⚠️ {errMsg}</div>}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #c9772d, #e08d3c)',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: submitting ? 'wait' : 'pointer',
                  }}
                >
                  {submitting ? 'جاري إرسال الطلب...' : '✅ تأكيد طلب المعاينة والعرض المالي'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Unified Footer (matches Homepage Standard) */}
      <footer className="pw-footer">
        <div className="pw-wrap">
          <div className="pw-footer-row">
            <div className="pw-footer-brand">
              <img src="/brand/phitech-mark-light.svg" alt="" />
              <div>
                <strong>{SITE.name}</strong>
                <small>{SITE.tagline}</small>
              </div>
            </div>
            <nav className="pw-footer-nav" aria-label="روابط التذييل">
              {PUBLIC_NAV_ITEMS.map((n) => (
                <Link key={n.href} href={n.href}>{n.label}</Link>
              ))}
            </nav>
            <Link href="/verify" className="pw-footer-link" style={{ color: 'var(--o)', fontWeight: 'bold' }}>
              التحقق من صحة المستندات
            </Link>
            {(cart.portalHref || !cart.user) && (
              <Link href={cart.portalHref || '/login?portal=employee'} className="pw-footer-link">
                🏢 بوابة الموظفين
              </Link>
            )}
          </div>
          <p className="pw-footer-bottom">© {new Date().getFullYear()} {SITE.name} — جميع الحقوق محفوظة</p>
        </div>
      </footer>

      <div className="pw-dock-pad" aria-hidden="true" />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cart.cartOpen}
        onClose={() => cart.setCartOpen(false)}
        user={cart.user}
        portalHref={cart.portalHref}
        onSignOut={cart.signOut}
        items={cart.items}
        totalAmount={cart.totalAmount}
        onUpdateQty={cart.updateQty}
        onToggleInstall={cart.toggleItemInstall}
        onRemoveItem={cart.removeItem}
        onClearCart={cart.clearCart}
        onRequireLogin={() => setLoginOpen(true)}
        whatsappNumber={SITE.contact.whatsapp}
      />

      {/* Floating WhatsApp & Live Chat */}
      <FloatingContactChat
        whatsappNumber={SITE.contact.whatsapp}
        defaultName={cart.user?.fullName || ''}
        defaultPhone={cart.user?.phone || ''}
        contextLabel="معرض عروض العقارات والوحدات"
      />

      {/* Login Modal */}
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
