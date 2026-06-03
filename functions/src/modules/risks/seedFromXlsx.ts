/**
 * seedFromXlsx.ts (server — risks module)
 *
 * Cloud Function callable: `risks_seedFromXlsx`
 *
 * Batch-creates risks from a pre-mapped JSON array (output of FR-022 conversion).
 * Skips duplicates (by codigo per lab). Creates audit events for each.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  CreateRiskInputSchema,
  validateAndComputeNPR,
  assertRisksAccess,
  risksCollection,
  ensureRisksLabRoot,
} from './validators';
import { generateRisksSignatureServer } from './signatureCanonical';

export const risks_seedFromXlsx = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false, timeoutSeconds: 120 },
  async (request) => {
    const { labId, rows } = request.data;
    const auth = request.auth;

    await assertRisksAccess(auth, labId);

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new HttpsError('invalid-argument', 'rows deve ser um array não-vazio.');
    }
    if (rows.length > 100) {
      throw new HttpsError('invalid-argument', 'Máximo 100 riscos por chamada.');
    }

    const db = admin.firestore();
    await ensureRisksLabRoot(db, labId);

    const existingSnap = await risksCollection(db, labId).where('deletadoEm', '==', null).get();
    const existingCodigos = new Set(existingSnap.docs.map((d) => d.data().codigo));

    const now = admin.firestore.Timestamp.now();
    const reviewDate = new admin.firestore.Timestamp(
      now.seconds + 365 * 24 * 60 * 60,
      now.nanoseconds,
    );

    let created = 0;
    let skipped = 0;

    // Process in batches of 10 (Firestore batch limit is 500 ops, each risk = 2 ops)
    const BATCH_SIZE = 10;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const row of chunk) {
        let input;
        try {
          input = CreateRiskInputSchema.parse({ labId, ...row });
        } catch (error: any) {
          console.warn('[SEED_SKIP_INVALID]', { codigo: row.codigo, error: error.message });
          skipped++;
          continue;
        }

        if (existingCodigos.has(input.codigo)) {
          skipped++;
          continue;
        }

        const npr = validateAndComputeNPR(input.probabilidade, input.severidade, input.deteccao);
        let nivel: 'baixo' | 'medio' | 'alto' | 'critico';
        if (npr <= 24) nivel = 'baixo';
        else if (npr <= 60) nivel = 'medio';
        else if (npr <= 99) nivel = 'alto';
        else nivel = 'critico';

        const signaturePayload = {
          labId,
          codigo: input.codigo,
          descricao: input.descricao,
          probabilidade: input.probabilidade,
          severidade: input.severidade,
          deteccao: input.deteccao,
          npr,
          nivel,
        };
        const signature = generateRisksSignatureServer(auth!.uid, signaturePayload, now);

        const riskRef = risksCollection(db, labId).doc();
        const eventRef = riskRef.collection('events').doc();

        batch.set(riskRef, {
          id: riskRef.id,
          labId,
          codigo: input.codigo,
          descricao: input.descricao,
          processo: input.processo,
          categoria: input.categoria,
          probabilidade: input.probabilidade,
          severidade: input.severidade,
          deteccao: input.deteccao,
          npr,
          nivel,
          status: input.status || 'aberto',
          tratamento: input.tratamento || { estrategia: 'mitigar', acoes: [] },
          reviewHistory: [],
          logicalSignature: signature,
          criadoEm: now,
          deletadoEm: null,
          reviewDate,
        });

        batch.set(eventRef, {
          id: eventRef.id,
          timestamp: now,
          operatorId: auth!.uid,
          tipo: 'created',
          changes: null,
          chainHash: null,
          prevChainHash: null,
        });

        existingCodigos.add(input.codigo);
        created++;
      }

      await batch.commit();
    }

    console.info('[SEED_COMPLETE]', { labId, created, skipped, total: rows.length });
    return { created, skipped };
  },
);
