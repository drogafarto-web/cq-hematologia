import { useState, useEffect, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeToTestTypes,
  addTestType,
  removeTestType,
  renameTestType,
  reorderTestTypes,
  setTestTypeManual,
} from '../services/ciqFirebaseService';
import type { CIQTestTypeConfig } from '../types/_shared_refs';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCIQTestTypes — gerencia a lista configurável de tipos de teste (imunoensaios).
 *
 * Tipos são armazenados em Firestore: labs/{labId}/ciq-imuno-config/testTypes
 * Todas as mutações rodam sob transação Firestore — add/remove/rename/setManual
 * são atômicos e não dependem do estado local do hook, o que elimina a perda de
 * escritas concorrentes entre abas/operadores.
 *
 * Desde 2026-04-24 cada tipo carrega uma flag `manual` — quando `true`, o teste
 * é feito fora de analisador e o form de corrida segue o fluxo manual (picker
 * de kit direto, sem EquipamentoSelector). Docs pré-2026-04-24 ainda em
 * `string[]` são lidos transparentemente como `[{name, manual:false}]`.
 */
export function useCIQTestTypes() {
  const labId = useActiveLabId();

  const [types, setTypes] = useState<CIQTestTypeConfig[]>([]);
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
    async (name: string, manual: boolean = false): Promise<void> => {
      if (!labId) return;
      await addTestType(labId, name, manual);
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

  const setManual = useCallback(
    async (name: string, manual: boolean): Promise<void> => {
      if (!labId) return;
      await setTestTypeManual(labId, name, manual);
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

  return {
    types,
    loading,
    error,
    addType,
    renameType,
    removeType,
    setManual,
    reorder,
  } as const;
}
