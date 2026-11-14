"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Skip automated tests / webdrivers
    if (navigator.webdriver) return;

    // Define public routes to track
    const isPublic =
      pathname === '/' ||
      pathname === '/website' ||
      pathname === '/login' ||
      pathname?.startsWith('/verify');

    if (!isPublic) return;

    // Check session deduplication: one notification per browser session
    try {
      const alreadyLogged = sessionStorage.getItem('phi_site_visit_logged');
      if (alreadyLogged) return;
      sessionStorage.setItem('phi_site_visit_logged', String(Date.now()));
    } catch {
      // Ignore private browsing storage errors
    }

    // Dispatch visit notification non-blocking
    try {
      const payload = {
        path: pathname || window.location.pathname,
        referrer: document.referrer || '',
        screen: `${window.innerWidth}×${window.innerHeight}`,
      };

      fetch('/api/notify/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Fail silently
    }
  }, [pathname]);

  return null;
}
