"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type SimScenarioId = 'store' | 'contracting' | 'maintenance';

interface SimScenario {
  id: SimScenarioId;
  tabLabel: string;
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
    tabLabel: '🛒 منتجات وسمارت هوم',
    sectionHref: '/store',
    searchQueryText: 'قفل باب ذكي 6×1...',
    stepTitles: [
      'ابحث عن المنتج من الجوال',
      'اختَر المواصفة وخيار التركيب',
      'أكّد بيانات الطلب وأرسله',
      'استلم رقم الأوردر ومتابعة الفني',
    ],
    stepDescs: [
      'العميل يكتب "قفل ذكي" ويظهر المنتج مع صورة الاستوديو فوراً.',
      'يفعّل خيار التوريد + التركيب الهندسي المعتمد ويضيفه للسلة.',
      'يراجع ملخص السلة ورقم الجوال للتأكيد قبل التوريد بضغطة واحدة.',
      'يتسجل الأوردر في النظام فوراً وتبدأ متابعة التوصيل والتركيب.',
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
    tabLabel: '🏗️ مقايسة 3×1',
    sectionHref: '/sections/contracting',
    searchQueryText: 'مقايسة فيلا 350 م²...',
    stepTitles: [
      'افتح حاسبة المقاولات 3×1',
      'حدد المساحة ونطاق التنفيذ',
      'راجع المقايسة وخصم التكامل 7%',
      'تأكيد موعد الرفع المساحي بالليزر',
    ],
    stepDescs: [
      'يدخل العميل على قسم المقاولات والتنفيذ من هاتفه بسهولة.',
      'يختار المساحة (فيلا 350 م² × دورين) وبنود العظم والتشطيب والتكييف.',
      'يظهر إجمالي التقدير الهندسي وتفصيل المواد قبل اعتماد الحجز.',
      'يصل إشعار للمهندس المختص وتصدر تذكرة المعاينة الميدانية.',
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
    tabLabel: '🛠️ صيانة وتنفيذ',
    sectionHref: '/sections/contracting?tab=maintenance',
    searchQueryText: 'تكييف مخفي وسباكة...',
    stepTitles: [
      'اختر تخصص الصيانة أو التأسيس',
      'حدد تفاصيل العطل والموعد المناسب',
      'راجع تكلفة المعاينة وتأكيد العنوان',
      'إرسال الفريق المجهز بشهادة ضمان',
    ],
    stepDescs: [
      'يختار العميل كشف تسريب بالموجات أو تأسيس وصيانة التكييف المخفي.',
      'يحدد الوقت المناسب ونوع البند المطلوب بدون مكالمات مطولة.',
      'يضغط تأكيد وإرسال الأوردر ليصل للفريق التشغيلي في ثوانٍ.',
      'يتابع حالة الطلب لحظياً حتى التسليم واختبار الجودة بالضمان.',
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

export default function OrderJourneyShowcase({
  onOpenContact,
}: {
  onOpenContact?: () => void;
}) {
  const [scenarioId, setScenarioId] = useState<SimScenarioId>('store');
  const [step, setStep] = useState<number>(0);
  const [paused, setPaused] = useState(false);

  const activeScenario = SIM_SCENARIOS.find((s) => s.id === scenarioId) || SIM_SCENARIOS[0];

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 3100);
    return () => window.clearInterval(timer);
  }, [paused, scenarioId]);

  const handleSelectScenario = (id: SimScenarioId) => {
    setScenarioId(id);
    setStep(0);
  };

  return (
    <section
      className="pw-sim-section"
      aria-labelledby="order-sim-heading"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="pw-wrap">
        <div className="pw-sim-layout">
          {/* Right Column (RTL): Scenario Controls + Interactive 4-Step List */}
          <div className="pw-sim-info">
            <div className="pw-sim-head-copy">
              <p className="pw-eyebrow">محاكاة حية لطلب أونلاين</p>
              <h2 id="order-sim-heading">شاهد كيف يُنفَّذ الطلب من الجوال في ثوانٍ</h2>
              <p className="pw-sim-lead">
                اختر نوع الطلب وشاهد رحلة العميل كاملة داخل إطار الجوال من البحث حتى استلام رقم الأوردر وتوجيه المهندس.
              </p>
            </div>

            <div className="pw-sim-scenario-tabs" role="tablist" aria-label="سيناريوهات الطلب">
              {SIM_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  role="tab"
                  aria-selected={scenarioId === sc.id}
                  className={`pw-sim-tab ${scenarioId === sc.id ? 'is-on' : ''}`}
                  onClick={() => handleSelectScenario(sc.id)}
                >
                  {sc.tabLabel}
                </button>
              ))}
            </div>

            <div className="pw-sim-step-list" role="list" aria-label="خطوات تنفيذ الطلب">
              {activeScenario.stepTitles.map((title, idx) => (
                <button
                  key={title}
                  type="button"
                  role="listitem"
                  className={`pw-sim-step-item ${step === idx ? 'is-on' : step > idx ? 'is-passed' : ''}`}
                  onClick={() => setStep(idx)}
                >
                  <span className="pw-sim-step-num" dir="ltr">
                    0{idx + 1}
                  </span>
                  <div className="pw-sim-step-copy">
                    <strong>{title}</strong>
                    <span>{activeScenario.stepDescs[idx]}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="pw-sim-foot-actions">
              <Link href={activeScenario.sectionHref} className="pw-btn pw-btn-primary">
                جرّب تنفيذ هذا الطلب الآن ←
              </Link>
              {onOpenContact && (
                <button type="button" className="pw-btn pw-btn-light" onClick={onOpenContact}>
                  💬 اطلب مساعدة فورية
                </button>
              )}
            </div>
          </div>

          {/* Left Column (RTL): Centerpiece Realistic Smartphone Frame */}
          <div className="pw-sim-phone-wrap" aria-label="معاينة تنفيذ أوردر حقيقي داخل إطار الجوال">
            <div className="pw-sim-phone">
              <span className="pw-sim-hw-vol-1" aria-hidden="true" />
              <span className="pw-sim-hw-vol-2" aria-hidden="true" />
              <span className="pw-sim-hw-pwr" aria-hidden="true" />

              <div className="pw-sim-phone-inner">
                {/* Smartphone Top Status Bar + Dynamic Island */}
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

                {/* Top 4-Step Progress Segments */}
                <div className="pw-sim-progress-segs" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={step >= i ? 'is-active' : ''} />
                  ))}
                </div>

                {/* Mini PhiTech App Top Header */}
                <div className="pw-sim-app-top">
                  <div className="pw-sim-app-brand">
                    <span className="pw-sim-dot-logo" />
                    <strong>فاي تك</strong>
                  </div>
                  <span className={`pw-sim-cart-pill ${step >= 1 ? 'is-filled' : ''}`}>
                    🛒 {step === 0 ? '0' : step <= 2 ? '1' : '✓'}
                  </span>
                </div>

                {/* Interactive Live App Screen Viewport */}
                <div className="pw-sim-ui">
                  {step === 0 && (
                    <div className="pw-sim-screen is-step-0">
                      <div className="pw-sim-search-fake">
                        <span aria-hidden="true">🔍</span>
                        <span className="pw-sim-typed">{activeScenario.searchQueryText}</span>
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
                            <span className="pw-sim-mini-btn is-pulsing">اطلب الآن ←</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="pw-sim-screen is-step-1">
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
                          <div className="pw-sim-spec-check">
                            <span className="pw-sim-check-on">✓</span>
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
                          <div className="pw-sim-action-btn is-pulsing">{activeScenario.ctaLabel}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="pw-sim-screen is-step-2">
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

                        <div className="pw-sim-action-btn is-confirm is-pulsing">
                          ✓ تأكيد وإرسال الأوردر الآن
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="pw-sim-screen is-step-3">
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

                  {/* Animated Touch Ripple Overlay */}
                  <div className={`pw-sim-touch is-pos-${step}`} aria-hidden="true" />
                </div>

                {/* Mini Mobile Bottom App Bar */}
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
