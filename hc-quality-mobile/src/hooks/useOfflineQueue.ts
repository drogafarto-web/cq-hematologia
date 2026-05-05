import { useEffect, useState, useCallback } from 'react';
import { getQueue, QueuedAction } from '../services/offlineQueueService';

const POLL_INTERVAL_MS = 3000;

/**
 * useOfflineQueue — Exposes the current state of the offline action queue.
 *
 * Polls AsyncStorage every POLL_INTERVAL_MS to reflect changes made by
 * useOfflineSync (successful dequeues, new enqueues).
 *
 * Used by: OfflineIndicator (queue length badge)
 */
export function useOfflineQueue(): {
  queueLength: number;
  queue: QueuedAction[];
  refresh: () => Promise<void>;
} {
  const [queue, setQueue] = useState<QueuedAction[]>([]);

  const refresh = useCallback(async () => {
    const q = await getQueue();
    setQueue(q);
  }, []);

  useEffect(() => {
    // Initial load
    refresh();

    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    queueLength: queue.length,
    queue,
    refresh,
  };
}
