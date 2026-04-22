// ─── Insumos Module — Chain hash trigger ─────────────────────────────────────
//
// Re-export do trigger onDocumentCreated que sela a cadeia criptográfica dos
// eventos de movimentação. Ver chainHash.ts para detalhes do design.

export { onInsumoMovimentacaoCreate } from './chainHash';

// ─── Insumos Module — validateFR10 HTTP endpoint ─────────────────────────────
//
// Re-export do endpoint HTTP público que responde ao QR de FR-10 impresso.
// Ver validateFR10.ts.

export { validateFR10 } from './validateFR10';

// ─── Insumos Module — Backfill modulos[] (Fase A) ────────────────────────────
//
// Re-export do trigger onCall de migração one-time que popula `modulos[]`
// em docs legados. Idempotente. SuperAdmin-only.

export { triggerBackfillInsumoModulos } from './backfillModulos';

// ─── Insumos Module — Scheduled Expiration ───────────────────────────────────
//
// Diariamente move insumos 'ativo' cuja validadeReal já passou para status
// 'vencido'. Corre logo após o export diário de Firestore (03:15 BRT) — assim
// o snapshot do dia reflete o estado pré-expiração e a corrida às 03:15 gera
// o delta.
//
// Trigger manual via `triggerInsumosExpiration` (onCall, admin/owner).
// Logs em `/firestore-backup-logs` (mesma coleção de observabilidade).

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExpirationSummary {
  triggeredAt: string; // ISO8601
  source: 'scheduled' | 'manual';
  totalScanned: number;
  totalExpired: number;
  errors: string[];
  durationMs: number;
}

// ─── Core logic ──────────────────────────────────────────────────────────────

/**
 * Varre todos os labs (collectionGroup 'insumos') procurando insumos ativos
 * com `validadeReal < now` e transita-os para 'vencido' em batches de 500.
 *
 * Tolerante a falha parcial — se 1 batch falha, continua nos próximos e
 * reporta no `errors[]`.
 */
async function expireOverdueInsumos(
  source: 'scheduled' | 'manual',
): Promise<ExpirationSummary> {
  const start = Date.now();
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const errors: string[] = [];
  let totalScanned = 0;
  let totalExpired = 0;

  try {
    const snap = await db
      .collectionGroup('insumos')
      .where('status', '==', 'ativo')
      .where('validadeReal', '<', now)
      .get();

    totalScanned = snap.size;

    // Firestore batch limit: 500 writes. Quebra em chunks.
    const BATCH_SIZE = 500;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      try {
        const batch = db.batch();
        chunk.forEach((d) => {
          batch.update(d.ref, {
            status: 'vencido',
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
        totalExpired += chunk.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Batch ${i}–${i + chunk.length}: ${msg}`);
        console.error(`[insumos][expire] Batch failed (offset ${i}): ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Top-level query failed: ${msg}`);
    console.error(`[insumos][expire] Top-level error: ${msg}`);
  }

  const summary: ExpirationSummary = {
    triggeredAt: new Date().toISOString(),
    source,
    totalScanned,
    totalExpired,
    errors,
    durationMs: Date.now() - start,
  };

  // Registra no log de observabilidade (mesma coleção do backup).
  try {
    await db.collection('firestore-backup-logs').add({
      kind: 'insumos-expiration',
      ...summary,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // log falhou mas a expiração já foi registrada — apenas warn
    console.warn(
      `[insumos][expire] Failed to write log entry: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return summary;
}

// ─── Scheduled function ──────────────────────────────────────────────────────

/**
 * Roda toda madrugada às 03:15 BRT — 15 minutos após o export de Firestore
 * para que o snapshot do dia capture o estado pré-expiração (permite
 * auditoria retroativa do momento exato em que cada insumo virou vencido).
 */
export const scheduledExpireInsumos = onSchedule(
  {
    schedule: 'every day 03:15',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async () => {
    console.log('[insumos][scheduled] Starting daily expiration sweep...');
    const summary = await expireOverdueInsumos('scheduled');
    console.log(
      `[insumos][scheduled] Done. scanned=${summary.totalScanned} ` +
        `expired=${summary.totalExpired} errors=${summary.errors.length} ` +
        `durationMs=${summary.durationMs}`,
    );
    if (summary.errors.length > 0) {
      console.error(`[insumos][scheduled] Errors: ${JSON.stringify(summary.errors)}`);
    }
  },
);

// ─── Manual trigger (admin-only) ─────────────────────────────────────────────

/**
 * Dispara a varredura sob demanda — útil para testes pós-cadastro em lote
 * ou validação em janela de mudança de horário. Requer admin/owner no lab
 * ativo OU SuperAdmin.
 */
export const triggerInsumosExpiration = onCall(
  {
    region: 'southamerica-east1',
    memory: '256MiB',
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
      const { labId } = (request.data ?? {}) as { labId?: string };
      if (!labId) {
        throw new HttpsError(
          'invalid-argument',
          'labId obrigatório para usuários não-SuperAdmin.',
        );
      }
      const memberSnap = await admin
        .firestore()
        .doc(`labs/${labId}/members/${uid}`)
        .get();
      const member = memberSnap.data() ?? {};
      if (!member.active || (member.role !== 'admin' && member.role !== 'owner')) {
        throw new HttpsError(
          'permission-denied',
          'Apenas admin/owner do lab pode disparar a expiração manual.',
        );
      }
    }

    const summary = await expireOverdueInsumos('manual');
    return summary;
  },
);
