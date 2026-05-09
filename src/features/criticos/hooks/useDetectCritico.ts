import { useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { detectAllCriticos } from '../utils/criticoDetector';
import type { Laudo, CriticoResult } from '../types/threshold';

/**
 * useDetectCritico — Detect critical values and trigger escalation
 */
export function useDetectCritico(labId: string) {
  const escalacaoCriticos = httpsCallable(functions, 'escalacaoCriticos');

  const detectAndEscalate = useCallback(
    async (laudo: Laudo): Promise<{ detected: boolean; escalacaoId?: string }> => {
      try {
        // Run detection logic
        const criticoResults = detectAllCriticos(laudo, labId);

        if (criticoResults.length === 0) {
          return { detected: false };
        }

        // Found critical values — trigger escalation
        const response = await escalacaoCriticos({
          laudoId: laudo.id,
          labId,
          criticalResults: criticoResults,
          patientPhone: laudo.paciente?.telefone,
          physicianEmail: laudo.medicoSolicitante?.email || 'default@lab.com',
          operadorId: laudo.criadoPor,
        }) as { escalacaoId: string };

        return {
          detected: true,
          escalacaoId: response.escalacaoId,
        };
      } catch (err) {
        console.error('Error detecting critical values', err);
        throw err;
      }
    },
    [labId, escalacaoCriticos]
  );

  return { detectAndEscalate };
}
