"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { NewsTickerConfig, NewsTickerItem } from './site-content';

function isSafeTickerHref(href?: string): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    /^https?:\/\//i.test(trimmed)
  );
}

/**
 * Seamless infinite scrolling news & offers ticker strip for the public home screen.
 * Duplicates the normalized sequence so the track loops smoothly without gaps or jumps,
 * pauses on hover/focus, and exposes an accessible play/pause control.
 */
export default function NewsTicker({ config }: { config: NewsTickerConfig }) {
  const [paused, setPaused] = useState(false);

  const activeItems = useMemo(
    () =>
      (config?.items || []).filter(
        (item): item is NewsTickerItem => Boolean(item && item.active !== false && item.text && item.text.trim())
      ),
    [config?.items]
  );

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

  if (!config?.enabled || baseGroup.length === 0) return null;

  const durationSec = Math.max(16, Math.min(90, Number(config.speedSeconds) || Math.max(26, baseGroup.length * 6)));

  const renderGroup = (groupKey: string, hidden: boolean) => (
    <div className="phi-ticker-group" aria-hidden={hidden || undefined}>
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
    >
      <div className="phi-ticker-badge">
        <span className="phi-ticker-dot" aria-hidden="true" />
        <span>{config.label || 'آخر الأخبار'}</span>
      </div>

      <div className="phi-ticker-viewport">
        <div
          className="phi-ticker-track"
          dir="ltr"
          style={{ ['--phi-ticker-duration' as string]: `${durationSec}s` } as React.CSSProperties}
        >
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
