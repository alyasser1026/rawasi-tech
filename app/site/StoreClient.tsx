"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CSS } from './site-styles';
import { mergeContent, type SiteContentOverride } from './site-content';
import {
  PRODUCT_CATEGORIES,
  SMART_BUNDLES,
  type ProductCategoryId,
  type WebsiteMaintenanceService,
  type WebsiteProduct,
} from './store-catalog';
import { CartDrawer, useCustomerCart } from './CartDrawer';
import PublicHeader, { PUBLIC_NAV_ITEMS } from './PublicHeader';
import LoginModal from './LoginModal';
import FloatingContactChat from './FloatingContactChat';
import { supabase } from '@/lib/supabase';
import { rememberVisitorContact } from '@/lib/client-device-info';

export default function StoreClient({ content }: { content?: SiteContentOverride }) {
  const { SITE, PRODUCTS, MAINTENANCE_SERVICES, PROMO_BANNER } = mergeContent(content);
  const [loginOpen, setLoginOpen] = useState(false);
  const [activeStoreTab, setActiveStoreTab] = useState<'products' | 'maintenance'>('products');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategoryId>('all');
  const [mntFilterCategory, setMntFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [installSelections, setInstallSelections] = useState<Record<string, boolean>>({});

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

  const cart = useCustomerCart(() => setLoginOpen(true));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'maintenance') {
        setActiveStoreTab('maintenance');
      }
      const cat = params.get('category');
      if (cat && PRODUCT_CATEGORIES.some((c) => c.id === cat)) {
        setSelectedCategory(cat as ProductCategoryId);
        setActiveStoreTab('products');
      }
    }
  }, []);

  useEffect(() => {
    if (cart.user) {
      if (cart.user.fullName && !mntName) setMntName(cart.user.fullName);
      if (cart.user.phone && !mntPhone) setMntPhone(cart.user.phone);
    }
  }, [cart.user, mntName, mntPhone]);

  const filteredMaintenance = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MAINTENANCE_SERVICES.filter((srv) => {
      if (!srv.available) return false;
      if (mntFilterCategory !== 'all' && srv.category !== mntFilterCategory) return false;
      if (!q) return true;
      return (
        srv.title.toLowerCase().includes(q) ||
        srv.code.toLowerCase().includes(q) ||
        srv.recommendation.toLowerCase().includes(q) ||
        srv.executionScope.some((x) => x.toLowerCase().includes(q)) ||
        srv.maintenanceScope.some((x) => x.toLowerCase().includes(q))
      );
    });
  }, [MAINTENANCE_SERVICES, mntFilterCategory, searchQuery]);

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
      category: srv.category === 'hvac' ? 'electrical' : srv.category,
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
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          background: #141a23;
          color: #f1f5f9;
          font-weight: 800;
          font-size: 0.86rem;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
        }
        .st-cat-btn:hover {
          border-color: #c9772d;
          color: #fed7aa;
          transform: translateY(-1px);
        }
        .st-cat-btn.is-active {
          background: linear-gradient(135deg, #c9772d 0%, #e08d3c 100%);
          color: #ffffff;
          border-color: #e08d3c;
          box-shadow: 0 8px 20px -6px rgba(201, 119, 45, 0.5);
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
          background: #141a23;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .st-prod-card:hover {
          transform: translateY(-3px);
          border-color: rgba(201, 119, 45, 0.48);
          box-shadow: 0 22px 46px -22px rgba(0, 0, 0, 0.65);
        }
        @media (max-width: 980px) {
          .st-bundles-grid { grid-template-columns: 1fr; }
          .st-products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        }
        @media (max-width: 680px) {
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

      {/* Unified Light Header (matches Homepage Standard) */}
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
      />

      {/* Unified Light Hero (matches Homepage Standard) */}
      <section className="pw-unified-hero">
        <div className="pw-wrap">
          {PROMO_BANNER.enabled && (
            <div className="pw-unified-promo">{PROMO_BANNER.text}</div>
          )}

          <nav className="pw-unified-crumb" aria-label="مسار التنقل">
            <Link href="/">الرئيسية</Link>
            <span className="sep">/</span>
            <span>🛒 المتجر والتنفيذ الهندسي</span>
          </nav>

          <div className="pw-head" style={{ marginBottom: '26px' }}>
            <p className="pw-eyebrow">متجر فاي تك الهندسي — توريد معتمد وتركيب بإشراف هندسي</p>
            <h1>
              كل ما يحتاجه مشروعك من{' '}
              <span style={{ color: 'var(--o)' }}>التأسيسات والتشطيبات</span> إلى{' '}
              <span style={{ color: '#0284c7' }}>السمارت هوم وحساسات الأمان</span>
            </h1>
            <p>
              اختر منتجاتك من الكهرباء، السباكة، الدهانات، السيراميك، الرخام، الديكورات، أجهزة التحكم الذكي، التيار
              الخفيف، وحساسات الحريق والغاز والمياه — وأضفها لسلتك لطلب التوريد المباشر أو التركيب الهندسي بالضمان.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setActiveStoreTab('products')}
              className={activeStoreTab === 'products' ? 'pw-btn pw-btn-primary' : 'pw-btn pw-btn-ghost'}
              style={{ minHeight: '44px', padding: '0 20px', fontSize: '0.9rem' }}
            >
              🛒 كتالوج المنتجات ({PRODUCTS.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveStoreTab('maintenance')}
              className="pw-btn pw-btn-ghost"
              style={{
                minHeight: '44px',
                padding: '0 20px',
                fontSize: '0.9rem',
                ...(activeStoreTab === 'maintenance'
                  ? { background: '#0284c7', color: '#ffffff', borderColor: '#0284c7' }
                  : {}),
              }}
            >
              🛠️ التنفيذ والصيانة الشاملة ({MAINTENANCE_SERVICES.filter((s) => s.available).length})
            </button>
            {!cart.user ? (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="pw-btn pw-btn-ghost"
                style={{ minHeight: '44px', padding: '0 20px', fontSize: '0.88rem' }}
              >
                🔐 سجّل دخولك أو أنشئ حسابك لتفعيل السلة
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => cart.setCartOpen(true)}
                  className="pw-btn pw-btn-ghost"
                  style={{ minHeight: '44px', padding: '0 20px', fontSize: '0.88rem' }}
                >
                  🛍️ السلة ({cart.totalCount} صنف{cart.totalAmount > 0 ? ` — ${cart.totalAmount.toLocaleString('en-US')} ج.م` : ''})
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="pw-btn pw-btn-ghost"
                  title="تسجيل الخروج"
                  style={{ minHeight: '44px', padding: '0 14px', fontSize: '0.82rem', color: '#fca5a5', borderColor: 'rgba(248, 113, 113, 0.35)' }}
                >
                  خروج ({cart.user.fullName.split(' ')[0]})
                </button>
              </>
            )}
            <Link
              href="/real-estate"
              className="pw-btn pw-btn-ghost"
              style={{ minHeight: '44px', padding: '0 18px', fontSize: '0.88rem' }}
            >
              🏢 عروض العقارات والوحدات ←
            </Link>
          </div>
        </div>
      </section>

      <main className="pw-wrap" style={{ paddingTop: '28px', paddingBottom: '64px' }}>
        {/* Main Mode Switcher Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
            marginBottom: '26px',
            background: '#10151d',
            padding: '10px',
            borderRadius: '18px',
            border: '1px solid rgba(255, 255, 255, 0.09)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveStoreTab('products')}
            style={{
              padding: '14px 18px',
              borderRadius: '14px',
              border: activeStoreTab === 'products' ? '1.5px solid #e08d3c' : '1px solid rgba(255, 255, 255, 0.08)',
              background: activeStoreTab === 'products' ? 'rgba(201, 119, 45, 0.16)' : 'transparent',
              color: activeStoreTab === 'products' ? '#fed7aa' : '#94a3b8',
              fontWeight: 900,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: activeStoreTab === 'products' ? '0 8px 20px -10px rgba(201,119,45,0.45)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>🛒</span>
            <span>توريد وشراء المنتجات والخامات ({PRODUCTS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveStoreTab('maintenance')}
            style={{
              padding: '14px 18px',
              borderRadius: '14px',
              border: activeStoreTab === 'maintenance' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              background: activeStoreTab === 'maintenance' ? 'rgba(14, 165, 233, 0.16)' : 'transparent',
              color: activeStoreTab === 'maintenance' ? '#7dd3fc' : '#94a3b8',
              fontWeight: 900,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: activeStoreTab === 'maintenance' ? '0 8px 20px -10px rgba(14,165,233,0.45)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>🛠️</span>
            <span>التنفيذ والصيانة الشاملة + توصيات هندسية ({MAINTENANCE_SERVICES.filter((s) => s.available).length})</span>
          </button>
        </div>

        {activeStoreTab === 'maintenance' ? (
          <section aria-label="قسم التنفيذ والصيانة الشاملة">
            {/* Engineering Recommendations Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(201, 119, 45, 0.12) 100%)',
                border: '1.5px solid rgba(56, 189, 248, 0.28)',
                borderRadius: '20px',
                padding: '22px',
                marginBottom: '22px',
                display: 'grid',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#7dd3fc', display: 'block', marginBottom: '4px' }}>
                    💡 منهجية فاي تك في التنفيذ والصيانة الموثّقة
                  </span>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc' }}>
                    تنفيذ متكامل لجميع البنود + صيانة وتشخيص أعطال بأحدث الأجهزة
                  </h2>
                </div>
                <span style={{ background: 'rgba(201, 119, 45, 0.16)', border: '1px solid rgba(224, 141, 60, 0.36)', color: '#fed7aa', padding: '6px 14px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 900 }}>
                  ✅ إشراف مهندس مختص · ضمان موثّق
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <div style={{ background: '#141a23', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255, 255, 255, 0.09)' }}>
                  <strong style={{ color: '#7dd3fc', display: 'block', marginBottom: '4px' }}>1️⃣ قاعدة الكشف المبكر قبل التشطيب</strong>
                  <span>اختبار ضغط السباكة 10 بار، واختبار الميجر للكهرباء، وضغط النيتروجين للتكييف قبل أي إغلاق أو تبليط.</span>
                </div>
                <div style={{ background: '#141a23', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255, 255, 255, 0.09)' }}>
                  <strong style={{ color: '#f3a85b', display: 'block', marginBottom: '4px' }}>2️⃣ قاعدة الصيانة بدون تكسير</strong>
                  <span>استخدام أجهزة كشف تسريبات المياه والكاميرا الحرارية وإصلاح الدوائر والسمارت هوم بأقل تدخل ممكن.</span>
                </div>
                <div style={{ background: '#141a23', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255, 255, 255, 0.09)' }}>
                  <strong style={{ color: '#6ee7b7', display: 'block', marginBottom: '4px' }}>3️⃣ باقة الصيانة الوقائية الدورية</strong>
                  <span>فحص نصف سنوي للكهرباء، الحساسات، التكييف، والعزل يوفر حتى 40% من تكاليف الأعطال المفاجئة.</span>
                </div>
              </div>
            </div>

            {/* Maintenance Search & Category Filter */}
            <div
              style={{
                background: '#10151d',
                border: '1px solid rgba(255, 255, 255, 0.09)',
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
                  placeholder="🔍 ابحث في خدمات التنفيذ والصيانة (مثال: كهرباء، تسريب مياه، جلي رخام، تكييف مخفي، سمارت هوم...)"
                  style={{
                    flex: '1 1 280px',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(255, 255, 255, 0.12)',
                    background: '#0d1118',
                    color: '#f1f5f9',
                    fontSize: '16px',
                    fontWeight: 700,
                  }}
                />
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#94a3b8' }}>
                  إجمالي الخدمات المتاحة: <strong style={{ color: '#7dd3fc' }}>{filteredMaintenance.length}</strong> قطاع
                </span>
              </div>
              <div className="st-cats-bar" role="tablist" aria-label="أقسام التنفيذ والصيانة">
                <button
                  type="button"
                  onClick={() => setMntFilterCategory('all')}
                  className={`st-cat-btn ${mntFilterCategory === 'all' ? 'is-active' : ''}`}
                >
                  <span>🛠️</span>
                  <span>كل البنود الهندسية ({MAINTENANCE_SERVICES.filter((s) => s.available).length})</span>
                </button>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setMntFilterCategory(cat.id)}
                    className={`st-cat-btn ${mntFilterCategory === cat.id ? 'is-active' : ''}`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.shortTitle}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMntFilterCategory('hvac')}
                  className={`st-cat-btn ${mntFilterCategory === 'hvac' ? 'is-active' : ''}`}
                >
                  <span>❄️</span>
                  <span>تكييف وتهوية</span>
                </button>
              </div>
            </div>

            {/* Maintenance Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '20px' }}>
              {filteredMaintenance.map((srv) => (
                <article
                  key={srv.id}
                  style={{
                    background: '#141a23',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 14px 32px -18px rgba(0, 0, 0, 0.55)',
                  }}
                >
                  <div>
                    {srv.imageUrl ? (
                      <div style={{ position: 'relative', height: '200px', background: '#0b0e13', overflow: 'hidden' }}>
                        <img src={srv.imageUrl} alt={srv.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {srv.badge && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              background: '#0284c7',
                              color: '#fff',
                              padding: '4px 12px',
                              borderRadius: '999px',
                              fontSize: '0.74rem',
                              fontWeight: 900,
                            }}
                          >
                            {srv.badge}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '16px 20px',
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(201, 119, 45, 0.14) 100%)',
                          borderBottom: '1px solid rgba(201, 119, 45, 0.25)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '12px',
                              background: '#0d1118',
                              border: '1.5px solid rgba(201, 119, 45, 0.38)',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: '1.4rem',
                            }}
                          >
                            {srv.icon}
                          </span>
                          <div>
                            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 800, color: '#f3a85b', display: 'block' }}>
                              {srv.code} · {srv.warrantyLabel}
                            </span>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc' }}>{srv.title}</h3>
                          </div>
                        </div>
                        {srv.badge && (
                          <span
                            style={{
                              background: 'rgba(14, 165, 233, 0.16)',
                              color: '#7dd3fc',
                              border: '1px solid rgba(56, 189, 248, 0.34)',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 900,
                            }}
                          >
                            {srv.badge}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ padding: '18px 20px', display: 'grid', gap: '14px' }}>
                      {srv.imageUrl && (
                        <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#f8fafc' }}>{srv.title}</h3>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                        <div style={{ background: 'rgba(201, 119, 45, 0.1)', border: '1px solid rgba(201, 119, 45, 0.28)', borderRadius: '14px', padding: '12px' }}>
                          <strong style={{ display: 'block', fontSize: '0.84rem', color: '#f3a85b', marginBottom: '8px' }}>
                            🏗️ بنود التنفيذ والتأسيس
                          </strong>
                          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: '6px', fontSize: '0.79rem', color: '#cbd5e1', fontWeight: 700 }}>
                            {srv.executionScope.map((item) => (
                              <li key={item} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#e08d3c' }}>✓</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(56, 189, 248, 0.28)', borderRadius: '14px', padding: '12px' }}>
                          <strong style={{ display: 'block', fontSize: '0.84rem', color: '#7dd3fc', marginBottom: '8px' }}>
                            🔧 بنود الصيانة والإصلاح
                          </strong>
                          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: '6px', fontSize: '0.79rem', color: '#cbd5e1', fontWeight: 700 }}>
                            {srv.maintenanceScope.map((item) => (
                              <li key={item} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#38bdf8' }}>•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {srv.recommendation && (
                        <div
                          style={{
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(251, 191, 36, 0.32)',
                            borderRadius: '12px',
                            padding: '11px 14px',
                            fontSize: '0.8rem',
                            lineHeight: 1.65,
                            color: '#fde68a',
                            fontWeight: 700,
                          }}
                        >
                          💡 {srv.recommendation}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div
                    style={{
                      padding: '14px 20px 18px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      background: '#0d1118',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      {srv.visitFee > 0 ? (
                        <>
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', fontWeight: 700 }}>
                            رسوم المعاينة / الفحص
                          </span>
                          <strong style={{ fontSize: '1.15rem', fontWeight: 900, color: '#7dd3fc' }}>
                            {srv.visitFee.toLocaleString('en-US')} {srv.currency}
                          </strong>
                        </>
                      ) : (
                        <>
                          <strong style={{ fontSize: '0.94rem', fontWeight: 900, color: '#7dd3fc', display: 'block' }}>
                            المعاينة والتسعير حسب البند
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700 }}>
                            {srv.warrantyLabel}
                          </span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenMaintenanceModal(srv)}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '12px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                        }}
                      >
                        🛠️ طلب تنفيذ / صيانة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddMaintenanceToCart(srv)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '12px',
                          border: '1.5px solid #c9772d',
                          background: 'rgba(201, 119, 45, 0.16)',
                          color: '#fed7aa',
                          fontWeight: 900,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                        }}
                      >
                        🛒 أضف للسلة
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <>
        {/* Smart Bundles Section */}
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '6px' }}>
            ⚡ باقات السمارت هوم وحساسات الأمان الجاهزة (توفير فوري)
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '16px' }}>
            باقات متكاملة تم اختيارها هندسياً لحماية الشقق والفلل والتحكم الكامل بها من الجوال بضغطة واحدة:
          </p>
          <div className="st-bundles-grid">
            {SMART_BUNDLES.map((b) => (
              <div
                key={b.id}
                style={{
                  background: 'linear-gradient(145deg, #171d27 0%, #12161f 100%)',
                  color: '#f1f5f9',
                  borderRadius: '20px',
                  padding: '22px',
                  border: '1.5px solid rgba(201, 119, 45, 0.36)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  boxShadow: '0 18px 36px -18px rgba(0, 0, 0, 0.6)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span
                      style={{
                        background: '#c9772d',
                        color: '#fff',
                        padding: '3px 12px',
                        borderRadius: '999px',
                        fontSize: '0.76rem',
                        fontWeight: 900,
                      }}
                    >
                      {b.badge}
                    </span>
                    <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 700 }}>شامل البرمجة والتطبيق</span>
                  </div>
                  <h3 style={{ fontSize: '1.12rem', fontWeight: 900, marginBottom: '6px', color: '#f8fafc' }}>
                    {b.title}
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: '12px', lineHeight: 1.55 }}>
                    {b.subtitle}
                  </p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700 }}>
                    {b.items.map((it) => (
                      <li key={it} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                        <span style={{ color: '#34d399', fontWeight: 900 }}>✓</span>
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
                    borderTop: '1px solid rgba(201, 119, 45, 0.25)',
                  }}
                >
                  <div>
                    {b.price > 0 ? (
                      <>
                        {b.oldPrice && b.oldPrice > b.price ? (
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: '#64748b',
                              textDecoration: 'line-through',
                              display: 'block',
                            }}
                          >
                            {b.oldPrice.toLocaleString('en-US')} {b.currency}
                          </span>
                        ) : null}
                        <strong style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f3a85b' }}>
                          {b.price.toLocaleString('en-US')} {b.currency}
                        </strong>
                      </>
                    ) : (
                      <strong style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f3a85b' }}>
                        السعر عند الطلب (عرض سعر)
                      </strong>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBundleAdd(b.id)}
                    style={{
                      padding: '11px 18px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #c9772d, #e08d3c)',
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
            background: '#10151d',
            border: '1px solid rgba(255, 255, 255, 0.09)',
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
                border: '1.5px solid rgba(255, 255, 255, 0.12)',
                background: '#0d1118',
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: 700,
              }}
            />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#94a3b8' }}>
              إجمالي المعروض: <strong style={{ color: '#f3a85b' }}>{filteredProducts.length}</strong> منتج
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
                    <div style={{ position: 'relative', height: '190px', background: '#0b0e13', overflow: 'hidden' }}>
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
                            background: '#c9772d',
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
                        background: `linear-gradient(135deg, ${cat.accent}22 0%, #0d1118 100%)`,
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
                            background: '#141a23',
                            border: `1.5px solid ${cat.accent}55`,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '1.35rem',
                          }}
                        >
                          {cat.icon}
                        </span>
                        <div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f3a85b', display: 'block' }}>
                            {cat.shortTitle}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                            {p.code} · {p.brand}
                          </span>
                        </div>
                      </div>
                      {p.badge && (
                        <span
                          style={{
                            background: 'rgba(201, 119, 45, 0.16)',
                            color: '#fed7aa',
                            border: '1px solid rgba(224, 141, 60, 0.36)',
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
                    <h3 style={{ fontSize: '1.02rem', fontWeight: 900, lineHeight: 1.4, color: '#f8fafc', margin: 0 }}>
                      {p.name}
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.58, margin: 0 }}>
                      {p.description}
                    </p>
                    {p.specs.length > 0 && (
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: 0, padding: 0 }}>
                        {p.specs.map((s) => (
                          <li
                            key={s}
                            style={{
                              fontSize: '0.78rem',
                              color: '#cbd5e1',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 700,
                            }}
                          >
                            <span style={{ color: '#e08d3c' }}>•</span>
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
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    background: '#0d1118',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      padding: '7px 10px',
                      borderRadius: '10px',
                      background: withInstall ? 'rgba(16, 185, 129, 0.14)' : '#141a23',
                      border: withInstall ? '1.5px solid rgba(52, 211, 153, 0.45)' : '1px solid rgba(255, 255, 255, 0.09)',
                      color: withInstall ? '#6ee7b7' : '#cbd5e1',
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
                      {p.installPrice && p.installPrice > 0
                        ? `إضافة خدمة التركيب الهندسي (+${p.installPrice.toLocaleString('en-US')} ${p.currency})`
                        : 'إضافة خدمة التركيب الهندسي المعتمد'}
                    </span>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      {p.price > 0 ? (
                        <>
                          {p.oldPrice && p.oldPrice > p.price && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.76rem', color: '#64748b', textDecoration: 'line-through' }}>
                                {p.oldPrice.toLocaleString('en-US')}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 900,
                                  background: 'rgba(16, 185, 129, 0.18)',
                                  color: '#6ee7b7',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                }}
                              >
                                خصم {discountPct}%
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                            <strong style={{ fontSize: '1.28rem', fontWeight: 900, color: '#f3a85b' }}>
                              {(p.price + (withInstall && p.installPrice ? p.installPrice : 0)).toLocaleString('en-US')}
                            </strong>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94a3b8' }}>
                              {p.currency} / {p.unit}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div>
                          <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#f3a85b', display: 'block' }}>
                            السعر عند الطلب
                          </strong>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>
                            أضف للسلة لطلب عرض سعر ({p.unit})
                          </span>
                        </div>
                      )}
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
                          ? 'linear-gradient(135deg, #c9772d 0%, #e08d3c 100%)'
                          : '#334155',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        cursor: p.inStock ? 'pointer' : 'not-allowed',
                        boxShadow: p.inStock ? '0 6px 16px -4px rgba(201, 119, 45, 0.45)' : 'none',
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
          </>
        )}
      </main>

      {/* Maintenance Booking Modal */}
      {selectedMaintenance && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99985,
            background: 'rgba(9,12,18,0.65)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            direction: 'rtl',
          }}
          onClick={() => setSelectedMaintenance(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#141a23',
              color: '#f1f5f9',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '20px',
              padding: '22px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {mntRef ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '2.5rem' }}>🛠️</div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#7dd3fc' }}>
                  تم تسجيل طلب التنفيذ والصيانة بنجاح!
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.65 }}>
                  رقم المرجع: <strong style={{ fontFamily: 'monospace', color: '#f1f5f9' }}>{mntRef}</strong>
                  <br />
                  تم إشعار فريق الصيانة والهندسة في فاي تك فوراً، وسيتواصل معك المهندس المختص على الرقم{' '}
                  <strong dir="ltr">{mntPhone}</strong> لتحديد المعاينة.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedMaintenance(null)}
                  style={{
                    padding: '11px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitMaintenanceRequest} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc' }}>
                    🛠️ حجز خدمة تنفيذ أو صيانة هندسية
                  </strong>
                  <button
                    type="button"
                    onClick={() => setSelectedMaintenance(null)}
                    style={{ border: '1px solid rgba(255,255,255,0.12)', background: '#0d1118', color: '#cbd5e1', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontWeight: 800 }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ background: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', padding: '10px 12px', fontSize: '0.82rem' }}>
                  <strong style={{ color: '#7dd3fc', display: 'block' }}>{selectedMaintenance.title}</strong>
                  <span style={{ color: '#94a3b8' }}>الكود: {selectedMaintenance.code} · {selectedMaintenance.warrantyLabel}</span>
                </div>

                <select
                  value={mntMode}
                  onChange={(e) => setMntMode(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', fontSize: '15px', fontWeight: 800, background: '#0d1118', color: '#f1f5f9' }}
                >
                  <option value="تنفيذ وتأسيس جديد">🏗️ تنفيذ وتأسيس جديد</option>
                  <option value="صيانة وإصلاح عطل">🔧 صيانة وإصلاح عطل</option>
                  <option value="صيانة دورية / فحص وقائي">🛡️ صيانة دورية / فحص وقائي</option>
                  <option value="طوارئ سريعة">🚨 طوارئ سريعة</option>
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    value={mntName}
                    onChange={(e) => setMntName(e.target.value)}
                    placeholder="الاسم الكامل *"
                    required
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', background: '#0d1118', color: '#f1f5f9', fontSize: '16px', fontWeight: 700 }}
                  />
                  <input
                    value={mntPhone}
                    onChange={(e) => setMntPhone(e.target.value)}
                    placeholder="رقم الجوال *"
                    dir="ltr"
                    inputMode="tel"
                    required
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', background: '#0d1118', color: '#f1f5f9', fontSize: '16px', fontWeight: 700, textAlign: 'right' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
                  <input
                    value={mntCity}
                    onChange={(e) => setMntCity(e.target.value)}
                    placeholder="المدينة والمنطقة"
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', background: '#0d1118', color: '#f1f5f9', fontSize: '15px' }}
                  />
                  <input
                    value={mntDate}
                    onChange={(e) => setMntDate(e.target.value)}
                    placeholder="الموعد المفضل (مثال: غداً 4 عصراً)"
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', background: '#0d1118', color: '#f1f5f9', fontSize: '15px' }}
                  />
                </div>

                <input
                  value={mntAddress}
                  onChange={(e) => setMntAddress(e.target.value)}
                  placeholder="العنوان التفصيلي للموقع"
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', background: '#0d1118', color: '#f1f5f9', fontSize: '15px' }}
                />

                <textarea
                  value={mntNotes}
                  onChange={(e) => setMntNotes(e.target.value)}
                  placeholder="وصف العطل أو الأعمال المطلوب تنفيذها (مساحة تقريبية / تفاصيل)"
                  rows={3}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid rgba(255, 255, 255, 0.12)', background: '#0d1118', color: '#f1f5f9', fontSize: '15px' }}
                />

                {mntErr && <div style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 700 }}>⚠️ {mntErr}</div>}

                <button
                  type="submit"
                  disabled={mntBusy}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: mntBusy ? 'wait' : 'pointer',
                  }}
                >
                  {mntBusy ? 'جاري إرسال الطلب...' : '✅ إرسال طلب التنفيذ والصيانة الآن'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Unified Footer (matches Homepage Standard) */}
      <footer className="pw-footer">
        <div className="pw-wrap">
          <div className="pw-footer-row">
            <div className="pw-footer-brand">
              <img src="/brand/phitech-mark-light.svg" alt="" />
              <div>
                <strong>{SITE.name}</strong>
                <small>{SITE.tagline}</small>
              </div>
            </div>
            <nav className="pw-footer-nav" aria-label="روابط التذييل">
              {PUBLIC_NAV_ITEMS.map((n) => (
                <Link key={n.href} href={n.href}>{n.label}</Link>
              ))}
            </nav>
            <Link href="/verify" className="pw-footer-link" style={{ color: 'var(--o)', fontWeight: 'bold' }}>
              التحقق من صحة المستندات
            </Link>
            {(cart.portalHref || !cart.user) && (
              <Link href={cart.portalHref || '/login?portal=employee'} className="pw-footer-link">
                🏢 بوابة الموظفين
              </Link>
            )}
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
