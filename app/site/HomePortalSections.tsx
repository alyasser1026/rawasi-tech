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

interface PortalShortcut {
  title: string;
  subtitle: string;
  href: string;
}

interface PortalStudioDef {
  slug: CanonicalSectionSlug;
  stepNum: string;
  journeyTitle: string;
  journeySub: string;
  intentLabel: string;
  title: string;
  benefit: string;
  accent: string;
  href: string;
  image: string;
  imageAlt: string;
  tags: [string, string, string];
  secondaryCta: { label: string; href: string };
  getKpi: (catalogCount: number) => string;
  getShortcuts: (catalogCount: number) => [PortalShortcut, PortalShortcut, PortalShortcut];
}

function PortalSectionIcon({ slug, size = 18 }: { slug: CanonicalSectionSlug; size?: number }) {
  if (slug === 'info') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 8h10M7 12h4M7 16h4M15 12v4" />
      </svg>
    );
  }
  if (slug === 'contracting') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4v18" />
        <path d="M12 11h7v10" />
        <path d="M8 11h1M8 15h1M15 15h1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M12 12 3 7M12 12l9-5M12 12v10" />
    </svg>
  );
}

const PORTAL_STUDIO_ITEMS: PortalStudioDef[] = [
  {
    slug: 'info',
    stepNum: '01',
    journeyTitle: 'خطّط واحسب',
    journeySub: 'حاسبات الكميات ودليل الاستلام',
    intentLabel: 'أريد معرفة التكلفة والكميات أولاً',
    title: 'معلومات وحاسبات هندسية',
    benefit: 'احسب كميات التشطيب بدقة وراجع دليل الفحص الهندسي قبل التعاقد أو الشراء.',
    accent: '#4f46e5',
    href: '/sections/info',
    image: '/sections/info.jpg',
    imageAlt: 'مكتب هندسي يضم مخططات معمارية وحاسوب لوحي لرسومات التصميم الهندسي',
    tags: ['حاسبات مجانية', 'دليل الفحص', 'نصائح التشطيب'],
    secondaryCta: { label: 'التحقق من المستندات', href: '/verify' },
    getKpi: () => '4 أدوات وحاسبات مجانية',
    getShortcuts: () => [
      { title: 'حاسبات الكميات المجانية', subtitle: 'تقدير الدهانات والسيراميك والتشطيب', href: '/sections/info?tab=tools' },
      { title: 'دليل التنفيذ والفحص', subtitle: 'قائمة استلام هندسية لكل بند', href: '/sections/info?tab=checklist' },
      { title: 'نصائح قبل التشطيب', subtitle: 'تجنّب الأخطاء المكلفة والتزاماتنا', href: '/sections/info?tab=tips' },
    ],
  },
  {
    slug: 'contracting',
    stepNum: '02',
    journeyTitle: 'ابنِ وشطّب',
    journeySub: 'المقاولات والتنفيذ والصيانة',
    intentLabel: 'أريد تشطيب أو بناء أو صيانة',
    title: 'المقاولات والتنفيذ والصيانة',
    benefit: 'تنفيذ متكامل من العظم حتى التسليم مع صيانة الكهرباء والسباكة والتكييف بضمان هندسي.',
    accent: '#c75517',
    href: '/sections/contracting',
    image: '/sections/contracting.jpg',
    imageAlt: 'مبنى معماري حديث من الخرسانة والزجاج يعبر عن مشاريع المقاولات والإنشاءات والتنفيذ الهندسي',
    tags: ['عظم وتشطيب', 'صيانة بضمان', 'مقايسة 3×1'],
    secondaryCta: { label: 'احسب المقايسة الآن', href: '/sections/contracting?view=calc' },
    getKpi: () => 'حاسبة 3×1 + ضمان + 3D',
    getShortcuts: () => [
      { title: 'حاسبة المقايسة 3×1', subtitle: 'تقدير فوري للعظم والتشطيب والتكييف', href: '/sections/contracting?view=calc' },
      { title: 'خدمات الصيانة الهندسية', subtitle: 'كهرباء، سباكة، وتكييف بإشراف هندسي', href: '/sections/contracting?tab=maintenance' },
      { title: 'المجسم الهندسي التفاعلي 3D', subtitle: 'استعراض معماري وBIM للمباني', href: '/sections/contracting?view=tower3d' },
    ],
  },
  {
    slug: 'materials',
    stepNum: '03',
    journeyTitle: 'جهّز وذكيّ بيتك',
    journeySub: 'المتجر ومواد البناء والسمارت هوم',
    intentLabel: 'أريد شراء خامات أو سمارت هوم',
    title: 'المبيعات والسمارت هوم',
    benefit: 'توريد خامات البناء والتشطيب وأنظمة المنزل الذكي والأمان بأقل سعر مباشر وتركيب معتمد.',
    accent: '#059669',
    href: '/sections/materials',
    image: '/sections/materials.jpg',
    imageAlt: 'منظومة متكاملة لمواد البناء والتشطيبات والسمارت هوم من فاي تك',
    tags: ['مواد بناء وتشطيب', 'سمارت هوم', 'كاميرات وأمان'],
    secondaryCta: { label: 'تصفح المتجر بالكامل', href: '/store' },
    getKpi: (n) => `+${n.toLocaleString('en-US')} منتج متاح للتوريد`,
    getShortcuts: (n) => [
      { title: 'تصفح المتجر المباشر', subtitle: `${n.toLocaleString('en-US')}+ منتج بأقل سعر محدث`, href: '/store' },
      { title: 'باقات السمارت هوم', subtitle: 'شاشات تحكم، أقفال ذكية، وكاميرات 4K', href: '/sections/materials?tab=smart-home' },
      { title: 'مواد البناء والتشطيب', subtitle: 'توريد وبيع خامات معتمدة للموقع', href: '/sections/materials?tab=materials' },
    ],
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

  // Stage 3: Unified Architectural Portal Studio state (no scroll listener needed)
  const [activeStudioSlug, setActiveStudioSlug] = useState<CanonicalSectionSlug>('contracting');

  // Stage 4: Best-Sellers filter & load-more state (starts strictly at 6)
  const [activeCat, setActiveCat] = useState<'all' | ProductCategoryId>('all');
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BEST_SELLERS);
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
  const activeStudio = useMemo(
    () => PORTAL_STUDIO_ITEMS.find((item) => item.slug === activeStudioSlug) || PORTAL_STUDIO_ITEMS[1],
    [activeStudioSlug]
  );
  const activeStudioShortcuts = useMemo(
    () => activeStudio.getShortcuts(displayCatalogTotal),
    [activeStudio, displayCatalogTotal]
  );

  const categoryMap = useMemo(() => {
    const m: Record<string, (typeof PRODUCT_CATEGORIES)[number]> = {};
    for (const c of PRODUCT_CATEGORIES) m[c.id] = c;
    return m;
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
          STAGE 3: بوابة الأقسام الموحدة (5 في 1) — مرسّخ سريع + رحلة المشروع + معاينة + Bento أكورديون
          ========================================================= */}
      <div
        className="pw-split-stage"
        style={{ '--stage-accent': activeStudio.accent } as React.CSSProperties}
      >
        <section id="portals" className="pw-portal-studio" aria-labelledby="portals-studio-heading">
          <div className="pw-wrap">
            <div className="pw-portal-studio-head">
              <p className="pw-eyebrow">الأقسام الهندسية والتجارية الرئيسية</p>
              <h2 id="portals-studio-heading">اختر القسم المناسب لمشروعك</h2>
              <p className="pw-portal-studio-sub">
                مسار متكامل يربط بين الحساب والتخطيط والتنفيذ وتوريد الخامات والسمارت هوم.
              </p>
            </div>

            {/* 5. Quick Intent Bar */}
            <div className="pw-intent-bar" role="region" aria-label="اختيار سريع حسب احتياجك">
              <span className="pw-intent-label">ما الذي تبحث عنه الآن؟</span>
              <div className="pw-intent-pills">
                {PORTAL_STUDIO_ITEMS.map((item) => {
                  const isSelected = activeStudioSlug === item.slug;
                  return (
                    <button
                      key={`intent-${item.slug}`}
                      type="button"
                      className={`pw-intent-pill ${isSelected ? 'is-active' : ''}`}
                      style={{ '--pill-accent': item.accent } as React.CSSProperties}
                      onClick={() => setActiveStudioSlug(item.slug)}
                    >
                      <PortalSectionIcon slug={item.slug} size={16} />
                      <span>{item.intentLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Step-by-Step Project Journey Rail */}
            <div className="pw-journey-rail" role="tablist" aria-label="رحلة المشروع عبر أقسام فاي تك">
              {PORTAL_STUDIO_ITEMS.map((item) => {
                const isSelected = activeStudioSlug === item.slug;
                return (
                  <button
                    key={`step-${item.slug}`}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`pw-journey-step ${isSelected ? 'is-active' : ''}`}
                    style={{ '--step-accent': item.accent } as React.CSSProperties}
                    onClick={() => setActiveStudioSlug(item.slug)}
                  >
                    <span className="pw-journey-num">{item.stepNum}</span>
                    <span className="pw-journey-icon" aria-hidden="true">
                      <PortalSectionIcon slug={item.slug} size={18} />
                    </span>
                    <span className="pw-journey-copy">
                      <strong>{item.journeyTitle}</strong>
                      <small>{item.journeySub}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 1 & 3. Split Preview & Bento Focus Panel */}
            <div
              className="pw-portal-preview"
              role="tabpanel"
              style={{ '--col-accent': activeStudio.accent } as React.CSSProperties}
            >
              <div className="pw-preview-info">
                <div className="pw-preview-meta">
                  <span className="pw-preview-step-pill">
                    الخطوة {activeStudio.stepNum} · {activeStudio.journeyTitle}
                  </span>
                  <span className="pw-preview-kpi">{activeStudio.getKpi(displayCatalogTotal)}</span>
                </div>

                <div className="pw-preview-title-row">
                  <span className="pw-preview-icon" aria-hidden="true">
                    <PortalSectionIcon slug={activeStudio.slug} size={22} />
                  </span>
                  <h3>{activeStudio.title}</h3>
                </div>

                <p className="pw-preview-benefit">{activeStudio.benefit}</p>

                <div className="pw-preview-shortcuts">
                  {activeStudioShortcuts.map((sc) => (
                    <Link key={sc.href + sc.title} href={sc.href} className="pw-preview-shortcut">
                      <strong>{sc.title}</strong>
                      <small>{sc.subtitle}</small>
                      <span className="pw-preview-shortcut-go">افتح الآن ←</span>
                    </Link>
                  ))}
                </div>

                <div className="pw-preview-actions">
                  <Link href={activeStudio.href} className="pw-btn pw-btn-primary">
                    ادخل القسم بالكامل ←
                  </Link>
                  <Link href={activeStudio.secondaryCta.href} className="pw-btn pw-btn-ghost">
                    {activeStudio.secondaryCta.label}
                  </Link>
                </div>
              </div>

              <div className="pw-preview-media">
                <img
                  src={activeStudio.image}
                  alt={activeStudio.imageAlt}
                  loading="lazy"
                  decoding="async"
                />
                <span className="pw-preview-media-badge">
                  {activeStudio.stepNum} · {activeStudio.journeyTitle}
                </span>
                <div className="pw-preview-tags">
                  {activeStudio.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 1 & 2. Interactive Horizontal Accordion / Bento Strip */}
            <div className="pw-bento-accordion">
              {PORTAL_STUDIO_ITEMS.map((item) => {
                const isSelected = activeStudioSlug === item.slug;
                return (
                  <article
                    key={item.slug}
                    id={`portal-station-${item.slug}`}
                    className={`pw-bento-card ${isSelected ? 'is-active' : ''}`}
                    style={{ '--col-accent': item.accent } as React.CSSProperties}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== 'touch') setActiveStudioSlug(item.slug);
                    }}
                    onClick={() => setActiveStudioSlug(item.slug)}
                  >
                    <img
                      src={item.image}
                      alt={item.imageAlt}
                      className="pw-bento-bg"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="pw-bento-scrim" aria-hidden="true" />
                    <div className="pw-bento-inner">
                      <div className="pw-bento-top">
                        <span className="pw-bento-step">
                          <PortalSectionIcon slug={item.slug} size={16} />
                          <span>
                            {item.stepNum} · {item.journeyTitle}
                          </span>
                        </span>
                        <span className="pw-bento-kpi">{item.getKpi(displayCatalogTotal)}</span>
                      </div>

                      <div className="pw-bento-bottom">
                        <h3>{item.title}</h3>
                        <p className="pw-bento-desc">{item.benefit}</p>
                        <div className="pw-bento-tags">
                          {item.tags.map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                        <div className="pw-bento-foot">
                          <Link
                            href={item.href}
                            className="pw-bento-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            ادخل القسم ←
                          </Link>
                          <Link
                            href={item.secondaryCta.href}
                            className="pw-bento-sublink"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.secondaryCta.label}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
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
                className="pw-btn pw-btn-primary pw-btn-lg pw-bs-more-btn"
                onClick={() => setVisibleCount((c) => c + INITIAL_BEST_SELLERS)}
              >
                عرض المزيد (+{Math.min(INITIAL_BEST_SELLERS, remainingCount)} منتج)
              </button>
            )}

            {visibleCount > INITIAL_BEST_SELLERS && (
              <button
                type="button"
                className="pw-btn pw-btn-ghost pw-btn-lg"
                onClick={() => setVisibleCount(INITIAL_BEST_SELLERS)}
              >
                إظهار أهم {INITIAL_BEST_SELLERS} فقط
              </button>
            )}

            <Link href="/store" className="pw-btn pw-btn-ghost pw-btn-lg">
              تصفح المتجر بالكامل ({displayCatalogTotal.toLocaleString('en-US')} منتج) ←
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
