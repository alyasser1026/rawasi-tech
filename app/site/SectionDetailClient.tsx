"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CSS } from './site-styles';
import { mergeContent, SERVICES, STEPS, type SiteContentOverride } from './site-content';
import {
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
  type WebsiteProduct,
} from './store-catalog';
import {
  getPortalSectionMeta,
  resolveCanonicalSectionSlug,
  type SectionSlug,
} from './section-defs';
import { CartDrawer, useCustomerCart } from './CartDrawer';
import PublicHeader, { PUBLIC_NAV_ITEMS } from './PublicHeader';
import LoginModal from './LoginModal';
import FloatingContactChat from './FloatingContactChat';
import EngTools from './EngTools';
import ChecklistExplorer from './ChecklistExplorer';

const CapitalTower3D = dynamic(() => import('./CapitalTower3D'), {
  ssr: false,
  loading: () => (
    <div className="pw-bim-stage">
      <div className="pw-bim-note">جاري تحميل المجسم المعماري ثلاثي الأبعاد…</div>
    </div>
  ),
});

const BimModel = dynamic(() => import('./BimModel'), {
  ssr: false,
  loading: () => (
    <div className="pw-bim-stage">
      <div className="pw-bim-note">جاري تحميل نموذج BIM ثلاثي الأبعاد…</div>
    </div>
  ),
});

const GENERAL_ENGINEERING_TIPS = [
  {
    tag: '⚡ كهرباء وسمارت هوم',
    title: 'لا تغلق علب الكهرباء بدون سلك النيوترال (Neutral)',
    tip: 'وجود سلك نيوترال داخل كل علبة مفتاح + خراطيم تيار خفيف مستقلة بمسافة 20 سم عن الكهرباء يتيح لك تحويل منزلك لسمارت هوم في أي وقت مستقبلاً بدون تكسير.',
  },
  {
    tag: '🚰 السباكة والعزل',
    title: 'اختبار الضغط 10 بار قبل اللياسة والسيراميك',
    tip: 'لا تسمح أبداً بتقفيل أي حمام قبل كبس مواسير التغذية 10 بار لمدة 24 ساعة وتجربة غمر العزل المائي 48 ساعة وتصوير المسارات فيديو للرجوع إليها عند الصيانة.',
  },
  {
    tag: '🟫 البورسلان والرخام',
    title: 'ممنوع تركيب البورسلان بالأسمنت والماء العادي',
    tip: 'البورسلان قص الليزر لا يمتص الماء؛ يجب لصقه بمادة لاصقة مرنة C2TE مع دهان ظهر البلاطة الكبيرة واستخدام الكلبسات وميزان الليزر لمنع التطبيل.',
  },
  {
    tag: '🎨 الدهانات والمعجون',
    title: 'البرايمر والمعجون المناسب يضاعف عمر الدهان',
    tip: 'استخدم معجون جدران أسمنتي (فتونيت داخلي) لتسوية الخرسانات، يليها فيلر وبرايمر أصلي ثم 3 سكاكين معجون وصنفرة بالكشاف قبل الوجه النهائي القابل للغسيل.',
  },
  {
    tag: '❄️ التكييف المخفي',
    title: 'P-Trap للصرف وفتحات صيانة مخفية بالجبس',
    tip: 'لا توصل صرف التكييف على صفاية الحمام مباشرة بدون جراب مائي P-Trap لمنع الروائح، واترك فتحة Access Panel أسفل كل ماكينة كونسيلد لسهولة الصيانة الدورية.',
  },
  {
    tag: '🚨 الأمان ضد الكوارث',
    title: 'محبس الفصل التلقائي أهم من صافرة الإنذار',
    tip: 'حساس تسرب المياه أو الغاز وحده ينبهك فقط؛ لكن ربطه بمحبس إغلاق أوتوماتيكي يحمي شقتك وتشطيباتك ويمنع الغرق أو الحريق حتى أثناء سفرك.',
  },
];

export default function SectionDetailClient({
  slug,
  content,
}: {
  slug: SectionSlug;
  content?: SiteContentOverride;
}) {
  const { SITE, COMMITMENTS, FAQS, PRODUCTS, PROPERTIES, MAINTENANCE_SERVICES } =
    mergeContent(content);
  const [loginOpen, setLoginOpen] = useState(false);
  const cart = useCustomerCart(() => setLoginOpen(true));

  const canonicalSlug = resolveCanonicalSectionSlug(slug);
  const sectionMeta = getPortalSectionMeta(slug);
  const waDigits = (SITE.contact.whatsapp || '201558888744').replace(/\D/g, '') || '201558888744';
  const openWhatsApp = (message: string) => {
    window.open(
      `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  // --- Unified section tabs ---
  const [execTab, setExecTab] = useState<'contracting' | 'maintenance'>(
    slug === 'maintenance' ? 'maintenance' : 'contracting'
  );
  const [salesTab, setSalesTab] = useState<'materials' | 'smart-home'>(
    slug === 'smart-home' ? 'smart-home' : 'materials'
  );

  // --- Maintenance state ---
  const [mntCat, setMntCat] = useState<string>('all');
  const filteredMaintenance = useMemo(
    () =>
      MAINTENANCE_SERVICES.filter(
        (m) => m.available !== false && (mntCat === 'all' || m.category === mntCat)
      ),
    [MAINTENANCE_SERVICES, mntCat]
  );

  // --- Contracting state ---
  const [contractView, setContractView] = useState<'calc' | 'tower3d' | 'bim'>('calc');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const v = params.get('view');

    if (canonicalSlug === 'contracting') {
      if (v === 'tower3d' || v === 'bim') {
        setExecTab('contracting');
        setContractView(v);
      } else if (tab === 'maintenance' || (slug === 'maintenance' && tab !== 'contracting')) {
        setExecTab('maintenance');
      } else {
        setExecTab('contracting');
      }
    } else if (canonicalSlug === 'materials') {
      if (tab === 'smart-home' || tab === 'materials') {
        setSalesTab(tab);
      } else if (slug === 'smart-home') {
        setSalesTab('smart-home');
      } else {
        setSalesTab('materials');
      }
    }
  }, [slug, canonicalSlug]);
  const [calcType, setCalcType] = useState<'villa' | 'tower' | 'commercial' | 'duplex'>('villa');
  const [calcArea, setCalcArea] = useState<number>(350);
  const [calcFloors, setCalcFloors] = useState<number>(2);
  const [calcTier, setCalcTier] = useState<'standard' | 'deluxe' | 'royal'>('deluxe');
  const [calcScopes, setCalcScopes] = useState({ structural: true, finishing: true, mep: true });

  const contractingStats = useMemo(() => {
    const totalBua = calcArea * calcFloors;
    const tierFactor = calcTier === 'standard' ? 1 : calcTier === 'deluxe' ? 1.35 : 1.75;
    const baseRates = {
      villa: { struct: 1100, arch: 1450, mep: 550 },
      tower: { struct: 1250, arch: 1200, mep: 600 },
      commercial: { struct: 1150, arch: 1350, mep: 700 },
      duplex: { struct: 980, arch: 1550, mep: 620 },
    }[calcType];
    const subtotal =
      (calcScopes.structural ? totalBua * baseRates.struct * tierFactor : 0) +
      (calcScopes.finishing ? totalBua * baseRates.arch * tierFactor : 0) +
      (calcScopes.mep ? totalBua * baseRates.mep * tierFactor : 0);
    const allOn = calcScopes.structural && calcScopes.finishing && calcScopes.mep;
    const total = Math.round(allOn ? subtotal * 0.93 : subtotal);
    const concreteCbm = calcScopes.structural ? Math.round(totalBua * 0.42) : 0;
    const steelTons = calcScopes.structural ? Math.round(totalBua * 0.046) : 0;
    const paintBuckets = calcScopes.finishing ? Math.max(4, Math.round((totalBua * 2.8) / 45)) : 0;
    const hvacTons = calcScopes.mep ? Math.max(2, Math.round(totalBua / 18)) : 0;
    let months = 1;
    if (calcScopes.structural) months += Math.ceil(calcFloors * 1.1);
    if (calcScopes.finishing) months += Math.ceil(calcFloors * 1.2);
    if (calcScopes.mep) months += 1;
    if (allOn) months = Math.max(3, Math.round(months * 0.8));
    return { totalBua, total, concreteCbm, steelTons, paintBuckets, hvacTons, months, allOn };
  }, [calcType, calcArea, calcFloors, calcTier, calcScopes]);

  // --- Building Materials state ---
  const [materialsMode, setMaterialsMode] = useState<'buy' | 'sell'>('buy');
  const [materialCatFilter, setMaterialCatFilter] = useState<'all' | ProductCategoryId>('all');
  const [materialInstallMap, setMaterialInstallMap] = useState<Record<string, boolean>>({});
  const [sellMaterialName, setSellMaterialName] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [sellUnit, setSellUnit] = useState('بستلة / كيس / طن');
  const [sellPrice, setSellPrice] = useState('');
  const [sellCity, setSellCity] = useState('الرياض / القاهرة / المنصورة');
  const [sellPhone, setSellPhone] = useState('');
  const [sellNotes, setSellNotes] = useState('');
  const [sellSubmitted, setSellSubmitted] = useState(false);

  const buildingMaterialCategories: ProductCategoryId[] = [
    'paint',
    'ceramics',
    'marble',
    'electrical',
    'plumbing',
    'decor',
  ];
  const materialProducts = useMemo(
    () =>
      PRODUCTS.filter((p) => {
        if (!buildingMaterialCategories.includes(p.category)) return false;
        if (materialCatFilter !== 'all' && p.category !== materialCatFilter) return false;
        return true;
      }),
    [PRODUCTS, materialCatFilter]
  );

  // --- Smart Tech state ---
  const [shRooms, setShRooms] = useState<number>(3);
  const [shAcs, setShAcs] = useState<number>(3);
  const [shIncludeLock, setShIncludeLock] = useState<boolean>(true);
  const [shIncludeSafety, setShIncludeSafety] = useState<boolean>(true);
  const [shCamerasCount, setShCamerasCount] = useState<number>(4);
  const smartProducts = useMemo(
    () => PRODUCTS.filter((p) => ['smart_home', 'low_current', 'safety_sensors'].includes(p.category)),
    [PRODUCTS]
  );

  const handleAddConfiguredSmartPackage = () => {
    const itemsToAdd: { product: WebsiteProduct; qty: number }[] = [];
    const hub = PRODUCTS.find((p) => p.id === 'sm-01');
    const smartSwitch = PRODUCTS.find((p) => p.id === 'sm-03');
    const acIr = PRODUCTS.find((p) => p.id === 'sm-04');
    const lock = PRODUCTS.find((p) => p.id === 'sm-02');
    const gas = PRODUCTS.find((p) => p.id === 'sf-01');
    const water = PRODUCTS.find((p) => p.id === 'sf-02');
    const smoke = PRODUCTS.find((p) => p.id === 'sf-03');
    const cam = PRODUCTS.find((p) => p.id === 'lc-01');
    if (hub) itemsToAdd.push({ product: hub, qty: 1 });
    if (smartSwitch) itemsToAdd.push({ product: smartSwitch, qty: Math.max(1, shRooms) });
    if (acIr && shAcs > 0) itemsToAdd.push({ product: acIr, qty: shAcs });
    if (lock && shIncludeLock) itemsToAdd.push({ product: lock, qty: 1 });
    if (shIncludeSafety) {
      if (gas) itemsToAdd.push({ product: gas, qty: 1 });
      if (water) itemsToAdd.push({ product: water, qty: 1 });
      if (smoke) itemsToAdd.push({ product: smoke, qty: 2 });
    }
    if (cam && shCamerasCount > 0) {
      itemsToAdd.push({ product: cam, qty: Math.max(1, Math.ceil(shCamerasCount / 4)) });
    }
    if (itemsToAdd.length > 0) cart.addBundleToCart(itemsToAdd, true);
  };

  // --- Info state ---
  const [infoTab, setInfoTab] = useState<'tips' | 'tools' | 'checklist' | 'faq'>('tips');
  useEffect(() => {
    if (typeof window !== 'undefined' && slug === 'info') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'tips' || t === 'tools' || t === 'checklist' || t === 'faq') {
        setInfoTab(t);
      }
    }
  }, [slug]);

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellMaterialName.trim() || !sellPhone.trim()) return;
    setSellSubmitted(true);
    const msg = [
      '📦 عرض بيع / توريد مواد بناء — موقع فاي تك',
      `الخامة / الصنف: ${sellMaterialName}`,
      `الكمية: ${sellQty || 'غير محدد'} (${sellUnit})`,
      `السعر المعروض: ${sellPrice || 'عند التواصل'}`,
      `الموقع / المدينة: ${sellCity}`,
      `هاتف المورد / البائع: ${sellPhone}`,
      sellNotes && `تفاصيل إضافية: ${sellNotes}`,
    ]
      .filter(Boolean)
      .join('\n');

    void fetch('/api/website-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderType: 'material_sell_offer',
        customerName: `مورد خامات (${sellCity})`,
        customerPhone: sellPhone,
        notes: msg,
        totalAmount: Number(sellPrice) || 0,
      }),
    }).catch(() => {});

    openWhatsApp(msg);
  };

  return (
    <div className={`pw ${loginOpen ? 'has-modal-blur' : ''}`} dir="rtl">
      <style>{CSS}</style>

      <PublicHeader
        siteName={SITE.name}
        siteNameEn={SITE.nameEn}
        activeKey={canonicalSlug}
        cartCount={cart.totalCount}
        onOpenCart={() => cart.setCartOpen(true)}
        userName={cart.user?.fullName}
        userEmail={cart.user?.email}
        portalHref={cart.portalHref}
        onOpenLogin={() => (cart.user ? cart.setCartOpen(true) : setLoginOpen(true))}
        onSignOut={cart.signOut}
      />

      <main className="pw-section-page">
        {/* Clean Unified Architectural Page Header matching Homepage Standard */}
        <section
          className="pw-unified-hero"
          style={{ '--portal-accent': sectionMeta.accent } as React.CSSProperties}
        >
          <div className="pw-wrap">
            <div className="pw-sec-hero-split">
              <div className="pw-head" style={{ marginBottom: 0 }}>
                <div className="pw-unified-crumb">
                  <Link href="/">الأقسام الرئيسية</Link>
                  <span>/</span>
                  <span>{sectionMeta.title}</span>
                </div>
                <p className="pw-eyebrow">قسم رقم {sectionMeta.num} · {SITE.name}</p>
                <h1>
                  <span style={{ marginInlineEnd: '8px' }} aria-hidden="true">{sectionMeta.icon}</span>
                  {sectionMeta.title}
                </h1>
                <p>{sectionMeta.guideHint}</p>
              </div>
              <div className="pw-sec-hero-visual">
                <img
                  src={sectionMeta.image}
                  alt={sectionMeta.imageAlt}
                  width={1280}
                  height={720}
                  decoding="async"
                />
                <span className="pw-sec-hero-badge">{sectionMeta.num}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Dedicated Content Area */}
        <div className="pw-wrap pw-sec-content">
          {/* 1. قسم المقاولات والتنفيذ والصيانة */}
          {canonicalSlug === 'contracting' && (
            <div>
              <div className="pw-seg" style={{ marginBottom: '22px' }}>
                <button
                  type="button"
                  className={execTab === 'contracting' ? 'is-on' : ''}
                  onClick={() => setExecTab('contracting')}
                >
                  🏗️ المقاولات والإنشاءات والمقايسة 3D
                </button>
                <button
                  type="button"
                  className={execTab === 'maintenance' ? 'is-on' : ''}
                  onClick={() => setExecTab('maintenance')}
                >
                  🛠️ التنفيذ والصيانة الهندسية ({MAINTENANCE_SERVICES.length})
                </button>
              </div>

              {execTab === 'maintenance' && (
            <div>
              <div className="pw-chip-bar">
                <button
                  type="button"
                  className={`pw-chip ${mntCat === 'all' ? 'is-on' : ''}`}
                  onClick={() => setMntCat('all')}
                >
                  كل البنود ({MAINTENANCE_SERVICES.length})
                </button>
                <button
                  type="button"
                  className={`pw-chip ${mntCat === 'hvac' ? 'is-on' : ''}`}
                  onClick={() => setMntCat('hvac')}
                >
                  ❄️ التكييف المخفي والاسبليت
                </button>
                {PRODUCT_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pw-chip ${mntCat === c.id ? 'is-on' : ''}`}
                    onClick={() => setMntCat(c.id)}
                  >
                    {c.icon} {c.shortTitle}
                  </button>
                ))}
              </div>

              <div className="pw-mnt-grid">
                {filteredMaintenance.map((srv) => (
                  <article key={srv.id} className="pw-mnt-card">
                    <div className="pw-mnt-card-head">
                      <span className="pw-mnt-icon">{srv.icon}</span>
                      <div>
                        <span className="pw-mnt-code">{srv.code} · {srv.badge}</span>
                        <h3>{srv.title}</h3>
                      </div>
                    </div>

                    <div className="pw-mnt-cols">
                      <div className="pw-mnt-box is-exec">
                        <strong>🛠️ نطاق التنفيذ والتأسيس:</strong>
                        <ul>
                          {srv.executionScope.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="pw-mnt-box is-repair">
                        <strong>🔧 نطاق الصيانة والإصلاح:</strong>
                        <ul>
                          {srv.maintenanceScope.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pw-mnt-tip">
                      <strong>💡 {srv.recommendation.split(':')[0]}:</strong>
                      <span>{srv.recommendation.split(':').slice(1).join(':')}</span>
                    </div>

                    <div className="pw-mnt-foot">
                      <span className="pw-mnt-warranty">🛡️ {srv.warrantyLabel}</span>
                      <div className="pw-mnt-actions">
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsApp(
                              `مرحباً فاي تك، أحتاج طلب (${srv.title} - كود ${srv.code}). أرجو التواصل لتحديد موعد المعاينة.`
                            )
                          }
                          className="pw-btn pw-btn-primary"
                          style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.82rem' }}
                        >
                          📅 حجز معاينة / صيانة
                        </button>
                        <Link
                          href="/store?tab=maintenance"
                          className="pw-btn pw-btn-ghost"
                          style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.82rem' }}
                        >
                          حجز عبر المتجر
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* التبويب الثاني: المقاولات والإنشاءات */}
          {execTab === 'contracting' && (
            <div>
              <div className="pw-cards" style={{ marginBottom: '26px' }}>
                {SERVICES.map((s) => (
                  <article key={s.id} className="pw-card">
                    <div className="pw-icon">
                      {s.id === 'structure' ? '🏗️' : s.id === 'finishing' ? '🏛️' : '❄️'}
                    </div>
                    <h3>{s.title}</h3>
                    <p>{s.summary}</p>
                    <ul>
                      {s.items.map((item) => (
                        <li key={item}>
                          <span style={{ color: 'var(--o)', fontWeight: 900 }}>✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <div className="pw-seg" style={{ marginBottom: '18px' }}>
                <button
                  type="button"
                  className={contractView === 'calc' ? 'is-on' : ''}
                  onClick={() => setContractView('calc')}
                >
                  🧮 حاسبة المقايسة والتكلفة 3×1
                </button>
                <button
                  type="button"
                  className={contractView === 'tower3d' ? 'is-on' : ''}
                  onClick={() => setContractView('tower3d')}
                >
                  🏢 المجسم المعماري ثلاثي الأبعاد 3D
                </button>
                <button
                  type="button"
                  className={contractView === 'bim' ? 'is-on' : ''}
                  onClick={() => setContractView('bim')}
                >
                  📐 نموذج الطبقات التفاعلي BIM
                </button>
              </div>

              {contractView === 'calc' && (
                <div className="pw-calc-box">
                  <div className="pw-calc-head">
                    <div>
                      <span className="pw-explorer-kicker">أداة التسعير الهندسي 3×1</span>
                      <h3>احسب مقايسة مشروعك (عظم + تشطيب + كهروميكانيك) خلال ثوانٍ</h3>
                    </div>
                  </div>
                  <div className="pw-calc-grid">
                    <div className="pw-calc-controls">
                      <div className="pw-seg">
                        {(
                          [
                            { id: 'villa', label: 'فيلا سكنية' },
                            { id: 'tower', label: 'عمارة / برج' },
                            { id: 'duplex', label: 'دوبلكس / شقة' },
                            { id: 'commercial', label: 'تجاري / إداري' },
                          ] as const
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={calcType === t.id ? 'is-on' : ''}
                            onClick={() => setCalcType(t.id)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="pw-calc-sliders">
                        <label className="pw-range">
                          <span>مساحة الدور الواحد: <strong>{calcArea} م²</strong></span>
                          <input
                            type="range"
                            min={80}
                            max={1500}
                            step={10}
                            value={calcArea}
                            onChange={(e) => setCalcArea(Number(e.target.value))}
                          />
                        </label>
                        <label className="pw-range">
                          <span>عدد الأدوار: <strong>{calcFloors} {calcFloors === 1 ? 'دور' : 'أدوار'}</strong></span>
                          <input
                            type="range"
                            min={1}
                            max={12}
                            step={1}
                            value={calcFloors}
                            onChange={(e) => setCalcFloors(Number(e.target.value))}
                          />
                        </label>
                      </div>

                      <div className="pw-calc-scopes">
                        <label className={`pw-scope-toggle ${calcScopes.structural ? 'is-on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={calcScopes.structural}
                            onChange={() =>
                              setCalcScopes((p) =>
                                !p.finishing && !p.mep && p.structural ? p : { ...p, structural: !p.structural }
                              )
                            }
                          />
                          <span>🏗️ الإنشاءات والعظم</span>
                        </label>
                        <label className={`pw-scope-toggle ${calcScopes.finishing ? 'is-on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={calcScopes.finishing}
                            onChange={() =>
                              setCalcScopes((p) =>
                                !p.structural && !p.mep && p.finishing ? p : { ...p, finishing: !p.finishing }
                              )
                            }
                          />
                          <span>✨ التشطيبات المعمارية</span>
                        </label>
                        <label className={`pw-scope-toggle ${calcScopes.mep ? 'is-on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={calcScopes.mep}
                            onChange={() =>
                              setCalcScopes((p) =>
                                !p.structural && !p.finishing && p.mep ? p : { ...p, mep: !p.mep }
                              )
                            }
                          />
                          <span>❄️ تكييف مخفي وكهروميكانيك MEP</span>
                        </label>
                      </div>

                      <div className="pw-seg">
                        {(
                          [
                            { id: 'standard', label: 'مواصفة قياسية معتمدة' },
                            { id: 'deluxe', label: 'تشطيب ديلوكس فاخر' },
                            { id: 'royal', label: 'ملكي Ultra VIP + سمارت' },
                          ] as const
                        ).map((tier) => (
                          <button
                            key={tier.id}
                            type="button"
                            className={calcTier === tier.id ? 'is-on' : ''}
                            onClick={() => setCalcTier(tier.id)}
                          >
                            {tier.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pw-calc-summary">
                      <div className="pw-calc-summary-top">
                        <span>إجمالي المسطح البنائي (BUA)</span>
                        <strong>{contractingStats.totalBua.toLocaleString()} م²</strong>
                        {contractingStats.allOn && (
                          <span className="pw-discount-pill">🎁 يشمل خصم التكامل 3×1 (توفير 7% ومنع التكسير)</span>
                        )}
                      </div>
                      <div className="pw-calc-metrics">
                        <div><small>خرسانة تقريبية</small><strong>{contractingStats.concreteCbm} م³</strong></div>
                        <div><small>حديد تسليح</small><strong>{contractingStats.steelTons} طن</strong></div>
                        <div><small>دهانات (بستلة)</small><strong>{contractingStats.paintBuckets} بستلة</strong></div>
                        <div><small>قدرة تكييف</small><strong>{contractingStats.hvacTons} طن</strong></div>
                        <div><small>المدة المتوقعة</small><strong>{contractingStats.months} شهر</strong></div>
                        <div><small>مستوى المواصفة</small><strong>{calcTier === 'standard' ? 'قياسي' : calcTier === 'deluxe' ? 'ديلوكس' : 'VIP'}</strong></div>
                      </div>
                      <button
                        type="button"
                        className="pw-btn pw-btn-primary"
                        style={{ width: '100%' }}
                        onClick={() =>
                          openWhatsApp(
                            `طلب عرض سعر رسمي لمشروع (${calcType}) بمسطح ${contractingStats.totalBua} م² (${calcFloors} أدوار × ${calcArea} م²) — مستوى (${calcTier}) — النطاق: ${[
                              calcScopes.structural && 'عظم',
                              calcScopes.finishing && 'تشطيبات',
                              calcScopes.mep && 'MEP',
                            ]
                              .filter(Boolean)
                              .join(' + ')}.`
                          )
                        }
                      >
                        📲 اطلب تسعير ومعاينة هذه المقايسة على واتساب
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {contractView === 'tower3d' && <CapitalTower3D />}
              {contractView === 'bim' && <BimModel />}
            </div>
          )}
            </div>
          )}

          {/* 2. قسم المبيعات والسمارت هوم */}
          {canonicalSlug === 'materials' && (
            <div>
              <div className="pw-seg" style={{ marginBottom: '22px' }}>
                <button
                  type="button"
                  className={salesTab === 'materials' ? 'is-on' : ''}
                  onClick={() => setSalesTab('materials')}
                >
                  🧱 بيع وشراء مواد البناء
                </button>
                <button
                  type="button"
                  className={salesTab === 'smart-home' ? 'is-on' : ''}
                  onClick={() => setSalesTab('smart-home')}
                >
                  📱 التكنولوجيا والسمارت هوم
                </button>
              </div>

          {/* بيع وشراء مواد البناء */}
          {salesTab === 'materials' && (
            <div>
              <div className="pw-seg" style={{ marginBottom: '18px' }}>
                <button
                  type="button"
                  className={materialsMode === 'buy' ? 'is-on' : ''}
                  onClick={() => setMaterialsMode('buy')}
                >
                  🛒 شراء وتوريد مواد البناء والتشطيبات لمشروعك
                </button>
                <button
                  type="button"
                  className={materialsMode === 'sell' ? 'is-on' : ''}
                  onClick={() => setMaterialsMode('sell')}
                >
                  🤝 بيع مواد بناء / تقديم عرض أسعار مورد أو فائض موقع
                </button>
              </div>

              {materialsMode === 'buy' ? (
                <>
                  <div className="pw-chip-bar">
                    <button
                      type="button"
                      className={`pw-chip ${materialCatFilter === 'all' ? 'is-on' : ''}`}
                      onClick={() => setMaterialCatFilter('all')}
                    >
                      كل خامات البناء والتشطيب ({materialProducts.length})
                    </button>
                    {PRODUCT_CATEGORIES.filter((c) => buildingMaterialCategories.includes(c.id)).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`pw-chip ${materialCatFilter === c.id ? 'is-on' : ''}`}
                        onClick={() => setMaterialCatFilter(c.id)}
                      >
                        {c.icon} {c.shortTitle}
                      </button>
                    ))}
                  </div>

                  <div className="pw-materials-highlight">
                    <div>
                      <strong>🎨 توريد باقات المعجون والدهانات المعتمدة للمشاريع والفلل (بالكميات):</strong>
                      <span>
                        كيس معجون جدران أسمنتي (فتونيت داخلي) · بستلة همبل فيلر ومعجون فواصل جبس · كوتكس فيلر شقوق · برايمر همبل وتوباز · مايسترو مات إملشن · بروفايل كازا راستيكا 3MM · تيب دوكو وجوينت وكورنر تيب.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="pw-btn pw-btn-primary"
                      style={{ minHeight: '40px', padding: '0 16px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}
                      onClick={() =>
                        openWhatsApp(
                          'السلام عليكم، أرغب في تسعيرة جملة لتوريد خامات المعجون والدهانات (فتونيت، همبل فيلر، توباز، مايسترو، وبروفايل) لمشروعي.'
                        )
                      }
                    >
                      📦 اطلب عرض سعر جملة للكميات
                    </button>
                  </div>

                  <div className="pw-prod-grid">
                    {materialProducts.map((p) => {
                      const withInstall = Boolean(materialInstallMap[p.id]);
                      return (
                        <article key={p.id} className="pw-prod-card">
                          <div>
                            {p.imageUrl && (
                              <div className="pw-prod-thumb">
                                <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" />
                              </div>
                            )}
                            <div className="pw-prod-top">
                              <span className="pw-prod-code">{p.code}</span>
                              {p.badge && <span className="pw-prod-badge">{p.badge}</span>}
                            </div>
                            <h3>{p.name}</h3>
                            <p className="pw-prod-desc">{p.description}</p>
                            <ul className="pw-prod-specs">
                              {p.specs.slice(0, 3).map((s) => (
                                <li key={s}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="pw-prod-foot">
                            <label className="pw-prod-install-check">
                              <input
                                type="checkbox"
                                checked={withInstall}
                                onChange={() =>
                                  setMaterialInstallMap((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                                }
                              />
                              <span>شامل التركيب / التنفيذ الهندسي</span>
                            </label>
                            <div className="pw-prod-actions">
                              <button
                                type="button"
                                className="pw-btn pw-btn-primary"
                                style={{ flex: 1, minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                                onClick={() => cart.addToCart(p, 1, withInstall)}
                              >
                                🛒 أضف للسلة ({p.unit})
                              </button>
                              <button
                                type="button"
                                className="pw-btn pw-btn-ghost"
                                style={{ minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                                onClick={() =>
                                  openWhatsApp(`أحتاج عرض سعر لمنتج: ${p.name} (${p.code}) — الوحدة: ${p.unit}`)
                                }
                              >
                                السعر
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="pw-calc-box">
                  <div className="pw-calc-head">
                    <div>
                      <span className="pw-explorer-kicker">منصة المشتريات والتوريدات — فاي تك</span>
                      <h3>اعرض مواد بناء أو خامات تشطيب للبيع / التوريد لمشاريعنا</h3>
                    </div>
                  </div>
                  <form className="pw-form" onSubmit={handleSellSubmit}>
                    <div className="pw-grid2">
                      <label className="pw-field">
                        <span>اسم الخامة / الصنف المعروض للبيع *</span>
                        <input required placeholder="مثال: 200 كيس معجون فتونيت أو 50 بستلة دهان همبل" value={sellMaterialName} onChange={(e) => setSellMaterialName(e.target.value)} />
                      </label>
                      <label className="pw-field">
                        <span>رقم الجوال / الواتساب للتواصل *</span>
                        <input required dir="ltr" placeholder="+20... / +966..." value={sellPhone} onChange={(e) => setSellPhone(e.target.value)} />
                      </label>
                    </div>
                    <div className="pw-grid-fields">
                      <label className="pw-field">
                        <span>الكمية المتوفرة</span>
                        <input placeholder="مثال: 100" value={sellQty} onChange={(e) => setSellQty(e.target.value)} />
                      </label>
                      <label className="pw-field">
                        <span>الوحدة</span>
                        <input value={sellUnit} onChange={(e) => setSellUnit(e.target.value)} />
                      </label>
                      <label className="pw-field">
                        <span>السعر المعروض (اختياري)</span>
                        <input placeholder="السعر للوحدة أو الإجمالي" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
                      </label>
                    </div>
                    <div className="pw-grid2">
                      <label className="pw-field">
                        <span>المدينة / موقع التخزين</span>
                        <input value={sellCity} onChange={(e) => setSellCity(e.target.value)} />
                      </label>
                      <label className="pw-field">
                        <span>تفاصيل الحالة أو المواصفة</span>
                        <input placeholder="تاريخ الصلاحية، الماركة، الفاتورة الضريبية..." value={sellNotes} onChange={(e) => setSellNotes(e.target.value)} />
                      </label>
                    </div>
                    <button type="submit" className="pw-btn pw-btn-primary">
                      🤝 إرسال عرض البيع لإدارة المشتريات عبر واتساب والنظام
                    </button>
                    {sellSubmitted && (
                      <div className="pw-answer" style={{ padding: '12px 16px' }}>
                        <span>✓ تم تجهيز وإرسال عرض البيع بنجاح لإدارة المشتريات في فاي تك.</span>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}

          {/* التكنولوجيا والسمارت هوم */}
          {salesTab === 'smart-home' && (
            <div>
              <div className="pw-calc-box" style={{ marginBottom: '26px', borderColor: 'rgba(5,150,105,0.35)' }}>
                <div className="pw-calc-head">
                  <div>
                    <span className="pw-explorer-kicker" style={{ color: '#059669' }}>أداة التخصيص الذكي — بدون تكسير</span>
                    <h3>صمّم منظومة السمارت هوم والأمان لوحدتك</h3>
                  </div>
                </div>
                <div className="pw-calc-grid">
                  <div className="pw-calc-controls">
                    <div className="pw-calc-sliders">
                      <label className="pw-range">
                        <span>عدد الغرف / خطوط الإضاءة الذكية: <strong>{shRooms} غرف</strong></span>
                        <input type="range" min={1} max={10} value={shRooms} onChange={(e) => setShRooms(Number(e.target.value))} />
                      </label>
                      <label className="pw-range">
                        <span>عدد التكييفات للتحكم عن بُعد: <strong>{shAcs} تكييفات</strong></span>
                        <input type="range" min={0} max={8} value={shAcs} onChange={(e) => setShAcs(Number(e.target.value))} />
                      </label>
                      <label className="pw-range">
                        <span>كاميرات مراقبة IP 4K: <strong>{shCamerasCount} كاميرات</strong></span>
                        <input type="range" min={0} max={16} step={4} value={shCamerasCount} onChange={(e) => setShCamerasCount(Number(e.target.value))} />
                      </label>
                    </div>
                    <div className="pw-calc-scopes">
                      <label className={`pw-scope-toggle ${shIncludeLock ? 'is-on' : ''}`}>
                        <input type="checkbox" checked={shIncludeLock} onChange={() => setShIncludeLock((v) => !v)} />
                        <span>🔐 قفل باب ذكي بالكاميرا والبصمة</span>
                      </label>
                      <label className={`pw-scope-toggle ${shIncludeSafety ? 'is-on' : ''}`}>
                        <input type="checkbox" checked={shIncludeSafety} onChange={() => setShIncludeSafety((v) => !v)} />
                        <span>🚨 درع الأمان (محابس غاز ومياه تلقائية + دخان)</span>
                      </label>
                    </div>
                  </div>
                  <div className="pw-calc-summary">
                    <div className="pw-calc-summary-top">
                      <span>تكوين الباقة الذكية المقترحة</span>
                      <strong>{shRooms} غرف ذكية + {shCamerasCount} كاميرا</strong>
                    </div>
                    <ul className="pw-prod-specs" style={{ marginBottom: '12px' }}>
                      <li>✓ شاشة تحكم مركزية 4 بوصة + Zigbee Hub</li>
                      <li>✓ {shRooms} مفاتيح لمس ذكية Wi-Fi/Zigbee</li>
                      {shAcs > 0 && <li>✓ {shAcs} وحدة تحكم ذكي بالتكييفات عبر الجوال</li>}
                      {shIncludeLock && <li>✓ قفل باب ذكي 6×1 يرسل صورة الزائر لجوالك</li>}
                      {shIncludeSafety && <li>✓ حساس غاز + حساسين مياه بمحبس فصل أوتوماتيكي + حساسات حريق</li>}
                    </ul>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button type="button" className="pw-btn pw-btn-primary" onClick={handleAddConfiguredSmartPackage}>
                        🛒 إضافة الباقة المصممة للسلة (شامل البرمجة)
                      </button>
                      <button
                        type="button"
                        className="pw-btn pw-btn-ghost"
                        onClick={() =>
                          openWhatsApp(
                            `أريد تسعير ومعاينة باقة سمارت هوم مخصصة: ${shRooms} غرف، ${shAcs} تكييفات، ${shCamerasCount} كاميرات${shIncludeLock ? '، قفل باب ذكي' : ''}${shIncludeSafety ? '، حساسات الغاز والمياه والحريق' : ''}.`
                          )
                        }
                      >
                        📲 استشارة مهندس السمارت هوم عبر واتساب
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pw-prod-grid">
                {smartProducts.map((p) => (
                  <article key={p.id} className="pw-prod-card">
                    <div>
                      {p.imageUrl && (
                        <div className="pw-prod-thumb">
                          <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" />
                        </div>
                      )}
                      <div className="pw-prod-top">
                        <span className="pw-prod-code">{p.code}</span>
                        {p.badge && <span className="pw-prod-badge">{p.badge}</span>}
                      </div>
                      <h3>{p.name}</h3>
                      <p className="pw-prod-desc">{p.description}</p>
                      <ul className="pw-prod-specs">
                        {p.specs.slice(0, 3).map((s) => (
                          <li key={s}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="pw-prod-foot">
                      <div className="pw-prod-actions">
                        <button
                          type="button"
                          className="pw-btn pw-btn-primary"
                          style={{ flex: 1, minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                          onClick={() => cart.addToCart(p, 1, true)}
                        >
                          🛒 أضف مع البرمجة والتركيب
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
            </div>
          )}

          {/* 3. قسم معلومات عامة */}
          {canonicalSlug === 'info' && (
            <div>
              <div className="pw-seg" style={{ marginBottom: '20px' }}>
                <button type="button" className={infoTab === 'tips' ? 'is-on' : ''} onClick={() => setInfoTab('tips')}>
                  💡 نصائح ذهبية والتزاماتنا
                </button>
                <button type="button" className={infoTab === 'tools' ? 'is-on' : ''} onClick={() => setInfoTab('tools')}>
                  📐 الحاسبة التقديرية والأدوات الهندسية
                </button>
                <button type="button" className={infoTab === 'checklist' ? 'is-on' : ''} onClick={() => setInfoTab('checklist')}>
                  📋 دليل التنفيذ والفحص الهندسي
                </button>
                <button type="button" className={infoTab === 'faq' ? 'is-on' : ''} onClick={() => setInfoTab('faq')}>
                  ❓ الأسئلة الشائعة + التحقق
                </button>
              </div>

              {infoTab === 'tips' && (
                <div>
                  <div className="pw-tips-grid">
                    {GENERAL_ENGINEERING_TIPS.map((item) => (
                      <article key={item.title} className="pw-tip-card">
                        <span className="pw-tip-tag">{item.tag}</span>
                        <h4>{item.title}</h4>
                        <p>{item.tip}</p>
                      </article>
                    ))}
                  </div>
                  <div className="pw-info-meta-row">
                    <div className="pw-contact-card" style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '12px' }}>🛡️ التزامات فاي تك في كل موقع</h4>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {COMMITMENTS.map((cm) => (
                          <li key={cm.title} style={{ display: 'block', padding: '0 0 10px', borderBottom: '1px solid var(--line)' }}>
                            <strong style={{ display: 'block', marginBottom: '2px' }}>{cm.title}</strong>
                            <span style={{ fontSize: '0.88rem', color: 'var(--ink-2)' }}>{cm.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="pw-contact-card" style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '12px' }}>⏳ مراحل العمل من المعاينة للتسليم</h4>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {STEPS.map((st) => (
                          <li key={st.n} style={{ display: 'flex', justifyContent: 'flex-start', gap: '10px', padding: '0 0 10px', borderBottom: '1px solid var(--line)' }}>
                            <span style={{ color: 'var(--o)', fontWeight: 900 }}>{st.n}</span>
                            <div>
                              <strong style={{ display: 'block', marginBottom: '2px' }}>{st.title}</strong>
                              <span style={{ fontSize: '0.88rem', color: 'var(--ink-2)' }}>{st.text}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {infoTab === 'tools' && <EngTools propertiesCount={PROPERTIES.length} />}
              {infoTab === 'checklist' && <ChecklistExplorer />}
              {infoTab === 'faq' && (
                <div>
                  <div className="pw-faq" style={{ maxWidth: '100%' }}>
                    {FAQS.map((f) => (
                      <details key={f.q}>
                        <summary>{f.q}</summary>
                        <p>{f.a}</p>
                      </details>
                    ))}
                  </div>
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <Link href="/verify" className="pw-btn pw-btn-primary">
                      🔐 فتح بوابة التحقق من صحة المستندات والعقود
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="pw-footer">
        <div className="pw-wrap">
          <div className="pw-footer-row">
            <div className="pw-footer-brand">
              <img src="/brand/phitech-mark-light.svg" alt="" />
              <div><strong>{SITE.legalName}</strong><small>{SITE.offices.join(' · ')}</small></div>
            </div>
            <nav className="pw-footer-nav" aria-label="روابط التذييل">
              {PUBLIC_NAV_ITEMS.map((n) => (
                <Link key={n.key} href={n.href}>{n.label}</Link>
              ))}
            </nav>
            <Link href="/verify" className="pw-footer-link" style={{ color: 'var(--o)', fontWeight: 'bold' }}>التحقق من صحة المستندات</Link>
            {(cart.portalHref || !cart.user) && (
              <Link href={cart.portalHref || '/login?portal=employee'} className="pw-footer-link">🏢 بوابة الموظفين</Link>
            )}
          </div>
          <p className="pw-footer-bottom">© {new Date().getFullYear()} {SITE.name} — جميع الحقوق محفوظة</p>
        </div>
      </footer>

      <div className="pw-dock-pad" aria-hidden="true" />

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

      <FloatingContactChat
        whatsappNumber={SITE.contact.whatsapp}
        defaultName={cart.user?.fullName || ''}
        defaultPhone={cart.user?.phone || ''}
        contextLabel={`${sectionMeta.title} — فاي تك`}
      />

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
