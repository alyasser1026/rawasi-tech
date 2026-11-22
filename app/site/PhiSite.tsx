"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mergeContent, type SiteContentOverride } from './site-content';
import type { WebsiteProduct } from './store-catalog';
import { CSS } from './site-styles';
import LogoMotionIntro from '@/components/LogoMotionIntro';
import LoginModal from './LoginModal';
import { CartDrawer, useCustomerCart } from './CartDrawer';
import FloatingContactChat from './FloatingContactChat';
import HomePortalSections from './HomePortalSections';
import PublicHeader, { PUBLIC_NAV_ITEMS } from './PublicHeader';
import ContactModal from './ContactModal';

export default function PhiSite({
  content,
  initialLoginOpen = false,
  catalogProducts,
  catalogTotalCount,
}: {
  content?: SiteContentOverride;
  initialLoginOpen?: boolean;
  catalogProducts?: WebsiteProduct[];
  catalogTotalCount?: number;
}) {
  const { SITE, PRODUCTS, MAINTENANCE_SERVICES, NEWS_TICKER } = mergeContent(content);
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(initialLoginOpen);
  const [contactOpen, setContactOpen] = useState(false);
  const cart = useCustomerCart(() => setLoginOpen(true));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'true' || window.location.hash === '#login') {
        setLoginOpen(true);
      }
      if (params.get('contact') === 'true' || window.location.hash === '#contact') {
        setContactOpen(true);
      }
    };
    syncFromLocation();
    window.addEventListener('hashchange', syncFromLocation);
    return () => window.removeEventListener('hashchange', syncFromLocation);
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

  const handleOpenContact = () => {
    setContactOpen(true);
  };

  const handleCloseContact = () => {
    setContactOpen(false);
    if (typeof window !== 'undefined' && (window.location.search.includes('contact') || window.location.hash === '#contact')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const c = SITE.contact;

  return (
    <div className={`pw pw-home-light ${loginOpen || contactOpen ? 'has-modal-blur' : ''}`} dir="rtl">
      <style>{CSS}</style>
      <LogoMotionIntro replayCount={0} />

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
        onOpenContact={handleOpenContact}
      />

      <main id="top">
        {/* الترحيب + البحث الشامل + محاكاة الطلبات + الأقسام الثلاثة بالخط المائل + الأكثر مبيعاً */}
        <HomePortalSections
          products={catalogProducts && catalogProducts.length > 0 ? catalogProducts : PRODUCTS}
          totalCatalogCount={catalogTotalCount}
          maintenanceServices={MAINTENANCE_SERVICES}
          newsTicker={NEWS_TICKER}
          whatsappNumber={c.whatsapp}
          onAddToCart={cart.addToCart}
          onAddBundleToCart={cart.addBundleToCart}
          onOpenCart={() => cart.setCartOpen(true)}
          onOpenContact={handleOpenContact}
        />
      </main>

      <footer className="pw-footer">
        <div className="pw-wrap">
          <div className="pw-footer-row">
            <div className="pw-footer-brand">
              <img src="/brand/phitech-mark-color.svg" alt="" />
              <div><strong>{SITE.legalName}</strong><small>{SITE.offices.join(' · ')}</small></div>
            </div>
            <nav className="pw-footer-nav" aria-label="روابط التذييل">
              {PUBLIC_NAV_ITEMS.map(n =>
                n.key === 'contact' ? (
                  <a
                    key={n.key}
                    href="#contact"
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenContact();
                    }}
                  >
                    {n.label}
                  </a>
                ) : (
                  <Link key={n.key} href={n.href}>{n.label}</Link>
                )
              )}
            </nav>
            <div className="pw-footer-actions">
              <Link href="/verify" className="pw-footer-link is-accent">التحقق من صحة المستندات</Link>
              {(cart.portalHref || !cart.user) && (
                <Link href={cart.portalHref || '/login?portal=employee'} className="pw-footer-link">بوابة الموظفين</Link>
              )}
              {!cart.user && (
                <a href="/login" className="pw-footer-link" onClick={handleOpenLogin}>تسجيل الدخول</a>
              )}
            </div>
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
      <ContactModal isOpen={contactOpen} onClose={handleCloseContact} site={SITE} />
    </div>
  );
}
