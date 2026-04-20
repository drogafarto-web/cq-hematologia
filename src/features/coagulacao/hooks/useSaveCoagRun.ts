import { useState, useCallback } from 'react';
import { useUser, useActiveLabId } from '../../../store/useAuthStore';
import {
  findCoagLot,
  createCoagLot,
  updateCoagLot,
  saveCoagRun,
  getCoagRuns,
  writeCoagAuditRecord,
  generateCoagRunCode,
} from '../services/coagulacaoFirebaseService';
import { useCoagSignature, canonicalizeCoagResultados } from './useCoagSignature';
import { computeCoagWestgard } from './useCoagWestgard';
import { COAG_ANALYTES } from '../CoagAnalyteConfig';
import type { CoagulacaoRun } from '../types/Coagulacao';
import type { CoagAnalyteId } from '../types/_shared_refs';
import type { CoagulacaoFormData } from '../components/CoagulacaoForm.schema';

export type { CoagulacaoFormData };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveCoagRunOptions {
  /**
   * Upload de imagem do printout do coagulômetro (MVP não utiliza).
   * Disponível para uso futuro — `uploadCoagRunImage` está no service.
   */
  printoutImage?: File;
}

export interface SaveCoagRunResult {
  runId: string;
  lotId: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useSaveCoagRun — orquestra o ciclo completo de registro de uma corrida CIQ-Coagulação.
 *
 * Sequência:
 *  1. Encontra ou cria o lote (nivel + loteControle)
 *  2. Busca corridas existentes do lote para Westgard
 *  3. Monta run simulado e calcula Westgard (computeCoagWestgard)
 *  4. Gera código sequencial (CG-YYYY-NNNN) e UUID
 *  5. Gera assinatura SHA-256 (Web Crypto)
 *  6. Persiste o run no Firestore
 *  7. Atualiza runCount + lotStatus no lote
 *  8. Grava registro de auditoria imutável (void — não bloqueia)
 *
 * Printout image (MVP): NÃO enviada neste save — uploadCoagRunImage disponível no service.
 */
export function useSaveCoagRun() {
  const labId    = useActiveLabId();
  const user     = useUser();
  const { sign } = useCoagSignature();

  const [isSaving,  setIsSaving]  = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useCallback(
    async (
      formData: CoagulacaoFormData,
      _options: SaveCoagRunOptions = {},
    ): Promise<SaveCoagRunResult> => {
      if (!labId) throw new Error('Nenhum laboratório ativo.');
      if (!user)  throw new Error('Usuário não autenticado.');

      setIsSaving(true);
      setSaveError(null);

      try {
        // ── 1. Encontra ou cria o lote ─────────────────────────────────────
        let lotId =
          (await findCoagLot(labId, formData.nivel, formData.loteControle))?.id ?? null;

        if (!lotId) {
          // Constrói os defaults de mean/sd a partir do COAG_ANALYTES se não vierem do form
          const defaultMean: Record<CoagAnalyteId, number> = {
            atividadeProtrombinica: COAG_ANALYTES.atividadeProtrombinica.levels[formData.nivel].mean,
            rni:  COAG_ANALYTES.rni.levels[formData.nivel].mean,
            ttpa: COAG_ANALYTES.ttpa.levels[formData.nivel].mean,
          };
          const defaultSd: Record<CoagAnalyteId, number> = {
            atividadeProtrombinica: COAG_ANALYTES.atividadeProtrombinica.levels[formData.nivel].sd,
            rni:  COAG_ANALYTES.rni.levels[formData.nivel].sd,
            ttpa: COAG_ANALYTES.ttpa.levels[formData.nivel].sd,
          };

          lotId = await createCoagLot(labId, {
            labId,
            nivel:              formData.nivel,
            loteControle:       formData.loteControle,
            fabricanteControle: formData.fabricanteControle,
            aberturaControle:   formData.aberturaControle,
            validadeControle:   formData.validadeControle,
            mean:               formData.mean ?? defaultMean,
            sd:                 formData.sd   ?? defaultSd,
            runCount:           0,
            lotStatus:          'sem_dados',
            createdBy:          user.uid,
          });
        }

        // ── 2. Busca runs existentes (para Westgard) ───────────────────────
        const existingRuns = await getCoagRuns(labId, lotId);

        // ── 3. Westgard quantitativo ───────────────────────────────────────
        // Inclui o run atual na simulação para refletir o estado pós-save.
        const simulatedId  = crypto.randomUUID();
        const simulatedRun = buildRun(
          simulatedId,
          'CG-TEMP',    // runCode provisório — não persistido
          labId,
          lotId,
          user.uid,
          formData,
          [],           // westgardViolations provisório
          [],           // analitosComViolacao provisório
          'A',          // conformidade provisória
          '',           // logicalSignature provisória
        );

        const allRuns         = [...existingRuns, simulatedRun];
        const westgardResult  = computeCoagWestgard(
          allRuns,
          formData.nivel,
          formData.validadeControle,
        );
        const simViolations   = westgardResult.byRun.get(simulatedId);
        const lotStatus       = westgardResult.lotStatus;

        const analitosComViolacao = simViolations?.analitosComViolacao ?? [];
        const westgardViolations  = simViolations?.allViolations ?? [];
        const conformidade: 'A' | 'R' = simViolations?.conformidade ?? 'A';

        // ── 4. Código sequencial + UUID ────────────────────────────────────
        const [runCode, runId] = await Promise.all([
          generateCoagRunCode(labId),
          Promise.resolve(crypto.randomUUID()),
        ]);

        // ── 5. Assinatura SHA-256 ──────────────────────────────────────────
        const { logicalSignature, signedBy, signedAt } = await sign({
          operatorDocument:    formData.operatorDocument,
          lotId,
          nivel:               formData.nivel,
          loteControle:        formData.loteControle,
          resultadosCanonical: canonicalizeCoagResultados(formData.resultados),
          dataRealizacao:      formData.dataRealizacao,
        });

        // ── 6. Monta e persiste o run ──────────────────────────────────────
        const run = buildRun(
          runId,
          runCode,
          labId,
          lotId,
          user.uid,
          formData,
          westgardViolations,
          analitosComViolacao,
          conformidade,
          logicalSignature,
        );

        await saveCoagRun(labId, lotId, run);

        // ── 7. Atualiza lote ───────────────────────────────────────────────
        await updateCoagLot(labId, lotId, {
          runCount:  existingRuns.length + 1,
          lotStatus,
        });

        // ── 8. Auditoria imutável (void — não bloqueia) ────────────────────
        void writeCoagAuditRecord(labId, lotId, runId, {
          runId,
          lotId,
          logicalSignature,
          signedBy,
          signedAt,
          nivel:              formData.nivel,
          loteControle:       formData.loteControle,
          resultados:         formData.resultados,
          analitosComViolacao,
          westgardViolations,
          conformidade,
          lotStatus,
          dataRealizacao:     formData.dataRealizacao,
        });

        return { runId, lotId };

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar corrida.';
        setSaveError(msg);
        throw new Error(msg);
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
 * Constrói um CoagulacaoRun completo a partir dos dados do form e dos campos
 * calculados (Westgard, assinatura). Centraliza a lógica de montagem para
 * evitar duplicação entre o run simulado e o run final.
 */
function buildRun(
  runId:               string,
  runCode:             string,
  labId:               string,
  lotId:               string,
  createdBy:           string,
  form:                CoagulacaoFormData,
  westgardViolations:  CoagulacaoRun['westgardViolations'],
  analitosComViolacao: CoagulacaoRun['analitosComViolacao'],
  conformidade:        'A' | 'R',
  logicalSignature:    string,
): CoagulacaoRun {
  return {
    id:               runId,
    runCode,
    labId,
    lotId,
    // Rastreabilidade RDC 978
    operatorId:       createdBy,
    operatorName:     form.operatorName ?? '',
    operatorRole:     form.cargo,
    operatorDocument: form.operatorDocument,
    // Campos herdados de CQRun
    isEdited:         false,
    status:           conformidade === 'A' ? 'Aprovada' : ('Rejeitada' as const),
    version:          1,
    logicalSignature,
    createdBy,
    imageUrl:         '',
    // serverTimestamp injetados pelo service
    confirmedAt: null as unknown as import('firebase/firestore').Timestamp,
    createdAt:   null as unknown as import('firebase/firestore').Timestamp,
    // Identificação do controle
    nivel:              form.nivel,
    frequencia:         form.frequencia,
    equipamento:        form.equipamento,
    loteControle:       form.loteControle,
    fabricanteControle: form.fabricanteControle,
    aberturaControle:   form.aberturaControle,
    validadeControle:   form.validadeControle,
    // Reagente
    loteReagente:       form.loteReagente,
    fabricanteReagente: form.fabricanteReagente,
    aberturaReagente:   form.aberturaReagente,
    validadeReagente:   form.validadeReagente,
    // Calibração INR (opcional)
    ...(form.isi  !== undefined && { isi:  form.isi }),
    ...(form.mnpt !== undefined && { mnpt: form.mnpt }),
    // Ambiente (opcional)
    ...(form.temperaturaAmbiente !== undefined && { temperaturaAmbiente: form.temperaturaAmbiente }),
    ...(form.umidadeAmbiente     !== undefined && { umidadeAmbiente:     form.umidadeAmbiente }),
    // Data e resultados
    dataRealizacao: form.dataRealizacao,
    resultados:     form.resultados,
    // Conformidade
    conformidade,
    analitosComViolacao,
    ...(westgardViolations && westgardViolations.length > 0 && { westgardViolations }),
    ...(form.acaoCorretiva && { acaoCorretiva: form.acaoCorretiva }),
    // Tecnovigilância (opcional)
    ...(form.notivisaTipo          && { notivisaTipo:          form.notivisaTipo }),
    ...(form.notivisaStatus        && { notivisaStatus:        form.notivisaStatus }),
    ...(form.notivisaProtocolo     && { notivisaProtocolo:     form.notivisaProtocolo }),
    ...(form.notivisaDataEnvio     && { notivisaDataEnvio:     form.notivisaDataEnvio }),
    ...(form.notivisaJustificativa && { notivisaJustificativa: form.notivisaJustificativa }),
  };
}
