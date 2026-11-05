"use client";

import { createCompanyPinnedClient, getValidSessionToken } from '@/lib/supabase';
import {
  isOfflineAttachmentRef,
  uploadAttachmentToTelegram,
} from '@/lib/attachments/telegramAttachments';
import { isNetworkError } from './offlineExecutor';
import {
  OfflineQueueItem,
  deleteOfflineAttachment,
  getOfflineAttachment,
  listOfflineQueueItems,
  removeOfflineQueueItem,
  updateOfflineQueueItem,
} from './offlineStore';

export const OFFLINE_SYNC_COMPLETED_EVENT = 'phi:offline-sync-completed';

export interface FlushSyncResult {
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  syncedCompanies: string[];
}

let activeFlushPromise: Promise<FlushSyncResult> | null = null;

/**
 * Flushes queued offline drafts strictly sequentially in FIFO order (`seq` ascending).
 * - Refreshes/validates JWT session first.
 * - Uploads any local IndexedDB attachment Blob to `/api/attachments` before calling the draft RPC.
 * - Uses `createCompanyPinnedClient(item.company_id, accessToken)` so every queued draft lands
 *   in the exact company where it was created even if the user switched companies in the UI.
 */
export async function flushOfflineQueue(options?: {
  onlyItemId?: string;
}): Promise<FlushSyncResult> {
  if (typeof window === 'undefined') {
    return { syncedCount: 0, failedCount: 0, remainingCount: 0, syncedCompanies: [] };
  }
  if (!navigator.onLine) {
    const items = await listOfflineQueueItems();
    return { syncedCount: 0, failedCount: 0, remainingCount: items.length, syncedCompanies: [] };
  }

  if (activeFlushPromise) {
    return activeFlushPromise;
  }

  activeFlushPromise = (async (): Promise<FlushSyncResult> => {
    let syncedCount = 0;
    let failedCount = 0;
    const syncedCompanies = new Set<string>();

    try {
      const authInfo = await getValidSessionToken();
      if (!authInfo) {
        const current = await listOfflineQueueItems();
        return {
          syncedCount: 0,
          failedCount: 0,
          remainingCount: current.length,
          syncedCompanies: [],
        };
      }

      const allItems = await listOfflineQueueItems(authInfo.userId);
      const targets: OfflineQueueItem[] = options?.onlyItemId
        ? allItems.filter((it) => it.id === options.onlyItemId)
        : allItems;

      for (const item of targets) {
        if (!navigator.onLine) break;

        await updateOfflineQueueItem(item.id, {
          status: 'syncing',
          last_error: null,
        });

        try {
          const payload: Record<string, any> = {
            ...item.payload,
            company_id: item.company_id,
            client_request_id: item.id,
            is_posted: false,
          };
          delete payload.action;

          // Step A: Upload local attachment Blob to Telegram Bot API if still offline-referenced
          if (item.has_attachment || isOfflineAttachmentRef(String(payload.invoice_image || ''))) {
            const localAtt = await getOfflineAttachment(item.id);
            if (localAtt) {
              const uploaded = await uploadAttachmentToTelegram({
                blob: localAtt.blob,
                fileName: localAtt.file_name,
                mimeType: localAtt.mime_type,
                module: localAtt.module || 'expenses',
                companyId: item.company_id,
                clientRequestId: item.id,
                caption: localAtt.caption || item.description,
                accessToken: authInfo.accessToken,
              });
              payload.invoice_image = uploaded.url;
              await updateOfflineQueueItem(item.id, {
                payload,
                has_attachment: false,
              });
              await deleteOfflineAttachment(item.id);
            } else if (isOfflineAttachmentRef(String(payload.invoice_image || ''))) {
              payload.invoice_image = null;
            }
          }

          // Step B: Execute idempotent draft-only RPC pinned to item.company_id
          const pinnedClient = createCompanyPinnedClient(item.company_id, authInfo.accessToken);
          let { data, error } = await pinnedClient.rpc(item.rpc_name, {
            p_data: payload,
          });

          // Graceful fallback for remote databases without Phase 8 RPCs
          if (
            error &&
            (error.code === 'PGRST202' ||
              (typeof error.message === 'string' &&
                (error.message.includes('Could not find the function') ||
                  error.message.includes('schema cache'))))
          ) {
            if (item.rpc_name === 'save_expense_draft') {
              try {
                const settlementPayload = {
                  p_id: payload.id || null,
                  p_exp_date: payload.exp_date || new Date().toISOString().split('T')[0],
                  p_main_category: payload.main_category || '',
                  p_sub_contractor: payload.sub_contractor || null,
                  p_site_ref: payload.site_ref || null,
                  p_creditor_account: payload.creditor_account || '',
                  p_description: payload.description || 'مصروف عام',
                  p_payee_name: payload.payee_name || null,
                  p_payment_method: payload.payment_method || 'آجل',
                  p_payment_account: payload.payment_account || null,
                  p_employee_name: payload.employee_name || null,
                  p_quantity: Number(payload.quantity) || 1,
                  p_unit_price: Number(payload.unit_price) || 0,
                  p_vat_amount: Number(payload.vat_amount) || 0,
                  p_discount_amount: Number(payload.discount_amount) || 0,
                  p_discount_account: payload.discount_account || null,
                  p_notes: payload.notes || null,
                  p_invoice_image: payload.invoice_image || null,
                  p_lines_data: Array.isArray(payload.lines_data) ? payload.lines_data : [],
                  p_is_auto_distributed: Boolean(payload.is_auto_distributed),
                  p_user_id: authInfo.userId || null,
                  p_project_id: payload.project_id || null,
                  p_payee_id: payload.payee_id || null,
                  p_job_order_id: payload.job_order_id || null,
                  p_is_deducted_from_contractor: Boolean(payload.is_deducted_from_contractor),
                };
                const fbRes = await pinnedClient.rpc('save_expense_with_settlement', settlementPayload);
                if (!fbRes.error) {
                  error = null;
                  data = { success: true };
                }
              } catch {
                // fall through to table upsert
              }

              if (error) {
                const tableRow: Record<string, any> = { ...payload, company_id: item.company_id, is_posted: false };
                delete tableRow.action;
                delete tableRow._stagedAttachment;
                const { error: insErr } = await pinnedClient.from('expenses').upsert(tableRow);
                if (!insErr) {
                  error = null;
                  data = { success: true };
                }
              }
            } else if (item.rpc_name === 'save_labor_log_draft') {
              const tableRow: Record<string, any> = { ...payload, company_id: item.company_id, is_posted: false };
              delete tableRow.action;
              delete tableRow._stagedAttachment;
              const { error: insErr } = await pinnedClient.from('labor_daily_logs').upsert(tableRow);
              if (!insErr) {
                error = null;
                data = { success: true };
              }
            }
          }

          if (error) {
            throw new Error(error.message || 'فشلت مزامنة المسودة مع الخادم');
          }
          if (data && data.success === false) {
            throw new Error(data.error || 'رفض الخادم حفظ المسودة');
          }

          await removeOfflineQueueItem(item.id);
          syncedCount += 1;
          syncedCompanies.add(item.company_id);
        } catch (err: any) {
          failedCount += 1;
          const errMsg = err?.message || 'تعذرت المزامنة مع الخادم';
          await updateOfflineQueueItem(item.id, {
            status: 'failed',
            retry_count: (item.retry_count || 0) + 1,
            last_error: errMsg,
          });

          // Stop immediately on connectivity loss so FIFO order is preserved
          if (isNetworkError(err)) {
            break;
          }
        }
      }

      const remaining = await listOfflineQueueItems(authInfo.userId);
      const result: FlushSyncResult = {
        syncedCount,
        failedCount,
        remainingCount: remaining.length,
        syncedCompanies: Array.from(syncedCompanies),
      };

      if (syncedCount > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(OFFLINE_SYNC_COMPLETED_EVENT, { detail: result })
        );
      }

      return result;
    } finally {
      activeFlushPromise = null;
    }
  })();

  return activeFlushPromise;
}
