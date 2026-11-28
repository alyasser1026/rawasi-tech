/**
 * Feature flag for rolling back optimized Dashboard / GlobalSummary fetching
 * to the legacy concurrency/non-cached client mode instantly without redeploying.
 */
export function isLegacyDashboardFetchEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_LEGACY_DASHBOARD_FETCH === 'true') {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem('phi_legacy_dashboard_fetch') === 'true';
    } catch {
      return false;
    }
  }
  return false;
}
