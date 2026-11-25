"use client";

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { isPublicRoute } from '@/lib/public-routes';
import { ToastProvider } from '@/lib/toast-context';
import { PerformancePreferences } from '@/components/PerformancePreferences';
import VisitorTracker from '@/components/VisitorTracker';

const ErpProvidersShell = dynamic(() => import('@/components/ErpProvidersShell'));
const AuthToaster = dynamic(
  () => import('react-hot-toast').then((m) => m.Toaster),
  { ssr: false }
);

export default function AppShellSwitch({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname);

  useEffect(() => {
    if (!isPublic || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const runSwUpdate = () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((reg) => {
            void reg.update().catch(() => {});
          });
        })
        .catch(() => {});
    };

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const cic = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;

    if (typeof ric === 'function') {
      const idleId = ric(runSwUpdate, { timeout: 2500 });
      return () => {
        if (typeof cic === 'function') cic(idleId);
      };
    }

    const timer = window.setTimeout(runSwUpdate, 1500);
    return () => window.clearTimeout(timer);
  }, [isPublic]);

  if (isPublic) {
    return (
      <ToastProvider>
        <PerformancePreferences>
          <VisitorTracker />
          <AuthToaster
            position="top-center"
            gutter={10}
            containerStyle={{ top: 20, zIndex: 2147483600 }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        </PerformancePreferences>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <PerformancePreferences>
        <ErpProvidersShell>{children}</ErpProvidersShell>
      </PerformancePreferences>
    </ToastProvider>
  );
}
