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
import { CartButton, CartDrawer, useCustomerCart } from './CartDrawer';
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
        .st-hero {
          background: radial-gradient(900px 420px at 20% 20%, rgba(249,115,22,0.22), transparent 70%), linear-gradient(180deg, #0b0f15 0%, #141a22 100%);
          color: #ffffff;
          padding: 108px 0 44px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .st-promo {
          background: linear-gradient(90deg, #9a3412 0%, #ea580c 50%, #c2410c 100%);
          color: #fff;
          padding: 10px 16px;
          text-align: center;
          font-size: 0.85rem;
          font-weight: 800;
        }
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
          border: 1.5px solid #e3e6e9;
          background: #ffffff;
          color: #14181b;
          font-weight: 800;
          font-size: 0.86rem;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
        }
        .st-cat-btn:hover {
          border-color: #f97316;
          color: #c75517;
          transform: translateY(-1px);
        }
        .st-cat-btn.is-active {
          background: #ea580c;
          color: #ffffff;
          border-color: #ea580c;
          box-shadow: 0 8px 20px -6px rgba(234, 88, 12, 0.5);
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
          background: #ffffff;
          border: 1px solid #e3e6e9;
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .st-prod-card:hover {
          transform: translateY(-3px);
          border-color: rgba(234, 88, 12, 0.45);
          box-shadow: 0 20px 40px -24px rgba(20, 28, 34, 0.22);
        }
        @media (max-width: 980px) {
          .st-bundles-grid { grid-template-columns: 1fr; }
          .st-products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        }
        @media (max-width: 680px) {
          .st-hero { padding: 84px 0 28px; }
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

      {/* Top Sticky Header */}
      <header className="pw-header is-scrolled">
        <div className="pw-wrap pw-header-row">
          <Link href="/" className="pw-brand" aria-label={`${SITE.name} — الرئيسية`}>
            <img src="/brand/phitech-mark-color.svg" alt="" className="pw-brand-mark" />
            <span className="pw-brand-text">
              <strong>{SITE.name}</strong>
              <small>STORE & SMART SYSTEMS</small>
            </span>
          </Link>

          <nav className="pw-nav" aria-label="التنقل الرئيسي">
            <Link href="/">الرئيسية</Link>
            <Link href="/store" style={{ color: '#fb923c', fontWeight: 900 }}>
              🛒 متجر المنتجات
            </Link>
            <Link href="/real-estate">🏢 عروض العقارات</Link>
            <Link href="/#capital-tower">المجسم 3D</Link>
            <Link href="/verify" className="pw-nav-verify">
              التحقق من المستندات
            </Link>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CartButton count={cart.totalCount} onClick={() => cart.setCartOpen(true)} />

            {cart.user ? (
              <button
                type="button"
                onClick={handleSignOut}
                title="تسجيل الخروج"
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fde68a',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                👤 {cart.user.fullName.split(' ')[0]} (خروج)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="pw-btn pw-btn-primary pw-nav-cta"
                style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.82rem' }}
              >
                دخول / حساب جديد
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="st-hero">
        {PROMO_BANNER.enabled && (
          <div className="st-promo" style={{ marginBottom: '22px', borderRadius: '0' }}>
            <div className="pw-wrap">{PROMO_BANNER.text}</div>
          </div>
        )}
        <div className="pw-wrap">
          <p className="pw-eyebrow" style={{ color: '#fb923c' }}>
            متجر فاي تك الهندسي — توريد معتمد وتركيب بإشراف هندسي
          </p>
          <h1 style={{ fontSize: 'clamp(1.45rem, 3.2vw, 2.45rem)', fontWeight: 900, lineHeight: 1.32, marginBottom: '12px' }}>
            كل ما يحتاجه مشروعك من <span style={{ color: '#f97316' }}>التأسيسات والتشطيبات</span> إلى{' '}
            <span style={{ color: '#38bdf8' }}>السمارت هوم وحساسات الأمان</span>
          </h1>
          <p style={{ color: '#cbd5e1', maxWidth: '48rem', fontSize: '0.96rem', marginBottom: '20px' }}>
            اختر منتجاتك من الكهرباء، السباكة، الدهانات، السيراميك، الرخام، الديكورات، أجهزة التحكم الذكي، التيار الخفيف،
            وحساسات الحريق والغاز والمياه — وأضفها لسلتك لطلب التوريد المباشر أو التوريد مع التركيب الهندسي بالضمان.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setActiveStoreTab('products')}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '12px',
                border: activeStoreTab === 'products' ? '1.5px solid #f97316' : '1.5px solid rgba(255,255,255,0.22)',
                background: activeStoreTab === 'products' ? '#ea580c' : 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              🛒 كتالوج المنتجات ({PRODUCTS.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveStoreTab('maintenance')}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '12px',
                border: activeStoreTab === 'maintenance' ? '1.5px solid #38bdf8' : '1.5px solid rgba(255,255,255,0.22)',
                background: activeStoreTab === 'maintenance' ? '#0284c7' : 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              🛠️ التنفيذ والصيانة الشاملة ({MAINTENANCE_SERVICES.filter((s) => s.available).length})
            </button>
            {!cart.user ? (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="pw-btn pw-btn-primary"
                style={{ minHeight: '44px', padding: '0 20px', fontSize: '0.9rem' }}
              >
                🔐 سجّل دخولك أو أنشئ حسابك لتفعيل سلة المشتريات
              </button>
            ) : (
              <button
                type="button"
                onClick={() => cart.setCartOpen(true)}
                className="pw-btn pw-btn-primary"
                style={{ minHeight: '44px', padding: '0 20px', fontSize: '0.9rem' }}
              >
                🛍️ استعراض سلة مشترياتك ({cart.totalCount} صنف{cart.totalAmount > 0 ? ` — ${cart.totalAmount.toLocaleString('en-US')} ج.م` : ''})
              </button>
            )}
            <Link
              href="/real-estate"
              className="pw-btn pw-btn-light"
              style={{ minHeight: '44px', padding: '0 18px', fontSize: '0.88rem' }}
            >
              🏢 تصفح عروض العقارات والوحدات السكنية ←
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
            background: '#f8fafc',
            padding: '10px',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveStoreTab('products')}
            style={{
              padding: '14px 18px',
              borderRadius: '14px',
              border: activeStoreTab === 'products' ? '1.5px solid #ea580c' : '1px solid #e2e8f0',
              background: activeStoreTab === 'products' ? '#ffffff' : 'transparent',
              color: activeStoreTab === 'products' ? '#c75517' : '#47525c',
              fontWeight: 900,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: activeStoreTab === 'products' ? '0 8px 20px -10px rgba(199,85,23,0.35)' : 'none',
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
              border: activeStoreTab === 'maintenance' ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
              background: activeStoreTab === 'maintenance' ? '#ffffff' : 'transparent',
              color: activeStoreTab === 'maintenance' ? '#0369a1' : '#47525c',
              fontWeight: 900,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: activeStoreTab === 'maintenance' ? '0 8px 20px -10px rgba(2,132,199,0.35)' : 'none',
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
                background: 'linear-gradient(135deg, #f0f9ff 0%, #fff7ed 100%)',
                border: '1.5px solid #bae6fd',
                borderRadius: '20px',
                padding: '22px',
                marginBottom: '22px',
                display: 'grid',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#0369a1', display: 'block', marginBottom: '4px' }}>
                    💡 منهجية فاي تك في التنفيذ والصيانة الموثّقة
                  </span>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                    تنفيذ متكامل لجميع البنود + صيانة وتشخيص أعطال بأحدث الأجهزة
                  </h2>
                </div>
                <span style={{ background: '#ffffff', border: '1px solid #fed7aa', color: '#c75517', padding: '6px 14px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 900 }}>
                  ✅ إشراف مهندس مختص · ضمان موثّق
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.82rem', color: '#334155' }}>
                <div style={{ background: '#ffffff', borderRadius: '12px', padding: '12px', border: '1px solid #e2e8f0' }}>
                  <strong style={{ color: '#0369a1', display: 'block', marginBottom: '4px' }}>1️⃣ قاعدة الكشف المبكر قبل التشطيب</strong>
                  <span>اختبار ضغط السباكة 10 بار، واختبار الميجر للكهرباء، وضغط النيتروجين للتكييف قبل أي إغلاق أو تبليط.</span>
                </div>
                <div style={{ background: '#ffffff', borderRadius: '12px', padding: '12px', border: '1px solid #e2e8f0' }}>
                  <strong style={{ color: '#c75517', display: 'block', marginBottom: '4px' }}>2️⃣ قاعدة الصيانة بدون تكسير</strong>
                  <span>استخدام أجهزة كشف تسريبات المياه والكاميرا الحرارية وإصلاح الدوائر والسمارت هوم بأقل تدخل ممكن.</span>
                </div>
                <div style={{ background: '#ffffff', borderRadius: '12px', padding: '12px', border: '1px solid #e2e8f0' }}>
                  <strong style={{ color: '#15803d', display: 'block', marginBottom: '4px' }}>3️⃣ باقة الصيانة الوقائية الدورية</strong>
                  <span>فحص نصف سنوي للكهرباء، الحساسات، التكييف، والعزل يوفر حتى 40% من تكاليف الأعطال المفاجئة.</span>
                </div>
              </div>
            </div>

            {/* Maintenance Search & Category Filter */}
            <div
              style={{
                background: '#f6f5f3',
                border: '1px solid #e3e6e9',
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
                    border: '1.5px solid #e3e6e9',
                    background: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 700,
                  }}
                />
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#47525c' }}>
                  إجمالي الخدمات المتاحة: <strong style={{ color: '#0369a1' }}>{filteredMaintenance.length}</strong> قطاع
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
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 30px -18px rgba(15, 23, 42, 0.14)',
                  }}
                >
                  <div>
                    {srv.imageUrl ? (
                      <div style={{ position: 'relative', height: '200px', background: '#f8fafc', overflow: 'hidden' }}>
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
                          background: 'linear-gradient(135deg, #f8fafc 0%, #fff7ed 100%)',
                          borderBottom: '1px solid #fed7aa',
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
                              background: '#ffffff',
                              border: '1.5px solid #fed7aa',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: '1.4rem',
                            }}
                          >
                            {srv.icon}
                          </span>
                          <div>
                            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 800, color: '#c75517', display: 'block' }}>
                              {srv.code} · {srv.warrantyLabel}
                            </span>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>{srv.title}</h3>
                          </div>
                        </div>
                        {srv.badge && (
                          <span
                            style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              border: '1px solid #bae6fd',
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
                        <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#0f172a' }}>{srv.title}</h3>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                        <div style={{ background: '#fffaf5', border: '1px solid #fed7aa', borderRadius: '14px', padding: '12px' }}>
                          <strong style={{ display: 'block', fontSize: '0.84rem', color: '#c75517', marginBottom: '8px' }}>
                            🏗️ بنود التنفيذ والتأسيس
                          </strong>
                          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: '6px', fontSize: '0.79rem', color: '#334155', fontWeight: 700 }}>
                            {srv.executionScope.map((item) => (
                              <li key={item} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#ea580c' }}>✓</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '14px', padding: '12px' }}>
                          <strong style={{ display: 'block', fontSize: '0.84rem', color: '#0369a1', marginBottom: '8px' }}>
                            🔧 بنود الصيانة والإصلاح
                          </strong>
                          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: '6px', fontSize: '0.79rem', color: '#334155', fontWeight: 700 }}>
                            {srv.maintenanceScope.map((item) => (
                              <li key={item} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#0284c7' }}>•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {srv.recommendation && (
                        <div
                          style={{
                            background: '#fefce8',
                            border: '1px solid #fde047',
                            borderRadius: '12px',
                            padding: '11px 14px',
                            fontSize: '0.8rem',
                            lineHeight: 1.65,
                            color: '#713f12',
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
                      borderTop: '1px solid #f1f5f9',
                      background: '#fafaf9',
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
                          <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', fontWeight: 700 }}>
                            رسوم المعاينة / الفحص
                          </span>
                          <strong style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0369a1' }}>
                            {srv.visitFee.toLocaleString('en-US')} {srv.currency}
                          </strong>
                        </>
                      ) : (
                        <>
                          <strong style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0369a1', display: 'block' }}>
                            المعاينة والتسعير حسب البند
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>
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
                          border: '1.5px solid #ea580c',
                          background: '#fff7ed',
                          color: '#c75517',
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
          <p style={{ fontSize: '0.88rem', color: '#47525c', marginBottom: '16px' }}>
            باقات متكاملة تم اختيارها هندسياً لحماية الشقق والفلل والتحكم الكامل بها من الجوال بضغطة واحدة:
          </p>
          <div className="st-bundles-grid">
            {SMART_BUNDLES.map((b) => (
              <div
                key={b.id}
                style={{
                  background: 'linear-gradient(145deg, #ffffff 0%, #fff8f3 100%)',
                  color: '#14181b',
                  borderRadius: '20px',
                  padding: '22px',
                  border: '1.5px solid #fed7aa',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  boxShadow: '0 14px 32px -18px rgba(199, 85, 23, 0.22)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span
                      style={{
                        background: '#ea580c',
                        color: '#fff',
                        padding: '3px 12px',
                        borderRadius: '999px',
                        fontSize: '0.76rem',
                        fontWeight: 900,
                      }}
                    >
                      {b.badge}
                    </span>
                    <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700 }}>شامل البرمجة والتطبيق</span>
                  </div>
                  <h3 style={{ fontSize: '1.12rem', fontWeight: 900, marginBottom: '6px', color: '#14181b' }}>
                    {b.title}
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: '#47525c', marginBottom: '12px', lineHeight: 1.55 }}>
                    {b.subtitle}
                  </p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#334155', fontWeight: 700 }}>
                    {b.items.map((it) => (
                      <li key={it} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                        <span style={{ color: '#16a34a', fontWeight: 900 }}>✓</span>
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
                    borderTop: '1px solid #fed7aa',
                  }}
                >
                  <div>
                    {b.price > 0 ? (
                      <>
                        {b.oldPrice && b.oldPrice > b.price ? (
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: '#94a3b8',
                              textDecoration: 'line-through',
                              display: 'block',
                            }}
                          >
                            {b.oldPrice.toLocaleString('en-US')} {b.currency}
                          </span>
                        ) : null}
                        <strong style={{ fontSize: '1.35rem', fontWeight: 900, color: '#c75517' }}>
                          {b.price.toLocaleString('en-US')} {b.currency}
                        </strong>
                      </>
                    ) : (
                      <strong style={{ fontSize: '1.05rem', fontWeight: 900, color: '#c75517' }}>
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
                      background: 'linear-gradient(135deg, #f97316, #c75517)',
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
            background: '#f6f5f3',
            border: '1px solid #e3e6e9',
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
                border: '1.5px solid #e3e6e9',
                background: '#ffffff',
                fontSize: '16px',
                fontWeight: 700,
              }}
            />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#47525c' }}>
              إجمالي المعروض: <strong style={{ color: '#c75517' }}>{filteredProducts.length}</strong> منتج
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
                    <div style={{ position: 'relative', height: '190px', background: '#f8fafc', overflow: 'hidden' }}>
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
                            background: '#ea580c',
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
                        background: `linear-gradient(135deg, ${cat.accent}18 0%, #f8fafc 100%)`,
                        borderBottom: '1px solid #f1f5f9',
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
                            background: '#ffffff',
                            border: `1.5px solid ${cat.accent}44`,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '1.35rem',
                          }}
                        >
                          {cat.icon}
                        </span>
                        <div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: cat.accent, display: 'block' }}>
                            {cat.shortTitle}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#64748b' }}>
                            {p.code} · {p.brand}
                          </span>
                        </div>
                      </div>
                      {p.badge && (
                        <span
                          style={{
                            background: '#fff3ea',
                            color: '#c75517',
                            border: '1px solid #fed7aa',
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
                    <h3 style={{ fontSize: '1.02rem', fontWeight: 900, lineHeight: 1.4, color: '#14181b', margin: 0 }}>
                      {p.name}
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: '#47525c', lineHeight: 1.58, margin: 0 }}>
                      {p.description}
                    </p>
                    {p.specs.length > 0 && (
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: 0, padding: 0 }}>
                        {p.specs.map((s) => (
                          <li
                            key={s}
                            style={{
                              fontSize: '0.78rem',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 700,
                            }}
                          >
                            <span style={{ color: '#ea580c' }}>•</span>
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
                    borderTop: '1px solid #f1f5f9',
                    background: '#fafaf9',
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
                      background: withInstall ? '#ecfdf5' : '#ffffff',
                      border: withInstall ? '1.5px solid #10b981' : '1px solid #e3e6e9',
                      color: withInstall ? '#065f46' : '#47525c',
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
                              <span style={{ fontSize: '0.76rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                                {p.oldPrice.toLocaleString('en-US')}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 900,
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                }}
                              >
                                خصم {discountPct}%
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                            <strong style={{ fontSize: '1.28rem', fontWeight: 900, color: '#c75517' }}>
                              {(p.price + (withInstall && p.installPrice ? p.installPrice : 0)).toLocaleString('en-US')}
                            </strong>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#47525c' }}>
                              {p.currency} / {p.unit}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div>
                          <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#c75517', display: 'block' }}>
                            السعر عند الطلب
                          </strong>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
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
                          ? 'linear-gradient(135deg, #f97316 0%, #c75517 100%)'
                          : '#cbd5e1',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        cursor: p.inStock ? 'pointer' : 'not-allowed',
                        boxShadow: p.inStock ? '0 6px 16px -4px rgba(249, 115, 22, 0.45)' : 'none',
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
              background: '#ffffff',
              color: '#14181b',
              borderRadius: '20px',
              padding: '22px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {mntRef ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '2.5rem' }}>🛠️</div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0369a1' }}>
                  تم تسجيل طلب التنفيذ والصيانة بنجاح!
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#47525c', lineHeight: 1.65 }}>
                  رقم المرجع: <strong style={{ fontFamily: 'monospace' }}>{mntRef}</strong>
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
                  <strong style={{ fontSize: '1.05rem', fontWeight: 900 }}>
                    🛠️ حجز خدمة تنفيذ أو صيانة هندسية
                  </strong>
                  <button
                    type="button"
                    onClick={() => setSelectedMaintenance(null)}
                    style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontWeight: 800 }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '10px 12px', fontSize: '0.82rem' }}>
                  <strong style={{ color: '#0369a1', display: 'block' }}>{selectedMaintenance.title}</strong>
                  <span style={{ color: '#47525c' }}>الكود: {selectedMaintenance.code} · {selectedMaintenance.warrantyLabel}</span>
                </div>

                <select
                  value={mntMode}
                  onChange={(e) => setMntMode(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '15px', fontWeight: 800, background: '#ffffff' }}
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
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '16px', fontWeight: 700 }}
                  />
                  <input
                    value={mntPhone}
                    onChange={(e) => setMntPhone(e.target.value)}
                    placeholder="رقم الجوال *"
                    dir="ltr"
                    inputMode="tel"
                    required
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '16px', fontWeight: 700, textAlign: 'right' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
                  <input
                    value={mntCity}
                    onChange={(e) => setMntCity(e.target.value)}
                    placeholder="المدينة والمنطقة"
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '15px' }}
                  />
                  <input
                    value={mntDate}
                    onChange={(e) => setMntDate(e.target.value)}
                    placeholder="الموعد المفضل (مثال: غداً 4 عصراً)"
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '15px' }}
                  />
                </div>

                <input
                  value={mntAddress}
                  onChange={(e) => setMntAddress(e.target.value)}
                  placeholder="العنوان التفصيلي للموقع"
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '15px' }}
                />

                <textarea
                  value={mntNotes}
                  onChange={(e) => setMntNotes(e.target.value)}
                  placeholder="وصف العطل أو الأعمال المطلوب تنفيذها (مساحة تقريبية / تفاصيل)"
                  rows={3}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e3e6e9', fontSize: '15px' }}
                />

                {mntErr && <div style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: 700 }}>⚠️ {mntErr}</div>}

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

      {/* Mobile Bottom Dock */}
      <div className="pw-dock-pad" aria-hidden="true" />
      <nav className="pw-mobile-dock" aria-label="شريط الوصول السريع">
        <Link href="/" className="pw-dock-item">
          <span className="pw-dock-icon">🏠</span>
          <span className="pw-dock-label">الرئيسية</span>
        </Link>
        <Link href="/store" className="pw-dock-item is-active">
          <span className="pw-dock-icon">🛒</span>
          <span className="pw-dock-label">المنتجات</span>
        </Link>
        <button
          type="button"
          className="pw-dock-item pw-dock-cta"
          onClick={() => cart.setCartOpen(true)}
        >
          <span className="pw-dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </span>
          <span className="pw-dock-label">السلة ({cart.totalCount})</span>
        </button>
        <Link href="/real-estate" className="pw-dock-item">
          <span className="pw-dock-icon">🏢</span>
          <span className="pw-dock-label">العقارات</span>
        </Link>
        <button
          type="button"
          className="pw-dock-item"
          onClick={() => (cart.user ? cart.setCartOpen(true) : setLoginOpen(true))}
        >
          <span className="pw-dock-icon">👤</span>
          <span className="pw-dock-label">{cart.user ? 'حسابي' : 'دخول'}</span>
        </button>
      </nav>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cart.cartOpen}
        onClose={() => cart.setCartOpen(false)}
        user={cart.user}
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
