'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

let introPlayedThisPageLoad = false;

const INTRO_CSS = `
@keyframes phiLmiEnter {
  0% { opacity: 0; transform: translate3d(0, 14px, 0) scale(0.92); }
  100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}
@keyframes phiLmiProgress {
  0% { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}
@keyframes phiLmiAuraPulse {
  0%, 100% { opacity: 0.72; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1.04); }
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
  background: radial-gradient(880px 540px at 50% 45%, rgba(255, 253, 249, 0.96) 0%, rgba(247, 242, 234, 0.95) 58%, rgba(240, 233, 222, 0.92) 100%);
  backdrop-filter: blur(20px) saturate(145%);
  -webkit-backdrop-filter: blur(20px) saturate(145%);
  opacity: 1;
  transition: opacity 0.68s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, backdrop-filter 0.68s ease 0.1s;
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
  width: min(560px, 88vw);
  height: min(360px, 52vh);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(201, 119, 45, 0.16) 0%, rgba(224, 141, 60, 0.06) 46%, transparent 72%);
  filter: blur(20px);
  pointer-events: none;
  animation: phiLmiAuraPulse 2.8s ease-in-out infinite;
  transition: opacity 0.35s ease;
}
.phi-lmi-veil.is-docking .phi-lmi-aura {
  opacity: 0;
}

.phi-lmi-stage {
  position: relative;
  width: min(440px, 86vw);
  aspect-ratio: 400 / 286;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity;
  animation: phiLmiEnter 0.52s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.phi-lmi-gif {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 18px 34px rgba(154, 72, 20, 0.14));
}

.phi-lmi-footer {
  position: relative;
  z-index: 2;
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.phi-lmi-veil.is-docking .phi-lmi-footer {
  opacity: 0;
  transform: translateY(8px);
}

.phi-lmi-progress-track {
  width: 180px;
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
  animation: phiLmiProgress 3.65s cubic-bezier(0.25, 0.8, 0.45, 1) forwards;
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
  background: rgba(255, 255, 255, 0.86);
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
  .phi-lmi-stage {
    width: min(350px, 90vw);
  }
  .phi-lmi-tagline {
    font-size: 0.76rem;
  }
}
`;

export interface LogoMotionIntroProps {
  /** Incrementing counter triggers replaying the logo motion on demand. */
  replayCount?: number;
  gifSrc?: string;
  posterSrc?: string;
}

/**
 * Lightweight transparent PhiTech logo motion intro on a frosted Pearl veil.
 * Plays on entry (or on manual replay) and glides along a spring arc directly
 * into the navbar `.pw-brand-mark` slot.
 */
export default function LogoMotionIntro({
  replayCount = 0,
  gifSrc = '/brand/logo-intro.gif',
  posterSrc = '/brand/logo-intro-poster.webp',
}: LogoMotionIntroProps) {
  const [phase, setPhase] = useState<'playing' | 'docking' | 'done'>(() => {
    if (introPlayedThisPageLoad) return 'done';
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return 'done';
    }
    return 'playing';
  });
  const [runId, setRunId] = useState(0);
  const [gifLoaded, setGifLoaded] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
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
    return () => {
      clearScheduled();
      animRef.current?.cancel();
    };
  }, [clearScheduled]);

  const startDocking = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    introPlayedThisPageLoad = true;
    clearScheduled();
    setPhase('docking');

    const stage = stageRef.current;
    const brandTarget =
      (document.querySelector('.pw-header .pw-brand-mark') as HTMLElement | null) ||
      (document.querySelector('.pw-header .pw-brand') as HTMLElement | null);

    let dx = 0;
    let dy = -260;
    let scale = 0.14;

    if (stage && brandTarget) {
      const sRect = stage.getBoundingClientRect();
      const tRect = brandTarget.getBoundingClientRect();
      if (sRect.width > 0 && tRect.width > 0) {
        const sCx = sRect.left + sRect.width / 2;
        const sCy = sRect.top + sRect.height / 2;
        const tCx = tRect.left + tRect.width / 2;
        const tCy = tRect.top + tRect.height / 2;
        dx = tCx - sCx;
        dy = tCy - sCy;
        scale = Math.max(0.1, Math.min(0.26, (tRect.height * 1.55) / sRect.height));
      }
    }

    if (stage && typeof stage.animate === 'function') {
      animRef.current?.cancel();
      animRef.current = stage.animate(
        [
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: 0 },
          { transform: 'translate3d(0, 7px, 0) scale(1.045)', opacity: 1, offset: 0.14 },
          {
            transform: `translate3d(${(dx * 0.68).toFixed(1)}px, ${(dy * 0.48).toFixed(1)}px, 0) scale(${((1 + scale) * 0.46).toFixed(3)})`,
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
          duration: 860,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        }
      );
    }

    const brandWrap = document.querySelector('.pw-header .pw-brand');
    const arriveTimer = window.setTimeout(() => {
      brandWrap?.classList.add('phi-brand-landed');
    }, 640);
    const cleanupPulseTimer = window.setTimeout(() => {
      brandWrap?.classList.remove('phi-brand-landed');
    }, 1850);
    const doneTimer = window.setTimeout(() => {
      setPhase('done');
    }, 890);

    timersRef.current.push(arriveTimer, cleanupPulseTimer, doneTimer);
  }, [clearScheduled]);

  useEffect(() => {
    if (replayCount > 0 && replayCount !== lastReplayRef.current) {
      lastReplayRef.current = replayCount;
      clearScheduled();
      animRef.current?.cancel();
      setGifLoaded(false);
      setRunId((n) => n + 1);
      setPhase('playing');
    }
  }, [replayCount, clearScheduled]);

  // Safety timeout if network stalls; once GIF paints from frame 0, dock cleanly after its 3.6s sequence
  useEffect(() => {
    if (phase !== 'playing') return;
    const delayMs = gifLoaded ? 3680 : 6500;
    const dockTimer = window.setTimeout(() => {
      startDocking();
    }, delayMs);
    timersRef.current.push(dockTimer);
    return () => {
      window.clearTimeout(dockTimer);
    };
  }, [phase, runId, gifLoaded, startDocking]);

  if (phase === 'done') return null;

  const activeSrc = `${gifSrc}?r=${runId}`;

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
        style={!gifLoaded ? { opacity: 0, transition: 'opacity 0.25s ease' } : undefined}
      >
        <img
          key={runId}
          src={activeSrc}
          alt="شعار فاي تك المتحرك — PhiTech"
          className="phi-lmi-gif"
          onLoad={() => setGifLoaded(true)}
          onError={() => startDocking()}
        />
      </div>

      <div className="phi-lmi-footer">
        {gifLoaded && (
          <div className="phi-lmi-progress-track" aria-hidden="true">
            <div key={runId} className="phi-lmi-progress-fill" />
          </div>
        )}
        <span className="phi-lmi-tagline">فاي تك للمقاولات والتوريدات · نبني الهيكل ونتقن التشطيب</span>
        <button type="button" className="phi-lmi-skip" onClick={startDocking}>
          <span>دخول للموقع</span>
          <span aria-hidden="true">←</span>
        </button>
      </div>
    </div>
  );
}
