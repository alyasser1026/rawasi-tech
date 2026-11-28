export const CUSTOMER_DELETED_STATUS = 'محذوف بواسطة العميل' as const;
export const CUSTOMER_DELETABLE_STATUSES = ['جديد', 'new'] as const;
export const DISABLE_CUSTOMER_SOFT_DELETE_KEY = 'phi_disable_customer_request_soft_delete';

/** Kill-switch for disabling customer request self-deletion (keeps already-deleted rows hidden). */
export function isCustomerRequestSoftDeleteDisabled(
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_CUSTOMER_REQUEST_SOFT_DELETE === 'true') {
    return true;
  }
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return false;
  try {
    return store.getItem(DISABLE_CUSTOMER_SOFT_DELETE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Filters out internal rows and requests soft-deleted by the customer (never resurrected on rollback). */
export function filterCustomerVisibleRequests<T extends { type?: unknown; status?: unknown }>(
  requests: readonly T[] | null | undefined
): T[] {
  return (requests || []).filter((req) => {
    const typeStr = String(req?.type || '').trim();
    const statusStr = String(req?.status || '').trim();
    if (typeStr === 'agent_dialogue' || typeStr === 'site_visitor') return false;
    if (statusStr === CUSTOMER_DELETED_STATUS) return false;
    return true;
  });
}

/** Customer self-delete button appears ONLY while status is new and kill-switch is off. */
export function canCustomerSoftDeleteRequest(
  req: { status?: unknown } | null | undefined,
  flagDisabled = isCustomerRequestSoftDeleteDisabled()
): boolean {
  if (flagDisabled || !req) return false;
  const st = String(req.status || 'جديد').trim();
  return (CUSTOMER_DELETABLE_STATUSES as readonly string[]).includes(st);
}
