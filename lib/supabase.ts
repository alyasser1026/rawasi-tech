import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_DEFAULT_MAX_ROWS,
  SUPABASE_PAGE_SIZE,
  ensureDeterministicOrderOnUrl,
  extractRowKey,
  getRelationPrimaryKey,
} from './supabase-pagination';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** localStorage key of the company the user works in on this device. */
export const ACTIVE_COMPANY_STORAGE_KEY = 'phi_active_company_id';

/** Company sent with every database request (x-company-id). The database only shows and saves that
 *  company's records, and ignores a company the user does not belong to. Without it, the database
 *  falls back to the user's default company. */
let activeCompanyId: string | null = null;

if (typeof window !== 'undefined') {
  try { activeCompanyId = localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY); } catch { /* storage unavailable */ }
}

export const getActiveCompanyId = () => activeCompanyId;
export const setActiveCompanyId = (id: string | null) => { activeCompanyId = id; };

const isDataRequest = (url: string) => url.includes('/rest/v1/');

interface SharedRawResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  bodyText: string;
}

const inFlightGetRequests = new Map<string, Promise<SharedRawResponse>>();

function sanitizeResponseHeaders(source: Headers): [string, string][] {
  const out: [string, string][] = [];
  source.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'content-length' || lower === 'content-encoding') return;
    out.push([key, value]);
  });
  return out;
}

async function coalescedRawFetch(
  reqUrl: string,
  headers: Headers,
  signal?: AbortSignal
): Promise<Response> {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }

  const companyKey = headers.get('x-company-id') || '';
  const authTail = (headers.get('authorization') || '').slice(-16);
  const accept = headers.get('accept') || '';
  const prefer = headers.get('prefer') || '';
  const cacheKey = `${companyKey}::${authTail}::${accept}::${prefer}::${reqUrl}`;

  let sharedPromise = inFlightGetRequests.get(cacheKey);
  if (!sharedPromise) {
    sharedPromise = (async () => {
      try {
        const res = await fetch(reqUrl, { method: 'GET', headers });
        const bodyText = await res.text();
        return {
          status: res.status,
          statusText: res.statusText,
          headers: sanitizeResponseHeaders(res.headers),
          bodyText,
        };
      } finally {
        inFlightGetRequests.delete(cacheKey);
      }
    })();
    inFlightGetRequests.set(cacheKey, sharedPromise);
  }

  let shared: SharedRawResponse;
  if (signal) {
    shared = await new Promise<SharedRawResponse>((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener('abort', onAbort);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) {
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      sharedPromise!.then(
        (val) => {
          signal.removeEventListener('abort', onAbort);
          resolve(val);
        },
        (err) => {
          signal.removeEventListener('abort', onAbort);
          reject(err);
        }
      );
    });
  } else {
    shared = await sharedPromise;
  }

  return new Response(shared.bodyText, {
    status: shared.status,
    statusText: shared.statusText,
    headers: new Headers(shared.headers),
  });
}

/** Adds the company header to database (REST) calls only — not to sign-in, storage or realtime.
 *  Also transparently paginates un-ranged GET table/view requests 1000 rows at a time without
 *  duplicates or parallel load spikes, and coalesces identical in-flight GET calls. */
const companyAwareFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!isDataRequest(url)) return fetch(input, init);

  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const explicitCompanyId = headers.get('x-company-id');
  if (!explicitCompanyId && activeCompanyId) {
    headers.set('x-company-id', activeCompanyId);
  }

  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET' || url.includes('/rest/v1/rpc/')) {
    // Keep the selected company even when the network fails. Retrying without this header
    // could read or write the user's default company instead, or repeat a completed write.
    return fetch(input, { ...init, headers });
  }

  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);

  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return coalescedRawFetch(url, headers, signal);
  }

  const relationMatch = urlObj.pathname.match(/\/rest\/v1\/([^/]+)$/);
  if (!relationMatch) {
    return coalescedRawFetch(url, headers, signal);
  }

  const accept = (headers.get('accept') || '').toLowerCase();
  const skipAccept =
    accept.includes('vnd.pgrst.object') ||
    accept.includes('text/csv') ||
    accept.includes('vnd.pgrst.plan') ||
    accept.includes('text/plain');

  const hasOffset = urlObj.searchParams.has('offset');
  const limitParam = urlObj.searchParams.get('limit');
  const hasLimit = limitParam !== null && limitParam !== '';
  const numericLimit = hasLimit ? Number(limitParam) : NaN;

  if (
    skipAccept ||
    hasOffset ||
    (hasLimit && (!Number.isFinite(numericLimit) || numericLimit <= SUPABASE_PAGE_SIZE))
  ) {
    return coalescedRawFetch(url, headers, signal);
  }

  const relationName = decodeURIComponent(relationMatch[1]);
  const pk = getRelationPrimaryKey(relationName);
  const maxRows =
    hasLimit && Number.isFinite(numericLimit)
      ? Math.min(Math.floor(numericLimit), SUPABASE_DEFAULT_MAX_ROWS)
      : SUPABASE_DEFAULT_MAX_ROWS;
  const page1Limit = Math.min(SUPABASE_PAGE_SIZE, maxRows);

  const page1Url = new URL(urlObj.toString());
  page1Url.searchParams.set('offset', '0');
  page1Url.searchParams.set('limit', String(page1Limit));
  const orderAdded = ensureDeterministicOrderOnUrl(page1Url, relationName);

  let activeBaseUrl = page1Url;
  let page1Res = await coalescedRawFetch(page1Url.toString(), headers, signal);

  if (page1Res.status === 400 && orderAdded) {
    const fallbackUrl = new URL(urlObj.toString());
    fallbackUrl.searchParams.set('offset', '0');
    fallbackUrl.searchParams.set('limit', String(page1Limit));
    activeBaseUrl = fallbackUrl;
    page1Res = await coalescedRawFetch(fallbackUrl.toString(), headers, signal);
  }

  const page1ContentType = (page1Res.headers.get('content-type') || '').toLowerCase();
  if (!page1Res.ok || !page1ContentType.includes('application/json')) {
    return page1Res;
  }

  const page1Text = await page1Res.text();
  let page1Data: unknown;
  try {
    page1Data = JSON.parse(page1Text);
  } catch {
    return new Response(page1Text, {
      status: page1Res.status,
      statusText: page1Res.statusText,
      headers: new Headers(sanitizeResponseHeaders(page1Res.headers)),
    });
  }

  if (!Array.isArray(page1Data) || page1Data.length < page1Limit || maxRows <= page1Limit) {
    return new Response(page1Text, {
      status: page1Res.status,
      statusText: page1Res.statusText,
      headers: new Headers(sanitizeResponseHeaders(page1Res.headers)),
    });
  }

  const merged: any[] = [];
  const seenIds = new Set<string>();

  for (const row of page1Data) {
    const key = extractRowKey(row, pk);
    if (key !== null) {
      if (!seenIds.has(key)) {
        seenIds.add(key);
        merged.push(row);
      }
    } else {
      merged.push(row);
    }
  }

  let offset = page1Data.length;
  let loopCount = 0;
  const maxLoops = Math.ceil(maxRows / SUPABASE_PAGE_SIZE);

  while (merged.length < maxRows && loopCount < maxLoops) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    loopCount++;

    const chunkLimit = Math.min(SUPABASE_PAGE_SIZE, maxRows - merged.length);
    if (chunkLimit <= 0) break;

    const nextUrl = new URL(activeBaseUrl.toString());
    nextUrl.searchParams.set('offset', String(offset));
    nextUrl.searchParams.set('limit', String(chunkLimit));

    const nextRes = await coalescedRawFetch(nextUrl.toString(), headers, signal);
    if (!nextRes.ok) {
      return nextRes;
    }

    const nextText = await nextRes.text();
    let batch: unknown;
    try {
      batch = JSON.parse(nextText);
    } catch {
      break;
    }

    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const row of batch) {
      const key = extractRowKey(row, pk);
      if (key !== null) {
        if (!seenIds.has(key)) {
          seenIds.add(key);
          merged.push(row);
        }
      } else {
        merged.push(row);
      }
      if (merged.length >= maxRows) break;
    }

    offset += batch.length;
    if (batch.length < chunkLimit) break;
  }

  const finalHeaders = new Headers(sanitizeResponseHeaders(page1Res.headers));
  const prevRange = finalHeaders.get('content-range');
  if (prevRange) {
    const slashIdx = prevRange.indexOf('/');
    const totalPart = slashIdx >= 0 ? prevRange.slice(slashIdx + 1) : '*';
    const rangeEnd = merged.length > 0 ? `0-${merged.length - 1}` : '*';
    finalHeaders.set('content-range', `${rangeEnd}/${totalPart}`);
  }

  return new Response(JSON.stringify(merged), {
    status: 200,
    statusText: 'OK',
    headers: finalHeaders,
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // ✅ ده بيخلي الجلسة متتمسحش لما تقفل الصفحة
    autoRefreshToken: true,
  },
  global: { fetch: companyAwareFetch },
});

/** Creates an isolated per-company Supabase client pinned to a specific companyId and accessToken.
 *  Used by the offline sync engine so queued items always execute in their original company
 *  even if the user later switched to another company in the UI. */
export function createCompanyPinnedClient(companyId: string, accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-company-id': companyId,
      },
    },
  });
}

/** Ensures a valid (refreshed if near expiry) access token before online sync or attachment calls. */
export async function getValidSessionToken(): Promise<{ accessToken: string; userId: string } | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      if (error?.message?.includes('Refresh Token') || (error as any)?.code === 'refresh_token_not_found') {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
      }
      return null;
    }

    const expiresAtMs = (session.expires_at ?? 0) * 1000;
    if (expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed.session) {
        return {
          accessToken: refreshed.session.access_token,
          userId: refreshed.session.user.id,
        };
      }
      if (refreshError) {
        if (refreshError.message?.includes('Refresh Token') || (refreshError as any)?.code === 'refresh_token_not_found') {
          try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
        }
        return null;
      }
    }

    return {
      accessToken: session.access_token,
      userId: session.user.id,
    };
  } catch (err: any) {
    if (err?.message?.includes('Refresh Token') || err?.code === 'refresh_token_not_found') {
      try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
    }
    return null;
  }
}
