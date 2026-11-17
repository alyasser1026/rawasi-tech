'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

let introPlayedThisPageLoad = false;

const INTRO_CSS = `
.phi-lmi-veil {
  position: fixed;
  inset: 0;
  z-index: 99990;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(760px 460px at 50% 46%, rgba(30, 22, 16, 0.96) 0%, #090b0f 74%);
  opacity: 1;
  transition: opacity 0.72s cubic-bezier(0.22, 1, 0.36, 1);
  direction: rtl;
  font-family: 'Cairo', -apple-system, 'Segoe UI', sans-serif;
  overflow: hidden;
}
.phi-lmi-veil.is-docking {
  opacity: 0;
  pointer-events: none;
}

.phi-lmi-aura {
  position: absolute;
  width: min(640px, 92vw);
  height: min(420px, 60vh);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(201, 119, 45, 0.22) 0%, rgba(224, 141, 60, 0.06) 48%, transparent 72%);
  filter: blur(22px);
  pointer-events: none;
  transition: opacity 0.45s ease;
}
.phi-lmi-veil.is-docking .phi-lmi-aura {
  opacity: 0;
}

.phi-lmi-stage {
  position: relative;
  width: min(740px, 92vw);
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate3d(0, 0, 0) scale(1);
  opacity: 1;
  will-change: transform, opacity;
  transition:
    transform 0.82s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.46s ease 0.34s,
    border-radius 0.5s ease;
}

.phi-lmi-media {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 24px;
  -webkit-mask-image: radial-gradient(ellipse 76% 74% at 50% 50%, #000 56%, rgba(0, 0, 0, 0.65) 78%, transparent 99%);
  mask-image: radial-gradient(ellipse 76% 74% at 50% 50%, #000 56%, rgba(0, 0, 0, 0.65) 78%, transparent 99%);
}

.phi-lmi-poster,
.phi-lmi-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}
.phi-lmi-video {
  opacity: 0;
  transition: opacity 0.35s ease;
}
.phi-lmi-video.is-ready {
  opacity: 1;
}

.phi-lmi-bar {
  position: relative;
  z-index: 2;
  margin-top: 18px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: opacity 0.28s ease, transform 0.28s ease;
}
.phi-lmi-veil.is-docking .phi-lmi-bar {
  opacity: 0;
  transform: translateY(8px);
}

.phi-lmi-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 0;
  background: rgba(255, 255, 255, 0.09);
  color: #f1f5f9;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}
.phi-lmi-btn:hover {
  background: rgba(201, 119, 45, 0.28);
  color: #fff;
}
.phi-lmi-btn.is-skip {
  background: linear-gradient(135deg, #c75517 0%, #e07228 100%);
  color: #ffffff;
}
.phi-lmi-btn.is-skip:hover {
  filter: brightness(1.08);
}

@media (max-width: 680px) {
  .phi-lmi-stage {
    width: 96vw;
  }
  .phi-lmi-btn {
    height: 32px;
    padding: 0 12px;
    font-size: 0.76rem;
  }
}
`;

export interface LogoMotionIntroProps {
  /** Incrementing counter triggers replaying the logo motion on demand. */
  replayCount?: number;
  videoSrc?: string;
  posterSrc?: string;
}

/**
 * Full-screen PhiTech molten-copper logo intro that plays once on page load
 * (or on manual replay) and smoothly flies/docks into the navbar brand mark,
 * uncovering the luminous Pearl website beneath.
 */
export default function LogoMotionIntro({
  replayCount = 0,
  videoSrc = '/brand/logo-intro.mp4',
  posterSrc = '/brand/logo-intro-poster.webp',
}: LogoMotionIntroProps) {
  const [phase, setPhase] = useState<'playing' | 'docking' | 'done'>(() => {
    if (introPlayedThisPageLoad) return 'done';
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return 'done';
    }
    return 'playing';
  });
  const [videoReady, setVideoReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [dockTransform, setDockTransform] = useState<string>('translate3d(0, 0, 0) scale(1)');

  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const mutedRef = useRef(isMuted);
  mutedRef.current = isMuted;
  const lastReplayRef = useRef(replayCount);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const startDocking = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    introPlayedThisPageLoad = true;

    const stage = stageRef.current;
    const brandTarget =
      (document.querySelector('.pw-header .pw-brand-mark') as HTMLElement | null) ||
      (document.querySelector('.pw-header .pw-brand') as HTMLElement | null);

    if (stage && brandTarget) {
      const sRect = stage.getBoundingClientRect();
      const tRect = brandTarget.getBoundingClientRect();
      if (sRect.width > 0 && tRect.width > 0) {
        const sCx = sRect.left + sRect.width / 2;
        const sCy = sRect.top + sRect.height / 2;
        const tCx = tRect.left + tRect.width / 2;
        const tCy = tRect.top + tRect.height / 2;
        const dx = tCx - sCx;
        const dy = tCy - sCy;
        const scale = Math.max(0.08, Math.min(0.24, (tRect.height * 1.45) / sRect.height));
        setDockTransform(`translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`);
      }
    }

    setPhase('docking');

    const brandWrap = document.querySelector('.pw-header .pw-brand');
    const arriveTimer = window.setTimeout(() => {
      brandWrap?.classList.add('phi-brand-landed');
    }, 520);
    const cleanupPulseTimer = window.setTimeout(() => {
      brandWrap?.classList.remove('phi-brand-landed');
    }, 1750);
    const doneTimer = window.setTimeout(() => {
      setPhase('done');
    }, 860);

    timersRef.current.push(arriveTimer, cleanupPulseTimer, doneTimer);
  }, []);

  // Trigger manual replay when replayCount increments
  useEffect(() => {
    if (replayCount > 0 && replayCount !== lastReplayRef.current) {
      lastReplayRef.current = replayCount;
      setDockTransform('translate3d(0, 0, 0) scale(1)');
      setVideoReady(false);
      setPhase('playing');
    }
  }, [replayCount]);

  // Playback + failsafe dock timer whenever phase enters 'playing'
  useEffect(() => {
    if (phase !== 'playing') return;

    const video = videoRef.current;
    if (video) {
      video.muted = mutedRef.current;
      try {
        video.currentTime = 0;
      } catch {
        // Ignore seek errors before metadata loads
      }
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay blocked: still settle smoothly after poster showcase
        });
      }
    }

    const failsafeTimer = window.setTimeout(() => {
      startDocking();
    }, 4500);

    return () => {
      window.clearTimeout(failsafeTimer);
    };
  }, [phase, startDocking]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase !== 'playing') return;
    video.muted = isMuted;
    if (!isMuted && video.paused) {
      video.play().catch(() => {});
    }
  }, [isMuted, phase]);

  if (phase === 'done') return null;

  return (
    <div
      className={`phi-lmi-veil ${phase === 'docking' ? 'is-docking' : ''}`}
      role="dialog"
      aria-modal={phase === 'playing'}
      aria-label="افتتاحية شعار فاي تك المتحرك"
    >
      <style>{INTRO_CSS}</style>
      <div className="phi-lmi-aura" aria-hidden="true" />

      <div
        ref={stageRef}
        className="phi-lmi-stage"
        style={phase === 'docking' ? { transform: dockTransform, opacity: 0 } : undefined}
      >
        <div className="phi-lmi-media">
          <img src={posterSrc} alt="شعار فاي تك — PhiTech" className="phi-lmi-poster" />
          <video
            ref={videoRef}
            src={videoSrc}
            poster={posterSrc}
            autoPlay
            muted={isMuted}
            playsInline
            preload="auto"
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            onTimeUpdate={(e) => {
              if (e.currentTarget.currentTime >= 3.88) {
                startDocking();
              }
            }}
            onEnded={startDocking}
            className={`phi-lmi-video ${videoReady ? 'is-ready' : ''}`}
          />
        </div>
      </div>

      <div className="phi-lmi-bar">
        <button
          type="button"
          className="phi-lmi-btn"
          onClick={() => setIsMuted((m) => !m)}
          aria-label={isMuted ? 'تشغيل صوت الشعار' : 'كتم الصوت'}
        >
          {isMuted ? '🔊 تشغيل الصوت' : '🔇 كتم الصوت'}
        </button>
        <button
          type="button"
          className="phi-lmi-btn is-skip"
          onClick={startDocking}
        >
          <span>دخول للموقع</span>
          <span aria-hidden="true">←</span>
        </button>
      </div>
    </div>
  );
}
