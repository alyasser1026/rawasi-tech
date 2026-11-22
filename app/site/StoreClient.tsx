"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CSS } from './site-styles';
import { mergeContent, type SiteContentOverride } from './site-content';
import type { StoreCatalogQueryResult } from '@/lib/store-catalog-server';
import {
  getProductImageUrl,
  PRODUCT_CATEGORIES,
  PRODUCT_STUDIO_IMAGES_BY_CATEGORY,
  SMART_BUNDLES,
  type ProductCategoryId,
  type WebsiteMaintenanceService,
  type WebsiteProduct,
} from './store-catalog';
import { CartDrawer, useCustomerCart } from './CartDrawer';
import PublicHeader, { PUBLIC_NAV_ITEMS } from './PublicHeader';
import LoginModal from './LoginModal';
import FloatingContactChat from './FloatingContactChat';
import ContactModal from './ContactModal';
import Product4DSpinViewer from './Product4DSpinViewer';
import { rememberVisitorContact } from '@/lib/client-device-info';
import { usePerformancePreferences } from '@/components/PerformancePreferences';

type HeroOfferAction = {
  tab: 'products' | 'maintenance';
  category: 'all' | ProductCategoryId;
};

interface StoreOfferSlide {
  id: string;
  image: string;
  kicker: string;
  shortLabel: string;
  headline: string;
  subtitle: string;
  perks: string[];
  primaryLabel: string;
  primaryAction: HeroOfferAction;
  secondaryLabel: string;
  secondaryHref?: string;
  secondaryAction?: HeroOfferAction | 'contact';
}

const STORE_OFFER_SLIDES: StoreOfferSlide[] = [
  {
    id: 'smart-home-offer',
    image: '/sections/smart-home.jpg',
    kicker: 'عرض التجهيز الذكي · الأكثر طلباً',
    shortLabel: 'سمارت هوم',
    headline: 'حوّل وحدتك لمنزل ذكي متكامل بالتركيب',
    subtitle:
      'شاشات تحكم مركزية، أقفال أبواب ذكية 6×1 بالبصمة والوجه، ومفاتيح لمس تعمل بدون تكسير مع ضمان هندسي مكتوب.',
    perks: ['شامل التركيب', 'ضمان مكتوب', 'متابعة من الجوال'],
    primaryLabel: 'تصفح قسم السمارت هوم',
    primaryAction: { tab: 'products', category: 'smart_home' },
    secondaryLabel: 'باقات التوفير',
    secondaryHref: '#store-bundles',
  },
  {
    id: 'materials-offer',
    image: '/sections/materials.jpg',
    kicker: 'توريد مباشر للمشاريع والوحدات',
    shortLabel: 'خامات وتشطيب',
    headline: 'بورسلان كلكتا، رخام طبيعي، وخامات تشطيب بأسعار التوريد المباشر',
    subtitle:
      'تشكيلة منتقاة من البورسلان قص الليزر، السباكة المدفونة، ودهانات جوتن الأصلية جاهزة للتوريد الفوري لموقعك.',
    perks: ['توريد مباشر للموقع', 'خامات أصلية مضمونة', 'تسعير فوري للكميات'],
    primaryLabel: 'تصفح السيراميك والرخام',
    primaryAction: { tab: 'products', category: 'ceramics' },
    secondaryLabel: 'اطلب تسعيرة مشروع',
    secondaryAction: 'contact',
  },
  {
    id: 'safety-offer',
    image: '/sections/contracting.jpg',
    kicker: 'حماية متكاملة للشقق والفلل',
    shortLabel: 'أمان وكاميرات',
    headline: 'منظومة الأمان الذكي: كاميرات 4K وحساسات غلق الغاز والمياه تلقائياً',
    subtitle:
      'احمِ تشطيبك وأسرتك بحساسات تسرب الغاز والمياه المزودة بمحابس فصل أوتوماتيكية وكاميرات رؤية ليلية ملونة.',
    perks: ['غلق تلقائي عند التسرب', 'تنبيه لحظي للجوال', 'توريد وتركيب معتمد'],
    primaryLabel: 'تصفح حساسات الأمان',
    primaryAction: { tab: 'products', category: 'safety_sensors' },
    secondaryLabel: 'كاميرات 4K',
    secondaryAction: { tab: 'products', category: 'low_current' },
  },
  {
    id: 'maintenance-offer',
    image: '/sections/maintenance.jpg',
    kicker: 'تنفيذ وتأسيس وصيانة بضمان',
    shortLabel: 'تنفيذ وصيانة',
    headline: 'تنفيذ هندسي شامل وصيانة متخصصة بدون تكسير وبإشراف مهندسين',
    subtitle:
      'تأسيس كهرباء وسباكة وتكييف مخفي مع اختبارات ضغط 10 بار وصيانة دورية وقائية لكل القطاعات.',
    perks: ['إشراف مهندس مختص', 'اختبارات استلام موثقة', 'ضمان على المصنعية'],
    primaryLabel: 'استعرض خدمات التنفيذ والصيانة',
    primaryAction: { tab: 'maintenance', category: 'all' },
    secondaryLabel: 'احجز معاينة',
    secondaryAction: 'contact',
  },
];

function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

export default function StoreClient({
  content,
  initialCatalog,
}: {
  content?: SiteContentOverride;
  initialCatalog?: StoreCatalogQueryResult;
}) {
  const { SITE, PRODUCTS, MAINTENANCE_SERVICES, PROMO_BANNER } = mergeContent(content);
  const { fastMode } = usePerformancePreferences();
  const [loginOpen, setLoginOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [activeStoreTab, setActiveStoreTab] = useState<'products' | 'maintenance'>('products');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategoryId>('all');
  const [mntFilterCategory, setMntFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [installSelections, setInstallSelections] = useState<Record<string, boolean>>({});
  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimerRef = useRef<number | null>(null);

  // Top full-width rotating promo carousel state
  const [slideIdx, setSlideIdx] = useState(0);
  const [sliderPaused, setSliderPaused] = useState(false);

  // Sidebar filter states
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [globalInstallMode, setGlobalInstallMode] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'default' | 'name_asc' | 'price_asc' | 'price_desc'>('featured');
  const [mntFeeFilter, setMntFeeFilter] = useState<'all' | 'fixed' | 'quote'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Product technical details & attachments modal
  const [detailProduct, setDetailProduct] = useState<WebsiteProduct | null>(null);
  const [detailQty, setDetailQty] = useState(1);

  // Maintenance Request Modal state
  const [selectedMaintenance, setSelectedMaintenance] = useState<WebsiteMaintenanceService | null>(null);
  const [mntMode, setMntMode] = useState('تنفيذ وتأسيس جديد');
  const [mntName, setMntName] = useState('');
  const [mntPhone, setMntPhone] = useState('');
  const [mntCity, setMntCity] = useState('');
  const [mntAddress, setMntAddress] = useState('');
  const [mntDate, setMntDate] = useState('');
  const [mntNotes, setMntNotes] = useState('');
  const [mntBusy, setMntBusy] = useState(false);
  const [mntRef, setMntRef] = useState<string | null>(null);
  const [mntErr, setMntErr] = useState('');

  const localFallbackCatalog = useMemo<StoreCatalogQueryResult>(() => {
    const categoryCounts: Record<string, number> = { all: PRODUCTS.length };
    for (const c of PRODUCT_CATEGORIES) categoryCounts[c.id] = 0;
    for (const p of PRODUCTS) categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    const bMap = new Map<string, number>();
    for (const p of PRODUCTS) bMap.set(p.brand, (bMap.get(p.brand) || 0) + 1);
    return {
      items: PRODUCTS.slice(0, 24),
      totalMatched: PRODUCTS.length,
      totalCatalog: PRODUCTS.length,
      page: 1,
      pageSize: 24,
      totalPages: Math.max(1, Math.ceil(PRODUCTS.length / 24)),
      categoryCounts,
      brandCounts: Array.from(bMap.entries()).map(([brand, count]) => ({ brand, count })),
      hasPricedProducts: PRODUCTS.some((p) => p.price > 0),
      hasDiscountedProducts: PRODUCTS.some((p) => Boolean(p.oldPrice && p.oldPrice > p.price)),
      priceBounds: { min: 0, max: 0 },
      meta: {},
    };
  }, [PRODUCTS]);

  const [catalog, setCatalog] = useState<StoreCatalogQueryResult>(() => initialCatalog || localFallbackCatalog);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const didSkipInitialFetchRef = useRef(false);

  useEffect(() => {
    if (!initialCatalog) return;
    const isUnfilteredDefault =
      selectedCategory === 'all' &&
      !searchQuery.trim() &&
      selectedBrands.length === 0 &&
      !onlyFeatured &&
      !onlyInStock &&
      !onlyDiscounted &&
      !minPrice.trim() &&
      !maxPrice.trim() &&
      sortBy === 'featured' &&
      currentPage === 1;
    if (isUnfilteredDefault) {
      setCatalog(initialCatalog);
    }
  }, [
    initialCatalog,
    selectedCategory,
    searchQuery,
    selectedBrands,
    onlyFeatured,
    onlyInStock,
    onlyDiscounted,
    minPrice,
    maxPrice,
    sortBy,
    currentPage,
  ]);

  const cart = useCustomerCart(() => setLoginOpen(true));
  const cleanWa = (SITE.contact.whatsapp || '').replace(/[^\d]/g, '');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'maintenance') {
        setActiveStoreTab('maintenance');
      }
      const cat = params.get('category') || params.get('cat');
      if (cat && PRODUCT_CATEGORIES.some((c) => c.id === cat)) {
        setSelectedCategory(cat as ProductCategoryId);
        setActiveStoreTab('products');
      }
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedCategory,
    searchQuery,
    selectedBrands,
    onlyFeatured,
    onlyInStock,
    onlyDiscounted,
    minPrice,
    maxPrice,
    sortBy,
  ]);

  useEffect(() => {
    if (activeStoreTab !== 'products') return;
    const hasFullInitialCatalog =
      Boolean(initialCatalog) &&
      (Boolean(initialCatalog?.meta?.totalProducts) || (initialCatalog?.totalCatalog ?? 0) > 100);
    const isInitialDefaultQuery =
      hasFullInitialCatalog &&
      !didSkipInitialFetchRef.current &&
      selectedCategory === 'all' &&
      !searchQuery.trim() &&
      selectedBrands.length === 0 &&
      !onlyFeatured &&
      !onlyInStock &&
      !onlyDiscounted &&
      !minPrice.trim() &&
      !maxPrice.trim() &&
      sortBy === 'featured' &&
      currentPage === 1;

    if (isInitialDefaultQuery) {
      didSkipInitialFetchRef.current = true;
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogLoading(true);
      try {
        const sp = new URLSearchParams();
        if (selectedCategory !== 'all') sp.set('category', selectedCategory);
        if (searchQuery.trim()) sp.set('q', searchQuery.trim());
        if (selectedBrands.length > 0) sp.set('brands', selectedBrands.join(','));
        if (onlyFeatured) sp.set('onlyFeatured', '1');
        if (onlyInStock) sp.set('onlyInStock', '1');
        if (onlyDiscounted) sp.set('onlyDiscounted', '1');
        if (minPrice.trim()) sp.set('minPrice', minPrice.trim());
        if (maxPrice.trim()) sp.set('maxPrice', maxPrice.trim());
        sp.set('sort', sortBy);
        sp.set('page', String(currentPage));
        sp.set('pageSize', '24');

        const res = await fetch(`/api/store-catalog?${sp.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data: StoreCatalogQueryResult = await res.json();
        if (data && Array.isArray(data.items)) {
          setCatalog(data);
        }
      } catch {
        // Ignore aborts / transient fetch failures
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    activeStoreTab,
    initialCatalog,
    PRODUCTS.length,
    selectedCategory,
    searchQuery,
    selectedBrands,
    onlyFeatured,
    onlyInStock,
    onlyDiscounted,
    minPrice,
    maxPrice,
    sortBy,
    currentPage,
  ]);

  useEffect(() => {
    if (!detailProduct) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailProduct(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailProduct]);

  useEffect(() => {
    if (cart.user) {
      if (cart.user.fullName && !mntName) setMntName(cart.user.fullName);
      if (cart.user.phone && !mntPhone) setMntPhone(cart.user.phone);
    }
  }, [cart.user, mntName, mntPhone]);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (sliderPaused || fastMode) return;
    const timer = window.setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % STORE_OFFER_SLIDES.length);
    }, 8500);
    return () => window.clearInterval(timer);
  }, [sliderPaused, fastMode]);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileFiltersOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileFiltersOpen]);

  const flashAdded = (id: string) => {
    setAddedId(id);
    if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => {
      setAddedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  const scrollToCatalog = () => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('store-catalog');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goToSlide = (nextIdx: number) => {
    const total = STORE_OFFER_SLIDES.length;
    setSlideIdx(((nextIdx % total) + total) % total);
  };

  const handleHeroOfferAction = (action: HeroOfferAction) => {
    setActiveStoreTab(action.tab);
    if (action.tab === 'products') {
      setSelectedCategory(action.category);
    } else {
      setMntFilterCategory(action.category);
    }
    scrollToCatalog();
  };

  const handleSelectSectionCard = (tab: 'products' | 'maintenance', catId: string) => {
    setActiveStoreTab(tab);
    if (tab === 'products') {
      setSelectedCategory(catId as 'all' | ProductCategoryId);
      setSelectedBrands([]);
    } else {
      setMntFilterCategory(catId);
    }
    scrollToCatalog();
  };

  const handleToggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    if (activeStoreTab === 'products') {
      setSelectedCategory('all');
      setOnlyFeatured(false);
      setOnlyInStock(false);
      setOnlyDiscounted(false);
      setGlobalInstallMode(false);
      setSelectedBrands([]);
      setMinPrice('');
      setMaxPrice('');
      setSortBy('featured');
    } else {
      setMntFilterCategory('all');
      setMntFeeFilter('all');
    }
  };

  const availableMaintenance = useMemo(
    () => MAINTENANCE_SERVICES.filter((s) => s.available),
    [MAINTENANCE_SERVICES]
  );

  const filteredMaintenance = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableMaintenance.filter((srv) => {
      if (mntFilterCategory !== 'all' && srv.category !== mntFilterCategory) return false;
      if (mntFeeFilter === 'fixed' && !(srv.visitFee > 0)) return false;
      if (mntFeeFilter === 'quote' && srv.visitFee > 0) return false;
      if (!q) return true;
      return (
        srv.title.toLowerCase().includes(q) ||
        srv.code.toLowerCase().includes(q) ||
        srv.recommendation.toLowerCase().includes(q) ||
        srv.executionScope.some((x) => x.toLowerCase().includes(q)) ||
        srv.maintenanceScope.some((x) => x.toLowerCase().includes(q))
      );
    });
  }, [availableMaintenance, mntFilterCategory, mntFeeFilter, searchQuery]);

  const handleOpenMaintenanceModal = (srv: WebsiteMaintenanceService) => {
    setSelectedMaintenance(srv);
    setMntRef(null);
    setMntErr('');
  };

  const handleAddMaintenanceToCart = (srv: WebsiteMaintenanceService) => {
    const asProduct: WebsiteProduct = {
      id: srv.id,
      code: srv.code,
      name: `[تنفيذ وصيانة] ${srv.title}`,
      category: srv.category,
      brand: 'PhiTech Engineering',
      unit: 'معاينة / خدمة',
      price: srv.visitFee || 0,
      installPrice: 0,
      currency: srv.currency || 'ج.م',
      description: srv.recommendation,
      specs: [...srv.executionScope.slice(0, 2), ...srv.maintenanceScope.slice(0, 2)],
      imageUrl: srv.imageUrl,
      inStock: srv.available,
    };
    cart.addToCart(asProduct, 1, true);
    flashAdded(srv.id);
  };

  const handleSubmitMaintenanceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaintenance) return;
    setMntErr('');
    if (!mntName.trim() || mntPhone.replace(/\D/g, '').length < 8) {
      setMntErr('يرجى إدخال الاسم ورقم الجوال الصحيح للتواصل وتحديد موعد المعاينة');
      return;
    }
    setMntBusy(true);
    try {
      rememberVisitorContact({
        name: mntName.trim(),
        phone: mntPhone.trim(),
        email: cart.user?.email,
      });
      const res = await fetch('/api/website-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'maintenance_request',
          userId: cart.user?.id || null,
          customerName: mntName.trim(),
          customerPhone: mntPhone.trim(),
          customerEmail: cart.user?.email || '',
          city: mntCity.trim(),
          address: mntAddress.trim(),
          notes: mntNotes.trim(),
          maintenanceService: {
            code: selectedMaintenance.code,
            title: selectedMaintenance.title,
            mode: mntMode,
            preferredDate: mntDate.trim(),
          },
          totalAmount: selectedMaintenance.visitFee || 0,
          currency: selectedMaintenance.currency || 'ج.م',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'تعذر تسجيل الطلب حالياً');
      }
      setMntRef(data.refCode || 'MNT-2026');
    } catch (err: any) {
      setMntErr(err?.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setMntBusy(false);
    }
  };

  const categoryMap = useMemo(() => {
    const map: Record<string, (typeof PRODUCT_CATEGORIES)[number]> = {};
    for (const c of PRODUCT_CATEGORIES) map[c.id] = c;
    return map;
  }, []);

  const hasPricedProducts = catalog.hasPricedProducts;
  const hasDiscountedProducts = catalog.hasDiscountedProducts;

  const brandOptions = useMemo<[string, number][]>(() => {
    return catalog.brandCounts.map((b) => [b.brand, b.count]);
  }, [catalog.brandCounts]);

  const filteredProducts = catalog.items;

  const paginationPages = useMemo<(number | 'ellipsis')[]>(() => {
    const total = catalog.totalPages;
    const cur = catalog.page;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: (number | 'ellipsis')[] = [1];
    if (cur > 3) out.push('ellipsis');
    const start = Math.max(2, cur - 1);
    const end = Math.min(total - 1, cur + 1);
    for (let i = start; i <= end; i++) out.push(i);
    if (cur < total - 2) out.push('ellipsis');
    out.push(total);
    return out;
  }, [catalog.page, catalog.totalPages]);

  const handleOpenDetail = (p: WebsiteProduct) => {
    setDetailQty(1);
    setDetailProduct(p);
  };

  const handleGoPage = (nextPage: number) => {
    const safe = Math.min(catalog.totalPages, Math.max(1, nextPage));
    setCurrentPage(safe);
    scrollToCatalog();
  };

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchQuery.trim()) c++;
    if (activeStoreTab === 'products') {
      if (selectedCategory !== 'all') c++;
      if (onlyFeatured) c++;
      if (onlyInStock) c++;
      if (onlyDiscounted) c++;
      if (globalInstallMode) c++;
      c += selectedBrands.length;
      if (minPrice.trim() || maxPrice.trim()) c++;
    } else {
      if (mntFilterCategory !== 'all') c++;
      if (mntFeeFilter !== 'all') c++;
    }
    return c;
  }, [
    searchQuery,
    activeStoreTab,
    selectedCategory,
    onlyFeatured,
    onlyInStock,
    onlyDiscounted,
    globalInstallMode,
    selectedBrands,
    minPrice,
    maxPrice,
    mntFilterCategory,
    mntFeeFilter,
  ]);

  const handleToggleCardInstall = (id: string) => {
    setInstallSelections((prev) => {
      const current = prev[id] ?? globalInstallMode;
      return { ...prev, [id]: !current };
    });
  };

  const handleProductAdd = (p: WebsiteProduct, withInstall: boolean, qty = 1) => {
    cart.addToCart(p, qty, withInstall);
    flashAdded(p.id);
  };

  const handleBundleAdd = (bundleId: string) => {
    const bundle = SMART_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) return;
    const list: Array<{ product: WebsiteProduct; qty: number }> = [];
    for (const item of bundle.productIds) {
      const found =
        catalog.items.find((p) => p.id === item.productId) ||
        PRODUCTS.find((p) => p.id === item.productId);
      if (found) list.push({ product: found, qty: item.qty });
    }
    if (list.length > 0) {
      cart.addBundleToCart(list, true);
    } else {
      cart.addToCart(
        {
          id: bundle.id,
          code: bundle.id.toUpperCase(),
          name: bundle.title,
          category: 'smart_home',
          brand: 'PhiTech Smart Home',
          unit: 'باقة متكاملة',
          price: bundle.price,
          oldPrice: bundle.oldPrice || undefined,
          currency: bundle.currency,
          badge: bundle.badge,
          description: bundle.subtitle,
          specs: bundle.items,
          inStock: true,
        },
        1,
        true
      );
    }
    flashAdded(bundleId);
  };

  const activeSlide = STORE_OFFER_SLIDES[slideIdx] || STORE_OFFER_SLIDES[0];

  return (
    <div className={`pw st-page ${loginOpen || contactOpen || selectedMaintenance || detailProduct ? 'has-modal-blur' : ''}`} dir="rtl">
      <style>{CSS}</style>
      <style>{`
        .pw.st-page {
          background: #fbfaf7;
          min-height: 100vh;
        }
        .pw.st-page .pw-header.pw-header-glass {
          margin-bottom: 0 !important;
          background: rgba(251, 250, 247, 0.92) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border-bottom: 1px solid rgba(20, 24, 27, 0.08) !important;
          box-shadow: 0 4px 20px rgba(20, 24, 27, 0.05) !important;
        }
        .pw.st-page .st-wide-wrap {
          max-width: none;
          width: 100%;
          padding-inline: clamp(16px, 2.2vw, 36px);
        }

        /* 1. Calm Warm-Pearl Editorial Split Promotional Hero */
        .pw.st-page .pw-unified-hero.st-promo-stage {
          position: relative;
          width: 100%;
          padding: 20px 0 24px;
          background: linear-gradient(180deg, #faf8f4 0%, #f5f1e9 100%);
          color: #14181b;
          overflow: hidden;
          border-bottom: 1px solid #e7e1d7;
        }
        .st-promo-inner {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .st-promo-top-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px 16px;
          flex-wrap: wrap;
        }
        .pw.st-page .pw-unified-hero.st-promo-stage .pw-unified-crumb {
          margin: 0;
          justify-content: flex-start;
          color: #64748b;
          font-size: 0.78rem;
        }
        .pw.st-page .pw-unified-hero.st-promo-stage .pw-unified-crumb a {
          color: #47525c;
        }
        .pw.st-page .pw-unified-hero.st-promo-stage .pw-unified-crumb a:hover {
          color: var(--o);
        }
        .pw.st-page .pw-unified-hero.st-promo-stage .pw-unified-promo {
          margin: 0;
          padding: 5px 12px;
          border-radius: var(--r-pill);
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          font-size: 0.76rem;
          font-weight: 700;
          max-width: 100%;
          line-height: 1.5;
          text-align: right;
        }
        .st-promo-card {
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-radius: var(--ui-card-r, 16px);
          box-shadow: 0 12px 30px -24px rgba(20, 24, 27, 0.14);
          padding: clamp(18px, 2.2vw, 28px);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .st-promo-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.92fr);
          gap: clamp(18px, 2.6vw, 34px);
          align-items: center;
        }
        .st-promo-copy {
          display: flex;
          flex-direction: column;
          gap: 11px;
          align-items: flex-start;
          text-align: right;
          min-width: 0;
        }
        .st-promo-kicker {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--o);
          font-size: 0.78rem;
          font-weight: 800;
        }
        .st-promo-kicker i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--o);
          display: block;
          flex-shrink: 0;
        }
        .st-promo-copy h1 {
          margin: 0;
          font-size: clamp(1.38rem, 2.2vw, 1.92rem);
          font-weight: 900;
          line-height: 1.35;
          color: #14181b;
        }
        .st-promo-copy p {
          margin: 0;
          max-width: 54ch;
          font-size: 0.9rem;
          line-height: 1.68;
          color: #525e6a;
          font-weight: 500;
        }
        .st-promo-perks {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 16px;
          padding-top: 2px;
        }
        .st-promo-perk {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #334155;
          font-size: 0.8rem;
          font-weight: 700;
        }
        .st-promo-perk svg {
          color: #059669;
          flex-shrink: 0;
        }
        .st-promo-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 4px;
        }
        .st-promo-actions .pw-btn {
          min-height: 40px;
          padding: 8px 18px;
          font-size: 0.86rem;
        }
        .st-promo-secondary-btn {
          background: #fbfaf7 !important;
          border: 1px solid #dfd7cc !important;
          color: #14181b !important;
        }
        .st-promo-secondary-btn:hover {
          background: #f4efe6 !important;
          border-color: #c75517 !important;
          color: #a64310 !important;
        }
        .st-promo-media-frame {
          position: relative;
          aspect-ratio: 16 / 10;
          border-radius: 14px;
          overflow: hidden;
          background: #f2ede4;
          border: 1px solid #ece5da;
        }
        .st-promo-bg-slide {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 0.45s ease;
          pointer-events: none;
        }
        .st-promo-bg-slide.is-active {
          opacity: 1;
        }

        /* Carousel Bottom Bar */
        .st-promo-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: 14px;
          border-top: 1px solid #f0ebe2;
        }
        .st-promo-segs {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border-radius: 12px;
          background: #f5f1e9;
          border: 1px solid #ebe4d8;
        }
        .st-promo-seg {
          border: none;
          background: transparent;
          border-radius: 8px;
          padding: 6px 13px;
          color: #525e6a;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
        }
        .st-promo-seg:hover {
          color: #14181b;
        }
        .st-promo-seg.is-active {
          background: #ffffff;
          color: #c75517;
          box-shadow: 0 4px 12px -6px rgba(20, 24, 27, 0.2);
        }
        .st-promo-seg-num {
          font-family: ui-monospace, Consolas, monospace;
          font-size: 0.72rem;
          opacity: 0.65;
        }
        .st-promo-seg.is-active .st-promo-seg-num {
          opacity: 1;
          color: #c75517;
        }
        .st-promo-nav-end {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .st-promo-counter {
          font-family: ui-monospace, Consolas, monospace;
          font-size: 0.76rem;
          font-weight: 800;
          color: #64748b;
          padding-inline: 4px;
          white-space: nowrap;
        }
        .st-promo-arrows {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .st-promo-arrow-btn {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid #e2dbd0;
          background: #fbfaf7;
          color: #334155;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
        }
        .st-promo-arrow-btn:hover {
          background: #ffffff;
          border-color: var(--o);
          color: var(--o);
        }

        /* 2. Store Visual Sections Band */
        .st-sections-band {
          padding: 32px 0 28px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfaf7 100%);
          border-bottom: 1px solid #e7e1d7;
        }
        .st-sections-head {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }
        .st-sections-head h2 {
          margin: 4px 0 0;
          font-size: clamp(1.25rem, 2.1vw, 1.65rem);
          font-weight: 800;
          color: #14181b;
        }
        .st-sections-kicker {
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--o);
        }
        .st-mode-switch {
          background: #f4efe6;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card-sm);
          padding: 4px;
          display: inline-grid;
          grid-template-columns: auto auto;
          gap: 4px;
        }
        .st-mode-btn {
          min-height: var(--ui-btn-h, 44px);
          padding: 8px 16px;
          border: none;
          border-radius: var(--ui-btn-r, 10px);
          background: transparent;
          color: #525e6a;
          font-weight: 800;
          font-size: 0.88rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          white-space: nowrap;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .st-mode-btn:hover {
          color: #14181b;
        }
        .st-mode-btn.is-active {
          background: #ffffff;
          color: #14181b;
          box-shadow: 0 6px 16px -10px rgba(20, 24, 27, 0.24);
        }
        .st-mode-btn.is-active.is-products {
          color: #c75517;
        }
        .st-mode-btn.is-active.is-mnt {
          color: #1e3a5f;
        }
        .st-mode-count {
          padding: 2px 8px;
          border-radius: var(--r-pill);
          background: #ebe4d8;
          color: #525e6a;
          font-size: 0.75rem;
          font-weight: 800;
        }
        .st-mode-btn.is-active .st-mode-count {
          background: #fff3ea;
          color: #c75517;
        }
        .st-mode-btn.is-active.is-mnt .st-mode-count {
          background: #eef2f6;
          color: #1e3a5f;
        }

        .st-sections-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 185px), 1fr));
          gap: 12px;
        }
        .st-section-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--ui-btn-r, 12px);
          background: #ffffff;
          border: 1.5px solid #e7e1d7;
          color: #14181b;
          text-align: right;
          cursor: pointer;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease, background 0.16s ease;
          content-visibility: auto;
          contain-intrinsic-size: auto 72px;
        }
        .st-section-card:hover {
          border-color: rgba(199, 85, 23, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -18px rgba(20, 24, 27, 0.22);
        }
        .st-section-card.is-active {
          border-color: var(--o);
          background: #fff8f3;
          box-shadow: 0 12px 24px -18px rgba(199, 85, 23, 0.38);
        }
        .st-section-thumb {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          object-fit: cover;
          background: #0f161e;
          flex-shrink: 0;
          border: 1px solid #e7e1d7;
        }
        .st-section-meta {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .st-section-meta strong {
          font-size: 0.85rem;
          font-weight: 800;
          color: #14181b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .st-section-card.is-active .st-section-meta strong {
          color: var(--o-dark);
        }
        .st-section-meta span {
          font-size: 0.74rem;
          font-weight: 700;
          color: #64748b;
        }

        /* 3. Main Catalog Layout with Sticky Side Filter Menu */
        .st-main {
          padding-top: 28px;
          padding-bottom: 72px;
        }
        .st-catalog-layout {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: var(--ui-gap, 24px);
          align-items: start;
        }
        .st-filter-backdrop {
          display: none;
        }
        .st-filter-sidebar {
          position: sticky;
          top: 88px;
          max-height: calc(100vh - 104px);
          overflow-y: auto;
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-radius: var(--ui-card-r, 16px);
          padding: var(--ui-card-pad-sm, 18px);
          box-shadow: 0 14px 32px -24px rgba(20, 24, 27, 0.14);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .st-sidebar-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-bottom: 12px;
          border-bottom: 1px solid #efe9df;
        }
        .st-sidebar-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.96rem;
          font-weight: 900;
          color: #14181b;
        }
        .st-sidebar-title svg {
          color: var(--o);
        }
        .st-sidebar-badge {
          min-width: 22px;
          height: 22px;
          padding: 0 7px;
          border-radius: var(--r-pill);
          background: var(--o);
          color: #ffffff;
          font-size: 0.72rem;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .st-sidebar-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .st-sidebar-reset {
          border: none;
          background: #fff3ea;
          color: var(--o-dark);
          padding: 4px 10px;
          border-radius: var(--r-pill);
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
        }
        .st-sidebar-reset:hover {
          background: #fed7aa;
        }
        .st-sidebar-close {
          display: none;
        }
        .st-filter-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-bottom: 14px;
          border-bottom: 1px solid #f2ede4;
        }
        .st-filter-group:last-of-type {
          border-bottom: none;
          padding-bottom: 0;
        }
        .st-filter-group-title {
          font-size: 0.82rem;
          font-weight: 900;
          color: #14181b;
        }
        .st-sidebar-search {
          width: 100%;
          min-height: 40px;
          padding: 8px 12px;
          border-radius: var(--r-btn-sm);
          border: 1.5px solid #dfd7cc;
          background: #fbfaf7;
          color: #14181b;
          font-size: 0.85rem;
          font-weight: 600;
          outline: none;
        }
        .st-sidebar-search:focus {
          background: #ffffff;
          border-color: var(--o);
        }
        .st-filter-cat-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .st-filter-cat-item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 36px;
          padding: 6px 10px;
          border-radius: var(--r-btn-sm);
          border: 1px solid transparent;
          border-inline-start: 3px solid transparent;
          background: transparent;
          color: #47525c;
          font-size: 0.83rem;
          font-weight: 700;
          text-align: right;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .st-filter-cat-item:hover {
          background: #fbfaf7;
          color: #14181b;
        }
        .st-filter-cat-item.is-active {
          background: #fff3ea;
          color: var(--o-dark);
          border-color: #fed7aa;
          border-inline-start-color: var(--o);
          font-weight: 800;
        }
        .st-filter-cat-count {
          font-size: 0.74rem;
          font-weight: 800;
          color: #64748b;
          background: #f4efe6;
          padding: 1px 7px;
          border-radius: var(--r-pill);
        }
        .st-filter-cat-item.is-active .st-filter-cat-count {
          background: #ffffff;
          color: var(--o-dark);
        }
        .st-check-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .st-check-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 0.82rem;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
        }
        .st-check-row-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .st-check-row-left span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .st-check-row input {
          accent-color: var(--o);
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }
        .st-more-brands-btn {
          align-self: flex-start;
          border: none;
          background: transparent;
          color: var(--o-dark);
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
          padding: 2px 0;
        }
        .st-price-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .st-price-input {
          width: 100%;
          min-height: 38px;
          padding: 6px 10px;
          border-radius: var(--r-btn-sm);
          border: 1.5px solid #dfd7cc;
          background: #fbfaf7;
          color: #14181b;
          font-size: 0.82rem;
          font-weight: 700;
          outline: none;
        }
        .st-price-input:focus {
          background: #ffffff;
          border-color: var(--o);
        }
        .st-sidebar-mobile-foot {
          display: none;
        }

        /* Main Catalog Content Column */
        .st-catalog-content {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .st-results-bar {
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-radius: var(--ui-card-r, 16px);
          padding: 14px 18px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 10px 26px -22px rgba(20, 24, 27, 0.14);
        }
        .st-mobile-filter-btn {
          display: none;
        }
        .st-search-box {
          flex: 1 1 260px;
          position: relative;
          display: flex;
          align-items: center;
          background: #fbfaf7;
          border: 1.5px solid #dfd7cc;
          border-radius: var(--ui-btn-r, 10px);
          min-height: var(--ui-input-h, 44px);
          padding: 0 12px;
          gap: 10px;
          transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }
        .st-search-box:focus-within {
          background: #ffffff;
          border-color: var(--o);
          box-shadow: 0 0 0 3px rgba(199, 85, 23, 0.12);
        }
        .st-search-box svg {
          color: #64748b;
          flex-shrink: 0;
        }
        .st-search-input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          font-size: 0.92rem;
          font-weight: 600;
          color: #14181b;
          min-height: 38px;
        }
        .st-search-clear {
          width: 32px;
          height: 32px;
          border-radius: var(--r-btn-sm);
          border: none;
          background: #f4efe6;
          color: #47525c;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .st-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .st-sort-select {
          min-height: 38px;
          padding: 6px 12px;
          border-radius: var(--ui-btn-r, 10px);
          border: 1.5px solid #dfd7cc;
          background: #fbfaf7;
          color: #14181b;
          font-size: 0.83rem;
          font-weight: 700;
          cursor: pointer;
          outline: none;
        }
        .st-sort-select:focus {
          border-color: var(--o);
          background: #ffffff;
        }
        .st-count-pill {
          min-height: 36px;
          padding: 6px 12px;
          border-radius: var(--r-pill);
          background: #f4efe6;
          color: #47525c;
          font-size: 0.81rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .st-count-pill strong {
          color: var(--o-dark);
          font-weight: 900;
        }
        .st-active-filters {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .st-active-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 32px;
          padding: 4px 10px;
          border-radius: var(--r-pill);
          background: #fff3ea;
          border: 1px solid #fed7aa;
          color: var(--o-dark);
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
        }
        .st-active-chip:hover {
          background: #fed7aa;
        }
        .st-active-clear-all {
          border: none;
          background: transparent;
          color: #47525c;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
          text-decoration: underline;
        }

        /* Product Cards Grid */
        .st-products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--ui-prod-min, 228px)), 1fr));
          gap: clamp(12px, 1.15vw, 18px);
        }
        .st-prod-card {
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-radius: var(--ui-card-r, 16px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          cursor: pointer;
          box-shadow: 0 14px 32px -24px rgba(20, 24, 27, 0.15);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          content-visibility: auto;
          contain-intrinsic-size: auto 370px;
        }
        .st-prod-card:hover {
          transform: translateY(-3px);
          border-color: rgba(199, 85, 23, 0.45);
          box-shadow: 0 22px 44px -24px rgba(20, 24, 27, 0.22);
        }
        .st-prod-media {
          position: relative;
          aspect-ratio: 5 / 4;
          background: #f8f6f2;
          border-bottom: 1px solid #f0ebe2;
          overflow: hidden;
          cursor: pointer;
        }
        .st-prod-media img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 4px;
          mix-blend-mode: multiply;
          display: block;
          transition: transform 0.35s ease;
        }
        .st-prod-card:hover .st-prod-media img {
          transform: scale(1.03);
        }
        .st-prod-badge {
          position: absolute;
          top: 8px;
          inset-inline-start: 8px;
          padding: 2px 8px;
          border-radius: var(--r-pill);
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #e7e1d7;
          color: #14181b;
          font-size: 0.66rem;
          font-weight: 800;
          box-shadow: 0 4px 12px rgba(20, 24, 27, 0.12);
        }
        .st-prod-discount {
          position: absolute;
          top: 8px;
          inset-inline-end: 8px;
          padding: 2px 7px;
          border-radius: var(--r-pill);
          background: #059669;
          color: #ffffff;
          font-size: 0.66rem;
          font-weight: 800;
        }
        .st-prod-code-tag {
          position: absolute;
          bottom: 8px;
          inset-inline-start: 8px;
          padding: 2px 7px;
          border-radius: 6px;
          background: rgba(15, 22, 30, 0.78);
          backdrop-filter: blur(6px);
          color: #f8fafc;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 0.64rem;
          font-weight: 800;
        }
        .st-prod-body {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 1;
        }
        .st-prod-cat {
          font-size: 0.68rem;
          font-weight: 800;
          color: var(--o);
        }
        .st-prod-body h3 {
          font-size: 0.85rem;
          font-weight: 800;
          line-height: 1.38;
          color: #14181b;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .st-prod-desc {
          font-size: 0.74rem;
          color: #525e6a;
          line-height: 1.45;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .st-prod-specs {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 2px;
          font-size: 0.71rem;
          color: #334155;
          font-weight: 600;
        }
        .st-prod-specs li {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          min-width: 0;
        }
        .st-prod-specs li span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .st-prod-specs li::before {
          content: '';
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--o);
          margin-top: 7px;
          flex-shrink: 0;
        }
        .st-prod-foot {
          padding: 9px 12px 11px;
          border-top: 1px solid #efe9df;
          background: #fbfaf7;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .st-install-toggle {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 26px;
          padding: 3px 8px;
          border-radius: var(--r-pill);
          background: #ffffff;
          border: 1px solid #dfd7cc;
          color: #47525c;
          font-size: 0.71rem;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .st-modal-card .st-install-toggle {
          min-height: 36px;
          padding: 6px 12px;
          font-size: 0.78rem;
          align-self: flex-start;
        }
        .st-install-toggle.is-checked {
          background: #ecfdf5;
          border-color: #10b981;
          color: #065f46;
        }
        .st-install-toggle input {
          accent-color: #059669;
          width: 13px;
          height: 13px;
          margin: 0;
          flex-shrink: 0;
        }
        .st-price-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .st-price-old {
          font-size: 0.7rem;
          color: #94a3b8;
          text-decoration: line-through;
          display: block;
        }
        .st-price-main {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .st-price-main strong {
          font-size: 1.02rem;
          font-weight: 900;
          color: #14181b;
        }
        .st-price-main span {
          font-size: 0.72rem;
          font-weight: 700;
          color: #525e6a;
        }
        .st-price-quote strong {
          font-size: 0.84rem;
          font-weight: 800;
          color: var(--o-dark);
          display: block;
        }
        .st-price-quote span {
          font-size: 0.7rem;
          font-weight: 600;
          color: #64748b;
        }
        .st-prod-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .st-prod-actions .pw-btn {
          flex: 1;
          min-height: max(32px, calc(var(--ui-btn-h, 44px) - 12px)) !important;
          padding: 4px 10px !important;
          font-size: calc(var(--ui-btn-fs, 0.9375rem) * 0.8) !important;
          border-radius: var(--r-btn-sm) !important;
        }
        .st-prod-actions .pw-btn.is-added {
          background: #059669;
          box-shadow: 0 10px 20px -12px rgba(5, 150, 105, 0.7);
        }
        .st-wa-link {
          min-height: max(32px, calc(var(--ui-btn-h, 44px) - 12px));
          padding: 4px 9px;
          border-radius: var(--r-btn-sm);
          border: 1px solid #dfd7cc;
          background: #ffffff;
          color: #14181b;
          font-size: calc(var(--ui-btn-fs, 0.9375rem) * 0.78);
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          transition: border-color 0.16s ease, color 0.16s ease, background 0.16s ease;
        }
        .st-wa-link:hover {
          border-color: var(--o);
          color: var(--o-dark);
          background: #fff8f3;
        }

        /* Smart Bundles Section */
        .st-bundles-section {
          margin-top: 52px;
          padding-top: 44px;
          border-top: 1px solid #e7e1d7;
        }
        .st-section-head {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 24px;
        }
        .st-section-head .pw-eyebrow {
          margin-bottom: 6px;
        }
        .st-section-head h2 {
          font-size: clamp(1.3rem, 2.2vw, 1.75rem);
          font-weight: 800;
          color: #14181b;
          margin: 0 0 6px;
        }
        .st-section-head p {
          font-size: 0.92rem;
          color: #525e6a;
          margin: 0;
        }
        .st-bundles-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--ui-gap, 24px);
        }
        .st-bundle-card {
          background: linear-gradient(155deg, #ffffff 0%, #fcf7f1 100%);
          border: 1px solid #ebd7c4;
          border-top: 3px solid var(--o);
          border-radius: var(--ui-card-r, 16px);
          padding: var(--ui-card-pad, 24px);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
          box-shadow: 0 14px 32px -24px rgba(199, 85, 23, 0.25);
          content-visibility: auto;
          contain-intrinsic-size: auto 440px;
        }
        .st-bundle-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .st-bundle-badge {
          background: var(--o);
          color: #ffffff;
          padding: 4px 12px;
          border-radius: var(--r-pill);
          font-size: 0.76rem;
          font-weight: 800;
        }
        .st-bundle-note {
          font-size: 0.78rem;
          color: #64748b;
          font-weight: 700;
        }
        .st-bundle-card h3 {
          font-size: 1.14rem;
          font-weight: 800;
          color: #14181b;
          margin-bottom: 6px;
        }
        .st-bundle-sub {
          font-size: 0.86rem;
          color: #525e6a;
          line-height: 1.6;
          margin-bottom: 12px;
        }
        .st-bundle-items {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.84rem;
          color: #334155;
          font-weight: 700;
        }
        .st-bundle-items li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .st-bundle-items svg {
          color: #059669;
          flex-shrink: 0;
          margin-top: 3px;
        }
        .st-bundle-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid #f0dfd0;
        }
        .st-bundle-price {
          font-size: 1.32rem;
          font-weight: 900;
          color: var(--o-dark);
        }

        /* Maintenance & Engineering Execution Tab */
        .st-mnt-banner {
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-inline-start: 4px solid var(--o);
          border-radius: var(--ui-card-r, 16px);
          padding: var(--ui-card-pad, 24px);
          display: grid;
          gap: 16px;
          box-shadow: 0 12px 28px -24px rgba(20, 24, 27, 0.14);
        }
        .st-mnt-banner-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .st-mnt-banner-top h2 {
          font-size: 1.2rem;
          font-weight: 800;
          color: #14181b;
          margin: 4px 0 0;
        }
        .st-mnt-kicker {
          font-size: 0.78rem;
          font-weight: 800;
          color: var(--o);
        }
        .st-mnt-warranty-pill {
          background: #fff3ea;
          border: 1px solid #fed7aa;
          color: var(--o-dark);
          padding: 6px 14px;
          border-radius: var(--r-pill);
          font-size: 0.8rem;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .st-mnt-rules {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .st-mnt-rule {
          background: #fbfaf7;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card-sm);
          padding: 14px;
          font-size: 0.82rem;
          color: #47525c;
          line-height: 1.6;
        }
        .st-mnt-rule strong {
          display: block;
          color: #14181b;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .st-mnt-rule-num {
          color: var(--o);
          font-family: ui-monospace, Consolas, monospace;
          margin-inline-end: 6px;
        }
        .st-mnt-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--ui-gap, 24px);
        }
        .st-mnt-card {
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-radius: var(--ui-card-r, 16px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 14px 32px -24px rgba(20, 24, 27, 0.14);
          content-visibility: auto;
          contain-intrinsic-size: auto 440px;
        }
        .st-mnt-card-head {
          padding: var(--ui-card-pad-sm, 20px) var(--ui-card-pad, 24px);
          background: linear-gradient(155deg, #fbfaf7 0%, #ffffff 100%);
          border-bottom: 1px solid #efe9df;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .st-mnt-code {
          display: block;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 0.74rem;
          font-weight: 800;
          color: var(--o);
          margin-bottom: 4px;
        }
        .st-mnt-card-head h3 {
          margin: 0;
          font-size: 1.04rem;
          font-weight: 800;
          color: #14181b;
          line-height: 1.45;
        }
        .st-mnt-card-body {
          padding: var(--ui-card-pad-sm, 20px) var(--ui-card-pad, 24px);
          display: grid;
          gap: 12px;
        }
        .st-mnt-scopes {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .st-mnt-scope-box {
          background: #fbfaf7;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card-sm);
          padding: 12px;
        }
        .st-mnt-scope-box.is-exec {
          border-top: 2px solid var(--o);
        }
        .st-mnt-scope-box.is-fix {
          border-top: 2px solid #1e3a5f;
        }
        .st-mnt-scope-box strong {
          display: block;
          font-size: 0.82rem;
          font-weight: 800;
          color: #14181b;
          margin-bottom: 8px;
        }
        .st-mnt-scope-box ul {
          display: grid;
          gap: 6px;
          font-size: 0.79rem;
          color: #47525c;
          font-weight: 600;
        }
        .st-mnt-scope-box li {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        .st-mnt-rec {
          background: #fff8f1;
          border: 1px solid #f5dcc6;
          border-inline-start: 3px solid var(--o);
          border-radius: var(--r-card-sm);
          padding: 12px 16px;
          font-size: 0.8rem;
          line-height: 1.65;
          color: #5c3a21;
          font-weight: 600;
        }
        .st-mnt-foot {
          padding: calc(var(--ui-card-pad-sm, 20px) * 0.8) var(--ui-card-pad, 24px);
          border-top: 1px solid #efe9df;
          background: #fbfaf7;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .st-mnt-fee-label {
          font-size: 0.76rem;
          color: #64748b;
          display: block;
          font-weight: 700;
        }
        .st-mnt-fee-val {
          font-size: 1.1rem;
          font-weight: 900;
          color: #14181b;
        }
        .st-mnt-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .st-prod-media {
          cursor: pointer;
        }
        .st-prod-body h3 button {
          border: none;
          background: transparent;
          padding: 0;
          margin: 0;
          font: inherit;
          color: inherit;
          text-align: right;
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .st-prod-body h3 button:hover {
          color: var(--o);
        }
        .st-detail-trigger {
          align-self: flex-start;
          border: none;
          background: transparent;
          padding: 2px 0;
          color: var(--o-dark);
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
        }
        .st-detail-trigger:hover {
          text-decoration: underline;
        }

        /* Pagination Bar */
        .st-pagination {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-radius: var(--ui-card-r, 16px);
          margin-top: 8px;
        }
        .st-page-info {
          font-size: 0.84rem;
          font-weight: 700;
          color: #525e6a;
        }
        .st-page-info strong {
          color: #14181b;
        }
        .st-page-btns {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }
        .st-page-btn {
          min-width: 38px;
          min-height: 38px;
          padding: 0 10px;
          border-radius: var(--r-btn-sm);
          border: 1px solid #dfd7cc;
          background: #fbfaf7;
          color: #14181b;
          font-size: 0.84rem;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .st-page-btn:hover:not(:disabled) {
          border-color: var(--o);
          color: var(--o-dark);
          background: #fff8f3;
        }
        .st-page-btn.is-active {
          background: var(--o);
          border-color: var(--o);
          color: #ffffff;
        }
        .st-page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .st-page-ellipsis {
          padding: 0 4px;
          color: #64748b;
          font-weight: 800;
        }

        /* Product Technical Details & Attachments Modal */
        .st-modal-card.st-detail-modal {
          max-width: 820px;
        }
        .st-detail-grid {
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        .st-detail-media {
          border-radius: var(--r-card-sm);
          overflow: hidden;
          border: 1px solid #e7e1d7;
          background: #ffffff;
          aspect-ratio: 4 / 3;
          position: relative;
        }
        .st-detail-media img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 10px;
          display: block;
        }
        .st-detail-specs {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px 14px;
          border-radius: var(--r-card-sm);
          background: #fbfaf7;
          border: 1px solid #e7e1d7;
        }
        .st-detail-specs li {
          font-size: 0.83rem;
          color: #1e293b;
          font-weight: 700;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .st-detail-specs li svg {
          color: #059669;
          flex-shrink: 0;
          margin-top: 3px;
        }
        .st-detail-variants {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .st-detail-variant-pill {
          padding: 4px 10px;
          border-radius: var(--r-pill);
          background: #f4efe6;
          border: 1px solid #dfd7cc;
          font-size: 0.76rem;
          font-weight: 700;
          color: #14181b;
        }
        .st-detail-att-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .st-detail-att-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 36px;
          padding: 6px 12px;
          border-radius: var(--r-btn-sm);
          border: 1px solid #dfd7cc;
          background: #ffffff;
          color: var(--o-dark);
          font-size: 0.8rem;
          font-weight: 800;
        }
        .st-detail-att-link:hover {
          background: #fff3ea;
          border-color: var(--o);
        }
        .st-qty-box {
          display: inline-flex;
          align-items: center;
          border: 1.5px solid #dfd7cc;
          border-radius: var(--r-btn);
          background: #fbfaf7;
          overflow: hidden;
        }
        .st-qty-box button {
          width: 38px;
          height: 40px;
          border: none;
          background: transparent;
          font-size: 1.05rem;
          font-weight: 900;
          color: #14181b;
          cursor: pointer;
        }
        .st-qty-box button:hover {
          background: #efe9df;
        }
        .st-qty-box span {
          min-width: 34px;
          text-align: center;
          font-size: 0.9rem;
          font-weight: 800;
        }

        /* Empty Search State */
        .st-empty {
          background: #ffffff;
          border: 1px dashed #dfd7cc;
          border-radius: var(--ui-card-r, 16px);
          padding: 48px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #525e6a;
        }
        .st-empty h3 {
          color: #14181b;
          font-size: 1.12rem;
          font-weight: 800;
        }

        /* Maintenance Booking Modal */
        .st-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 99985;
          background: rgba(14, 18, 22, 0.56);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          direction: rtl;
        }
        .st-modal-card {
          width: 100%;
          max-width: 560px;
          background: #ffffff;
          color: #14181b;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card);
          padding: 24px;
          box-shadow: 0 28px 64px -20px rgba(10, 15, 20, 0.42);
          max-height: calc(100dvh - 32px);
          overflow-y: auto;
        }
        .st-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .st-modal-head h3 {
          font-size: 1.12rem;
          font-weight: 800;
          color: #14181b;
          margin: 0;
        }
        .st-modal-close {
          width: 40px;
          height: 40px;
          border-radius: var(--r-btn);
          border: 1px solid #e7e1d7;
          background: #fbfaf7;
          color: #47525c;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .st-modal-close:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: #b91c1c;
        }
        .st-modal-service-box {
          background: #fbfaf7;
          border: 1px solid #e7e1d7;
          border-inline-start: 3px solid var(--o);
          border-radius: var(--r-card-sm);
          padding: 12px 16px;
          font-size: 0.84rem;
          margin-bottom: 12px;
        }
        .st-modal-service-box strong {
          display: block;
          color: #14181b;
          margin-bottom: 2px;
        }
        .st-modal-service-box span {
          color: #525e6a;
        }
        .st-modal-grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .st-modal-input {
          width: 100%;
          min-height: 44px;
          padding: 10px 16px;
          border-radius: var(--r-btn);
          border: 1.5px solid #dfd7cc;
          background: #fbfaf7;
          color: #14181b;
          font-weight: 600;
          font-size: 0.94rem;
          outline: none;
        }
        .st-modal-input:focus {
          background: #ffffff;
          border-color: var(--o);
        }
        .st-modal-err {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 10px 12px;
          border-radius: var(--r-btn-sm);
          font-size: 0.82rem;
          font-weight: 700;
        }

        /* Unified Frosted Light Footer */
        .pw.st-page .pw-footer {
          background: rgba(251, 250, 247, 0.94);
          border-top: 1px solid rgba(20, 24, 27, 0.09);
          color: #14181b;
        }
        .pw.st-page .pw-footer-brand strong {
          color: #14181b;
        }
        .pw.st-page .pw-footer-brand small {
          color: #525e6a;
        }
        .pw.st-page .pw-footer-nav {
          color: #47525c;
        }
        .pw.st-page .pw-footer-nav a:hover {
          color: #c75517;
        }
        .pw.st-page .pw-footer-link {
          color: #14181b;
          background: #ffffff;
          border-color: rgba(20, 24, 27, 0.14);
        }
        .pw.st-page .pw-footer-link:hover {
          background: var(--o);
          border-color: var(--o);
          color: #ffffff;
        }
        .pw.st-page .pw-footer-link.is-accent {
          color: #a64310;
          background: #fff3ea;
          border-color: #fed7aa;
        }
        .pw.st-page .pw-footer-bottom {
          border-top-color: rgba(20, 24, 27, 0.09);
          color: #64748b;
        }

        @media (max-width: 1023px) {
          .st-catalog-layout {
            grid-template-columns: 1fr;
          }
          .st-mobile-filter-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 44px;
            padding: 8px 14px;
            border-radius: var(--r-btn);
            border: 1.5px solid #14181b;
            background: #14181b;
            color: #ffffff;
            font-size: 0.85rem;
            font-weight: 800;
            cursor: pointer;
          }
          .st-filter-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 9990;
            background: rgba(14, 18, 22, 0.5);
            backdrop-filter: blur(4px);
          }
          .st-filter-sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            inset-inline-start: 0;
            width: min(340px, 88vw);
            max-height: 100dvh;
            border-radius: 0;
            z-index: 9995;
            transform: translateX(100%);
            transition: transform 0.25s ease;
            padding: 18px;
          }
          .st-filter-sidebar.is-open {
            transform: translateX(0);
          }
          .st-sidebar-close {
            display: grid;
            place-items: center;
            width: 36px;
            height: 36px;
            border-radius: var(--r-btn-sm);
            border: 1px solid #e7e1d7;
            background: #fbfaf7;
            color: #14181b;
            cursor: pointer;
          }
          .st-sidebar-mobile-foot {
            display: block;
            position: sticky;
            bottom: 0;
            padding-top: 12px;
            background: #ffffff;
            border-top: 1px solid #efe9df;
          }
          .st-sidebar-mobile-foot .pw-btn {
            width: 100%;
          }
          .st-bundles-grid,
          .st-mnt-grid,
          .st-mnt-rules,
          .st-detail-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }
        @media (max-width: 960px) {
          .st-promo-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .st-promo-media-frame {
            aspect-ratio: 16 / 9;
            max-height: 260px;
          }
        }
        @media (max-width: 639px) {
          .pw.st-page .pw-unified-hero.st-promo-stage {
            padding: 14px 0 18px;
          }
          .st-promo-card {
            padding: 16px;
            gap: 14px;
          }
          .st-promo-segs {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .st-promo-seg {
            justify-content: center;
            padding: 8px 10px;
          }
          .st-promo-nav-end {
            width: 100%;
            justify-content: space-between;
          }
          .st-promo-actions .pw-btn {
            width: 100%;
            min-height: 44px;
          }
          .st-mode-switch {
            width: 100%;
            grid-template-columns: 1fr 1fr;
          }
          .st-mode-btn {
            min-height: 44px;
            padding: 8px 10px;
            font-size: 0.82rem;
          }
          .st-sections-grid {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 4px;
          }
          .st-sections-grid::-webkit-scrollbar {
            display: none;
          }
          .st-section-card {
            flex: 0 0 auto;
            min-width: 184px;
            scroll-snap-align: start;
          }
          .st-products-grid {
            gap: 12px;
          }
          .st-prod-body,
          .st-prod-foot {
            padding: 10px 12px;
          }
          .st-bundle-card,
          .st-mnt-banner,
          .st-mnt-card-head,
          .st-mnt-card-body,
          .st-mnt-foot,
          .st-modal-card {
            padding: 16px;
          }
          .st-mnt-scopes,
          .st-modal-grid2 {
            grid-template-columns: 1fr;
          }
          .st-bundles-grid,
          .st-mnt-grid {
            gap: 16px;
          }
          .st-prod-actions .pw-btn,
          .st-wa-link {
            min-height: 38px !important;
          }
          .st-promo-arrow-btn {
            width: 40px;
            height: 40px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .st-promo-bg-slide,
          .st-prod-media img {
            transition: none !important;
            animation: none !important;
          }
        }
        html.low-graphics-mode .pw.st-page .pw-header.pw-header-glass,
        html.low-graphics-mode .pw.st-page .pw-unified-promo,
        html.low-graphics-mode .pw.st-page .st-filter-sidebar,
        html.low-graphics-mode .pw.st-page .st-modal-overlay,
        html.low-graphics-mode .pw.st-page .st-prod-code-tag,
        html.low-graphics-mode .pw.st-page .st-prod-badge,
        html.low-graphics-mode .pw.st-page .st-sidebar-mobile-foot {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        html.low-graphics-mode .pw.st-page .pw-header.pw-header-glass {
          background: #fbfaf7 !important;
        }
        html.low-graphics-mode .pw.st-page .st-modal-overlay {
          background: rgba(15, 22, 30, 0.72) !important;
        }
        html.low-graphics-mode .pw.st-page .st-promo-bg-slide,
        html.low-graphics-mode .pw.st-page .st-promo-bg-slide.is-active,
        html.low-graphics-mode .pw.st-page .st-prod-card:hover,
        html.low-graphics-mode .pw.st-page .st-prod-card:hover .st-prod-media img,
        html.low-graphics-mode .pw.st-page .st-section-card:hover {
          transform: none !important;
          transition: none !important;
        }
      `}</style>

      {/* Unified Light Header */}
      <PublicHeader
        siteName={SITE.name}
        siteNameEn={SITE.nameEn}
        activeKey="store"
        cartCount={cart.totalCount}
        onOpenCart={() => cart.setCartOpen(true)}
        userName={cart.user?.fullName}
        userEmail={cart.user?.email}
        portalHref={cart.portalHref}
        onOpenLogin={() => (cart.user ? cart.setCartOpen(true) : setLoginOpen(true))}
        onSignOut={cart.signOut}
        onOpenContact={() => setContactOpen(true)}
      />

      {/* 1. Calm Warm-Pearl Editorial Split Promotional Hero */}
      <section
        className="pw-unified-hero st-promo-stage"
        aria-label="عروض متجر فاي تك المميزة"
        onMouseEnter={() => setSliderPaused(true)}
        onMouseLeave={() => setSliderPaused(false)}
      >
        <div className="pw-wrap st-wide-wrap st-promo-inner">
          <div className="st-promo-top-meta">
            <nav className="pw-unified-crumb" aria-label="مسار التنقل">
              <Link href="/">الرئيسية</Link>
              <span className="sep">/</span>
              <span>متجر المبيعات والسمارت هوم</span>
            </nav>
            {PROMO_BANNER.enabled && <div className="pw-unified-promo">{PROMO_BANNER.text}</div>}
          </div>

          <div className="st-promo-card">
            <div className="st-promo-grid">
              <div className="st-promo-copy">
                <span className="st-promo-kicker">
                  <i aria-hidden="true" />
                  <span>{activeSlide.kicker}</span>
                </span>
                <h1>{activeSlide.headline}</h1>
                <p>{activeSlide.subtitle}</p>
                <div className="st-promo-perks">
                  {activeSlide.perks.map((perk) => (
                    <span key={perk} className="st-promo-perk">
                      <CheckIcon size={14} />
                      <span>{perk}</span>
                    </span>
                  ))}
                </div>
                <div className="st-promo-actions">
                  <button
                    type="button"
                    className="pw-btn pw-btn-primary"
                    onClick={() => handleHeroOfferAction(activeSlide.primaryAction)}
                  >
                    <span>{activeSlide.primaryLabel}</span>
                  </button>
                  {activeSlide.secondaryHref ? (
                    <a href={activeSlide.secondaryHref} className="pw-btn st-promo-secondary-btn">
                      <span>{activeSlide.secondaryLabel}</span>
                    </a>
                  ) : activeSlide.secondaryAction === 'contact' ? (
                    <button
                      type="button"
                      onClick={() => setContactOpen(true)}
                      className="pw-btn st-promo-secondary-btn"
                    >
                      <span>{activeSlide.secondaryLabel}</span>
                    </button>
                  ) : activeSlide.secondaryAction ? (
                    <button
                      type="button"
                      onClick={() => handleHeroOfferAction(activeSlide.secondaryAction as HeroOfferAction)}
                      className="pw-btn st-promo-secondary-btn"
                    >
                      <span>{activeSlide.secondaryLabel}</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="st-promo-media-frame" aria-hidden="true">
                {STORE_OFFER_SLIDES.map((slide, idx) => (
                  <img
                    key={slide.id}
                    src={slide.image}
                    alt=""
                    className={`st-promo-bg-slide ${idx === slideIdx ? 'is-active' : ''}`}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                ))}
              </div>
            </div>

            <div className="st-promo-controls">
              <div className="st-promo-segs" role="tablist" aria-label="شرائح العروض">
                {STORE_OFFER_SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === slideIdx}
                    onClick={() => goToSlide(idx)}
                    className={`st-promo-seg ${idx === slideIdx ? 'is-active' : ''}`}
                  >
                    <span className="st-promo-seg-num">0{idx + 1}</span>
                    <span>{s.shortLabel}</span>
                  </button>
                ))}
              </div>

              <div className="st-promo-nav-end">
                <div className="st-promo-counter" dir="ltr">
                  0{slideIdx + 1} / 0{STORE_OFFER_SLIDES.length}
                </div>
                <div className="st-promo-arrows">
                  <button
                    type="button"
                    className="st-promo-arrow-btn"
                    onClick={() => goToSlide(slideIdx - 1)}
                    aria-label="العرض السابق"
                  >
                    <ChevronRightIcon />
                  </button>
                  <button
                    type="button"
                    className="st-promo-arrow-btn"
                    onClick={() => goToSlide(slideIdx + 1)}
                    aria-label="العرض التالي"
                  >
                    <ChevronLeftIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Store Visual Sections Showcase Below Hero */}
      <section id="store-sections" className="st-sections-band" aria-label="أقسام المتجر والخدمات الهندسية">
        <div className="pw-wrap st-wide-wrap">
          <div className="st-sections-head">
            <div>
              <span className="st-sections-kicker">اختر القسم للانتقال مباشرة إلى الأصناف</span>
              <h2>أقسام المتجر والخدمات الهندسية</h2>
            </div>

            <div className="st-mode-switch" role="tablist" aria-label="وضع عرض المتجر">
              <button
                type="button"
                role="tab"
                aria-selected={activeStoreTab === 'products'}
                onClick={() => setActiveStoreTab('products')}
                className={`st-mode-btn is-products ${activeStoreTab === 'products' ? 'is-active' : ''}`}
              >
                <StoreIcon />
                <span>كتالوج المنتجات</span>
                <span className="st-mode-count">{catalog.totalCatalog.toLocaleString('en-US')}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeStoreTab === 'maintenance'}
                onClick={() => setActiveStoreTab('maintenance')}
                className={`st-mode-btn is-mnt ${activeStoreTab === 'maintenance' ? 'is-active' : ''}`}
              >
                <WrenchIcon />
                <span>التنفيذ والصيانة</span>
                <span className="st-mode-count">{availableMaintenance.length}</span>
              </button>
            </div>
          </div>

          {activeStoreTab === 'products' ? (
            <div className="st-sections-grid">
              <button
                type="button"
                onClick={() => handleSelectSectionCard('products', 'all')}
                className={`st-section-card ${selectedCategory === 'all' ? 'is-active' : ''}`}
              >
                <img src="/sections/materials.jpg" alt="" className="st-section-thumb" />
                <div className="st-section-meta">
                  <strong>جميع الأقسام</strong>
                  <span>{(catalog.categoryCounts.all ?? catalog.totalCatalog).toLocaleString('en-US')} منتج</span>
                </div>
              </button>

              {PRODUCT_CATEGORIES.map((cat) => {
                const count = catalog.categoryCounts[cat.id] ?? 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectSectionCard('products', cat.id)}
                    className={`st-section-card ${selectedCategory === cat.id ? 'is-active' : ''}`}
                  >
                    <img
                      src={PRODUCT_STUDIO_IMAGES_BY_CATEGORY[cat.id]}
                      alt=""
                      className="st-section-thumb"
                    />
                    <div className="st-section-meta">
                      <strong>{cat.shortTitle}</strong>
                      <span>{count.toLocaleString('en-US')} منتج</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="st-sections-grid">
              <button
                type="button"
                onClick={() => handleSelectSectionCard('maintenance', 'all')}
                className={`st-section-card ${mntFilterCategory === 'all' ? 'is-active' : ''}`}
              >
                <img src="/sections/maintenance.jpg" alt="" className="st-section-thumb" />
                <div className="st-section-meta">
                  <strong>كل البنود الهندسية</strong>
                  <span>{availableMaintenance.length} خدمة</span>
                </div>
              </button>

              {PRODUCT_CATEGORIES.map((cat) => {
                const count = availableMaintenance.filter((s) => s.category === cat.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectSectionCard('maintenance', cat.id)}
                    className={`st-section-card ${mntFilterCategory === cat.id ? 'is-active' : ''}`}
                  >
                    <img
                      src={PRODUCT_STUDIO_IMAGES_BY_CATEGORY[cat.id]}
                      alt=""
                      className="st-section-thumb"
                    />
                    <div className="st-section-meta">
                      <strong>{cat.shortTitle}</strong>
                      <span>{count} خدمة</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. Main Catalog Layout with Sticky Side Filter Menu */}
      <main id="store-catalog" className="pw-wrap st-wide-wrap st-main">
        {mobileFiltersOpen && (
          <div className="st-filter-backdrop" onClick={() => setMobileFiltersOpen(false)} aria-hidden="true" />
        )}

        <div className="st-catalog-layout">
          {/* Sidebar Filter Menu */}
          <aside
            className={`st-filter-sidebar ${mobileFiltersOpen ? 'is-open' : ''}`}
            aria-label="قائمة الفلترة"
          >
            <div className="st-sidebar-head">
              <span className="st-sidebar-title">
                <FilterIcon />
                <span>تصفية النتائج</span>
                {activeFilterCount > 0 && <span className="st-sidebar-badge">{activeFilterCount}</span>}
              </span>
              <div className="st-sidebar-actions">
                {activeFilterCount > 0 && (
                  <button type="button" onClick={resetAllFilters} className="st-sidebar-reset">
                    مسح الكل
                  </button>
                )}
                <button
                  type="button"
                  className="st-sidebar-close"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label="إغلاق قائمة الفلترة"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="st-filter-group">
              <span className="st-filter-group-title">بحث سريع</span>
              <input
                type="search"
                className="st-sidebar-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اسم الصنف، الكود، أو الماركة..."
                aria-label="بحث في القائمة الجانبية"
              />
            </div>

            <div className="st-filter-group">
              <span className="st-filter-group-title">الأقسام</span>
              <div className="st-filter-cat-list">
                {activeStoreTab === 'products' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSelectedBrands([]);
                      }}
                      className={`st-filter-cat-item ${selectedCategory === 'all' ? 'is-active' : ''}`}
                    >
                      <span>جميع الأقسام</span>
                      <span className="st-filter-cat-count">
                        {(catalog.categoryCounts.all ?? catalog.totalCatalog).toLocaleString('en-US')}
                      </span>
                    </button>
                    {PRODUCT_CATEGORIES.map((cat) => {
                      const count = catalog.categoryCounts[cat.id] ?? 0;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setSelectedBrands([]);
                          }}
                          className={`st-filter-cat-item ${selectedCategory === cat.id ? 'is-active' : ''}`}
                        >
                          <span>{cat.shortTitle}</span>
                          <span className="st-filter-cat-count">{count.toLocaleString('en-US')}</span>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setMntFilterCategory('all')}
                      className={`st-filter-cat-item ${mntFilterCategory === 'all' ? 'is-active' : ''}`}
                    >
                      <span>كل البنود الهندسية</span>
                      <span className="st-filter-cat-count">{availableMaintenance.length}</span>
                    </button>
                    {PRODUCT_CATEGORIES.map((cat) => {
                      const count = availableMaintenance.filter((s) => s.category === cat.id).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setMntFilterCategory(cat.id)}
                          className={`st-filter-cat-item ${mntFilterCategory === cat.id ? 'is-active' : ''}`}
                        >
                          <span>{cat.shortTitle}</span>
                          <span className="st-filter-cat-count">{count}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {activeStoreTab === 'products' ? (
              <>
                <div className="st-filter-group">
                  <span className="st-filter-group-title">خيارات التصفية السريعة</span>
                  <div className="st-check-list">
                    <label className="st-check-row">
                      <span className="st-check-row-left">
                        <input
                          type="checkbox"
                          checked={onlyFeatured}
                          onChange={(e) => setOnlyFeatured(e.target.checked)}
                        />
                        <span>الأكثر طلباً ومميز</span>
                      </span>
                    </label>
                    <label className="st-check-row">
                      <span className="st-check-row-left">
                        <input
                          type="checkbox"
                          checked={onlyInStock}
                          onChange={(e) => setOnlyInStock(e.target.checked)}
                        />
                        <span>متوفر للتوريد الفوري</span>
                      </span>
                    </label>
                    {hasDiscountedProducts && (
                      <label className="st-check-row">
                        <span className="st-check-row-left">
                          <input
                            type="checkbox"
                            checked={onlyDiscounted}
                            onChange={(e) => setOnlyDiscounted(e.target.checked)}
                          />
                          <span>عروض وخصومات فقط</span>
                        </span>
                      </label>
                    )}
                    <label className="st-check-row">
                      <span className="st-check-row-left">
                        <input
                          type="checkbox"
                          checked={globalInstallMode}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setGlobalInstallMode(checked);
                            setInstallSelections({});
                          }}
                        />
                        <span>تفعيل التركيب للكل</span>
                      </span>
                    </label>
                  </div>
                </div>

                {brandOptions.length > 0 && (
                  <div className="st-filter-group">
                    <span className="st-filter-group-title">الماركة / المواصفة</span>
                    <div className="st-check-list">
                      {(showAllBrands ? brandOptions : brandOptions.slice(0, 6)).map(([brand, count]) => (
                        <label key={brand} className="st-check-row">
                          <span className="st-check-row-left">
                            <input
                              type="checkbox"
                              checked={selectedBrands.includes(brand)}
                              onChange={() => handleToggleBrand(brand)}
                            />
                            <span title={brand}>{brand}</span>
                          </span>
                          <span className="st-filter-cat-count">{count}</span>
                        </label>
                      ))}
                    </div>
                    {brandOptions.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setShowAllBrands((v) => !v)}
                        className="st-more-brands-btn"
                      >
                        {showAllBrands ? 'عرض عدد أقل' : `عرض الكل (${brandOptions.length})`}
                      </button>
                    )}
                  </div>
                )}

                {hasPricedProducts && (
                  <div className="st-filter-group">
                    <span className="st-filter-group-title">نطاق السعر</span>
                    <div className="st-price-inputs">
                      <input
                        type="number"
                        min={0}
                        className="st-price-input"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="من"
                        aria-label="الحد الأدنى للسعر"
                      />
                      <input
                        type="number"
                        min={0}
                        className="st-price-input"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        placeholder="إلى"
                        aria-label="الحد الأقصى للسعر"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="st-filter-group">
                <span className="st-filter-group-title">نظام المعاينة والتسعير</span>
                <div className="st-filter-cat-list">
                  <button
                    type="button"
                    onClick={() => setMntFeeFilter('all')}
                    className={`st-filter-cat-item ${mntFeeFilter === 'all' ? 'is-active' : ''}`}
                  >
                    <span>كل خدمات الصيانة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMntFeeFilter('fixed')}
                    className={`st-filter-cat-item ${mntFeeFilter === 'fixed' ? 'is-active' : ''}`}
                  >
                    <span>برسوم معاينة محددة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMntFeeFilter('quote')}
                    className={`st-filter-cat-item ${mntFeeFilter === 'quote' ? 'is-active' : ''}`}
                  >
                    <span>معاينة وتسعير حسب البند</span>
                  </button>
                </div>
              </div>
            )}

            <div className="st-sidebar-mobile-foot">
              <button
                type="button"
                className="pw-btn pw-btn-primary"
                onClick={() => setMobileFiltersOpen(false)}
              >
                عرض النتائج (
                {activeStoreTab === 'products'
                  ? catalog.totalMatched.toLocaleString('en-US')
                  : filteredMaintenance.length}
                )
              </button>
            </div>
          </aside>

          {/* Main Catalog Content */}
          <div className="st-catalog-content">
            <div className="st-results-bar">
              <button
                type="button"
                className="st-mobile-filter-btn"
                onClick={() => setMobileFiltersOpen(true)}
              >
                <SlidersIcon />
                <span>فلترة النتائج</span>
                {activeFilterCount > 0 && <span className="st-sidebar-badge">{activeFilterCount}</span>}
              </button>

              <div className="st-search-box">
                <SearchIcon />
                <input
                  type="search"
                  className="st-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeStoreTab === 'products'
                      ? 'ابحث عن منتج (قفل ذكي، بورسلان كلكتا، خلاط مدفون، جوتن، كاميرات...)'
                      : 'ابحث في خدمات التنفيذ والصيانة (كهرباء، تسريب مياه، تكييف مخفي، سمارت هوم...)'
                  }
                  aria-label="ابحث في المتجر"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="st-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="مسح البحث"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>

              <div className="st-toolbar-actions">
                {activeStoreTab === 'products' && (
                  <select
                    className="st-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    aria-label="ترتيب المنتجات"
                  >
                    <option value="featured">الأكثر تميزاً</option>
                    <option value="default">الترتيب الافتراضي</option>
                    <option value="name_asc">الاسم (أ - ي)</option>
                    {hasPricedProducts && (
                      <>
                        <option value="price_asc">السعر: من الأقل</option>
                        <option value="price_desc">السعر: من الأعلى</option>
                      </>
                    )}
                  </select>
                )}

                <span className="st-count-pill">
                  المعروض:{' '}
                  <strong>
                    {activeStoreTab === 'products'
                      ? catalogLoading
                        ? 'جاري التحديث...'
                        : catalog.totalMatched.toLocaleString('en-US')
                      : filteredMaintenance.length}
                  </strong>
                </span>

                {activeStoreTab === 'products' && (
                  <a href="#store-bundles" className="pw-btn pw-btn-ghost pw-btn-sm">
                    <SparklesIcon />
                    <span>باقات التوفير</span>
                  </a>
                )}

                <button type="button" onClick={() => cart.setCartOpen(true)} className="pw-btn pw-btn-ghost pw-btn-sm">
                  <BagIcon />
                  <span>السلة ({cart.totalCount})</span>
                </button>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFilterCount > 0 && (
              <div className="st-active-filters" aria-label="عوامل التصفية النشطة">
                {searchQuery.trim() && (
                  <button type="button" className="st-active-chip" onClick={() => setSearchQuery('')}>
                    <span>بحث: {searchQuery}</span>
                    <span>×</span>
                  </button>
                )}
                {activeStoreTab === 'products' && selectedCategory !== 'all' && (
                  <button type="button" className="st-active-chip" onClick={() => setSelectedCategory('all')}>
                    <span>القسم: {categoryMap[selectedCategory]?.shortTitle || selectedCategory}</span>
                    <span>×</span>
                  </button>
                )}
                {activeStoreTab === 'maintenance' && mntFilterCategory !== 'all' && (
                  <button type="button" className="st-active-chip" onClick={() => setMntFilterCategory('all')}>
                    <span>
                      التخصص:{' '}
                      {mntFilterCategory === 'hvac'
                        ? 'تكييف وتهوية'
                        : categoryMap[mntFilterCategory]?.shortTitle || mntFilterCategory}
                    </span>
                    <span>×</span>
                  </button>
                )}
                {activeStoreTab === 'products' && onlyFeatured && (
                  <button type="button" className="st-active-chip" onClick={() => setOnlyFeatured(false)}>
                    <span>الأكثر طلباً ومميز</span>
                    <span>×</span>
                  </button>
                )}
                {activeStoreTab === 'products' && onlyInStock && (
                  <button type="button" className="st-active-chip" onClick={() => setOnlyInStock(false)}>
                    <span>متوفر للتوريد الفوري</span>
                    <span>×</span>
                  </button>
                )}
                {activeStoreTab === 'products' && onlyDiscounted && (
                  <button type="button" className="st-active-chip" onClick={() => setOnlyDiscounted(false)}>
                    <span>عروض وخصومات فقط</span>
                    <span>×</span>
                  </button>
                )}
                {activeStoreTab === 'products' && globalInstallMode && (
                  <button type="button" className="st-active-chip" onClick={() => setGlobalInstallMode(false)}>
                    <span>شامل التركيب</span>
                    <span>×</span>
                  </button>
                )}
                {activeStoreTab === 'products' &&
                  selectedBrands.map((b) => (
                    <button key={b} type="button" className="st-active-chip" onClick={() => handleToggleBrand(b)}>
                      <span>الماركة: {b}</span>
                      <span>×</span>
                    </button>
                  ))}
                {activeStoreTab === 'products' && (minPrice.trim() || maxPrice.trim()) && (
                  <button
                    type="button"
                    className="st-active-chip"
                    onClick={() => {
                      setMinPrice('');
                      setMaxPrice('');
                    }}
                  >
                    <span>
                      السعر: {minPrice || '0'} – {maxPrice || 'الكل'}
                    </span>
                    <span>×</span>
                  </button>
                )}
                {activeStoreTab === 'maintenance' && mntFeeFilter !== 'all' && (
                  <button type="button" className="st-active-chip" onClick={() => setMntFeeFilter('all')}>
                    <span>{mntFeeFilter === 'fixed' ? 'برسوم معاينة محددة' : 'معاينة وتسعير حسب البند'}</span>
                    <span>×</span>
                  </button>
                )}
                <button type="button" onClick={resetAllFilters} className="st-active-clear-all">
                  مسح كل الفلاتر
                </button>
              </div>
            )}

            {activeStoreTab === 'maintenance' ? (
              <section aria-label="قسم التنفيذ والصيانة الشاملة" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="st-mnt-banner">
                  <div className="st-mnt-banner-top">
                    <div>
                      <span className="st-mnt-kicker">منهجية فاي تك في التنفيذ والصيانة الموثّقة</span>
                      <h2>تنفيذ متكامل لجميع البنود وتشخيص أعطال بأحدث الأجهزة</h2>
                    </div>
                    <span className="st-mnt-warranty-pill">
                      <ShieldIcon />
                      <span>إشراف مهندس مختص · ضمان موثّق</span>
                    </span>
                  </div>

                  <div className="st-mnt-rules">
                    <div className="st-mnt-rule">
                      <strong>
                        <span className="st-mnt-rule-num">01</span>قاعدة الكشف المبكر قبل التشطيب
                      </strong>
                      <span>اختبار ضغط السباكة 10 بار، والميجر للكهرباء، والنيتروجين للتكييف قبل الإغلاق.</span>
                    </div>
                    <div className="st-mnt-rule">
                      <strong>
                        <span className="st-mnt-rule-num">02</span>قاعدة الصيانة بدون تكسير
                      </strong>
                      <span>استخدام كواشف تسرب المياه والكاميرا الحرارية وإصلاح الدوائر بأقل تدخل ممكن.</span>
                    </div>
                    <div className="st-mnt-rule">
                      <strong>
                        <span className="st-mnt-rule-num">03</span>باقة الصيانة الوقائية الدورية
                      </strong>
                      <span>فحص نصف سنوي للكهرباء والحساسات والتكييف والعزل يقلل الأعطال المفاجئة.</span>
                    </div>
                  </div>
                </div>

                {filteredMaintenance.length === 0 ? (
                  <div className="st-empty">
                    <h3>لا توجد خدمة مطابقة للبحث والفلاتر الحالية</h3>
                    <p>جرّب مسح نص البحث أو إعادة ضبط الفلاتر لعرض جميع خدمات التنفيذ والصيانة.</p>
                    <button type="button" className="pw-btn pw-btn-primary pw-btn-sm" onClick={resetAllFilters}>
                      إظهار كل خدمات التنفيذ والصيانة
                    </button>
                  </div>
                ) : (
                  <div className="st-mnt-grid">
                    {filteredMaintenance.map((srv) => {
                      const isAdded = addedId === srv.id;
                      return (
                        <article key={srv.id} className="st-mnt-card">
                          <div>
                            <div className="st-mnt-card-head">
                              <div>
                                <span className="st-mnt-code">
                                  {srv.code} · {srv.warrantyLabel}
                                </span>
                                <h3>{srv.title}</h3>
                              </div>
                              {srv.badge && <span className="st-bundle-badge">{srv.badge}</span>}
                            </div>

                            <div className="st-mnt-card-body">
                              <div className="st-mnt-scopes">
                                <div className="st-mnt-scope-box is-exec">
                                  <strong>بنود التنفيذ والتأسيس</strong>
                                  <ul>
                                    {srv.executionScope.map((item) => (
                                      <li key={item}>
                                        <CheckIcon size={14} />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="st-mnt-scope-box is-fix">
                                  <strong>بنود الصيانة والإصلاح</strong>
                                  <ul>
                                    {srv.maintenanceScope.map((item) => (
                                      <li key={item}>
                                        <CheckIcon size={14} />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {srv.recommendation && <div className="st-mnt-rec">{srv.recommendation}</div>}
                            </div>
                          </div>

                          <div className="st-mnt-foot">
                            <div>
                              {srv.visitFee > 0 ? (
                                <>
                                  <span className="st-mnt-fee-label">رسوم المعاينة / الفحص</span>
                                  <strong className="st-mnt-fee-val">
                                    {srv.visitFee.toLocaleString('en-US')} {srv.currency}
                                  </strong>
                                </>
                              ) : (
                                <>
                                  <strong className="st-mnt-fee-val" style={{ fontSize: '0.96rem' }}>
                                    المعاينة والتسعير حسب البند
                                  </strong>
                                  <span className="st-mnt-fee-label">{srv.warrantyLabel}</span>
                                </>
                              )}
                            </div>

                            <div className="st-mnt-actions">
                              <button
                                type="button"
                                onClick={() => handleOpenMaintenanceModal(srv)}
                                className="pw-btn pw-btn-primary pw-btn-sm"
                              >
                                طلب تنفيذ / صيانة
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddMaintenanceToCart(srv)}
                                className="pw-btn pw-btn-ghost pw-btn-sm"
                              >
                                <BagIcon />
                                <span>{isAdded ? 'تمت الإضافة ✓' : 'أضف للسلة'}</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : filteredProducts.length === 0 ? (
              <div className="st-empty">
                <h3>لا توجد منتجات مطابقة لبحثك والفلاتر المحددة</h3>
                <p>جرّب تعديل عوامل التصفية في القائمة الجانبية أو استعرض جميع أقسام المتجر.</p>
                <button type="button" className="pw-btn pw-btn-primary pw-btn-sm" onClick={resetAllFilters}>
                  عرض كل المنتجات ({catalog.totalCatalog.toLocaleString('en-US')})
                </button>
              </div>
            ) : (
              <>
                <div
                  className="st-products-grid"
                  style={{ opacity: catalogLoading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}
                >
                  {filteredProducts.map((p) => {
                    const cat = categoryMap[p.category] || PRODUCT_CATEGORIES[0];
                    const imageUrl = getProductImageUrl(p);
                    const withInstall = installSelections[p.id] ?? globalInstallMode;
                    const isAdded = addedId === p.id;
                    const discountPct =
                      p.oldPrice && p.oldPrice > p.price
                        ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)
                        : 0;
                    const unitTotal = p.price + (withInstall && p.installPrice ? p.installPrice : 0);
                    const waMsg = `مرحباً فاي تك، أريد تسعيرة وطلب: ${p.name} (${p.code}) — الوحدة: ${p.unit}${withInstall ? ' (توريد + تركيب)' : ' (توريد فقط)'}`;

                    return (
                      <article
                        key={p.id}
                        className="st-prod-card"
                        onClick={(e) => {
                          if (e.target instanceof HTMLElement && e.target.closest('a,button,input,label,select,textarea')) return;
                          handleOpenDetail(p);
                        }}
                      >
                        <div>
                          <div className="st-prod-media" onClick={() => handleOpenDetail(p)} title="اضغط لعرض المواصفات والمرفقات">
                            <img src={imageUrl} alt={p.name} loading="lazy" decoding="async" />
                            {p.badge && <span className="st-prod-badge">{p.badge}</span>}
                            {discountPct > 0 && <span className="st-prod-discount">خصم {discountPct}%</span>}
                            {p.spinImages && p.spinImages.length >= 2 && (
                              <span className="pw-card-4d-badge">4D · 360°</span>
                            )}
                            <span className="st-prod-code-tag" dir="ltr">
                              {p.code}
                            </span>
                          </div>

                          <div className="st-prod-body">
                            <span className="st-prod-cat">
                              {cat.shortTitle} · {p.brand}
                            </span>
                            <h3>
                              <button type="button" onClick={() => handleOpenDetail(p)}>
                                {p.name}
                              </button>
                            </h3>
                            <p className="st-prod-desc">{p.description}</p>
                            {p.specs.length > 0 && (
                              <ul className="st-prod-specs">
                                {p.specs.slice(0, 2).map((s) => (
                                  <li key={s}>
                                    <span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(p)}
                              className="st-detail-trigger"
                            >
                              المواصفات الفنية والتفاصيل ←
                            </button>
                          </div>
                        </div>

                        <div className="st-prod-foot">
                          <div className="st-price-row">
                            <div>
                              {p.price > 0 ? (
                                <>
                                  {p.oldPrice && p.oldPrice > p.price && (
                                    <span className="st-price-old">
                                      {p.oldPrice.toLocaleString('en-US')} {p.currency}
                                    </span>
                                  )}
                                  <div className="st-price-main">
                                    <strong>{unitTotal.toLocaleString('en-US')}</strong>
                                    <span>
                                      {p.currency} / {p.unit}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="st-price-quote">
                                  <strong>تسعير فوري عند الطلب</strong>
                                  <span>الوحدة: {p.unit}</span>
                                </div>
                              )}
                            </div>

                            <label className={`st-install-toggle ${withInstall ? 'is-checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={withInstall}
                                onChange={() => handleToggleCardInstall(p.id)}
                              />
                              <span>
                                {p.installPrice && p.installPrice > 0
                                  ? `إضافة التركيب (+${p.installPrice.toLocaleString('en-US')} ${p.currency})`
                                  : 'شامل التركيب'}
                              </span>
                            </label>
                          </div>

                          <div className="st-prod-actions">
                            <button
                              type="button"
                              disabled={!p.inStock}
                              onClick={() => handleProductAdd(p, withInstall)}
                              className={`pw-btn pw-btn-primary ${isAdded ? 'is-added' : ''}`}
                            >
                              {!p.inStock ? 'نفد حالياً' : isAdded ? 'تمت الإضافة ✓' : 'أضف للسلة'}
                            </button>

                            {cleanWa ? (
                              <a
                                href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(waMsg)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="st-wa-link"
                                title="استفسار وسرعة تسعير عبر واتساب"
                              >
                                واتساب
                              </a>
                            ) : (
                              <button type="button" className="st-wa-link" onClick={() => setContactOpen(true)}>
                                استفسار
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {catalog.totalPages > 1 && (
                  <nav className="st-pagination" aria-label="تصفح صفحات المنتجات">
                    <span className="st-page-info">
                      عرض صفحة <strong>{catalog.page}</strong> من <strong>{catalog.totalPages}</strong> · إجمالي{' '}
                      <strong>{catalog.totalMatched.toLocaleString('en-US')}</strong> منتج
                    </span>

                    <div className="st-page-btns">
                      <button
                        type="button"
                        className="st-page-btn"
                        disabled={catalog.page <= 1}
                        onClick={() => handleGoPage(catalog.page - 1)}
                      >
                        السابق
                      </button>
                      {paginationPages.map((pg, idx) =>
                        pg === 'ellipsis' ? (
                          <span key={`el-${idx}`} className="st-page-ellipsis">
                            ...
                          </span>
                        ) : (
                          <button
                            key={pg}
                            type="button"
                            className={`st-page-btn ${pg === catalog.page ? 'is-active' : ''}`}
                            onClick={() => handleGoPage(pg)}
                          >
                            {pg}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        className="st-page-btn"
                        disabled={catalog.page >= catalog.totalPages}
                        onClick={() => handleGoPage(catalog.page + 1)}
                      >
                        التالي
                      </button>
                    </div>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>

        {/* Full-Width Smart Bundles Section */}
        {activeStoreTab === 'products' && (
          <section id="store-bundles" className="st-bundles-section" aria-labelledby="bundles-heading">
            <div className="st-section-head">
              <div>
                <p className="pw-eyebrow">باقات التجهيز الكاملة</p>
                <h2 id="bundles-heading">باقات السمارت هوم وحساسات الأمان الجاهزة</h2>
                <p>تشكيلات متكاملة بالتركيب لحماية الشقق والفلل وتوفير التكلفة مقارنة بالطلب الفردي.</p>
              </div>
            </div>

            <div className="st-bundles-grid">
              {SMART_BUNDLES.map((b) => {
                const isAdded = addedId === b.id;
                return (
                  <div key={b.id} className="st-bundle-card">
                    <div>
                      <div className="st-bundle-top">
                        <span className="st-bundle-badge">{b.badge}</span>
                        <span className="st-bundle-note">شامل البرمجة والتطبيق</span>
                      </div>
                      <h3>{b.title}</h3>
                      <p className="st-bundle-sub">{b.subtitle}</p>
                      <ul className="st-bundle-items">
                        {b.items.map((it) => (
                          <li key={it}>
                            <CheckIcon size={15} />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="st-bundle-foot">
                      <div>
                        {b.price > 0 ? (
                          <>
                            {b.oldPrice && b.oldPrice > b.price ? (
                              <span className="st-price-old">
                                {b.oldPrice.toLocaleString('en-US')} {b.currency}
                              </span>
                            ) : null}
                            <strong className="st-bundle-price">
                              {b.price.toLocaleString('en-US')} {b.currency}
                            </strong>
                          </>
                        ) : (
                          <strong className="st-bundle-price" style={{ fontSize: '1.05rem' }}>
                            عرض سعر فوري
                          </strong>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBundleAdd(b.id)}
                        className={`pw-btn pw-btn-primary ${isAdded ? 'is-added' : ''}`}
                      >
                        <BagIcon />
                        <span>{isAdded ? 'تمت إضافة الباقة ✓' : 'أضف الباقة للسلة'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Product Technical Details & Attachments Modal */}
      {detailProduct && (
        <div className="st-modal-overlay" onClick={() => setDetailProduct(null)}>
          <div className="st-modal-card st-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="st-modal-head">
              <div>
                <span className="st-prod-cat">
                  {(categoryMap[detailProduct.category] || PRODUCT_CATEGORIES[0]).shortTitle} · {detailProduct.brand}
                </span>
                <h3>{detailProduct.name}</h3>
              </div>
              <button type="button" className="st-modal-close" onClick={() => setDetailProduct(null)} aria-label="إغلاق">
                <CloseIcon />
              </button>
            </div>

            <div className="st-detail-grid">
              <div>
                <Product4DSpinViewer
                  images={detailProduct.spinImages}
                  fallbackImage={getProductImageUrl(detailProduct)}
                  alt={detailProduct.name}
                  badge={detailProduct.badge}
                  code={detailProduct.code}
                />
                {detailProduct.subCategory && (
                  <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                    التصنيف الفرعي: {detailProduct.subCategory}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#47525c', lineHeight: 1.7 }}>
                  {detailProduct.description}
                </p>

                {detailProduct.specs.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.84rem', marginBottom: '6px', color: '#14181b' }}>
                      المواصفات الفنية
                    </strong>
                    <ul className="st-detail-specs">
                      {detailProduct.specs.map((spec) => (
                        <li key={spec}>
                          <CheckIcon size={15} />
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detailProduct.variants && detailProduct.variants.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.84rem', marginBottom: '6px', color: '#14181b' }}>
                      المقاسات / المتغيرات المتوفرة
                    </strong>
                    <div className="st-detail-variants">
                      {detailProduct.variants.map((v, idx) => (
                        <span key={idx} className="st-detail-variant-pill">
                          {[v.name, v.size, v.color, v.price ? `${v.price.toLocaleString('en-US')} ${detailProduct.currency}` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {detailProduct.attachments && detailProduct.attachments.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.84rem', marginBottom: '6px', color: '#14181b' }}>
                      الصور والمرفقات الفنية
                    </strong>
                    <div className="st-detail-att-list">
                      {detailProduct.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={`/api/store-media/${encodeURIComponent(att.id)}?download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="st-detail-att-link"
                        >
                          <span>تحميل: {att.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <label className={`st-install-toggle ${(installSelections[detailProduct.id] ?? globalInstallMode) ? 'is-checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={installSelections[detailProduct.id] ?? globalInstallMode}
                    onChange={() => handleToggleCardInstall(detailProduct.id)}
                  />
                  <span>
                    {detailProduct.installPrice && detailProduct.installPrice > 0
                      ? `إضافة التركيب (+${detailProduct.installPrice.toLocaleString('en-US')} ${detailProduct.currency})`
                      : 'شامل التركيب عند الطلب'}
                  </span>
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '8px', borderTop: '1px solid #efe9df' }}>
                  <div>
                    {detailProduct.price > 0 ? (
                      <>
                        {detailProduct.oldPrice && detailProduct.oldPrice > detailProduct.price && (
                          <span className="st-price-old">
                            {detailProduct.oldPrice.toLocaleString('en-US')} {detailProduct.currency}
                          </span>
                        )}
                        <div className="st-price-main">
                          <strong>
                            {(
                              (detailProduct.price +
                                ((installSelections[detailProduct.id] ?? globalInstallMode) && detailProduct.installPrice
                                  ? detailProduct.installPrice
                                  : 0)) *
                              detailQty
                            ).toLocaleString('en-US')}
                          </strong>
                          <span>
                            {detailProduct.currency} ({detailQty} × {detailProduct.unit})
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="st-price-quote">
                        <strong>تسعير فوري عند الطلب</strong>
                        <span>الوحدة: {detailProduct.unit}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div className="st-qty-box">
                      <button
                        type="button"
                        onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                        aria-label="تقليل الكمية"
                      >
                        -
                      </button>
                      <span>{detailQty}</span>
                      <button
                        type="button"
                        onClick={() => setDetailQty((q) => q + 1)}
                        aria-label="زيادة الكمية"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!detailProduct.inStock}
                      onClick={() => {
                        const withInst = installSelections[detailProduct.id] ?? globalInstallMode;
                        handleProductAdd(detailProduct, withInst, detailQty);
                      }}
                      className={`pw-btn pw-btn-primary ${addedId === detailProduct.id ? 'is-added' : ''}`}
                    >
                      {!detailProduct.inStock ? 'نفد حالياً' : addedId === detailProduct.id ? 'تمت الإضافة ✓' : 'أضف للسلة'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Booking Modal */}
      {selectedMaintenance && (
        <div className="st-modal-overlay" onClick={() => setSelectedMaintenance(null)}>
          <div className="st-modal-card" onClick={(e) => e.stopPropagation()}>
            {mntRef ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '9999px',
                    background: '#dcfce7',
                    color: '#059669',
                    display: 'grid',
                    placeItems: 'center',
                    marginInline: 'auto',
                  }}
                >
                  <CheckIcon size={22} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.16rem', fontWeight: 800, color: '#14181b' }}>
                  تم تسجيل طلب التنفيذ والصيانة بنجاح
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#525e6a', lineHeight: 1.7 }}>
                  رقم المرجع: <strong style={{ fontFamily: 'ui-monospace, Consolas, monospace', color: '#14181b' }}>{mntRef}</strong>
                  <br />
                  سيتواصل معك المهندس المختص على الرقم <strong dir="ltr">{mntPhone}</strong> لتحديد موعد المعاينة.
                </p>
                <button type="button" onClick={() => setSelectedMaintenance(null)} className="pw-btn pw-btn-primary pw-btn-lg">
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitMaintenanceRequest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="st-modal-head">
                  <h3>حجز خدمة تنفيذ أو صيانة هندسية</h3>
                  <button type="button" className="st-modal-close" onClick={() => setSelectedMaintenance(null)} aria-label="إغلاق">
                    <CloseIcon />
                  </button>
                </div>

                <div className="st-modal-service-box">
                  <strong>{selectedMaintenance.title}</strong>
                  <span>
                    الكود: {selectedMaintenance.code} · {selectedMaintenance.warrantyLabel}
                  </span>
                </div>

                <select className="st-modal-input" value={mntMode} onChange={(e) => setMntMode(e.target.value)}>
                  <option value="تنفيذ وتأسيس جديد">تنفيذ وتأسيس جديد</option>
                  <option value="صيانة وإصلاح عطل">صيانة وإصلاح عطل</option>
                  <option value="صيانة دورية / فحص وقائي">صيانة دورية / فحص وقائي</option>
                  <option value="طوارئ سريعة">طوارئ سريعة</option>
                </select>

                <div className="st-modal-grid2">
                  <input
                    className="st-modal-input"
                    value={mntName}
                    onChange={(e) => setMntName(e.target.value)}
                    placeholder="الاسم الكامل *"
                    required
                  />
                  <input
                    className="st-modal-input"
                    value={mntPhone}
                    onChange={(e) => setMntPhone(e.target.value)}
                    placeholder="رقم الجوال *"
                    dir="ltr"
                    inputMode="tel"
                    required
                    style={{ textAlign: 'right' }}
                  />
                </div>

                <div className="st-modal-grid2">
                  <input
                    className="st-modal-input"
                    value={mntCity}
                    onChange={(e) => setMntCity(e.target.value)}
                    placeholder="المدينة والمنطقة"
                  />
                  <input
                    className="st-modal-input"
                    value={mntDate}
                    onChange={(e) => setMntDate(e.target.value)}
                    placeholder="الموعد المفضل (مثال: غداً 4 عصراً)"
                  />
                </div>

                <input
                  className="st-modal-input"
                  value={mntAddress}
                  onChange={(e) => setMntAddress(e.target.value)}
                  placeholder="العنوان التفصيلي للموقع"
                />

                <textarea
                  className="st-modal-input"
                  value={mntNotes}
                  onChange={(e) => setMntNotes(e.target.value)}
                  placeholder="وصف العطل أو الأعمال المطلوب تنفيذها (مساحة تقريبية / تفاصيل)"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />

                {mntErr && <div className="st-modal-err">{mntErr}</div>}

                <button type="submit" disabled={mntBusy} className="pw-btn pw-btn-primary pw-btn-lg">
                  {mntBusy ? 'جاري إرسال الطلب...' : 'اعتماد وإرسال طلب التنفيذ والصيانة'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Unified Light Footer */}
      <footer className="pw-footer">
        <div className="pw-wrap">
          <div className="pw-footer-row">
            <div className="pw-footer-brand">
              <img src="/brand/phitech-mark-color.svg" alt="" />
              <div>
                <strong>{SITE.name}</strong>
                <small>{SITE.tagline}</small>
              </div>
            </div>
            <nav className="pw-footer-nav" aria-label="روابط التذييل">
              {PUBLIC_NAV_ITEMS.map((n) =>
                n.key === 'contact' ? (
                  <a
                    key={n.href}
                    href="#contact"
                    onClick={(e) => {
                      e.preventDefault();
                      setContactOpen(true);
                    }}
                  >
                    {n.label}
                  </a>
                ) : (
                  <Link key={n.href} href={n.href}>
                    {n.label}
                  </Link>
                )
              )}
            </nav>
            <div className="pw-footer-actions">
              <Link href="/verify" className="pw-footer-link is-accent">
                التحقق من صحة المستندات
              </Link>
              {(cart.portalHref || !cart.user) && (
                <Link href={cart.portalHref || '/login?portal=employee'} className="pw-footer-link">
                  بوابة الموظفين
                </Link>
              )}
            </div>
          </div>
          <p className="pw-footer-bottom">© {new Date().getFullYear()} {SITE.name} — جميع الحقوق محفوظة</p>
        </div>
      </footer>

      <div className="pw-dock-pad" aria-hidden="true" />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cart.cartOpen}
        onClose={() => cart.setCartOpen(false)}
        user={cart.user}
        portalHref={cart.portalHref}
        onSignOut={cart.signOut}
        items={cart.items}
        totalAmount={cart.totalAmount}
        onUpdateQty={cart.updateQty}
        onToggleInstall={cart.toggleItemInstall}
        onRemoveItem={cart.removeItem}
        onClearCart={cart.clearCart}
        onRequireLogin={() => setLoginOpen(true)}
        whatsappNumber={SITE.contact.whatsapp}
      />

      {/* Floating Live Chat */}
      <FloatingContactChat
        whatsappNumber={SITE.contact.whatsapp}
        defaultName={cart.user?.fullName || ''}
        defaultPhone={cart.user?.phone || ''}
        contextLabel="متجر المنتجات والأنظمة الذكية"
      />

      {/* Login Modal */}
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} site={SITE} />
    </div>
  );
}
