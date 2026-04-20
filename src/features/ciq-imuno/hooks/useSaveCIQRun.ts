import { useState, useCallback } from 'react';
import { useUser, useActiveLabId } from '../../../store/useAuthStore';
import {
  findCIQLot,
  createCIQLot,
  updateCIQLot,
  saveCIQRun,
  getCIQRuns,
  uploadStripImage,
  writeCIQAuditRecord,
  generateRunCode,
} from '../services/ciqFirebaseService';
import { useCIQSignature } from './useCIQSignature';
import { computeWestgardCategorico } from './useCIQWestgard';
import type { CIQImunoFormData } from '../components/CIQImunoForm.schema';
import type { CIQImunoRun } from '../types/CIQImuno';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveCIQRunOptions {
  /**
   * Arquivo de imagem do strip (opcional — se fornecido, é enviado para o Storage
   * em background após o save do documento).
   */
  stripImage?: File;
}

export interface SaveCIQRunResult {
  runId: string;
  lotId: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useSaveCIQRun — orquestra o ciclo completo de registro de uma corrida CIQ-Imuno.
 *
 * Sequência:
 *  1. Encontra ou cria o lote (testType + loteControle)
 *  2. Busca corridas existentes do lote para Westgard
 *  3. Calcula alertas Westgard categóricos
 *  4. Gera assinatura SHA-256 (Web Crypto)
 *  5. Persiste o run no Firestore
 *  6. Atualiza runCount + lotStatus no lote
 *  7. Grava registro de auditoria imutável
 *  8. Upload da imagem do strip em background (não bloqueia o retorno)
 */
export function useSaveCIQRun() {
  const labId = useActiveLabId();
  const user = useUser();
  const { sign } = useCIQSignature();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useCallback(
    async (
      formData: CIQImunoFormData,
      options: SaveCIQRunOptions = {},
    ): Promise<SaveCIQRunResult> => {
      if (!labId) throw new Error('Nenhum laboratório ativo.');
      if (!user) throw new Error('Usuário não autenticado.');

      setIsSaving(true);
      setSaveError(null);

      try {
        // ── 1. Encontra ou cria o lote ─────────────────────────────────────
        let lotId = (await findCIQLot(labId, formData.testType, formData.loteControle))?.id ?? null;

        if (!lotId) {
          lotId = await createCIQLot(labId, {
            labId,
            testType: formData.testType,
            loteControle: formData.loteControle,
            aberturaControle: formData.aberturaControle,
            validadeControle: formData.validadeControle,
            runCount: 0,
            lotStatus: 'sem_dados',
            createdBy: user.uid,
          });
        }

        // ── 2. Busca runs existentes (para Westgard) ───────────────────────
        const existingRuns = await getCIQRuns(labId, lotId);

        // ── 3. Westgard categórico ─────────────────────────────────────────
        // Inclui o run atual na simulação para refletir o estado pós-save.
        const simulatedRun: CIQImunoRun = buildRun(
          crypto.randomUUID(), // placeholder — será sobrescrito abaixo
          'CI-TEMP', // runCode provisório — não persistido
          labId,
          lotId,
          user.uid,
          user.displayName ?? user.email ?? 'Operador',
          formData,
          [], // westgardCategorico provisório
          '', // logicalSignature provisória
        );

        const allRuns = [...existingRuns, simulatedRun];
        const { alerts, lotStatus } = computeWestgardCategorico(allRuns);

        // ── 4. Código sequencial + Assinatura SHA-256 ─────────────────────
        const [runCode, runId] = await Promise.all([
          generateRunCode(labId),
          Promise.resolve(crypto.randomUUID()),
        ]);
        const { logicalSignature, signedBy, signedAt } = await sign({
          operatorDocument: user.email ?? user.uid,
          lotId,
          testType: formData.testType,
          loteControle: formData.loteControle,
          resultadoObtido: formData.resultadoObtido,
          dataRealizacao: formData.dataRealizacao,
        });

        // ── 5. Monta e persiste o run ──────────────────────────────────────
        const run = buildRun(
          runId,
          runCode,
          labId,
          lotId,
          user.uid,
          user.displayName ?? user.email ?? 'Operador',
          formData,
          alerts,
          logicalSignature,
        );

        await saveCIQRun(labId, lotId, run);

        // ── 6. Atualiza lote ───────────────────────────────────────────────
        await updateCIQLot(labId, lotId, {
          runCount: existingRuns.length + 1,
          lotStatus,
        });

        // ── 7. Auditoria imutável ──────────────────────────────────────────
        void writeCIQAuditRecord(labId, lotId, runId, {
          runId,
          lotId,
          logicalSignature,
          signedBy,
          signedAt,
          testType: formData.testType,
          resultadoObtido: formData.resultadoObtido,
          dataRealizacao: formData.dataRealizacao,
          westgardAlerts: alerts,
          lotStatus,
        });

        // ── 8. Upload strip em background ──────────────────────────────────
        if (options.stripImage) {
          const imageFile = options.stripImage;
          void (async () => {
            try {
              await uploadStripImage(labId, lotId, runId, imageFile);
              // imageUrl será atualizada via listener real-time — sem update explícito
            } catch (err) {
              console.error('[useSaveCIQRun] Strip upload failed (non-fatal):', err);
            }
          })();
        }

        return { runId, lotId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar corrida.';
        setSaveError(msg);
        throw new Error(msg, { cause: err });
      } finally {
        setIsSaving(false);
      }
    },
    [labId, user, sign],
  );

  return {
    save,
    isSaving,
    error: saveError,
    clearError: () => setSaveError(null),
  } as const;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

function buildRun(
  runId: string,
  runCode: string,
  labId: string,
  lotId: string,
  createdBy: string,
  operatorName: string,
  form: CIQImunoFormData,
  westgardAlertas: CIQImunoRun['westgardCategorico'],
  logicalSignature: string,
): CIQImunoRun {
  const resultouConforme = form.resultadoObtido === form.resultadoEsperado;
  const status = resultouConforme ? 'Aprovada' : ('Rejeitada' as const);

  return {
    id: runId,
    runCode,
    labId,
    lotId,
    // Rastreabilidade RDC 978
    operatorId: createdBy,
    operatorName,
    operatorRole: form.cargo,
    // Campos herdados de CQRun
    isEdited: false,
    status,
    version: 1,
    logicalSignature,
    createdBy,
    imageUrl: '',
    // serverTimestamp injetados pelo service
    confirmedAt: null as unknown as import('firebase/firestore').Timestamp,
    createdAt: null as unknown as import('firebase/firestore').Timestamp,
    // Controle
    testType: form.testType,
    loteControle: form.loteControle,
    fabricanteControle: form.fabricanteControle,
    aberturaControle: form.aberturaControle,
    validadeControle: form.validadeControle,
    // Reagente
    loteReagente: form.loteReagente,
    fabricanteReagente: form.fabricanteReagente,
    reagenteStatus: form.reagenteStatus,
    aberturaReagente: form.aberturaReagente,
    validadeReagente: form.validadeReagente,
    ...(form.codigoKit && { codigoKit: form.codigoKit }),
    ...(form.registroANVISA && { registroANVISA: form.registroANVISA }),
    // Resultado
    resultadoEsperado: form.resultadoEsperado,
    resultadoObtido: form.resultadoObtido,
    dataRealizacao: form.dataRealizacao,
    ...(form.acaoCorretiva && { acaoCorretiva: form.acaoCorretiva }),
    // Equipamento
    ...(form.equipamento && { equipamento: form.equipamento }),
    ...(form.temperaturaAmbiente !== undefined && {
      temperaturaAmbiente: form.temperaturaAmbiente,
    }),
    // Qualidade
    westgardCategorico: westgardAlertas,
  };
}
