"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { SMART_BUNDLES, type WebsiteProduct, type WebsiteProperty } from './store-catalog';
import { PORTAL_SECTIONS, type SectionSlug } from './section-defs';
import NewsTicker from './NewsTicker';
import { DEFAULT_NEWS_TICKER, type NewsTickerConfig } from './site-content';

interface HomePortalSectionsProps {
  products: WebsiteProduct[];
  properties?: WebsiteProperty[];
  newsTicker?: NewsTickerConfig;
  whatsappNumber: string;
  onAddToCart: (product: WebsiteProduct, qty: number, withInstall: boolean) => void;
  onAddBundleToCart: (items: { product: WebsiteProduct; qty: number }[], withInstall: boolean) => void;
}

export default function HomePortalSections({
  products,
  newsTicker = DEFAULT_NEWS_TICKER,
  whatsappNumber,
  onAddToCart,
  onAddBundleToCart,
}: HomePortalSectionsProps) {
  const waDigits = (whatsappNumber || '201558888744').replace(/\D/g, '') || '201558888744';
  const openWhatsApp = (message: string) => {
    window.open(
      `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  // --- أهم المنتجات (فلتر مبسط على الرئيسية) ---
  const [featuredTab, setFeaturedTab] = useState<'all' | 'smart' | 'mep' | 'finishing'>('all');
  const [featuredInstallMap, setFeaturedInstallMap] = useState<Record<string, boolean>>({});

  const featuredProducts = useMemo(() => {
    const base = products.filter((p) => p.featured);
    const list = base.length > 0 ? base : products.slice(0, 8);
    if (featuredTab === 'all') return list.slice(0, 4);
    if (featuredTab === 'smart') {
      return products
        .filter((p) => ['smart_home', 'low_current', 'safety_sensors'].includes(p.category))
        .slice(0, 4);
    }
    if (featuredTab === 'mep') {
      return products
        .filter((p) => ['electrical', 'plumbing'].includes(p.category))
        .slice(0, 4);
    }
    return products
      .filter((p) => ['paint', 'ceramics', 'marble', 'decor'].includes(p.category))
      .slice(0, 4);
  }, [products, featuredTab]);

  // --- تفاعل الأعمدة البانورامية المتصلة مع حركة الماوس ---
  const [hoveredSlug, setHoveredSlug] = useState<SectionSlug | null>(null);

  const activeHoverSection = useMemo(
    () => (hoveredSlug ? PORTAL_SECTIONS.find((s) => s.slug === hoveredSlug) || null : null),
    [hoveredSlug]
  );

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const mx = (nx - 0.5) * 2;
    const my = (ny - 0.5) * 2;
    el.style.setProperty('--stage-px', `${(nx * 100).toFixed(1)}%`);
    el.style.setProperty('--stage-py', `${(ny * 100).toFixed(1)}%`);
    el.style.setProperty('--stage-mx', mx.toFixed(3));
    el.style.setProperty('--stage-my', my.toFixed(3));
  };

  const resetStagePointer = (el: HTMLDivElement) => {
    el.style.removeProperty('--stage-px');
    el.style.removeProperty('--stage-py');
    el.style.removeProperty('--stage-mx');
    el.style.removeProperty('--stage-my');
    setHoveredSlug(null);
  };

  return (
    <>
      {/* 1. مربعات الأقسام الستة الرئيسية — واجهة فتح الموقع بدون أي زحمة */}
      <section id="portals" className="pw-section pw-portal-gateway" aria-labelledby="portals-heading">
        <div className="pw-wrap">
          <NewsTicker config={newsTicker} />

          <div className="pw-head" style={{ marginBottom: '28px' }}>
            <p className="pw-eyebrow">أهلاً بك في فاي تك — اختر قسمك مباشرة</p>
            <h2 id="portals-heading" className="pw-portal-main-h1">
              ماذا تحتاج اليوم؟ اختر القسم للدخول
            </h2>
            <p>اضغط على أي جزء لاستعراض تفاصيل القسم وأدواته مباشرة.</p>
          </div>

          {/* لوحة بانورامية واحدة مقسومة إلى 6 أعمدة متصلة تفاعلية عند مرور الماوس */}
          <div
            className={`pw-split-stage ${hoveredSlug ? 'has-active' : ''}`}
            style={
              activeHoverSection
                ? ({ '--stage-accent': activeHoverSection.accent } as React.CSSProperties)
                : undefined
            }
            onPointerMove={handleStagePointerMove}
            onPointerLeave={(e) => resetStagePointer(e.currentTarget)}
          >
            {/* طبقة الصورة الموحدة والانتقال السلس لصورة القسم المختار */}
            <div className="pw-split-backdrop" aria-hidden="true">
              <img
                src="/sections/panorama.jpg"
                alt="منظومة فاي تك المعمارية المتكاملة"
                width={1600}
                height={900}
                loading="eager"
                decoding="async"
                className={`pw-split-bg-base ${hoveredSlug ? 'is-faded' : ''}`}
              />
              {PORTAL_SECTIONS.map((sec) => (
                <img
                  key={sec.slug}
                  src={sec.image}
                  alt=""
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className={`pw-split-bg-layer ${hoveredSlug === sec.slug ? 'is-visible' : ''}`}
                />
              ))}
              <div className="pw-split-scrim" />
              <div className="pw-split-cursor-glow" />
            </div>

            {/* الأعمدة الستة المقسمة بخطوط بيضاء رفيعة فوق الصورة البانورامية */}
            <div className={`pw-split-cols ${hoveredSlug ? 'has-active' : ''}`}>
              {PORTAL_SECTIONS.map((sec) => {
                const isActive = hoveredSlug === sec.slug;
                return (
                  <Link
                    key={sec.slug}
                    href={sec.href}
                    className={`pw-split-col ${isActive ? 'is-active' : ''}`}
                    style={{ '--col-accent': sec.accent } as React.CSSProperties}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== 'touch') setHoveredSlug(sec.slug);
                    }}
                    onFocus={() => setHoveredSlug(sec.slug)}
                    onBlur={() => setHoveredSlug((prev) => (prev === sec.slug ? null : prev))}
                  >
                    <div className="pw-split-col-inner">
                      <span className="pw-split-num">
                        <span aria-hidden="true">{sec.icon}</span>
                        <span>{sec.num}</span>
                      </span>
                      <h2>{sec.title}</h2>
                      <div className="pw-split-reveal">
                        <p className="pw-split-hint">{sec.guideHint}</p>
                        <div className="pw-split-tags" aria-hidden="true">
                          {sec.highlights.map((tag) => (
                            <span key={tag} className="pw-split-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="pw-split-cta">
                          <span>ادخل القسم</span>
                          <span aria-hidden="true">←</span>
                        </span>
                      </div>
                      <span className="pw-split-mobile-cue" aria-hidden="true">
                        عرض التفاصيل ←
                      </span>
                    </div>
                    <span className="pw-split-bar" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 2. أهم العروض والباقات الحصرية */}
      <section className="pw-section pw-tint" aria-labelledby="offers-heading" style={{ paddingBlock: '56px' }}>
        <div className="pw-wrap">
          <div className="pw-head" style={{ marginBottom: '32px' }}>
            <p className="pw-eyebrow">أهم العروض التوفيرية</p>
            <h2 id="offers-heading">أبرز الباقات الذكية والعروض الحالية</h2>
          </div>

          <div className="pw-offers-grid">
            {SMART_BUNDLES.map((bundle) => (
              <article key={bundle.id} className="pw-offer-card">
                <div>
                  <span className="pw-re-hot">{bundle.badge}</span>
                  <h3>{bundle.title}</h3>
                  <p>{bundle.subtitle}</p>
                  <ul className="pw-re-features">
                    {bundle.items.slice(0, 3).map((it) => (
                      <li key={it}>✓ {it}</li>
                    ))}
                  </ul>
                </div>
                <div className="pw-offer-actions">
                  <button
                    type="button"
                    className="pw-btn pw-btn-primary"
                    onClick={() => {
                      const itemsList: { product: WebsiteProduct; qty: number }[] = [];
                      for (const ref of bundle.productIds) {
                        const found = products.find((p) => p.id === ref.productId);
                        if (found) itemsList.push({ product: found, qty: ref.qty });
                      }
                      if (itemsList.length > 0) onAddBundleToCart(itemsList, true);
                    }}
                  >
                    🛒 أضف الباقة للسلة
                  </button>
                  <button
                    type="button"
                    className="pw-btn pw-btn-ghost"
                    onClick={() => openWhatsApp(`أريد الاستفسار عن عرض (${bundle.title}).`)}
                  >
                    واتساب
                  </button>
                </div>
              </article>
            ))}

            <article className="pw-offer-card is-highlight">
              <div>
                <span className="pw-re-hot">🔥 عرض التعاقد المتكامل 3×1</span>
                <h3>خصم 7% على التعاقد الهندسي المتكامل + مخططات تنفيذية</h3>
                <p>
                  نفّذ الإنشاءات والتشطيبات والكهروميكانيك من جهة واحدة واحصل على خصم مباشر ومنع أي تكسير.
                </p>
                <ul className="pw-re-features">
                  <li>✓ تنسيق التكييف المخفي والسباكة قبل الصب</li>
                  <li>✓ ضمان موحّد وإشراف هندسي يومي</li>
                  <li>✓ خصم فوري عند الجمع بين النطاقات الثلاثة</li>
                </ul>
              </div>
              <div className="pw-offer-actions">
                <Link href="/sections/contracting" className="pw-btn pw-btn-primary">
                  🏗️ ادخل قسم المقاولات ←
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 3. أهم المنتجات الأكثر طلباً */}
      <section className="pw-section" aria-labelledby="featured-products-heading" style={{ paddingBlock: '56px' }}>
        <div className="pw-wrap">
          <div className="pw-head" style={{ marginBottom: '26px' }}>
            <p className="pw-eyebrow">أهم المنتجات</p>
            <h2 id="featured-products-heading">أكثر المنتجات طلباً في المتجر</h2>
          </div>

          <div className="pw-chip-bar" style={{ justifyContent: 'center' }}>
            {[
              { id: 'all', label: '⭐ الأبرز' },
              { id: 'smart', label: '📱 سمارت هوم وأمان' },
              { id: 'mep', label: '⚡ كهرباء وسباكة' },
              { id: 'finishing', label: '🎨 دهانات وبورسلان وديكور' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`pw-chip ${featuredTab === t.id ? 'is-on' : ''}`}
                onClick={() => setFeaturedTab(t.id as typeof featuredTab)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="pw-prod-grid">
            {featuredProducts.map((p) => {
              const withInstall = Boolean(featuredInstallMap[p.id]);
              return (
                <article key={p.id} className="pw-prod-card">
                  <div>
                    <div className="pw-prod-top">
                      <span className="pw-prod-code">{p.code}</span>
                      {p.badge && <span className="pw-prod-badge">{p.badge}</span>}
                    </div>
                    <h3>{p.name}</h3>
                    <p className="pw-prod-desc">{p.description}</p>
                  </div>

                  <div className="pw-prod-foot">
                    <label className="pw-prod-install-check">
                      <input
                        type="checkbox"
                        checked={withInstall}
                        onChange={() =>
                          setFeaturedInstallMap((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                        }
                      />
                      <span>توريد + تركيب هندسي</span>
                    </label>
                    <div className="pw-prod-actions">
                      <button
                        type="button"
                        className="pw-btn pw-btn-primary"
                        style={{ flex: 1, minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                        onClick={() => onAddToCart(p, 1, withInstall)}
                      >
                        🛒 أضف للسلة
                      </button>
                      <button
                        type="button"
                        className="pw-btn pw-btn-ghost"
                        style={{ minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                        onClick={() => openWhatsApp(`أريد سعر وطلب المنتج: ${p.name} (${p.code})`)}
                      >
                        السعر
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
            <Link href="/store" className="pw-btn pw-btn-primary">
              🛒 استعرض جميع المنتجات ({products.length} منتج وعرض) ←
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
