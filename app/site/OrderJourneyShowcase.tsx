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
      'يحدد خيار التوريد مع البرمجة والتركيب الهندسي وتُضاف القطعة للسلة لحظياً.',
      'يراجع ملخص السلة ورقم الجوال للتأكيد قبل الشحن والتركيب بضغطة واحدة.',
      'يصدر رقم الأوردر الموثق فوراً وتبدأ متابعة التوصيل والتركيب في نفس الوقت.',
    ],
    itemTitle: 'قفل باب ذكي 6×1 بالكاميرا والبصمة',
    itemSubtitle: 'كاميرا عين سحرية + بصمة إصبع ووجه + تحكم من الجوال',
    itemThumb: '/products/smart-door-lock.webp',
    companionTitle: 'شاشة تحكم سمارت هوم 4 بوصة',
    companionCode: 'SM-01',
    specLabel: 'توريد + برمجة وتركيب هندسي معتمد',
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
      'يضيف البورسلان قص الليزر للسلة مع خيار التركيب الهندسي بالليزر.',
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
];

const STEP_DURATION_MS = 4300;

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
        {/* Compact Header + Live Narrator Strip */}
        <div className="pw-sim-top-head">
          <span className="pw-sim-live-pill">
            <i aria-hidden="true" />
            <span>عرض متزامن لقسم المبيعات والسمارت هوم · الكمبيوتر والآيفون</span>
          </span>
          <h2 id="order-sim-heading">كل طلب في قسم المبيعات يتم باللحظة نفسها على الموقع وتطبيق الآيفون</h2>
          <p className="pw-sim-lead">
            ما يُنفَّذ داخل المتجر الإلكتروني على الكمبيوتر ينعكس فوراً داخل تطبيق الجوال لنظامَي iOS وAndroid دون انتظار.
          </p>
        </div>

        {/* Read-only Live Narrator Bar (No manual buttons) */}
        <div className="pw-sim-narrator-bar" aria-live="polite">
          <div className="pw-sim-narrator-copy">
            <span className="pw-sim-caption-tag">{activeScenario.categoryLabel}</span>
            <strong>{activeScenario.stepTitles[step]}</strong>
            <p>{activeScenario.stepDescs[step]}</p>
          </div>
          <div className="pw-sim-narrator-right">
            <span className="pw-sim-caption-counter">
              منتج {scenarioIdx + 1} من {SALES_SCENARIOS.length} · {activeScenario.code}
            </span>
            <div className="pw-sim-progress-segs" aria-hidden="true">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`pw-sim-seg-track ${step > idx ? 'is-done' : ''}`}
                >
                  {step === idx && (
                    <span
                      key={`${scenarioIdx}-${step}`}
                      className={`pw-sim-seg-fill ${inView ? 'is-running' : ''}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Synchronized Dual-Device Stage: Desktop Monitor + Website + iPhone Pro + iOS/Android Badges */}
        <div className="pw-sim-dual-stage">
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
                    <span>🔒</span>
                    <span>{activeScenario.urls[step]}</span>
                  </div>
                  <span className="pw-sim-chrome-badge">الويب سايت</span>
                </div>

                {/* Live PhiTech Website Navigation */}
                <div className="pw-sim-web-nav">
                  <div className="pw-sim-app-brand">
                    <span className="pw-sim-dot-logo" />
                    <strong>فاي تك · المبيعات والسمارت هوم</strong>
                  </div>
                  <div className="pw-sim-web-links" aria-hidden="true">
                    <span className={step <= 1 ? 'is-active' : ''}>المنتجات</span>
                    <span>السمارت هوم</span>
                    <span
                      key={`desk-cart-${scenarioIdx}-${step >= 1 ? '1' : '0'}`}
                      className={`pw-sim-cart-pill ${step >= 1 ? 'is-filled is-pop' : ''}`}
                    >
                      🛒 السلة ({cartCountDisplay})
                    </span>
                  </div>
                </div>

                {/* Desktop Website Body Synced to Same Step & Product */}
                <div className="pw-sim-web-body">
                  {step === 0 && (
                    <div key={`dw0-${scenarioIdx}`} className="pw-sim-screen is-web">
                      <div className="pw-sim-search-fake">
                        <span aria-hidden="true">🔍</span>
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
                    <span>5G</span>
                    <span className="pw-sim-battery" aria-hidden="true">
                      <span />
                    </span>
                  </div>
                </div>

                {/* Synced App Bar */}
                <div className="pw-sim-app-top">
                  <div className="pw-sim-app-brand">
                    <span className="pw-sim-dot-logo" />
                    <strong>فاي تك</strong>
                  </div>
                  <span
                    key={`mob-cart-${scenarioIdx}-${step >= 1 ? '1' : '0'}`}
                    className={`pw-sim-cart-pill ${step >= 1 ? 'is-filled is-pop' : ''}`}
                  >
                    🛒 {cartCountDisplay}
                  </span>
                </div>

                {/* Live Synced iPhone App Screen */}
                <div className="pw-sim-ui">
                  {step === 0 && (
                    <div key={`m0-${scenarioIdx}`} className="pw-sim-screen">
                      <div className="pw-sim-search-fake is-compact">
                        <span aria-hidden="true">🔍</span>
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
                      <span key={nav.id} className={active ? 'is-on' : ''}>
                        {nav.label}
                      </span>
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

        {/* Bottom Actions */}
        <div className="pw-sim-foot-actions">
          <Link href="/sections/materials" className="pw-btn pw-btn-primary">
            ادخل قسم المبيعات والسمارت هوم ←
          </Link>
          <Link href="/store" className="pw-btn pw-btn-light">
            تصفح المتجر الكامل
          </Link>
          {onOpenContact && (
            <button type="button" className="pw-btn pw-btn-light" onClick={onOpenContact}>
              تواصل مع مهندس المبيعات
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
