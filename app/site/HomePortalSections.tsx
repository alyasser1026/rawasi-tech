"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  // Track the visible service without taking control of page scrolling.
  const [hoveredSlug, setHoveredSlug] = useState<SectionSlug | null>(null);
  const [scrolledSlug, setScrolledSlug] = useState<SectionSlug | null>('maintenance');
  const [visibleSlugs, setVisibleSlugs] = useState<Record<string, boolean>>({ maintenance: true });
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  const activeSlug = hoveredSlug ?? scrolledSlug;

  const activeHoverSection = useMemo(
    () => (activeSlug ? PORTAL_SECTIONS.find((s) => s.slug === activeSlug) || null : null),
    [activeSlug]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slug = entry.target.getAttribute('data-section-slug') as SectionSlug | null;
          if (!slug) continue;
          if (entry.isIntersecting) {
            setScrolledSlug(slug);
            setVisibleSlugs((prev) => (prev[slug] ? prev : { ...prev, [slug]: true }));
          }
        }
      },
      { rootMargin: '-18% 0px -22% 0px', threshold: 0.18 }
    );

    for (const sec of PORTAL_SECTIONS) {
      const el = rowRefs.current[sec.slug];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`pw-split-stage ${activeSlug ? 'has-active' : ''}`}
      style={
        activeHoverSection
          ? ({ '--stage-accent': activeHoverSection.accent } as React.CSSProperties)
          : undefined
      }
      onPointerLeave={() => setHoveredSlug(null)}
    >
      <section id="portals" className="pw-portal-gateway" aria-labelledby="portals-heading">
        <div className="pw-wrap pw-panoramic-top-overlay">
          <NewsTicker config={newsTicker} />

          <div className="pw-panoramic-floating-hero">
            <div className="pw-panoramic-eyebrow-row">
              <p className="pw-eyebrow" style={{ marginBottom: 0 }}>فاي تك للمقاولات والتوريدات</p>
            </div>
            <h1 id="portals-heading" className="pw-portal-main-h1">
              من الأساس، نبني مشروعك.
            </h1>
            <p className="pw-panoramic-sub">
              تنفيذ وإشراف هندسي للمشروعات السكنية والتجارية، بخطوات واضحة من الفكرة للتسليم.
            </p>
          </div>
          <a className="pw-construction-scroll-cue" href="#portal-station-maintenance">
            <span>اكتشف خدماتنا</span><span aria-hidden="true">↓</span>
          </a>
        </div>

        {/* الأقسام الستة: تطفو مباشرة فوق المشهد الثلاثي الأبعاد بدون صور خلفية تحجب البناء */}
        <div className={`pw-split-cols ${activeSlug ? 'has-active' : ''}`}>
          {PORTAL_SECTIONS.map((sec, idx) => {
            const isActive = activeSlug === sec.slug;
            const isInView = Boolean(visibleSlugs[sec.slug]);
            const sideClass = idx % 2 === 0 ? 'is-side-right' : 'is-side-left';
            return (
              <article
                key={sec.slug}
                id={`portal-station-${sec.slug}`}
                data-section-slug={sec.slug}
                ref={(el) => {
                  rowRefs.current[sec.slug] = el;
                }}
                className={`pw-split-station-row ${sideClass} ${isActive ? 'is-row-active' : ''} ${isInView ? 'is-in-view' : ''}`}
                style={{ '--col-accent': sec.accent } as React.CSSProperties}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'touch') setHoveredSlug(sec.slug);
                }}
              >
                {/* تظليل جانبي خفيف وشفاف فقط لإبراز نص القسم مع إبقاء مشهد الـ 3D واضحاً بالكامل في الخلفية */}
                <div className="pw-sec-photo-canvas" aria-hidden="true">
                  <div className={`pw-sec-photo-shade ${sideClass}`} />
                </div>

                {/* النص والهنت العائم مباشرة فوق صورة القسم بدون أي حاوية أو إطار */}
                <div className="pw-wrap pw-sec-floating-wrap">
                  <Link
                    href={sec.href}
                    className={`pw-split-col ${sideClass} ${isActive ? 'is-active' : ''}`}
                    onFocus={() => setHoveredSlug(sec.slug)}
                    onBlur={() => setHoveredSlug((prev) => (prev === sec.slug ? null : prev))}
                  >
                    <div className="pw-split-col-inner">
                      <span className="pw-split-num">
                        <span aria-hidden="true">{sec.icon}</span>
                        <span>{sec.num}</span>
                        <span>·</span>
                        <span>{sec.flowNote}</span>
                      </span>

                      <h2>{sec.title}</h2>

                      <div className="pw-split-reveal">
                        <p className="pw-split-hint">{sec.guideHint}</p>
                        <p className="pw-split-inline-tags" aria-hidden="true">
                          {sec.highlights.join('  ·  ')}
                        </p>
                        <span className="pw-split-cta">
                          <span>ادخل {sec.title}</span>
                          <span aria-hidden="true">←</span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 2. أهم العروض والباقات الحصرية */}
      <section className="pw-section pw-panoramic-glass-band" aria-labelledby="offers-heading" style={{ paddingBlock: '56px' }}>
        <div className="pw-wrap">
          <div className="pw-head pw-panoramic-band-head" style={{ marginBottom: '32px' }}>
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
      <section className="pw-section pw-panoramic-glass-band" aria-labelledby="featured-products-heading" style={{ paddingBlock: '56px' }}>
        <div className="pw-wrap">
          <div className="pw-head pw-panoramic-band-head" style={{ marginBottom: '26px' }}>
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
    </div>
  );
}
