"use client";

import { getActiveCompanyId, supabase } from '@/lib/supabase';
import { getReferenceTableCache, saveReferenceTableCache } from './offlineStore';

const REFERENCE_TABLES = [
  'projects',
  'job_orders',
  'partners',
  'accounts',
  'site_custodies',
] as const;

export type CachedReferenceTable = (typeof REFERENCE_TABLES)[number];

/**
 * Warms local IndexedDB reference caches for the active company while online so dropdowns
 * (`SmartCombo`, `JobOrderSelector`, `labor_logs`, `expenses`, `custodies`) work seamlessly offline.
 */
export async function warmCompanyReferenceCache(companyId?: string | null): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const cid = companyId || getActiveCompanyId();
  if (!cid) return;

  try {
    const [projRes, joRes, partRes, accRes, custRes] = await Promise.all([
      supabase.from('projects').select('*').limit(500),
      supabase
        .from('job_orders')
        .select(
          'id, order_number, status, executor_type, contractor_id, project_id, assigned_qty, retention_percent, unit_price, boq_budget_id, notes, created_at, boq_budget:boq_budget_id ( work_item, unit, unit_contract_price, contract_quantity )'
        )
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase.from('partners').select('*').limit(1500),
      supabase.from('accounts').select('*').limit(1000),
      supabase
        .from('site_custodies')
        .select('id, custody_number, title, partner_id, project_id, disbursed_amount, spent_amount, remaining_amount, status, opened_date')
        .eq('status', 'open')
        .limit(300),
    ]);

    if (!projRes.error && projRes.data) {
      await saveReferenceTableCache(cid, 'projects', projRes.data);
    }
    if (!joRes.error && joRes.data) {
      await saveReferenceTableCache(cid, 'job_orders', joRes.data);
    }
    if (!partRes.error && partRes.data) {
      await saveReferenceTableCache(cid, 'partners', partRes.data);
    }
    if (!accRes.error && accRes.data) {
      await saveReferenceTableCache(cid, 'accounts', accRes.data);
    }
    if (!custRes.error && custRes.data) {
      await saveReferenceTableCache(cid, 'site_custodies', custRes.data);
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
