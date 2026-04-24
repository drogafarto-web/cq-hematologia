import { useCallback, useState } from 'react';

import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { createLeituraComNC } from '../services/ctFirebaseService';
import { generateCtSignature } from '../services/ctSignatureService';
import type {
  EquipamentoMonitorado,
  LeituraInput,
} from '../types/ControlTemperatura';

export interface UseSaveLeituraResult {
  save: (
    input: Omit<LeituraInput, 'assinatura'>,
    equipamento: EquipamentoMonitorado,
    options?: { leituraPrevistaId?: string; observacaoNC?: string },
  ) => Promise<{ leituraId: string; ncId: string | null }>;
  isSaving: boolean;
  error: Error | null;
}

/**
 * Orquestra RN-01 + RN-02 no cliente:
 *
 *   RN-01 — serviço deriva `foraDosLimites` e cria NC em batch.
 *   RN-02 — se `origem === 'manual'`, exige operador autenticado e
 *           gera `LogicalSignature` sobre (equipamentoId, dataHora,
 *           temperaturaAtual, temperaturaMax, temperaturaMin, umidade?).
 *
 * Assinatura AUTOMÁTICA (IoT) é escrita pela Cloud Function com o
 * operatorId = "iot:{dispositivoId}" — não passa por este hook.
 */
export function useSaveLeitura(): UseSaveLeituraResult {
  const labId = useActiveLabId();
  const user = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(
    async (
      input: Omit<LeituraInput, 'assinatura'>,
      equipamento: EquipamentoMonitorado,
      options?: { leituraPrevistaId?: string; observacaoNC?: string },
    ): Promise<{ leituraId: string; ncId: string | null }> => {
      if (!labId) throw new Error('Sem lab ativo.');
      if (!user?.uid) throw new Error('Usuário não autenticado.');

      setIsSaving(true);
      setError(null);
      try {
        let assinatura: LeituraInput['assinatura'];
        if (input.origem === 'manual') {
          assinatura = await generateCtSignature(user.uid, {
            equipamentoId: input.equipamentoId,
            dataHora: input.dataHora.toMillis(),
            temperaturaAtual: input.temperaturaAtual,
            temperaturaMax: input.temperaturaMax,
            temperaturaMin: input.temperaturaMin,
            umidade: input.umidade ?? -1,
          });
        }

        const ncAssinatura =
          assinatura ??
          (await generateCtSignature(user.uid, {
            equipamentoId: input.equipamentoId,
            autoNC: 1,
            ts: Date.now(),
          }));

        const result = await createLeituraComNC(
          labId,
          { ...input, assinatura },
          equipamento.limites,
          {
            assinatura: ncAssinatura,
            responsavelAcao: user.displayName ?? user.email ?? user.uid,
            descricao: options?.observacaoNC,
          },
          options?.leituraPrevistaId,
        );
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [labId, user?.uid, user?.displayName, user?.email],
  );

  return { save, isSaving, error };
}
