"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mergeContent, type SiteContentOverride } from './site-content';
import { CSS } from './site-styles';
import HeroVideoBackdrop, { HeroVideoControls, type HeroVideoControlsState } from '@/components/HeroVideoBackdrop';
import LoginModal from './LoginModal';
import { CartButton, CartDrawer, useCustomerCart } from './CartDrawer';
import FloatingContactChat from './FloatingContactChat';
import HomePortalSections from './HomePortalSections';
import {
  collectClientDeviceDetails,
  rememberVisitorContact,
} from '@/lib/client-device-info';

const NAV = [
  { href: '#portals', label: 'الأقسام' },
  { href: '/sections/maintenance', label: '🛠️ الصيانة' },
  { href: '/sections/contracting', label: '🏗️ المقاولات' },
  { href: '/sections/real-estate', label: '🏢 العقارات' },
  { href: '/sections/materials', label: '🧱 مواد البناء' },
  { href: '/sections/smart-home', label: '📱 السمارت هوم' },
  { href: '/sections/info', label: '📚 معلومات' },
  { href: '#contact', label: 'تواصل' },
];

function InquiryForm({ whatsapp, email }: { whatsapp: string; email: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState('فيلا');
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');

  const message = () => [
    'طلب معاينة ومقايسة',
    `الاسم: ${name || '—'}`,
    phone && `الهاتف: ${phone}`,
    `نوع المشروع: ${kind}`,
    place && `الموقع: ${place}`,
    notes && `تفاصيل: ${notes}`,
  ].filter(Boolean).join('\n');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    rememberVisitorContact({ name: cleanName, phone: cleanPhone });

    void collectClientDeviceDetails(false)
      .then((deviceDetails) =>
        fetch('/api/notify/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'lead_action',
            action: 'inquiry_form',
            label: 'إرسال طلب معاينة ومقايسة',
            name: cleanName,
            phone: cleanPhone,
            projectKind: kind,
            projectLocation: place.trim(),
            notes: notes.trim(),
            deviceDetails,
          }),
          keepalive: true,
        })
      )
      .catch(() => {});

    const text = message();
    if (whatsapp) window.open(`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    else if (email) window.location.href = `mailto:${email}?subject=${encodeURIComponent('طلب معاينة ومقايسة')}&body=${encodeURIComponent(text)}`;
  };

  return (
    <form className="pw-form" onSubmit={submit}>
      <div className="pw-grid2">
        <label className="pw-field"><span>الاسم</span><input value={name} onChange={e => setName(e.target.value)} required autoComplete="name" /></label>
        <label className="pw-field"><span>رقم الهاتف</span><input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" /></label>
      </div>
      <div className="pw-grid2">
        <label className="pw-field"><span>نوع المشروع</span>
          <select value={kind} onChange={e => setKind(e.target.value)}>
            {['فيلا', 'عمارة / برج', 'تشطيب وحدة', 'مبنى تجاري', 'أخرى'].map(k => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className="pw-field"><span>موقع المشروع</span><input value={place} onChange={e => setPlace(e.target.value)} /></label>
      </div>
      <label className="pw-field"><span>تفاصيل إضافية</span><textarea value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <button type="submit" className="pw-btn pw-btn-primary">{whatsapp ? 'إرسال الطلب عبر واتساب' : 'إرسال الطلب بالبريد'}</button>
      <p className="pw-note">لن نحفظ بياناتك على الموقع؛ سيُفتح تطبيق {whatsapp ? 'واتساب' : 'البريد'} بالرسالة جاهزة لتراجعها وترسلها بنفسك.</p>
    </form>
  );
}

export default function PhiSite({ content, initialLoginOpen = false }: { content?: SiteContentOverride; initialLoginOpen?: boolean }) {
  const { SITE, PRODUCTS, PROPERTIES } = mergeContent(content);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroControls, setHeroControls] = useState<HeroVideoControlsState | null>(null);
  const [loginOpen, setLoginOpen] = useState(initialLoginOpen);
  const cart = useCustomerCart(() => setLoginOpen(true));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'true' || window.location.hash === '#login') {
        setLoginOpen(true);
      }
    }
  }, []);

  const handleOpenLogin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setOpen(false);
    setLoginOpen(true);
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.history.pushState(null, '', '/login');
    }
  };

  const handleCloseLogin = () => {
    setLoginOpen(false);
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/login') {
        router.push('/');
      } else if (window.location.search.includes('login') || window.location.hash === '#login') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const c = SITE.contact;
  const waDigits = c.whatsapp.replace(/\D/g, '');
  const contactRows = [
    c.phone && { label: 'الهاتف', value: c.phone, href: `tel:${c.phone.replace(/\s+/g, '')}`, dir: 'ltr' as const },
    waDigits && { label: 'واتساب', value: 'ابدأ محادثة', href: `https://wa.me/${waDigits}`, dir: 'rtl' as const },
    c.email && { label: 'البريد الإلكتروني', value: c.email, href: `mailto:${c.email}`, dir: 'ltr' as const },
    c.address && { label: 'العنوان', value: c.address, href: '', dir: 'rtl' as const },
    c.hours && { label: 'ساعات العمل', value: c.hours, href: '', dir: 'rtl' as const },
  ].filter(Boolean) as { label: string; value: string; href: string; dir: 'ltr' | 'rtl' }[];

  return (
    <div className={`pw ${loginOpen ? 'has-modal-blur' : ''}`} dir="rtl">
      <style>{CSS}</style>

      <header className={`pw-header is-scrolled pw-header-solid ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="pw-wrap pw-header-row">
          <a href="#top" className="pw-brand" aria-label={`${SITE.name} — الرئيسية`}>
            <img src="/brand/phitech-mark-color.svg" alt="" className="pw-brand-mark" />
            <span className="pw-brand-text"><strong>{SITE.name}</strong><small>{SITE.nameEn}</small></span>
          </a>
          <nav className={`pw-nav ${open ? 'is-open' : ''}`} aria-label="التنقل الرئيسي">
            <div className="pw-nav-head">
              <span className="pw-nav-head-title">
                <img src="/brand/phitech-mark-color.svg" alt="" style={{ height: '26px', width: 'auto' }} />
                <span>قائمة الموقع</span>
              </span>
              <button
                type="button"
                className="pw-nav-close"
                onClick={() => setOpen(false)}
                aria-label="إغلاق القائمة"
              >
                ✕ إغلاق
              </button>
            </div>
            {NAV.map(n => n.href.startsWith('#') ? (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
                <span>{n.label}</span>
                <span className="pw-nav-arrow" aria-hidden="true">←</span>
              </a>
            ) : (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="pw-nav-verify">
                <span>{n.label}</span>
                <span className="pw-nav-arrow" aria-hidden="true">←</span>
              </Link>
            ))}
            <CartButton
              count={cart.totalCount}
              onClick={() => {
                setOpen(false);
                cart.setCartOpen(true);
              }}
            />
            <a href="/login" className="pw-btn pw-btn-primary pw-nav-cta" onClick={handleOpenLogin}>
              {cart.user ? `👤 ${cart.user.fullName.split(' ')[0]}` : 'دخول النظام'}
            </a>
          </nav>
          <button className="pw-burger" aria-label="القائمة" aria-expanded={open} onClick={() => setOpen(v => !v)}><span /><span /><span /></button>
        </div>
      </header>

      <main id="top">
        {/* 1. مربعات الأقسام الستة الرئيسية + الأداة السريعة + أهم العروض والمنتجات (بدون تعقيد أو لبخة) */}
        <HomePortalSections
          products={PRODUCTS}
          properties={PROPERTIES}
          whatsappNumber={c.whatsapp}
          onAddToCart={cart.addToCart}
          onAddBundleToCart={cart.addBundleToCart}
        />

        {/* عرض الهوية والفلسفة الهندسية للشركة في نهاية الصفحة */}
        <section className="pw-hero" id="about-phitech">
          <HeroVideoBackdrop variant="showcase-left" controlsMode="none" onControlsReady={setHeroControls} />
          <div className="pw-wrap pw-hero-grid" id="hero-content">
            <div>
              <p className="pw-eyebrow">فلسفة فاي تك الهندسية · {SITE.offices.join(' · ')}</p>
              <h2>
                <span className="pw-hero-part">دقّة <em>التخطيط</em>،</span>{' '}
                <span className="pw-hero-part">وفخامة <em>التنفيذ</em> التي تدوم</span>
              </h2>
              <p className="pw-lead">
                نؤمن في فاي تك أن الفخامة الحقيقية تبدأ من التفاصيل الدقيقة خلف الجدران وتكتمل بجمال التشطيب أمامك؛ شغفنا تحويل كل مشروع إلى مساحة متقنة تجمع بين متانة الهندسة، وذكاء التقنية الحديثة، وراحة بالك في كل خطوة.
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 18px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(249,115,22,0.38)', color: '#fed7aa', fontSize: '0.9rem', fontWeight: 700, backdropFilter: 'blur(10px)' }}>
                <span style={{ color: '#f97316' }}>✦</span>
                <span>إتقان هندسي · التزام بالمواعيد · شراكة ثقة تمتد لما بعد التسليم</span>
              </div>
            </div>
            <div className="pw-hero-art" aria-hidden>
              <div className="pw-emblem"><img src="/brand/phitech-mark-light.svg" alt="" /></div>
            </div>
          </div>
          {heroControls && (
            <div className="pw-wrap pw-hero-toolbar">
              <HeroVideoControls controls={heroControls} />
              <a href="#portals" className="pw-mobile-scroll-cue" aria-label="العودة لأعلى">
                <span>العودة للأعلى</span>
                <span className="pw-cue-arrow" aria-hidden>↑</span>
              </a>
            </div>
          )}
          <ul className="pw-wrap pw-stats">
            <li><strong>التخطيط المسبق</strong><span>تنسيق هندسي قبل بدء الموقع</span></li>
            <li><strong>جودة موثّقة</strong><span>فحص واستلام في كل مرحلة</span></li>
            <li><strong>منزل ذكي وآمن</strong><span>تقنية حديثة ترفع قيمة وحدتك</span></li>
            <li><strong>التزام ممتد</strong><span>مسؤولية وضمان ما بعد التسليم</span></li>
          </ul>
        </section>

        {/* Contact */}
        <section id="contact" className="pw-section pw-tint">
          <div className={`pw-wrap pw-contact ${waDigits || c.email ? '' : 'pw-contact-solo'}`}>
            <div>
              <div className="pw-head" style={{ marginBottom: 20 }}>
                <p className="pw-eyebrow">تواصل</p>
                <h2>ابدأ بمعاينة ومقايسة لمشروعك</h2>
                <p>أخبرنا بنوع المشروع وموقعه، وسيتواصل معك فريقنا الهندسي.</p>
              </div>
              <div className="pw-contact-card">
                {contactRows.length > 0 ? (
                  <ul>
                    {contactRows.map(r => (
                      <li key={r.label}>
                        <span>{r.label}</span>
                        {r.href
                          ? <a href={r.href} dir={r.dir} {...(r.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{r.value}</a>
                          : <strong dir={r.dir}>{r.value}</strong>}
                      </li>
                    ))}
                  </ul>
                ) : (<p className="pw-muted">بيانات التواصل قيد الإضافة.</p>)}
                <div className="pw-offices">{SITE.offices.map(o => (<span key={o}>{o}</span>))}</div>
              </div>
            </div>
            {(waDigits || c.email) && (
              <div className="pw-contact-card"><InquiryForm whatsapp={c.whatsapp} email={c.email} /></div>
            )}
          </div>
        </section>
      </main>

      <footer className="pw-footer">
        <div className="pw-wrap">
          <div className="pw-footer-row">
            <div className="pw-footer-brand">
              <img src="/brand/phitech-mark-light.svg" alt="" />
              <div><strong>{SITE.legalName}</strong><small>{SITE.offices.join(' · ')}</small></div>
            </div>
            <nav className="pw-footer-nav" aria-label="روابط التذييل">
              {NAV.map(n => n.href.startsWith('#') ? (
                <a key={n.href} href={n.href}>{n.label}</a>
              ) : (
                <Link key={n.href} href={n.href}>{n.label}</Link>
              ))}
            </nav>
            <Link href="/verify" className="pw-footer-link" style={{ color: 'var(--o)', fontWeight: 'bold' }}>التحقق من صحة المستندات</Link>
            <a href="/login" className="pw-footer-link" onClick={handleOpenLogin}>دخول النظام</a>
          </div>
          <p className="pw-footer-bottom">© {new Date().getFullYear()} {SITE.name} — جميع الحقوق محفوظة</p>
        </div>
      </footer>

      {/* Spacer for mobile dock */}
      <div className="pw-dock-pad" aria-hidden="true" />

      {/* Mobile Fixed Bottom Action Bar / Dock */}
      <nav className="pw-mobile-dock" aria-label="شريط الوصول السريع">
        <a href="#top" className="pw-dock-item" onClick={() => setOpen(false)}>
          <span className="pw-dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <span className="pw-dock-label">الرئيسية</span>
        </a>

        <Link href="/store" className="pw-dock-item" onClick={() => setOpen(false)}>
          <span className="pw-dock-icon">🛒</span>
          <span className="pw-dock-label">المنتجات</span>
        </Link>

        <button
          type="button"
          className="pw-dock-item pw-dock-cta"
          onClick={() => (cart.user ? cart.setCartOpen(true) : handleOpenLogin())}
          aria-label="السلة / دخول النظام"
        >
          <span className="pw-dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </span>
          <span className="pw-dock-label">
            {cart.totalCount > 0 ? `السلة (${cart.totalCount})` : cart.user ? 'السلة' : 'دخول / سلة'}
          </span>
        </button>

        <Link href="/real-estate" className="pw-dock-item" onClick={() => setOpen(false)}>
          <span className="pw-dock-icon">🏢</span>
          <span className="pw-dock-label">العقارات</span>
        </Link>

        <button
          type="button"
          className={`pw-dock-item ${open ? 'is-active' : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={open}
        >
          <span className="pw-dock-icon">
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </span>
          <span className="pw-dock-label">{open ? 'إغلاق' : 'القائمة'}</span>
        </button>
      </nav>

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

      <FloatingContactChat
        whatsappNumber={SITE.contact.whatsapp}
        defaultName={cart.user?.fullName || ''}
        defaultPhone={cart.user?.phone || ''}
        contextLabel="الصفحة الرئيسية — فاي تك"
      />

      <LoginModal isOpen={loginOpen} onClose={handleCloseLogin} />
    </div>
  );
}
