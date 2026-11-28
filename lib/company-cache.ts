import { del, keys } from 'idb-keyval';
import { ACTIVE_COMPANY_STORAGE_KEY, getActiveCompanyId } from './supabase';

export const COMPANY_CHANGED_EVENT = 'phi:company-changed';
export const COMPANY_CACHE_PREFIX = 'phi_rq_cache_v2_';
export const DISABLE_COMPANY_CACHE_ISOLATION_KEY = 'phi_disable_company_cache_isolation';
const COMPANIES_LIST_CACHE_PREFIX = 'phi_cached_companies_';

export interface QueryClientLike {
  cancelQueries: () => Promise<void>;
  clear: () => void;
}

export interface CompanyCacheCleanupOptions {
  keepCompanyId?: string | null;
  clearAuthCompanySelection?: boolean;
  queryClient?: QueryClientLike | null;
  idbKeysFn?: () => Promise<IDBValidKey[]>;
  idbDelFn?: (key: IDBValidKey) => Promise<void>;
  storage?: Pick<Storage, 'getItem' | 'removeItem' | 'length' | 'key'> | null;
}

/** Kill-switch for instant rollback of Batch 5.2 company cache isolation. */
export function isCompanyCacheIsolationDisabled(
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_COMPANY_CACHE_ISOLATION === 'true') {
    return true;
  }
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return false;
  try {
    return store.getItem(DISABLE_COMPANY_CACHE_ISOLATION_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Builds a deterministic IndexedDB/React Query cache key scoped to the given company. */
export function getCompanyCacheKey(companyId?: string | null): string {
  const resolved = companyId !== undefined ? companyId : getActiveCompanyId();
  return `${COMPANY_CACHE_PREFIX}${resolved || 'default'}`;
}

/**
 * Cancels in-flight queries, clears in-memory React Query cache, deletes non-active
 * company IndexedDB caches, and optionally resets persisted company selection on sign-out
 * while preserving user UI preferences (theme, scale, language).
 */
export async function clearCompanyScopedClientCaches(
  opts: CompanyCacheCleanupOptions = {}
): Promise<{ clearedIdbKeys: string[]; clearedLocalKeys: string[]; skipped: boolean }> {
  const store =
    opts.storage !== undefined
      ? opts.storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (isCompanyCacheIsolationDisabled(store)) {
    return { clearedIdbKeys: [], clearedLocalKeys: [], skipped: true };
  }

  const clearedIdbKeys: string[] = [];
  const clearedLocalKeys: string[] = [];

  if (opts.queryClient) {
    try {
      await opts.queryClient.cancelQueries();
    } catch {
      // Ignore aborted in-flight query rejections
    }
    try {
      opts.queryClient.clear();
    } catch {
      // Non-blocking memory cache clear
    }
  }

  const keepKey = opts.keepCompanyId ? getCompanyCacheKey(opts.keepCompanyId) : null;
  const listIdb = opts.idbKeysFn ?? (typeof indexedDB !== 'undefined' ? keys : null);
  const delIdb = opts.idbDelFn ?? (typeof indexedDB !== 'undefined' ? del : null);

  if (listIdb && delIdb) {
    try {
      const allKeys = await listIdb();
      for (const rawKey of allKeys) {
        const keyStr = String(rawKey);
        if (!keyStr.startsWith(COMPANY_CACHE_PREFIX)) continue;
        if (keepKey && keyStr === keepKey) continue;
        await delIdb(rawKey);
        clearedIdbKeys.push(keyStr);
      }
    } catch {
      // IndexedDB can be unavailable in private mode or SSR
    }
  }

  if (store && opts.clearAuthCompanySelection) {
    try {
      store.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
      clearedLocalKeys.push(ACTIVE_COMPANY_STORAGE_KEY);
      const toRemove: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(COMPANIES_LIST_CACHE_PREFIX)) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) {
        store.removeItem(k);
        clearedLocalKeys.push(k);
      }
    } catch {
      // Ignore localStorage unavailability
    }
  }

  return { clearedIdbKeys, clearedLocalKeys, skipped: false };
}
