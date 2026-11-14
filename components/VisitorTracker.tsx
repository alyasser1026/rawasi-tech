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

    // 1. Check session deduplication: one notification per browser session
    let isNewSession = false;
    try {
      const alreadyLogged = sessionStorage.getItem('phi_site_visit_logged');
      if (!alreadyLogged) {
        sessionStorage.setItem('phi_site_visit_logged', String(Date.now()));
        isNewSession = true;
      }
    } catch {
      isNewSession = true;
    }

    if (isNewSession) {
      // Gather rich metrics
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const utmSource = urlParams.get('utm_source') || urlParams.get('source') || undefined;
        const utmMedium = urlParams.get('utm_medium') || undefined;
        const utmCampaign = urlParams.get('utm_campaign') || urlParams.get('campaign') || undefined;

        const nav = navigator as any;
        const connection = nav?.connection?.effectiveType || undefined;
        const language = navigator.language || undefined;
        let timezone: string | undefined;
        try {
          timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {}

        const payload = {
          path: pathname || window.location.pathname,
          referrer: document.referrer || '',
          screen: `${window.innerWidth}×${window.innerHeight}`,
          language,
          timezone,
          utmSource,
          utmMedium,
          utmCampaign,
          connection,
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
    }

    // 2. Click tracking for conversion actions (e.g. clicking WhatsApp)
    const handleGlobalClick = (e: MouseEvent) => {
      try {
        const target = (e.target as HTMLElement)?.closest('a');
        if (!target) return;

        const href = target.getAttribute('href') || '';
        const isWhatsApp = href.includes('wa.me') || href.includes('whatsapp.com');
        const isPhone = href.startsWith('tel:');

        if (isWhatsApp || isPhone) {
          const actionLabel = isWhatsApp ? 'تواصل معنا عبر واتساب' : 'اتصال هاتفي مباشر';
          const sessionLeadKey = `lead_click_${isWhatsApp ? 'wa' : 'tel'}`;

          // Avoid duplicate alerts within 5 minutes for the same user
          if (sessionStorage.getItem(sessionLeadKey)) return;
          sessionStorage.setItem(sessionLeadKey, String(Date.now()));

          fetch('/api/notify/visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'lead_action',
              action: isWhatsApp ? 'whatsapp_click' : 'phone_call',
              label: actionLabel,
            }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    document.addEventListener('click', handleGlobalClick, { passive: true });
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [pathname]);

  return null;
}
