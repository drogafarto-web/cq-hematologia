import { useState, useEffect, useCallback } from 'react';
import { useActiveLabId } from '../../store/useAuthStore';
import type { Treinamento, TreinamentoFilters } from './types/Treinamento';
import {
  subscribeTrainamentos,
  registrarPresenca,
  updateTreinamentoStatus,
  emitirCertificado,
  softDeleteTreinamento,
} from './treinamentoService';

export function useTreinamentos(filters?: TreinamentoFilters) {
  const labId = useActiveLabId();
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) return;

    setLoading(true);
    const unsub = subscribeTrainamentos(
      labId,
      filters || {},
      (data: Treinamento[]) => {
        setTreinamentos(data);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsub;
  }, [labId, filters?.status, filters?.tipo, filters?.popId, filters?.instrutorId, filters?.busca]);

  const registrarPresencaHandler = useCallback(
    async (
      treinamentoId: string,
      participanteId: string,
      presente: boolean,
      assinatura?: string,
    ) => {
      if (!labId) throw new Error('No labId');
      await registrarPresenca(labId, treinamentoId, participanteId, presente, assinatura);
    },
    [labId],
  );

  const updateStatus = useCallback(
    async (treinamentoId: string, novoStatus: Treinamento['status'], motivo?: string) => {
      if (!labId) throw new Error('No labId');
      await updateTreinamentoStatus(labId, treinamentoId, novoStatus, motivo);
    },
    [labId],
  );

  const emitirCertificadoHandler = useCallback(
    async (treinamentoId: string, validadesMeses: number, url?: string) => {
      if (!labId) throw new Error('No labId');
      return await emitirCertificado(labId, treinamentoId, validadesMeses, url);
    },
    [labId],
  );

  const deletar = useCallback(
    async (treinamentoId: string) => {
      if (!labId) throw new Error('No labId');
      await softDeleteTreinamento(labId, treinamentoId);
    },
    [labId],
  );

  return {
    treinamentos,
    loading,
    error,
    registrarPresenca: registrarPresencaHandler,
    updateStatus,
    emitirCertificado: emitirCertificadoHandler,
    deletar,
  };
}
