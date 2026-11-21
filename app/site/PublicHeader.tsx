"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CartButton } from './CartDrawer';
import type { SectionSlug } from './section-defs';

export type PublicNavActiveKey = 'home' | SectionSlug | 'store';

export const PUBLIC_NAV_ITEMS: Array<{ key: PublicNavActiveKey | 'contact'; href: string; label: string }> = [
  { key: 'home', href: '/', label: 'الأقسام' },
  { key: 'maintenance', href: '/sections/maintenance', label: '🛠️ الصيانة' },
  { key: 'contracting', href: '/sections/contracting', label: '🏗️ المقاولات' },
  { key: 'real-estate', href: '/sections/real-estate', label: '🏢 العقارات' },
  { key: 'materials', href: '/sections/materials', label: '🧱 مواد البناء' },
  { key: 'smart-home', href: '/sections/smart-home', label: '📱 السمارت هوم' },
  { key: 'info', href: '/sections/info', label: '📚 معلومات' },
  { key: 'store', href: '/store', label: '🛒 المتجر' },
  { key: 'contact', href: '/#contact', label: 'تواصل' },
];

export default function PublicHeader({
  siteName = 'فاي تك',
  siteNameEn = 'PhiTech',
  activeKey = 'home',
  cartCount = 0,
  onOpenCart,
  userName,
  userEmail,
  portalHref,
  onOpenLogin,
  onSignOut,
  onOpenContact,
}: {
  siteName?: string;
  siteNameEn?: string;
  activeKey?: PublicNavActiveKey;
  cartCount?: number;
  onOpenCart: () => void;
  userName?: string | null;
  userEmail?: string | null;
  portalHref?: string | null;
  onOpenLogin: () => void;
  onSignOut?: () => void;
  onOpenContact?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [accountOpen]);

  return (
    <>
      <header className={`pw-header pw-header-glass ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="pw-wrap pw-header-row">
          <Link href="/" className="pw-brand" aria-label={`${siteName} — الرئيسية`}>
            <img src="/brand/phitech-mark-color.svg" alt="" className="pw-brand-mark" />
            <span className="pw-brand-text">
              <strong>{siteName}</strong>
              <small>{siteNameEn}</small>
            </span>
          </Link>

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

            {PUBLIC_NAV_ITEMS.map((item) => {
              const isActive = item.key === activeKey;
              if (item.key === 'contact' && onOpenContact) {
                return (
                  <a
                    key={item.key}
                    href="#contact"
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(false);
                      onOpenContact();
                    }}
                  >
                    <span>{item.label}</span>
                    <span className="pw-nav-arrow" aria-hidden="true">←</span>
                  </a>
                );
              }
              const href = activeKey === 'home' && item.key === 'contact' ? '#contact' : item.href;
              return (
                <Link
                  key={item.key}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={isActive ? 'is-nav-active' : undefined}
                >
                  <span>{item.label}</span>
                  <span className="pw-nav-arrow" aria-hidden="true">←</span>
                </Link>
              );
            })}

            <CartButton
              count={cartCount}
              onClick={() => {
                setOpen(false);
                onOpenCart();
              }}
            />

            {(portalHref || !userName) && (
              <Link
                href={portalHref || '/login?portal=employee'}
                onClick={() => setOpen(false)}
                className={`pw-btn pw-nav-portal ${portalHref ? 'is-ready' : 'is-guest'}`}
              >
                <span>🏢 بوابة الموظفين</span>
                <span className="pw-nav-arrow" aria-hidden="true">←</span>
              </Link>
            )}

            {userName ? (
              <div className="pw-user-wrap" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="pw-btn pw-btn-primary pw-nav-cta"
                  title="قائمة الحساب وبوابة الموظفين"
                >
                  <span>👤 {userName.split(' ')[0]}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.9 }} aria-hidden="true">
                    {accountOpen ? '▴' : '▾'}
                  </span>
                </button>

                {accountOpen && (
                  <div className="pw-user-menu" role="menu" aria-label="قائمة الحساب">
                    <div className="pw-user-menu-head">
                      <strong>{userName}</strong>
                      {userEmail && <small dir="ltr">{userEmail}</small>}
                      <span className={`pw-user-role-tag ${portalHref ? 'is-staff' : ''}`}>
                        {portalHref ? 'حساب موظف / صلاحية نظام' : 'حساب عميل فاي تك'}
                      </span>
                    </div>

                    {portalHref && (
                      <Link
                        href={portalHref}
                        role="menuitem"
                        className="pw-user-menu-item is-portal"
                        onClick={() => {
                          setAccountOpen(false);
                          setOpen(false);
                        }}
                      >
                        <span>🏢 دخول بوابة الموظفين</span>
                        <span aria-hidden="true">←</span>
                      </Link>
                    )}

                    <Link
                      href="/profile"
                      role="menuitem"
                      className="pw-user-menu-item"
                      onClick={() => {
                        setAccountOpen(false);
                        setOpen(false);
                      }}
                    >
                      <span>👤 الملف الشخصي</span>
                      <span aria-hidden="true">←</span>
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      className="pw-user-menu-item"
                      onClick={() => {
                        setAccountOpen(false);
                        setOpen(false);
                        onOpenCart();
                      }}
                    >
                      <span>🛒 سلة المشتريات ({cartCount})</span>
                      <span aria-hidden="true">←</span>
                    </button>

                    {onSignOut && (
                      <>
                        <div className="pw-user-menu-sep" />
                        <button
                          type="button"
                          role="menuitem"
                          className="pw-user-menu-item is-danger"
                          onClick={() => {
                            setAccountOpen(false);
                            setOpen(false);
                            onSignOut();
                          }}
                        >
                          <span>🚪 تسجيل الخروج</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenLogin();
                }}
                className="pw-btn pw-btn-primary pw-nav-cta"
                title="تسجيل الدخول (اختياري)"
              >
                تسجيل الدخول
              </button>
            )}
          </nav>

          <button
            className="pw-burger"
            aria-label="القائمة"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* Mobile Fixed Bottom Dock */}
      <nav className="pw-mobile-dock" aria-label="شريط الوصول السريع">
        <Link href="/" className={`pw-dock-item ${activeKey === 'home' ? 'is-active' : ''}`} onClick={() => setOpen(false)}>
          <span className="pw-dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <span className="pw-dock-label">الأقسام</span>
        </Link>

        <Link href="/store" className={`pw-dock-item ${activeKey === 'store' ? 'is-active' : ''}`} onClick={() => setOpen(false)}>
          <span className="pw-dock-icon">🛒</span>
          <span className="pw-dock-label">المتجر</span>
        </Link>

        <button
          type="button"
          className="pw-dock-item pw-dock-cta"
          onClick={onOpenCart}
          aria-label="سلة المشتريات"
        >
          <span className="pw-dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </span>
          <span className="pw-dock-label">
            {cartCount > 0 ? `السلة (${cartCount})` : 'السلة'}
          </span>
        </button>

        <Link href="/sections/real-estate" className={`pw-dock-item ${activeKey === 'real-estate' ? 'is-active' : ''}`} onClick={() => setOpen(false)}>
          <span className="pw-dock-icon">🏢</span>
          <span className="pw-dock-label">العقارات</span>
        </Link>

        <button
          type="button"
          className={`pw-dock-item ${open ? 'is-active' : ''}`}
          onClick={() => setOpen((v) => !v)}
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
    </>
  );
}
