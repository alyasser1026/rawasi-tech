"use client";
import { useEffect, useMemo, useState } from 'react';
import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { ACTIVE_COMPANY_STORAGE_KEY, getActiveCompanyId } from '@/lib/supabase';
import {
  COMPANY_CHANGED_EVENT,
  clearCompanyScopedClientCaches,
  getCompanyCacheKey,
  isCompanyCacheIsolationDisabled,
} from '@/lib/company-cache';
import { reportTechnicalError } from '@/lib/telegram-alerts';

export const sharedQueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error: any, _variables, _context, mutation) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path === '/login' || path === '/signup') return;
      }
      const msg = String(error?.message || '');
      if (error?.status === 401 || error?.status === 403 || msg.includes('JWT') || msg.includes('permission denied')) return;
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

      // Skip auth failures or permission denied when unauthenticated or on login/signup page
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path === '/login' || path === '/signup') return;
      }

      const msg = String(error?.message || '');
      const code = String(error?.code || '');
      if (
        error?.status === 401 ||
        error?.status === 403 ||
        code === '42501' ||
        code === 'PGRST301' ||
        msg.includes('JWT') ||
        msg.includes('permission denied') ||
        msg.includes('Not authorized')
      ) {
        return;
      }

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
      refetchOnWindowFocus: false,
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

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [companyBuster, setCompanyBuster] = useState<string>(() => getActiveCompanyId() ?? 'default');

  useEffect(() => {
    const syncCompanyCache = (nextId?: string | null) => {
      const resolved = nextId ?? getActiveCompanyId() ?? 'default';
      setCompanyBuster((prev) => {
        if (prev === resolved) return prev;
        if (!isCompanyCacheIsolationDisabled()) {
          void clearCompanyScopedClientCaches({
            keepCompanyId: resolved === 'default' ? null : resolved,
            queryClient: sharedQueryClient,
          });
        }
        return resolved;
      });
    };

    const handleCompanyChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<{ companyId?: string | null }>)?.detail;
      syncCompanyCache(detail?.companyId ?? getActiveCompanyId() ?? 'default');
    };

    const handleStorage = (ev: StorageEvent) => {
      if (ev.key === ACTIVE_COMPANY_STORAGE_KEY) {
        syncCompanyCache(ev.newValue || 'default');
      }
    };

    window.addEventListener(COMPANY_CHANGED_EVENT, handleCompanyChanged);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(COMPANY_CHANGED_EVENT, handleCompanyChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const companyPersister = useMemo(
    () =>
      createAsyncStoragePersister({
        key: getCompanyCacheKey(companyBuster === 'default' ? null : companyBuster),
        storage: {
          getItem: async (key) => await get(key),
          setItem: async (key, value) => await set(key, value),
          removeItem: async (key) => await del(key),
        },
      }),
    [companyBuster]
  );

  return (
    <PersistQueryClientProvider
      key={companyBuster}
      client={sharedQueryClient}
      persistOptions={{
        persister: companyPersister,
        buster: companyBuster,
        maxAge: 1000 * 60 * 60 * 24,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
