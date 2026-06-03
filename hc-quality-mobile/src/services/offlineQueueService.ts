import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Offline Queue Service
 *
 * Persists failed Cloud Callable actions to AsyncStorage so they can be
 * retried when connectivity is restored (useOfflineSync).
 *
 * STRIDE T-03.2-01: Queue stores minimal action refs (action name + labId +
 * data fields). Server re-fetches authoritative state before applying;
 * no stale full-document overwrite possible.
 *
 * MAX_RETRIES: after 5 attempts an action stays in the queue but is skipped
 * during sync. Manual intervention required (visible in OfflineQueueScreen).
 */

export type QueuedActionType =
  | 'submitCIQComment'
  | 'updateNCStatus'
  | 'submitReading'
  | 'submitTrainingSignature';

export interface QueuedAction {
  id: string;
  action: QueuedActionType;
  labId: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

const QUEUE_KEY = '@hcquality/offlineQueue';
const MAX_RETRIES = 5;

/** Generate a simple unique ID without the `uuid` package */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Persist a new queued action to AsyncStorage.
 * Returns the generated action ID.
 */
export async function enqueueAction(
  action: QueuedActionType,
  labId: string,
  data: Record<string, unknown>,
): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = existing ? (JSON.parse(existing) as QueuedAction[]) : [];

    const newAction: QueuedAction = {
      id: generateId(),
      action,
      labId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    queue.push(newAction);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    console.log(`[OfflineQueue] Enqueued ${action} (id: ${newAction.id})`);
    return newAction.id;
  } catch (err) {
    console.error('[OfflineQueue] enqueueAction failed:', err);
    throw err;
  }
}

/**
 * Retrieve all queued actions from AsyncStorage.
 * Returns an empty array on read failure (fail-open: UI won't crash).
 */
export async function getQueue(): Promise<QueuedAction[]> {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_KEY);
    return existing ? (JSON.parse(existing) as QueuedAction[]) : [];
  } catch (err) {
    console.error('[OfflineQueue] getQueue failed:', err);
    return [];
  }
}

/**
 * Remove a successfully processed action from the queue.
 */
export async function dequeueAction(id: string): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_KEY);
    if (!existing) return;

    const queue = JSON.parse(existing) as QueuedAction[];
    const filtered = queue.filter((a) => a.id !== id);

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    console.log(`[OfflineQueue] Dequeued ${id}`);
  } catch (err) {
    console.error('[OfflineQueue] dequeueAction failed:', err);
  }
}

/**
 * Increment retry count and record last error message for a queued action.
 * Actions that exceed MAX_RETRIES will be skipped by useOfflineSync.
 */
export async function markRetry(id: string, error: string): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_KEY);
    if (!existing) return;

    const queue = JSON.parse(existing) as QueuedAction[];
    const updated = queue.map((a) =>
      a.id === id ? { ...a, retryCount: a.retryCount + 1, lastError: error } : a,
    );

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));

    const action = updated.find((a) => a.id === id);
    if (action && action.retryCount >= MAX_RETRIES) {
      console.warn(
        `[OfflineQueue] Action ${id} (${action.action}) has reached MAX_RETRIES (${MAX_RETRIES}). ` +
          'Manual intervention required.',
      );
    }
  } catch (err) {
    console.error('[OfflineQueue] markRetry failed:', err);
  }
}

/**
 * Clear the entire queue (used in tests or manual reset).
 */
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
    console.log('[OfflineQueue] Queue cleared');
  } catch (err) {
    console.error('[OfflineQueue] clearQueue failed:', err);
  }
}

/** Exposed for informational purposes (OfflineQueueScreen) */
export const MAX_RETRY_LIMIT = MAX_RETRIES;
