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
          const { data, error } = await pinnedClient.rpc(item.rpc_name, {
            p_data: payload,
          });

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
