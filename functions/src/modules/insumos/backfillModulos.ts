// ─── Insumos — Backfill `modulos[]` (Fase A) ─────────────────────────────────
//
// Script de migração idempotente que popula o campo `modulos[]` em todos os
// insumos existentes a partir do `modulo` singular legado. Fase A da evolução
// contextual (ver docs — decisão CTO 2026-04-21).
//
// Idempotente: docs que já possuem `modulos` (array não-vazio) são pulados.
// Rerun safe — pode ser executado múltiplas vezes sem efeitos colaterais.
//
// Trigger exclusivamente SuperAdmin. Não há scheduled — é uma migração
// one-time. Uma vez que todos os docs possuam `modulos[]`, esta função pode
// ser removida (Fase C ou posterior).

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface BackfillSummary {
  triggeredAt: string;
  totalScanned: number;
  totalMigrated: number;
  totalAlreadyMigrated: number;
  totalSkippedCorrupt: number;
  errors: string[];
  durationMs: number;
}

/**
 * Varre todos os insumos via collectionGroup. Para cada doc:
 *   - `modulos` existe e é array não-vazio → skip (alreadyMigrated).
 *   - `modulo` existe e é string → set `modulos: [modulo]` (migrated).
 *   - Nenhum dos dois → skip (skippedCorrupt) + log.
 *
 * Batches de 400 writes (safe abaixo do limite 500 de writeBatch).
 */
async function runBackfill(): Promise<BackfillSummary> {
  const start = Date.now();
  const db = admin.firestore();

  const errors: string[] = [];
  let totalScanned = 0;
  let totalMigrated = 0;
  let totalAlreadyMigrated = 0;
  let totalSkippedCorrupt = 0;

  try {
    const snap = await db.collectionGroup('insumos').get();
    totalScanned = snap.size;

    const BATCH_LIMIT = 400;
    let batch = db.batch();
    let pending = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data() as { modulo?: unknown; modulos?: unknown };

      if (Array.isArray(data.modulos) && data.modulos.length > 0) {
        totalAlreadyMigrated += 1;
        continue;
      }

      if (typeof data.modulo === 'string' && data.modulo.length > 0) {
        batch.update(docSnap.ref, { modulos: [data.modulo] });
        pending += 1;
        totalMigrated += 1;

        if (pending >= BATCH_LIMIT) {
          try {
            await batch.commit();
          } catch (err) {
            errors.push(
              `batch commit failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
          batch = db.batch();
          pending = 0;
        }
        continue;
      }

      totalSkippedCorrupt += 1;
      console.warn(
        `[insumos][backfill] doc sem modulo nem modulos: ${docSnap.ref.path}`,
      );
    }

    if (pending > 0) {
      try {
        await batch.commit();
      } catch (err) {
        errors.push(
          `final batch commit failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    errors.push(
      `top-level failure: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    triggeredAt: new Date().toISOString(),
    totalScanned,
    totalMigrated,
    totalAlreadyMigrated,
    totalSkippedCorrupt,
    errors,
    durationMs: Date.now() - start,
  };
}

/**
 * Trigger onCall, SuperAdmin-only. Retorna o summary da execução.
 * Rerun safe — chamar múltiplas vezes converge para zero mutações.
 */
export const triggerBackfillInsumoModulos = onCall(
  {
    region: 'southamerica-east1',
    memory: '512MiB',
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
        'Apenas SuperAdmin pode disparar o backfill.',
      );
    }

    const summary = await runBackfill();
    console.log(
      `[insumos][backfill] scanned=${summary.totalScanned} ` +
        `migrated=${summary.totalMigrated} ` +
        `alreadyMigrated=${summary.totalAlreadyMigrated} ` +
        `skippedCorrupt=${summary.totalSkippedCorrupt} ` +
        `errors=${summary.errors.length} ` +
        `durationMs=${summary.durationMs}`,
    );
    return summary;
  },
);
