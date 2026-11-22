"use client";

export interface ClientDeviceDetails {
  visitorId?: string;
  visitCount?: number;
  firstVisitAt?: string;
  knownName?: string;
  knownPhone?: string;
  knownEmail?: string;
  screen?: string;
  viewport?: string;
  pixelRatio?: number;
  colorScheme?: 'dark' | 'light';
  cpuCores?: number;
  ramGb?: number;
  maxTouchPoints?: number;
  gpu?: string;
  batteryLevel?: number;
  batteryCharging?: boolean;
  deviceModel?: string;
  platformVersion?: string;
  connection?: string;
  downlinkMbps?: number;
  language?: string;
  languages?: string;
  timezone?: string;
}

const STORAGE_KEYS = {
  visitorId: 'phi_visitor_id',
  visitCount: 'phi_visit_count',
  firstVisitAt: 'phi_first_visit_at',
  knownName: 'phi_known_name',
  knownPhone: 'phi_known_phone',
  knownEmail: 'phi_known_email',
} as const;

function safeLocalStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private mode restrictions
  }
}

/**
 * Persist visitor contact details locally so subsequent visits from this device
 * automatically identify the visitor by name/phone/email.
 */
export function rememberVisitorContact(info: {
  name?: string;
  phone?: string;
  email?: string;
}): void {
  if (typeof window === 'undefined') return;
  const cleanName = typeof info.name === 'string' ? info.name.trim() : '';
  const cleanPhone = typeof info.phone === 'string' ? info.phone.trim() : '';
  const cleanEmail = typeof info.email === 'string' ? info.email.trim() : '';

  if (cleanName) safeLocalStorageSet(STORAGE_KEYS.knownName, cleanName);
  if (cleanPhone) safeLocalStorageSet(STORAGE_KEYS.knownPhone, cleanPhone);
  if (cleanEmail) safeLocalStorageSet(STORAGE_KEYS.knownEmail, cleanEmail);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, ms);

    promise
      .then((res) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(res);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      });
  });
}

function getWebGlGpuRenderer(): string | undefined {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('low-graphics-mode')) {
    return undefined;
  }
  let gl: WebGLRenderingContext | null = null;
  try {
    const canvas = document.createElement('canvas');
    gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return undefined;

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      if (typeof renderer === 'string' && renderer.trim()) {
        return renderer.trim().slice(0, 100);
      }
    }
    const fallbackRenderer = gl.getParameter(gl.RENDERER);
    if (typeof fallbackRenderer === 'string' && fallbackRenderer.trim()) {
      return fallbackRenderer.trim().slice(0, 100);
    }
  } catch {
    // Ignore headless / blocked WebGL environments
  } finally {
    try {
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      // Ignore cleanup failure
    }
  }
  return undefined;
}

/**
 * Gather rich device hardware, battery, high-entropy UA hints, and persistent visitor ID.
 */
export async function collectClientDeviceDetails(
  incrementVisit = false
): Promise<ClientDeviceDetails> {
  if (typeof window === 'undefined') return {};

  // 1. Persistent Visitor ID, visit count & first visit date
  let visitorId = safeLocalStorageGet(STORAGE_KEYS.visitorId);
  if (!visitorId) {
    visitorId = `V-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    safeLocalStorageSet(STORAGE_KEYS.visitorId, visitorId);
  }

  let firstVisitAt = safeLocalStorageGet(STORAGE_KEYS.firstVisitAt);
  if (!firstVisitAt) {
    firstVisitAt = new Date().toISOString();
    safeLocalStorageSet(STORAGE_KEYS.firstVisitAt, firstVisitAt);
  }

  const rawCount = Number(safeLocalStorageGet(STORAGE_KEYS.visitCount) || '0');
  let visitCount = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;
  if (incrementVisit) {
    visitCount += 1;
    safeLocalStorageSet(STORAGE_KEYS.visitCount, String(visitCount));
  } else if (visitCount === 0) {
    visitCount = 1;
  }

  const knownName = safeLocalStorageGet(STORAGE_KEYS.knownName) || undefined;
  const knownPhone = safeLocalStorageGet(STORAGE_KEYS.knownPhone) || undefined;
  const knownEmail = safeLocalStorageGet(STORAGE_KEYS.knownEmail) || undefined;

  // 2. Display & Theme
  const screen = window.screen
    ? `${window.screen.width}×${window.screen.height}`
    : undefined;
  const viewport = `${window.innerWidth}×${window.innerHeight}`;
  const pixelRatio =
    typeof window.devicePixelRatio === 'number'
      ? Math.round(window.devicePixelRatio * 100) / 100
      : undefined;

  let colorScheme: 'dark' | 'light' | undefined;
  try {
    if (window.matchMedia) {
      colorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
  } catch {
    // Ignore matchMedia errors
  }

  // 3. Hardware & Network
  const nav = navigator as any;
  const cpuCores =
    typeof navigator.hardwareConcurrency === 'number'
      ? navigator.hardwareConcurrency
      : undefined;
  const ramGb =
    typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;
  const maxTouchPoints =
    typeof navigator.maxTouchPoints === 'number'
      ? navigator.maxTouchPoints
      : undefined;

  const connection = nav?.connection?.effectiveType || undefined;
  const downlinkMbps =
    typeof nav?.connection?.downlink === 'number'
      ? nav.connection.downlink
      : undefined;

  const language = navigator.language || undefined;
  const languages = Array.isArray(navigator.languages)
    ? navigator.languages.slice(0, 3).join(', ')
    : undefined;

  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Ignore Intl errors
  }

  const gpu = getWebGlGpuRenderer();

  // 4. Async telemetry (Battery + UA Client Hints) with 400ms timeout
  const batteryPromise =
    typeof nav.getBattery === 'function'
      ? withTimeout<{ level?: number; charging?: boolean }>(nav.getBattery(), 400)
      : Promise.resolve(null);

  const uaHintsPromise =
    typeof nav.userAgentData?.getHighEntropyValues === 'function'
      ? withTimeout<{ model?: string; platformVersion?: string }>(
          nav.userAgentData.getHighEntropyValues(['model', 'platformVersion']),
          400
        )
      : Promise.resolve(null);

  const [battery, uaHints] = await Promise.all([batteryPromise, uaHintsPromise]);

  const batteryLevel =
    battery && typeof battery.level === 'number'
      ? Math.round(battery.level * 100)
      : undefined;
  const batteryCharging =
    battery && typeof battery.charging === 'boolean'
      ? battery.charging
      : undefined;

  const deviceModel =
    uaHints && typeof uaHints.model === 'string' && uaHints.model.trim()
      ? uaHints.model.trim()
      : undefined;
  const platformVersion =
    uaHints &&
    typeof uaHints.platformVersion === 'string' &&
    uaHints.platformVersion.trim()
      ? uaHints.platformVersion.trim()
      : undefined;

  return {
    visitorId,
    visitCount,
    firstVisitAt,
    knownName,
    knownPhone,
    knownEmail,
    screen,
    viewport,
    pixelRatio,
    colorScheme,
    cpuCores,
    ramGb,
    maxTouchPoints,
    gpu,
    batteryLevel,
    batteryCharging,
    deviceModel,
    platformVersion,
    connection,
    downlinkMbps,
    language,
    languages,
    timezone,
  };
}
