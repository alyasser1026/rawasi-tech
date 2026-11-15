"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CSS } from './site-styles';
import { mergeContent, type SiteContentOverride } from './site-content';
import {
  PRODUCT_CATEGORIES,
  SMART_BUNDLES,
  type ProductCategoryId,
  type WebsiteProduct,
} from './store-catalog';
import { CartDrawer, useCustomerCart } from './CartDrawer';
import LoginModal from './LoginModal';
import FloatingContactChat from './FloatingContactChat';
import { supabase } from '@/lib/supabase';

export default function StoreClient({ content }: { content?: SiteContentOverride }) {
  const { SITE, PRODUCTS, PROMO_BANNER } = mergeContent(content);
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [installSelections, setInstallSelections] = useState<Record<string, boolean>>({});

  const cart = useCustomerCart(() => setLoginOpen(true));

  const categoryMap = useMemo(() => {
    const map: Record<string, (typeof PRODUCT_CATEGORIES)[number]> = {};
    for (const c of PRODUCT_CATEGORIES) map[c.id] = c;
    return map;
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.specs.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [PRODUCTS, selectedCategory, searchQuery]);

  const handleToggleCardInstall = (id: string) => {
    setInstallSelections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBundleAdd = (bundleId: string) => {
    const bundle = SMART_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) return;
    const list: Array<{ product: WebsiteProduct; qty: number }> = [];
    for (const item of bundle.productIds) {
      const found = PRODUCTS.find((p) => p.id === item.productId);
      if (found) list.push({ product: found, qty: item.qty });
    }
    if (list.length > 0) {
      cart.addBundleToCart(list, true);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className={`pw ${loginOpen ? 'has-modal-blur' : ''}`} dir="rtl">
      <style>{CSS}</style>
      <style>{`
        .st-hero {
          background: radial-gradient(900px 420px at 20% 20%, rgba(249,115,22,0.22), transparent 70%), linear-gradient(180deg, #0b0f15 0%, #141a22 100%);
          color: #ffffff;
          padding: 108px 0 44px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .st-promo {
          background: linear-gradient(90deg, #9a3412 0%, #ea580c 50%, #c2410c 100%);
          color: #fff;
          padding: 10px 16px;
          text-align: center;
          font-size: 0.85rem;
          font-weight: 800;
        }
        .st-cats-bar {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 22px 0;
        }
        .st-cat-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 16px;
          border-radius: 14px;
          border: 1.5px solid #e3e6e9;
          background: #ffffff;
          color: #14181b;
          font-weight: 800;
          font-size: 0.86rem;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
        }
        .st-cat-btn:hover {
          border-color: #f97316;
          color: #c75517;
          transform: translateY(-1px);
        }
        .st-cat-btn.is-active {
          background: #ea580c;
          color: #ffffff;
          border-color: #ea580c;
          box-shadow: 0 8px 20px -6px rgba(234, 88, 12, 0.5);
        }
        .st-bundles-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          margin-bottom: 36px;
        }
        .st-products-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
        }
        .st-prod-card {
          background: #ffffff;
          border: 1px solid #e3e6e9;
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .st-prod-card:hover {
          transform: translateY(-3px);
          border-color: rgba(234, 88, 12, 0.45);
          box-shadow: 0 20px 40px -24px rgba(20, 28, 34, 0.22);
        }
        @media (max-width: 980px) {
          .st-bundles-grid { grid-template-columns: 1fr; }
          .st-products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        }
        @media (max-width: 680px) {
          .st-hero { padding: 84px 0 28px; }
          .st-cats-bar {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 4px;
            margin: 14px 0;
          }
          .st-cats-bar::-webkit-scrollbar { display: none; }
          .st-cat-btn { flex: 0 0 auto; padding: 8px 13px; font-size: 0.8rem; }
          .st-products-grid { grid-template-columns: 1fr; gap: 14px; }
        }
      `}</style>

      {/* Top Sticky Header */}
      <header className="pw-header is-scrolled">
        <div className="pw-wrap pw-header-row">
          <Link href="/" className="pw-brand" aria-label={`${SITE.name} — الرئيسية`}>
            <img src="/brand/phitech-mark-color.svg" alt="" className="pw-brand-mark" />
            <span className="pw-brand-text">
              <strong>{SITE.name}</strong>
              <small>STORE & SMART SYSTEMS</small>
            </span>
          </Link>

          <nav className="pw-nav" aria-label="التنقل الرئيسي">
            <Link href="/">الرئيسية</Link>
            <Link href="/store" style={{ color: '#fb923c', fontWeight: 900 }}>
              🛒 متجر المنتجات
            </Link>
            <Link href="/real-estate">🏢 عروض العقارات</Link>
            <Link href="/#capital-tower">المجسم 3D</Link>
            <Link href="/verify" className="pw-nav-verify">
              التحقق من المستندات
            </Link>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => cart.setCartOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 14px',
                borderRadius: '12px',
                border: '1.5px solid #f97316',
                background: cart.totalCount > 0 ? '#ea580c' : 'rgba(249,115,22,0.16)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              <span>🛍️ السلة</span>
              <span
                style={{
                  background: '#ffffff',
                  color: '#c75517',
                  borderRadius: '999px',
                  padding: '1px 8px',
                  fontSize: '0.76rem',
                  fontWeight: 900,
                }}
              >
                {cart.totalCount}
              </span>
            </button>

            {cart.user ? (
              <button
                type="button"
                onClick={handleSignOut}
                title="تسجيل الخروج"
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fde68a',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                👤 {cart.user.fullName.split(' ')[0]} (خروج)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="pw-btn pw-btn-primary pw-nav-cta"
                style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.82rem' }}
              >
                دخول / حساب جديد
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="st-hero">
        {PROMO_BANNER.enabled && (
          <div className="st-promo" style={{ marginBottom: '22px', borderRadius: '0' }}>
            <div className="pw-wrap">{PROMO_BANNER.text}</div>
          </div>
        )}
        <div className="pw-wrap">
          <p className="pw-eyebrow" style={{ color: '#fb923c' }}>
            متجر فاي تك الهندسي — توريد معتمد وتركيب بإشراف هندسي
          </p>
          <h1 style={{ fontSize: 'clamp(1.45rem, 3.2vw, 2.45rem)', fontWeight: 900, lineHeight: 1.32, marginBottom: '12px' }}>
            كل ما يحتاجه مشروعك من <span style={{ color: '#f97316' }}>التأسيسات والتشطيبات</span> إلى{' '}
            <span style={{ color: '#38bdf8' }}>السمارت هوم وحساسات الأمان</span>
          </h1>
          <p style={{ color: '#cbd5e1', maxWidth: '48rem', fontSize: '0.96rem', marginBottom: '20px' }}>
            اختر منتجاتك من الكهرباء، السباكة، الدهانات، السيراميك، الرخام، الديكورات، أجهزة التحكم الذكي، التيار الخفيف،
            وحساسات الحريق والغاز والمياه — وأضفها لسلتك لطلب التوريد المباشر أو التوريد مع التركيب الهندسي بالضمان.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            {!cart.user ? (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="pw-btn pw-btn-primary"
                style={{ minHeight: '44px', padding: '0 20px', fontSize: '0.9rem' }}
              >
                🔐 سجّل دخولك أو أنشئ حسابك لتفعيل سلة المشتريات
              </button>
            ) : (
              <button
                type="button"
                onClick={() => cart.setCartOpen(true)}
                className="pw-btn pw-btn-primary"
                style={{ minHeight: '44px', padding: '0 20px', fontSize: '0.9rem' }}
              >
                🛍️ استعراض سلة مشترياتك ({cart.totalCount} صنف — {cart.totalAmount.toLocaleString('en-US')} ج.م)
              </button>
            )}
            <Link
              href="/real-estate"
              className="pw-btn pw-btn-light"
              style={{ minHeight: '44px', padding: '0 18px', fontSize: '0.88rem' }}
            >
              🏢 تصفح عروض العقارات والوحدات السكنية ←
            </Link>
          </div>
        </div>
      </section>

      <main className="pw-wrap" style={{ paddingTop: '28px', paddingBottom: '64px' }}>
        {/* Smart Bundles Section */}
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '6px' }}>
            ⚡ باقات السمارت هوم وحساسات الأمان الجاهزة (توفير فوري)
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#47525c', marginBottom: '16px' }}>
            باقات متكاملة تم اختيارها هندسياً لحماية الشقق والفلل والتحكم الكامل بها من الجوال بضغطة واحدة:
          </p>
          <div className="st-bundles-grid">
            {SMART_BUNDLES.map((b) => (
              <div
                key={b.id}
                style={{
                  background: 'linear-gradient(145deg, #14181b 0%, #1e2630 100%)',
                  color: '#ffffff',
                  borderRadius: '20px',
                  padding: '22px',
                  border: '1px solid rgba(249, 115, 22, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  boxShadow: '0 16px 36px -18px rgba(0,0,0,0.4)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span
                      style={{
                        background: '#ea580c',
                        color: '#fff',
                        padding: '3px 12px',
                        borderRadius: '999px',
                        fontSize: '0.76rem',
                        fontWeight: 900,
                      }}
                    >
                      {b.badge}
                    </span>
                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>شامل البرمجة والتطبيق</span>
                  </div>
                  <h3 style={{ fontSize: '1.12rem', fontWeight: 900, marginBottom: '6px', color: '#fff' }}>
                    {b.title}
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: '#cbd5e1', marginBottom: '12px', lineHeight: 1.55 }}>
                    {b.subtitle}
                  </p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {b.items.map((it) => (
                      <li key={it} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                        <span style={{ color: '#22c55e', fontWeight: 900 }}>✓</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    paddingTop: '14px',
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                        textDecoration: 'line-through',
                        display: 'block',
                      }}
                    >
                      {b.oldPrice.toLocaleString('en-US')} {b.currency}
                    </span>
                    <strong style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fb923c' }}>
                      {b.price.toLocaleString('en-US')} {b.currency}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBundleAdd(b.id)}
                    style={{
                      padding: '11px 18px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #f97316, #c75517)',
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                    }}
                  >
                    🛒 أضف الباقة للسلة
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div
          style={{
            background: '#f6f5f3',
            border: '1px solid #e3e6e9',
            borderRadius: '18px',
            padding: '16px',
            marginBottom: '22px',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 ابحث عن منتج (مثال: حساس غاز، قفل ذكي، خلاط مدفون، بورسلان، جوتن، كاميرات...)"
              style={{
                flex: '1 1 280px',
                padding: '11px 16px',
                borderRadius: '12px',
                border: '1.5px solid #e3e6e9',
                background: '#ffffff',
                fontSize: '16px',
                fontWeight: 700,
              }}
            />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#47525c' }}>
              إجمالي المعروض: <strong style={{ color: '#c75517' }}>{filteredProducts.length}</strong> منتج
            </span>
          </div>

          <div className="st-cats-bar" role="tablist" aria-label="أقسام المتجر">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`st-cat-btn ${selectedCategory === 'all' ? 'is-active' : ''}`}
            >
              <span>📦</span>
              <span>جميع الأقسام ({PRODUCTS.length})</span>
            </button>
            {PRODUCT_CATEGORIES.map((cat) => {
              const count = PRODUCTS.filter((p) => p.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`st-cat-btn ${selectedCategory === cat.id ? 'is-active' : ''}`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.shortTitle}</span>
                  <small style={{ opacity: 0.75 }}>({count})</small>
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        <div className="st-products-grid">
          {filteredProducts.map((p) => {
            const cat = categoryMap[p.category] || PRODUCT_CATEGORIES[0];
            const withInstall = Boolean(installSelections[p.id]);
            const discountPct =
              p.oldPrice && p.oldPrice > p.price
                ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)
                : 0;

            return (
              <article key={p.id} className="st-prod-card">
                <div>
                  {/* Visual Top Header or Uploaded Image */}
                  {p.imageUrl ? (
                    <div style={{ position: 'relative', height: '190px', background: '#f8fafc', overflow: 'hidden' }}>
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {p.badge && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: '#ea580c',
                            color: '#fff',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                          }}
                        >
                          {p.badge}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '16px 18px 14px',
                        background: `linear-gradient(135deg, ${cat.accent}18 0%, #f8fafc 100%)`,
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            background: '#ffffff',
                            border: `1.5px solid ${cat.accent}44`,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '1.35rem',
                          }}
                        >
                          {cat.icon}
                        </span>
                        <div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: cat.accent, display: 'block' }}>
                            {cat.shortTitle}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#64748b' }}>
                            {p.code} · {p.brand}
                          </span>
                        </div>
                      </div>
                      {p.badge && (
                        <span
                          style={{
                            background: '#fff3ea',
                            color: '#c75517',
                            border: '1px solid #fed7aa',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            fontWeight: 900,
                          }}
                        >
                          {p.badge}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.02rem', fontWeight: 900, lineHeight: 1.4, color: '#14181b', margin: 0 }}>
                      {p.name}
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: '#47525c', lineHeight: 1.58, margin: 0 }}>
                      {p.description}
                    </p>
                    {p.specs.length > 0 && (
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: 0, padding: 0 }}>
                        {p.specs.map((s) => (
                          <li
                            key={s}
                            style={{
                              fontSize: '0.78rem',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 700,
                            }}
                          >
                            <span style={{ color: '#ea580c' }}>•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Price, Install Option & Add to Cart */}
                <div
                  style={{
                    padding: '14px 18px 18px',
                    borderTop: '1px solid #f1f5f9',
                    background: '#fafaf9',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {p.installPrice && p.installPrice > 0 ? (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        padding: '7px 10px',
                        borderRadius: '10px',
                        background: withInstall ? '#ecfdf5' : '#ffffff',
                        border: withInstall ? '1.5px solid #10b981' : '1px solid #e3e6e9',
                        color: withInstall ? '#065f46' : '#47525c',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={withInstall}
                        onChange={() => handleToggleCardInstall(p.id)}
                        style={{ accentColor: '#10b981' }}
                      />
                      <span>
                        إضافة خدمة التركيب الهندسي (+{p.installPrice.toLocaleString('en-US')} {p.currency})
                      </span>
                    </label>
                  ) : null}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      {p.oldPrice && p.oldPrice > p.price && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.76rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                            {p.oldPrice.toLocaleString('en-US')}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 900,
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '1px 6px',
                              borderRadius: '6px',
                            }}
                          >
                            خصم {discountPct}%
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <strong style={{ fontSize: '1.28rem', fontWeight: 900, color: '#c75517' }}>
                          {(p.price + (withInstall && p.installPrice ? p.installPrice : 0)).toLocaleString('en-US')}
                        </strong>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#47525c' }}>
                          {p.currency} / {p.unit}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!p.inStock}
                      onClick={() => cart.addToCart(p, 1, withInstall)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: 'none',
                        background: p.inStock
                          ? 'linear-gradient(135deg, #f97316 0%, #c75517 100%)'
                          : '#cbd5e1',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        cursor: p.inStock ? 'pointer' : 'not-allowed',
                        boxShadow: p.inStock ? '0 6px 16px -4px rgba(249, 115, 22, 0.45)' : 'none',
                      }}
                    >
                      {p.inStock ? '🛒 أضف للسلة' : 'نفد حالياً'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {/* Mobile Bottom Dock */}
      <div className="pw-dock-pad" aria-hidden="true" />
      <nav className="pw-mobile-dock" aria-label="شريط الوصول السريع">
        <Link href="/" className="pw-dock-item">
          <span className="pw-dock-icon">🏠</span>
          <span className="pw-dock-label">الرئيسية</span>
        </Link>
        <Link href="/store" className="pw-dock-item is-active">
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
        <Link href="/real-estate" className="pw-dock-item">
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
        contextLabel="متجر المنتجات والأنظمة الذكية"
      />

      {/* Login Modal */}
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
