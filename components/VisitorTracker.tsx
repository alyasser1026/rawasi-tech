"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  collectClientDeviceDetails,
  rememberVisitorContact,
} from '@/lib/client-device-info';

const PHONE_REGEX = /^(?:(?:\+?20|0)?1[0125]\d{8}|(?:\+?966|0)?5\d{8}|\+\d{10,14})$/;
const SESSION_STORAGE_KEY = 'phi_visitor_session_id_v1';
const HEARTBEAT_INTERVAL_MS = 45_000;

function getOrCreateVisitorSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const created = `vis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return `vis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getCurrentFullPath(pathname: string | null): string {
  if (typeof window === 'undefined') return pathname || '/';
  const p = pathname || window.location.pathname || '/';
  const search = window.location.search || '';
  return `${p}${search}`.slice(0, 240);
}

function sendVisitorBeacon(payload: Record<string, unknown>, preferBeacon = false): void {
  try {
    const json = JSON.stringify(payload);
    if (preferBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([json], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/website-visitors', blob);
      if (sent) return;
    }
    fetch('/api/website-visitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Fail silently
  }
}

export default function VisitorTracker() {
  const pathname = usePathname();
  const currentPathRef = useRef<string>('/');
  const leaveSentRef = useRef<boolean>(false);

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

  // Effect 1: Per-pageview live visitor log + Telegram first-visit alert + click/phone capture
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (navigator.webdriver) return;
    if (!isPublic) return;

    let cancelled = false;
    leaveSentRef.current = false;
    const sessionId = getOrCreateVisitorSessionId();
    const fullPath = getCurrentFullPath(pathname);
    currentPathRef.current = fullPath;

    // 1A. Record every pageview for live admin visitor tracker
    const recordPageview = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const utmSource =
          urlParams.get('utm_source') || urlParams.get('source') || undefined;
        const utmCampaign =
          urlParams.get('utm_campaign') || urlParams.get('campaign') || undefined;

        const deviceDetails = await collectClientDeviceDetails(false).catch(
          () => ({} as Record<string, any>)
        );
        if (cancelled) return;

        sendVisitorBeacon({
          event: 'pageview',
          sessionId,
          path: getCurrentFullPath(pathname),
          title: document.title || undefined,
          referrer: document.referrer || '',
          screen: deviceDetails.screen || `${window.innerWidth}×${window.innerHeight}`,
          utmSource,
          utmCampaign,
          deviceDetails,
        });
      } catch {
        // Fail silently
      }
    };

    // Short delay so Next.js updates document.title on client transitions
    const pvTimer = window.setTimeout(() => {
      if (!cancelled) void recordPageview();
    }, 350);

    // 1B. Telegram first-visit notification once per session
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

    let idleHandle: number | undefined;
    let delayTimer: number | undefined;
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const cic = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;

    if (typeof ric === 'function') {
      idleHandle = ric(() => {
        if (!cancelled) void trackVisit();
      }, { timeout: 3500 });
    } else {
      delayTimer = window.setTimeout(() => {
        if (!cancelled) void trackVisit();
      }, 2500);
    }

    // 2. Click tracking for conversion actions (WhatsApp & Phone calls)
    const handleGlobalClick = async (e: MouseEvent) => {
      try {
        const target = (e.target as HTMLElement)?.closest('a');
        if (!target) return;

        const href = target.getAttribute('href') || '';
        const isWhatsApp = href.includes('wa.me') || href.includes('whatsapp.com');
        const isPhone = href.startsWith('tel:');

        if (isWhatsApp || isPhone) {
          const actionType = isWhatsApp ? 'whatsapp_click' : 'phone_call';
          const actionLabel = isWhatsApp ? 'تواصل معنا عبر واتساب' : 'اتصال هاتفي مباشر';
          const sessionLeadKey = `lead_click_${isWhatsApp ? 'wa' : 'tel'}`;

          sendVisitorBeacon({
            event: 'action',
            sessionId,
            action: actionType,
            label: actionLabel,
            path: currentPathRef.current,
          });

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
              action: actionType,
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

        sendVisitorBeacon({
          event: 'action',
          sessionId,
          action: 'phone_captured',
          label: 'كتب رقم جواله في الموقع',
          phone: raw,
          path: currentPathRef.current,
          deviceDetails,
        });

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
      window.clearTimeout(pvTimer);
      if (idleHandle !== undefined && typeof cic === 'function') cic(idleHandle);
      if (delayTimer !== undefined) window.clearTimeout(delayTimer);
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('change', handlePhoneInput);
      document.removeEventListener('blur', handlePhoneInput, true);
    };
  }, [pathname, isPublic]);

  // Effect 2: Presence heartbeat (while visible) & reliable leave beacon on tab close
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (navigator.webdriver) return;
    if (!isPublic) return;

    const sessionId = getOrCreateVisitorSessionId();

    const heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      sendVisitorBeacon({
        event: 'heartbeat',
        sessionId,
        path: currentPathRef.current,
        title: document.title || undefined,
      });
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        leaveSentRef.current = false;
        sendVisitorBeacon({
          event: 'heartbeat',
          sessionId,
          path: currentPathRef.current,
          title: document.title || undefined,
        });
      } else {
        sendVisitorBeacon(
          {
            event: 'blur',
            sessionId,
            path: currentPathRef.current,
          },
          true
        );
      }
    };

    const handleLeave = () => {
      if (leaveSentRef.current) return;
      leaveSentRef.current = true;
      sendVisitorBeacon(
        {
          event: 'leave',
          sessionId,
          path: currentPathRef.current,
        },
        true
      );
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleLeave);
    window.addEventListener('beforeunload', handleLeave);

    return () => {
      window.clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleLeave);
      window.removeEventListener('beforeunload', handleLeave);
    };
  }, [isPublic]);

  return null;
}
