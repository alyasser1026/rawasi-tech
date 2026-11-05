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
