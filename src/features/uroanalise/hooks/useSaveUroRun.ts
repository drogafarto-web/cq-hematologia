import { useState, useCallback } from 'react';
import { useUser, useActiveLabId } from '../../../store/useAuthStore';
import {
  findUroLot,
  createUroLot,
  updateUroLot,
  saveUroRun,
  getUroRuns,
  writeUroAuditRecord,
  generateUroRunCode,
  uploadUroTiraImage,
} from '../services/uroanaliseFirebaseService';
import { useUroSignature, canonicalizeUroResultados } from './useUroSignature';
import { computeUroValidator } from './useUroValidator';
import type { UroanaliseRun } from '../types/Uroanalise';
import type { UroAnalitoId, UroAlert } from '../types/_shared_refs';
import type { UroanaliseFormData } from '../components/UroanaliseForm.schema';

export type { UroanaliseFormData };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveUroRunOptions {
  /**
   * Arquivo de imagem da tira reagente (opcional).
   * Quando fornecido, é enviado para o Storage em background após o save do documento.
   * Usado pelo OCR em v2.
   */
  stripImage?: File;

  /**
   * Fase B1-etapa2 — snapshot imutável dos insumos ativos + flags de override.
   * Ver `InsumosSnapshotSet` em features/insumos/types/InsumoSnapshot.
   */
  insumosSnapshot?: import('../../insumos/types/InsumoSnapshot').InsumosSnapshotSet;
  insumoVencidoOverride?: boolean;
  qcNaoValidado?: boolean;
  overrideMotivo?: string;

  /**
   * Fase D (2026-04-21 — 2º turno): equipamento da corrida + snapshot imutável.
   */
  equipamentoId?: string;
  equipamentoSnapshot?: import('../../equipamentos/types/Equipamento').EquipamentoSnapshot;
}

export interface SaveUroRunResult {
  runId: string;
  lotId: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useSaveUroRun — orquestra o ciclo completo de registro de uma corrida CIQ-Uroanálise.
 *
 * Sequência:
 *  1. Encontra ou cria o lote (nivel + loteControle)
 *  2. Busca corridas existentes do lote para validação
 *  3. Monta run simulado e calcula conformidade (computeUroValidator)
 *  4. Gera código sequencial (UR-YYYY-NNNN) e UUID
 *  5. Gera assinatura SHA-256 (Web Crypto)
 *  6. Persiste o run no Firestore
 *  7. Atualiza runCount + lotStatus no lote
 *  8. Grava registro de auditoria imutável (void — não bloqueia)
 *  9. Upload da foto da tira em background (condicional a options.stripImage)
 */
export function useSaveUroRun() {
  const labId = useActiveLabId();
  const user = useUser();
  const { sign } = useUroSignature();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useCallback(
    async (
      formData: UroanaliseFormData,
      options: SaveUroRunOptions = {},
    ): Promise<SaveUroRunResult> => {
      if (!labId) throw new Error('Nenhum laboratório ativo.');
      if (!user) throw new Error('Usuário não autenticado.');

      setIsSaving(true);
      setSaveError(null);

      try {
        // ── 1. Encontra ou cria o lote ─────────────────────────────────────
        let lotId = (await findUroLot(labId, formData.nivel, formData.loteControle))?.id ?? null;

        if (!lotId) {
          lotId = await createUroLot(labId, {
            labId,
            nivel: formData.nivel,
            loteControle: formData.loteControle,
            fabricanteControle: formData.fabricanteControle,
            aberturaControle: formData.aberturaControle,
            validadeControle: formData.validadeControle,
            resultadosEsperados: formData.resultadosEsperadosRun,
            runCount: 0,
            lotStatus: 'sem_dados',
            createdBy: user.uid,
          });
        }

        // ── 2. Busca runs existentes (para validação) ──────────────────────
        const existingRuns = await getUroRuns(labId, lotId);

        // ── 3. Validação ordinal categórica ────────────────────────────────
        // Inclui o run atual na simulação para refletir o estado pós-save.
        const simulatedId = crypto.randomUUID();
        const simulatedRun = buildRun(
          simulatedId,
          'UR-TEMP', // runCode provisório — não persistido
          labId,
          lotId,
          user.uid,
          formData,
          [], // analitosNaoConformes provisório
          [], // alertas provisório
          'A', // conformidade provisória
          '', // logicalSignature provisória
        );

        const allRuns = [...existingRuns, simulatedRun];
        const validatorResult = computeUroValidator(allRuns, formData.validadeControle);
        const simAvaliacao = validatorResult.byRun.get(simulatedId);
        const lotStatus = validatorResult.lotStatus;

        const analitosNaoConformes = simAvaliacao?.analitosNaoConformes ?? [];
        const alertas = validatorResult.alerts;
        const conformidade: 'A' | 'R' = simAvaliacao?.conformidade ?? 'A';

        // ── 4. Código sequencial + UUID ────────────────────────────────────
        const [runCode, runId] = await Promise.all([
          generateUroRunCode(labId),
          Promise.resolve(crypto.randomUUID()),
        ]);

        // ── 5. Assinatura SHA-256 ──────────────────────────────────────────
        const { logicalSignature, signedBy, signedAt } = await sign({
          operatorDocument: formData.operatorDocument,
          lotId,
          nivel: formData.nivel,
          loteControle: formData.loteControle,
          loteTira: formData.loteTira,
          resultadosCanonical: canonicalizeUroResultados(formData.resultados),
          dataRealizacao: formData.dataRealizacao,
        });

        // ── 6. Monta e persiste o run ──────────────────────────────────────
        const run = buildRun(
          runId,
          runCode,
          labId,
          lotId,
          user.uid,
          formData,
          analitosNaoConformes,
          alertas,
          conformidade,
          logicalSignature,
          options,
        );

        await saveUroRun(labId, lotId, run);

        // ── 7. Atualiza lote ───────────────────────────────────────────────
        await updateUroLot(labId, lotId, {
          runCount: existingRuns.length + 1,
          lotStatus,
        });

        // ── 8. Auditoria imutável (void — não bloqueia) ────────────────────
        void writeUroAuditRecord(labId, lotId, runId, {
          runId,
          lotId,
          logicalSignature,
          signedBy,
          signedAt,
          nivel: formData.nivel,
          loteControle: formData.loteControle,
          loteTira: formData.loteTira,
          analitosNaoConformes,
          alertas,
          conformidade,
          lotStatus,
          dataRealizacao: formData.dataRealizacao,
        });

        // ── 9. Upload da foto da tira em background ────────────────────────
        if (options.stripImage) {
          const imageFile = options.stripImage;
          const capturedLotId = lotId;
          void (async () => {
            try {
              await uploadUroTiraImage(labId, capturedLotId, runId, imageFile);
              // imageUrl será atualizada via listener real-time — sem update explícito
            } catch (err) {
              console.error('[useSaveUroRun] Strip upload failed (non-fatal):', err);
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

/**
 * Constrói um UroanaliseRun completo a partir dos dados do form e dos campos
 * calculados (conformidade, alertas, assinatura). Centraliza a lógica de montagem
 * para evitar duplicação entre o run simulado e o run final.
 */
function buildRun(
  runId: string,
  runCode: string,
  labId: string,
  lotId: string,
  createdBy: string,
  form: UroanaliseFormData,
  analitosNaoConformes: UroAnalitoId[],
  alertas: UroAlert[],
  conformidade: 'A' | 'R',
  logicalSignature: string,
  options: SaveUroRunOptions = {},
): UroanaliseRun {
  return {
    id: runId,
    runCode,
    labId,
    lotId,
    // Rastreabilidade RDC 978
    operatorId: createdBy,
    operatorName: form.operatorName ?? '',
    operatorRole: form.cargo,
    operatorDocument: form.operatorDocument,
    // Campos herdados de CQRun
    isEdited: false,
    status: conformidade === 'A' ? 'Aprovada' : ('Rejeitada' as const),
    version: 1,
    logicalSignature,
    createdBy,
    imageUrl: '',
    // serverTimestamp injetados pelo service
    confirmedAt: null as unknown as import('firebase/firestore').Timestamp,
    createdAt: null as unknown as import('firebase/firestore').Timestamp,
    // Identificação do nível e insumos
    nivel: form.nivel,
    frequencia: form.frequencia,
    loteTira: form.loteTira,
    loteControle: form.loteControle,
    fabricanteControle: form.fabricanteControle,
    aberturaControle: form.aberturaControle,
    validadeControle: form.validadeControle,
    // Tiras (opcional)
    ...(form.tiraMarca && { tiraMarca: form.tiraMarca }),
    ...(form.fabricanteTira && { fabricanteTira: form.fabricanteTira }),
    ...(form.validadeTira && { validadeTira: form.validadeTira }),
    // Ambiente (opcional)
    ...(form.temperaturaAmbiente !== undefined && {
      temperaturaAmbiente: form.temperaturaAmbiente,
    }),
    ...(form.umidadeAmbiente !== undefined && { umidadeAmbiente: form.umidadeAmbiente }),
    // Data e resultados
    dataRealizacao: form.dataRealizacao,
    resultadosEsperados: form.resultadosEsperadosRun,
    resultados: form.resultados,
    // Conformidade
    conformidade,
    analitosNaoConformes,
    ...(alertas.length > 0 && { alertas }),
    ...(form.acaoCorretiva && { acaoCorretiva: form.acaoCorretiva }),
    // Tecnovigilância (opcional)
    ...(form.notivisaTipo && { notivisaTipo: form.notivisaTipo }),
    ...(form.notivisaStatus && { notivisaStatus: form.notivisaStatus }),
    ...(form.notivisaProtocolo && { notivisaProtocolo: form.notivisaProtocolo }),
    ...(form.notivisaDataEnvio && { notivisaDataEnvio: form.notivisaDataEnvio }),
    ...(form.notivisaJustificativa && { notivisaJustificativa: form.notivisaJustificativa }),
    // Fase B1-etapa2 — rastreabilidade de insumos
    ...(options.insumosSnapshot && {
      insumosSnapshot: {
        ...(options.insumosSnapshot.tira && { tira: options.insumosSnapshot.tira }),
        ...(options.insumosSnapshot.controle && { controle: options.insumosSnapshot.controle }),
      },
    }),
    ...(options.insumoVencidoOverride && { insumoVencidoOverride: true }),
    ...(options.qcNaoValidado && { qcNaoValidado: true }),
    ...(options.overrideMotivo && { overrideMotivo: options.overrideMotivo }),
    // Fase D — rastreabilidade de equipamento
    ...(options.equipamentoId && { equipamentoId: options.equipamentoId }),
    ...(options.equipamentoSnapshot && { equipamentoSnapshot: options.equipamentoSnapshot }),
  };
}
