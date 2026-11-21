"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_MAINTENANCE_SERVICES,
  DEFAULT_PRODUCTS,
  getProductImageUrl,
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
  type WebsiteMaintenanceService,
  type WebsiteProduct,
} from './store-catalog';
import { PORTAL_SECTIONS, type SectionSlug } from './section-defs';
import OrderJourneyShowcase from './OrderJourneyShowcase';
import type { NewsTickerConfig } from './site-content';

interface HomePortalSectionsProps {
  products?: WebsiteProduct[];
  maintenanceServices?: WebsiteMaintenanceService[];
  newsTicker?: NewsTickerConfig;
  whatsappNumber?: string;
  onAddToCart?: (product: WebsiteProduct, qty: number, withInstall: boolean) => void;
  onAddBundleToCart?: (items: { product: WebsiteProduct; qty: number }[], withInstall: boolean) => void;
  onOpenCart?: () => void;
  onOpenContact?: () => void;
}

const FLAGSHIP_PRIORITY_IDS = ['sm-02', 'sm-01', 'el-01', 'pt-01', 'cr-01', 'lc-01'];
const INITIAL_BEST_SELLERS = 6;

interface EngineeringToolShortcut {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

const TOOL_SHORTCUTS: EngineeringToolShortcut[] = [
  {
    id: 'tool-calc-3x1',
    icon: '📐',
    title: 'حاسبة المقاولات والتشطيب 3×1',
    subtitle: 'احسب تكلفة العظم والتشطيب والتكييف الفوري مع توفير 7%',
    href: '/sections/contracting',
    keywords: 'حاسبة مقايسة بناء تشطيب فيلا شقة عظم تكلفة',
  },
  {
    id: 'tool-smart-config',
    icon: '📱',
    title: 'مصمم باقة السمارت هوم حسب الغرف',
    subtitle: 'اختر عدد الغرف والتكييفات والأقفال الذكية مع البرمجة',
    href: '/sections/materials?tab=smart-home',
    keywords: 'سمارت هوم باقة تحكم شاشة ذكية قفل كاميرات',
  },
  {
    id: 'tool-qty-calc',
    icon: '🧱',
    title: 'حاسبة الكميات والخامات المجانية',
    subtitle: 'تقدير كميات الدهانات والسيراميك والبورسلان والديكور لمساحتك',
    href: '/sections/info?tab=tools',
    keywords: 'كميات سيراميك بورسلان دهانات جوتن دليل حاسبة',
  },
  {
    id: 'tool-verify',
    icon: '🛡️',
    title: 'التحقق من صحة المستندات والعقود',
    subtitle: 'راجع صلاحية عروض الأسعار والفواتير والضمانات برقم الكود',
    href: '/verify',
    keywords: 'تحقق مستند عقد ضمان فاتورة كود',
  },
];

const BESTSELLER_FILTER_CHIPS: { id: 'all' | ProductCategoryId; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'smart_home', label: 'سمارت هوم' },
  { id: 'electrical', label: 'كهرباء وإنارة' },
  { id: 'paint', label: 'دهانات وعوازل' },
  { id: 'ceramics', label: 'بورسلان وسيراميك' },
  { id: 'plumbing', label: 'سباكة وصحي' },
  { id: 'safety_sensors', label: 'أمان وحساسات' },
];

export default function HomePortalSections({
  products = DEFAULT_PRODUCTS,
  maintenanceServices = DEFAULT_MAINTENANCE_SERVICES,
  whatsappNumber = '',
  onAddToCart,
  onOpenCart,
  onOpenContact,
}: HomePortalSectionsProps) {
  // Stage 1: Omni-Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const omniRef = useRef<HTMLDivElement>(null);

  // Stage 3: Diagonal 3-part slice highlight state
  const [hoveredSlug, setHoveredSlug] = useState<SectionSlug | null>(null);
  const [scrollStageSlug, setScrollStageSlug] = useState<SectionSlug>('contracting');
  const runwayRef = useRef<HTMLDivElement>(null);

  // Stage 4: Best-Sellers filter & load-more state (starts strictly at 6)
  const [activeCat, setActiveCat] = useState<'all' | ProductCategoryId>('all');
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BEST_SELLERS);
  const [installMap, setInstallMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const p of DEFAULT_PRODUCTS) {
      if (p.category === 'smart_home' || p.category === 'low_current' || p.category === 'safety_sensors') {
        init[p.id] = true;
      }
    }
    return init;
  });
  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimerRef = useRef<number | null>(null);

  const sections = PORTAL_SECTIONS.slice(0, 3);
  const activeSlug = hoveredSlug ?? scrollStageSlug;

  const activeHoverSection = useMemo(
    () => sections.find((s) => s.slug === activeSlug) || null,
    [activeSlug, sections]
  );

  const categoryMap = useMemo(() => {
    const m: Record<string, (typeof PRODUCT_CATEGORIES)[number]> = {};
    for (const c of PRODUCT_CATEGORIES) m[c.id] = c;
    return m;
  }, []);

  // Scroll tracking for Stage 3 diagonal split
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const runway = runwayRef.current;
      if (!runway) return;
      const rect = runway.getBoundingClientRect();
      const scrollable = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable));
      const idx = progress < 0.34 ? 0 : progress < 0.68 ? 1 : 2;
      const targetSec = PORTAL_SECTIONS[idx];
      if (targetSec) setScrollStageSlug(targetSec.slug);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close Omni-Search dropdown on Escape or outside click
  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (omniRef.current && !omniRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [searchOpen]);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  // Omni-Search live filtering across ALL sections
  const omniResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        matchedSections: [] as typeof sections,
        matchedTools: [] as EngineeringToolShortcut[],
        matchedProducts: [] as WebsiteProduct[],
        matchedServices: [] as WebsiteMaintenanceService[],
        totalCount: 0,
      };
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const matchesAll = (haystack: string) => {
      const lower = haystack.toLowerCase();
      return tokens.every((tok) => lower.includes(tok));
    };

    const matchedSections = sections.filter((s) =>
      matchesAll(`${s.title} ${s.guideHint} ${s.flowNote} ${s.highlights.join(' ')}`)
    );

    const matchedTools = TOOL_SHORTCUTS.filter((t) =>
      matchesAll(`${t.title} ${t.subtitle} ${t.keywords}`)
    );

    const matchedProducts = products
      .filter((p) => {
        const cat = categoryMap[p.category];
        return matchesAll(
          `${p.name} ${p.code} ${p.brand} ${p.description} ${p.specs.join(' ')} ${cat?.title || ''} ${cat?.shortTitle || ''}`
        );
      })
      .slice(0, 6);

    const matchedServices = maintenanceServices
      .filter((srv) =>
        matchesAll(
          `${srv.title} ${srv.code} ${srv.badge} ${srv.executionScope.join(' ')} ${srv.maintenanceScope.join(' ')} ${srv.recommendation}`
        )
      )
      .slice(0, 4);

    const totalCount =
      matchedSections.length +
      matchedTools.length +
      matchedProducts.length +
      matchedServices.length;

    return { matchedSections, matchedTools, matchedProducts, matchedServices, totalCount };
  }, [searchQuery, sections, products, maintenanceServices, categoryMap]);

  // Sorted Best-Sellers list with top 6 flagship items first
  const sortedBestSellers = useMemo(() => {
    const priorityRank = (id: string) => {
      const idx = FLAGSHIP_PRIORITY_IDS.indexOf(id);
      return idx !== -1 ? idx : 99;
    };

    const sorted = [...products].sort((a, b) => {
      const ra = priorityRank(a.id);
      const rb = priorityRank(b.id);
      if (ra !== rb) return ra - rb;
      const fa = a.featured ? 0 : 1;
      const fb = b.featured ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return 0;
    });

    if (activeCat === 'all') return sorted;
    return sorted.filter((p) => p.category === activeCat);
  }, [products, activeCat]);

  const visibleProducts = sortedBestSellers.slice(0, visibleCount);
  const remainingCount = Math.max(0, sortedBestSellers.length - visibleProducts.length);

  const handleQuickAdd = (product: WebsiteProduct, forceInstall?: boolean) => {
    const withInstall = forceInstall !== undefined ? forceInstall : Boolean(installMap[product.id]);
    onAddToCart?.(product, 1, withInstall);
    setAddedId(product.id);
    if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setAddedId(null), 1800);
  };

  const handleCategorySwitch = (cat: 'all' | ProductCategoryId) => {
    setActiveCat(cat);
    setVisibleCount(INITIAL_BEST_SELLERS);
  };

  const cleanWa = (whatsappNumber || '').replace(/[^\d]/g, '');

  return (
    <>
      {/* =========================================================
          STAGE 1: رسالة الترحيب + ملخص الأقسام وأمثلة الطلبات + البحث الشامل
          ========================================================= */}
      <section className="pw-welcome-band" aria-labelledby="welcome-hero-heading">
        <div className="pw-wrap">
          <div className="pw-welcome-shell">
            <div className="pw-welcome-head">
              <p className="pw-eyebrow">فاي تك للمقاولات والتنفيذ والأنظمة الذكية</p>
              <h1 id="welcome-hero-heading">
                أهلاً بك في فاي تك — منصتك الهندسية الشاملة من التأسيس حتى السمارت هوم
              </h1>
              <p className="pw-welcome-sub">
                تصفّح أقسامنا الثلاثة بوضوح، ابحث عن أي منتج أو خدمة هندسية فوراً، أو أرسل طلبك أونلاين بضمان مكتوب.
              </p>
            </div>

            {/* Unified Omni-Search Bar Connected Across All Sections */}
            <div ref={omniRef} className="pw-omni-wrap">
              <div className={`pw-omni-box ${searchOpen && searchQuery.trim() ? 'is-open' : ''}`}>
                <span className="pw-omni-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </span>
                <input
                  type="search"
                  className="pw-omni-input"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="ابحث في كل الأقسام: قفل ذكي، بورسلان كلكتا، تكييف مخفي، مقايسة فيلا، دهان جوتن..."
                  aria-label="البحث الشامل في كل أقسام فاي تك"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="pw-omni-clear"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    aria-label="مسح البحث"
                  >
                    ✕
                  </button>
                )}
                <Link href="/store" className="pw-omni-store-btn">
                  المتجر الكامل ←
                </Link>
              </div>

              {/* Live Omni-Search Dropdown */}
              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="pw-omni-dropdown" role="region" aria-label="نتائج البحث الفورية">
                  {omniResults.totalCount === 0 ? (
                    <div className="pw-omni-empty">
                      <p>لم نعثر على نتيجة مطابقة لـ «{searchQuery}».</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Link href="/store" className="pw-btn pw-btn-primary" style={{ minHeight: '36px', padding: '0 14px', fontSize: '0.8rem' }}>
                          تصفح كل المنتجات ({products.length})
                        </Link>
                        {onOpenContact && (
                          <button
                            type="button"
                            className="pw-btn pw-btn-ghost"
                            style={{ minHeight: '36px', padding: '0 14px', fontSize: '0.8rem' }}
                            onClick={() => {
                              setSearchOpen(false);
                              onOpenContact();
                            }}
                          >
                            اسأل مهندس المبيعات
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {omniResults.matchedProducts.length > 0 && (
                        <div className="pw-omni-group">
                          <div className="pw-omni-group-title">المنتجات والسمارت هوم وخامات التشطيب</div>
                          {omniResults.matchedProducts.map((p) => {
                            const cat = categoryMap[p.category];
                            const thumb = getProductImageUrl(p);
                            const isAdded = addedId === p.id;
                            return (
                              <div key={p.id} className="pw-omni-row">
                                <img src={thumb} alt={p.name} className="pw-omni-thumb" width={64} height={48} />
                                <div className="pw-omni-row-info">
                                  <div className="pw-omni-row-meta">
                                    <span>{cat?.shortTitle}</span>
                                    <span>{p.code}</span>
                                  </div>
                                  <strong>{p.name}</strong>
                                </div>
                                <div className="pw-omni-row-actions">
                                  {onAddToCart && (
                                    <button
                                      type="button"
                                      className={`pw-omni-add-btn ${isAdded ? 'is-added' : ''}`}
                                      onClick={() => handleQuickAdd(p)}
                                    >
                                      {isAdded ? 'تمت الإضافة ✓' : 'أضف للسلة'}
                                    </button>
                                  )}
                                  <Link href={`/store?cat=${p.category}`} className="pw-omni-go-link" onClick={() => setSearchOpen(false)}>
                                    عرض ←
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {omniResults.matchedServices.length > 0 && (
                        <div className="pw-omni-group">
                          <div className="pw-omni-group-title">خدمات التنفيذ والصيانة الهندسية</div>
                          {omniResults.matchedServices.map((srv) => (
                            <Link
                              key={srv.id}
                              href="/sections/contracting?tab=maintenance"
                              className="pw-omni-row is-link-row"
                              onClick={() => setSearchOpen(false)}
                            >
                              <span className="pw-omni-icon-badge" aria-hidden="true">{srv.icon}</span>
                              <div className="pw-omni-row-info">
                                <div className="pw-omni-row-meta">
                                  <span>{srv.code}</span>
                                  <span>{srv.badge}</span>
                                </div>
                                <strong>{srv.title}</strong>
                              </div>
                              <span className="pw-omni-go-link">احجز الخدمة ←</span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {(omniResults.matchedSections.length > 0 || omniResults.matchedTools.length > 0) && (
                        <div className="pw-omni-group">
                          <div className="pw-omni-group-title">الأقسام والأدوات الهندسية</div>
                          {omniResults.matchedSections.map((sec) => (
                            <Link
                              key={sec.slug}
                              href={sec.href}
                              className="pw-omni-row is-link-row"
                              onClick={() => setSearchOpen(false)}
                            >
                              <span className="pw-omni-icon-badge" aria-hidden="true">{sec.icon}</span>
                              <div className="pw-omni-row-info">
                                <strong>{sec.title}</strong>
                                <small>{sec.guideHint}</small>
                              </div>
                              <span className="pw-omni-go-link">ادخل القسم ←</span>
                            </Link>
                          ))}
                          {omniResults.matchedTools.map((tool) => (
                            <Link
                              key={tool.id}
                              href={tool.href}
                              className="pw-omni-row is-link-row"
                              onClick={() => setSearchOpen(false)}
                            >
                              <span className="pw-omni-icon-badge" aria-hidden="true">{tool.icon}</span>
                              <div className="pw-omni-row-info">
                                <strong>{tool.title}</strong>
                                <small>{tool.subtitle}</small>
                              </div>
                              <span className="pw-omni-go-link">افتح الأداة ←</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          STAGE 2: محاكاة تفاعلية حية لخطوات الطلب (كمبيوتر + موبايل)
          ========================================================= */}
      <OrderJourneyShowcase onOpenContact={onOpenContact} />

      {/* =========================================================
          STAGE 3: الأقسام الثلاثة بالخطوط المائلة فوق المبنى ثلاثي الأبعاد
          ========================================================= */}
      <div
        className={`pw-split-stage ${activeSlug ? 'has-active' : ''}`}
        style={
          activeHoverSection
            ? ({ '--stage-accent': activeHoverSection.accent } as React.CSSProperties)
            : undefined
        }
        onPointerLeave={() => setHoveredSlug(null)}
      >
        <section id="portals" className="pw-portal-gateway" aria-label="أقسام فاي تك الرئيسية الثلاثة">
          <div ref={runwayRef} className="pw-diag-runway">
            <div className="pw-diag-viewport">
              <div className="pw-wrap pw-diag-top">
                <div className="pw-diag-hero-bar">
                  <div className="pw-diag-hero-titles">
                    <p className="pw-eyebrow">الأقسام الهندسية والتجارية الرئيسية</p>
                    <h2>اختر القسم المناسب لمشروعك</h2>
                  </div>
                  <span className={`pw-diag-scroll-pill ${hoveredSlug ? 'is-faded' : ''}`}>
                    <span>مرّر لاختيار القسم</span>
                    <span aria-hidden="true">↓</span>
                  </span>
                </div>
              </div>

              <div className={`pw-diag-slices ${hoveredSlug ? 'has-hover' : ''}`}>
                {sections.map((sec, idx) => {
                  const isHovered = hoveredSlug === sec.slug;
                  const isActive = activeSlug === sec.slug;
                  return (
                    <Link
                      key={sec.slug}
                      id={`portal-station-${sec.slug}`}
                      href={sec.href}
                      className={`pw-diag-slice is-slice-${idx} ${isHovered ? 'is-hovered' : ''} ${isActive ? 'is-active' : ''}`}
                      style={{ '--col-accent': sec.accent } as React.CSSProperties}
                      onPointerEnter={(e) => {
                        if (e.pointerType !== 'touch') setHoveredSlug(sec.slug);
                      }}
                      onFocus={() => setHoveredSlug(sec.slug)}
                      onBlur={() => setHoveredSlug((prev) => (prev === sec.slug ? null : prev))}
                    >
                      <div className="pw-diag-veil" aria-hidden="true" />
                      <div className="pw-diag-content">
                        <span className="pw-diag-num">
                          <span aria-hidden="true">{sec.icon}</span>
                          <span>{sec.num}</span>
                          <span>·</span>
                          <span>{sec.flowNote}</span>
                        </span>

                        <h2>{sec.title}</h2>

                        <div className="pw-diag-details">
                          <p className="pw-diag-hint">{sec.guideHint}</p>
                          <p className="pw-diag-tags" aria-hidden="true">
                            {sec.highlights.join('  ·  ')}
                          </p>
                        </div>

                        <span className="pw-diag-cta">
                          <span>ادخل القسم</span>
                          <span aria-hidden="true">←</span>
                        </span>
                      </div>
                    </Link>
                  );
                })}

                {/* Desktop Diagonal Lines */}
                <svg
                  className="pw-diag-lines pw-diag-lines-desktop"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line x1="70" y1="0" x2="63" y2="100" vectorEffect="non-scaling-stroke" className="pw-diag-line-glow" />
                  <line x1="37" y1="0" x2="30" y2="100" vectorEffect="non-scaling-stroke" className="pw-diag-line-glow" />
                  <line x1="70" y1="0" x2="63" y2="100" vectorEffect="non-scaling-stroke" className="pw-diag-line-core" />
                  <line x1="37" y1="0" x2="30" y2="100" vectorEffect="non-scaling-stroke" className="pw-diag-line-core" />
                </svg>

                {/* Mobile Diagonal Lines */}
                <svg
                  className="pw-diag-lines pw-diag-lines-mobile"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line x1="0" y1="37" x2="100" y2="30" vectorEffect="non-scaling-stroke" className="pw-diag-line-glow" />
                  <line x1="0" y1="70" x2="100" y2="63" vectorEffect="non-scaling-stroke" className="pw-diag-line-glow" />
                  <line x1="0" y1="37" x2="100" y2="30" vectorEffect="non-scaling-stroke" className="pw-diag-line-core" />
                  <line x1="0" y1="70" x2="100" y2="63" vectorEffect="non-scaling-stroke" className="pw-diag-line-core" />
                </svg>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================
          STAGE 4: المنتجات الأكثر مبيعاً (أهم 6 أولاً + عرض المزيد)
          ========================================================= */}
      <section id="best-sellers" className="pw-bestsellers-band" aria-labelledby="best-sellers-heading">
        <div className="pw-wrap">
          <div className="pw-bs-head">
            <div>
              <p className="pw-eyebrow">صور استوديو حقيقية · جاهزة للتوريد والتركيب</p>
              <h2 id="best-sellers-heading">المنتجات الأكثر مبيعاً وطلباً</h2>
              <p className="pw-bs-sub">
                تشكيلة منتقاة من الأكثر طلباً في التشطيبات والسمارت هوم وحساسات الأمان — اطلب التوريد أو توريد + تركيب هندسي.
              </p>
            </div>
            {onOpenCart && (
              <button type="button" className="pw-btn pw-btn-ghost" onClick={onOpenCart}>
                مراجعة السلة
              </button>
            )}
          </div>

          <div className="pw-bs-filters" role="tablist" aria-label="تصفية المنتجات الأكثر مبيعاً">
            {BESTSELLER_FILTER_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={activeCat === chip.id}
                className={`pw-bs-filter-btn ${activeCat === chip.id ? 'is-on' : ''}`}
                onClick={() => handleCategorySwitch(chip.id)}
              >
                <span>{chip.label}</span>
              </button>
            ))}
          </div>

          <div className="pw-bs-grid">
            {visibleProducts.map((product) => {
              const cat = categoryMap[product.category];
              const imageUrl = getProductImageUrl(product);
              const withInstall = Boolean(installMap[product.id]);
              const isAdded = addedId === product.id;
              const waMsg = `مرحباً فاي تك، أريد تسعيرة وطلب: ${product.name} (${product.code}) — الوحدة: ${product.unit}${withInstall ? ' (توريد + تركيب)' : ' (توريد فقط)'}`;

              return (
                <article key={product.id} className="pw-bs-card">
                  <div className="pw-bs-media">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                    />
                    {product.badge && <span className="pw-bs-badge">{product.badge}</span>}
                  </div>

                  <div className="pw-bs-body">
                    <span className="pw-bs-cat">{cat?.shortTitle || product.brand}</span>

                    <h3>{product.name}</h3>

                    {product.specs[0] && (
                      <p className="pw-bs-spec-one">{product.specs[0]}</p>
                    )}

                    <label className="pw-bs-install">
                      <input
                        type="checkbox"
                        checked={withInstall}
                        onChange={() =>
                          setInstallMap((prev) => ({ ...prev, [product.id]: !prev[product.id] }))
                        }
                      />
                      <span>شامل التركيب والبرمجة الهندسية</span>
                    </label>

                    <div className="pw-bs-price">
                      {product.price > 0 ? (
                        <strong>
                          {product.price.toLocaleString('en-US')} {product.currency} / {product.unit}
                        </strong>
                      ) : (
                        <span>تسعير فوري ومعتمد عند الطلب · {product.unit}</span>
                      )}
                    </div>

                    <div className="pw-bs-actions">
                      <button
                        type="button"
                        className={`pw-btn pw-btn-primary pw-bs-add-btn ${isAdded ? 'is-added' : ''}`}
                        onClick={() => handleQuickAdd(product, withInstall)}
                      >
                        {isAdded ? 'تمت الإضافة ✓' : 'أضف للسلة'}
                      </button>

                      {cleanWa ? (
                        <a
                          href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(waMsg)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pw-bs-wa-btn"
                          title="استفسار وسرعة تسعير عبر واتساب"
                        >
                          واتساب
                        </a>
                      ) : onOpenContact ? (
                        <button type="button" className="pw-bs-wa-btn" onClick={onOpenContact}>
                          السعر
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="pw-bs-footer">
            {remainingCount > 0 && (
              <button
                type="button"
                className="pw-btn pw-btn-primary pw-bs-more-btn"
                onClick={() => setVisibleCount((c) => c + INITIAL_BEST_SELLERS)}
              >
                عرض المزيد (+{Math.min(INITIAL_BEST_SELLERS, remainingCount)} منتج)
              </button>
            )}

            {visibleCount > INITIAL_BEST_SELLERS && (
              <button
                type="button"
                className="pw-btn pw-btn-ghost"
                onClick={() => setVisibleCount(INITIAL_BEST_SELLERS)}
              >
                إظهار أهم {INITIAL_BEST_SELLERS} فقط
              </button>
            )}

            <Link href="/store" className="pw-btn pw-btn-ghost">
              تصفح المتجر بالكامل ({products.length} منتج) ←
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
