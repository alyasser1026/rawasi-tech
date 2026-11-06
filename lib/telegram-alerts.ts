"use client";

import { ACTIVE_COMPANY_STORAGE_KEY } from './supabase';

export interface TechnicalErrorContext {
  level?: 'fatal' | 'error' | 'warning' | 'info';
  category?:
    | 'react_crash'
    | 'uncaught_exception'
    | 'unhandled_rejection'
    | 'api_failure'
    | 'database_error'
    | 'business_exception';
  source?: string;
  componentStack?: string | null;
  metadata?: Record<string, any>;
  skipDedupe?: boolean;
}

// Client-side deduplication map (prevents repetitive reports within 30 seconds)
const clientDedupeMap = new Map<string, number>();
const CLIENT_DEDUPE_MS = 30 * 1000;

function cleanClientDedupe() {
  const now = Date.now();
  for (const [key, timestamp] of clientDedupeMap.entries()) {
    if (now - timestamp > CLIENT_DEDUPE_MS) {
      clientDedupeMap.delete(key);
    }
  }
}

/**
 * Reports a runtime error or technical issue to the engineering Telegram channel.
 * Completely safe: never throws an exception or interrupts normal user workflow.
 */
export async function reportTechnicalError(
  errorOrMessage: unknown,
  context?: TechnicalErrorContext
): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    // Do not attempt if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    cleanClientDedupe();

    let message = '';
    let stack = '';
    let code: string | undefined;
    let status: number | undefined;

    if (errorOrMessage && typeof errorOrMessage === 'object') {
      const details = errorOrMessage as { code?: unknown; status?: unknown; statusCode?: unknown };
      if (typeof details.code === 'string') code = details.code;
      if (typeof details.status === 'number') status = details.status;
      else if (typeof details.statusCode === 'number') status = details.statusCode;
    }

    if (errorOrMessage instanceof Error) {
      message = errorOrMessage.message || errorOrMessage.name || 'Unknown Error';
      stack = errorOrMessage.stack || '';
    } else if (typeof errorOrMessage === 'string') {
      message = errorOrMessage;
    } else if (typeof errorOrMessage === 'object' && errorOrMessage !== null) {
      const obj = errorOrMessage as any;
      message = obj.message || obj.error_description || obj.error || JSON.stringify(errorOrMessage);
      stack = obj.stack || obj.details || '';
    } else {
      message = String(errorOrMessage ?? 'Unknown error occurred');
    }

    message = message.trim();
    if (!message) return;

    // Ignore benign errors (user aborted fetch, resize observer loop, benign hydration, normal auth session expiry, user permission denials)
    if (
      message.includes('AbortError') ||
      message.includes('ResizeObserver loop') ||
      message.includes('The user aborted a request') ||
      message.includes('Invalid Refresh Token') ||
      message.includes('refresh_token_not_found') ||
      message.includes('JWT expired') ||
      message.includes('denied permission') ||
      message.includes('Permission denied') ||
      message.includes('NotAllowedError') ||
      message.includes('User denied Geolocation') ||
      message.includes('Mic access error') ||
      code === 'refresh_token_not_found' ||
      code === 'session_not_found'
    ) {
      return;
    }

    const currentUrl = window.location.href;
    const category = context?.category || 'business_exception';

    // Deduplication check
    const dedupeKey = `${category}|${currentUrl}|${message.slice(0, 100)}`;
    const now = Date.now();
    if (!context?.skipDedupe) {
      const lastSent = clientDedupeMap.get(dedupeKey);
      if (lastSent && now - lastSent < CLIENT_DEDUPE_MS) {
        return;
      }
      clientDedupeMap.set(dedupeKey, now);
    }

    // Try reading active company ID from storage
    let companyId: string | undefined;
    try {
      companyId = localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY) || undefined;
    } catch {
      // storage disabled
    }

    const payload = {
      level: context?.level || (category === 'react_crash' ? 'fatal' : 'error'),
      category,
      message,
      code,
      status,
      stack,
      componentStack: context?.componentStack,
      url: currentUrl,
      source: context?.source,
      userAgent: navigator.userAgent,
      companyId,
      metadata: context?.metadata,
    };

    // Dispatch using direct fetch with keepalive (reliable and never dropped by sendBeacon blob issues)
    const bodyStr = JSON.stringify(payload);
    await fetch('/api/telegram-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
      keepalive: true,
    });
  } catch (loggingErr) {
    // Fail silently to avoid infinite error loops
    console.warn('Could not dispatch error to Telegram alerts:', loggingErr);
  }
}
