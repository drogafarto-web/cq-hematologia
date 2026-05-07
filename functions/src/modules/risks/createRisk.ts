/**
 * createRisk.ts (server — risks module)
 *
 * Cloud Function callable: `risks_createRisk`
 *
 * Flow:
 *   1. assertRisksAccess (auth guard)
 *   2. validateInput (Zod)
 *   3. Enforce codigo uniqueness per lab
 *   4. Server recomputes NPR + derives Nivel
 *   5. Set reviewDate = now + 365 days
 *   6. Generate server-side LogicalSignature
 *   7. Atomic batch: risk + audit event
 *   8. Caller sees created risk + signature
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { CreateRiskInputSchema, validateAndComputeNPR, assertRisksAccess, risksCollection, ensureRisksLabRoot } from './validators';
import { generateRisksSignatureServer } from './signatureCanonical';

export const risks_createRisk = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const { labId, ...payload } = request.data;
    const auth = request.auth;

    // ─── Guards ───────────────────────────────────────────────────────────

    await assertRisksAccess(auth, labId);

    // Parse input
    let input;
    try {
      input = CreateRiskInputSchema.parse({
        labId,
        ...payload,
      });
    } catch (error: any) {
      throw new HttpsError('invalid-argument', `Entrada inválida: ${error.message}`);
    }

    const db = admin.firestore();

    // ─── Uniqueness check: codigo per lab ──────────────────────────────────

    const existingSnap = await risksCollection(db, labId)
      .where('codigo', '==', input.codigo)
      .where('deletadoEm', '==', null)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new HttpsError(
        'failed-precondition',
        `Código de risco "${input.codigo}" já existe neste laboratório.`
      );
    }

    // ─── NPR computation (server-side authoritative) ──────────────────────

    const npr = validateAndComputeNPR(
      input.probabilidade,
      input.severidade,
      input.deteccao,
    );

    // Derive nivel (default thresholds: baixo ≤24, medio 25–60, alto 61–99, critico ≥100)
    let nivel: 'baixo' | 'medio' | 'alto' | 'critico';
    if (npr <= 24) nivel = 'baixo';
    else if (npr <= 60) nivel = 'medio';
    else if (npr <= 99) nivel = 'alto';
    else nivel = 'critico';

    // ─── Review schedule (365 days from now) ───────────────────────────────

    const now = admin.firestore.Timestamp.now();
    const reviewDate = new admin.firestore.Timestamp(
      now.seconds + 365 * 24 * 60 * 60,
      now.nanoseconds
    );

    // ─── Generate signature ────────────────────────────────────────────────

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

    // ─── Atomic batch write ────────────────────────────────────────────────

    await ensureRisksLabRoot(db, labId);

    const riskRef = risksCollection(db, labId).doc();
    const eventRef = riskRef.collection('events').doc();

    const batch = db.batch();

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
      tratamento: input.tratamento || {
        estrategia: 'mitigar',
        acoes: [],
      },
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
      chainHash: null, // Will be populated by trigger
      prevChainHash: null,
    });

    await batch.commit();

    // ─── Return created risk ──────────────────────────────────────────────

    return {
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
      tratamento: input.tratamento || {
        estrategia: 'mitigar',
        acoes: [],
      },
      reviewHistory: [],
      logicalSignature: signature,
      criadoEm: now.toDate?.() || now,
      deletadoEm: null,
      reviewDate: reviewDate.toDate?.() || reviewDate,
    };
  },
);
