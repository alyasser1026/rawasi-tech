"use client";

export type OfflineEntityType =
  | 'labor_log_draft'
  | 'expense_draft'
  | 'custody_expense_draft'
  | 'attendance_draft';

export type OfflineRpcName =
  | 'save_labor_log_draft'
  | 'save_expense_draft'
  | 'save_employee_attendance_draft';

export type OfflineItemStatus = 'pending' | 'syncing' | 'failed';

export interface OfflineQueueItem {
  /** Generated UUID (= client_request_id) */
  id: string;
  /** Strictly monotonic sequence number guaranteeing FIFO execution */
  seq: number;
  company_id: string;
  company_name: string;
  user_id: string;
  entity_type: OfflineEntityType;
  rpc_name: OfflineRpcName;
  payload: Record<string, any>;
  description: string;
  amount: number;
  has_attachment: boolean;
  status: OfflineItemStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

export interface OfflineAttachmentRecord {
  /** Matches OfflineQueueItem.id (client_request_id) */
  id: string;
  company_id: string;
  module: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  caption: string | null;
  blob: Blob;
  created_at: string;
}

export interface ReferenceCacheRecord {
  /** `${company_id}:${table}` */
  cache_key: string;
  company_id: string;
  table: string;
  rows: any[];
  updated_at: string;
}

const DB_NAME = 'phi_offline_v1';
const DB_VERSION = 1;
const STORE_QUEUE = 'sync_queue';
const STORE_ATTACHMENTS = 'offline_attachments';
const STORE_REF_CACHE = 'ref_cache';

export const OFFLINE_QUEUE_EVENT = 'phi:offline-queue-changed';
const BROADCAST_CHANNEL_NAME = 'phi_offline_queue_bc';

let localSeqCounter = 0;

export function nextMonotonicSeq(): number {
  localSeqCounter = (localSeqCounter + 1) % 1000;
  return Date.now() * 1000 + localSeqCounter;
}

export function generateClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openOfflineDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable in this environment'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const qStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        qStore.createIndex('by_seq', 'seq', { unique: false });
        qStore.createIndex('by_company', 'company_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
        const aStore = db.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'id' });
        aStore.createIndex('by_company', 'company_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_REF_CACHE)) {
        const rStore = db.createObjectStore(STORE_REF_CACHE, { keyPath: 'cache_key' });
        rStore.createIndex('by_company', 'company_id', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
}

export function notifyOfflineQueueChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: 'QUEUE_UPDATED', ts: Date.now() });
      bc.close();
    }
  } catch {
    /* ignore */
  }
}

export function subscribeOfflineQueueBroadcast(onUpdate: () => void): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  try {
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    bc.onmessage = () => onUpdate();
    return () => bc.close();
  } catch {
    return () => {};
  }
}

export async function enqueueOfflineDraft(
  item: OfflineQueueItem,
  attachment?: OfflineAttachmentRecord | null
): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const stores = attachment ? [STORE_QUEUE, STORE_ATTACHMENTS] : [STORE_QUEUE];
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore(STORE_QUEUE).put(item);
    if (attachment) {
      tx.objectStore(STORE_ATTACHMENTS).put(attachment);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to enqueue offline draft'));
  });
  notifyOfflineQueueChanged();
}

export async function listOfflineQueueItems(userId?: string | null): Promise<OfflineQueueItem[]> {
  try {
    const db = await openOfflineDb();
    const items = await new Promise<OfflineQueueItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const idx = tx.objectStore(STORE_QUEUE).index('by_seq');
      const req = idx.getAll();
      req.onsuccess = () => resolve((req.result || []) as OfflineQueueItem[]);
      req.onerror = () => reject(req.error);
    });
    const sorted = items.sort((a, b) => a.seq - b.seq);
    if (userId) {
      return sorted.filter((it) => !it.user_id || it.user_id === userId);
    }
    return sorted;
  } catch {
    return [];
  }
}

export async function updateOfflineQueueItem(
  id: string,
  patch: Partial<OfflineQueueItem>
): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as OfflineQueueItem | undefined;
      if (existing) {
        store.put({ ...existing, ...patch });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notifyOfflineQueueChanged();
}

export async function removeOfflineQueueItem(id: string): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE, STORE_ATTACHMENTS], 'readwrite');
    tx.objectStore(STORE_QUEUE).delete(id);
    tx.objectStore(STORE_ATTACHMENTS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notifyOfflineQueueChanged();
}

export async function getOfflineAttachment(id: string): Promise<OfflineAttachmentRecord | null> {
  try {
    const db = await openOfflineDb();
    return await new Promise<OfflineAttachmentRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
      const req = tx.objectStore(STORE_ATTACHMENTS).get(id);
      req.onsuccess = () => resolve((req.result as OfflineAttachmentRecord) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteOfflineAttachment(id: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ATTACHMENTS, 'readwrite');
      tx.objectStore(STORE_ATTACHMENTS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function saveReferenceTableCache(
  companyId: string,
  table: string,
  rows: any[]
): Promise<void> {
  if (!companyId || !table) return;
  try {
    const db = await openOfflineDb();
    const record: ReferenceCacheRecord = {
      cache_key: `${companyId}:${table}`,
      company_id: companyId,
      table,
      rows,
      updated_at: new Date().toISOString(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_REF_CACHE, 'readwrite');
      tx.objectStore(STORE_REF_CACHE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore quota or private mode issues */
  }
}

export async function getReferenceTableCache(
  companyId: string,
  table: string
): Promise<any[]> {
  if (!companyId || !table) return [];
  try {
    const db = await openOfflineDb();
    return await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORE_REF_CACHE, 'readonly');
      const req = tx.objectStore(STORE_REF_CACHE).get(`${companyId}:${table}`);
      req.onsuccess = () => {
        const rec = req.result as ReferenceCacheRecord | undefined;
        resolve(Array.isArray(rec?.rows) ? rec!.rows : []);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}
