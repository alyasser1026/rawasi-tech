"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/CompanyContext';
import { useToast } from '@/lib/toast-context';
import {
  FlushSyncResult,
  OFFLINE_SYNC_COMPLETED_EVENT,
  flushOfflineQueue,
} from '@/lib/offline/syncManager';
import { warmCompanyReferenceCache } from '@/lib/offline/referenceCache';

export const PHI_REALTIME_TABLE_EVENT = 'phi:realtime-table-updated';
const REALTIME_BC_NAME = 'phi_realtime_bc_v1';

const REALTIME_TABLES = [
  'labor_daily_logs',
  'expenses',
  'site_custodies',
  'daily_cash_closings',
  'invoices',
  'invoice_adjustment_notes',
  'receipt_vouchers',
  'payment_vouchers',
  'sub_claims',
  'purchase_orders',
  'supplier_invoices',
  'material_receipts',
  'material_issues',
  'stocktaking_sessions',
  'fixed_assets',
  'journal_headers',
  'projects',
  'job_orders',
  'partners',
  'contractor_assignments',
  'company_documents',
  'company_attachments',
] as const;

const TABLE_QUERY_KEYS: Record<string, string[][]> = {
  labor_daily_logs: [['labor_logs'], ['field_live_radar'], ['dashboard']],
  expenses: [['expenses'], ['site_custodies_summary'], ['field_live_radar'], ['dashboard']],
  site_custodies: [['site_custodies_summary'], ['expenses'], ['field_live_radar'], ['payment_vouchers'], ['vouchers_server_totals']],
  daily_cash_closings: [['daily_cash_closings'], ['dashboard']],
  invoices: [['invoices'], ['dashboard']],
  invoice_adjustment_notes: [['invoices'], ['invoice_adjustment_notes']],
  receipt_vouchers: [['receipt_vouchers'], ['dashboard']],
  payment_vouchers: [['payment_vouchers'], ['vouchers_server_totals'], ['site_custodies_summary'], ['dashboard']],
  sub_claims: [['sub_claims'], ['dashboard']],
  purchase_orders: [['purchase_orders'], ['procurement']],
  supplier_invoices: [['supplier_invoices'], ['procurement']],
  material_receipts: [['material_receipts'], ['inventory']],
  material_issues: [['material_issues'], ['inventory']],
  stocktaking_sessions: [['stocktaking_sessions'], ['inventory']],
  fixed_assets: [['fixed_assets']],
  journal_headers: [['journals'], ['journal_headers'], ['trial_balance'], ['dashboard']],
  projects: [['projects'], ['dashboard']],
  job_orders: [['job_orders'], ['job_order_performance']],
  partners: [['partners'], ['sub_contractors_list'], ['partners_phones_lookup']],
  contractor_assignments: [['contractor_tasks'], ['job_orders'], ['sub_contractors_list']],
  company_documents: [['company_documents'], ['audit']],
  company_attachments: [['expenses'], ['site_custodies_summary'], ['company_documents'], ['receipt_vouchers']],
};

export function useRealtimeTableRefresh(
  tables: string[],
  onRefresh: () => void
) {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;
  const tablesKey = tables.join(',');

  useEffect(() => {
    const watchSet = new Set(tablesKey.split(',').filter(Boolean));
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ table?: string }>).detail;
      if (!detail?.table || watchSet.has(detail.table) || detail.table === '*') {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          cbRef.current();
        }, 280);
      }
    };

    window.addEventListener(PHI_REALTIME_TABLE_EVENT, handleEvent);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(PHI_REALTIME_TABLE_EVENT, handleEvent);
    };
  }, [tablesKey]);
}

export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const { activeCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const router = useRouter();
  const pendingTablesRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Register PWA Service Worker & prefetch key field screens
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* ignore SW registration errors in unsupported contexts */
      });
    }
    const prefetchTimer = setTimeout(() => {
      if (navigator.onLine) {
        for (const route of ['/labor_logs', '/expenses', '/custodies', '/fieldops']) {
          try {
            router.prefetch(route);
          } catch {
            /* ignore */
          }
        }
      }
    }, 1800);
    return () => clearTimeout(prefetchTimer);
  }, [router]);

  // 2. Warm per-company offline reference cache & flush queued offline drafts on reconnect/visibility
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (activeCompanyId && navigator.onLine) {
      void warmCompanyReferenceCache(activeCompanyId);
      void flushOfflineQueue();
    }

    const onOnline = () => {
      if (activeCompanyId) {
        void warmCompanyReferenceCache(activeCompanyId);
      }
      void flushOfflineQueue();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void flushOfflineQueue();
      }
    };

    const onSyncCompleted = (e: Event) => {
      const detail = (e as CustomEvent<FlushSyncResult>).detail;
      const count = detail?.syncedCount || 0;
      if (count > 0) {
        void queryClient.invalidateQueries({ queryKey: ['labor_logs'] });
        void queryClient.invalidateQueries({ queryKey: ['expenses'] });
        void queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
        void queryClient.invalidateQueries({ queryKey: ['field_live_radar'] });
        window.dispatchEvent(
          new CustomEvent(PHI_REALTIME_TABLE_EVENT, { detail: { table: '*' } })
        );
        showToast(
          count === 1
            ? 'تمت مزامنة المسودة المحفوظة تلقائياً مع الخادم'
            : `تمت مزامنة ${count} مسودات محفوظة تلقائياً مع الخادم`,
          'success'
        );
      }
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(OFFLINE_SYNC_COMPLETED_EVENT, onSyncCompleted);

    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(OFFLINE_SYNC_COMPLETED_EVENT, onSyncCompleted);
    };
  }, [activeCompanyId, queryClient, showToast]);

  // 3. Company-filtered Supabase Realtime channel + cross-tab BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || !activeCompanyId) return;

    const flushTableInvalidations = (broadcastToTabs: boolean) => {
      const tables = Array.from(pendingTablesRef.current);
      pendingTablesRef.current.clear();
      if (tables.length === 0) return;

      const invalidated = new Set<string>();
      for (const table of tables) {
        const keys = TABLE_QUERY_KEYS[table] || [[table]];
        for (const qk of keys) {
          const serialized = qk.join(':');
          if (!invalidated.has(serialized)) {
            invalidated.add(serialized);
            void queryClient.invalidateQueries({ queryKey: qk });
          }
        }
        window.dispatchEvent(
          new CustomEvent(PHI_REALTIME_TABLE_EVENT, {
            detail: { table, companyId: activeCompanyId },
          })
        );
      }

      if (broadcastToTabs && typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel(REALTIME_BC_NAME);
          bc.postMessage({ companyId: activeCompanyId, tables });
          bc.close();
        } catch {
          /* ignore */
        }
      }
    };

    const scheduleTableInvalidation = (table: string, broadcastToTabs = true) => {
      pendingTablesRef.current.add(table);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        flushTableInvalidations(broadcastToTabs);
      }, 250);
    };

    const channel = supabase.channel(`phi_company_rt_${activeCompanyId}`);
    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `company_id=eq.${activeCompanyId}`,
        },
        () => {
          scheduleTableInvalidation(table, true);
        }
      );
    }
    channel.subscribe();

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(REALTIME_BC_NAME);
        bc.onmessage = (ev) => {
          if (ev.data?.companyId === activeCompanyId && Array.isArray(ev.data.tables)) {
            for (const tbl of ev.data.tables) {
              scheduleTableInvalidation(String(tbl), false);
            }
          }
        };
      } catch {
        bc = null;
      }
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (bc) {
        try {
          bc.close();
        } catch {
          /* ignore */
        }
      }
      void supabase.removeChannel(channel);
    };
  }, [activeCompanyId, queryClient]);

  return <>{children}</>;
}
