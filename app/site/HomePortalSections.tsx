"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { SMART_BUNDLES, type WebsiteProduct, type WebsiteProperty } from './store-catalog';
import { PORTAL_SECTIONS, type SectionSlug } from './section-defs';
import NewsTicker from './NewsTicker';
import { DEFAULT_NEWS_TICKER, type NewsTickerConfig } from './site-content';

interface HomePortalSectionsProps {
  products: WebsiteProduct[];
  properties: WebsiteProperty[];
  newsTicker?: NewsTickerConfig;
  whatsappNumber: string;
  onAddToCart: (product: WebsiteProduct, qty: number, withInstall: boolean) => void;
  onAddBundleToCart: (items: { product: WebsiteProduct; qty: number }[], withInstall: boolean) => void;
}

export default function HomePortalSections({
  products,
  properties,
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

  // --- تفاعل الماوس والترابط البصري بين صور الأقسام الستة ---
  const [hoveredSlug, setHoveredSlug] = useState<SectionSlug | null>(null);

  const activeHoverSection = useMemo(
    () => (hoveredSlug ? PORTAL_SECTIONS.find((s) => s.slug === hoveredSlug) || null : null),
    [hoveredSlug]
  );

  const relatedSlugSet = useMemo(
    () => new Set<SectionSlug>(activeHoverSection?.related || []),
    [activeHoverSection]
  );

  const relatedSectionObjects = useMemo(
    () => (activeHoverSection ? PORTAL_SECTIONS.filter((s) => relatedSlugSet.has(s.slug)) : []),
    [activeHoverSection, relatedSlugSet]
  );

  const handleTilePointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType === 'touch') return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const mx = (nx - 0.5) * 2;
    const my = (ny - 0.5) * 2;
    el.style.setProperty('--px', `${(nx * 100).toFixed(1)}%`);
    el.style.setProperty('--py', `${(ny * 100).toFixed(1)}%`);
    el.style.setProperty('--mx', mx.toFixed(3));
    el.style.setProperty('--my', my.toFixed(3));
    el.style.setProperty('--rx', `${(-my * 3.6).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(mx * 4.2).toFixed(2)}deg`);
  };

  const resetTileTransform = (el: HTMLAnchorElement, slug: SectionSlug) => {
    el.style.removeProperty('--px');
    el.style.removeProperty('--py');
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
    setHoveredSlug((prev) => (prev === slug ? null : prev));
  };

  // --- مستشار تفاعلي مضغوط وسهل جداً يوجه العميل للقسم المناسب ---
  const [quickGoal, setQuickGoal] = useState<SectionSlug>('maintenance');
  const [quickArea, setQuickArea] = useState<number>(180);

  const quickSummary = useMemo(() => {
    const meta = PORTAL_SECTIONS.find((s) => s.slug === quickGoal) || PORTAL_SECTIONS[0];
    if (quickGoal === 'maintenance') {
      return {
        meta,
        hint: `معاينة وتنفيذ أو صيانة مضمونة لمساحة ${quickArea} م² خلال 24 ساعة مع توصية هندسية مجانية.`,
      };
    }
    if (quickGoal === 'contracting') {
      return {
        meta,
        hint: `تقدير مبسط لمساحة ${quickArea} م²: ~${Math.round(quickArea * 0.046)} طن حديد · ~${Math.round(quickArea * 0.42)} م³ خرسانة · تكييف ~${Math.max(2, Math.round(quickArea / 18))} طن.`,
      };
    }
    if (quickGoal === 'real-estate') {
      return {
        meta,
        hint: `${properties.length} وحدات سكنية وتجارية جاهزة بأنظمة سداد تبدأ من 20% مقدم وتقسيط حتى 4 سنوات.`,
      };
    }
    if (quickGoal === 'materials') {
      return {
        meta,
        hint: `توريد مباشر لخامات مساحة ${quickArea} م² بسعر الجملة، أو عرض خاماتك للبيع لدينا فوراً.`,
      };
    }
    if (quickGoal === 'smart-home') {
      return {
        meta,
        hint: `ترقية وحدة ${quickArea} م² بنظام سمارت هوم كامل (${Math.max(3, Math.round(quickArea / 40))} غرف ذكية + درع أمان الغاز والمياه بدون تكسير).`,
      };
    }
    return {
      meta,
      hint: 'تصفح نصائح المهندسين الذهبية، احسب كميات الحديد والبلاط مجاناً، أو راجع دليل الاستلام.',
    };
  }, [quickGoal, quickArea, properties.length]);

  return (
    <>
      {/* 1. مربعات الأقسام الستة الرئيسية — واجهة فتح الموقع بدون أي زحمة */}
      <section id="portals" className="pw-section pw-portal-gateway" aria-labelledby="portals-heading">
        <div className="pw-wrap">
          <NewsTicker config={newsTicker} />

          <div className="pw-head" style={{ marginBottom: '28px' }}>
            <p className="pw-eyebrow">أهلاً بك في فاي تك — اختر قسمك مباشرة</p>
            <h1 id="portals-heading" className="pw-portal-main-h1">
              ماذا تحتاج اليوم؟ اختر القسم للدخول
            </h1>
            <p>اضغط على المربع المناسب لطلبك، وهتلاقي جواه كل التفاصيل والأدوات اللي تخصه وبس.</p>
          </div>

          <div
            className="pw-portal-mosaic-frame"
            style={
              activeHoverSection
                ? ({ '--mosaic-active': activeHoverSection.accent } as React.CSSProperties)
                : undefined
            }
          >
            <div className={`pw-portal-clean-grid ${hoveredSlug ? 'has-hover' : ''}`}>
              {PORTAL_SECTIONS.map((sec, idx) => {
                const isHovered = hoveredSlug === sec.slug;
                const isRelated = hoveredSlug !== null && !isHovered && relatedSlugSet.has(sec.slug);
                const isDimmed = hoveredSlug !== null && !isHovered && !isRelated;

                const colInRow = idx % 3;
                const row = Math.floor(idx / 3);
                // في RTL يبدأ الصف من اليمين إلى اليسار (الخانة الأولى تقع في الشريحة الأيمن 800..1200)
                const sliceX = (2 - colInRow) * 400;
                const sliceY = row * 225;

                const nextHorizontal = colInRow < 2 ? PORTAL_SECTIONS[idx + 1] : null;
                const hBridgeActive = Boolean(
                  nextHorizontal &&
                    activeHoverSection &&
                    ((activeHoverSection.slug === sec.slug && sec.related.includes(nextHorizontal.slug)) ||
                      (activeHoverSection.slug === nextHorizontal.slug &&
                        nextHorizontal.related.includes(sec.slug)))
                );

                const nextVertical = row === 0 ? PORTAL_SECTIONS[idx + 3] : null;
                const vBridgeActive = Boolean(
                  nextVertical &&
                    activeHoverSection &&
                    ((activeHoverSection.slug === sec.slug && sec.related.includes(nextVertical.slug)) ||
                      (activeHoverSection.slug === nextVertical.slug &&
                        nextVertical.related.includes(sec.slug)))
                );

                return (
                  <div
                    key={sec.slug}
                    className={`pw-portal-slot ${isHovered ? 'is-hovered' : ''} ${isRelated ? 'is-related' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                    style={{ '--portal-accent': sec.accent } as React.CSSProperties}
                  >
                    <Link
                      href={sec.href}
                      className="pw-portal-box"
                      onPointerEnter={(e) => {
                        if (e.pointerType !== 'touch') setHoveredSlug(sec.slug);
                      }}
                      onPointerMove={handleTilePointerMove}
                      onPointerLeave={(e) => resetTileTransform(e.currentTarget, sec.slug)}
                      onFocus={() => setHoveredSlug(sec.slug)}
                      onBlur={(e) => resetTileTransform(e.currentTarget, sec.slug)}
                    >
                      <div className="pw-portal-media">
                        <img
                          src={sec.image}
                          alt={sec.imageAlt}
                          width={1280}
                          height={720}
                          loading={idx < 3 ? 'eager' : 'lazy'}
                          decoding="async"
                        />
                        <div className="pw-portal-media-scrim" aria-hidden="true" />
                        <div className="pw-portal-spotlight" aria-hidden="true" />

                        {/* شبكة المسارات المعمارية المتصلة عبر حدود الصور الستة */}
                        <svg
                          className="pw-portal-cad-svg"
                          viewBox={`${sliceX} ${sliceY} 400 225`}
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <path
                            className="pw-cad-rail"
                            d="M 1200 112 L 0 112 M 1200 337 L 0 337 M 1000 0 L 1000 450 M 600 0 L 600 450 M 200 0 L 200 450"
                          />
                          <path
                            className="pw-cad-wave"
                            d="M 1200 112 C 1100 58, 900 166, 800 112 C 700 58, 500 166, 400 112 C 300 58, 100 166, 0 112"
                          />
                          <path
                            className="pw-cad-wave"
                            d="M 1200 337 C 1100 283, 900 391, 800 337 C 700 283, 500 391, 400 337 C 300 283, 100 391, 0 337"
                          />
                          <circle className="pw-cad-node" cx="1000" cy="112" r="24" />
                          <circle className="pw-cad-node" cx="600" cy="112" r="24" />
                          <circle className="pw-cad-node" cx="200" cy="112" r="24" />
                          <circle className="pw-cad-node" cx="1000" cy="337" r="24" />
                          <circle className="pw-cad-node" cx="600" cy="337" r="24" />
                          <circle className="pw-cad-node" cx="200" cy="337" r="24" />
                        </svg>

                        {/* زوايا عدسة تحديد تفاعلية تظهر عند تمرير الماوس */}
                        <div className="pw-portal-reticle" aria-hidden="true">
                          <span className="r-tl" />
                          <span className="r-tr" />
                          <span className="r-bl" />
                          <span className="r-br" />
                        </div>

                        <div className="pw-portal-media-top">
                          <span className="pw-portal-icon" aria-hidden="true">
                            {sec.icon}
                          </span>
                          <span className="pw-portal-num">
                            {isRelated ? `مترابط · ${sec.num}` : sec.num}
                          </span>
                        </div>

                        {/* شريط مميزات سريع ينزلق داخل الصورة عند التفاعل */}
                        <div className="pw-portal-media-dock" aria-hidden="true">
                          {sec.highlights.map((tag) => (
                            <span key={tag} className="pw-portal-dock-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pw-portal-body">
                        <h2>{sec.title}</h2>
                        <p className="pw-portal-guide">{sec.guideHint}</p>
                        <p className="pw-portal-flow-note">
                          <span className="pw-portal-flow-dot" aria-hidden="true" />
                          {isRelated && activeHoverSection
                            ? `يتكامل مباشرة مع ${activeHoverSection.title}`
                            : sec.flowNote}
                        </p>
                        <span className="pw-portal-enter">
                          <span>ادخل القسم</span>
                          <span aria-hidden="true">←</span>
                        </span>
                      </div>
                    </Link>

                    {/* وصلات الربط المعمارية بين أجزاء الصور المتجاورة أفقياً ورأسياً */}
                    {nextHorizontal && (
                      <span
                        className={`pw-seam-bridge ${hBridgeActive ? 'is-lit' : ''}`}
                        aria-hidden="true"
                      >
                        <span className="pw-seam-dot" />
                      </span>
                    )}
                    {nextVertical && (
                      <span
                        className={`pw-vertical-bridge ${vBridgeActive ? 'is-lit' : ''}`}
                        aria-hidden="true"
                      >
                        <span className="pw-seam-dot" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* شريط حي يوضح ترابط الأجزاء عند الوقوف بالماوس على أي صورة */}
            <div className="pw-mosaic-status" aria-live="polite">
              {activeHoverSection ? (
                <>
                  <span className="pw-mosaic-status-lead">
                    <span>{activeHoverSection.icon}</span>
                    <strong>{activeHoverSection.title}</strong>
                    <span className="pw-mosaic-status-sep">·</span>
                    <span>مترابط مع:</span>
                  </span>
                  <div className="pw-mosaic-links">
                    {relatedSectionObjects.map((rel) => (
                      <span
                        key={rel.slug}
                        className="pw-mosaic-link-pill"
                        style={{ '--pill-accent': rel.accent } as React.CSSProperties}
                      >
                        <span className="pw-mosaic-link-dot" aria-hidden="true" />
                        {rel.icon} {rel.title}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <span className="pw-mosaic-idle-hint">
                  ✨ مرّر الماوس فوق أي قسم لاكتشاف الترابط الهندسي التفاعلي بين جميع أجزاء المنظومة
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. أداة تفاعلية مبسطة ومختصرة لتوجيه العميل */}
      <section className="pw-section pw-tint" style={{ paddingBlock: '48px' }}>
        <div className="pw-wrap">
          <div className="pw-quick-finder">
            <div className="pw-quick-finder-head">
              <div>
                <span className="pw-explorer-kicker">أداة سريعة في 10 ثوانٍ</span>
                <h2>احسب احتياجك أو اوصل لطلبك فوراً</h2>
              </div>
              <Link href={quickSummary.meta.href} className="pw-btn pw-btn-primary">
                {quickSummary.meta.icon} ادخل على {quickSummary.meta.title} ←
              </Link>
            </div>

            <div className="pw-quick-finder-controls">
              <div className="pw-seg">
                {PORTAL_SECTIONS.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    className={quickGoal === s.slug ? 'is-on' : ''}
                    onClick={() => setQuickGoal(s.slug)}
                  >
                    {s.icon} {s.title.replace('قسم ', '')}
                  </button>
                ))}
              </div>
              <label className="pw-range" style={{ minWidth: '220px' }}>
                <span>المساحة التقريبية: <strong>{quickArea} م²</strong></span>
                <input
                  type="range"
                  min={60}
                  max={800}
                  step={10}
                  value={quickArea}
                  onChange={(e) => setQuickArea(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="pw-quick-finder-result">
              <span>{quickSummary.hint}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. أهم العروض والباقات الحصرية */}
      <section className="pw-section" aria-labelledby="offers-heading" style={{ paddingBlock: '56px' }}>
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

      {/* 4. أهم المنتجات الأكثر طلباً */}
      <section className="pw-section pw-tint" aria-labelledby="featured-products-heading" style={{ paddingBlock: '56px' }}>
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
