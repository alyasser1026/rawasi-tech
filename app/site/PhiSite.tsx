"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mergeContent, type SiteContentOverride } from './site-content';
import { CSS } from './site-styles';
import LogoMotionIntro from '@/components/LogoMotionIntro';
import LoginModal from './LoginModal';
import { CartDrawer, useCustomerCart } from './CartDrawer';
import FloatingContactChat from './FloatingContactChat';
import HomePortalSections from './HomePortalSections';
import PanoramicStructureScroll from './PanoramicStructureScroll';
import PublicHeader, { PUBLIC_NAV_ITEMS } from './PublicHeader';
import {
  collectClientDeviceDetails,
  rememberVisitorContact,
} from '@/lib/client-device-info';

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
  const { SITE, PRODUCTS, PROPERTIES, NEWS_TICKER } = mergeContent(content);
  const router = useRouter();
  const [introReplayCount, setIntroReplayCount] = useState(0);
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
      <PanoramicStructureScroll />
      <LogoMotionIntro replayCount={introReplayCount} />

      <PublicHeader
        siteName={SITE.name}
        siteNameEn={SITE.nameEn}
        activeKey="home"
        cartCount={cart.totalCount}
        onOpenCart={() => cart.setCartOpen(true)}
        userName={cart.user?.fullName}
        userEmail={cart.user?.email}
        portalHref={cart.portalHref}
        onOpenLogin={() => (cart.user ? cart.setCartOpen(true) : handleOpenLogin())}
        onSignOut={cart.signOut}
      />

      <main id="top">
        {/* 1. مربعات الأقسام الستة الرئيسية + الأداة السريعة + أهم العروض والمنتجات (بدون تعقيد أو لبخة) */}
        <HomePortalSections
          products={PRODUCTS}
          properties={PROPERTIES}
          newsTicker={NEWS_TICKER}
          whatsappNumber={c.whatsapp}
          onAddToCart={cart.addToCart}
          onAddBundleToCart={cart.addBundleToCart}
          onReplayLogoMotion={() => setIntroReplayCount((n) => n + 1)}
        />

        {/* قسم التواصل فوق الخلفية البانورامية الممتدة من أول الصفحة لآخرها */}
        <section id="contact" className="pw-hero pw-hero-pearl pw-section pw-tint">
          <div className={`pw-wrap pw-hero-grid ${waDigits || c.email ? '' : 'is-solo'}`} id="hero-content">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="pw-head" style={{ margin: '0 0 22px', maxWidth: 'none', textAlign: 'start' }}>
                <p className="pw-eyebrow" style={{ justifyContent: 'flex-start' }}>تواصل</p>
                <h2>
                  <span className="pw-hero-part">ابدأ بمعاينة <em>ومقايسة</em> لمشروعك</span>
                </h2>
                <p className="pw-lead" style={{ marginInline: 0 }}>أخبرنا بنوع المشروع وموقعه، وسيتواصل معك فريقنا الهندسي.</p>
              </div>
              <div className="pw-contact-card" style={{ flex: 1 }}>
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
              <div className="pw-contact-card" style={{ height: '100%' }}>
                <InquiryForm whatsapp={c.whatsapp} email={c.email} />
              </div>
            )}
          </div>
        </section>
        <section className="pw-construction-finale" aria-labelledby="construction-finale-heading">
          <div className="pw-wrap">
            <p className="pw-eyebrow">فاي تك · نبني بثقة</p>
            <h2 id="construction-finale-heading">أساس قوي. لمشروع يدوم.</h2>
            <a className="pw-btn pw-btn-primary" href="#contact">خلّينا نبدأ مشروعك ←</a>
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
              {PUBLIC_NAV_ITEMS.map(n => (
                <Link key={n.key} href={n.href}>{n.label}</Link>
              ))}
            </nav>
            <Link href="/verify" className="pw-footer-link" style={{ color: 'var(--o)', fontWeight: 'bold' }}>التحقق من صحة المستندات</Link>
            {(cart.portalHref || !cart.user) && (
              <Link href={cart.portalHref || '/login?portal=employee'} className="pw-footer-link">🏢 بوابة الموظفين</Link>
            )}
            {!cart.user && (
              <a href="/login" className="pw-footer-link" onClick={handleOpenLogin}>تسجيل الدخول</a>
            )}
          </div>
          <p className="pw-footer-bottom">© {new Date().getFullYear()} {SITE.name} — جميع الحقوق محفوظة</p>
        </div>
      </footer>

      {/* Spacer for mobile dock */}
      <div className="pw-dock-pad" aria-hidden="true" />

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
