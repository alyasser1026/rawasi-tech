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
  const [hoveredSlug, setHoveredSlug] = useState<SectionSlug | null>(null);
  const [scrollStageSlug, setScrollStageSlug] = useState<SectionSlug>('contracting');
  const runwayRef = useRef<HTMLDivElement>(null);

  const sections = PORTAL_SECTIONS.slice(0, 3);
  const activeSlug = hoveredSlug ?? scrollStageSlug;

  const activeHoverSection = useMemo(
    () => sections.find((s) => s.slug === activeSlug) || null,
    [activeSlug, sections]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const runway = runwayRef.current;
      if (!runway) return;
      const rect = runway.getBoundingClientRect();
      const scrollable = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable));
      const idx = progress < 0.34 ? 0 : progress < 0.68 ? 1 : 2;
      const targetSec = PORTAL_SECTIONS[idx];
      if (targetSec) setScrollStageSlug(targetSec.slug);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
      <section id="portals" className="pw-portal-gateway" aria-label="أقسام فاي تك الرئيسية">
        <div ref={runwayRef} className="pw-diag-runway">
          <div className="pw-diag-viewport">
            <div className="pw-wrap pw-diag-top">
              <NewsTicker config={newsTicker} />
            </div>

            <div className={`pw-diag-slices ${hoveredSlug ? 'has-hover' : ''}`}>
              {sections.map((sec, idx) => {
                const isHovered = hoveredSlug === sec.slug;
                const isActive = activeSlug === sec.slug;
                return (
                  <Link
                    key={sec.slug}
                    id={`portal-station-${sec.slug}`}
                    href={sec.href}
                    className={`pw-diag-slice is-slice-${idx} ${isHovered ? 'is-hovered' : ''} ${isActive ? 'is-active' : ''}`}
                    style={{ '--col-accent': sec.accent } as React.CSSProperties}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== 'touch') setHoveredSlug(sec.slug);
                    }}
                    onFocus={() => setHoveredSlug(sec.slug)}
                    onBlur={() => setHoveredSlug((prev) => (prev === sec.slug ? null : prev))}
                  >
                    <div className="pw-diag-veil" aria-hidden="true" />
                    <div className="pw-diag-content">
                      <span className="pw-diag-num">
                        <span aria-hidden="true">{sec.icon}</span>
                        <span>{sec.num}</span>
                        <span>·</span>
                        <span>{sec.flowNote}</span>
                      </span>

                      <h2>{sec.title}</h2>

                      <div className="pw-diag-details">
                        <p className="pw-diag-hint">{sec.guideHint}</p>
                        <p className="pw-diag-tags" aria-hidden="true">
                          {sec.highlights.join('  ·  ')}
                        </p>
                      </div>

                      <span className="pw-diag-cta">
                        <span>ادخل القسم</span>
                        <span aria-hidden="true">←</span>
                      </span>
                    </div>
                  </Link>
                );
              })}

              {/* Desktop Diagonal Lines (slant top-right -> bottom-left matching clip-path polygons) */}
              <svg
                className="pw-diag-lines pw-diag-lines-desktop"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="70" y1="0" x2="63" y2="100" vectorEffect="non-scaling-stroke" className="pw-diag-line-glow" />
                <line x1="37" y1="0" x2="30" y2="100" vectorEffect="non-scaling-stroke" className="pw-diag-line-glow" />
                <line x1="70" y1="0" x2="63" y2="100" vectorEffect="non-scaling-stroke" className="pw-diag-line-core" />
                <line x1="37" y1="0" x2="30" y2="100" vectorEffect="non-scaling-stroke" className="pw-diag-line-core" />
              </svg>

              {/* Mobile Diagonal Lines (slant dividers separating 3 stacked bands) */}
              <svg
                className="pw-diag-lines pw-diag-lines-mobile"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="0" y1="37" x2="100" y2="30" vectorEffect="non-scaling-stroke" className="pw-diag-line-glow" />
                <line x1="0" y1="70" x2="100" y2="63" vectorEffect="non-scaling-stroke" className="pw-diag-line-glow" />
                <line x1="0" y1="37" x2="100" y2="30" vectorEffect="non-scaling-stroke" className="pw-diag-line-core" />
                <line x1="0" y1="70" x2="100" y2="63" vectorEffect="non-scaling-stroke" className="pw-diag-line-core" />
              </svg>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
