import { useState, useCallback } from 'react';
import { useActiveLab } from '../../../store/useAuthStore';
import { useCoagSignature } from '../../coagulacao/hooks/useCoagSignature';
import { computeCoagWestgard } from '../../coagulacao/hooks/useCoagWestgard';
import { saveAttempt } from '../services/attemptService';
import { buildAttemptSignaturePayload } from '../hooks/internal/buildSignaturePayload';
import type { AttemptInput, Attempt } from '../types/Attempt';
import type { ControlOperacional } from '../types/ControlOperacional';
import type { InsumoSnapshot, InsumosSnapshotSet } from '../../insumos/types/InsumoSnapshot';
import type { EquipamentoSnapshot } from '../../equipamentos/types/Equipamento';

interface UseAttemptSaveResult {
  save: (data: AttemptInput) => Promise<Attempt>;
  isSaving: boolean;
  error: string | null;
}

export function useAttemptSave(labId: string): UseAttemptSaveResult {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signPayload } = useCoagSignature();

  const save = useCallback(
    async (data: AttemptInput): Promise<Attempt> => {
      setIsSaving(true);
      setError(null);

      try {
        // 1 — Ler ControlOperacional (validação)
        const controle = await getControlOperacional(labId, data.controlOperacionalId);
        if (!controle || controle.status !== 'ativo') {
          throw new Error('Controle operacional não encontrado ou inativo');
        }

        // 2 — Validar input
        if (!data.resultados || Object.keys(data.resultados).length === 0) {
          throw new Error('Pelo menos um resultado deve ser informado');
        }
        for (const v of Object.values(data.resultados)) {
          if (typeof v !== 'number' || v <= 0) throw new Error('Resultados devem ser números positivos');
        }

        // 3 — Obter tentativas históricas para Westgard
        const { listAttempts } = await import('../services/attemptService');
        const historico = await listAttempts(labId, {
          controlOperacionalId: data.controlOperacionalId,
          limit: 10,
        });

        // 4 — Simular tentativa atual para Westgard
        const simulatedRun = {
          id: '__simulated__',
          resultados: data.resultados,
          dataRealizacao: new Date().toISOString().split('T')[0],
        };

        // 5 — Rodar Westgard
        const westgardResult = computeCoagWestgard(
          [...historico, simulatedRun] as any,
          controle.nivel,
          controle.validadeControle,
          controle.mean,
          controle.sd,
        );

        const currentViolations = westgardResult.byRun.get('__simulated__');
        const conformidade = currentViolations?.conformidade ?? 'A';
        const violacoes = currentViolations?.allViolations ?? [];
        const analitosComViolacao = currentViolations?.analitosComViolacao ?? [];

        // 6 — Validar ação corretiva para tentativas não conformes
        if (conformidade === 'R' && !data.acaoCorretiva) {
          throw new Error('Ação corretiva é obrigatória para resultados não conformes');
        }

        // 7 — Build snapshots
        const { buildInsumoSnapshot } = await import('../../insumos/types/InsumoSnapshot');
        const { buildEquipamentoSnapshot } = await import('../../equipamentos/types/Equipamento');

        const insumoSnapshot = buildInsumoSnapshot({} as any);
        const equipamentoSnapshot = buildEquipamentoSnapshot({} as any);

        const snapshot = {
          controle: insumoSnapshot,
          reagente: insumoSnapshot,
          reagenteTtpa: null,
          equipamento: equipamentoSnapshot,
        };

        // 8 — Build logicalSignature
        const payload = buildAttemptSignaturePayload(
          '',
          data.controlOperacionalId,
          data.resultados,
          new Date().toISOString().split('T')[0],
        );
        const logicalSignature = await signPayload(payload);

        // 9 — Persistir
        const attempt = await saveAttempt(
          labId,
          '',
          '',
          {
            ...data,
            conformidade,
            violacoes,
            analitosComViolacao,
            snapshot,
            overrides: { insumoVencido: false, qcNaoValidado: false, motivo: null },
            logicalSignature,
          },
        );

        setIsSaving(false);
        return attempt;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar tentativa';
        setError(message);
        setIsSaving(false);
        throw err;
      }
    },
    [labId],
  );

  return { save, isSaving, error };
}

async function getControlOperacional(
  labId: string,
  id: string,
): Promise<ControlOperacional | null> {
  const { getControlOperacional: get } = await import('../services/controlOperacionalService');
  return get(labId, id);
}
