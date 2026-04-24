import { useCallback, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  atualizarUrlCertificadoAtual,
  registrarNovaCalibracao,
} from '../services/ctFirebaseService';
import type { CertificadoCalibracaoInput } from '../types/ControlTemperatura';

export interface UseSaveCalibracaoResult {
  registrar: (termometroId: string, input: CertificadoCalibracaoInput) => Promise<number>;
  atualizarUrl: (termometroId: string, url: string) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

/**
 * RN-09: orquestra renovação encadeada da calibração.
 *  - `registrar`: cria nova versão + arquiva anterior em transaction atômica.
 *    Retorna a nova versão (int).
 *  - `atualizarUrl`: patch do `certificadoUrl` pós-upload de PDF
 *    (Storage upload é separado — ver CertificadoCalibracaoModal).
 *
 * Histórico nunca é deletado — ISO 15189:2022 cl. 5.3.1 exige rastreabilidade
 * metrológica integral.
 */
export function useSaveCalibracao(): UseSaveCalibracaoResult {
  const labId = useActiveLabId();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const registrar = useCallback(
    async (termometroId: string, input: CertificadoCalibracaoInput): Promise<number> => {
      if (!labId) throw new Error('Sem lab ativo.');
      setIsSaving(true);
      setError(null);
      try {
        return await registrarNovaCalibracao(labId, termometroId, input);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [labId],
  );

  const atualizarUrl = useCallback(
    async (termometroId: string, url: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      await atualizarUrlCertificadoAtual(labId, termometroId, url);
    },
    [labId],
  );

  return { registrar, atualizarUrl, isSaving, error };
}
