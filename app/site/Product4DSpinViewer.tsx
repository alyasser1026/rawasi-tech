"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';

interface Product4DSpinViewerProps {
  images?: string[];
  fallbackImage: string;
  alt: string;
  badge?: string;
  code?: string;
  compact?: boolean;
}

export default function Product4DSpinViewer({
  images,
  fallbackImage,
  alt,
  badge,
  code,
  compact = false,
}: Product4DSpinViewerProps) {
  const frames = useMemo(() => {
    const clean = (Array.isArray(images) ? images : [])
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter(Boolean);
    return clean.length > 0 ? clean : [fallbackImage];
  }, [images, fallbackImage]);

  const is4D = frames.length >= 2;
  const [frameIdx, setFrameIdx] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [zoom, setZoom] = useState<1 | 1.8 | 2.6>(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    startIdx: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  useEffect(() => {
    setFrameIdx(0);
    setAutoSpin(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHasInteracted(false);
    setDragging(false);
  }, [frames, fallbackImage]);

  useEffect(() => {
    if (!is4D || typeof window === 'undefined') {
      setLoadedCount(frames.length);
      return;
    }
    let cancelled = false;
    setLoadedCount(0);
    for (const src of frames) {
      const img = new window.Image();
      const bump = () => {
        if (!cancelled) {
          setLoadedCount((prev) => Math.min(frames.length, prev + 1));
        }
      };
      img.onload = bump;
      img.onerror = bump;
      img.src = src;
    }
    return () => {
      cancelled = true;
    };
  }, [frames, is4D]);

  useEffect(() => {
    if (!autoSpin || !is4D || zoom > 1 || typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const lowMode = document.documentElement.classList.contains('low-graphics-mode');
    if (reduced || lowMode) {
      setAutoSpin(false);
      return;
    }
    const timer = window.setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % frames.length);
    }, 170);
    return () => window.clearInterval(timer);
  }, [autoSpin, is4D, zoom, frames.length]);

  const currentSrc = frames[frameIdx % frames.length] || fallbackImage;
  const angleDeg = is4D ? Math.round(((frameIdx % frames.length) / frames.length) * 360) : 0;

  const clampPan = (nx: number, ny: number, z: number) => {
    const stage = stageRef.current;
    const w = stage?.clientWidth || 320;
    const h = stage?.clientHeight || 240;
    const maxX = Math.max(0, ((z - 1) * 0.42) * w);
    const maxY = Math.max(0, ((z - 1) * 0.42) * h);
    return {
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!is4D && zoom === 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setAutoSpin(false);
    setHasInteracted(true);
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startIdx: frameIdx,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStartRef.current;
    if (!ds) return;
    if (zoom > 1) {
      const dx = e.clientX - ds.x;
      const dy = e.clientY - ds.y;
      setPan(clampPan(ds.startPanX + dx, ds.startPanY + dy, zoom));
      return;
    }
    if (!is4D) return;
    const stageWidth = stageRef.current?.clientWidth || 320;
    const pxPerFrame = Math.max(10, Math.round(stageWidth / Math.max(frames.length * 1.15, 10)));
    const deltaFrames = Math.round((e.clientX - ds.x) / pxPerFrame);
    const next = (((ds.startIdx + deltaFrames) % frames.length) + frames.length) % frames.length;
    setFrameIdx(next);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    setDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }
  };

  const handleToggleZoom = () => {
    const next: 1 | 1.8 | 2.6 = zoom === 1 ? 1.8 : zoom === 1.8 ? 2.6 : 1;
    setZoom(next);
    if (next === 1) {
      setPan({ x: 0, y: 0 });
    } else {
      setAutoSpin(false);
      setPan((p) => clampPan(p.x, p.y, next));
    }
  };

  const handleDoubleClick = () => {
    const next: 1 | 1.8 = zoom === 1 ? 1.8 : 1;
    setZoom(next);
    setPan({ x: 0, y: 0 });
    if (next > 1) setAutoSpin(false);
  };

  const stepFrame = (delta: number) => {
    if (!is4D) return;
    setAutoSpin(false);
    setHasInteracted(true);
    setFrameIdx((prev) => (((prev + delta) % frames.length) + frames.length) % frames.length);
  };

  return (
    <div className="pw-4d-wrap">
      <div
        ref={stageRef}
        className={`pw-4d-stage ${is4D ? 'is-4d' : ''} ${dragging ? 'is-dragging' : ''} ${zoom > 1 ? 'is-zoomed' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={currentSrc}
          alt={alt}
          className="pw-4d-img"
          draggable={false}
          style={{
            transform: zoom > 1 ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : undefined,
          }}
        />

        <div className="pw-4d-top-badges">
          {badge && <span className="pw-4d-pill">{badge}</span>}
          {is4D && <span className="pw-4d-pill is-4d-tag">4D · 360°</span>}
          {is4D && (
            <span className="pw-4d-angle" dir="ltr">
              {angleDeg}° ({frameIdx + 1}/{frames.length})
            </span>
          )}
        </div>

        {code && (
          <span className="pw-pd-code" dir="ltr">
            {code}
          </span>
        )}

        {is4D && loadedCount < frames.length && (
          <span className="pw-4d-loading">
            جاري تجهيز زوايا 4D ({loadedCount}/{frames.length})...
          </span>
        )}

        {is4D && !hasInteracted && zoom === 1 && loadedCount >= frames.length && (
          <span className="pw-4d-hint">اسحب يميناً أو يساراً لتدوير القطاع 360°</span>
        )}
      </div>

      <div className="pw-4d-controls">
        {is4D && (
          <>
            <button
              type="button"
              className="pw-4d-btn"
              onClick={() => stepFrame(-1)}
              aria-label="الزاوية السابقة"
              title="الزاوية السابقة"
            >
              ‹
            </button>
            <button
              type="button"
              className={`pw-4d-btn ${autoSpin ? 'is-active' : ''}`}
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                setHasInteracted(true);
                setAutoSpin((s) => !s);
              }}
            >
              {autoSpin ? 'إيقاف' : 'دوران تلقائي'}
            </button>
            <button
              type="button"
              className="pw-4d-btn"
              onClick={() => stepFrame(1)}
              aria-label="الزاوية التالية"
              title="الزاوية التالية"
            >
              ›
            </button>
            <input
              type="range"
              dir="ltr"
              className="pw-4d-slider"
              min={0}
              max={frames.length - 1}
              value={frameIdx}
              aria-label="زاوية دوران القطاع"
              onChange={(e) => {
                setAutoSpin(false);
                setHasInteracted(true);
                setFrameIdx(Number(e.target.value) || 0);
              }}
            />
          </>
        )}

        <button
          type="button"
          className={`pw-4d-btn ${zoom > 1 ? 'is-active' : ''}`}
          onClick={handleToggleZoom}
        >
          {zoom === 1 ? 'تكبير 1.8×' : zoom === 1.8 ? 'تكبير 2.6×' : 'إعادة 1×'}
        </button>
      </div>

      {is4D && !compact && (
        <div className="pw-4d-thumbs" role="listbox" aria-label="زوايا القطاع">
          {frames.map((src, i) => (
            <button
              key={`${src.slice(0, 32)}-${i}`}
              type="button"
              role="option"
              aria-selected={i === frameIdx}
              className={`pw-4d-thumb ${i === frameIdx ? 'is-active' : ''}`}
              onClick={() => {
                setAutoSpin(false);
                setHasInteracted(true);
                setFrameIdx(i);
              }}
              title={`زاوية ${i + 1}`}
            >
              <img src={src} alt={`${alt} - زاوية ${i + 1}`} loading="lazy" />
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
