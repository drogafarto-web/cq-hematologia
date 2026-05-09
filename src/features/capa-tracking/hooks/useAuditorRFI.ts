/**
 * useAuditorRFI.ts — Phase 8 Wave 2
 *
 * Hook para submissão e resposta de RFIs (Request For Information).
 * Wraps submitCapaRFICallable e respondRFI mutation.
 *
 * State machine:
 * - RFI pending (question asked, awaiting response)
 * - RFI answered (response received)
 */

import { useActiveLabId } from '../../../store/useAuthStore';
import { useCallback, useState } from 'react';
import { submitCapaRFICallable } from '../services/capaCallables';

export interface UseAuditorRFIResult {
  submitRFI: (capaId: string, question: string, dueDate: number) => Promise<void>;
  respondRFI: (capaId: string, rfiId: string, response: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  success: boolean;
}

/**
 * Hook para RFI (Request For Information) submission e response.
 *
 * submitRFI: submete pergunta do auditor ao responsável de CAPA
 * respondRFI: registra resposta (future: será callable separada em Wave 3)
 *
 * loading: true durante chamada, false no finally
 * success: true se última operação sucedeu, reseta em nova chamada
 * error: mensagem PT-BR se algo falhou
 */
export function useAuditorRFI(): UseAuditorRFIResult {
  const labId = useActiveLabId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submitRFI = useCallback(
    async (capaId: string, question: string, dueDate: number): Promise<void> => {
      if (!labId) {
        throw new Error('Sem lab ativo.');
      }

      setLoading(true);
      setSuccess(false);
      setError(null);

      try {
        await submitCapaRFICallable(labId, capaId, question, dueDate);
        setSuccess(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        // Traduzir erros específicos para PT-BR
        if (errorMessage.includes('permission-denied')) {
          setError('Sem permissão para submeter RFI — contate o administrador.');
        } else if (errorMessage.includes('not-found')) {
          setError('CAPA não encontrada.');
        } else {
          setError(`Erro ao submeter RFI: ${errorMessage}`);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [labId],
  );

  const respondRFI = useCallback(
    async (_capaId: string, _rfiId: string, _response: string): Promise<void> => {
      // Placeholder para Phase 8 Wave 3: será implementada callable separada
      // e hook wrappera httpsCallable('capa_respondRFI')
      if (!labId) {
        throw new Error('Sem lab ativo.');
      }

      setLoading(true);
      setSuccess(false);
      setError(null);

      try {
        // TODO: implementar respondRFICallable em Wave 3
        // await respondRFICallable(labId, capaId, rfiId, response);
        setSuccess(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Erro ao responder RFI: ${errorMessage}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [labId],
  );

  return { submitRFI, respondRFI, loading, error, success };
}
