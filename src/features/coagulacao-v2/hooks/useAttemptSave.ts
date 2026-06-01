import { useState, useCallback } from 'react';
import { useActiveLab } from '../../../store/useAuthStore';
import { useCoagSignature, canonicalizeCoagResultados } from '../../coagulacao/hooks/useCoagSignature';
import type { CoagSignaturePayload } from '../../coagulacao/hooks/useCoagSignature';
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
  const { sign } = useCoagSignature();

  const save = useCallback(
    async (data: AttemptInput): Promise<Attempt> => {
      setIsSaving(true);
      setError(null);

      try {
        const controle = await getControlOperacional(labId, data.controlOperacionalId);
        if (!controle || controle.status !== 'ativo') {
          throw new Error('Controle operacional não encontrado ou inativo');
        }

        if (!data.resultados || Object.keys(data.resultados).length === 0) {
          throw new Error('Pelo menos um resultado deve ser informado');
        }
        for (const v of Object.values(data.resultados)) {
          if (typeof v !== 'number' || v <= 0) throw new Error('Resultados devem ser números positivos');
        }

        const { listAttempts } = await import('../services/attemptService');
        const historico = await listAttempts(labId, {
          controlOperacionalId: data.controlOperacionalId,
          limit: 10,
        });

        const simulatedRun = {
          id: '__simulated__',
          resultados: data.resultados,
          dataRealizacao: new Date().toISOString().split('T')[0],
        };

        const westgardResult = computeCoagWestgard(
          [...historico, simulatedRun] as any,
          controle.nivel,
          controle.validadeControle,
        );

        const currentViolations = westgardResult.byRun.get('__simulated__');
        const conformidade = currentViolations?.conformidade ?? 'A';
        const violacoes = currentViolations?.allViolations ?? [];
        const analitosComViolacao = currentViolations?.analitosComViolacao ?? [];

        if (conformidade === 'R' && !data.acaoCorretiva) {
          throw new Error('Ação corretiva é obrigatória para resultados não conformes');
        }

        const { getInsumoOnce } = await import('../../insumos/services/insumosFirebaseService');
        const { getEquipamentoOnce } = await import('../../equipamentos/services/equipamentoService');

        const insumoTP = controle.insumoId ? await getInsumoOnce(labId, controle.insumoId) : null;
        const insumoTTPA = controle.reagenteTTPAId ? await getInsumoOnce(labId, controle.reagenteTTPAId) : null;
        const equipamento = controle.equipamentoId ? await getEquipamentoOnce(labId, controle.equipamentoId) : null;

        const { buildInsumoSnapshot } = await import('../../insumos/types/InsumoSnapshot');
        const { buildEquipamentoSnapshot } = await import('../../equipamentos/types/Equipamento');

        const snapshot = {
          controle: insumoTP ? buildInsumoSnapshot(insumoTP) : buildInsumoSnapshot({} as any),
          reagente: insumoTP ? buildInsumoSnapshot(insumoTP) : buildInsumoSnapshot({} as any),
          reagenteTtpa: insumoTTPA ? buildInsumoSnapshot(insumoTTPA) : null,
          equipamento: equipamento ? buildEquipamentoSnapshot(equipamento) : buildEquipamentoSnapshot({} as any),
        };

        const signPayload: CoagSignaturePayload = {
          operatorDocument: '',
          lotId: data.controlOperacionalId,
          nivel: controle.nivel,
          loteControle: controle.loteControle,
          resultadosCanonical: canonicalizeCoagResultados(data.resultados),
          dataRealizacao: new Date().toISOString().split('T')[0],
        };
        const signed = await sign(signPayload);

        const attempt = await saveAttempt(
          labId,
          '',
          signed.signedBy,
          {
            ...data,
            conformidade,
            violacoes,
            analitosComViolacao,
            snapshot,
            overrides: { insumoVencido: false, qcNaoValidado: false, motivo: null },
            logicalSignature: signed.logicalSignature,
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
