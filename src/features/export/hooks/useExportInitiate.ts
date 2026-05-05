/**
 * Hook: useExportInitiate
 * Wraps the initiateExport Cloud Callable with loading/error state.
 * Returns a submit function + status flags — no side-effects on mount.
 */

import { useState, useCallback } from 'react';
import { initiateExportCallable } from '../services/exportCallables';
import type { ExportRequest, ExportInitiateResponse } from '../types';

interface UseExportInitiateReturn {
  /** Initiate an export job; resolves with server response or throws */
  submit: (request: ExportRequest) => Promise<ExportInitiateResponse>;
  /** True while the Cloud Function call is in-flight */
  loading: boolean;
  /** Error message from the last failed call, null otherwise */
  error: string | null;
  /** Clear the last error */
  clearError: () => void;
}

export function useExportInitiate(): UseExportInitiateReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (request: ExportRequest): Promise<ExportInitiateResponse> => {
      setLoading(true);
      setError(null);

      try {
        const result = await initiateExportCallable(request);
        return result.data;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Falha ao iniciar exportação. Tente novamente.';
        setError(message);
        console.error('[Export] initiateExport failed:', err);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { submit, loading, error, clearError };
}
