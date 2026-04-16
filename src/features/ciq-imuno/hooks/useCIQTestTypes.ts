import { useState, useEffect, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToTestTypes, saveTestTypes } from '../services/ciqFirebaseService';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCIQTestTypes — gerencia a lista configurável de tipos de teste (imunoensaios).
 *
 * Tipos são armazenados em Firestore: labs/{labId}/ciq-imuno-config/testTypes
 * Na primeira chamada, semeia os 10 tipos padrão se o documento não existir.
 *
 * Uso:
 *   const { types, loading, addType, renameType, removeType } = useCIQTestTypes();
 */
export function useCIQTestTypes() {
  const labId = useActiveLabId();

  const [types,   setTypes]   = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let firstSnap = true;

    const unsub = subscribeToTestTypes(
      labId,
      (incoming) => {
        setTypes(incoming);
        if (firstSnap) { setLoading(false); firstSnap = false; }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [labId]);

  const addType = useCallback(async (name: string): Promise<void> => {
    const trimmed = name.trim();
    if (!labId || !trimmed) return;
    if (types.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) return;
    await saveTestTypes(labId, [...types, trimmed]);
  }, [labId, types]);

  const renameType = useCallback(async (oldName: string, newName: string): Promise<void> => {
    const trimmed = newName.trim();
    if (!labId || !trimmed || oldName === trimmed) return;
    await saveTestTypes(labId, types.map((t) => (t === oldName ? trimmed : t)));
  }, [labId, types]);

  const removeType = useCallback(async (name: string): Promise<void> => {
    if (!labId) return;
    await saveTestTypes(labId, types.filter((t) => t !== name));
  }, [labId, types]);

  const reorder = useCallback(async (ordered: string[]): Promise<void> => {
    if (!labId) return;
    await saveTestTypes(labId, ordered);
  }, [labId]);

  return { types, loading, error, addType, renameType, removeType, reorder } as const;
}
