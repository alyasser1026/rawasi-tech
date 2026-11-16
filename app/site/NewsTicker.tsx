"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { NewsTickerConfig, NewsTickerItem } from './site-content';

function isSafeTickerHref(href?: string): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  return trimmed.startsWith('/') || trimmed.startsWith('#') || /^https?:\/\//i.test(trimmed);
}

/**
 * Seamless infinite scrolling news & offers ticker strip for the public home screen.
 * Uses LTR viewport geometry + requestAnimationFrame transform so Arabic RTL text
 * starts inside the visible viewport immediately and keeps looping smoothly
 * even under Windows Reduced Motion or low-graphics mode.
 */
export default function NewsTicker({ config }: { config: NewsTickerConfig }) {
  const [paused, setPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [liveItems, setLiveItems] = useState<NewsTickerItem[]>([]);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const firstGroupRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef<number | null>(null);
  const pausedRef = useRef<boolean>(false);

  useEffect(() => {
    pausedRef.current = paused || hoverPaused;
  }, [paused, hoverPaused]);

  // Auto-load fresh daily Arabic economic & real-estate news into the live strip
  useEffect(() => {
    if (!config?.enabled || config?.autoFeedEnabled === false) return;
    const controller = new AbortController();
    let mounted = true;

    fetch('/api/news-feed?topic=all', { signal: controller.signal, cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!mounted || !json?.ok || !Array.isArray(json.items)) return;
        const mapped: NewsTickerItem[] = json.items
          .slice(0, 10)
          .filter((it: any) => it && typeof it.title === 'string' && it.title.trim())
          .map((it: any) => ({
            id: `live-${it.id || Math.random().toString(36).slice(2, 8)}`,
            tag: typeof it.tag === 'string' && it.tag ? it.tag : 'أخبار السوق',
            text: it.source ? `${it.title} (${it.source})` : it.title,
            href:
              typeof it.suggestedHref === 'string' && isSafeTickerHref(it.suggestedHref)
                ? it.suggestedHref
                : '/sections/real-estate',
            active: true,
          }));
        if (mapped.length > 0) {
          setLiveItems(mapped);
        }
      })
      .catch(() => {
        // Keep curated fallback headlines seamlessly if offline or aborted.
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [config?.enabled, config?.autoFeedEnabled]);

  const activeItems = useMemo(() => {
    const curated = (config?.items || []).filter(
      (item): item is NewsTickerItem => Boolean(item && item.active !== false && item.text && item.text.trim())
    );
    if (liveItems.length === 0) return curated;

    const seen = new Set<string>();
    const merged: NewsTickerItem[] = [];
    const interleaveMax = Math.max(liveItems.length, curated.length);
    for (let i = 0; i < interleaveMax; i += 1) {
      for (const candidate of [liveItems[i], curated[i]]) {
        if (!candidate) continue;
        const norm = candidate.text.trim();
        if (seen.has(norm)) continue;
        seen.add(norm);
        merged.push(candidate);
      }
    }
    return merged;
  }, [config?.items, liveItems]);

  // Repeat short lists so a single half always exceeds wide desktop viewports cleanly.
  const baseGroup = useMemo(() => {
    if (activeItems.length === 0) return [];
    const repeatCount = Math.max(1, Math.ceil(6 / activeItems.length));
    const list: Array<NewsTickerItem & { loopKey: string }> = [];
    for (let r = 0; r < repeatCount; r += 1) {
      for (const item of activeItems) {
        list.push({ ...item, loopKey: `${r}-${item.id}` });
      }
    }
    return list;
  }, [activeItems]);

  const speedPxPerSec = useMemo(() => {
    const secs = Number(config?.speedSeconds) || 38;
    return Math.max(28, Math.min(110, Math.round(2200 / Math.max(16, Math.min(90, secs)))));
  }, [config?.speedSeconds]);

  useEffect(() => {
    if (!config?.enabled || baseGroup.length === 0) return;

    const track = trackRef.current;
    const firstGroup = firstGroupRef.current;
    if (!track || !firstGroup) return;

    let halfWidth = firstGroup.getBoundingClientRect().width;
    const updateWidth = () => {
      if (firstGroupRef.current) {
        const w = firstGroupRef.current.getBoundingClientRect().width;
        if (w > 0) halfWidth = w;
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateWidth) : null;
    resizeObserver?.observe(firstGroup);
    window.addEventListener('resize', updateWidth);

    if (offsetRef.current === null && halfWidth > 0) {
      offsetRef.current = -halfWidth;
    }

    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      if (halfWidth <= 0) {
        updateWidth();
      }

      if (!pausedRef.current && halfWidth > 0) {
        let nextOffset = offsetRef.current === null ? -halfWidth : offsetRef.current;
        // Move left -> right in LTR viewport so Arabic sentences enter starting from the right end cleanly.
        nextOffset += speedPxPerSec * dt;
        while (nextOffset >= 0) {
          nextOffset -= halfWidth;
        }
        offsetRef.current = nextOffset;
        track.style.transform = `translate3d(${nextOffset.toFixed(2)}px, 0, 0)`;
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [config?.enabled, baseGroup, speedPxPerSec]);

  if (!config?.enabled || baseGroup.length === 0) return null;

  const renderGroup = (groupKey: string, hidden: boolean) => (
    <div
      ref={hidden ? undefined : firstGroupRef}
      className="phi-ticker-group"
      aria-hidden={hidden || undefined}
    >
      {baseGroup.map((item) => {
        const safeHref = isSafeTickerHref(item.href) ? item.href!.trim() : '';
        const content = (
          <>
            {item.tag && <span className="phi-ticker-tag">{item.tag}</span>}
            <span className="phi-ticker-text">{item.text}</span>
          </>
        );

        return (
          <React.Fragment key={`${groupKey}-${item.loopKey}`}>
            {safeHref ? (
              safeHref.startsWith('http') ? (
                <a
                  href={safeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="phi-ticker-item is-link"
                  tabIndex={hidden ? -1 : undefined}
                >
                  {content}
                </a>
              ) : (
                <Link
                  href={safeHref}
                  className="phi-ticker-item is-link"
                  tabIndex={hidden ? -1 : undefined}
                >
                  {content}
                </Link>
              )
            ) : (
              <span className="phi-ticker-item">{content}</span>
            )}
            <span className="phi-ticker-sep" aria-hidden="true">
              ✦
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <aside
      className={`phi-ticker-bar ${paused ? 'is-paused' : ''}`}
      aria-label={config.label || 'آخر الأخبار والعروض'}
      dir="rtl"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setHoverPaused(true)}
      onBlurCapture={() => setHoverPaused(false)}
    >
      <div className="phi-ticker-badge">
        <span className="phi-ticker-dot" aria-hidden="true" />
        <span>{config.label || 'آخر الأخبار'}</span>
      </div>

      <div className="phi-ticker-viewport" dir="ltr">
        <div ref={trackRef} className="phi-ticker-track">
          {renderGroup('g1', false)}
          {renderGroup('g2', true)}
        </div>
      </div>

      <button
        type="button"
        className="phi-ticker-toggle"
        onClick={() => setPaused((prev) => !prev)}
        aria-pressed={paused}
        aria-label={paused ? 'تشغيل شريط الأخبار' : 'إيقاف شريط الأخبار مؤقتاً'}
        title={paused ? 'تشغيل الشريط' : 'إيقاف مؤقت'}
      >
        {paused ? '▶' : '❚❚'}
      </button>
    </aside>
  );
}
