import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/CompanyContext';

export interface AuditPendingCounts {
  manualJournals: number;
  paymentVouchers: number;
  receiptVouchers: number;
  salesInvoices: number;
  expenses: number;
  materialIssues: number;
  accountingAdjustments: number;
  fleetTrips: number;
  cashierShifts: number;
  totalPending: number;
}

const DEFAULT_COUNTS: AuditPendingCounts = {
  manualJournals: 0,
  paymentVouchers: 0,
  receiptVouchers: 0,
  salesInvoices: 0,
  expenses: 0,
  materialIssues: 0,
  accountingAdjustments: 0,
  fleetTrips: 0,
  cashierShifts: 0,
  totalPending: 0,
};

export function useAuditPendingCounts() {
  const { activeCompanyId } = useCompany();
  const [counts, setCounts] = useState<AuditPendingCounts>(DEFAULT_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMounted = useRef(true);

  const fetchCounts = useCallback(async (isManualRefresh = false) => {
    if (!activeCompanyId) {
      setIsLoading(false);
      return;
    }

    if (isManualRefresh) setIsRefreshing(true);

    try {
      // 1. Manual journals (or journal headers)
      const mjPromise = supabase
        .from('manual_journals')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', activeCompanyId)
        .neq('status', 'معتمد');

      // 2. Payment vouchers (is_posted = false)
      const pvPromise = supabase
        .from('payment_vouchers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', activeCompanyId)
        .eq('is_posted', false);

      // 3. Receipt vouchers (status != 'معتمد')
      const rvPromise = supabase
        .from('receipt_vouchers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', activeCompanyId)
        .neq('status', 'معتمد');

      // 4. Sales invoices (status != 'معتمد' or is_posted = false)
      const invPromise = supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', activeCompanyId)
        .neq('status', 'معتمد');

      // 5. Expenses (is_posted = false)
      const expPromise = supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', activeCompanyId)
        .eq('is_posted', false);

      // 6. Material issues (is_posted = false)
      const miPromise = supabase
        .from('material_issues')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', activeCompanyId)
        .eq('is_posted', false);

      // 7. Accounting adjustments (daily cash closings pending)
      const ccPromise = supabase
        .from('daily_cash_closings')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', activeCompanyId)
        .eq('status', 'pending');

      const [mjRes, pvRes, rvRes, invRes, expRes, miRes, ccRes] = await Promise.all([
        mjPromise,
        pvPromise,
        rvPromise,
        invPromise,
        expPromise,
        miPromise,
        ccPromise,
      ]);

      const mj = Math.max(0, mjRes.count || 0);
      const pv = Math.max(0, pvRes.count || 0);
      const rv = Math.max(0, rvRes.count || 0);
      const inv = Math.max(0, invRes.count || 0);
      const exp = Math.max(0, expRes.count || 0);
      const mi = Math.max(0, miRes.count || 0);
      const cc = Math.max(0, ccRes.count || 0);
      const trips = 0;
      const shifts = 0;

      const total = mj + pv + rv + inv + exp + mi + cc + trips + shifts;

      if (isMounted.current) {
        setCounts({
          manualJournals: mj,
          paymentVouchers: pv,
          receiptVouchers: rv,
          salesInvoices: inv,
          expenses: exp,
          materialIssues: mi,
          accountingAdjustments: cc,
          fleetTrips: trips,
          cashierShifts: shifts,
          totalPending: total,
        });
      }
    } catch (err) {
      console.warn('Could not fetch audit pending counts:', err);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [activeCompanyId]);

  useEffect(() => {
    isMounted.current = true;
    void fetchCounts(false);

    const interval = setInterval(() => {
      void fetchCounts(false);
    }, 45000); // 45 seconds polling

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchCounts]);

  const refresh = useCallback(() => {
    return fetchCounts(true);
  }, [fetchCounts]);

  return {
    counts,
    isLoading,
    isRefreshing,
    refresh,
  };
}
