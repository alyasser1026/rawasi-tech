"use client";

const SESSION_COOKIE_NAME = 'phi_store_sid';
const SESSION_STORAGE_KEY = 'phi_store_browser_sid_v1';
const COPILOT_SESSION_KEY = 'phi_store_copilot_session_v1';
const PRIVACY_ACK_KEY = 'phi_privacy_notice_ack_v1';
const SIX_MONTHS_SEC = 15_552_000;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const parts = document.cookie ? document.cookie.split('; ') : [];
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx <= 0) continue;
      const k = decodeURIComponent(part.slice(0, idx));
      if (k === name) {
        return decodeURIComponent(part.slice(idx + 1));
      }
    }
  } catch {
    // ignore malformed cookie
  }
  return null;
}

function writeCookie(name: string, value: string, maxAgeSec = SIX_MONTHS_SEC): void {
  if (typeof document === 'undefined') return;
  try {
    const secure =
      typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
  } catch {
    // ignore cookie restrictions
  }
}

function safeStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage restrictions
  }
}

function normalizeValidSessionId(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim().slice(0, 64) : '';
  return /^[A-Za-z0-9_-]{6,64}$/.test(s) ? s : '';
}

function generateSessionId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    return `SES-${ts}-${hex}`;
  }
  const rnd = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SES-${ts}-${rnd}`;
}

export function syncBrowserSessionId(id: string): void {
  const clean = normalizeValidSessionId(id);
  if (!clean || typeof window === 'undefined') return;
  safeStorageSet(SESSION_STORAGE_KEY, clean);
  writeCookie(SESSION_COOKIE_NAME, clean, SIX_MONTHS_SEC);
}

export function getOrCreateBrowserSessionId(): string {
  if (typeof window === 'undefined') return '';

  const fromCookie = normalizeValidSessionId(readCookie(SESSION_COOKIE_NAME));
  const fromStorage = normalizeValidSessionId(safeStorageGet(SESSION_STORAGE_KEY));

  let fromCopilot = '';
  if (!fromCookie && !fromStorage) {
    try {
      const rawCopilot = safeStorageGet(COPILOT_SESSION_KEY);
      if (rawCopilot) {
        const parsed = JSON.parse(rawCopilot);
        fromCopilot = normalizeValidSessionId(parsed?.sessionId);
      }
    } catch {
      fromCopilot = '';
    }
  }

  const resolved = fromCookie || fromStorage || fromCopilot || generateSessionId();
  syncBrowserSessionId(resolved);
  return resolved;
}

export function hasAcknowledgedPrivacyNotice(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    safeStorageGet(PRIVACY_ACK_KEY) === '1' || readCookie(PRIVACY_ACK_KEY) === '1'
  );
}

export function acknowledgePrivacyNotice(): void {
  if (typeof window === 'undefined') return;
  safeStorageSet(PRIVACY_ACK_KEY, '1');
  writeCookie(PRIVACY_ACK_KEY, '1', SIX_MONTHS_SEC);
}
