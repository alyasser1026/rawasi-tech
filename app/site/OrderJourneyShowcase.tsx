"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface SimScenario {
  id: 'store' | 'contracting' | 'maintenance';
  shortTag: string;
  sectionHref: string;
  searchQueryText: string;
  stepTitles: [string, string, string, string];
  stepDescs: [string, string, string, string];
  itemTitle: string;
  itemSubtitle: string;
  itemThumb: string;
  itemCode: string;
  specLabel: string;
  optionBadge: string;
  ctaLabel: string;
  cartTotalLabel: string;
  orderCode: string;
  orderSummary: string;
}

const SIM_SCENARIOS: SimScenario[] = [
  {
    id: 'store',
    shortTag: '🛒 منتجات وسمارت هوم',
    sectionHref: '/store',
    searchQueryText: 'قفل باب ذكي 6×1',
    stepTitles: [
      '01 · يبحث العميل عن المنتج',
      '02 · يفعّل التركيب ويضيف للسلة',
      '03 · يراجع البيانات ويؤكد الطلب',
      '04 · يتم تسجيل الأوردر وتوجيه الفني',
    ],
    stepDescs: [
      'يكتب اسم المنتج في البحث داخل التطبيق لتظهر البطاقة والمواصفات فوراً.',
      'يختار التوريد مع التركيب الهندسي المعتمد ويضغط أضف للسلة.',
      'يراجع الملخص ورقم الجوال وتأكيد المعاينة قبل التوريد بضغطة واحدة.',
      'يصدر رقم الأوردر آلياً وتبدأ متابعة التوصيل والتركيب في الموعد.',
    ],
    itemTitle: 'قفل باب ذكي 6×1 بالكاميرا والبصمة',
    itemSubtitle: 'توريد معتمد + برمجة وتركيب هندسي على الباب',
    itemThumb: '/products/smart-door-lock.webp',
    itemCode: 'SM-02',
    specLabel: 'توريد + تركيب هندسي معتمد',
    optionBadge: 'ضمان 3 سنوات',
    ctaLabel: '🛒 أضف للسلة',
    cartTotalLabel: 'شامل التوريد والبرمجة',
    orderCode: 'ORD-PHI-842',
    orderSummary: 'تم استلام طلب القفل الذكي وجاري تنسيق موعد الفني للتركيب',
  },
  {
    id: 'contracting',
    shortTag: '🏗️ مقايسة ومقاولات 3×1',
    sectionHref: '/sections/contracting',
    searchQueryText: 'مقايسة فيلا 350 م²',
    stepTitles: [
      '01 · يفتح حاسبة المقاولات 3×1',
      '02 · يضبط المساحة وبنود التنفيذ',
      '03 · يراجع المقايسة وخصم التكامل 7%',
      '04 · اعتماد الرفع المساحي بالليزر',
    ],
    stepDescs: [
      'يدخل على قسم المقاولات والتنفيذ لحساب مشروع البناء أو التشطيب.',
      'يفعّل نطاق العظم والتشطيب والتكييف المخفي لفيلا 350 م² في خطوة واحدة.',
      'يظهر التقدير الموحد للكميات وتوفير 7% قبل اعتماد الطلب.',
      'تصدر تذكرة المعاينة الهندسية ويصل المهندس بالأجهزة للموقع.',
    ],
    itemTitle: 'مقايسة متكاملة 3×1 — فيلا سكنية',
    itemSubtitle: 'إنشاءات + تشطيب ديلوكس + تكييف مخفي بجهة واحدة',
    itemThumb: '/sections/contracting.jpg',
    itemCode: 'PRJ-3X1',
    specLabel: '700 م² مسطح بنائي · 3 نطاقات',
    optionBadge: 'خصم تكامل 7% مفعّل',
    ctaLabel: '📐 اعتماد المقايسة',
    cartTotalLabel: 'مقايسة هندسية معتمدة',
    orderCode: 'ENG-PHI-319',
    orderSummary: 'تم جدولة الرفع المساحي بالليزر وإعداد خطة التنفيذ',
  },
  {
    id: 'maintenance',
    shortTag: '🛠️ صيانة وتنفيذ هندسي',
    sectionHref: '/sections/contracting?tab=maintenance',
    searchQueryText: 'تكييف مخفي وكشف تسريب',
    stepTitles: [
      '01 · يحدد تخصص الصيانة المطلوب',
      '02 · يختار الفحص بالأجهزة والضمان',
      '03 · يراجع الموعد ويرسل التذكرة',
      '04 · توجيه الفريق المختص للموقع',
    ],
    stepDescs: [
      'يبحث عن صيانة التكييف المخفي أو كشف التسريب بدون تكسير.',
      'يفعّل بند التنفيذ والصيانة المضمونة ويضيفه لسلة المعاينة.',
      'يؤكد الموعد المناسب وتصل التذكرة لقسم التشغيل خلال ثوانٍ.',
      'يتابع حالة الفني على الجوال حتى استلام العمل بشهادة ضمان.',
    ],
    itemTitle: 'كشف تسريب بالموجات + صيانة تكييف مخفي',
    itemSubtitle: 'فحص بالأجهزة بدون تكسير وتقرير حالة كامل',
    itemThumb: '/products/safety-shutoff-valve.webp',
    itemCode: 'MNT-HVAC',
    specLabel: 'غداً · 11:00 صباحاً',
    optionBadge: 'بدون تكسير · بضمان',
    ctaLabel: '📅 أضف تذكرة المعاينة',
    cartTotalLabel: 'تذكرة صيانة سريعة',
    orderCode: 'MNT-PHI-507',
    orderSummary: 'تم تعيين المهندس المختص والتوجه في الموعد المحدد',
  },
];

const PHONE_NAV_ITEMS = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'sections', label: 'الأقسام' },
  { id: 'cart', label: 'السلة' },
  { id: 'orders', label: 'طلباتي' },
];

const STEP_DURATION_MS = 3200;

export default function OrderJourneyShowcase({
  onOpenContact,
}: {
  onOpenContact?: () => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0); // 0..11 across 3 scenarios × 4 steps
  const [typedLen, setTypedLen] = useState(0);
  const [installChecked, setInstallChecked] = useState(false);
  const [tapping, setTapping] = useState(false);

  const scenarioIdx = Math.floor(frameIndex / 4) % SIM_SCENARIOS.length;
  const step = frameIndex % 4;
  const activeScenario = SIM_SCENARIOS[scenarioIdx];

  // Cache the 3 lightweight local images once in browser memory (zero video streaming)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    for (const sc of SIM_SCENARIOS) {
      const img = new window.Image();
      img.src = sc.itemThumb;
    }
  }, []);

  // Play only while visible in viewport to save battery/CPU
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setInView(entries[0].isIntersecting);
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Automatic video-like frame clock (no buttons needed)
  useEffect(() => {
    if (!inView) return;
    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % (SIM_SCENARIOS.length * 4));
    }, STEP_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [inView]);

  // Per-frame realistic in-app motion (typewriter, auto-toggle, finger tap burst)
  useEffect(() => {
    if (!inView) return;
    const query = activeScenario.searchQueryText;
    setTapping(false);

    if (step === 0) {
      setTypedLen(0);
      setInstallChecked(false);
      let count = 0;
      const charMs = Math.max(38, Math.floor(1100 / Math.max(1, query.length)));
      const typeTimer = window.setInterval(() => {
        count += 1;
        setTypedLen(count);
        if (count >= query.length) window.clearInterval(typeTimer);
      }, charMs);
      const tapTimer = window.setTimeout(() => setTapping(true), 2450);
      return () => {
        window.clearInterval(typeTimer);
        window.clearTimeout(tapTimer);
      };
    }

    if (step === 1) {
      setTypedLen(query.length);
      setInstallChecked(false);
      const checkTimer = window.setTimeout(() => setInstallChecked(true), 950);
      const tapTimer = window.setTimeout(() => setTapping(true), 2450);
      return () => {
        window.clearTimeout(checkTimer);
        window.clearTimeout(tapTimer);
      };
    }

    if (step === 2) {
      setInstallChecked(true);
      const tapTimer = window.setTimeout(() => setTapping(true), 2400);
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
        <div className="pw-sim-layout">
          {/* Right Column (RTL): Live Video Caption & CTA */}
          <div className="pw-sim-info">
            <div className="pw-sim-head-copy">
              <span className="pw-sim-live-pill">
                <i aria-hidden="true" />
                <span>عرض تلقائي مباشر · تحميل لمرة واحدة</span>
              </span>
              <h2 id="order-sim-heading">شاهد كيف يُنفَّذ الطلب من الجوال في ثوانٍ</h2>
              <p className="pw-sim-lead">
                تجربة طلب كاملة تعمل تلقائياً أمامك خطوة بخطوة داخل شاشة الجوال — من البحث حتى تأكيد الأوردر وتوجيه المهندس.
              </p>
            </div>

            {/* Read-only Live Narrator Card (purely visual, zero buttons) */}
            <div className="pw-sim-caption-card" aria-live="polite">
              <div className="pw-sim-caption-meta">
                <span className="pw-sim-caption-tag">{activeScenario.shortTag}</span>
                <span className="pw-sim-caption-counter">
                  نموذج {scenarioIdx + 1} من {SIM_SCENARIOS.length}
                </span>
              </div>

              <h3>{activeScenario.stepTitles[step]}</h3>
              <p>{activeScenario.stepDescs[step]}</p>

              <div className="pw-sim-caption-dots" aria-hidden="true">
                {[0, 1, 2, 3].map((dotIdx) => (
                  <span
                    key={dotIdx}
                    className={step === dotIdx ? 'is-on' : step > dotIdx ? 'is-passed' : ''}
                  />
                ))}
              </div>
            </div>

            <div className="pw-sim-foot-actions">
              <Link href={activeScenario.sectionHref} className="pw-btn pw-btn-primary">
                ابدأ تنفيذ طلبك الآن ←
              </Link>
              {onOpenContact && (
                <button type="button" className="pw-btn pw-btn-light" onClick={onOpenContact}>
                  💬 تواصل مع مهندس المبيعات
                </button>
              )}
            </div>
          </div>

          {/* Left Column (RTL): Centerpiece Auto-Playing Smartphone Frame */}
          <div className="pw-sim-phone-wrap" aria-label="عرض تلقائي لتنفيذ الطلب داخل شاشة الجوال">
            <div className="pw-sim-phone">
              <span className="pw-sim-hw-vol-1" aria-hidden="true" />
              <span className="pw-sim-hw-vol-2" aria-hidden="true" />
              <span className="pw-sim-hw-pwr" aria-hidden="true" />

              <div className="pw-sim-phone-inner">
                {/* Status Bar + Dynamic Island */}
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

                {/* Video Reel Timeline Progress Bar */}
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

                {/* App Top Bar */}
                <div className="pw-sim-app-top">
                  <div className="pw-sim-app-brand">
                    <span className="pw-sim-dot-logo" />
                    <strong>فاي تك</strong>
                  </div>
                  <span
                    key={`${scenarioIdx}-${step >= 1 ? 'in' : 'empty'}`}
                    className={`pw-sim-cart-pill ${step >= 1 ? 'is-filled is-pop' : ''}`}
                  >
                    🛒 {cartCountDisplay}
                  </span>
                </div>

                {/* Live Animated Phone Screen Viewport */}
                <div className="pw-sim-ui">
                  {step === 0 && (
                    <div key={`s0-${scenarioIdx}`} className="pw-sim-screen is-step-0">
                      <div className="pw-sim-search-fake">
                        <span aria-hidden="true">🔍</span>
                        <span className="pw-sim-typed">
                          {typedQuery}
                          <span className="pw-sim-caret" aria-hidden="true" />
                        </span>
                      </div>

                      <div className="pw-sim-phone-card is-target">
                        <div className="pw-sim-phone-card-media">
                          <img src={activeScenario.itemThumb} alt="" width={260} height={140} />
                          <span className="pw-sim-tag is-overlay">{activeScenario.itemCode}</span>
                        </div>
                        <div className="pw-sim-phone-card-body">
                          <strong>{activeScenario.itemTitle}</strong>
                          <small>{activeScenario.itemSubtitle}</small>
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
                    <div key={`s1-${scenarioIdx}`} className="pw-sim-screen is-step-1">
                      <div className="pw-sim-detail-box">
                        <img
                          src={activeScenario.itemThumb}
                          alt=""
                          width={260}
                          height={130}
                          className="pw-sim-detail-img"
                        />
                        <div className="pw-sim-detail-meta">
                          <span className="pw-sim-tag">{activeScenario.optionBadge}</span>
                          <strong>{activeScenario.itemTitle}</strong>
                          <div
                            className={`pw-sim-spec-check ${
                              installChecked ? 'is-checked' : 'is-pending'
                            }`}
                          >
                            <span className="pw-sim-check-on">{installChecked ? '✓' : '○'}</span>
                            <span>{activeScenario.specLabel}</span>
                          </div>
                          <div className="pw-sim-qty-row">
                            <span>الكمية المطلوبة</span>
                            <div className="pw-sim-qty-pill" dir="ltr">
                              <span>−</span>
                              <strong>1</strong>
                              <span>+</span>
                            </div>
                          </div>
                          <div className={`pw-sim-action-btn ${tapping ? 'is-pressed' : ''}`}>
                            {activeScenario.ctaLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div key={`s2-${scenarioIdx}`} className="pw-sim-screen is-step-2">
                      <div className="pw-sim-checkout-card">
                        <div className="pw-sim-checkout-head">
                          <strong>مراجعة الأوردر وتأكيده</strong>
                          <span className="pw-sim-tag">{activeScenario.cartTotalLabel}</span>
                        </div>

                        <div className="pw-sim-checkout-row">
                          <img src={activeScenario.itemThumb} alt="" width={54} height={42} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{activeScenario.itemTitle}</strong>
                            <small>{activeScenario.specLabel}</small>
                          </div>
                          <span className="pw-sim-qty">×1</span>
                        </div>

                        <div className="pw-sim-customer-box">
                          <div>
                            <strong>👤 م. أحمد · 010•••••482</strong>
                            <small>📍 القاهرة الجديدة · تأكيد مجاني قبل التوريد</small>
                          </div>
                          <span className="pw-sim-verified-pill">جاهز ✓</span>
                        </div>

                        <div
                          className={`pw-sim-action-btn is-confirm ${tapping ? 'is-pressed' : ''}`}
                        >
                          ✓ تأكيد وإرسال الأوردر الآن
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div key={`s3-${scenarioIdx}`} className="pw-sim-screen is-step-3">
                      <div className="pw-sim-success-card">
                        <div className="pw-sim-success-icon">✓</div>
                        <strong>تم تسجيل الأوردر بنجاح!</strong>
                        <span className="pw-sim-order-code" dir="ltr">
                          #{activeScenario.orderCode}
                        </span>
                        <p>{activeScenario.orderSummary}</p>
                        <div className="pw-sim-tracker">
                          <span className="is-done">استلام ✓</span>
                          <span className="is-done">تجهيز ✓</span>
                          <span className="is-now">الفني في الطريق ●</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Simulated Finger Tap Indicator */}
                  <div
                    className={`pw-sim-touch is-pos-${step} ${tapping ? 'is-tapping' : ''}`}
                    aria-hidden="true"
                  />
                </div>

                {/* Bottom App Bar */}
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
          </div>
        </div>
      </div>
    </section>
  );
}
