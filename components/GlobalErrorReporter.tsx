"use client";

import { useEffect } from 'react';
import { reportTechnicalError } from '@/lib/telegram-alerts';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';

/**
 * Global component mounted at layout level to capture all unhandled window errors,
 * unhandled promise rejections, console.error calls, and browser alert() triggers,
 * dispatching them to the Telegram Bot API automatically.
 */
export default function GlobalErrorReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Unhandled Window Errors
    const handleError = (event: ErrorEvent) => {
      const err = event.error || event.message;
      void reportTechnicalError(err, {
        category: 'uncaught_exception',
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      });
    };

    // 2. Unhandled Promise Rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const reasonText = String(reason?.message || reason || '');
      if (
        reasonText.includes('Invalid Refresh Token') ||
        reasonText.includes('refresh_token_not_found') ||
        reason?.code === 'refresh_token_not_found'
      ) {
        try { void supabase.auth.signOut({ scope: 'local' }); } catch {}
        return;
      }

      void reportTechnicalError(reason, {
        category: 'unhandled_rejection',
      });
    };

    // 3. Console.error interception
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      try {
        originalConsoleError.apply(console, args);

        // Find Error object or construct detailed text
        const errorObj = args.find((a) => a instanceof Error);
        const textPieces = args.map((a) => {
          if (a instanceof Error) return a.stack || a.message;
          if (typeof a === 'object' && a !== null) {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }
          return String(a);
        });
        const combinedText = textPieces.join(' ').trim();

        // Stale or revoked auth session: purge local storage so client doesn't loop
        if (
          combinedText.includes('Invalid Refresh Token') ||
          combinedText.includes('refresh_token_not_found')
        ) {
          try { void supabase.auth.signOut({ scope: 'local' }); } catch {}
          return;
        }

        // Filter out benign React development / hydration logs / normal session expiries
        if (
          combinedText &&
          !combinedText.includes('React will try to recreate this component tree') &&
          !combinedText.includes('Download the React DevTools') &&
          !combinedText.includes('ResizeObserver loop') &&
          !combinedText.includes('The user aborted a request') &&
          !combinedText.includes('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT') &&
          !combinedText.includes('Invalid Refresh Token') &&
          !combinedText.includes('refresh_token_not_found') &&
          !combinedText.includes('JWT expired') &&
          !combinedText.includes('denied permission') &&
          !combinedText.includes('Permission denied') &&
          !combinedText.includes('NotAllowedError') &&
          !combinedText.includes('User denied Geolocation') &&
          !combinedText.includes('Mic access error')
        ) {
          void reportTechnicalError(errorObj || combinedText, {
            category: 'business_exception',
            level: 'error',
            metadata: {
              rawConsole: combinedText.slice(0, 400),
            },
          });
        }
      } catch {
        // Never crash console.error
      }
    };

    // 4. Fallback: intercept raw window.alert and route to notify
    const originalAlert = window.alert;
    window.alert = (message?: any) => {
      try {
        notify(String(message ?? ''));
      } catch {
        originalAlert(message);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.error = originalConsoleError;
      window.alert = originalAlert;
    };
  }, []);

  return null;
}
