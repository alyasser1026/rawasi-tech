"use client";

import { getActiveCompanyId, supabase } from '@/lib/supabase';
import { fetchPaginatedData, runWithConcurrency } from '@/lib/supabase-pagination';
import { getReferenceTableCache, saveReferenceTableCache } from './offlineStore';

const REFERENCE_TABLES = [
  'projects',
  'job_orders',
  'partners',
  'accounts',
  'site_custodies',
] as const;

export type CachedReferenceTable = (typeof REFERENCE_TABLES)[number];

// The optional retention column appears automatically once its migration is applied.
export const JOB_ORDER_REFERENCE_SELECT =
  '*, boq_budget:boq_budget_id (work_item, unit, unit_contract_price, contract_quantity)';

const lastWarmedByCompany = new Map<string, number>();
const WARM_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Warms local IndexedDB reference caches for the active company while online so dropdowns
 * (`SmartCombo`, `JobOrderSelector`, `labor_logs`, `expenses`, `custodies`) work seamlessly offline.
 */
export async function warmCompanyReferenceCache(companyId?: string | null): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const cid = companyId || getActiveCompanyId();
  if (!cid) return;

  const now = Date.now();
  const lastWarmed = lastWarmedByCompany.get(cid) || 0;
  if (now - lastWarmed < WARM_COOLDOWN_MS) return;
  lastWarmedByCompany.set(cid, now);

  try {
    const [projRows, joRows, partRows, accRows] = await runWithConcurrency([
      () =>
        fetchPaginatedData(
          () => supabase.from('projects').select('*').setHeader('x-company-id', cid).order('id', { ascending: true }),
          'id',
          10000
        ),
      () =>
        fetchPaginatedData(
          () =>
            supabase
              .from('job_orders')
              .select(JOB_ORDER_REFERENCE_SELECT)
              .setHeader('x-company-id', cid)
              .order('created_at', { ascending: false })
              .order('id', { ascending: true }),
          'id',
          10000
        ),
      () =>
        fetchPaginatedData(
          () => supabase.from('partners').select('*').setHeader('x-company-id', cid).order('id', { ascending: true }),
          'id',
          10000
        ),
      () =>
        fetchPaginatedData(
          () => supabase.from('accounts').select('*').setHeader('x-company-id', cid).order('id', { ascending: true }),
          'id',
          10000
        ),
    ], 2);

    if (projRows) {
      await saveReferenceTableCache(cid, 'projects', projRows);
    }
    if (joRows) {
      await saveReferenceTableCache(cid, 'job_orders', joRows);
    }
    if (partRows) {
      await saveReferenceTableCache(cid, 'partners', partRows);
    }
    if (accRows) {
      await saveReferenceTableCache(cid, 'accounts', accRows);
    }
  } catch {
    /* ignore background warm errors */
  }
}

export async function readCachedTableRows(
  table: string,
  companyId?: string | null
): Promise<any[]> {
  const cid = companyId || getActiveCompanyId();
  if (!cid) return [];
  return getReferenceTableCache(cid, table);
}

export async function writeCachedTableRows(
  table: string,
  rows: any[],
  companyId?: string | null
): Promise<void> {
  const cid = companyId || getActiveCompanyId();
  if (!cid || !Array.isArray(rows) || rows.length === 0) return;
  const existing = await getReferenceTableCache(cid, table);
  if (existing.length === 0) {
    await saveReferenceTableCache(cid, table, rows);
    return;
  }
  const mergedMap = new Map<string, any>();
  for (const r of existing) {
    if (r?.id) mergedMap.set(String(r.id), r);
  }
  for (const r of rows) {
    if (r?.id) mergedMap.set(String(r.id), { ...mergedMap.get(String(r.id)), ...r });
  }
  await saveReferenceTableCache(cid, table, Array.from(mergedMap.values()));
}
