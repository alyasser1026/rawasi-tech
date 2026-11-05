import { createClient } from '@supabase/supabase-js';

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

/** Adds the company header to database (REST) calls only — not to sign-in, storage or realtime.
 *  Preserves an explicit per-request x-company-id header when already provided (e.g. offline queue sync). */
const companyAwareFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!isDataRequest(url)) return fetch(input, init);

  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const explicitCompanyId = headers.get('x-company-id');
  if (!explicitCompanyId) {
    if (!activeCompanyId) return fetch(input, init);
    headers.set('x-company-id', activeCompanyId);
  }
  // Keep the selected company even when the network fails. Retrying without this header
  // could read or write the user's default company instead, or repeat a completed write.
  return fetch(input, { ...init, headers });
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (!error && refreshed.session) {
      return {
        accessToken: refreshed.session.access_token,
        userId: refreshed.session.user.id,
      };
    }
  }

  return {
    accessToken: session.access_token,
    userId: session.user.id,
  };
}
