"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type SimScenarioId = 'store' | 'contracting' | 'maintenance';

interface SimScenario {
  id: SimScenarioId;
  tabLabel: string;
  badge: string;
  sectionHref: string;
  sectionTitle: string;
  urls: [string, string, string, string];
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
    tabLabel: '🛒 طلب منتجات وسمارت هوم',
    badge: 'التوريد والتركيب الذكي',
    sectionHref: '/store',
    sectionTitle: 'المتجر وقسم المبيعات والسمارت هوم',
    urls: [
      'phitech.eg/sections/materials',
      'phitech.eg/store?item=smart-lock-pro',
      'phitech.eg/store#cart-checkout',
      'phitech.eg/orders/PHI-2026-842',
    ],
    stepTitles: [
      '01 · ابحث أو ادخل القسم',
      '02 · اختار المنتج وخيار التركيب',
      '03 · مراجعة السلة وتأكيد الأوردر',
      '04 · إتمام الصفقة ومتابعة الضمان',
    ],
    stepDescs: [
      'العميل يكتب "قفل ذكي" أو يدخل قسم المبيعات والسمارت هوم في ثوانٍ.',
      'يختار القفل الذكي 6×1 ويفعّل خيار "توريد + تركيب هندسي" بالضمان.',
      'تُفتح السلة الجانبية بالبيانات والكمية ويؤكد إرسال الطلب بضغطة واحدة.',
      'يصدر رقم الطلب الموثق ويبدأ فريق التركيب والتوريد التنسيق فوراً.',
    ],
    itemTitle: 'قفل باب ذكي 6×1 بالكاميرا والبصمة',
    itemSubtitle: 'توريد معتمد + برمجة وتركيب هندسي على الباب',
    itemThumb: '/products/smart-door-lock.webp',
    itemCode: 'SM-02',
    specLabel: 'توريد + تركيب هندسي معتمد',
    optionBadge: 'شامل ضمان 3 سنوات',
    ctaLabel: '🛒 أضف للسلة (1)',
    cartTotalLabel: 'شامل التوريد والبرمجة',
    orderCode: 'ORD-PHI-842',
    orderSummary: 'تم استلام طلب القفل الذكي وجاري تحديد موعد الفني للتركيب',
  },
  {
    id: 'contracting',
    tabLabel: '🏗️ طلب مقايسة ومقاولات 3×1',
    badge: 'عظم · تشطيب · تكييف MEP',
    sectionHref: '/sections/contracting',
    sectionTitle: 'قسم المقاولات والتنفيذ 3×1',
    urls: [
      'phitech.eg/sections/contracting',
      'phitech.eg/sections/contracting#calculator',
      'phitech.eg/sections/contracting#confirm',
      'phitech.eg/projects/ENG-2026-319',
    ],
    stepTitles: [
      '01 · افتح قسم المقاولات',
      '02 · اضبط المساحة وبنود التنفيذ',
      '03 · راجع المقايسة ووفّر 7%',
      '04 · اعتماد المعاينة والبدء',
    ],
    stepDescs: [
      'العميل يضغط على قسم المقاولات والتنفيذ من الصفحة الرئيسية مباشرة.',
      'يختار نوع المشروع (فيلا 350 م² × دورين) ويفعّل العظم والتشطيب والـ MEP.',
      'يحسب النظام كمية الخرسانة والحديد والتكييف والخصم الموحّد تلقائياً.',
      'يؤكد حجز المعاينة الميدانية ليصل المهندس المختص للموقع بالأجهزة.',
    ],
    itemTitle: 'مقايسة متكاملة 3×1 — فيلا سكنية',
    itemSubtitle: 'إنشاءات + تشطيب ديلوكس + تكييف مخفي بجهة واحدة',
    itemThumb: '/sections/contracting.jpg',
    itemCode: 'PRJ-3X1',
    specLabel: '700 م² مسطح بنائي · 3 نطاقات',
    optionBadge: 'خصم تكامل 7% مفعّل',
    ctaLabel: '📐 اعتماد وحجز معاينة',
    cartTotalLabel: 'مقايسة هندسية معتمدة',
    orderCode: 'ENG-PHI-319',
    orderSummary: 'تم جدولة الرفع المساحي بالليزر وتسليم خطة التنفيذ',
  },
  {
    id: 'maintenance',
    tabLabel: '🛠️ حجز صيانة وتنفيذ هندسي',
    badge: 'استجابة خلال 24 ساعة',
    sectionHref: '/sections/contracting?tab=maintenance',
    sectionTitle: 'قسم التنفيذ والصيانة المضمونة',
    urls: [
      'phitech.eg/sections/contracting?tab=maintenance',
      'phitech.eg/store?tab=maintenance',
      'phitech.eg/maintenance#booking',
      'phitech.eg/tickets/MNT-2026-507',
    ],
    stepTitles: [
      '01 · اختر تخصص الصيانة',
      '02 · حدد الموعد والعنوان',
      '03 · تأكيد إرسال الفني المختص',
      '04 · استلام العمل بشهادة ضمان',
    ],
    stepDescs: [
      'العميل يدخل على خدمات الصيانة والتنفيذ ويختار تأسيس وصيانة التكييف المخفي.',
      'يحدد الوقت المناسب ونوع العطل أو التأسيس المطلوب بدون تعقيد.',
      'يضغط تأكيد الحجز لتسجيل التذكرة وإخطار مهندس التشغيل فوراً.',
      'يصل الفريق المجهز ويسلّم البند باختبار جودة موثق وضمان حقيقي.',
    ],
    itemTitle: 'كشف تسريب بالموجات + صيانة تكييف مخفي',
    itemSubtitle: 'فحص بالأجهزة بدون تكسير وتقرير حالة كامل',
    itemThumb: '/products/safety-shutoff-valve.webp',
    itemCode: 'MNT-HVAC',
    specLabel: 'غداً · 11:00 صباحاً',
    optionBadge: 'بدون تكسير · بضمان',
    ctaLabel: '📅 تأكيد موعد المعاينة',
    cartTotalLabel: 'تذكرة صيانة عاجلة',
    orderCode: 'MNT-PHI-507',
    orderSummary: 'تم تعيين المهندس المختص والتوجه في الموعد المحدد',
  },
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
    }, 3400);
    return () => window.clearInterval(timer);
  }, [paused, scenarioId]);

  const handleSelectScenario = (id: SimScenarioId) => {
    setScenarioId(id);
    setStep(0);
  };

  const renderDeviceScreen = (isMobile: boolean) => {
    return (
      <div className={`pw-sim-ui ${isMobile ? 'is-mobile-ui' : 'is-desktop-ui'}`}>
        {/* Mini App Top Bar */}
        <div className="pw-sim-app-top">
          <div className="pw-sim-app-brand">
            <span className="pw-sim-dot-logo" />
            <strong>فاي تك</strong>
            {!isMobile && <small>{activeScenario.sectionTitle}</small>}
          </div>
          <div className="pw-sim-app-actions">
            <span className={`pw-sim-cart-pill ${step >= 2 ? 'is-filled' : ''}`}>
              🛒 {step >= 1 && step <= 2 ? '1' : step === 3 ? '✓' : '0'}
            </span>
          </div>
        </div>

        {/* Simulated Step Screens */}
        {step === 0 && (
          <div className="pw-sim-screen is-step-0">
            <div className="pw-sim-search-fake">
              <span>🔍</span>
              <span className="pw-sim-typed">
                {scenarioId === 'store'
                  ? 'قفل باب ذكي 6×1...'
                  : scenarioId === 'contracting'
                  ? 'مقايسة فيلا 350 م²...'
                  : 'تكييف مخفي وسباكة...'}
              </span>
            </div>
            <div className="pw-sim-mini-grid">
              <div className="pw-sim-mini-card is-target">
                <img src={activeScenario.itemThumb} alt="" width={120} height={90} />
                <div>
                  <span className="pw-sim-tag">{activeScenario.itemCode}</span>
                  <strong>{activeScenario.itemTitle}</strong>
                </div>
                <span className="pw-sim-mini-btn is-pulsing">دخول ←</span>
              </div>
              {!isMobile && (
                <div className="pw-sim-mini-card is-muted-card">
                  <div>
                    <span className="pw-sim-tag">خيار بديل</span>
                    <strong>حزمة التشطيب والسمارت الشاملة</strong>
                  </div>
                  <span className="pw-sim-mini-btn">عرض</span>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="pw-sim-screen is-step-1">
            <div className="pw-sim-detail-box">
              <img src={activeScenario.itemThumb} alt="" width={160} height={120} className="pw-sim-detail-img" />
              <div className="pw-sim-detail-meta">
                <span className="pw-sim-tag">{activeScenario.optionBadge}</span>
                <strong>{activeScenario.itemTitle}</strong>
                <small>{activeScenario.itemSubtitle}</small>
                <div className="pw-sim-spec-check">
                  <span className="pw-sim-check-on">✓</span>
                  <span>{activeScenario.specLabel}</span>
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
                <strong>ملخص الصفقة الجاهزة</strong>
                <span className="pw-sim-tag">{activeScenario.cartTotalLabel}</span>
              </div>
              <div className="pw-sim-checkout-row">
                <img src={activeScenario.itemThumb} alt="" width={52} height={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{activeScenario.itemTitle}</strong>
                  <small>{activeScenario.specLabel}</small>
                </div>
                <span className="pw-sim-qty">×1</span>
              </div>
              <div className="pw-sim-action-btn is-confirm is-pulsing">
                ✓ تأكيد وإرسال الطلب الآن
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="pw-sim-screen is-step-3">
            <div className="pw-sim-success-card">
              <div className="pw-sim-success-icon">✓</div>
              <strong>تم إتمام الطلب بنجاح!</strong>
              <span className="pw-sim-order-code" dir="ltr">
                #{activeScenario.orderCode}
              </span>
              <p>{activeScenario.orderSummary}</p>
              <div className="pw-sim-tracker">
                <span className="is-done">استلام ✓</span>
                <span className="is-done">تجهيز ✓</span>
                <span className="is-now">تسليم وضمان ●</span>
              </div>
            </div>
          </div>
        )}

        {/* Animated Interactive Cursor (Desktop) / Touch Ripple (Mobile) */}
        <div
          className={`pw-sim-pointer ${isMobile ? 'is-touch' : 'is-cursor'} is-pos-${step}`}
          aria-hidden="true"
        />
      </div>
    );
  };

  return (
    <section
      className="pw-sim-section"
      aria-labelledby="order-sim-heading"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="pw-wrap">
        <div className="pw-sim-header">
          <div>
            <p className="pw-eyebrow">محاكاة حية لخطوات الطلب وإتمام الصفقة</p>
            <h2 id="order-sim-heading">شاهد كيف ينفّذ العميل طلبه في ثوانٍ من الموبايل والكمبيوتر</h2>
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
        </div>

        {/* 4 Interactive Step Pills */}
        <div className="pw-sim-steps-bar">
          {activeScenario.stepTitles.map((title, idx) => (
            <button
              key={title}
              type="button"
              className={`pw-sim-step-pill ${step === idx ? 'is-on' : step > idx ? 'is-passed' : ''}`}
              onClick={() => setStep(idx)}
            >
              <strong>{title}</strong>
              <span>{activeScenario.stepDescs[idx]}</span>
            </button>
          ))}
        </div>

        {/* Dual Device Showcase: Live Synchronized Desktop + Mobile Screens */}
        <div className="pw-sim-stage">
          {/* 1. Desktop Browser Frame */}
          <div className="pw-sim-desktop" aria-label="معاينة شاشة الكمبيوتر">
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
              <span className="pw-sim-chrome-badge">شاشة الكمبيوتر</span>
            </div>
            <div className="pw-sim-desktop-body">{renderDeviceScreen(false)}</div>
          </div>

          {/* 2. Mobile Phone Frame */}
          <div className="pw-sim-mobile" aria-label="معاينة شاشة الموبايل">
            <div className="pw-sim-phone-notch" aria-hidden="true">
              <span />
            </div>
            <div className="pw-sim-phone-label">تطبيق الموبايل</div>
            <div className="pw-sim-mobile-body">{renderDeviceScreen(true)}</div>
            <div className="pw-sim-phone-homebar" aria-hidden="true" />
          </div>
        </div>

        <div className="pw-sim-foot-actions">
          <Link href={activeScenario.sectionHref} className="pw-btn pw-btn-primary">
            جرّب تنفيذ هذا الطلب الآن ←
          </Link>
          {onOpenContact && (
            <button type="button" className="pw-btn pw-btn-light" onClick={onOpenContact}>
              💬 اطلب مساعدة فورية من مهندس المبيعات
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
