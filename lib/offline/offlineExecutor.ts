"use client";

import { getActiveCompanyId, getValidSessionToken, supabase } from '@/lib/supabase';
import {
  OFFLINE_ATTACHMENT_PREFIX,
  StagedAttachment,
  uploadAttachmentToTelegram,
} from '@/lib/attachments/telegramAttachments';
import {
  OfflineAttachmentRecord,
  OfflineEntityType,
  OfflineQueueItem,
  OfflineRpcName,
  enqueueOfflineDraft,
  generateClientRequestId,
  nextMonotonicSeq,
} from './offlineStore';

export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!err) return false;
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch failed') ||
    msg.includes('internet_disconnected') ||
    msg.includes('err_internet_disconnected')
  );
}

export function assertOnlineForPosting(actionLabel = 'الترحيل والاعتماد'): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  return true;
}

export interface OfflineDraftExecutionInput {
  entityType: OfflineEntityType;
  rpcName: OfflineRpcName;
  companyId?: string | null;
  companyName?: string | null;
  description: string;
  amount: number;
  payload: Record<string, any>;
  stagedAttachment?: StagedAttachment | null;
  attachmentModule?: string;
}

export interface OfflineDraftExecutionResult {
  mode: 'online' | 'queued';
  id: string;
  clientRequestId: string;
  record: Record<string, any>;
}

/**
 * Executes a strict DRAFT-ONLY save operation (`save_labor_log_draft` or `save_expense_draft`).
 * - Online: uploads any staged attachment to Telegram Bot API first, then calls the idempotent RPC.
 * - Offline (or mid-flight network drop): stores the draft + optional attachment Blob in IndexedDB FIFO queue.
 * - Never permits `is_posted = true` or accounting postings.
 */
export async function executeDraftWithOfflineQueue(
  input: OfflineDraftExecutionInput
): Promise<OfflineDraftExecutionResult> {
  const companyId = input.companyId || getActiveCompanyId();
  if (!companyId) {
    throw new Error('لم يتم تحديد الشركة الحالية لحفظ المسودة');
  }

  // Enforce Draft-Only rule on client before touching network or IndexedDB
  const cleanPayload: Record<string, any> = {
    ...input.payload,
    company_id: companyId,
    is_posted: false,
  };
  delete cleanPayload.action;

  const clientRequestId =
    (typeof cleanPayload.client_request_id === 'string' && cleanPayload.client_request_id) ||
    generateClientRequestId();
  cleanPayload.client_request_id = clientRequestId;

  const authInfo = await getValidSessionToken();
  const userId = authInfo?.userId || '';

  const queueFallback = async (): Promise<OfflineDraftExecutionResult> => {
    const nowIso = new Date().toISOString();
    let attachmentRec: OfflineAttachmentRecord | null = null;
    const queuedPayload = { ...cleanPayload };

    if (input.stagedAttachment) {
      const attRef = `${OFFLINE_ATTACHMENT_PREFIX}${clientRequestId}`;
      queuedPayload.invoice_image = attRef;
      attachmentRec = {
        id: clientRequestId,
        company_id: companyId,
        module: input.attachmentModule || 'expenses',
        file_name: input.stagedAttachment.fileName,
        mime_type: input.stagedAttachment.mimeType,
        file_size: input.stagedAttachment.fileSize,
        caption: input.stagedAttachment.caption || input.description || null,
        blob: input.stagedAttachment.blob,
        created_at: nowIso,
      };
    }

    const queueItem: OfflineQueueItem = {
      id: clientRequestId,
      seq: nextMonotonicSeq(),
      company_id: companyId,
      company_name: input.companyName || 'الشركة الحالية',
      user_id: userId,
      entity_type: input.entityType,
      rpc_name: input.rpcName,
      payload: queuedPayload,
      description: input.description,
      amount: Number(input.amount || 0),
      has_attachment: Boolean(attachmentRec),
      status: 'pending',
      retry_count: 0,
      last_error: null,
      created_at: nowIso,
    };

    await enqueueOfflineDraft(queueItem, attachmentRec);

    const optimisticRecord: Record<string, any> = {
      ...queuedPayload,
      id: queuedPayload.id || clientRequestId,
      company_id: companyId,
      client_request_id: clientRequestId,
      is_posted: false,
      _offline_queued: true,
      _offline_status: 'pending',
      created_at: nowIso,
    };

    return {
      mode: 'queued',
      id: optimisticRecord.id,
      clientRequestId,
      record: optimisticRecord,
    };
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return queueFallback();
  }

  try {
    const livePayload = { ...cleanPayload };

    if (input.stagedAttachment) {
      const uploaded = await uploadAttachmentToTelegram({
        blob: input.stagedAttachment.blob,
        fileName: input.stagedAttachment.fileName,
        mimeType: input.stagedAttachment.mimeType,
        module: input.attachmentModule || 'expenses',
        companyId,
        clientRequestId,
        caption: input.stagedAttachment.caption || input.description,
        accessToken: authInfo?.accessToken || null,
      });
      livePayload.invoice_image = uploaded.url;
    }

    const { data, error } = await supabase.rpc(input.rpcName, {
      p_data: livePayload,
    });

    if (error) {
      if (isNetworkError(error)) {
        return queueFallback();
      }

      // 🛡️ Graceful fallback if the remote Supabase database does not have Phase 8 RPCs applied yet
      const isMissingRpc =
        error.code === 'PGRST202' ||
        (typeof error.message === 'string' &&
          (error.message.includes('Could not find the function') ||
            error.message.includes('schema cache')));

      if (isMissingRpc && input.rpcName === 'save_expense_draft') {
        // Fallback 1: Try legacy save_expense_with_settlement RPC
        try {
          const settlementPayload = {
            p_id: livePayload.id || null,
            p_exp_date: livePayload.exp_date || new Date().toISOString().split('T')[0],
            p_main_category: livePayload.main_category || '',
            p_sub_contractor: livePayload.sub_contractor || null,
            p_site_ref: livePayload.site_ref || null,
            p_creditor_account: livePayload.creditor_account || '',
            p_description: livePayload.description || 'مصروف عام',
            p_payee_name: livePayload.payee_name || null,
            p_payment_method: livePayload.payment_method || 'آجل',
            p_payment_account: livePayload.payment_account || null,
            p_employee_name: livePayload.employee_name || null,
            p_quantity: Number(livePayload.quantity) || 1,
            p_unit_price: Number(livePayload.unit_price) || 0,
            p_vat_amount: Number(livePayload.vat_amount) || 0,
            p_discount_amount: Number(livePayload.discount_amount) || 0,
            p_discount_account: livePayload.discount_account || null,
            p_notes: livePayload.notes || null,
            p_invoice_image: livePayload.invoice_image || null,
            p_lines_data: Array.isArray(livePayload.lines_data) ? livePayload.lines_data : [],
            p_is_auto_distributed: Boolean(livePayload.is_auto_distributed),
            p_user_id: userId || null,
            p_project_id: livePayload.project_id || null,
            p_payee_id: livePayload.payee_id || null,
            p_job_order_id: livePayload.job_order_id || null,
            p_is_deducted_from_contractor: Boolean(livePayload.is_deducted_from_contractor),
          };

          const fallbackRes = await supabase.rpc('save_expense_with_settlement', settlementPayload);
          if (!fallbackRes.error && fallbackRes.data) {
            const rawParsed = typeof fallbackRes.data === 'string' ? JSON.parse(fallbackRes.data) : fallbackRes.data;
            const savedId = rawParsed?.id || livePayload.id || clientRequestId;

            if (livePayload.custody_id) {
              await supabase
                .from('expenses')
                .update({ custody_id: livePayload.custody_id, company_id: companyId })
                .eq('id', savedId);
            }

            return {
              mode: 'online',
              id: String(savedId),
              clientRequestId,
              record: {
                ...livePayload,
                id: savedId,
                is_posted: false,
              },
            };
          }
        } catch {
          // Fall through to table upsert fallback
        }

        // Fallback 2: Direct table upsert into public.expenses
        try {
          const directRow: Record<string, any> = { ...livePayload, company_id: companyId, is_posted: false };
          delete directRow._stagedAttachment;
          delete directRow.action;
          delete directRow._offline_queued;
          delete directRow._offline_status;

          let resRecord: any;
          if (livePayload.id) {
            const { data: updated, error: uErr } = await supabase
              .from('expenses')
              .update(directRow)
              .eq('id', livePayload.id)
              .select()
              .single();
            if (uErr) throw uErr;
            resRecord = updated;
          } else {
            const { data: inserted, error: iErr } = await supabase
              .from('expenses')
              .insert([directRow])
              .select()
              .single();
            if (iErr) throw iErr;
            resRecord = inserted;
          }

          if (resRecord) {
            return {
              mode: 'online',
              id: String(resRecord.id),
              clientRequestId,
              record: resRecord,
            };
          }
        } catch (tableErr: any) {
          throw new Error(tableErr?.message || error.message || 'فشل حفظ المصروف على الخادم');
        }
      } else if (isMissingRpc && input.rpcName === 'save_labor_log_draft') {
        // Fallback strategy for labor logs
        try {
          const laborRow: Record<string, any> = { ...livePayload, company_id: companyId, is_posted: false };
          delete laborRow._stagedAttachment;
          delete laborRow.action;
          delete laborRow._offline_queued;
          delete laborRow._offline_status;

          let resLabor: any;
          if (livePayload.id) {
            const { data: uLabor, error: uLErr } = await supabase
              .from('labor_daily_logs')
              .update(laborRow)
              .eq('id', livePayload.id)
              .select()
              .single();
            if (uLErr) throw uLErr;
            resLabor = uLabor;
          } else {
            const { data: iLabor, error: iLErr } = await supabase
              .from('labor_daily_logs')
              .insert([laborRow])
              .select()
              .single();
            if (iLErr) throw iLErr;
            resLabor = iLabor;
          }

          if (resLabor) {
            return {
              mode: 'online',
              id: String(resLabor.id),
              clientRequestId,
              record: resLabor,
            };
          }
        } catch (laborErr: any) {
          throw new Error(laborErr?.message || error.message || 'فشل حفظ سجل العمالة على الخادم');
        }
      }

      throw new Error(error.message || 'فشل حفظ المسودة على الخادم');
    }

    const savedRecord = (data?.record as Record<string, any>) || {
      ...livePayload,
      id: data?.id || livePayload.id || clientRequestId,
      is_posted: false,
    };

    return {
      mode: 'online',
      id: String(data?.id || savedRecord.id),
      clientRequestId,
      record: savedRecord,
    };
  } catch (err: any) {
    if (isNetworkError(err)) {
      return queueFallback();
    }
    throw err;
  }
}
