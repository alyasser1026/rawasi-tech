'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type HeroVideoControlsState = {
  isReady: boolean;
  isPaused: boolean;
  isMuted: boolean;
  togglePlay: () => void;
  toggleMute: () => void;
};

export type HeroVideoBackdropProps = {
  videoSrc?: string;
  posterSrc?: string;
  /**
   * - 'showcase-left': RTL hero composition keeping high-contrast scrim behind right-side copy
   *   and showcasing the 16:9 video cleanly across the left visual stage on desktop.
   * - 'full': full-bleed ambient hero backdrop tuned for multi-column pages.
   */
  variant?: 'showcase-left' | 'full';
  /** Scrim tone for contrast compatibility ('dark' default obsidian, 'light' warm ceramic veil). */
  tone?: 'dark' | 'light';
  /** 'corner' anchors floating controls in bottom-left; 'none' hides built-in corner controls so parent can place HeroVideoControls manually. */
  controlsMode?: 'corner' | 'none';
  onControlsReady?: (state: HeroVideoControlsState) => void;
};

const BACKDROP_CSS = `
.phi-hb{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:#090b0f}
.phi-hb.is-light{background:#f7eee2}
.phi-hb-ambient{position:absolute;inset:0;pointer-events:none;background:radial-gradient(680px 460px at 24% 48%,rgba(249,115,22,.22),transparent 72%),radial-gradient(520px 380px at 78% 12%,rgba(56,189,248,.08),transparent 70%)}
.phi-hb.is-light .phi-hb-ambient{background:radial-gradient(680px 460px at 24% 48%,rgba(249,115,22,.16),transparent 72%),radial-gradient(520px 380px at 78% 12%,rgba(217,119,6,.08),transparent 70%)}

.phi-hb-stage{position:absolute;top:0;bottom:0;left:0;width:100%;overflow:hidden}
.phi-hb.is-showcase-left .phi-hb-stage{left:max(0px,calc(50% - 760px));width:min(980px,68vw);-webkit-mask-image:linear-gradient(90deg,#000 0%,#000 58%,rgba(0,0,0,.58) 80%,transparent 100%);mask-image:linear-gradient(90deg,#000 0%,#000 58%,rgba(0,0,0,.58) 80%,transparent 100%)}
@media (min-width:1540px){
  .phi-hb.is-showcase-left .phi-hb-stage{-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 16%,#000 62%,rgba(0,0,0,.58) 82%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0%,#000 16%,#000 62%,rgba(0,0,0,.58) 82%,transparent 100%)}
}

.phi-hb-poster,.phi-hb-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 48%;transform:scale(1.02);pointer-events:none;user-select:none}
.phi-hb-video{opacity:0;transition:opacity .9s cubic-bezier(.22,1,.36,1),filter .5s ease;filter:saturate(1.08) contrast(1.04)}
.phi-hb-video.is-ready{opacity:1}
.phi-hb.is-light .phi-hb-video{opacity:0;filter:saturate(.95) contrast(1.02)}
.phi-hb.is-light .phi-hb-video.is-ready{opacity:.28}
.phi-hb.is-light .phi-hb-poster{opacity:.24}

.phi-hb-scrim{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(270deg,rgba(9,11,15,.95) 0%,rgba(9,11,15,.84) 34%,rgba(9,11,15,.44) 56%,rgba(9,11,15,.12) 78%,rgba(9,11,15,.26) 100%),linear-gradient(180deg,rgba(9,11,15,.54) 0%,transparent 20%,transparent 72%,rgba(9,11,15,.92) 100%)}
.phi-hb.is-full .phi-hb-scrim{background:radial-gradient(64rem 42rem at 28% 45%,rgba(12,9,7,.42),rgba(12,9,7,.84) 72%),linear-gradient(270deg,rgba(12,9,7,.92) 0%,rgba(12,9,7,.68) 46%,rgba(12,9,7,.45) 100%),linear-gradient(180deg,rgba(12,9,7,.48) 0%,transparent 24%,rgba(12,9,7,.9) 100%)}
.phi-hb.is-light .phi-hb-scrim{background:linear-gradient(270deg,rgba(247,238,226,.92) 0%,rgba(247,238,226,.8) 52%,rgba(247,238,226,.68) 100%),linear-gradient(180deg,rgba(247,238,226,.72) 0%,transparent 25%,rgba(247,238,226,.92) 100%)}

.phi-hb-grid{position:absolute;inset:0;z-index:2;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:linear-gradient(180deg,#000 0%,transparent 88%);mask-image:linear-gradient(180deg,#000 0%,transparent 88%)}
.phi-hb.is-light .phi-hb-grid{background-image:linear-gradient(rgba(199,85,23,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(199,85,23,.06) 1px,transparent 1px)}

.phi-hb-hud{display:inline-flex;align-items:center;gap:6px;padding:5px;border-radius:999px;background:rgba(10,13,18,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.15),0 12px 28px -10px rgba(0,0,0,.75);pointer-events:auto;direction:rtl}
.phi-hb-hud.is-corner{position:absolute;left:24px;bottom:20px;z-index:25}
.phi-hb-btn{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border:0;margin:0;appearance:none;-webkit-appearance:none;border-radius:999px;background:rgba(255,255,255,.08);color:#e2e8f0;font-family:'Cairo',system-ui,sans-serif;font-size:.78rem;font-weight:700;line-height:1;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);transition:background .18s,color .18s,box-shadow .18s,transform .18s}
.phi-hb-btn:hover{background:rgba(249,115,22,.22);color:#fff;box-shadow:inset 0 0 0 1px rgba(249,115,22,.55);transform:translateY(-1px)}
.phi-hb-btn.is-icon{width:34px;padding:0;justify-content:center}
.phi-hb-btn.is-active{background:rgba(249,115,22,.26);color:#fed7aa;box-shadow:inset 0 0 0 1px rgba(249,115,22,.65)}
.phi-hb-dot{width:7px;height:7px;border-radius:50%;background:#f97316;box-shadow:0 0 8px #f97316}
.phi-hb-dot.is-off{background:#94a3b8;box-shadow:none}

@media (max-width:960px){
  .phi-hb.is-showcase-left .phi-hb-stage{left:0;width:100%;-webkit-mask-image:none;mask-image:none}
  .phi-hb.is-showcase-left .phi-hb-scrim{background:linear-gradient(180deg,rgba(9,11,15,.35) 0%,transparent 20%,transparent 72%,rgba(9,11,15,.96) 100%),radial-gradient(ellipse at center,transparent 40%,rgba(9,11,15,.45) 100%)}
  .phi-hb-hud.is-corner{left:14px;bottom:14px}
}
@media print{
  .phi-hb,.phi-hb-hud{display:none!important}
}
`;

export function HeroVideoControls({
  controls,
  className = '',
}: {
  controls: HeroVideoControlsState;
  className?: string;
}) {
  return (
    <div className={`phi-hb-hud ${className}`.trim()} role="group" aria-label="التحكم في فيديو الخلفية">
      <button
        type="button"
        onClick={controls.toggleMute}
        className={`phi-hb-btn ${!controls.isMuted ? 'is-active' : ''}`}
        aria-label={controls.isMuted ? 'تشغيل صوت الفيديو' : 'كتم صوت الفيديو'}
        title={controls.isMuted ? 'تشغيل صوت الفيديو' : 'كتم صوت الفيديو'}
      >
        <span className={`phi-hb-dot ${controls.isMuted ? 'is-off' : ''}`} aria-hidden="true" />
        {controls.isMuted ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
        <span>{controls.isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}</span>
      </button>

      <button
        type="button"
        onClick={controls.togglePlay}
        className="phi-hb-btn is-icon"
        aria-label={controls.isPaused ? 'تشغيل فيديو الخلفية' : 'إيقاف فيديو الخلفية مؤقتاً'}
        title={controls.isPaused ? 'تشغيل الفيديو' : 'إيقاف مؤقت'}
      >
        {controls.isPaused ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function HeroVideoBackdrop({
  videoSrc = '/brand/hero-bg.mp4',
  posterSrc = '/brand/hero-video-poster.webp',
  variant = 'showcase-left',
  tone = 'dark',
  controlsMode = 'corner',
  onControlsReady,
}: HeroVideoBackdropProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onControlsReadyRef = useRef(onControlsReady);
  onControlsReadyRef.current = onControlsReady;

  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.readyState >= 2) {
      setIsReady(true);
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      video.pause();
      setIsPaused(true);
      return;
    }

    video.muted = true;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setIsPaused(true);
      });
    }
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    if (!isMuted) {
      video.volume = 0.85;
      if (video.paused) {
        video.play().then(() => setIsPaused(false)).catch(() => {});
      }
    }
  }, [isMuted]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPaused(false)).catch(() => {});
    } else {
      video.pause();
      setIsPaused(true);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    onControlsReadyRef.current?.({ isReady, isPaused, isMuted, togglePlay, toggleMute });
  }, [isReady, isPaused, isMuted, togglePlay, toggleMute]);

  const variantClass = variant === 'full' ? 'is-full' : 'is-showcase-left';
  const toneClass = tone === 'light' ? 'is-light' : '';

  return (
    <>
      <style>{BACKDROP_CSS}</style>
      <div className={`phi-hb ${variantClass} ${toneClass}`.trim()} aria-hidden="true">
        <div className="phi-hb-ambient" />
        <div className="phi-hb-stage">
          <img src={posterSrc} alt="" className="phi-hb-poster" />
          <video
            ref={videoRef}
            src={videoSrc}
            poster={posterSrc}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            preload="auto"
            onLoadedData={() => setIsReady(true)}
            onCanPlay={() => setIsReady(true)}
            onPlay={() => setIsPaused(false)}
            onPause={() => setIsPaused(true)}
            className={`phi-hb-video ${isReady ? 'is-ready' : ''}`.trim()}
          />
        </div>
        <div className="phi-hb-scrim" />
        <div className="phi-hb-grid" />
      </div>

      {controlsMode === 'corner' && (
        <HeroVideoControls
          controls={{ isReady, isPaused, isMuted, togglePlay, toggleMute }}
          className="is-corner"
        />
      )}
    </>
  );
}
