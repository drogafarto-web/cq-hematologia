import { useCallback } from 'react';
// @ts-ignore - firebase/functions types
import { httpsCallable } from 'firebase/functions';
import { functions } from '../core/firebase';
import { enqueueAction, QueuedActionType } from '../services/offlineQueueService';

/**
 * useMobileCallables — Typed wrapper for Firebase Cloud Callables.
 *
 * On network failure (`unavailable` or network error), the action is
 * automatically queued to AsyncStorage for retry by useOfflineSync.
 *
 * Validation errors (`invalid-argument`) are NOT queued — they will
 * fail again on retry with the same payload.
 *
 * STRIDE T-03.2-03: labId binding validated server-side.
 * STRIDE T-03.2-04: Zod schema validates all inputs on the Function side.
 */
export function useMobileCallables() {
  const callFunction = useCallback(
    async (functionName: string, data: Record<string, unknown>): Promise<unknown> => {
      try {
        const fn = httpsCallable(functions, functionName);
        const result = await fn(data);
        return (result as { data: unknown }).data;
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        console.warn(`[Callable] ${functionName} failed: ${error.message ?? 'unknown error'}`);

        // Only queue retryable network/availability errors
        const isRetryable =
          error.code === 'unavailable' ||
          error.code === 'deadline-exceeded' ||
          error.message?.toLowerCase().includes('network') ||
          error.message?.toLowerCase().includes('fetch');

        const isValidation = error.code === 'invalid-argument';

        if (isRetryable && !isValidation) {
          // Only queue known action types
          const KNOWN_ACTIONS: QueuedActionType[] = [
            'submitCIQComment',
            'updateNCStatus',
            'submitReading',
            'submitTrainingSignature',
          ];

          if (KNOWN_ACTIONS.includes(functionName as QueuedActionType)) {
            const labId = typeof data.labId === 'string' ? data.labId : '';
            await enqueueAction(functionName as QueuedActionType, labId, data);
          }
        }

        throw err;
      }
    },
    [],
  );

  return { callFunction };
}
