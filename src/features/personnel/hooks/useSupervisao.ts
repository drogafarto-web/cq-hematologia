/**
 * personnel/hooks/useSupervisao.ts
 *
 * Hook reativo para Supervisões.
 * Subscribe em `personnel/{labId}/supervisoes` com cleanup.
 */

import { useCallback, useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  watchSupervisoes,
  createSupervisao,
  updateSupervisao,
  softDeleteSupervisao,
} from '../services/supervisaoService';
import type { SupervisaoRegistro, SupervisaoInput } from '../types/Supervisao';

export interface UseSupervisaoResult {
  supervisoes: SupervisaoRegistro[];
  loading: boolean;
  error: Error | null;
  create: (input: SupervisaoInput) => Promise<string>;
  update: (id: string, updates: Partial<Pick<SupervisaoRegistro, 'status' | 'checklistConcluido' | 'dataLiberacao' | 'observacoes'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useSupervisao(): UseSupervisaoResult {
  const labId = useActiveLabId();
  const [supervisoes, setSupervisoes] = useState<SupervisaoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setSupervisoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = watchSupervisoes(
      labId,
      (items) => {
        setSupervisoes(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId]);

  const create = useCallback(
    async (input: SupervisaoInput): Promise<string> => {
      if (!labId) throw new Error('Lab não selecionado.');
      return createSupervisao(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, updates: Partial<Pick<SupervisaoRegistro, 'status' | 'checklistConcluido' | 'dataLiberacao' | 'observacoes'>>) => {
      if (!labId) throw new Error('Lab não selecionado.');
      return updateSupervisao(labId, id, updates);
    },
    [labId],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Lab não selecionado.');
      return softDeleteSupervisao(labId, id);
    },
    [labId],
  );

  return { supervisoes, loading, error, create, update, remove };
}
