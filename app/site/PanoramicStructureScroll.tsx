'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface PanoramicStructureScrollProps {
  onReplayLogoMotion?: () => void;
  newsComponent?: React.ReactNode;
}

const clamp = (val: number, min = 0, max = 1) => Math.min(max, Math.max(min, val));
const rangeProgress = (p: number, start: number, end: number) => clamp((p - start) / (end - start), 0, 1);

interface MaterialPalletSpec {
  id: string;
  code: string;
  title: string;
  spec: string;
  qty: string;
  href: string;
  accent: string;
  bgTint: string;
  startAt: number;
  endAt: number;
  icon: 'bricks' | 'cement' | 'rebar' | 'mep' | 'finishes';
}

const MATERIAL_PALLETS: MaterialPalletSpec[] = [
  {
    id: 'bricks',
    code: 'MAT-01',
    title: 'طوب وبلك معماري وعازل',
    spec: 'رصّات بلك أسمنتي وطوب أحمر معزول للمباني والقواطع',
    qty: '14,500 بلوكة',
    href: '/site/materials',
    accent: '#f97316',
    bgTint: 'rgba(249, 115, 22, 0.16)',
    startAt: 0.48,
    endAt: 0.62,
    icon: 'bricks',
  },
  {
    id: 'cement',
    code: 'MAT-02',
    title: 'باليتات أسمنت ومون جافة',
    spec: 'شكاير أسمنت بورتلاندي ومواد لصق وعزل معتمدة',
    qty: '680 شيكارة',
    href: '/site/materials',
    accent: '#eab308',
    bgTint: 'rgba(234, 179, 8, 0.16)',
    startAt: 0.56,
    endAt: 0.71,
    icon: 'cement',
  },
  {
    id: 'rebar',
    code: 'MAT-03',
    title: 'حزم حديد تسليح (Rebar B500B)',
    spec: 'أقطار Φ12 / Φ16 / Φ22 مم مشون ومفهرس حسب أقطار الأعمدة والكمرات',
    qty: '42.5 طن',
    href: '/site/contracting',
    accent: '#38bdf8',
    bgTint: 'rgba(56, 189, 248, 0.16)',
    startAt: 0.64,
    endAt: 0.79,
    icon: 'rebar',
  },
  {
    id: 'mep',
    code: 'MAT-04',
    title: 'مواسير وتمديدات كهروميكانيك (MEP)',
    spec: 'مواسير تغذية وصرف، كابلات نحاسية، مسارات تكييف ولوحات سمارت هوم',
    qty: '1,850 م.ط',
    href: '/site/smart-home',
    accent: '#10b981',
    bgTint: 'rgba(16, 185, 129, 0.16)',
    startAt: 0.72,
    endAt: 0.87,
    icon: 'mep',
  },
  {
    id: 'finishes',
    code: 'MAT-05',
    title: 'ألواح بورسلان، رخام ودهانات تشطيب',
    spec: 'تشطيبات واجهات وداخلي وبستلات دهانات معمارية فائقة الجودة',
    qty: '920 م²',
    href: '/site/real-estate',
    accent: '#a855f7',
    bgTint: 'rgba(168, 85, 247, 0.16)',
    startAt: 0.80,
    endAt: 0.96,
    icon: 'finishes',
  },
];

export default function PanoramicStructureScroll({
  onReplayLogoMotion,
  newsComponent,
}: PanoramicStructureScrollProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const updateScroll = () => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight || 900;
      const scrollable = Math.max(1, rect.height - viewportH);
      const traveled = -rect.top;
      setProgress(clamp(traveled / scrollable, 0, 1));
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScroll);
    };

    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // المرحلتان الهندسيتان أثناء السكرول:
  // المرحلة 1 (0.00 -> 0.52): قواعد + تجميع أعمدة الخرسانة لأعلى + ربط الكمرات والبلاطات لبناء الهيكل الخرساني
  // المرحلة 2 (0.48 -> 1.00): ترصيص الخامات المعمارية والإنشائية بجانب الهيكل الخرساني المكتمل
  const foundationP = rangeProgress(progress, 0.01, 0.12);
  const groundColsP = rangeProgress(progress, 0.08, 0.24);
  const firstSlabP = rangeProgress(progress, 0.20, 0.31);
  const firstColsP = rangeProgress(progress, 0.27, 0.41);
  const roofSlabP = rangeProgress(progress, 0.37, 0.47);
  const upperColsAndCrownP = rangeProgress(progress, 0.43, 0.53);

  const structurePct = Math.round(
    clamp(
      foundationP * 0.15 +
        groundColsP * 0.25 +
        firstSlabP * 0.15 +
        firstColsP * 0.2 +
        roofSlabP * 0.15 +
        upperColsAndCrownP * 0.1,
      0,
      1
    ) * 100
  );

  const materialsOverallP = rangeProgress(progress, 0.48, 0.96);
  const materialsPct = Math.round(materialsOverallP * 100);

  const activeStageLabel =
    progress < 0.05
      ? 'ابدأ السكرول لأسفل لتجميع أعمدة الخرسانة وبناء الهيكل ثم رصّ الخامات بجواره'
      : progress < 0.52
      ? `المرحلة 1/2: تجميع أعمدة الخرسانة المسلحة لأعلى وبناء الهيكل الخرساني (${structurePct}%)`
      : progress < 0.95
      ? `المرحلة 2/2: اكتمال الهيكل الخرساني وجاري رصّ الخامات والتشوينات بجانب الهيكل (${materialsPct}%)`
      : 'اكتمل بناء الهيكل الخرساني وترصيص الخامات المعمارية بجواره بالكامل ✓';

  const jumpToPhase = (targetRatio: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const docTop = window.scrollY + rect.top;
    const scrollable = Math.max(1, rect.height - window.innerHeight);
    window.scrollTo({
      top: docTop + scrollable * targetRatio,
      behavior: 'smooth',
    });
  };

  // مواقع الأعمدة الأربعة على محور X داخل الـ SVG (عرض الهيكل)
  const colPositions = [95, 205, 315, 425];

  return (
    <div
      ref={trackRef}
      style={{
        position: 'relative',
        minHeight: '255vh',
        width: '100%',
      }}
    >
      {/* المسرح البانورامي المثبت أثناء السكرول */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          minHeight: '100vh',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 'clamp(4.5rem, 7vw, 6.2rem)',
          paddingBottom: 'clamp(1.25rem, 2.5vw, 2rem)',
        }}
      >
        {/* خلفية البانوراما الكاملة مع زووم خفيف وتدرج معماري متفاعل مع السكرول */}
        <div
          className="pw-split-backdrop"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            overflow: 'hidden',
          }}
        >
          <img
            src="/sections/panorama.jpg"
            alt="منظومة فاي تك المعمارية المتكاملة — بانوراما الهيكل الخرساني والخامات"
            width={1920}
            height={1080}
            loading="eager"
            decoding="async"
            className="pw-split-bg-base"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `${50 - progress * 8}% ${46 - progress * 6}%`,
              transform: `scale(${1.04 + progress * 0.08})`,
              transition: 'transform 120ms linear',
              filter: ' saturate(1.12) contrast(1.06)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(6, 12, 24, 0.72) 0%, rgba(7, 14, 28, 0.45) 35%, rgba(7, 14, 28, 0.66) 72%, rgba(5, 10, 20, 0.94) 100%)',
            }}
          />
          {/* شبكة هندسية شفافة فوق البانوراما */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(to right, rgba(148, 163, 184, 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.07) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              opacity: 0.4 + progress * 0.35,
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* الشريط الإخباري والهيدر العلوي */}
        <div className="pw-wrap" style={{ position: 'relative', zIndex: 3, width: '100%' }}>
          {newsComponent}

          <div
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.85rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.28rem 0.75rem',
                    borderRadius: '999px',
                    background: 'rgba(14, 165, 233, 0.18)',
                    color: '#7dd3fc',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  🏗️ بانوراما التشييد التفاعلي مع السكرول
                </span>
                {onReplayLogoMotion && (
                  <button
                    type="button"
                    onClick={onReplayLogoMotion}
                    className="pw-motion-replay-btn"
                    title="إعادة عرض موشن شعار فاي تك"
                  >
                    <span>✨</span>
                    <span>عرض موشن الشعار</span>
                  </button>
                )}
              </div>

              <h1
                id="portals-heading"
                style={{
                  margin: '0.45rem 0 0.25rem',
                  fontSize: 'clamp(1.45rem, 2.7vw, 2.35rem)',
                  fontWeight: 900,
                  color: '#f8fafc',
                  lineHeight: 1.22,
                  textShadow: '0 4px 20px rgba(0,0,0,0.55)',
                }}
              >
                انزل بالسكرول: أعمدة الخرسانة تتجمع لأعلى وتبني الهيكل.. ثم تترص الخامات بجواره
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: 'clamp(0.82rem, 1.05vw, 0.96rem)',
                  color: '#cbd5e1',
                  maxWidth: '760px',
                }}
              >
                {activeStageLabel}
              </p>
            </div>

            {/* أزرار تحكم سريع في مراحل السكرول + مؤشرات النسب */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                flexWrap: 'wrap',
                background: 'rgba(15, 23, 42, 0.75)',
                padding: '0.5rem 0.75rem',
                borderRadius: '14px',
                backdropFilter: 'blur(12px)',
              }}
            >
              <button
                type="button"
                onClick={() => jumpToPhase(0.28)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.42rem 0.8rem',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  background:
                    progress < 0.52
                      ? 'linear-gradient(135deg, #0284c7, #38bdf8)'
                      : 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                }}
              >
                1. تجميع أعمدة الخرسانة والهيكل ({structurePct}%)
              </button>
              <button
                type="button"
                onClick={() => jumpToPhase(0.92)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.42rem 0.8rem',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  background:
                    progress >= 0.52
                      ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                      : 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                }}
              >
                2. رصّ الخامات بجانب الهيكل ({materialsPct}%)
              </button>
            </div>
          </div>
        </div>

        {/* المسرح المعماري المزدوج: يمين = الهيكل الخرساني المتجمع لأعلى | يسار (بجواره) = ساحة رصّ الخامات */}
        <div
          className="pw-wrap"
          style={{
            position: 'relative',
            zIndex: 3,
            width: '100%',
            margin: 'auto',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
              gap: '1.15rem',
              alignItems: 'stretch',
            }}
          >
            {/* 1️⃣ يمين المشهد: مسرح تجميع أعمدة الخرسانة وبناء الهيكل الخرساني لأعلى */}
            <div
              style={{
                background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.82), rgba(7, 13, 25, 0.9))',
                borderRadius: '20px',
                padding: '1rem 1.15rem',
                backdropFilter: 'blur(14px)',
                boxShadow: '0 22px 50px rgba(0, 0, 0, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: '#38bdf8',
                      letterSpacing: '0.03em',
                    }}
                  >
                    STRUCTURAL CONCRETE FRAME · STAGE 01
                  </span>
                  <h2
                    style={{
                      margin: '0.15rem 0 0',
                      fontSize: '1.08rem',
                      fontWeight: 900,
                      color: '#f8fafc',
                    }}
                  >
                    الهيكل الخرساني المسلح (تجميع الأعمدة والبلاطات لأعلى)
                  </h2>
                </div>
                <span
                  style={{
                    padding: '0.28rem 0.7rem',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    background:
                      structurePct === 100
                        ? 'rgba(16, 185, 129, 0.22)'
                        : 'rgba(56, 189, 248, 0.2)',
                    color: structurePct === 100 ? '#34d399' : '#7dd3fc',
                  }}
                >
                  {structurePct === 100 ? 'اكتمل الهيكل 100% ✓' : `تجميع الهيكل ${structurePct}%`}
                </span>
              </div>

              {/* الرسم الهندسي التفاعلي للأعمدة الخرسانية التي ترتفع وتتجمع لأعلى */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <svg
                  viewBox="0 0 520 350"
                  style={{
                    width: '100%',
                    maxHeight: '325px',
                    overflow: 'visible',
                  }}
                  role="img"
                  aria-label="تجميع أعمدة الخرسانة المسلحة وبناء الهيكل الخرساني"
                >
                  <defs>
                    <linearGradient id="concreteColGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#94a3b8" />
                      <stop offset="45%" stopColor="#e2e8f0" />
                      <stop offset="100%" stopColor="#64748b" />
                    </linearGradient>
                    <linearGradient id="concreteSlabGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f1f5f9" />
                      <stop offset="50%" stopColor="#cbd5e1" />
                      <stop offset="100%" stopColor="#64748b" />
                    </linearGradient>
                    <linearGradient id="footingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#cbd5e1" />
                      <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                    <linearGradient id="craneBeamGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                  </defs>

                  {/* خطوط المحاور الهندسية الرأسية (Axes A, B, C, D) */}
                  {colPositions.map((cx, idx) => {
                    const axisLabel = ['A', 'B', 'C', 'D'][idx];
                    return (
                      <g key={`axis-${axisLabel}`} opacity={0.45}>
                        <line
                          x1={cx}
                          y1={26}
                          x2={cx}
                          y2={322}
                          stroke="#38bdf8"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                        <circle
                          cx={cx}
                          cy={16}
                          r={10}
                          fill="rgba(14, 165, 233, 0.2)"
                          stroke="#38bdf8"
                          strokeWidth="1.2"
                        />
                        <text
                          x={cx}
                          y={20}
                          textAnchor="middle"
                          fill="#e0f2fe"
                          fontSize="10"
                          fontWeight="800"
                        >
                          {axisLabel}
                        </text>
                      </g>
                    );
                  })}

                  {/* منسوب الأرض الطبيعية وفرشة النظافة */}
                  <rect
                    x="36"
                    y="314"
                    width="448"
                    height="12"
                    rx="4"
                    fill="rgba(51, 65, 85, 0.85)"
                  />
                  <line
                    x1="24"
                    y1="314"
                    x2="496"
                    y2="314"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeOpacity="0.6"
                  />

                  {/* 1. القواعد المسلحة والميد (0.01 -> 0.12) */}
                  <g
                    style={{
                      opacity: clamp(foundationP * 1.25, 0.15, 1),
                      transform: `translateY(${(1 - foundationP) * 24}px)`,
                      transition: 'transform 80ms linear',
                    }}
                  >
                    {/* الميدة الأرضية الرابطة */}
                    <rect
                      x="65"
                      y="296"
                      width="390"
                      height="14"
                      rx="3"
                      fill="url(#concreteSlabGrad)"
                    />
                    {colPositions.map((cx, i) => (
                      <g key={`footing-${i}`}>
                        {/* القاعدة الخرسانية المنفصلة */}
                        <polygon
                          points={`${cx - 32},314 ${cx + 32},314 ${cx + 22},294 ${cx - 22},294`}
                          fill="url(#footingGrad)"
                          stroke="#94a3b8"
                          strokeWidth="1"
                        />
                        {/* أشاير حديد التسليح الخارجة من القواعد */}
                        <line
                          x1={cx - 8}
                          y1={294}
                          x2={cx - 8}
                          y2={278}
                          stroke="#f59e0b"
                          strokeWidth="2"
                        />
                        <line
                          x1={cx}
                          y1={294}
                          x2={cx}
                          y2={275}
                          stroke="#f59e0b"
                          strokeWidth="2"
                        />
                        <line
                          x1={cx + 8}
                          y1={294}
                          x2={cx + 8}
                          y2={278}
                          stroke="#f59e0b"
                          strokeWidth="2"
                        />
                      </g>
                    ))}
                    <text x="478" y="307" fill="#94a3b8" fontSize="9.5" fontWeight="700">
                      ±0.00 قواعد وميد
                    </text>
                  </g>

                  {/* 2. أعمدة الدور الأرضي الخرسانية تتجمع لأعلى (0.08 -> 0.24) */}
                  {colPositions.map((cx, i) => {
                    // تأخير طفيف بين كل عمود والذي يليه ليظهر تجميع الأعمدة بشكل حيوي
                    const colP = clamp((groundColsP - i * 0.06) / 0.82, 0, 1);
                    const fullH = 82;
                    const currentH = fullH * colP;
                    const yTop = 294 - currentH;
                    // عند بداية التجميع ينطلق العمود من أسفل إلى مكانه
                    const floatOffset = (1 - colP) * 35;

                    return (
                      <g
                        key={`g-col-${i}`}
                        style={{
                          opacity: colP > 0.01 ? 1 : 0,
                          transform: `translateY(${floatOffset}px)`,
                        }}
                      >
                        {/* أشاير الحديد العلوية للعمود */}
                        <line
                          x1={cx - 7}
                          y1={yTop}
                          x2={cx - 7}
                          y2={yTop - 13 * colP}
                          stroke="#38bdf8"
                          strokeWidth="1.8"
                        />
                        <line
                          x1={cx}
                          y1={yTop}
                          x2={cx}
                          y2={yTop - 16 * colP}
                          stroke="#38bdf8"
                          strokeWidth="1.8"
                        />
                        <line
                          x1={cx + 7}
                          y1={yTop}
                          x2={cx + 7}
                          y2={yTop - 13 * colP}
                          stroke="#38bdf8"
                          strokeWidth="1.8"
                        />

                        {/* جسم العمود الخرساني المسلح */}
                        <rect
                          x={cx - 13}
                          y={yTop}
                          width={26}
                          height={Math.max(0, currentH)}
                          rx="2"
                          fill="url(#concreteColGrad)"
                          stroke="#e2e8f0"
                          strokeWidth="0.9"
                        />

                        {/* كانات العمود (Stirrups) */}
                        {colP > 0.35 &&
                          [0.2, 0.4, 0.6, 0.8].map((ratio, rIdx) => (
                            <line
                              key={rIdx}
                              x1={cx - 11}
                              y1={294 - currentH * ratio}
                              x2={cx + 11}
                              y2={294 - currentH * ratio}
                              stroke="#475569"
                              strokeWidth="1"
                              strokeDasharray="3 2"
                            />
                          ))}
                      </g>
                    );
                  })}

                  {/* 3. كمرة وبلاطة سقف الدور الأرضي (0.20 -> 0.31) */}
                  <g
                    style={{
                      opacity: firstSlabP,
                      transform: `translateY(${(1 - firstSlabP) * -28}px)`,
                    }}
                  >
                    <rect
                      x="58"
                      y="200"
                      width="404"
                      height="14"
                      rx="3"
                      fill="url(#concreteSlabGrad)"
                      stroke="#f8fafc"
                      strokeWidth="0.9"
                    />
                    {/* تفصيلة الكمرة الساقطة */}
                    <rect
                      x="74"
                      y="214"
                      width="372"
                      height="6"
                      fill="#64748b"
                      opacity="0.85"
                    />
                    <text x="478" y="211" fill="#e2e8f0" fontSize="9.5" fontWeight="700">
                      +4.20 سقف الأرضي
                    </text>
                  </g>

                  {/* 4. أعمدة الدور الأول الخرسانية تتجمع لأعلى (0.27 -> 0.41) */}
                  {colPositions.map((cx, i) => {
                    const colP = clamp((firstColsP - i * 0.06) / 0.82, 0, 1);
                    const fullH = 76;
                    const currentH = fullH * colP;
                    const yBase = 200;
                    const yTop = yBase - currentH;
                    const floatOffset = (1 - colP) * 32;

                    return (
                      <g
                        key={`f1-col-${i}`}
                        style={{
                          opacity: colP > 0.01 ? 1 : 0,
                          transform: `translateY(${floatOffset}px)`,
                        }}
                      >
                        {/* أشاير الحديد العلوية */}
                        <line
                          x1={cx - 7}
                          y1={yTop}
                          x2={cx - 7}
                          y2={yTop - 12 * colP}
                          stroke="#f59e0b"
                          strokeWidth="1.8"
                        />
                        <line
                          x1={cx}
                          y1={yTop}
                          x2={cx}
                          y2={yTop - 15 * colP}
                          stroke="#f59e0b"
                          strokeWidth="1.8"
                        />
                        <line
                          x1={cx + 7}
                          y1={yTop}
                          x2={cx + 7}
                          y2={yTop - 12 * colP}
                          stroke="#f59e0b"
                          strokeWidth="1.8"
                        />

                        {/* جسم العمود الخرساني */}
                        <rect
                          x={cx - 12}
                          y={yTop}
                          width={24}
                          height={Math.max(0, currentH)}
                          rx="2"
                          fill="url(#concreteColGrad)"
                          stroke="#f1f5f9"
                          strokeWidth="0.9"
                        />

                        {colP > 0.35 &&
                          [0.25, 0.5, 0.75].map((ratio, rIdx) => (
                            <line
                              key={rIdx}
                              x1={cx - 10}
                              y1={yBase - currentH * ratio}
                              x2={cx + 10}
                              y2={yBase - currentH * ratio}
                              stroke="#475569"
                              strokeWidth="1"
                              strokeDasharray="3 2"
                            />
                          ))}
                      </g>
                    );
                  })}

                  {/* 5. كمرة وبلاطة سقف الدور الأول (0.37 -> 0.47) */}
                  <g
                    style={{
                      opacity: roofSlabP,
                      transform: `translateY(${(1 - roofSlabP) * -28}px)`,
                    }}
                  >
                    <rect
                      x="58"
                      y="112"
                      width="404"
                      height="13"
                      rx="3"
                      fill="url(#concreteSlabGrad)"
                      stroke="#f8fafc"
                      strokeWidth="0.9"
                    />
                    <rect
                      x="74"
                      y="125"
                      width="372"
                      height="5"
                      fill="#64748b"
                      opacity="0.85"
                    />
                    <text x="478" y="122" fill="#e2e8f0" fontSize="9.5" fontWeight="700">
                      +8.40 سقف الأول
                    </text>
                  </g>

                  {/* 6. أعمدة الملحق العلوي والدروة الخرسانية النهائية (0.43 -> 0.53) */}
                  {colPositions.map((cx, i) => {
                    const colP = clamp((upperColsAndCrownP - i * 0.05) / 0.85, 0, 1);
                    const fullH = 54;
                    const currentH = fullH * colP;
                    const yBase = 112;
                    const yTop = yBase - currentH;

                    return (
                      <g
                        key={`top-col-${i}`}
                        style={{
                          opacity: colP > 0.01 ? 1 : 0,
                          transform: `translateY(${(1 - colP) * 24}px)`,
                        }}
                      >
                        <rect
                          x={cx - 11}
                          y={yTop}
                          width={22}
                          height={Math.max(0, currentH)}
                          rx="2"
                          fill="url(#concreteColGrad)"
                          stroke="#f8fafc"
                          strokeWidth="0.8"
                        />
                      </g>
                    );
                  })}

                  {/* بلاطة السطح النهائي وكمرة الدروة المعمارية */}
                  <g
                    style={{
                      opacity: upperColsAndCrownP,
                      transform: `translateY(${(1 - upperColsAndCrownP) * -20}px)`,
                    }}
                  >
                    <rect
                      x="50"
                      y="46"
                      width="420"
                      height="12"
                      rx="3"
                      fill="url(#craneBeamGrad)"
                    />
                    <rect
                      x="64"
                      y="58"
                      width="392"
                      height="5"
                      fill="url(#concreteSlabGrad)"
                    />
                    <text x="478" y="55" fill="#fbbf24" fontSize="9.5" fontWeight="800">
                      +12.00 الدروة والسطح
                    </text>
                  </g>

                  {/* أسهم صعود الأعمدة أثناء التجميع */}
                  {progress > 0.02 && progress < 0.54 && (
                    <g opacity={0.9}>
                      <path
                        d="M 28 270 L 28 95 M 28 95 L 21 106 M 28 95 L 35 106"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                      <text
                        x="32"
                        y="185"
                        fill="#7dd3fc"
                        fontSize="10"
                        fontWeight="800"
                        transform="rotate(-90 32 185)"
                        textAnchor="middle"
                      >
                        تجميع الأعمدة لأعلى ↑
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              {/* شريط مراحل الهيكل الخرساني أسفل الرسم */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.45rem',
                  marginTop: '0.35rem',
                }}
              >
                {[
                  { label: 'القواعد والميد', val: Math.round(foundationP * 100) },
                  { label: 'أعمدة الأرضي', val: Math.round(groundColsP * 100) },
                  { label: 'أعمدة وبلاطة الأول', val: Math.round(firstColsP * 100) },
                  { label: 'أعمدة السطح والدروة', val: Math.round(upperColsAndCrownP * 100) },
                ].map((step) => (
                  <div
                    key={step.label}
                    style={{
                      background: 'rgba(30, 41, 59, 0.72)',
                      padding: '0.42rem 0.55rem',
                      borderRadius: '10px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: 700 }}>
                      {step.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 900,
                        color: step.val === 100 ? '#34d399' : '#38bdf8',
                        marginTop: '0.1rem',
                      }}
                    >
                      {step.val}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2️⃣ يسار المشهد (بجانب الهيكل مباشرة): ساحة ترصيص الخامات والتشوينات مع استمرار السكرول */}
            <div
              style={{
                background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.82), rgba(7, 13, 25, 0.9))',
                borderRadius: '20px',
                padding: '1rem 1.15rem',
                backdropFilter: 'blur(14px)',
                boxShadow: '0 22px 50px rgba(0, 0, 0, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  marginBottom: '0.65rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: '#fbbf24',
                      letterSpacing: '0.03em',
                    }}
                  >
                    ADJACENT MATERIALS YARD · STAGE 02
                  </span>
                  <h2
                    style={{
                      margin: '0.15rem 0 0',
                      fontSize: '1.08rem',
                      fontWeight: 900,
                      color: '#f8fafc',
                    }}
                  >
                    رصّ الخامات والتشوينات بجانب الهيكل الخرساني
                  </h2>
                </div>
                <span
                  style={{
                    padding: '0.28rem 0.7rem',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    background:
                      materialsPct >= 98
                        ? 'rgba(16, 185, 129, 0.22)'
                        : 'rgba(245, 158, 11, 0.2)',
                    color: materialsPct >= 98 ? '#34d399' : '#fbbf24',
                  }}
                >
                  {materialsPct >= 98
                    ? 'تم رصّ الخامات 100% ✓'
                    : progress < 0.48
                    ? 'تبدأ بعد اكتمال الأعمدة'
                    : `ترصيص الخامات ${materialsPct}%`}
                </span>
              </div>

              {/* صفوف باليتات الخامات التي تترص وتصطف بجانب الهيكل الخرساني مع السكرول */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                  flex: 1,
                  justifyContent: 'center',
                }}
              >
                {MATERIAL_PALLETS.map((mat, idx) => {
                  const itemP = rangeProgress(progress, mat.startAt, mat.endAt);
                  // الخامات تدخل وتترص في مكانها بجانب الهيكل
                  const slideX = (1 - itemP) * -46;
                  const liftY = (1 - itemP) * 18;

                  return (
                    <Link
                      key={mat.id}
                      href={mat.href}
                      style={{
                        textDecoration: 'none',
                        display: 'grid',
                        gridTemplateColumns: '64px 1fr auto',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.58rem 0.75rem',
                        borderRadius: '14px',
                        background:
                          itemP > 0.1
                            ? `linear-gradient(90deg, ${mat.bgTint}, rgba(30, 41, 59, 0.85))`
                            : 'rgba(30, 41, 59, 0.42)',
                        opacity: 0.25 + itemP * 0.75,
                        transform: `translate3d(${slideX}px, ${liftY}px, 0) scale(${
                          0.96 + itemP * 0.04
                        })`,
                        transition: 'transform 90ms linear, opacity 90ms linear',
                      }}
                    >
                      {/* أيقونة مجسمة لباليتة الخامة */}
                      <div
                        style={{
                          width: '60px',
                          height: '46px',
                          borderRadius: '10px',
                          background: 'rgba(15, 23, 42, 0.78)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {mat.icon === 'bricks' && (
                          <svg width="44" height="32" viewBox="0 0 44 32">
                            <rect x="4" y="18" width="16" height="8" rx="1.5" fill="#ea580c" />
                            <rect x="22" y="18" width="16" height="8" rx="1.5" fill="#f97316" />
                            <rect x="12" y="8" width="18" height="8" rx="1.5" fill="#fb923c" />
                            <rect x="2" y="27" width="40" height="3" fill="#78350f" />
                          </svg>
                        )}
                        {mat.icon === 'cement' && (
                          <svg width="44" height="32" viewBox="0 0 44 32">
                            <rect x="5" y="17" width="15" height="9" rx="3" fill="#94a3b8" />
                            <rect x="22" y="17" width="15" height="9" rx="3" fill="#cbd5e1" />
                            <rect x="13" y="8" width="16" height="8" rx="3" fill="#eab308" />
                            <rect x="2" y="27" width="40" height="3" fill="#78350f" />
                          </svg>
                        )}
                        {mat.icon === 'rebar' && (
                          <svg width="44" height="32" viewBox="0 0 44 32">
                            <line x1="4" y1="22" x2="40" y2="22" stroke="#38bdf8" strokeWidth="3.2" strokeLinecap="round" />
                            <line x1="6" y1="16" x2="38" y2="16" stroke="#7dd3fc" strokeWidth="3.2" strokeLinecap="round" />
                            <line x1="9" y1="10" x2="35" y2="10" stroke="#0284c7" strokeWidth="3.2" strokeLinecap="round" />
                            <rect x="2" y="26" width="40" height="3" fill="#475569" />
                          </svg>
                        )}
                        {mat.icon === 'mep' && (
                          <svg width="44" height="32" viewBox="0 0 44 32">
                            <circle cx="12" cy="18" r="6" fill="none" stroke="#10b981" strokeWidth="2.8" />
                            <circle cx="28" cy="18" r="6" fill="none" stroke="#34d399" strokeWidth="2.8" />
                            <path d="M18 18 L22 18" stroke="#10b981" strokeWidth="2.5" />
                            <rect x="2" y="26" width="40" height="3" fill="#065f46" />
                          </svg>
                        )}
                        {mat.icon === 'finishes' && (
                          <svg width="44" height="32" viewBox="0 0 44 32">
                            <polygon points="8,24 18,8 28,24" fill="#a855f7" opacity="0.85" />
                            <polygon points="18,24 28,10 38,24" fill="#c084fc" opacity="0.9" />
                            <rect x="2" y="26" width="40" height="3" fill="#581c87" />
                          </svg>
                        )}
                      </div>

                      {/* بيانات الخامة المرصوصة */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 900,
                              padding: '0.1rem 0.45rem',
                              borderRadius: '6px',
                              background: 'rgba(15, 23, 42, 0.75)',
                              color: mat.accent,
                            }}
                          >
                            رصّة #{idx + 1} · {mat.code}
                          </span>
                          <span
                            style={{
                              fontSize: '0.88rem',
                              fontWeight: 900,
                              color: '#f8fafc',
                            }}
                          >
                            {mat.title}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#cbd5e1',
                            marginTop: '0.15rem',
                          }}
                        >
                          {mat.spec}
                        </div>
                      </div>

                      {/* الكمية وحالة الرصّ */}
                      <div style={{ textAlign: 'left' }}>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 900,
                            color: itemP >= 0.95 ? '#34d399' : mat.accent,
                          }}
                        >
                          {mat.qty}
                        </div>
                        <div
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            color: itemP >= 0.95 ? '#6ee7b7' : '#94a3b8',
                          }}
                        >
                          {itemP >= 0.95
                            ? 'تم الرصّ بجوار الهيكل ✓'
                            : itemP > 0.05
                            ? `جاري الرصّ ${Math.round(itemP * 100)}%`
                            : 'قيد التشوين'}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* ملخص ساحة التشوين بجانب الهيكل */}
              <div
                style={{
                  marginTop: '0.55rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  fontSize: '0.76rem',
                  color: '#cbd5e1',
                }}
              >
                <span>📦 جميع الخامات مفهرسة ومربوطة ببنود المقايسة (BOQ) وأوامر التوريد</span>
                <Link
                  href="/site/materials"
                  style={{
                    color: '#fbbf24',
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  استعراض كتالوج الخامات والتوريدات ←
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* شريط التقدم السفلي للسكرول البانورامي */}
        <div className="pw-wrap" style={{ position: 'relative', zIndex: 3, width: '100%' }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.78)',
              borderRadius: '999px',
              padding: '0.45rem 0.9rem',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#e2e8f0',
                whiteSpace: 'nowrap',
              }}
            >
              مسار البناء بالسكرول
            </span>
            <div
              style={{
                flex: 1,
                height: '7px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.12)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #38bdf8 0%, #10b981 52%, #f59e0b 100%)',
                  transition: 'width 60ms linear',
                }}
              />
            </div>
            <span
              style={{
                fontSize: '0.76rem',
                fontWeight: 900,
                color: '#38bdf8',
                minWidth: '42px',
                textAlign: 'left',
              }}
            >
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
