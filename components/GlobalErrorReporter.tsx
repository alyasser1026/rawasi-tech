"use client";

import { useEffect } from 'react';
import { reportTechnicalError } from '@/lib/telegram-alerts';

/**
 * Global component mounted at layout level to capture all unhandled window errors
 * and unhandled promise rejections, dispatching them to Telegram automatically.
 */
export default function GlobalErrorReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleError = (event: ErrorEvent) => {
      const err = event.error || event.message;
      void reportTechnicalError(err, {
        category: 'uncaught_exception',
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      void reportTechnicalError(reason, {
        category: 'unhandled_rejection',
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
