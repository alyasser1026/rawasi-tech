"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CSS } from './site-styles';
import { mergeContent, type SiteContentOverride } from './site-content';
import type { WebsiteProperty } from './store-catalog';
import { CartButton, CartDrawer, useCustomerCart } from './CartDrawer';
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
        .re-hero {
          background: radial-gradient(900px 440px at 80% 20%, rgba(249,115,22,0.24), transparent 70%), linear-gradient(180deg, #0b0f15 0%, #141a22 100%);
          color: #ffffff;
          padding: 108px 0 44px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .re-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }
        .re-card {
          background: #ffffff;
          border: 1px solid #e3e6e9;
          border-radius: 22px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .re-card:hover {
          transform: translateY(-3px);
          border-color: rgba(234, 88, 12, 0.45);
          box-shadow: 0 22px 44px -24px rgba(20, 28, 34, 0.22);
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
          .re-hero { padding: 84px 0 28px; }
          .re-specs-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      {/* Top Sticky Header */}
      <header className="pw-header is-scrolled">
        <div className="pw-wrap pw-header-row">
          <Link href="/" className="pw-brand" aria-label={`${SITE.name} — الرئيسية`}>
            <img src="/brand/phitech-mark-color.svg" alt="" className="pw-brand-mark" />
            <span className="pw-brand-text">
              <strong>{SITE.name}</strong>
              <small>REAL ESTATE & UNITS</small>
            </span>
          </Link>

          <nav className="pw-nav" aria-label="التنقل الرئيسي">
            <Link href="/">الرئيسية</Link>
            <Link href="/store">🛒 متجر المنتجات</Link>
            <Link href="/real-estate" style={{ color: '#fb923c', fontWeight: 900 }}>
              🏢 عروض العقارات
            </Link>
            <Link href="/#capital-tower">المجسم 3D</Link>
            <Link href="/verify" className="pw-nav-verify">
              التحقق من المستندات
            </Link>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CartButton count={cart.totalCount} onClick={() => cart.setCartOpen(true)} />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="re-hero">
        {PROMO_BANNER.enabled && (
          <div
            style={{
              background: 'linear-gradient(90deg, #9a3412 0%, #ea580c 50%, #c2410c 100%)',
              color: '#fff',
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: '0.84rem',
              fontWeight: 800,
              marginBottom: '22px',
            }}
          >
            <div className="pw-wrap">{PROMO_BANNER.text}</div>
          </div>
        )}
        <div className="pw-wrap">
          <p className="pw-eyebrow" style={{ color: '#fb923c' }}>
            العروض العقارية والوحدات السكنية والتجارية — فاي تك
          </p>
          <h1 style={{ fontSize: 'clamp(1.45rem, 3.2vw, 2.4rem)', fontWeight: 900, lineHeight: 1.32, marginBottom: '12px' }}>
            امتلك وحدتك السكنية أو التجارية <span style={{ color: '#f97316' }}>بتنفيذ وتشطيب هندسي موثّق</span>
          </h1>
          <p style={{ color: '#cbd5e1', maxWidth: '46rem', fontSize: '0.96rem', marginBottom: '20px' }}>
            شقق تمليك، وحدات دوبلكس، ومعارض تجارية بمواقع استراتيجية وتصميمات معمارية مدروسة، مع إمكانية استلام وحدتك
            كاملة التشطيب والسمارت هوم بأنظمة سداد مرنة.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <Link
              href="/#capital-tower"
              className="pw-btn pw-btn-primary"
              style={{ minHeight: '44px', padding: '0 20px', fontSize: '0.9rem' }}
            >
              🏙️ استعرض المجسم المعماري 3D والمساقط للوحدات
            </Link>
            <Link
              href="/store"
              className="pw-btn pw-btn-light"
              style={{ minHeight: '44px', padding: '0 18px', fontSize: '0.88rem' }}
            >
              🛒 تصفح متجر مواد التشطيب والسمارت هوم ←
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
                border: filterType === tab.id ? '1.5px solid #ea580c' : '1.5px solid #e3e6e9',
                background: filterType === tab.id ? '#ea580c' : '#ffffff',
                color: filterType === tab.id ? '#ffffff' : '#14181b',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Properties Grid */}
        <div className="re-grid">
          {filteredProps.map((prop) => {
            const downPaymentVal = prop.downPaymentPct
              ? Math.round((prop.price * prop.downPaymentPct) / 100)
              : null;
            const statusMeta =
              prop.status === 'available'
                ? { label: 'متاحة للحجز', bg: '#dcfce7', color: '#15803d' }
                : prop.status === 'reserved'
                  ? { label: 'محجوزة مبدئياً', bg: '#fef3c7', color: '#b45309' }
                  : { label: 'تم البيع', bg: '#fee2e2', color: '#b91c1c' };

            return (
              <article key={prop.id} className="re-card">
                <div>
                  {/* Image or Architectural Header */}
                  {prop.imageUrl ? (
                    <div style={{ position: 'relative', height: '220px', overflow: 'hidden', background: '#0f172a' }}>
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
                          background: statusMeta.bg,
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
                        background: 'linear-gradient(135deg, #fff7ed 0%, #f8fafc 100%)',
                        borderBottom: '1px solid #fed7aa',
                        color: '#14181b',
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
                            color: '#c75517',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            display: 'block',
                          }}
                        >
                          {prop.code} · {prop.typeLabel}
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: '#334155' }}>
                          📍 {prop.city} — {prop.location}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {prop.badge && (
                          <span
                            style={{
                              background: '#ea580c',
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
                    <h3 style={{ fontSize: '1.16rem', fontWeight: 900, lineHeight: 1.38, marginBottom: '6px' }}>
                      {prop.title}
                    </h3>
                    <p style={{ fontSize: '0.86rem', color: '#47525c', marginBottom: '12px', lineHeight: 1.55 }}>
                      {prop.subtitle}
                    </p>

                    <div className="re-specs-row">
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 10px' }}>
                        <small style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>المساحة الإجمالية</small>
                        <strong style={{ fontSize: '0.92rem', color: '#c75517' }}>{prop.areaSqm} م²</strong>
                      </div>
                      {prop.bedrooms > 0 && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 10px' }}>
                          <small style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>التقسيم الداخلي</small>
                          <strong style={{ fontSize: '0.86rem' }}>
                            {prop.bedrooms} غرف · {prop.bathrooms} حمام
                          </strong>
                        </div>
                      )}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 10px' }}>
                        <small style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>الأدوار والاستلام</small>
                        <strong style={{ fontSize: '0.82rem' }}>{prop.deliveryLabel}</strong>
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#fff3ea',
                        border: '1px solid #fed7aa',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: '#9a3412',
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
                            color: '#334155',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '7px',
                            fontWeight: 700,
                          }}
                        >
                          <span style={{ color: '#ea580c', fontWeight: 900 }}>✓</span>
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
                    background: '#fafaf9',
                    borderTop: '1px solid #e3e6e9',
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
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textDecoration: 'line-through', display: 'block' }}>
                              {prop.oldPrice.toLocaleString('en-US')} {prop.currency}
                            </span>
                          )}
                          <strong style={{ fontSize: '1.38rem', fontWeight: 900, color: '#c75517' }}>
                            {prop.price.toLocaleString('en-US')} {prop.currency}
                          </strong>
                        </>
                      ) : (
                        <strong style={{ fontSize: '1.12rem', fontWeight: 900, color: '#c75517' }}>
                          السعر عند التواصل / عرض مالي
                        </strong>
                      )}
                    </div>

                    {prop.downPaymentPct ? (
                      <div style={{ textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: '#065f46', background: '#ecfdf5', padding: '4px 10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
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
                            ? '#cbd5e1'
                            : 'linear-gradient(135deg, #f97316 0%, #c75517 100%)',
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
                        border: '1px solid #22c55e',
                        background: '#f0fdf4',
                        color: '#15803d',
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
              background: '#ffffff',
              borderRadius: '20px',
              padding: '22px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {submittedRef ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '2.5rem' }}>🎉</div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#065f46' }}>
                  تم تسجيل طلب المعاينة والعرض المالي!
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#47525c', lineHeight: 1.6 }}>
                  رقم الطلب: <strong style={{ fontFamily: 'monospace' }}>{submittedRef}</strong>
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
                    background: '#ea580c',
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
                  <strong style={{ fontSize: '1.05rem', fontWeight: 900 }}>
                    📅 طلب معاينة / حجز وحدة عقارية
                  </strong>
                  <button
                    type="button"
                    onClick={() => setSelectedProperty(null)}
                    style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontWeight: 800 }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ background: '#fff3ea', border: '1px solid #fed7aa', borderRadius: '12px', padding: '10px 12px', fontSize: '0.82rem' }}>
                  <strong style={{ color: '#c75517', display: 'block' }}>{selectedProperty.title}</strong>
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
                  style={{ padding: '11px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '16px', fontWeight: 700 }}
                />

                <input
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="رقم الجوال (للتواصل والواتساب) *"
                  dir="ltr"
                  inputMode="tel"
                  required
                  style={{ padding: '11px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '16px', fontWeight: 700, textAlign: 'right' }}
                />

                <textarea
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder="ملاحظاتك (مثال: الموعد المناسب للمعاينة أو الاستفسار عن خطة التقسيط والتشطيب)"
                  rows={3}
                  style={{ padding: '11px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '16px' }}
                />

                {errMsg && <div style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: 700 }}>⚠️ {errMsg}</div>}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f97316, #c75517)',
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

      {/* Mobile Bottom Dock */}
      <div className="pw-dock-pad" aria-hidden="true" />
      <nav className="pw-mobile-dock" aria-label="شريط الوصول السريع">
        <Link href="/" className="pw-dock-item">
          <span className="pw-dock-icon">🏠</span>
          <span className="pw-dock-label">الرئيسية</span>
        </Link>
        <Link href="/store" className="pw-dock-item">
          <span className="pw-dock-icon">🛒</span>
          <span className="pw-dock-label">المنتجات</span>
        </Link>
        <button
          type="button"
          className="pw-dock-item pw-dock-cta"
          onClick={() => cart.setCartOpen(true)}
        >
          <span className="pw-dock-icon">🛍️</span>
          <span className="pw-dock-label">السلة ({cart.totalCount})</span>
        </button>
        <Link href="/real-estate" className="pw-dock-item is-active">
          <span className="pw-dock-icon">🏢</span>
          <span className="pw-dock-label">العقارات</span>
        </Link>
        <button
          type="button"
          className="pw-dock-item"
          onClick={() => (cart.user ? cart.setCartOpen(true) : setLoginOpen(true))}
        >
          <span className="pw-dock-icon">👤</span>
          <span className="pw-dock-label">{cart.user ? 'حسابي' : 'دخول'}</span>
        </button>
      </nav>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cart.cartOpen}
        onClose={() => cart.setCartOpen(false)}
        user={cart.user}
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
