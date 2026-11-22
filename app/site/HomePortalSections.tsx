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
import { PORTAL_SECTIONS, type CanonicalSectionSlug } from './section-defs';
import OrderJourneyShowcase from './OrderJourneyShowcase';
import ProductDetailModal from './ProductDetailModal';
import type { NewsTickerConfig } from './site-content';

interface HomePortalSectionsProps {
  products?: WebsiteProduct[];
  totalCatalogCount?: number;
  maintenanceServices?: WebsiteMaintenanceService[];
  newsTicker?: NewsTickerConfig;
  whatsappNumber?: string;
  onAddToCart?: (product: WebsiteProduct, qty: number, withInstall: boolean) => void;
  onAddBundleToCart?: (items: { product: WebsiteProduct; qty: number }[], withInstall: boolean) => void;
  onOpenCart?: () => void;
  onOpenContact?: () => void;
}

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

interface DualPortalDef {
  slug: CanonicalSectionSlug;
  title: string;
  href: string;
  accent: string;
  image: string;
  imageAlt: string;
}

const DUAL_PORTAL_CONTAINERS: DualPortalDef[] = [
  {
    slug: 'materials',
    title: 'المبيعات والسمارت هوم',
    href: '/store',
    accent: '#059669',
    image: '/sections/materials.jpg',
    imageAlt: 'المبيعات ومواد البناء والسمارت هوم',
  },
  {
    slug: 'contracting',
    title: 'التركيبات والصيانة والتنفيذ',
    href: '/sections/contracting',
    accent: '#c75517',
    image: '/sections/contracting.jpg',
    imageAlt: 'التركيبات والصيانة والتنفيذ الهندسي',
  },
];

export default function HomePortalSections({
  products = DEFAULT_PRODUCTS,
  totalCatalogCount,
  maintenanceServices = DEFAULT_MAINTENANCE_SERVICES,
  whatsappNumber = '',
  onAddToCart,
  onOpenCart,
  onOpenContact,
}: HomePortalSectionsProps) {
  const displayCatalogTotal =
    totalCatalogCount && totalCatalogCount > products.length ? totalCatalogCount : products.length;
  // Stage 1: Omni-Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const omniRef = useRef<HTMLDivElement>(null);

  // Stage 4: Best-Sellers filter & dynamic row-aligned load-more state
  const [activeCat, setActiveCat] = useState<'all' | ProductCategoryId>('all');
  const [detailProduct, setDetailProduct] = useState<WebsiteProduct | null>(null);
  const bsGridRef = useRef<HTMLDivElement>(null);
  const [gridCols, setGridCols] = useState<number>(4);
  const [extraRows, setExtraRows] = useState<number>(0);
  const baseCount = gridCols <= 2 ? 6 : gridCols * 2;
  const stepCount = gridCols === 1 ? 6 : gridCols * 2;
  const visibleCount = baseCount + extraRows * stepCount;
  const [installMap, setInstallMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const p of products) {
      if (p.category === 'smart_home' || p.category === 'low_current' || p.category === 'safety_sensors') {
        init[p.id] = true;
      }
    }
    return init;
  });
  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimerRef = useRef<number | null>(null);

  const sections = PORTAL_SECTIONS.slice(0, 3);

  const categoryMap = useMemo(() => {
    const m: Record<string, (typeof PRODUCT_CATEGORIES)[number]> = {};
    for (const c of PRODUCT_CATEGORIES) m[c.id] = c;
    return m;
  }, []);

  // Measure live grid column count so rows always fill evenly across breakpoints and SM/MD/LG/XL scale
  useEffect(() => {
    const el = bsGridRef.current;
    if (!el || typeof window === 'undefined') return;
    const measureCols = () => {
      const tpl = window.getComputedStyle(el).gridTemplateColumns;
      const cols = tpl && tpl !== 'none' ? tpl.trim().split(/\s+/).filter(Boolean).length : 0;
      if (cols >= 1 && cols <= 10) {
        setGridCols((prev) => (prev === cols ? prev : cols));
      }
    };
    measureCols();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureCols) : null;
    ro?.observe(el);
    const mo =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => window.requestAnimationFrame(measureCols))
        : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-site-size'] });
    return () => {
      ro?.disconnect();
      mo?.disconnect();
    };
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

  // Sorted Best-Sellers list: Telegram-hosted product media first, then featured, then priced
  const sortedBestSellers = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      const ma = (a.imageUrl || '').startsWith('/api/store-media/') ? 0 : 1;
      const mb = (b.imageUrl || '').startsWith('/api/store-media/') ? 0 : 1;
      if (ma !== mb) return ma - mb;
      const fa = a.featured ? 0 : 1;
      const fb = b.featured ? 0 : 1;
      if (fa !== fb) return fa - fb;
      const pa = a.price > 0 ? 0 : 1;
      const pb = b.price > 0 ? 0 : 1;
      if (pa !== pb) return pa - pb;
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
    setExtraRows(0);
  };

  const isInteractiveClick = (target: EventTarget | null) =>
    target instanceof HTMLElement && Boolean(target.closest('a,button,input,label,select,textarea'));

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
                        <Link href="/store" className="pw-btn pw-btn-primary pw-btn-sm">
                          تصفح كل المنتجات ({displayCatalogTotal.toLocaleString('en-US')})
                        </Link>
                        {onOpenContact && (
                          <button
                            type="button"
                            className="pw-btn pw-btn-ghost pw-btn-sm"
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
                                  <Link href={`/store?category=${p.category}`} className="pw-omni-go-link" onClick={() => setSearchOpen(false)}>
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
          STAGE 3: الحاويتان الرئيسيتان — المبيعات + التركيبات والصيانة والتنفيذ
          ========================================================= */}
      <div className="pw-split-stage">
        <section id="portals" className="pw-portal-studio" aria-labelledby="portals-studio-heading">
          <div className="pw-wrap">
            <div className="pw-portal-studio-head">
              <h2 id="portals-studio-heading">اختر القسم</h2>
            </div>

            <div className="pw-dual-portals">
              {DUAL_PORTAL_CONTAINERS.map((item) => (
                <Link
                  key={item.slug}
                  id={`portal-station-${item.slug}`}
                  href={item.href}
                  className="pw-dual-card"
                  style={{ '--dual-accent': item.accent } as React.CSSProperties}
                >
                  <div className="pw-dual-media">
                    <img
                      src={item.image}
                      alt={item.imageAlt}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="pw-dual-media-scrim" aria-hidden="true" />
                    <div className="pw-dual-caption">
                      <h3>{item.title}</h3>
                      <span className="pw-dual-go" aria-hidden="true">←</span>
                    </div>
                  </div>
                </Link>
              ))}
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
                تشكيلة منتقاة من الأكثر طلباً في التشطيبات والسمارت هوم وحساسات الأمان — اطلب التوريد أو توريد + تركيب.
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

          <div ref={bsGridRef} className="pw-bs-grid">
            {visibleProducts.map((product) => {
              const cat = categoryMap[product.category];
              const imageUrl = getProductImageUrl(product);
              const withInstall = Boolean(installMap[product.id]);
              const isAdded = addedId === product.id;
              const waMsg = `مرحباً فاي تك، أريد تسعيرة وطلب: ${product.name} (${product.code}) — الوحدة: ${product.unit}${withInstall ? ' (توريد + تركيب)' : ' (توريد فقط)'}`;
              const catLabel = cat?.shortTitle || product.brand;
              const firstSpec = (product.specs[0] || '').trim();
              const isBrandSpec = /^الماركة\s*[:：]/.test(firstSpec);
              const extractedBrand = isBrandSpec ? firstSpec.replace(/^الماركة\s*[:：]\s*/, '').trim() : '';
              const brandLabel = extractedBrand || (product.brand && product.brand !== catLabel ? product.brand : '');
              const extraSpec = !isBrandSpec ? firstSpec : '';

              return (
                <article
                  key={product.id}
                  className="pw-bs-card"
                  title="اضغط لعرض التفاصيل والمواصفات"
                  onClick={(e) => {
                    if (!isInteractiveClick(e.target)) setDetailProduct(product);
                  }}
                >
                  <div className="pw-bs-media">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                    />
                    {product.badge && <span className="pw-bs-badge">{product.badge}</span>}
                    {product.spinImages && product.spinImages.length >= 2 && (
                      <span className="pw-card-4d-badge">4D · 360°</span>
                    )}
                  </div>

                  <div className="pw-bs-body">
                    <div className="pw-bs-top-meta">
                      <span className="pw-bs-cat">{catLabel}</span>
                      {brandLabel && brandLabel !== catLabel && (
                        <span className="pw-bs-brand">{brandLabel}</span>
                      )}
                    </div>

                    <h3>{product.name}</h3>

                    {extraSpec && <p className="pw-bs-spec-one">{extraSpec}</p>}

                    <div className="pw-bs-buy-row">
                      <div className="pw-bs-price">
                        {product.price > 0 ? (
                          <>
                            <strong>
                              {product.price.toLocaleString('en-US')} {product.currency}
                            </strong>{' '}
                            <span>/ {product.unit}</span>
                          </>
                        ) : (
                          <span>تسعير عند الطلب · {product.unit}</span>
                        )}
                      </div>

                      <label className={`pw-bs-install ${withInstall ? 'is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={withInstall}
                          onChange={() =>
                            setInstallMap((prev) => ({ ...prev, [product.id]: !prev[product.id] }))
                          }
                        />
                        <span>شامل التركيب</span>
                      </label>
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
                className="pw-btn pw-btn-primary pw-btn-lg pw-bs-more-btn"
                onClick={() => setExtraRows((r) => r + 1)}
              >
                عرض المزيد (+{Math.min(stepCount, remainingCount)} منتج)
              </button>
            )}

            {extraRows > 0 && (
              <button
                type="button"
                className="pw-btn pw-btn-ghost pw-btn-lg"
                onClick={() => setExtraRows(0)}
              >
                إظهار أهم {baseCount} فقط
              </button>
            )}

            <Link href="/store" className="pw-btn pw-btn-ghost pw-btn-lg">
              تصفح المتجر بالكامل ({displayCatalogTotal.toLocaleString('en-US')} منتج) ←
            </Link>
          </div>
        </div>
      </section>

      <ProductDetailModal
        product={detailProduct}
        withInstall={detailProduct ? Boolean(installMap[detailProduct.id]) : false}
        onToggleInstall={() => {
          if (!detailProduct) return;
          setInstallMap((prev) => ({ ...prev, [detailProduct.id]: !prev[detailProduct.id] }));
        }}
        onAddToCart={onAddToCart}
        onClose={() => setDetailProduct(null)}
        whatsappNumber={whatsappNumber}
        onOpenContact={onOpenContact}
      />
    </>
  );
}
