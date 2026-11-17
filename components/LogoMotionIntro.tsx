'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

let introPlayedThisPageLoad = false;

const INTRO_CSS = `
@keyframes phiLmiLeftConverge {
  0% {
    opacity: 0;
    transform: translate3d(-24%, 0, 0) scale(1.06) rotate(-2.4deg);
  }
  20% {
    opacity: 1;
    transform: translate3d(-15%, 0, 0) scale(1.02) rotate(-0.6deg);
  }
  52% {
    opacity: 1;
    transform: translate3d(2.02%, 0, 0) scale(1.032) rotate(0deg);
  }
  64%, 100% {
    opacity: 1;
    transform: translate3d(1.98%, 0, 0) scale(1) rotate(0deg);
  }
}

@keyframes phiLmiRightConverge {
  0% {
    opacity: 0;
    transform: translate3d(24%, 0, 0) scale(1.06) rotate(2.4deg);
  }
  20% {
    opacity: 1;
    transform: translate3d(15%, 0, 0) scale(1.02) rotate(0.6deg);
  }
  52% {
    opacity: 1;
    transform: translate3d(-2.02%, 0, 0) scale(1.032) rotate(0deg);
  }
  64%, 100% {
    opacity: 1;
    transform: translate3d(-1.98%, 0, 0) scale(1) rotate(0deg);
  }
}

@keyframes phiLmiSeamBeam {
  0% {
    opacity: 0;
    transform: translateX(-50%) scaleY(0.25) scaleX(2.4);
  }
  20% {
    opacity: 0.72;
    transform: translateX(-50%) scaleY(0.86) scaleX(1.3);
  }
  51% {
    opacity: 1;
    transform: translateX(-50%) scaleY(1.12) scaleX(1.75);
  }
  64% {
    opacity: 0.42;
    transform: translateX(-50%) scaleY(0.95) scaleX(0.7);
  }
  84%, 100% {
    opacity: 0;
    transform: translateX(-50%) scaleY(0.6) scaleX(0.4);
  }
}

@keyframes phiLmiImpactRing {
  0%, 49% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.32);
  }
  54% {
    opacity: 0.86;
    transform: translate(-50%, -50%) scale(0.65);
  }
  84%, 100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.75);
  }
}

@keyframes phiLmiSheenSweep {
  0%, 54% {
    opacity: 0;
    transform: translate3d(-135%, 0, 0) skewX(-22deg);
  }
  62% {
    opacity: 0.85;
  }
  86%, 100% {
    opacity: 0;
    transform: translate3d(175%, 0, 0) skewX(-22deg);
  }
}

@keyframes phiLmiWordmarkReveal {
  0%, 38% {
    opacity: 0;
    transform: translate3d(0, 12px, 0) scale(0.96);
  }
  64%, 100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes phiLmiProgress {
  0% { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}

@keyframes phiLmiAuraPulse {
  0%, 100% { opacity: 0.7; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1.06); }
}

.phi-lmi-veil {
  position: fixed;
  inset: 0;
  z-index: 99990;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(880px 540px at 50% 45%, rgba(255, 253, 249, 0.97) 0%, rgba(247, 242, 234, 0.96) 58%, rgba(240, 233, 222, 0.93) 100%);
  backdrop-filter: blur(20px) saturate(145%);
  -webkit-backdrop-filter: blur(20px) saturate(145%);
  opacity: 1;
  transition: opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.08s, backdrop-filter 0.65s ease 0.08s;
  direction: rtl;
  font-family: 'Cairo', -apple-system, 'Segoe UI', sans-serif;
  overflow: hidden;
}
.phi-lmi-veil.is-docking {
  opacity: 0;
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  pointer-events: none;
}

.phi-lmi-aura {
  position: absolute;
  width: min(520px, 88vw);
  height: min(360px, 52vh);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(201, 119, 45, 0.17) 0%, rgba(224, 141, 60, 0.06) 48%, transparent 74%);
  filter: blur(22px);
  pointer-events: none;
  animation: phiLmiAuraPulse 2.5s ease-in-out infinite;
  transition: opacity 0.32s ease;
}
.phi-lmi-veil.is-docking .phi-lmi-aura {
  opacity: 0;
}

.phi-lmi-stage {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.phi-lmi-emblem {
  position: relative;
  direction: ltr;
  width: clamp(190px, 34vw, 244px);
  aspect-ratio: 458 / 442;
  will-change: transform, opacity;
  overflow: visible;
}

.phi-lmi-half {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
  user-select: none;
  will-change: transform, opacity;
}

/* Exact geometric split along x = 293.05 (51.98% of 458-unit viewBox) between the twin towers */
.phi-lmi-half.is-left {
  clip-path: inset(0 48.02% 0 0);
  animation: phiLmiLeftConverge 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.phi-lmi-half.is-right {
  clip-path: inset(0 0 0 51.98%);
  animation: phiLmiRightConverge 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.phi-lmi-seam {
  position: absolute;
  left: 51.98%;
  top: 4%;
  bottom: 4%;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(180deg, transparent 0%, rgba(255, 212, 160, 0.85) 24%, #ff9336 50%, rgba(255, 212, 160, 0.85) 76%, transparent 100%);
  box-shadow: 0 0 18px 4px rgba(224, 90, 16, 0.55), 0 0 36px 8px rgba(245, 166, 78, 0.32);
  pointer-events: none;
  animation: phiLmiSeamBeam 2.5s ease-out forwards;
}

.phi-lmi-ring {
  position: absolute;
  left: 51.98%;
  top: 50%;
  width: 82%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1.5px solid rgba(199, 85, 23, 0.42);
  background: radial-gradient(circle, rgba(255, 198, 130, 0.22) 0%, transparent 62%);
  pointer-events: none;
  animation: phiLmiImpactRing 2.5s ease-out forwards;
}

.phi-lmi-sheen-wrap {
  position: absolute;
  inset: -6%;
  overflow: hidden;
  pointer-events: none;
  border-radius: 50%;
}
.phi-lmi-sheen {
  position: absolute;
  inset: 0;
  width: 44%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.62), transparent);
  animation: phiLmiSheenSweep 2.5s ease-out forwards;
}

.phi-lmi-wordmark {
  position: relative;
  direction: ltr;
  width: clamp(176px, 30vw, 224px);
  aspect-ratio: 464 / 382;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  animation: phiLmiWordmarkReveal 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  transition: opacity 0.26s ease, transform 0.26s ease;
}
.phi-lmi-wordmark-img {
  position: absolute;
  top: -5%;
  right: 0;
  width: 198.3%;
  max-width: none;
  height: auto;
  display: block;
  pointer-events: none;
  user-select: none;
}
.phi-lmi-veil.is-docking .phi-lmi-wordmark {
  opacity: 0 !important;
  transform: translate3d(0, 8px, 0) scale(0.92);
}

.phi-lmi-footer {
  position: relative;
  z-index: 2;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  transition: opacity 0.24s ease, transform 0.24s ease;
}
.phi-lmi-veil.is-docking .phi-lmi-footer {
  opacity: 0;
  transform: translateY(8px);
}

.phi-lmi-progress-track {
  width: 170px;
  height: 2.5px;
  border-radius: 999px;
  background: rgba(199, 85, 23, 0.14);
  overflow: hidden;
}
.phi-lmi-progress-fill {
  width: 100%;
  height: 100%;
  transform-origin: right center;
  background: linear-gradient(90deg, #e08d3c, #c75517);
  animation: phiLmiProgress 2.55s cubic-bezier(0.25, 0.8, 0.45, 1) forwards;
}

.phi-lmi-tagline {
  font-size: 0.82rem;
  font-weight: 800;
  color: #47525c;
  letter-spacing: 0.01em;
}

.phi-lmi-skip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(199, 85, 23, 0.24);
  background: rgba(255, 255, 255, 0.88);
  color: #14181b;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 20px -10px rgba(20, 24, 27, 0.18);
  transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}
.phi-lmi-skip:hover {
  background: #c75517;
  border-color: #c75517;
  color: #ffffff;
  transform: translateY(-1px);
}

@media (max-width: 680px) {
  .phi-lmi-emblem {
    width: clamp(156px, 44vw, 196px);
  }
  .phi-lmi-wordmark {
    width: clamp(160px, 44vw, 198px);
  }
  .phi-lmi-tagline {
    font-size: 0.76rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .phi-lmi-veil,
  .phi-lmi-half,
  .phi-lmi-seam,
  .phi-lmi-ring,
  .phi-lmi-sheen,
  .phi-lmi-wordmark,
  .phi-lmi-progress-fill,
  .phi-lmi-aura {
    animation: none !important;
    transition: none !important;
  }
}
`;

export interface LogoMotionIntroProps {
  /** Incrementing counter triggers replaying the logo motion on demand. */
  replayCount?: number;
  logoSrc?: string;
  lockupSrc?: string;
}

/**
 * Ultra-lightweight cinematic split-logo intro using the static vector brand image.
 * Both halves of the PhiTech emblem start separated across the center seam,
 * magnetically converge together with a copper fusion flash, reveal the lockup,
 * and dock smoothly along a spring arc into `.pw-header .pw-brand-mark`.
 */
export default function LogoMotionIntro({
  replayCount = 0,
  logoSrc = '/brand/phitech-mark-color.svg',
  lockupSrc = '/brand/phitech-lockup-color.svg',
}: LogoMotionIntroProps) {
  const [phase, setPhase] = useState<'playing' | 'docking' | 'done'>(() => {
    if (introPlayedThisPageLoad) return 'done';
    return 'playing';
  });
  const [runId, setRunId] = useState(0);

  const emblemRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const lastReplayRef = useRef(replayCount);
  const timersRef = useRef<number[]>([]);
  const animRef = useRef<Animation | null>(null);

  const clearScheduled = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
      replayCount === 0
    ) {
      introPlayedThisPageLoad = true;
      setPhase('done');
    }
    return () => {
      clearScheduled();
      animRef.current?.cancel();
    };
  }, [clearScheduled, replayCount]);

  const startDocking = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    introPlayedThisPageLoad = true;
    clearScheduled();
    setPhase('docking');

    const emblem = emblemRef.current;
    const brandTarget =
      (document.querySelector('.pw-header .pw-brand-mark') as HTMLElement | null) ||
      (document.querySelector('.pw-header .pw-brand') as HTMLElement | null);

    let dx = 0;
    let dy = -260;
    let scale = 0.2;

    if (emblem && brandTarget) {
      const sRect = emblem.getBoundingClientRect();
      const tRect = brandTarget.getBoundingClientRect();
      if (sRect.width > 0 && tRect.width > 0) {
        const sCx = sRect.left + sRect.width / 2;
        const sCy = sRect.top + sRect.height / 2;
        const tCx = tRect.left + tRect.width / 2;
        const tCy = tRect.top + tRect.height / 2;
        dx = tCx - sCx;
        dy = tCy - sCy;
        scale = Math.max(0.14, Math.min(0.35, tRect.height / sRect.height));
      }
    }

    if (emblem && typeof emblem.animate === 'function') {
      animRef.current?.cancel();
      animRef.current = emblem.animate(
        [
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: 0 },
          { transform: 'translate3d(0, 6px, 0) scale(1.05)', opacity: 1, offset: 0.14 },
          {
            transform: `translate3d(${(dx * 0.68).toFixed(1)}px, ${(dy * 0.48).toFixed(1)}px, 0) scale(${((1 + scale) * 0.44).toFixed(3)})`,
            opacity: 0.96,
            offset: 0.58,
          },
          {
            transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`,
            opacity: 0,
            offset: 1,
          },
        ],
        {
          duration: 820,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        }
      );
    }

    const brandWrap = document.querySelector('.pw-header .pw-brand');
    const arriveTimer = window.setTimeout(() => {
      brandWrap?.classList.add('phi-brand-landed');
    }, 610);
    const cleanupPulseTimer = window.setTimeout(() => {
      brandWrap?.classList.remove('phi-brand-landed');
    }, 1780);
    const doneTimer = window.setTimeout(() => {
      setPhase('done');
    }, 840);

    timersRef.current.push(arriveTimer, cleanupPulseTimer, doneTimer);
  }, [clearScheduled]);

  useEffect(() => {
    if (replayCount > 0 && replayCount !== lastReplayRef.current) {
      lastReplayRef.current = replayCount;
      clearScheduled();
      animRef.current?.cancel();
      setRunId((n) => n + 1);
      setPhase('playing');
    }
  }, [replayCount, clearScheduled]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const dockTimer = window.setTimeout(() => {
      startDocking();
    }, 2560);
    timersRef.current.push(dockTimer);
    return () => {
      window.clearTimeout(dockTimer);
    };
  }, [phase, runId, startDocking]);

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

      <div key={runId} className="phi-lmi-stage">
        <div ref={emblemRef} className="phi-lmi-emblem">
          <div className="phi-lmi-ring" aria-hidden="true" />
          <div className="phi-lmi-seam" aria-hidden="true" />
          <img
            src={logoSrc}
            alt="شعار فاي تك"
            className="phi-lmi-half is-left"
            decoding="sync"
            draggable={false}
          />
          <img
            src={logoSrc}
            alt=""
            aria-hidden="true"
            className="phi-lmi-half is-right"
            decoding="sync"
            draggable={false}
          />
          <div className="phi-lmi-sheen-wrap" aria-hidden="true">
            <div className="phi-lmi-sheen" />
          </div>
        </div>

        <div className="phi-lmi-wordmark" aria-hidden="true">
          <img
            src={lockupSrc}
            alt="فاي تك للمقاولات والتوريدات PhiTech"
            className="phi-lmi-wordmark-img"
            decoding="sync"
            draggable={false}
          />
        </div>
      </div>

      <div className="phi-lmi-footer">
        <div className="phi-lmi-progress-track" aria-hidden="true">
          <div key={runId} className="phi-lmi-progress-fill" />
        </div>
        <span className="phi-lmi-tagline">نبني الهيكل بدقة… ونتقن التشطيب بفخامة</span>
        <button type="button" className="phi-lmi-skip" onClick={startDocking}>
          <span>دخول للموقع</span>
          <span aria-hidden="true">←</span>
        </button>
      </div>
    </div>
  );
}
