import { useState, useEffect, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeToTestTypes,
  addTestType,
  removeTestType,
  renameTestType,
  reorderTestTypes,
} from '../services/ciqFirebaseService';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCIQTestTypes — gerencia a lista configurável de tipos de teste (imunoensaios).
 *
 * Tipos são armazenados em Firestore: labs/{labId}/ciq-imuno-config/testTypes
 * Todas as mutações rodam sob transação Firestore — add/remove/rename são
 * atômicos e não dependem do estado local do hook, o que elimina a perda de
 * escritas concorrentes entre abas/operadores.
 *
 * Uso:
 *   const { types, loading, addType, renameType, removeType } = useCIQTestTypes();
 */
export function useCIQTestTypes() {
  const labId = useActiveLabId();

  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guard + subscription pattern — ver useCIQLots para justificativa.
  /* eslint-disable react-hooks/set-state-in-effect */
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
        if (firstSnap) {
          setLoading(false);
          firstSnap = false;
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [labId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const addType = useCallback(
    async (name: string): Promise<void> => {
      if (!labId) return;
      await addTestType(labId, name);
    },
    [labId],
  );

  const renameType = useCallback(
    async (oldName: string, newName: string): Promise<void> => {
      if (!labId) return;
      await renameTestType(labId, oldName, newName);
    },
    [labId],
  );

  const removeType = useCallback(
    async (name: string): Promise<void> => {
      if (!labId) return;
      await removeTestType(labId, name);
    },
    [labId],
  );

  const reorder = useCallback(
    async (ordered: string[]): Promise<void> => {
      if (!labId) return;
      await reorderTestTypes(labId, ordered);
    },
    [labId],
  );

  return { types, loading, error, addType, renameType, removeType, reorder } as const;
}
