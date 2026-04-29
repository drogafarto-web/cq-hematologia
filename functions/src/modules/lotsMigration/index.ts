// ─── lotsMigration — Backfill /lots → /insumos (Fase B 2026-04-28) ──────────
//
// Migração one-time idempotente que unifica `ControlLot` (coleção `/lots`)
// com `InsumoControle` (coleção `/insumos`, tipo='controle'). Resolve a
// "anomalia de coleções com ADR pendente" identificada na auditoria
// arquitetural de 2026-04-27.
//
// Estratégia:
//   1. Lê todos /labs/{labId}/lots/{lotId}
//   2. Pra cada lot, replica em /labs/{labId}/insumos/{lotId} com shape
//      InsumoControle (preservando ID original)
//   3. Copia sub-coleção /lots/{id}/runs → /insumos/{id}/runs
//   4. NÃO deleta /lots — coleção legada permanece como backup imutável.
//
// Idempotente: rerun safe. Docs em /insumos com mesmo ID são sobrescritos
// pra refletir o estado atual de /lots (evita drift quando dual-write
// estiver ativo no cliente e o backfill for refeito).
//
// Trigger exclusivamente SuperAdmin via onCall `triggerLotsMigration`.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface LotsMigrationSummary {
  triggeredAt: string;
  scannedLabs: number;
  scannedLots: number;
  migratedLots: number;
  scannedRuns: number;
  migratedRuns: number;
  errors: string[];
  durationMs: number;
}

interface MigrationOpts {
  /**
   * Se passado, migra apenas o lab especificado. Caso contrário, varre
   * todos os labs (collectionGroup). Use pra isolar primeira execução
   * a um lab piloto antes de rodar global.
   */
  labId?: string;
}

interface LotDoc {
  labId?: string;
  lotNumber?: string;
  controlName?: string;
  equipmentName?: string;
  serialNumber?: string;
  level?: 1 | 2 | 3;
  startDate?: admin.firestore.Timestamp;
  expiryDate?: admin.firestore.Timestamp;
  requiredAnalytes?: string[];
  manufacturerStats?: Record<string, { mean: number; sd: number }>;
  statistics?: Record<string, { mean: number; sd: number }> | null;
  runCount?: number;
  createdAt?: admin.firestore.Timestamp;
  createdBy?: string;
  frequencyConfig?: {
    frequencyType: 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'custom';
    frequencyDays?: number;
  };
  requerControlePorCorrida?: boolean;
}

// ─── Mapping helpers (mirror of frontend controlLotAdapter) ──────────────────

function bulaLevelToNivel(level: 1 | 2 | 3 | undefined): string {
  if (level === 1) return 'baixo';
  if (level === 3) return 'alto';
  return 'normal';
}

function buildInsumoControleFromLot(
  labId: string,
  lotId: string,
  data: LotDoc,
): Record<string, unknown> {
  const validade = data.expiryDate ?? admin.firestore.Timestamp.now();
  const startDate = data.startDate ?? data.createdAt ?? admin.firestore.Timestamp.now();
  const createdAt = data.createdAt ?? admin.firestore.Timestamp.now();
  const nivel = bulaLevelToNivel(data.level);

  const out: Record<string, unknown> = {
    labId,
    tipo: 'controle',
    nivel,
    modulo: 'hematologia',
    modulos: ['hematologia'],
    fabricante: 'Controllab',
    nomeComercial: data.controlName ?? '',
    lote: data.lotNumber ?? lotId,
    validade,
    dataAbertura: null,
    diasEstabilidadeAbertura: 0,
    validadeReal: validade,
    status: validade.toMillis() < Date.now() ? 'vencido' : 'ativo',
    createdAt,
    createdBy: data.createdBy ?? 'system-migration',
    stats: data.manufacturerStats ?? {},
    bulaLevel: data.level ?? 2,
    controlProgramName: data.controlName ?? '',
    startDate,
    equipmentName: data.equipmentName ?? '',
    serialNumber: data.serialNumber ?? '',
    requiredAnalytes: data.requiredAnalytes ?? [],
    runCount: data.runCount ?? 0,
  };

  if (data.statistics) {
    // ControlLot.statistics -> InsumoControle.internalStats (com shape ligeiramente
    // diferente — internalStats inclui n, statistics não. Adicionamos n=runCount
    // como aproximação; a Cloud Function que recalcula stats vai sobrescrever.)
    const internalStats: Record<string, { mean: number; sd: number; n: number }> = {};
    for (const [analyteId, s] of Object.entries(data.statistics)) {
      internalStats[analyteId] = {
        mean: s.mean,
        sd: s.sd,
        n: data.runCount ?? 0,
      };
    }
    out.internalStats = internalStats;
  }

  if (data.frequencyConfig) {
    out.frequencyConfig = data.frequencyConfig;
  }
  if (data.requerControlePorCorrida !== undefined) {
    out.requerControlePorCorrida = data.requerControlePorCorrida;
  }

  return out;
}

// ─── Main migration ──────────────────────────────────────────────────────────

async function runMigration(opts: MigrationOpts): Promise<LotsMigrationSummary> {
  const start = Date.now();
  const db = admin.firestore();

  const errors: string[] = [];
  let scannedLabs = 0;
  let scannedLots = 0;
  let migratedLots = 0;
  let scannedRuns = 0;
  let migratedRuns = 0;

  try {
    // 1) Determina conjunto de labs a processar.
    let labIds: string[] = [];
    if (opts.labId) {
      labIds = [opts.labId];
    } else {
      const labsSnap = await db.collection('labs').get();
      labIds = labsSnap.docs.map((d) => d.id);
    }
    scannedLabs = labIds.length;

    // 2) Pra cada lab, processa lots.
    for (const labId of labIds) {
      const lotsSnap = await db.collection('labs').doc(labId).collection('lots').get();
      scannedLots += lotsSnap.size;

      for (const lotDoc of lotsSnap.docs) {
        const lotId = lotDoc.id;
        const lotData = lotDoc.data() as LotDoc;

        try {
          // 2a) Replica metadata em /insumos/{lotId}
          const insumoData = buildInsumoControleFromLot(labId, lotId, lotData);
          await db
            .collection('labs')
            .doc(labId)
            .collection('insumos')
            .doc(lotId)
            .set(insumoData);
          migratedLots += 1;

          // 2b) Copia sub-coleção runs
          const runsSnap = await db
            .collection('labs')
            .doc(labId)
            .collection('lots')
            .doc(lotId)
            .collection('runs')
            .get();
          scannedRuns += runsSnap.size;

          // Batch writes em chunks de 400 (limite 500)
          let batch = db.batch();
          let pending = 0;
          for (const runDoc of runsSnap.docs) {
            const targetRef = db
              .collection('labs')
              .doc(labId)
              .collection('insumos')
              .doc(lotId)
              .collection('runs')
              .doc(runDoc.id);
            batch.set(targetRef, runDoc.data());
            pending += 1;
            migratedRuns += 1;
            if (pending >= 400) {
              await batch.commit();
              batch = db.batch();
              pending = 0;
            }
          }
          if (pending > 0) await batch.commit();
        } catch (err) {
          errors.push(
            `lab=${labId} lot=${lotId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  } catch (err) {
    errors.push(`top-level: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    triggeredAt: new Date().toISOString(),
    scannedLabs,
    scannedLots,
    migratedLots,
    scannedRuns,
    migratedRuns,
    errors,
    durationMs: Date.now() - start,
  };
}

// ─── onCall trigger (SuperAdmin only) ────────────────────────────────────────

export const triggerLotsMigration = onCall(
  {
    region: 'southamerica-east1',
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const uid = request.auth.uid;
    const userSnap = await admin.firestore().doc(`users/${uid}`).get();
    const userData = userSnap.data() ?? {};
    const isSuperAdmin = userData.isSuperAdmin === true;

    if (!isSuperAdmin) {
      throw new HttpsError(
        'permission-denied',
        'Apenas SuperAdmin pode disparar a migração de lotes.',
      );
    }

    const data = (request.data ?? {}) as { labId?: string };
    const summary = await runMigration({
      labId: typeof data.labId === 'string' && data.labId.length > 0 ? data.labId : undefined,
    });

    console.log(
      `[lotsMigration] labs=${summary.scannedLabs} lots=${summary.scannedLots}/${summary.migratedLots} ` +
        `runs=${summary.scannedRuns}/${summary.migratedRuns} ` +
        `errors=${summary.errors.length} durationMs=${summary.durationMs}`,
    );

    return summary;
  },
);
