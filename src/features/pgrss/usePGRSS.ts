import { useCallback } from 'react';
import { functions } from '../../shared/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { useActiveLabId } from '../../store/useAuthStore';
import { subscribeGeracoes, subscribeColetas } from './pgrssService';
import type { RegistroGeracao, ColletaResiduo } from './types/PGRSS';

/**
 * Hook para gerenciar operações PGRSS (geração e coleta de resíduos).
 */
export function usePGRSS() {
  const labId = useActiveLabId();

  const registrarGeracao = useCallback(
    async (
      tipo: string,
      descricao: string,
      peso_kg: number,
      responsavel: string,
      observacoes?: string,
    ) => {
      if (!labId) throw new Error('Lab ID não configurado');

      const fn = httpsCallable<any, any>(functions, 'registrarGeracao');
      const result = await fn({
        labId,
        tipo,
        descricao,
        peso_kg,
        responsavel,
        observacoes,
      });

      return result.data;
    },
    [labId],
  );

  const registrarColeta = useCallback(
    async (
      empresa_coletora: string,
      registroGeracaoIds: string[],
      peso_total_kg: number,
      comprovante_url?: string,
    ) => {
      if (!labId) throw new Error('Lab ID não configurado');

      const fn = httpsCallable<any, any>(functions, 'registrarColeta');
      const result = await fn({
        labId,
        empresa_coletora,
        registroGeracaoIds,
        peso_total_kg,
        comprovante_url,
      });

      return result.data;
    },
    [labId],
  );

  const validarSegregacao = useCallback(async () => {
    if (!labId) throw new Error('Lab ID não configurado');

    const fn = httpsCallable<any, any>(functions, 'validarSegregacao');
    const result = await fn({ labId });

    return result.data;
  }, [labId]);

  const subscribeToGeracoes = useCallback(
    (callback: (registros: RegistroGeracao[]) => void, onError?: (err: Error) => void) => {
      if (!labId) return () => {};
      return subscribeGeracoes(labId, callback, onError);
    },
    [labId],
  );

  const subscribeToColetas = useCallback(
    (callback: (coletas: ColletaResiduo[]) => void, onError?: (err: Error) => void) => {
      if (!labId) return () => {};
      return subscribeColetas(labId, callback, onError);
    },
    [labId],
  );

  return {
    registrarGeracao,
    registrarColeta,
    validarSegregacao,
    subscribeToGeracoes,
    subscribeToColetas,
  };
}
