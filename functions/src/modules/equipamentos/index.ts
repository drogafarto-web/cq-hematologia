// ─── Equipamentos Module (Fase D — 2026-04-21) ───────────────────────────────
//
// Duas Cloud Functions:
//
// 1) triggerMigrateSetupsToEquipamentos (onCall, SuperAdmin-only)
//    Migração one-time + idempotente. Para cada lab:
//      - Varre /labs/{labId}/equipment-setups/* com docId == módulo (pré-Fase D).
//      - Cria /labs/{labId}/equipamentos/{newId} com dados do catálogo default
//        (Yumizen H550, Clotimer Duo, Uri Color, Imuno Strips).
//      - Reescreve o setup legado para /labs/{labId}/equipment-setups/{newId}
//        preenchendo `equipamentoId`. Setup original mantido por segurança
//        (cleanup pós-validação em iteração seguinte).
//      - Emite audit event 'created' para trilha.
//    Idempotência: setups que já têm `equipamentoId` preenchido são pulados.
//
// 2) scheduledCleanupEquipamentosExpirados (onSchedule, diário)
//    Varre /labs/*/equipamentos com `status=aposentado` e `retencaoAte < now`.
//    Deleta o doc mestre (audit trail preservado em /equipamentos-audit que
//    é append-only). Roda 03:45 BRT após o sweep de expiração de insumos
//    (03:15) e o export Firestore (03:00). Logs em /firestore-backup-logs.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// ─── Catálogo default (paralelo a src/constants.ts) ──────────────────────────
// Duplicação proposital: o client e o backend compartilham a mesma verdade mas
// por conveniência de bundle separado. Mudou um? mude o outro — linha única
// aqui com comentário na constants.ts do cliente apontando pra cá.

type InsumoModulo = 'hematologia' | 'coagulacao' | 'uroanalise' | 'imunologia';

const DEFAULT_EQUIPAMENTO_POR_MODULO: Record<
  InsumoModulo,
  { name: string; modelo: string; fabricante: string }
> = {
  hematologia: { name: 'Yumizen H550', modelo: 'YUMIZEN_H550', fabricante: 'Horiba Medical' },
  coagulacao: {
    name: 'Clotimer Duo',
    modelo: 'CLOTIMER_DUO',
    fabricante: 'Instrumentation Laboratory',
  },
  uroanalise: { name: 'Uri Color', modelo: 'URI_COLOR', fabricante: 'Wama Diagnóstica' },
  imunologia: {
    name: 'Strips de Imunoensaio',
    modelo: 'IMUNO_STRIPS',
    fabricante: 'Multi-fabricante',
  },
};

const MODULOS_VALIDOS: InsumoModulo[] = [
  'hematologia',
  'coagulacao',
  'uroanalise',
  'imunologia',
];

const RETENCAO_ANOS = 5;

// ─── Migration Summary types ─────────────────────────────────────────────────

interface PerLabMigrationResult {
  labId: string;
  setupsVistos: number;
  equipamentosCriados: number;
  setupsReescritos: number;
  setupsJaMigrados: number;
  erros: string[];
}

interface MigrationSummary {
  triggeredAt: string;
  durationMs: number;
  totalLabs: number;
  totalSetupsVistos: number;
  totalEquipamentosCriados: number;
  totalSetupsReescritos: number;
  totalSetupsJaMigrados: number;
  porLab: PerLabMigrationResult[];
  erros: string[];
}

// ─── Migration core ──────────────────────────────────────────────────────────

async function migrateLab(labId: string): Promise<PerLabMigrationResult> {
  const db = admin.firestore();
  const result: PerLabMigrationResult = {
    labId,
    setupsVistos: 0,
    equipamentosCriados: 0,
    setupsReescritos: 0,
    setupsJaMigrados: 0,
    erros: [],
  };

  try {
    const setupsSnap = await db.collection(`labs/${labId}/equipment-setups`).get();
    result.setupsVistos = setupsSnap.size;

    for (const setupDoc of setupsSnap.docs) {
      try {
        const setupId = setupDoc.id;
        const data = setupDoc.data() as Record<string, unknown>;

        // Idempotência: setup já migrado (docId é UUID + equipamentoId preenchido)?
        if (
          typeof data.equipamentoId === 'string' &&
          data.equipamentoId.length > 0 &&
          data.equipamentoId === setupId
        ) {
          result.setupsJaMigrados += 1;
          continue;
        }

        // Heurística: docId legado == nome de módulo.
        const isLegacyModuleKey = MODULOS_VALIDOS.includes(setupId as InsumoModulo);
        if (!isLegacyModuleKey) {
          // docId não é módulo e não tem equipamentoId → dado corrompido, pula.
          result.erros.push(
            `Setup ${setupDoc.ref.path}: docId=${setupId} não é módulo nem tem equipamentoId. Skip.`,
          );
          continue;
        }

        const module = setupId as InsumoModulo;
        const catalogDefault = DEFAULT_EQUIPAMENTO_POR_MODULO[module];
        const existingName = (data.equipamentoName as string | undefined) ?? catalogDefault.name;
        const existingModelo =
          (data.equipamentoModelo as string | undefined) ?? catalogDefault.modelo;

        // Cria equipamento novo com dados do catálogo (ou override do setup legado).
        const newEquipId = globalThis.crypto?.randomUUID?.() ?? `mig-${Date.now()}-${Math.random()}`;
        const equipamentoDoc = {
          labId,
          module,
          name: existingName,
          modelo: existingModelo,
          fabricante: catalogDefault.fabricante,
          status: 'ativo' as const,
          createdAt: admin.firestore.Timestamp.now(),
          createdBy: 'system-migration-fase-d',
          createdByName: 'Sistema · Migração Fase D',
          observacoes:
            'Criado automaticamente pela migração Fase D (2026-04-21) a partir do setup legado. Lab pode editar nome, modelo, nº série e observações a qualquer momento.',
        };

        const auditId = globalThis.crypto?.randomUUID?.() ?? `audit-${Date.now()}-${Math.random()}`;
        const auditDoc = {
          labId,
          equipamentoId: newEquipId,
          equipamentoNameSnapshot: existingName,
          equipamentoModeloSnapshot: existingModelo,
          type: 'created',
          motivo: 'Migração automática Fase D — setup legado promovido a Equipamento.',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          operadorId: 'system-migration-fase-d',
          operadorName: 'Sistema · Migração Fase D',
        };

        // Reescreve setup com docId = novo equipamentoId, preservando campos ativos.
        const newSetupDoc = {
          ...data,
          module,
          labId,
          equipamentoId: newEquipId,
          equipamentoName: existingName,
          ...(existingModelo && { equipamentoModelo: existingModelo }),
          // updatedAt não é tocado — mantém quando o lab efetivamente alterou por último.
        };

        // writeBatch: 3 writes atômicos.
        const batch = db.batch();
        batch.set(db.doc(`labs/${labId}/equipamentos/${newEquipId}`), equipamentoDoc);
        batch.set(db.doc(`labs/${labId}/equipamentos-audit/${auditId}`), auditDoc);
        batch.set(
          db.doc(`labs/${labId}/equipment-setups/${newEquipId}`),
          newSetupDoc,
        );
        await batch.commit();

        result.equipamentosCriados += 1;
        result.setupsReescritos += 1;

        // NÃO deletamos o setup legado nesta passada. A UI continua lendo
        // /equipment-setups/{module} via useEquipmentSetup antigo enquanto o
        // refactor dos call sites é concluído. Iteração seguinte limpa.
      } catch (err) {
        result.erros.push(
          `Setup ${setupDoc.ref.path}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    result.erros.push(
      `Lab ${labId} falhou na leitura inicial: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return result;
}

/**
 * Migração one-time. SuperAdmin-only. Idempotente.
 *
 * Request data:
 *   - labIds?: string[]  — restringe a esses labs. Default: todos os labs.
 *   - dryRun?: boolean   — não escreve nada, só reporta o que faria.
 *
 * Response: MigrationSummary.
 */
export const triggerMigrateSetupsToEquipamentos = onCall(
  {
    region: 'southamerica-east1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    const token = request.auth.token as Record<string, unknown>;
    const isSuperAdminByClaim = token.isSuperAdmin === true;
    if (!isSuperAdminByClaim) {
      const userSnap = await admin.firestore().doc(`users/${request.auth.uid}`).get();
      if (userSnap.data()?.isSuperAdmin !== true) {
        throw new HttpsError(
          'permission-denied',
          'Apenas SuperAdmin pode migrar setups de equipamento.',
        );
      }
    }

    const { labIds, dryRun } = (request.data ?? {}) as {
      labIds?: string[];
      dryRun?: boolean;
    };

    const start = Date.now();
    const db = admin.firestore();

    const targetLabs: string[] = Array.isArray(labIds) && labIds.length > 0
      ? labIds
      : (await db.collection('labs').get()).docs.map((d) => d.id);

    const porLab: PerLabMigrationResult[] = [];
    const globalErros: string[] = [];

    for (const labId of targetLabs) {
      try {
        if (dryRun) {
          // dryRun: só conta setups candidatos, não escreve.
          const setupsSnap = await db.collection(`labs/${labId}/equipment-setups`).get();
          let candidatos = 0;
          let jaMigrados = 0;
          for (const s of setupsSnap.docs) {
            const d = s.data();
            if (typeof d.equipamentoId === 'string' && d.equipamentoId.length > 0) {
              jaMigrados += 1;
            } else if (MODULOS_VALIDOS.includes(s.id as InsumoModulo)) {
              candidatos += 1;
            }
          }
          porLab.push({
            labId,
            setupsVistos: setupsSnap.size,
            equipamentosCriados: 0,
            setupsReescritos: 0,
            setupsJaMigrados: jaMigrados,
            erros: candidatos > 0 ? [`dryRun: ${candidatos} setups seriam migrados.`] : [],
          });
          continue;
        }
        porLab.push(await migrateLab(labId));
      } catch (err) {
        globalErros.push(
          `Lab ${labId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const summary: MigrationSummary = {
      triggeredAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      totalLabs: targetLabs.length,
      totalSetupsVistos: porLab.reduce((a, l) => a + l.setupsVistos, 0),
      totalEquipamentosCriados: porLab.reduce((a, l) => a + l.equipamentosCriados, 0),
      totalSetupsReescritos: porLab.reduce((a, l) => a + l.setupsReescritos, 0),
      totalSetupsJaMigrados: porLab.reduce((a, l) => a + l.setupsJaMigrados, 0),
      porLab,
      erros: globalErros,
    };

    // Log centralizado (mesmo canal do backup/insumos)
    try {
      await db.collection('firestore-backup-logs').add({
        kind: 'equipamentos-migration',
        ...summary,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn(
        `[equipamentos][migrate] falha ao gravar log: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    console.log(
      `[equipamentos][migrate] labs=${summary.totalLabs} ` +
        `vistos=${summary.totalSetupsVistos} criados=${summary.totalEquipamentosCriados} ` +
        `reescritos=${summary.totalSetupsReescritos} jaMig=${summary.totalSetupsJaMigrados} ` +
        `errs=${summary.erros.length} ms=${summary.durationMs}`,
    );

    return summary;
  },
);

// ─── Cleanup pós-retenção ────────────────────────────────────────────────────

interface CleanupSummary {
  triggeredAt: string;
  source: 'scheduled' | 'manual';
  totalElegiveis: number;
  totalRemovidos: number;
  errors: string[];
  durationMs: number;
}

/**
 * Remove permanentemente docs de `/equipamentos` cujo `retencaoAte < now`.
 * Audit trail sobrevive (está em `/equipamentos-audit`, coleção separada).
 * Runs e lotes que referenciam o equipamento já guardam snapshot
 * (EquipamentoSnapshot na corrida) — rastreabilidade preservada.
 *
 * RDC 786/2023 art. 42 + RDC 978/2025: registros de instrumentação devem ser
 * mantidos por no mínimo 5 anos após desativação. Após esse prazo, descarte
 * dos metadados é permitido — auditorias retroativas usam a trilha imutável.
 */
async function runCleanup(source: 'scheduled' | 'manual'): Promise<CleanupSummary> {
  const start = Date.now();
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const errors: string[] = [];
  let totalElegiveis = 0;
  let totalRemovidos = 0;

  try {
    const snap = await db
      .collectionGroup('equipamentos')
      .where('status', '==', 'aposentado')
      .where('retencaoAte', '<', now)
      .get();

    totalElegiveis = snap.size;

    const BATCH_SIZE = 400;
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const chunk = snap.docs.slice(i, i + BATCH_SIZE);
      try {
        const batch = db.batch();
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        totalRemovidos += chunk.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Batch ${i}–${i + chunk.length}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Top-level query failed: ${msg}`);
  }

  const summary: CleanupSummary = {
    triggeredAt: new Date().toISOString(),
    source,
    totalElegiveis,
    totalRemovidos,
    errors,
    durationMs: Date.now() - start,
  };

  try {
    await db.collection('firestore-backup-logs').add({
      kind: 'equipamentos-cleanup',
      ...summary,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      retencaoAnos: RETENCAO_ANOS,
    });
  } catch (err) {
    console.warn(
      `[equipamentos][cleanup] log falhou: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return summary;
}

/**
 * Sweep diário 03:45 BRT — após export Firestore (03:00) e expiração de
 * insumos (03:15). Garante que o snapshot do dia captura o estado pré-cleanup
 * para reconstrução forense retroativa.
 */
export const scheduledCleanupEquipamentosExpirados = onSchedule(
  {
    schedule: 'every day 03:45',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async () => {
    console.log('[equipamentos][cleanup] Starting daily retention sweep...');
    const summary = await runCleanup('scheduled');
    console.log(
      `[equipamentos][cleanup] elegiveis=${summary.totalElegiveis} ` +
        `removidos=${summary.totalRemovidos} errs=${summary.errors.length} ` +
        `ms=${summary.durationMs}`,
    );
    if (summary.errors.length > 0) {
      console.error(`[equipamentos][cleanup] errors: ${JSON.stringify(summary.errors)}`);
    }
  },
);

/** Trigger manual para SuperAdmin — mesma lógica, on-demand. */
export const triggerCleanupEquipamentosExpirados = onCall(
  {
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    const token = request.auth.token as Record<string, unknown>;
    if (token.isSuperAdmin !== true) {
      const userSnap = await admin.firestore().doc(`users/${request.auth.uid}`).get();
      if (userSnap.data()?.isSuperAdmin !== true) {
        throw new HttpsError('permission-denied', 'Apenas SuperAdmin.');
      }
    }
    return runCleanup('manual');
  },
);
