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

/** Adds the company header to database (REST) calls only — not to sign-in, storage or realtime. */
const companyAwareFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!activeCompanyId || !isDataRequest(url)) return fetch(input, init);

  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set('x-company-id', activeCompanyId);
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
