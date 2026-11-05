"use client";

import { getActiveCompanyId, getValidSessionToken } from '@/lib/supabase';
import { getOfflineAttachment } from '@/lib/offline/offlineStore';

export const OFFLINE_ATTACHMENT_PREFIX = 'offline://attachment/';

export interface StagedAttachment {
  blob: Blob;
  fileName: string;
  mimeType: string;
  fileSize: number;
  caption?: string;
}

export interface UploadedTelegramAttachment {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export function isOfflineAttachmentRef(ref: string | null | undefined): boolean {
  return typeof ref === 'string' && ref.startsWith(OFFLINE_ATTACHMENT_PREFIX);
}

export function extractOfflineAttachmentId(ref: string): string {
  return ref.slice(OFFLINE_ATTACHMENT_PREFIX.length).trim();
}

/** Compresses large camera photos (> 1.4 MB) to crisp JPEG (<= 1920px) for fast upload & light IndexedDB storage. */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (
    typeof window === 'undefined' ||
    !file.type.startsWith('image/') ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif' ||
    file.size <= 1.4 * 1024 * 1024
  ) {
    return file;
  }

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1920;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.84
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

export async function uploadAttachmentToTelegram(params: {
  blob: Blob;
  fileName: string;
  mimeType: string;
  module: string;
  companyId?: string | null;
  clientRequestId?: string | null;
  caption?: string | null;
  accessToken?: string | null;
}): Promise<UploadedTelegramAttachment> {
  const targetCompanyId = params.companyId || getActiveCompanyId();
  if (!targetCompanyId) {
    throw new Error('لم يتم تحديد الشركة الحالية لرفع المرفق');
  }

  let token = params.accessToken || null;
  if (!token) {
    const authInfo = await getValidSessionToken();
    if (!authInfo) {
      throw new Error('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مرة أخرى لرفع المرفق');
    }
    token = authInfo.accessToken;
  }

  const rawFile =
    params.blob instanceof File
      ? params.blob
      : new File([params.blob], params.fileName || 'attachment', {
          type: params.mimeType || 'application/octet-stream',
        });

  const preparedFile = await compressImageIfNeeded(rawFile);

  const formData = new FormData();
  formData.append('file', preparedFile, preparedFile.name);
  formData.append('module', params.module || 'general');
  if (params.clientRequestId) {
    formData.append('client_request_id', params.clientRequestId);
  }
  if (params.caption) {
    formData.append('caption', params.caption);
  }

  const resp = await fetch('/api/attachments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-company-id': targetCompanyId,
    },
    body: formData,
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok || !body?.url) {
    throw new Error(body?.error || `فشل رفع المرفق (HTTP ${resp.status})`);
  }

  return {
    id: body.id,
    url: body.url,
    fileName: body.file_name || preparedFile.name,
    mimeType: body.mime_type || preparedFile.type || 'application/octet-stream',
    fileSize: body.file_size || preparedFile.size,
  };
}

export interface ResolvedAttachmentView {
  objectUrl: string;
  revokeAfterUse: boolean;
  mimeType: string;
  fileName: string;
  isOfflineLocal: boolean;
}

/** Resolves any stored attachment URL (/api/attachments/<id>, offline://attachment/<id>, data:, https:)
 *  into a browser-viewable URL while enforcing company-isolated JWT authentication. */
export async function resolveAttachmentForViewing(
  attachmentRef: string,
  companyId?: string | null
): Promise<ResolvedAttachmentView> {
  const trimmed = (attachmentRef || '').trim();
  if (!trimmed) {
    throw new Error('رابط المرفق فارغ');
  }

  if (isOfflineAttachmentRef(trimmed)) {
    const reqId = extractOfflineAttachmentId(trimmed);
    const localRec = await getOfflineAttachment(reqId);
    if (!localRec) {
      throw new Error('المرفق المحلي غير موجود في ذاكرة المتصفح');
    }
    return {
      objectUrl: URL.createObjectURL(localRec.blob),
      revokeAfterUse: true,
      mimeType: localRec.mime_type || 'application/octet-stream',
      fileName: localRec.file_name || 'offline-attachment',
      isOfflineLocal: true,
    };
  }

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    const mimeMatch = /^data:([^;,]+)/.exec(trimmed);
    return {
      objectUrl: trimmed,
      revokeAfterUse: false,
      mimeType: mimeMatch?.[1] || 'image/jpeg',
      fileName: 'attachment',
      isOfflineLocal: false,
    };
  }

  if (trimmed.startsWith('/api/attachments/')) {
    const targetCompany = companyId || getActiveCompanyId();
    if (!targetCompany) {
      throw new Error('لا توجد شركة نشطة لعرض المرفق');
    }
    const authInfo = await getValidSessionToken();
    if (!authInfo) {
      throw new Error('يرجى تسجيل الدخول لعرض المرفق المحمي');
    }

    const resp = await fetch(trimmed, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authInfo.accessToken}`,
        'x-company-id': targetCompany,
      },
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => null);
      throw new Error(errBody?.error || `تعذر فتح المرفق (HTTP ${resp.status})`);
    }

    const blob = await resp.blob();
    const contentType = resp.headers.get('content-type') || blob.type || 'application/octet-stream';
    const disp = resp.headers.get('content-disposition') || '';
    const fnMatch = /filename\*=UTF-8''([^;]+)/i.exec(disp);
    const fileName = fnMatch?.[1] ? decodeURIComponent(fnMatch[1]) : 'attachment';

    return {
      objectUrl: URL.createObjectURL(blob),
      revokeAfterUse: true,
      mimeType: contentType,
      fileName,
      isOfflineLocal: false,
    };
  }

  return {
    objectUrl: trimmed,
    revokeAfterUse: false,
    mimeType: trimmed.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    fileName: 'attachment',
    isOfflineLocal: false,
  };
}
