/**
 * useLaudoActions — Hook for calling liberacao callables
 *
 * Provides:
 * - criarLaudo(input)
 * - liberarLaudo(input)
 * - Error handling + loading state
 */

import { useCallback, useState } from 'react';
import { httpsCallable, functions } from '../../../shared/services/firebase';

interface CriarLaudoInput {
  labId: string;
  runIds: string[];
  pacienteId: string;
  medicoSolicitanteId: string;
  exames: any[];
}

interface LiberarLaudoInput {
  labId: string;
  laudoId: string;
  signaturePayload: {
    hash: string;
    operatorId: string;
    timestamp: number;
  };
  observacao?: string;
}

interface UseLaudoActionsResult {
  criarLaudo: (input: CriarLaudoInput) => Promise<any>;
  liberarLaudo: (input: LiberarLaudoInput) => Promise<any>;
  isLoading: boolean;
  error: string | null;
}

export function useLaudoActions(): UseLaudoActionsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criarLaudo = useCallback(async (input: CriarLaudoInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const callable = httpsCallable(functions, 'criarLaudo');
      const result = await callable(input);
      return result.data;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao criar laudo';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const liberarLaudo = useCallback(async (input: LiberarLaudoInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const callable = httpsCallable(functions, 'liberarLaudo');
      const result = await callable(input);
      return result.data;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao liberar laudo';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    criarLaudo,
    liberarLaudo,
    isLoading,
    error,
  };
}

export default useLaudoActions;
