"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface SalesScenario {
  id: 'smart-lock' | 'crystal-switches' | 'calacatta';
  code: string;
  categoryLabel: string;
  searchQueryText: string;
  urls: [string, string, string, string];
  stepTitles: [string, string, string, string];
  stepDescs: [string, string, string, string];
  itemTitle: string;
  itemSubtitle: string;
  itemThumb: string;
  companionTitle: string;
  companionCode: string;
  specLabel: string;
  optionBadge: string;
  ctaLabel: string;
  unitPriceLabel: string;
  orderCode: string;
  orderSummary: string;
}

const SALES_SCENARIOS: SalesScenario[] = [
  {
    id: 'smart-lock',
    code: 'SM-02',
    categoryLabel: 'سمارت هوم والتحكم الذكي',
    searchQueryText: 'قفل باب ذكي 6×1',
    urls: [
      'phitech.eg/sections/materials?q=smart-lock',
      'phitech.eg/store/SM-02',
      'phitech.eg/store#checkout',
      'phitech.eg/orders/ORD-PHI-842',
    ],
    stepTitles: [
      '01 · يبحث العميل في قسم المبيعات',
      '02 · يفعّل التوريد + التركيب ويضيف للسلة',
      '03 · يراجع بياناته ويؤكد الأوردر فوراً',
      '04 · تأكيد الطلب على الويب والجوال معاً',
    ],
    stepDescs: [
      'يكتب اسم المنتج في المتجر على الكمبيوتر أو الآيفون فتظهر المواصفة بصورة الاستوديو.',
      'يحدد خيار التوريد مع التركيب وتُضاف القطعة للسلة لحظياً.',
      'يراجع ملخص السلة ورقم الجوال للتأكيد قبل الشحن والتركيب بضغطة واحدة.',
      'يصدر رقم الأوردر الموثق فوراً وتبدأ متابعة التوصيل والتركيب في نفس الوقت.',
    ],
    itemTitle: 'قفل باب ذكي 6×1 بالكاميرا والبصمة',
    itemSubtitle: 'كاميرا عين سحرية + بصمة إصبع ووجه + تحكم من الجوال',
    itemThumb: '/products/smart-door-lock.webp',
    companionTitle: 'شاشة تحكم سمارت هوم 4 بوصة',
    companionCode: 'SM-01',
    specLabel: 'توريد + تركيب معتمد',
    optionBadge: 'ضمان 3 سنوات',
    ctaLabel: 'أضف للسلة',
    unitPriceLabel: 'باقة توريد وتركيب معتمدة',
    orderCode: 'ORD-PHI-842',
    orderSummary: 'تم تأكيد طلب القفل الذكي 6×1 وجاري تنسيق موعد التوصيل والتركيب',
  },
  {
    id: 'crystal-switches',
    code: 'EL-01',
    categoryLabel: 'أدوات الكهرباء والإنارة',
    searchQueryText: 'طقم مفاتيح زجاجي كريستال',
    urls: [
      'phitech.eg/sections/materials?q=switches',
      'phitech.eg/store/EL-01',
      'phitech.eg/store#checkout',
      'phitech.eg/orders/ORD-PHI-914',
    ],
    stepTitles: [
      '01 · يستعرض تشطيبات الكهرباء بالمتجر',
      '02 · يراجع الضمان وخيار التركيب',
      '03 · يرسل طلب الشراء من السلة الموحدة',
      '04 · اعتماد التجهيز والتوصيل للموقع',
    ],
    stepDescs: [
      'يتصفح العميل قسم المبيعات وتظهر له خامات الكهرباء بالصور الحقيقية.',
      'يتأكد من المواصفات ويختار التوريد مع التركيب في الخطوة نفسها.',
      'تُفتح السلة بكامل البيانات ويضغط تأكيد وإرسال الأوردر في ثوانٍ.',
      'يتسلم رقم الطلب الإلكتروني وتُجهَّز الكمية مباشرة من المخزن.',
    ],
    itemTitle: 'طقم مفاتيح وأفياش زجاجي كريستال (10 قطع)',
    itemSubtitle: 'زجاج مقسى مقاوم للخدش مع مخارج USB + Type-C',
    itemThumb: '/products/crystal-switches.webp',
    companionTitle: 'مفتاح إضاءة تاتش ذكي Wi-Fi',
    companionCode: 'SM-03',
    specLabel: 'توريد معتمد + تركيب وفحص الأحمال',
    optionBadge: 'ضمان 10 سنوات',
    ctaLabel: 'أضف للسلة',
    unitPriceLabel: 'توريد كميات وتشطيب كامل',
    orderCode: 'ORD-PHI-914',
    orderSummary: 'تم تجهيز طقم المفاتيح الكريستال من المخزن وجاري الشحن',
  },
  {
    id: 'calacatta',
    code: 'CR-01',
    categoryLabel: 'السيراميك والبورسلان',
    searchQueryText: 'بورسلان كلكتا ذهبي 120×60',
    urls: [
      'phitech.eg/sections/materials?q=calacatta',
      'phitech.eg/store/CR-01',
      'phitech.eg/store#checkout',
      'phitech.eg/orders/ORD-PHI-738',
    ],
    stepTitles: [
      '01 · يبحث عن خامات الأرضيات بالمتجر',
      '02 · يفعّل خدمة التركيب بالليزر',
      '03 · يؤكد طلب الكمية وعنوان التسليم',
      '04 · جدولة الشحن والتنفيذ المتزامن',
    ],
    stepDescs: [
      'يدخل العميل على خامات البورسلان والرخام في قسم المبيعات.',
      'يضيف البورسلان قص الليزر للسلة مع خيار التركيب بالليزر.',
      'يراجع العنوان والموعد ويؤكد إرسال الأوردر عبر الويب أو التطبيق.',
      'يصله إشعار تأكيد الأوردر وتتحرك شحنة الفرز الأول فوراً.',
    ],
    itemTitle: 'بورسلان أرضيات كلكتا ذهبي 120×60',
    itemSubtitle: 'قص ليزر Full Body فرز أول مقاوم للخدش والأحماض',
    itemThumb: '/products/calacatta-porcelain.webp',
    companionTitle: 'بستلة دهان جوتن فينوماستيك مذهل',
    companionCode: 'PT-01',
    specLabel: 'توريد فرز أول + تركيب بميزان الليزر',
    optionBadge: 'فرز أول إسباني/إيطالي',
    ctaLabel: 'أضف للسلة',
    unitPriceLabel: 'تسعير المتر المربع والمشروع',
    orderCode: 'ORD-PHI-738',
    orderSummary: 'تم اعتماد كمية بورسلان كلكتا وجاري شحن الطلب للموقع',
  },
];

const PHONE_NAV_ITEMS = [
  { id: 'home', label: 'المتجر' },
  { id: 'sections', label: 'المواصفات' },
  { id: 'cart', label: 'السلة' },
  { id: 'orders', label: 'طلباتي' },
] as const;

type PhoneTabId = (typeof PHONE_NAV_ITEMS)[number]['id'];

const TIMELINE_LABELS = ['البحث والاختيار', 'التوريد والتركيب', 'مراجعة السلة', 'تأكيد فوري'] as const;

const STEP_DURATION_MS = 4300;

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function PhoneTabIcon({ id }: { id: PhoneTabId }) {
  if (id === 'home') {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    );
  }
  if (id === 'sections') {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (id === 'cart') {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export default function OrderJourneyShowcase({
  onOpenContact,
}: {
  onOpenContact?: () => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0); // 0..11 across 3 sales products × 4 steps
  const [typedLen, setTypedLen] = useState(0);
  const [installChecked, setInstallChecked] = useState(false);
  const [tapping, setTapping] = useState(false);

  const scenarioIdx = Math.floor(frameIndex / 4) % SALES_SCENARIOS.length;
  const step = frameIndex % 4;
  const activeScenario = SALES_SCENARIOS[scenarioIdx];

  // Preload the 3 lightweight local studio images once in browser memory (zero video streaming)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    for (const sc of SALES_SCENARIOS) {
      const img = new window.Image();
      img.src = sc.itemThumb;
    }
  }, []);

  // Run only while visible in viewport
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setInView(entries[0].isIntersecting);
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Automatic synchronized clock
  useEffect(() => {
    if (!inView) return;
    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % (SALES_SCENARIOS.length * 4));
    }, STEP_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [inView]);

  // Synchronized per-frame animation state across Desktop Website + iPhone App
  useEffect(() => {
    if (!inView) return;
    const query = activeScenario.searchQueryText;
    setTapping(false);

    if (step === 0) {
      setTypedLen(0);
      setInstallChecked(false);
      let count = 0;
      const charMs = Math.max(42, Math.floor(1300 / Math.max(1, query.length)));
      const typeTimer = window.setInterval(() => {
        count += 1;
        setTypedLen(count);
        if (count >= query.length) window.clearInterval(typeTimer);
      }, charMs);
      const tapTimer = window.setTimeout(() => setTapping(true), 3450);
      return () => {
        window.clearInterval(typeTimer);
        window.clearTimeout(tapTimer);
      };
    }

    if (step === 1) {
      setTypedLen(query.length);
      setInstallChecked(false);
      const checkTimer = window.setTimeout(() => setInstallChecked(true), 1350);
      const tapTimer = window.setTimeout(() => setTapping(true), 3450);
      return () => {
        window.clearTimeout(checkTimer);
        window.clearTimeout(tapTimer);
      };
    }

    if (step === 2) {
      setInstallChecked(true);
      const tapTimer = window.setTimeout(() => setTapping(true), 3400);
      return () => window.clearTimeout(tapTimer);
    }

    setInstallChecked(true);
    return undefined;
  }, [frameIndex, inView, step, activeScenario.searchQueryText]);

  const typedQuery =
    step === 0 ? activeScenario.searchQueryText.slice(0, typedLen) : activeScenario.searchQueryText;
  const cartCountDisplay = step === 0 ? '0' : step <= 2 ? '1' : '✓';

  return (
    <section
      ref={sectionRef}
      className="pw-sim-section"
      aria-labelledby="order-sim-heading"
    >
      <div className="pw-wrap">
        {/* Compact Executive Header Row */}
        <div className="pw-sim-top-head">
          <div className="pw-sim-head-copy">
            <h2 id="order-sim-heading">
              كيف تطلب في <em>4 خطوات</em> بسيطة؟
            </h2>
            <p className="pw-sim-lead">
              شاهد كيف تختار المنتج، تفعّل التركيب، وتؤكد طلبك من الموقع أو تطبيق الجوال في ثوانٍ.
            </p>
          </div>
          <span className="pw-sim-live-pill">
            <i aria-hidden="true" />
            <span>خطوات الطلب · شرح عملي</span>
          </span>
        </div>

        {/* Synchronized Multi-Column Stage: Side Timeline Panel + Desktop Monitor + Live Sync Bridge + iPhone Pro */}
        <div className="pw-sim-dual-stage">
          {/* Read-only Editorial 4-Step Auto-Play Timeline & Direct CTAs */}
          <div className="pw-sim-narrator-bar" aria-live="polite">
            <div className="pw-sim-timeline-top">
              <div className="pw-sim-narrator-copy">
                <span className="pw-sim-caption-tag">{activeScenario.categoryLabel}</span>
                <strong>{activeScenario.stepTitles[step]}</strong>
                <p>{activeScenario.stepDescs[step]}</p>
              </div>
              <span className="pw-sim-caption-counter" dir="ltr">
                {activeScenario.code} · {scenarioIdx + 1}/{SALES_SCENARIOS.length}
              </span>
            </div>

            <div className="pw-sim-stepper" aria-hidden="true">
              {TIMELINE_LABELS.map((label, idx) => {
                const isDone = step > idx;
                const isActive = step === idx;
                return (
                  <div
                    key={label}
                    className={`pw-sim-step-item ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}
                  >
                    <div className="pw-sim-step-label">
                      <span className="pw-sim-step-num">0{idx + 1}</span>
                      <span>{label}</span>
                    </div>
                    <div className={`pw-sim-seg-track ${isDone ? 'is-done' : ''}`}>
                      {isActive && (
                        <span
                          key={`${scenarioIdx}-${step}`}
                          className={`pw-sim-seg-fill ${inView ? 'is-running' : ''}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pw-sim-foot-actions">
              <Link href="/sections/materials" className="pw-btn pw-btn-primary pw-sim-cta-main">
                ادخل قسم المبيعات والسمارت هوم ←
              </Link>
              <div className="pw-sim-cta-sub">
                <Link href="/store" className="pw-btn pw-btn-ghost pw-btn-sm">
                  تصفح المتجر الكامل
                </Link>
                {onOpenContact && (
                  <button type="button" className="pw-btn pw-btn-ghost pw-btn-sm" onClick={onOpenContact}>
                    تواصل مع مهندس المبيعات
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* A. Desktop Monitor Showing Live Sales Website */}
          <div className="pw-sim-desktop-col" aria-label="عرض متزامن لموقع المبيعات على شاشة الكمبيوتر">
            <div className="pw-sim-monitor">
              <div className="pw-sim-monitor-screen">
                {/* Browser Top Chrome */}
                <div className="pw-sim-chrome">
                  <div className="pw-sim-chrome-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="pw-sim-chrome-url" dir="ltr">
                    <LockIcon />
                    <span>{activeScenario.urls[step]}</span>
                  </div>
                  <span className="pw-sim-chrome-live">
                    <i aria-hidden="true" />
                    <span>متصل</span>
                  </span>
                </div>

                {/* Live PhiTech Website Navigation */}
                <div className="pw-sim-web-nav">
                  <div className="pw-sim-app-brand">
                    <img src="/brand/phitech-mark-color.svg" alt="" width={18} height={18} className="pw-sim-brand-img" />
                    <strong>فاي تك · المبيعات والسمارت هوم</strong>
                  </div>
                  <div className="pw-sim-web-links" aria-hidden="true">
                    <span className={step <= 1 ? 'is-active' : ''}>المنتجات</span>
                    <span>السمارت هوم</span>
                    <span
                      key={`desk-cart-${scenarioIdx}-${step >= 1 ? '1' : '0'}`}
                      className={`pw-sim-cart-pill ${step >= 1 ? 'is-filled is-pop' : ''}`}
                    >
                      <BagIcon />
                      <span>السلة ({cartCountDisplay})</span>
                    </span>
                  </div>
                </div>

                {/* Desktop Website Body Synced to Same Step & Product */}
                <div className="pw-sim-web-body">
                  {step === 0 && (
                    <div key={`dw0-${scenarioIdx}`} className="pw-sim-screen is-web">
                      <div className="pw-sim-search-fake">
                        <SearchIcon />
                        <span className="pw-sim-typed">
                          {typedQuery}
                          <span className="pw-sim-caret" aria-hidden="true" />
                        </span>
                      </div>

                      <div className="pw-sim-web-grid">
                        <div className="pw-sim-web-card is-target">
                          <img src={activeScenario.itemThumb} alt="" width={220} height={135} />
                          <div className="pw-sim-web-card-copy">
                            <span className="pw-sim-tag">{activeScenario.code}</span>
                            <strong>{activeScenario.itemTitle}</strong>
                            <small>{activeScenario.itemSubtitle}</small>
                            <span className={`pw-sim-mini-btn ${tapping ? 'is-pressed' : ''}`}>
                              اطلب الآن ←
                            </span>
                          </div>
                        </div>

                        <div className="pw-sim-web-card is-secondary" aria-hidden="true">
                          <div className="pw-sim-web-card-copy">
                            <span className="pw-sim-tag is-dim">{activeScenario.companionCode}</span>
                            <strong>{activeScenario.companionTitle}</strong>
                            <small>متوفر للتوريد مع الشحن السريع</small>
                            <span className="pw-sim-mini-btn is-dim">عرض المنتج</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div key={`dw1-${scenarioIdx}`} className="pw-sim-screen is-web">
                      <div className="pw-sim-web-detail">
                        <img
                          src={activeScenario.itemThumb}
                          alt=""
                          width={240}
                          height={180}
                          className="pw-sim-web-detail-img"
                        />
                        <div className="pw-sim-web-detail-info">
                          <span className="pw-sim-tag">{activeScenario.optionBadge}</span>
                          <strong>{activeScenario.itemTitle}</strong>
                          <small>{activeScenario.itemSubtitle}</small>
                          <div
                            className={`pw-sim-spec-check ${
                              installChecked ? 'is-checked' : 'is-pending'
                            }`}
                          >
                            <span className="pw-sim-check-on">{installChecked ? '✓' : '○'}</span>
                            <span>{activeScenario.specLabel}</span>
                          </div>
                          <div className="pw-sim-web-detail-actions">
                            <div className="pw-sim-qty-pill" dir="ltr">
                              <span>−</span>
                              <strong>1</strong>
                              <span>+</span>
                            </div>
                            <div className={`pw-sim-action-btn ${tapping ? 'is-pressed' : ''}`}>
                              {activeScenario.ctaLabel}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div key={`dw2-${scenarioIdx}`} className="pw-sim-screen is-web">
                      <div className="pw-sim-web-checkout">
                        <div className="pw-sim-checkout-head">
                          <strong>سلة المبيعات وإتمام الطلب</strong>
                          <span className="pw-sim-tag">{activeScenario.unitPriceLabel}</span>
                        </div>
                        <div className="pw-sim-web-checkout-cols">
                          <div className="pw-sim-checkout-row">
                            <img src={activeScenario.itemThumb} alt="" width={68} height={52} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong>{activeScenario.itemTitle}</strong>
                              <small>{activeScenario.specLabel}</small>
                            </div>
                            <span className="pw-sim-qty">×1</span>
                          </div>
                          <div className="pw-sim-customer-box">
                            <div>
                              <strong>م. أحمد · 010•••••482</strong>
                              <small>القاهرة الجديدة · تأكيد قبل التوريد</small>
                            </div>
                            <span className="pw-sim-verified-pill">مؤكد ✓</span>
                          </div>
                        </div>
                        <div className={`pw-sim-action-btn is-confirm ${tapping ? 'is-pressed' : ''}`}>
                          ✓ تأكيد وإرسال الأوردر الآن
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div key={`dw3-${scenarioIdx}`} className="pw-sim-screen is-web">
                      <div className="pw-sim-success-card is-desktop">
                        <div className="pw-sim-success-icon">✓</div>
                        <strong>تم تسجيل طلب المبيعات ومزامنته مع التطبيق!</strong>
                        <span className="pw-sim-order-code" dir="ltr">
                          #{activeScenario.orderCode}
                        </span>
                        <p>{activeScenario.orderSummary}</p>
                        <div className="pw-sim-tracker">
                          <span className="is-done">تأكيد الأوردر ✓</span>
                          <span className="is-done">تجهيز المخزن ✓</span>
                          <span className="is-now">التوريد والتركيب ●</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Animated Desktop Mouse Arrow Cursor */}
                  <div
                    className={`pw-sim-cursor is-pos-${step} ${tapping ? 'is-clicking' : ''}`}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22">
                      <path
                        d="M5 3l14 9-6.2 1.6L16 20l-2.6 1.2-3.2-6.4L5 18z"
                        fill="#ffffff"
                        stroke="#c75517"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Realistic Metallic Monitor Stand */}
            <div className="pw-sim-stand" aria-hidden="true">
              <div className="pw-sim-stand-neck" />
              <div className="pw-sim-stand-base" />
            </div>
          </div>

          {/* Live Sync Bridge Between Desktop Monitor & iPhone Pro */}
          <div className="pw-sim-sync-bridge" aria-hidden="true">
            <span className="pw-sim-sync-line" />
            <div className={`pw-sim-sync-node ${tapping || step === 3 ? 'is-pulsing' : ''}`}>
              <SyncIcon />
            </div>
            <span className="pw-sim-sync-label">تزامن لحظي</span>
          </div>

          {/* B. Slender Realistic iPhone Pro + iOS & Android Store Badges */}
          <div className="pw-sim-iphone-col" aria-label="عرض متزامن لتطبيق المبيعات على الآيفون">
            <div className="pw-sim-phone">
              <span className="pw-sim-hw-action" aria-hidden="true" />
              <span className="pw-sim-hw-vol-1" aria-hidden="true" />
              <span className="pw-sim-hw-vol-2" aria-hidden="true" />
              <span className="pw-sim-hw-pwr" aria-hidden="true" />

              <div className="pw-sim-phone-inner">
                {/* iPhone Status Bar + Dynamic Island */}
                <div className="pw-sim-status-bar" dir="ltr">
                  <span className="pw-sim-time">9:41</span>
                  <div className="pw-sim-island" aria-hidden="true">
                    <span className="pw-sim-island-cam" />
                  </div>
                  <div className="pw-sim-signal">
                    <svg viewBox="0 0 16 12" width="12" height="9" fill="currentColor" aria-hidden="true">
                      <rect x="0" y="7" width="2.5" height="4" rx="0.8" />
                      <rect x="4" y="5" width="2.5" height="6" rx="0.8" />
                      <rect x="8" y="3" width="2.5" height="8" rx="0.8" />
                      <rect x="12" y="1" width="2.5" height="10" rx="0.8" />
                    </svg>
                    <svg viewBox="0 0 16 12" width="12" height="9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                      <path d="M1.5 4.2a9.5 9.5 0 0 1 13 0" />
                      <path d="M4.2 7a5.6 5.6 0 0 1 7.6 0" />
                      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    <span className="pw-sim-battery" aria-hidden="true">
                      <span />
                    </span>
                  </div>
                </div>

                {/* Synced App Bar */}
                <div className="pw-sim-app-top">
                  <div className="pw-sim-app-brand">
                    <img src="/brand/phitech-mark-color.svg" alt="" width={18} height={18} className="pw-sim-brand-img" />
                    <strong>فاي تك</strong>
                  </div>
                  <span
                    key={`mob-cart-${scenarioIdx}-${step >= 1 ? '1' : '0'}`}
                    className={`pw-sim-cart-pill ${step >= 1 ? 'is-filled is-pop' : ''}`}
                  >
                    <BagIcon />
                    <span>{cartCountDisplay}</span>
                  </span>
                </div>

                {/* Live Synced iPhone App Screen */}
                <div className="pw-sim-ui">
                  {step === 0 && (
                    <div key={`m0-${scenarioIdx}`} className="pw-sim-screen">
                      <div className="pw-sim-search-fake is-compact">
                        <SearchIcon />
                        <span className="pw-sim-typed">
                          {typedQuery}
                          <span className="pw-sim-caret" aria-hidden="true" />
                        </span>
                      </div>

                      <div className="pw-sim-phone-card">
                        <div className="pw-sim-phone-card-media">
                          <img src={activeScenario.itemThumb} alt="" width={220} height={116} />
                          <span className="pw-sim-tag is-overlay">{activeScenario.code}</span>
                        </div>
                        <div className="pw-sim-phone-card-body">
                          <strong>{activeScenario.itemTitle}</strong>
                          <div className="pw-sim-phone-card-foot">
                            <span className="pw-sim-mini-badge">{activeScenario.optionBadge}</span>
                            <span className={`pw-sim-mini-btn ${tapping ? 'is-pressed' : ''}`}>
                              اطلب الآن ←
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div key={`m1-${scenarioIdx}`} className="pw-sim-screen">
                      <div className="pw-sim-detail-box">
                        <img
                          src={activeScenario.itemThumb}
                          alt=""
                          width={220}
                          height={98}
                          className="pw-sim-detail-img"
                        />
                        <div className="pw-sim-detail-meta">
                          <strong>{activeScenario.itemTitle}</strong>
                          <div
                            className={`pw-sim-spec-check ${
                              installChecked ? 'is-checked' : 'is-pending'
                            }`}
                          >
                            <span className="pw-sim-check-on">{installChecked ? '✓' : '○'}</span>
                            <span>{activeScenario.specLabel}</span>
                          </div>
                          <div className={`pw-sim-action-btn ${tapping ? 'is-pressed' : ''}`}>
                            {activeScenario.ctaLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div key={`m2-${scenarioIdx}`} className="pw-sim-screen">
                      <div className="pw-sim-checkout-card">
                        <div className="pw-sim-checkout-row">
                          <img src={activeScenario.itemThumb} alt="" width={44} height={34} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{activeScenario.itemTitle}</strong>
                            <small>{activeScenario.specLabel}</small>
                          </div>
                          <span className="pw-sim-qty">×1</span>
                        </div>
                        <div className="pw-sim-customer-box">
                          <div>
                            <strong>م. أحمد · 010•••••482</strong>
                            <small>القاهرة الجديدة</small>
                          </div>
                          <span className="pw-sim-verified-pill">✓</span>
                        </div>
                        <div className={`pw-sim-action-btn is-confirm ${tapping ? 'is-pressed' : ''}`}>
                          ✓ تأكيد الأوردر الآن
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div key={`m3-${scenarioIdx}`} className="pw-sim-screen">
                      <div className="pw-sim-success-card is-compact">
                        <div className="pw-sim-success-icon">✓</div>
                        <strong>تم تسجيل الأوردر!</strong>
                        <span className="pw-sim-order-code" dir="ltr">
                          #{activeScenario.orderCode}
                        </span>
                        <div className="pw-sim-tracker">
                          <span className="is-done">تأكيد ✓</span>
                          <span className="is-now">تجهيز ●</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Synced iPhone Touch Ripple */}
                  <div
                    className={`pw-sim-touch is-pos-${step} ${tapping ? 'is-tapping' : ''}`}
                    aria-hidden="true"
                  />
                </div>

                {/* Bottom App Tab Bar */}
                <div className="pw-sim-bottom-nav" aria-hidden="true">
                  {PHONE_NAV_ITEMS.map((nav) => {
                    const active =
                      (step === 0 && nav.id === 'home') ||
                      (step === 1 && nav.id === 'sections') ||
                      (step === 2 && nav.id === 'cart') ||
                      (step === 3 && nav.id === 'orders');
                    return (
                      <div key={nav.id} className={`pw-sim-tab-item ${active ? 'is-on' : ''}`}>
                        <PhoneTabIcon id={nav.id} />
                        <span>{nav.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="pw-sim-phone-homebar" aria-hidden="true" />
              </div>
            </div>

            {/* Official Vector App Store (iOS) & Google Play (Android) Store Badges */}
            <div className="pw-sim-store-badges" aria-label="متاح على متجري iOS و Android">
              <div className="pw-sim-store-badge">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
                  />
                </svg>
                <div dir="ltr">
                  <small>iOS</small>
                  <strong>App Store</strong>
                </div>
              </div>

              <div className="pw-sim-store-badge">
                <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
                  <path
                    fill="#34A853"
                    d="M3.61 1.814L13.793 12 3.61 22.186a1.75 1.75 0 0 1-.46-1.19V3.004c0-.452.172-.877.46-1.19z"
                  />
                  <path
                    fill="#FBBC04"
                    d="M17.204 15.411L13.793 12l3.411-3.411 3.854 2.192c1.1.626 1.1 1.812 0 2.438l-3.854 2.192z"
                  />
                  <path
                    fill="#EA4335"
                    d="M17.204 15.411L13.793 12 3.61 22.186c.385.398.983.504 1.622.14l11.972-6.915z"
                  />
                  <path
                    fill="#4285F4"
                    d="M17.204 8.589L5.232 1.674c-.639-.364-1.237-.258-1.622.14L13.793 12l3.411-3.411z"
                  />
                </svg>
                <div dir="ltr">
                  <small>Android</small>
                  <strong>Google Play</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
