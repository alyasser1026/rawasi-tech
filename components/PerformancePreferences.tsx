"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'fai-tech:performance-mode';
const PerformanceContext = createContext<{ fastMode: boolean; ready: boolean; toggle: () => void } | null>(null);

export function detectLowEndDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const conn = nav.connection;
    if (conn && (conn.saveData || /2g/i.test(conn.effectiveType || ''))) return true;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true;
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true;
  } catch {
    // Ignore unsupported browser hints
  }
  return false;
}

export function PerformancePreferences({ children }: { children: React.ReactNode }) {
  const [fastMode, setFastMode] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('low-graphics-mode');
    }
    return false;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const readPreference = () => {
      let preference: string | null = null;
      try {
        preference = localStorage.getItem(STORAGE_KEY);
      } catch {
        /* Use system/hardware preference when storage is blocked. */
      }
      setFastMode(
        preference === 'fast' ||
          (preference !== 'standard' && (media.matches || detectLowEndDevice()))
      );
      setReady(true);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) readPreference();
    };
    readPreference();
    media.addEventListener('change', readPreference);
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', readPreference);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle('low-graphics-mode', fastMode);
    window.dispatchEvent(new CustomEvent('phi-performance-mode-change', { detail: fastMode }));
  }, [fastMode, ready]);

  const toggle = useCallback(() => {
    const next = !fastMode;
    setFastMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'fast' : 'standard');
    } catch {
      /* Keep the current session usable. */
    }
  }, [fastMode]);

  return (
    <PerformanceContext.Provider value={{ fastMode, ready, toggle }}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformancePreferences() {
  const context = useContext(PerformanceContext);
  if (!context) throw new Error('PerformancePreferences is required');
  return context;
}
