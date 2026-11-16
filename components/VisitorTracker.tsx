"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  collectClientDeviceDetails,
  rememberVisitorContact,
} from '@/lib/client-device-info';

const PHONE_REGEX = /^(?:(?:\+?20|0)?1[0125]\d{8}|(?:\+?966|0)?5\d{8}|\+\d{10,14})$/;

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (navigator.webdriver) return;

    const isPublic =
      pathname === '/' ||
      pathname === '/website' ||
      pathname?.startsWith('/website/') ||
      pathname === '/sections' ||
      pathname?.startsWith('/sections/') ||
      pathname === '/login' ||
      pathname === '/store' ||
      pathname?.startsWith('/store/') ||
      pathname === '/real-estate' ||
      pathname?.startsWith('/real-estate/') ||
      pathname?.startsWith('/verify');

    if (!isPublic) return;

    let cancelled = false;

    // 1. Track unique visitor session with rich hardware & identity telemetry
    const trackVisit = async () => {
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

      if (!isNewSession || cancelled) return;

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const utmSource =
          urlParams.get('utm_source') || urlParams.get('source') || undefined;
        const utmMedium = urlParams.get('utm_medium') || undefined;
        const utmCampaign =
          urlParams.get('utm_campaign') || urlParams.get('campaign') || undefined;

        const deviceDetails = await collectClientDeviceDetails(true);
        if (cancelled) return;

        const payload = {
          path: pathname || window.location.pathname,
          referrer: document.referrer || '',
          screen: deviceDetails.screen || `${window.innerWidth}×${window.innerHeight}`,
          language: deviceDetails.language,
          timezone: deviceDetails.timezone,
          utmSource,
          utmMedium,
          utmCampaign,
          connection: deviceDetails.connection,
          deviceDetails,
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
    };

    void trackVisit();

    // 2. Click tracking for conversion actions (WhatsApp & Phone calls)
    const handleGlobalClick = async (e: MouseEvent) => {
      try {
        const target = (e.target as HTMLElement)?.closest('a');
        if (!target) return;

        const href = target.getAttribute('href') || '';
        const isWhatsApp = href.includes('wa.me') || href.includes('whatsapp.com');
        const isPhone = href.startsWith('tel:');

        if (isWhatsApp || isPhone) {
          const actionLabel = isWhatsApp ? 'تواصل معنا عبر واتساب' : 'اتصال هاتفي مباشر';
          const sessionLeadKey = `lead_click_${isWhatsApp ? 'wa' : 'tel'}`;

          try {
            if (sessionStorage.getItem(sessionLeadKey)) return;
            sessionStorage.setItem(sessionLeadKey, String(Date.now()));
          } catch {}

          const deviceDetails = await collectClientDeviceDetails(false).catch(() => ({}));

          fetch('/api/notify/visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'lead_action',
              action: isWhatsApp ? 'whatsapp_click' : 'phone_call',
              label: actionLabel,
              deviceDetails,
            }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    // 3. Proactive phone capture when visitor types a valid phone number in public inputs
    const handlePhoneInput = async (e: Event) => {
      try {
        const target = e.target as HTMLInputElement | null;
        if (!target || target.tagName !== 'INPUT') return;
        if (target.type === 'password' || target.type === 'hidden') return;

        const raw = (target.value || '').trim();
        if (!raw) return;

        const compact = raw.replace(/[\s\-().]/g, '');
        const isTelField =
          target.type === 'tel' ||
          target.autocomplete === 'tel' ||
          /phone|mobile|tel|جوال|هاتف/i.test(target.name || target.id || '');

        const matchesPhone = PHONE_REGEX.test(compact);
        if (!matchesPhone && !(isTelField && compact.replace(/\D/g, '').length >= 9)) {
          return;
        }

        const dedupeKey = `phi_captured_phone_${compact}`;
        try {
          if (sessionStorage.getItem(dedupeKey)) return;
          sessionStorage.setItem(dedupeKey, String(Date.now()));
        } catch {}

        rememberVisitorContact({ phone: raw });
        const deviceDetails = await collectClientDeviceDetails(false).catch(() => ({}));

        fetch('/api/notify/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'lead_action',
            action: 'phone_captured',
            label: 'قام بكتابة رقم جواله في الموقع',
            phone: raw,
            deviceDetails,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };

    document.addEventListener('click', handleGlobalClick, { passive: true });
    document.addEventListener('change', handlePhoneInput, { passive: true });
    document.addEventListener('blur', handlePhoneInput, true);

    return () => {
      cancelled = true;
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('change', handlePhoneInput);
      document.removeEventListener('blur', handlePhoneInput, true);
    };
  }, [pathname]);

  return null;
}
