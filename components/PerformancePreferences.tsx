"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'fai-tech:performance-mode';
const PerformanceContext = createContext<{ fastMode: boolean; ready: boolean; toggle: () => void } | null>(null);

export function PerformancePreferences({ children }: { children: React.ReactNode }) {
  const [fastMode, setFastMode] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const readPreference = () => {
      let preference: string | null = null;
      try { preference = localStorage.getItem(STORAGE_KEY); } catch { /* Use the system preference when storage is blocked. */ }
      setFastMode(preference === 'fast' || (preference !== 'standard' && media.matches));
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
    if (ready) document.documentElement.classList.toggle('low-graphics-mode', fastMode);
  }, [fastMode, ready]);

  const toggle = useCallback(() => {
    const next = !fastMode;
    setFastMode(next);
    try { localStorage.setItem(STORAGE_KEY, next ? 'fast' : 'standard'); } catch { /* Keep the current session usable. */ }
  }, [fastMode]);

  return <PerformanceContext.Provider value={{ fastMode, ready, toggle }}>{children}</PerformanceContext.Provider>;
}

export function usePerformancePreferences() {
  const context = useContext(PerformanceContext);
  if (!context) throw new Error('PerformancePreferences is required');
  return context;
}
