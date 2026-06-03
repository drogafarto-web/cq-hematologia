/**
 * turnos_backfill90Days — admin-only callable for backfilling supervisor shifts.
 *
 * For last 90 days × 4 periods (manha, tarde, noite, plantao):
 *   1. Query `colaboradores` for default supervisor (labSettings.defaultSupervisorId
 *      or most recent active by criadoEm)
 *   2. Check if (data, periodo) tuple already exists (non-deleted)
 *   3. If missing: create inferred turno with supervisor snapshot
 *   4. Batch in chunks of 100 (Firestore limit: 500 writes per batch)
 *
 * Returns { created, skipped, dryRun }.
 * Idempotent: re-run does not duplicate.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import { generateTurnosSignatureServer } from './signatureCanonical';
import { turnosCollection, Backfill90DaysInputSchema } from './validators';

interface Backfill90DaysResult {
  ok: true;
  created: number;
  skipped: number;
  dryRun: boolean;
}

const PERIODOS = ['manha', 'tarde', 'noite', 'plantao'] as const;
type Periodo = (typeof PERIODOS)[number];

function dateToISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getLast90Days(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(dateToISO(d));
  }
  return dates;
}

export const turnos_backfill90Days = onCall<unknown, Promise<Backfill90DaysResult>>(
  {},
  async (request) => {
    const parsed = Backfill90DaysInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    // Admin-only check
    if (!request.auth?.token.isSuperAdmin) {
      throw new HttpsError('permission-denied', 'Admin-only operation.');
    }

    const db = admin.firestore();
    const uid = request.auth!.uid;

    // Resolve default supervisor
    const colaboradoresSnap = await db
      .collection(`educacaoContinuada/${input.labId}/colaboradores`)
      .where('ativo', '==', true)
      .orderBy('criadoEm', 'desc')
      .limit(1)
      .get();

    if (colaboradoresSnap.empty) {
      throw new HttpsError('failed-precondition', 'Nenhum supervisor ativo encontrado no lab.');
    }

    const supervisorDoc = colaboradoresSnap.docs[0];
    const supervisorId = supervisorDoc.id;
    const supervisorName = supervisorDoc.data()['nome'] as string;
    const supervisorCRBM = supervisorDoc.data()['crbm'] as string | undefined;
    const habilitacoes = (supervisorDoc.data()['habilitacoes'] ?? []) as Array<{
      id: string;
      descricao: string;
      ativo?: boolean;
      vencimento?: any;
    }>;
    const certificatesActive = habilitacoes
      .filter((h) => h.ativo !== false)
      .map((h) => ({
        id: h.id,
        descricao: h.descricao,
        ativo: true,
        vencimento: h.vencimento ?? null,
      }));

    // Collect existing (data, periodo) tuples
    const existingTurnos = await db
      .collection(`labs/${input.labId}/turnos`)
      .where('deletadoEm', '==', null)
      .get();

    const existingTuples = new Set<string>();
    existingTurnos.docs.forEach((doc) => {
      const data = doc.data()['data'] as string;
      const periodo = doc.data()['periodo'] as Periodo;
      existingTuples.add(`${data}::${periodo}`);
    });

    // Backfill plan
    const last90Days = getLast90Days();
    let created = 0;
    let skipped = 0;

    const turnosCol = turnosCollection(db, input.labId);
    const nowTs = admin.firestore.Timestamp.now();

    if (input.dryRun) {
      // Count only
      for (const data of last90Days) {
        for (const periodo of PERIODOS) {
          const key = `${data}::${periodo}`;
          if (existingTuples.has(key)) {
            skipped++;
          } else {
            created++;
          }
        }
      }
      return { ok: true, created, skipped, dryRun: true };
    }

    // Real backfill: batch writes in chunks of 100
    const BATCH_SIZE = 100;
    let batch = db.batch();
    let batchCount = 0;

    for (const data of last90Days) {
      for (const periodo of PERIODOS) {
        const key = `${data}::${periodo}`;
        if (existingTuples.has(key)) {
          skipped++;
          continue;
        }

        // Create new inferred turno
        const turnoRef = turnosCol.doc();
        const signature = generateTurnosSignatureServer(uid, {
          data,
          periodo,
          supervisorId,
          supervisorName,
          supervisorCRBM: supervisorCRBM || '',
        });

        const turnoDoc = {
          labId: input.labId,
          data,
          periodo,
          supervisorId,
          supervisorName,
          supervisorCRBM: supervisorCRBM || '',
          certificatesActive,
          observacoes: null,
          inferred: true,
          logicalSignature: signature,
          criadoEm: nowTs,
          deletadoEm: null,
        };

        // Append backfill audit event
        const auditEventRef = turnoRef.collection('events').doc();
        const auditEvent = {
          tipo: 'backfilled',
          operadorId: uid,
          timestamp: nowTs,
          mudancas: undefined,
          chainHash: '', // Will be computed by trigger
          chainHashAnterior: null,
        };

        batch.set(turnoRef, turnoDoc);
        batch.set(auditEventRef, auditEvent);
        created++;
        batchCount++;

        // Flush batch if we hit size limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    // Final flush
    if (batchCount > 0) {
      await batch.commit();
    }

    return { ok: true, created, skipped, dryRun: false };
  },
);
