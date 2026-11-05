"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  OFFLINE_QUEUE_EVENT,
  OfflineQueueItem,
  listOfflineQueueItems,
  removeOfflineQueueItem,
  subscribeOfflineQueueBroadcast,
} from './offlineStore';
import { flushOfflineQueue } from './syncManager';

export function useOfflineSync(userId?: string | null) {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [items, setItems] = useState<OfflineQueueItem[]>([]);

  const reloadQueue = useCallback(async () => {
    const list = await listOfflineQueueItems(userId);
    setItems(list);
    setIsSyncing(list.some((it) => it.status === 'syncing'));
  }, [userId]);

  const triggerSync = useCallback(
    async (onlyItemId?: string) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
      setIsSyncing(true);
      try {
        const res = await flushOfflineQueue(onlyItemId ? { onlyItemId } : undefined);
        await reloadQueue();
        return res;
      } finally {
        setIsSyncing(false);
      }
    },
    [reloadQueue]
  );

  const deleteQueuedItem = useCallback(
    async (id: string) => {
      await removeOfflineQueueItem(id);
      await reloadQueue();
    },
    [reloadQueue]
  );

  useEffect(() => {
    void reloadQueue();

    const handleOnline = () => {
      setIsOnline(true);
      void triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleQueueEvent = () => {
      void reloadQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueEvent);
    const unsubBc = subscribeOfflineQueueBroadcast(handleQueueEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueEvent);
      unsubBc();
    };
  }, [reloadQueue, triggerSync]);

  const pendingCount = items.filter((it) => it.status === 'pending' || it.status === 'syncing').length;
  const failedCount = items.filter((it) => it.status === 'failed').length;

  return {
    isOnline,
    isSyncing,
    items,
    totalCount: items.length,
    pendingCount,
    failedCount,
    reloadQueue,
    retryAll: () => triggerSync(),
    retryItem: (id: string) => triggerSync(id),
    deleteItem: deleteQueuedItem,
  };
}
