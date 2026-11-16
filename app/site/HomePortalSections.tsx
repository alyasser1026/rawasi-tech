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

          <div className="pw-portal-clean-grid">
            {PORTAL_SECTIONS.map((sec, idx) => (
              <Link
                key={sec.slug}
                href={sec.href}
                className="pw-portal-box"
                style={{ '--portal-accent': sec.accent } as React.CSSProperties}
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
                  <div className="pw-portal-media-top">
                    <span className="pw-portal-icon" aria-hidden="true">
                      {sec.icon}
                    </span>
                    <span className="pw-portal-num">{sec.num}</span>
                  </div>
                </div>
                <div className="pw-portal-body">
                  <h2>{sec.title}</h2>
                  <p className="pw-portal-guide">{sec.guideHint}</p>
                  <span className="pw-portal-enter">
                    <span>ادخل القسم</span>
                    <span aria-hidden="true">←</span>
                  </span>
                </div>
              </Link>
            ))}
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
