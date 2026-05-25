import { useState, useCallback } from 'react';
import { createRTAction } from '../services/rtActionService';
import type { RTActionInput, RTAction } from '../types/RTAction';

interface UseRTActionResult {
  create: (data: RTActionInput) => Promise<RTAction>;
  isSaving: boolean;
  error: string | null;
}

export function useRTAction(labId: string): UseRTActionResult {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (data: RTActionInput): Promise<RTAction> => {
      setIsSaving(true);
      setError(null);
      try {
        const result = await createRTAction(labId, '', data);
        setIsSaving(false);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar ação de RT';
        setError(message);
        setIsSaving(false);
        throw err;
      }
    },
    [labId],
  );

  return { create, isSaving, error };
}
