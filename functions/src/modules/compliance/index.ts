/**
 * compliance — trigger onCreate em runs que revalida insumos server-side.
 *
 * Motivação: o cliente pode burlar a validação (bug, cache stale, bypass
 * malicioso via console). Este trigger é defesa em profundidade — se uma run
 * entrar com reagente vencido/reprovado/inativo SEM `complianceOverride`
 * explícito, o trigger:
 *   1. Marca a run com `complianceViolation` (UI pode mostrar alerta)
 *   2. Grava `auditLogs` global com detalhes
 *
 * Se a run entrar COM `complianceOverride` (operador justificou conscientemente
 * no ReviewRunModal), o trigger apenas confirma no audit — não sobrescreve.
 *
 * Regulatório: RDC 978/2025 Art.128, RDC 786/2023 art. 42, CLSI EP26-A.
 * Admin SDK ignora rules; writes aqui são confiáveis.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Kinds alinhados com `src/features/insumos/utils/insumoValidation.ts` — se
// algum for renomeado lá, atualizar aqui. Mantidos sincronizados manualmente
// porque Functions compila independente do frontend.
type ViolationKind = 'vencido' | 'nao_ativo' | 'lote_reprovado' | 'nao_encontrado';

interface Violation {
  kind: ViolationKind;
  insumoId: string;
  insumoNome: string;
  insumoLote: string;
  message: string;
}

/**
 * Trigger onCreate de runs hematológicas. Paralelo ao `onHematologiaRunAudit`
 * do módulo ciqAudit mas com foco em compliance (reagentes), não audit geral.
 */
export const onHematologiaRunComplianceCheck = onDocumentCreated(
  'labs/{labId}/lots/{lotId}/runs/{runId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const run = snap.data() as Record<string, unknown>;
    const { labId, lotId, runId } = event.params;
    const db = admin.firestore();

    const hasOverride = run['complianceOverride'] !== undefined && run['complianceOverride'] !== null;
    const reagentesIds = Array.isArray(run['reagentesInsumoIds'])
      ? (run['reagentesInsumoIds'] as string[])
      : [];

    // Sem reagentes declarados não revalidamos — o mínimo estrutural (se
    // aplicável) já é tratado pelo cliente + complianceOverride registra o
    // bypass. Evita incêndio de falsos positivos em runs legadas.
    if (reagentesIds.length === 0) return;

    const now = new Date();
    const violations: Violation[] = [];

    await Promise.all(
      reagentesIds.map(async (id) => {
        try {
          const insumoSnap = await db.doc(`labs/${labId}/insumos/${id}`).get();
          if (!insumoSnap.exists) {
            violations.push({
              kind: 'nao_encontrado',
              insumoId: id,
              insumoNome: '(insumo não encontrado)',
              insumoLote: '—',
              message: `Insumo ${id} referenciado na run não existe em /labs/${labId}/insumos.`,
            });
            return;
          }
          const i = insumoSnap.data()!;
          const nome = (i['nomeComercial'] as string) ?? id;
          const lote = (i['lote'] as string) ?? '—';

          const validadeRealTs = i['validadeReal'] as admin.firestore.Timestamp | undefined;
          const validadeRealDate = validadeRealTs?.toDate();
          if (validadeRealDate && validadeRealDate.getTime() < now.getTime()) {
            violations.push({
              kind: 'vencido',
              insumoId: id,
              insumoNome: nome,
              insumoLote: lote,
              message: `${nome} (lote ${lote}) vencido em ${validadeRealDate.toISOString().slice(0, 10)}.`,
            });
          }
          const status = i['status'] as string | undefined;
          if (status && status !== 'ativo') {
            violations.push({
              kind: 'nao_ativo',
              insumoId: id,
              insumoNome: nome,
              insumoLote: lote,
              message: `${nome} (lote ${lote}) está com status "${status}" — não deveria estar em corrida.`,
            });
          }
          const qcStatus = i['qcStatus'] as string | undefined;
          if (qcStatus === 'reprovado') {
            violations.push({
              kind: 'lote_reprovado',
              insumoId: id,
              insumoNome: nome,
              insumoLote: lote,
              message: `${nome} (lote ${lote}) foi reprovado no CQ.`,
            });
          }
        } catch (err) {
          console.warn(
            `[compliance] falha lendo insumo ${id} em lab ${labId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }),
    );

    if (violations.length === 0) return; // run limpa — nada a fazer

    // Audit — sempre grava, independente de override. `action` diferencia.
    const auditEntry = {
      action: hasOverride
        ? 'RUN_COMPLIANCE_OVERRIDE_SERVER_CONFIRMED'
        : 'RUN_COMPLIANCE_VIOLATION_DETECTED',
      labId,
      lotId,
      runId,
      module: 'hematologia',
      source: 'trigger',
      hasOverride,
      violations,
      createdBy: (run['createdBy'] as string) ?? null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };
    try {
      await db.collection('auditLogs').add(auditEntry);
    } catch (err) {
      console.error(
        `[compliance] falha ao gravar auditLog para run ${runId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // Sem override = marca a run com `complianceViolation` pra UI reagir.
    // Com override, o flag já está presente (client registrou conscientemente).
    if (!hasOverride) {
      try {
        await snap.ref.update({
          complianceViolation: {
            detectedAt: admin.firestore.FieldValue.serverTimestamp(),
            kinds: Array.from(new Set(violations.map((v) => v.kind))),
            message:
              violations.length === 1
                ? violations[0].message
                : `${violations.length} violação(ões) de compliance detectada(s) no server.`,
          },
        });
      } catch (err) {
        console.error(
          `[compliance] falha ao marcar run ${runId} com complianceViolation: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  },
);
