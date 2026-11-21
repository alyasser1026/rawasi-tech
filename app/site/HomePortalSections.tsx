"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { WebsiteProduct, WebsiteProperty } from './store-catalog';
import { PORTAL_SECTIONS, type SectionSlug } from './section-defs';
import NewsTicker from './NewsTicker';
import { DEFAULT_NEWS_TICKER, type NewsTickerConfig } from './site-content';

interface HomePortalSectionsProps {
  products?: WebsiteProduct[];
  properties?: WebsiteProperty[];
  newsTicker?: NewsTickerConfig;
  whatsappNumber?: string;
  onAddToCart?: (product: WebsiteProduct, qty: number, withInstall: boolean) => void;
  onAddBundleToCart?: (items: { product: WebsiteProduct; qty: number }[], withInstall: boolean) => void;
}

export default function HomePortalSections({
  newsTicker = DEFAULT_NEWS_TICKER,
}: HomePortalSectionsProps) {
  // Track the visible service without taking control of page scrolling.
  const [hoveredSlug, setHoveredSlug] = useState<SectionSlug | null>(null);
  const [scrolledSlug, setScrolledSlug] = useState<SectionSlug | null>('contracting');
  const [visibleSlugs, setVisibleSlugs] = useState<Record<string, boolean>>({ contracting: true });
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  const activeSlug = hoveredSlug ?? scrolledSlug;

  const activeHoverSection = useMemo(
    () => (activeSlug ? PORTAL_SECTIONS.find((s) => s.slug === activeSlug) || null : null),
    [activeSlug]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slug = entry.target.getAttribute('data-section-slug') as SectionSlug | null;
          if (!slug) continue;
          if (entry.isIntersecting) {
            setScrolledSlug(slug);
            setVisibleSlugs((prev) => (prev[slug] ? prev : { ...prev, [slug]: true }));
          }
        }
      },
      { rootMargin: '-18% 0px -22% 0px', threshold: 0.18 }
    );

    for (const sec of PORTAL_SECTIONS) {
      const el = rowRefs.current[sec.slug];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`pw-split-stage ${activeSlug ? 'has-active' : ''}`}
      style={
        activeHoverSection
          ? ({ '--stage-accent': activeHoverSection.accent } as React.CSSProperties)
          : undefined
      }
      onPointerLeave={() => setHoveredSlug(null)}
    >
      <section id="portals" className="pw-portal-gateway" aria-labelledby="portals-heading">
        <div className="pw-wrap pw-panoramic-top-overlay">
          <NewsTicker config={newsTicker} />

          <div className="pw-panoramic-floating-hero">
            <div className="pw-panoramic-eyebrow-row">
              <p className="pw-eyebrow" style={{ marginBottom: 0 }}>فاي تك للمقاولات والتوريدات</p>
            </div>
            <h1 id="portals-heading" className="pw-portal-main-h1">
              من الأساس، نبني مشروعك.
            </h1>
            <p className="pw-panoramic-sub">
              إنشاءات وسباكة وكهرباء، بتنسيق متكامل وإشراف هندسي من الأساس للتسليم.
            </p>
          </div>
          <a className="pw-construction-scroll-cue" href="#portal-station-contracting">
            <span>اكتشف خدماتنا</span><span aria-hidden="true">↓</span>
          </a>
        </div>

        {/* الأقسام الموحدة: تطفو مباشرة فوق المشهد الثلاثي الأبعاد بدون صور خلفية تحجب البناء */}
        <div className={`pw-split-cols ${activeSlug ? 'has-active' : ''}`}>
          {PORTAL_SECTIONS.map((sec, idx) => {
            const isActive = activeSlug === sec.slug;
            const isInView = Boolean(visibleSlugs[sec.slug]);
            const sideClass = idx % 2 === 0 ? 'is-side-right' : 'is-side-left';
            return (
              <article
                key={sec.slug}
                id={`portal-station-${sec.slug}`}
                data-section-slug={sec.slug}
                ref={(el) => {
                  rowRefs.current[sec.slug] = el;
                }}
                className={`pw-split-station-row ${sideClass} ${isActive ? 'is-row-active' : ''} ${isInView ? 'is-in-view' : ''}`}
                style={{ '--col-accent': sec.accent } as React.CSSProperties}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'touch') setHoveredSlug(sec.slug);
                }}
              >
                {/* تظليل جانبي خفيف وشفاف فقط لإبراز نص القسم مع إبقاء مشهد الـ 3D واضحاً بالكامل في الخلفية */}
                <div className="pw-sec-photo-canvas" aria-hidden="true">
                  <div className={`pw-sec-photo-shade ${sideClass}`} />
                </div>

                {/* النص والهنت العائم مباشرة فوق صورة القسم بدون أي حاوية أو إطار */}
                <div className="pw-wrap pw-sec-floating-wrap">
                  <Link
                    href={sec.href}
                    className={`pw-split-col ${sideClass} ${isActive ? 'is-active' : ''}`}
                    onFocus={() => setHoveredSlug(sec.slug)}
                    onBlur={() => setHoveredSlug((prev) => (prev === sec.slug ? null : prev))}
                  >
                    <div className="pw-split-col-inner">
                      <span className="pw-split-num">
                        <span aria-hidden="true">{sec.icon}</span>
                        <span>{sec.num}</span>
                        <span>·</span>
                        <span>{sec.flowNote}</span>
                      </span>

                      <h2>{sec.title}</h2>

                      <div className="pw-split-reveal">
                        <p className="pw-split-hint">{sec.guideHint}</p>
                        <p className="pw-split-inline-tags" aria-hidden="true">
                          {sec.highlights.join('  ·  ')}
                        </p>
                        <span className="pw-split-cta">
                          <span>ادخل {sec.title}</span>
                          <span aria-hidden="true">←</span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
