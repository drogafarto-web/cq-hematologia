/**
 * useLabApoio.ts — primary hook for lab-apoio module.
 *
 * Mirrors useColaboradores.ts pattern:
 *   - subscribes to contratos in real-time
 *   - provides mutation callables (create, update, delete, avaliacao, upload)
 *   - handles loading/error states
 */

import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { subscribeContratos, unwrapCallableError, type LabId } from '../services/labApoioService';
import type { Contrato, ContratoInput, ContratoUpdateInput, AvaliacaoPeriodica, UserId } from '../types/LabApoio';

interface UseLabApoioOptions {
  somenteAtivos?: boolean;
  includeDeleted?: boolean;
  limit?: number;
}

export function useLabApoio(options: UseLabApoioOptions = {}) {
  const labId = useActiveLabId() as LabId;
  const user = useUser();

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to contratos
  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeContratos(
      labId,
      {
        ativo: options.somenteAtivos ? true : undefined,
        includeDeleted: options.includeDeleted ?? false,
        limit: options.limit ?? 1000,
      },
      (data) => {
        setContratos(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, options.somenteAtivos, options.includeDeleted, options.limit]);

  // Callables
  const createContrato = useCallback(
    async (input: ContratoInput): Promise<{ id: string }> => {
      if (!labId || !user) throw new Error('Not authenticated or no active lab');
      try {
        const callable = httpsCallable<any, { ok: boolean; contratoId: string }>(
          functions,
          'labApoio_createContrato',
        );
        const result = await callable({ labId, ...input });
        return { id: result.data.contratoId };
      } catch (err) {
        throw unwrapCallableError(err);
      }
    },
    [labId, user],
  );

  const updateContrato = useCallback(
    async (contratoId: string, input: ContratoUpdateInput): Promise<void> => {
      if (!labId || !user) throw new Error('Not authenticated or no active lab');
      try {
        const callable = httpsCallable<any, { ok: boolean }>(
          functions,
          'labApoio_updateContrato',
        );
        await callable({ labId, contratoId, ...input });
      } catch (err) {
        throw unwrapCallableError(err);
      }
    },
    [labId, user],
  );

  const softDeleteContrato = useCallback(
    async (contratoId: string, motivo: string): Promise<void> => {
      if (!labId || !user) throw new Error('Not authenticated or no active lab');
      try {
        const callable = httpsCallable<any, { ok: boolean }>(
          functions,
          'labApoio_softDeleteContrato',
        );
        await callable({ labId, contratoId, motivo });
      } catch (err) {
        throw unwrapCallableError(err);
      }
    },
    [labId, user],
  );

  const registrarAvaliacaoPeriodica = useCallback(
    async (contratoId: string, avaliacao: Omit<AvaliacaoPeriodica, 'id'>): Promise<void> => {
      if (!labId || !user) throw new Error('Not authenticated or no active lab');
      try {
        const callable = httpsCallable<any, { ok: boolean }>(
          functions,
          'labApoio_registrarAvaliacaoPeriodica',
        );
        await callable({ labId, contratoId, avaliacao });
      } catch (err) {
        throw unwrapCallableError(err);
      }
    },
    [labId, user],
  );

  const uploadContratoAnexo = useCallback(
    async (
      contratoId: string,
      filePath: string,
      fileSize: number,
      contentType: string,
    ): Promise<{ url: string }> => {
      if (!labId || !user) throw new Error('Not authenticated or no active lab');
      try {
        const callable = httpsCallable<any, { ok: boolean; url: string }>(
          functions,
          'labApoio_uploadContratoAnexo',
        );
        const result = await callable({
          labId,
          contratoId,
          fileMeta: { path: filePath, size: fileSize, contentType },
        });
        return { url: result.data.url };
      } catch (err) {
        throw unwrapCallableError(err);
      }
    },
    [labId, user],
  );

  return {
    contratos,
    loading,
    error,
    createContrato,
    updateContrato,
    softDeleteContrato,
    registrarAvaliacaoPeriodica,
    uploadContratoAnexo,
  };
}
