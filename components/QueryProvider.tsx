"use client";
import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { getActiveCompanyId } from '@/lib/supabase';
import { reportTechnicalError } from '@/lib/telegram-alerts';

export const sharedQueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error: any, _variables, _context, mutation) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const mutationKey = mutation?.options?.mutationKey;
      void reportTechnicalError(error, {
        category: 'database_error',
        level: 'error',
        metadata: {
          mutationKey: Array.isArray(mutationKey) ? mutationKey.join('/') : String(mutationKey || ''),
        },
      });
    },
  }),
  queryCache: new QueryCache({
    onError: (error: any, query) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      // Skip benign 401 or auth check failures
      if (error?.status === 401 || String(error?.message || '').includes('JWT')) return;
      void reportTechnicalError(error, {
        category: 'api_failure',
        level: 'warning',
        metadata: {
          queryKey: Array.isArray(query.queryKey) ? query.queryKey.join('/') : String(query.queryKey || ''),
        },
      });
    },
  }),
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 1000 * 60 * 5, // 5 دقائق
      gcTime: 1000 * 60 * 60 * 24, // 24 ساعة
      refetchOnWindowFocus: true,
      retry: (failureCount) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// 🛡️ عزل كاش الاستعلامات المحفوظ في IndexedDB بمفتاح مستقل لكل شركة
const getCompanyCacheKey = () => `phi_rq_cache_v2_${getActiveCompanyId() || 'default'}`;

const persister = createAsyncStoragePersister({
  key: getCompanyCacheKey(),
  storage: {
    getItem: async (key) => await get(key),
    setItem: async (key, value) => await set(key, value),
    removeItem: async (key) => await del(key),
  },
});

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const companyBuster = getActiveCompanyId() ?? 'default';

  return (
    <PersistQueryClientProvider
      client={sharedQueryClient}
      persistOptions={{
        persister,
        buster: companyBuster,
        maxAge: 1000 * 60 * 60 * 24,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
