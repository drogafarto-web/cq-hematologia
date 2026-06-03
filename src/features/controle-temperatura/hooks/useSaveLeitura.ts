import { useCallback, useState } from 'react';

import { functions, httpsCallable } from '../../../shared/services/firebase';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import type { EquipamentoMonitorado, LeituraInput } from '../types/ControlTemperatura';

export interface UseSaveLeituraResult {
  save: (
    input: Omit<LeituraInput, 'assinatura'>,
    equipamento: EquipamentoMonitorado,
    options?: { leituraPrevistaId?: string; observacaoNC?: string },
  ) => Promise<{ leituraId: string; ncId: string | null }>;
  isSaving: boolean;
  error: Error | null;
}

// Payload wire do callable `ct_commitLeitura` — Timestamps viram millis no transporte.
interface CommitLeituraWireInput {
  labId: string;
  equipamentoId: string;
  dataHoraMillis: number;
  turno: LeituraInput['turno'];
  temperaturaAtual: number;
  umidade?: number;
  temperaturaMax: number;
  temperaturaMin: number;
  status: LeituraInput['status'];
  justificativaPerdida?: string;
  observacao?: string;
  leituraPrevistaId?: string;
}

interface CommitLeituraResult {
  ok: true;
  leituraId: string;
  ncId: string | null;
  foraDosLimites: boolean;
  violado: 'max' | 'min' | 'umidade' | null;
}

const callCommitLeitura = httpsCallable<CommitLeituraWireInput, CommitLeituraResult>(
  functions,
  'ct_commitLeitura',
);

/**
 * Orquestra RN-01 + RN-02 via callable sign-and-write (pós-CT-01).
 *
 * Mudança vs client-side original:
 *   - Assinatura gerada 100% no server (Admin SDK, Timestamp.now() confiável)
 *   - Limites re-lidos no server; UI não pode falsear `foraDosLimites`
 *   - NC automática criada no mesmo batch no server
 *   - Client só prepara payload + exibe resultado
 *
 * `equipamento` ainda é recebido para UX (mostrar limites no form antes do
 * submit) — mas o commit autoritativo re-lê os limites server-side.
 *
 * Leituras IoT continuam via HTTP `registrarLeituraIoT` (não passam aqui).
 */
export function useSaveLeitura(): UseSaveLeituraResult {
  const labId = useActiveLabId();
  const user = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(
    async (
      input: Omit<LeituraInput, 'assinatura'>,
      _equipamento: EquipamentoMonitorado,
      options?: { leituraPrevistaId?: string; observacaoNC?: string },
    ): Promise<{ leituraId: string; ncId: string | null }> => {
      if (!labId) throw new Error('Sem lab ativo.');
      if (!user?.uid) throw new Error('Usuário não autenticado.');
      if (input.origem !== 'manual') {
        // Safety net: leituras IoT jamais devem cair nesse hook.
        throw new Error('useSaveLeitura só deve ser usado para leituras manuais.');
      }

      setIsSaving(true);
      setError(null);
      try {
        const payload: CommitLeituraWireInput = {
          labId,
          equipamentoId: input.equipamentoId,
          dataHoraMillis: input.dataHora.toMillis(),
          turno: input.turno,
          temperaturaAtual: input.temperaturaAtual,
          umidade: input.umidade,
          temperaturaMax: input.temperaturaMax,
          temperaturaMin: input.temperaturaMin,
          status: input.status,
          justificativaPerdida: input.justificativaPerdida,
          observacao: input.observacao ?? options?.observacaoNC,
          leituraPrevistaId: options?.leituraPrevistaId,
        };

        const resp = await callCommitLeitura(payload);
        return {
          leituraId: resp.data.leituraId,
          ncId: resp.data.ncId,
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [labId, user?.uid],
  );

  return { save, isSaving, error };
}
