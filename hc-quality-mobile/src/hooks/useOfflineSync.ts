import { useEffect, useCallback, useRef } from 'react';
import { useNetInfo } from './useNetInfo';
import { getQueue, dequeueAction, markRetry } from '../services/offlineQueueService';
import { useMobileCallables } from './useMobileCallables';

const MAX_RETRIES = 5;

/**
 * useOfflineSync — Processes the offline action queue when connectivity is restored.
 *
 * Lifecycle:
 * 1. Monitors network via useNetInfo
 * 2. When isOnline transitions to true → drain the AsyncStorage queue
 * 3. For each queued action: re-invoke the Cloud Callable
 *    - On success → dequeueAction (removes from storage)
 *    - On failure → markRetry (increments counter)
 *    - Actions at MAX_RETRIES are skipped (require manual intervention)
 *
 * Server-wins conflict resolution: server fetches current state before
 * applying changes, so replaying an old action cannot overwrite newer data.
 *
 * Mount this hook at the app root (RootNavigator) so sync runs app-wide.
 */
export function useOfflineSync(): { isOnline: boolean } {
  const { isOnline } = useNetInfo();
  const { callFunction } = useMobileCallables();
  const isSyncingRef = useRef(false);

  const processSyncQueue = useCallback(async () => {
    if (!isOnline) return;

    // Guard against concurrent sync runs
    if (isSyncingRef.current) {
      console.log('[OfflineSync] Sync already in progress, skipping');
      return;
    }

    const queue = await getQueue();
    if (queue.length === 0) return;

    isSyncingRef.current = true;
    console.log(`[OfflineSync] Processing ${queue.length} queued actions...`);

    for (const action of queue) {
      if (action.retryCount >= MAX_RETRIES) {
        console.warn(
          `[OfflineSync] Skipping action ${action.id} (${action.action}) — max retries reached.`
        );
        continue;
      }

      try {
        await callFunction(action.action, {
          labId: action.labId,
          ...action.data,
        });

        await dequeueAction(action.id);
        console.log(`[OfflineSync] Action ${action.id} (${action.action}) synced.`);
      } catch (err: unknown) {
        const error = err as { message?: string };
        const errMsg = error.message ?? 'Unknown error';
        await markRetry(action.id, errMsg);
        console.warn(
          `[OfflineSync] Action ${action.id} retry ${action.retryCount + 1}/${MAX_RETRIES}: ${errMsg}`
        );
      }
    }

    isSyncingRef.current = false;
    console.log('[OfflineSync] Sync pass complete.');
  }, [isOnline, callFunction]);

  useEffect(() => {
    if (isOnline) {
      // Small delay to let the network stabilize after reconnect
      const timeout = setTimeout(() => {
        processSyncQueue();
      }, 1000);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [isOnline, processSyncQueue]);

  return { isOnline };
}
