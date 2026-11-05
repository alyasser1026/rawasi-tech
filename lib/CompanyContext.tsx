"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ACTIVE_COMPANY_STORAGE_KEY, getActiveCompanyId, setActiveCompanyId as sendCompanyWithRequests, supabase } from './supabase';
import type { Company } from '@/types/company';

interface CompanyContextType {
  /** Companies the signed-in user belongs to (from get_user_accessible_companies). */
  companies: Company[];
  /** The company currently selected, or null while loading / when the user belongs to none. */
  activeCompany: Company | null;
  activeCompanyId: string | null;
  isLoading: boolean;
  /** Set when the list could not be loaded; the previous list is kept. */
  error: string | null;
  /** Opens another company: saves the choice and reloads the app so every screen shows that company's data. */
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

export const COMPANY_CHANGED_EVENT = 'phi:company-changed';

const storeId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, id);
    else localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
  } catch { /* storage unavailable */ }
};

/** The company to open: the one chosen on this device, then the user's default, then the system default. */
const pickActive = (list: Company[], preferredId: string | null) =>
  list.find(c => c.id === preferredId)
  ?? list.find(c => c.is_user_default)
  ?? list.find(c => c.is_default)
  ?? list[0]
  ?? null;

/** Full reload: screens, cached queries (their persisted cache is keyed by company) and realtime
 *  subscriptions all start again with the new company. */
const reloadApp = () => { window.location.reload(); };

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  // Starts empty on the server and on the first client render (no hydration mismatch); filled after mount.
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refreshCompanies = useCallback(async () => {
    const current = ++requestId.current;
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (current !== requestId.current) return;
        setCompanies([]);
        setActiveCompanyId(null);
        setError(null);
        return;
      }
      const { data, error: rpcError } = await supabase.rpc('get_user_accessible_companies');
      if (current !== requestId.current) return;
      if (rpcError) throw rpcError;
      const list = (data ?? []) as Company[];
      const sentId = getActiveCompanyId();
      const next = pickActive(list, sentId);
      setCompanies(list);
      setError(null);
      setActiveCompanyId(next?.id ?? null);

      if ((next?.id ?? null) !== sentId) {
        sendCompanyWithRequests(next?.id ?? null);
        storeId(next?.id ?? null);
        // Data already loaded on this page came from another company (a stale choice on this device)
        // or from the database's own fallback. Reload unless that fallback is certainly the same company.
        const fallbackWasSame = sentId === null && (list.length <= 1 || !!next?.is_user_default);
        if (next && !fallbackWasSame) { reloadApp(); return; }
      }
    } catch (err) {
      if (current !== requestId.current) return;
      console.error('Could not load companies:', err);
      setError('تعذر تحميل قائمة الشركات');
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCompanies();
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Deferred: calling Supabase from inside the auth callback can block the client.
        setTimeout(() => { void refreshCompanies(); }, 0);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [refreshCompanies]);

  const activeCompany = useMemo(
    () => companies.find(c => c.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  const switchCompany = useCallback(async (companyId: string) => {
    const target = companies.find(c => c.id === companyId);
    if (!target || companyId === activeCompanyId) return;
    sendCompanyWithRequests(companyId);
    storeId(companyId);
    setActiveCompanyId(companyId);
    window.dispatchEvent(new CustomEvent(COMPANY_CHANGED_EVENT, { detail: { company: target, companyId } }));
    // Also the account's default, so other devices, realtime and requests without the header follow.
    const { error: saveError } = await supabase.rpc('set_my_default_company', { p_company_id: companyId });
    if (saveError) console.warn('Could not save the default company:', saveError.message);
    reloadApp();
  }, [companies, activeCompanyId]);

  const value = useMemo<CompanyContextType>(() => ({
    companies,
    activeCompany,
    activeCompanyId: activeCompany?.id ?? null,
    isLoading,
    error,
    switchCompany,
    refreshCompanies,
  }), [companies, activeCompany, isLoading, error, switchCompany, refreshCompanies]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextType {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within a CompanyProvider');
  return context;
}
