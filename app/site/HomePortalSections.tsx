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
  onReplayLogoMotion?: () => void;
}

export default function HomePortalSections({
  products,
  properties = [],
  newsTicker = DEFAULT_NEWS_TICKER,
  whatsappNumber,
  onAddToCart,
  onAddBundleToCart,
  onReplayLogoMotion,
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

  // --- تفاعل الخلفية البانورامية الممتدة من الهيدر لآخر الصفحة مع الماوس والسكرول ---
  const [hoveredSlug, setHoveredSlug] = useState<SectionSlug | null>(null);
  const [scrolledSlug, setScrolledSlug] = useState<SectionSlug | null>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  // حالات تفاعلية للمكونات المصغرة الدالة على كل قسم (يمين وشمال)
  const [mntPreviewTrade, setMntPreviewTrade] = useState<'elec' | 'hvac' | 'plumb'>('elec');
  const [cntStageIdx, setCntStageIdx] = useState<number>(0);
  const [reUnitType, setReUnitType] = useState<'apt' | 'duplex' | 'comm'>('apt');
  const [matMode, setMatMode] = useState<'buy' | 'sell'>('buy');
  const [smartState, setSmartState] = useState({ lock: true, ac: true, cam: true });
  const [infoArea, setInfoArea] = useState<number>(160);

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
          if (entry.isIntersecting) {
            const slug = entry.target.getAttribute('data-section-slug') as SectionSlug | null;
            if (slug) setScrolledSlug(slug);
          }
        }
      },
      { rootMargin: '-28% 0px -38% 0px', threshold: 0.15 }
    );

    for (const sec of PORTAL_SECTIONS) {
      const el = rowRefs.current[sec.slug];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - window.innerHeight * 0.5) / Math.max(window.innerHeight, 1)) + 0.5);
    const mx = (nx - 0.5) * 2;
    const my = (ny - 0.5) * 2;
    el.style.setProperty('--stage-px', `${(nx * 100).toFixed(1)}%`);
    el.style.setProperty('--stage-py', `${(Math.max(0, Math.min(1, ny)) * 100).toFixed(1)}%`);
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

  const stopLinkNav = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const renderSectionIndicator = (slug: SectionSlug) => {
    switch (slug) {
      case 'maintenance': {
        const trades = {
          elec: { label: '⚡ كهرباء ولوحات', status: 'فحص الأحمال والاتزان الحراري بدون تكسير', badge: 'ضمان هندسي معتمد' },
          hvac: { label: '❄️ تكييف مخفي واسبليت', status: 'تأسيس دكت الصاج والعزل وصيانة الفريون والتصريف', badge: 'معاينة موقعية' },
          plumb: { label: '🚰 سباكة وعزل', status: 'اختبار ضغط المواسير وكشف التسريبات بأجهزة دقيقة', badge: 'قطع غيار أصلية' },
        };
        const current = trades[mntPreviewTrade];
        return (
          <div className="pw-sec-widget" onClick={stopLinkNav}>
            <div className="pw-sec-widget-head">
              <span className="pw-sec-widget-dot" />
              <strong>مُشخّص الأعطال والبنود الفوري</strong>
              <span className="pw-sec-widget-pill">{current.badge}</span>
            </div>
            <div className="pw-sec-widget-tabs">
              {(['elec', 'hvac', 'plumb'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`pw-sec-wtab ${mntPreviewTrade === k ? 'is-on' : ''}`}
                  onClick={(e) => {
                    stopLinkNav(e);
                    setMntPreviewTrade(k);
                  }}
                >
                  {trades[k].label}
                </button>
              ))}
            </div>
            <div className="pw-sec-widget-box">
              <span>نطاق التدخل الهندسي:</span>
              <p>{current.status}</p>
            </div>
          </div>
        );
      }

      case 'contracting': {
        const stages = [
          { name: '١. الهيكل الخرساني والعظم', pct: '100%', note: 'إشراف مساحي واختبار إجهاد الخرسانة والحديد' },
          { name: '٢. المباني والعزل المائي والحراري', pct: '75%', note: 'استلام البؤج والأوتار وعزل الأسطح والحمامات' },
          { name: '٣. تأسيس الكهروميكانيك والتكييف المخفي', pct: '85%', note: 'مخططات Shop Drawings تمنع أي تكسير لاحق' },
          { name: '٤. التشطيب الفندقي والمجسم 3D', pct: '95%', note: 'معاينة الغرف ثلاثية الأبعاد وحاسبة مقايسة فورية' },
        ];
        const st = stages[cntStageIdx] || stages[0];
        return (
          <div className="pw-sec-widget" onClick={stopLinkNav}>
            <div className="pw-sec-widget-head">
              <span className="pw-sec-widget-dot" />
              <strong>مؤشر مراحل المقاولات والمجسم 3D</strong>
              <span className="pw-sec-widget-pill">عظم + تشطيب متكامل</span>
            </div>
            <div className="pw-sec-widget-tabs">
              {stages.map((item, idx) => (
                <button
                  key={item.name}
                  type="button"
                  className={`pw-sec-wtab ${cntStageIdx === idx ? 'is-on' : ''}`}
                  onClick={(e) => {
                    stopLinkNav(e);
                    setCntStageIdx(idx);
                  }}
                >
                  مرحلة {idx + 1}
                </button>
              ))}
            </div>
            <div className="pw-sec-widget-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <strong>{st.name}</strong>
                <span className="pw-sec-widget-kpi">دقة التنفيذ {st.pct}</span>
              </div>
              <p>{st.note}</p>
            </div>
          </div>
        );
      }

      case 'real-estate': {
        const sampleProp = properties[0];
        const specs = {
          apt: { title: sampleProp?.title || 'شقق تمليك فندقية فاخرة', area: '155م² – 220م²', plan: 'مقدم 15% وتقسيط حتى 6 سنوات' },
          duplex: { title: 'دوبلكس وبنتهاوس بإطلالة مفتوحة', area: '260م² – 380م²', plan: 'استلام فوري وتشطيب سمارت هوم' },
          comm: { title: 'مقرات إدارية ومعارض تجارية', area: '95م² – 310م²', plan: 'مواقع رئيسية بعائد استثماري مرتفع' },
        };
        const cur = specs[reUnitType];
        return (
          <div className="pw-sec-widget" onClick={stopLinkNav}>
            <div className="pw-sec-widget-head">
              <span className="pw-sec-widget-dot" />
              <strong>مستكشف الوحدات وحاسبة الأقساط</strong>
              <span className="pw-sec-widget-pill">{properties.length || 6}+ وحدات متاحة</span>
            </div>
            <div className="pw-sec-widget-tabs">
              {[
                { id: 'apt', label: '🏢 شقق فاخرة' },
                { id: 'duplex', label: '🏡 دوبلكس' },
                { id: 'comm', label: '🏬 تجاري وإداري' },
              ].map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`pw-sec-wtab ${reUnitType === u.id ? 'is-on' : ''}`}
                  onClick={(e) => {
                    stopLinkNav(e);
                    setReUnitType(u.id as typeof reUnitType);
                  }}
                >
                  {u.label}
                </button>
              ))}
            </div>
            <div className="pw-sec-widget-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <strong>{cur.title}</strong>
                <span className="pw-sec-widget-kpi">{cur.area}</span>
              </div>
              <p>{cur.plan}</p>
            </div>
          </div>
        );
      }

      case 'materials': {
        return (
          <div className="pw-sec-widget" onClick={stopLinkNav}>
            <div className="pw-sec-widget-head">
              <span className="pw-sec-widget-dot" />
              <strong>منصة توريد وشراء مواد البناء</strong>
              <span className="pw-sec-widget-pill">تسعير مباشر للموقع</span>
            </div>
            <div className="pw-sec-widget-tabs">
              <button
                type="button"
                className={`pw-sec-wtab ${matMode === 'buy' ? 'is-on' : ''}`}
                onClick={(e) => {
                  stopLinkNav(e);
                  setMatMode('buy');
                }}
              >
                📦 شراء وتوريد خامات لموقعك
              </button>
              <button
                type="button"
                className={`pw-sec-wtab ${matMode === 'sell' ? 'is-on' : ''}`}
                onClick={(e) => {
                  stopLinkNav(e);
                  setMatMode('sell');
                }}
              >
                🤝 اعرض خاماتك للبيع لدينا
              </button>
            </div>
            <div className="pw-sec-widget-box">
              {matMode === 'buy' ? (
                <p>دهانات جوتن · بورسلان ورخام · كابلات السويدي · مواسير وعوازل معتمدة بتوريد مباشر للمشروع.</p>
              ) : (
                <p>لديك فائض خامات أو مصنع/مورد؟ أرسل عرض السعر والكمية وسيتواصل معك قسم المشتريات فوراً.</p>
              )}
            </div>
          </div>
        );
      }

      case 'smart-home': {
        return (
          <div className="pw-sec-widget" onClick={stopLinkNav}>
            <div className="pw-sec-widget-head">
              <span className="pw-sec-widget-dot" />
              <strong>لوحة تجربة السمارت هوم التفاعلية</strong>
              <span className="pw-sec-widget-pill">جرّب التحكم الآن</span>
            </div>
            <div className="pw-sec-widget-tabs">
              <button
                type="button"
                className={`pw-sec-wtab ${smartState.lock ? 'is-on' : ''}`}
                onClick={(e) => {
                  stopLinkNav(e);
                  setSmartState((s) => ({ ...s, lock: !s.lock }));
                }}
              >
                🔐 القفل الذكي: {smartState.lock ? 'مؤمّن بالبصمة' : 'مفتوح'}
              </button>
              <button
                type="button"
                className={`pw-sec-wtab ${smartState.ac ? 'is-on' : ''}`}
                onClick={(e) => {
                  stopLinkNav(e);
                  setSmartState((s) => ({ ...s, ac: !s.ac }));
                }}
              >
                ❄️ التكييف الذكي: {smartState.ac ? '22°C نشط' : 'إيقاف'}
              </button>
              <button
                type="button"
                className={`pw-sec-wtab ${smartState.cam ? 'is-on' : ''}`}
                onClick={(e) => {
                  stopLinkNav(e);
                  setSmartState((s) => ({ ...s, cam: !s.cam }));
                }}
              >
                🛡️ حساسات الغاز والمياه: {smartState.cam ? 'حماية تلقائية' : 'تنبيه'}
              </button>
            </div>
            <div className="pw-sec-widget-box">
              <p>أقفال ذكية، مفاتيح زجاجية بدون تكسير، كاميرات 4K، ومحابس تفصل الغاز والمياه تلقائياً عند الطوارئ.</p>
            </div>
          </div>
        );
      }

      case 'info': {
        const estTiles = Math.round(infoArea * 1.12);
        const estPaintBuckets = Math.max(4, Math.round(infoArea / 22));
        return (
          <div className="pw-sec-widget" onClick={stopLinkNav}>
            <div className="pw-sec-widget-head">
              <span className="pw-sec-widget-dot" />
              <strong>معاينة حاسبة المهندس ودليل الفحص</strong>
              <span className="pw-sec-widget-pill">أدوات مجانية 100%</span>
            </div>
            <div className="pw-sec-widget-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span>حرّك لاختبار مساحة وحدتك:</span>
                <strong className="pw-sec-widget-kpi">{infoArea} م²</strong>
              </div>
              <input
                type="range"
                min={70}
                max={420}
                step={10}
                value={infoArea}
                onChange={(e) => setInfoArea(Number(e.target.value))}
                onClick={stopLinkNav}
                aria-label="مساحة الوحدة بالمتر المربع"
                style={{ width: '100%', accentColor: '#c75517', cursor: 'pointer' }}
              />
              <p style={{ marginTop: '6px' }}>
                تقدير سريع: سيراميك/بورسلان ≈ <strong>{estTiles} م²</strong> · دهانات أساس وتشطيب ≈ <strong>{estPaintBuckets} بستلات</strong> + الحاسبة الكاملة بالداخل.
              </p>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div
      className={`pw-split-stage ${activeSlug ? 'has-active' : ''}`}
      style={
        activeHoverSection
          ? ({ '--stage-accent': activeHoverSection.accent } as React.CSSProperties)
          : undefined
      }
      onPointerMove={handleStagePointerMove}
      onPointerLeave={(e) => resetStagePointer(e.currentTarget)}
    >
      {/* الخلفية البانورامية التفاعلية الممتدة من تحت الهيدر لآخر الصفحة أثناء السكرول */}
      <div className="pw-split-backdrop" aria-hidden="true">
        <img
          src="/sections/panorama.jpg"
          alt="منظومة فاي تك المعمارية المتكاملة"
          width={1600}
          height={900}
          loading="eager"
          decoding="async"
          className={`pw-split-bg-base ${activeSlug ? 'is-faded' : ''}`}
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
            className={`pw-split-bg-layer ${activeSlug === sec.slug ? 'is-visible' : ''}`}
          />
        ))}
        <div className="pw-split-scrim" />
        <div className="pw-split-cursor-glow" />
      </div>

      {/* 1. رحلة الأقسام الستة يميناً ويساراً فوق اللوحة البانورامية الممتدة */}
      <section id="portals" className="pw-section pw-portal-gateway" aria-labelledby="portals-heading">
        <div className="pw-wrap">
          <NewsTicker config={newsTicker} />

          <div className="pw-head pw-panoramic-intro-head">
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
              <p className="pw-eyebrow" style={{ marginBottom: 0 }}>أهلاً بك في فاي تك — جولة بانورامية تفاعلية</p>
              {onReplayLogoMotion && (
                <button
                  type="button"
                  onClick={onReplayLogoMotion}
                  className="pw-motion-replay-btn"
                  title="إعادة عرض موشن شعار فاي تك"
                >
                  <span>✨</span>
                  <span>عرض موشن الشعار</span>
                </button>
              )}
            </div>
            <h1 id="portals-heading" className="pw-portal-main-h1">
              انزل بالسكرول واستكشف أقسام فاي تك يميناً ويساراً
            </h1>
            <p>تتفاعل الخلفية البانورامية مع كل قسم، ومع كل محطة مكوّن تفاعلي يوضح لك خدمات القسم فوراً.</p>

            {/* شريط انتقال سريع للأقسام الستة */}
            <div className="pw-panoramic-jumpbar" role="navigation" aria-label="انتقال سريع للأقسام">
              {PORTAL_SECTIONS.map((sec) => (
                <a
                  key={sec.slug}
                  href={`#portal-station-${sec.slug}`}
                  className={`pw-panoramic-jumpchip ${activeSlug === sec.slug ? 'is-active' : ''}`}
                  style={{ '--col-accent': sec.accent } as React.CSSProperties}
                  onPointerEnter={() => setHoveredSlug(sec.slug)}
                >
                  <span>{sec.icon}</span>
                  <span>{sec.num}</span>
                  <span>{sec.title.replace('قسم ', '')}</span>
                </a>
              ))}
            </div>
          </div>

          {/* توزيع الأقسام الستة بالتبادل: يمين وشمال مع مكون تفاعلي يدل على كل قسم */}
          <div className={`pw-split-cols ${activeSlug ? 'has-active' : ''}`}>
            {PORTAL_SECTIONS.map((sec, idx) => {
              const isActive = activeSlug === sec.slug;
              const sideClass = idx % 2 === 0 ? 'is-side-right' : 'is-side-left';
              const sideLabel = idx % 2 === 0 ? 'المحطة اليمنى' : 'المحطة اليسرى';
              return (
                <div
                  key={sec.slug}
                  id={`portal-station-${sec.slug}`}
                  data-section-slug={sec.slug}
                  ref={(el) => {
                    rowRefs.current[sec.slug] = el;
                  }}
                  className={`pw-split-station-row ${sideClass} ${isActive ? 'is-row-active' : ''}`}
                >
                  <Link
                    href={sec.href}
                    className={`pw-split-col ${sideClass} ${isActive ? 'is-active' : ''}`}
                    style={{ '--col-accent': sec.accent } as React.CSSProperties}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== 'touch') setHoveredSlug(sec.slug);
                    }}
                    onFocus={() => setHoveredSlug(sec.slug)}
                    onBlur={() => setHoveredSlug((prev) => (prev === sec.slug ? null : prev))}
                  >
                    <div className="pw-split-col-inner">
                      <div className="pw-split-col-topline">
                        <span className="pw-split-num">
                          <span aria-hidden="true">{sec.icon}</span>
                          <span>قسم {sec.num}</span>
                        </span>
                        <span className="pw-split-flow-badge">{sec.flowNote}</span>
                      </div>

                      <h2>{sec.title}</h2>
                      <p className="pw-split-hint">{sec.guideHint}</p>

                      <div className="pw-split-tags" aria-hidden="true">
                        {sec.highlights.map((tag) => (
                          <span key={tag} className="pw-split-tag">
                            ✦ {tag}
                          </span>
                        ))}
                      </div>

                      {/* المكوّن التفاعلي الخاص الدال على القسم */}
                      <div className="pw-split-reveal">
                        {renderSectionIndicator(sec.slug)}
                      </div>

                      <div className="pw-split-col-footer">
                        <span className="pw-split-cta">
                          <span>ادخل {sec.title}</span>
                          <span aria-hidden="true">←</span>
                        </span>
                        <span className="pw-split-side-tag" aria-hidden="true">
                          {sideLabel} · {sec.num}/06
                        </span>
                      </div>
                    </div>
                    <span className="pw-split-bar" aria-hidden="true" />
                  </Link>

                  {/* نافذة إطلالة بانورامية في الجهة المقابلة (شمال أو يمين) تكشف الصورة الحية للقسم */}
                  <div
                    className="pw-split-vista-callout"
                    style={{ '--col-accent': sec.accent } as React.CSSProperties}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== 'touch') setHoveredSlug(sec.slug);
                    }}
                  >
                    <div className="pw-split-vista-pill">
                      <span className="pw-split-vista-icon" aria-hidden="true">{sec.icon}</span>
                      <div>
                        <strong>{sec.title}</strong>
                        <small>{sec.imageAlt}</small>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. أهم العروض والباقات الحصرية فوق الخلفية البانورامية الممتدة */}
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

      {/* 3. أهم المنتجات الأكثر طلباً فوق الخلفية البانورامية الممتدة */}
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
