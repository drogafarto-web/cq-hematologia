/**
 * registrarRevisao.ts (server — risks module)
 *
 * Cloud Function callable: `risks_registrarRevisao`
 *
 * Registers a periodic review result. Handles:
 *   - 'mantido': keeps current status, schedules next review (365d from now)
 *   - 'reduzido': acknowledges improvement, schedules next review
 *   - 'reclassificado': mutates P/S/D from review input, recomputes NPR/nivel, reschedules
 *   - 'fechado': sets status='fechado', clears reviewDate (no more reviews needed)
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { RegistrarRevisaoInputSchema, validateAndComputeNPR, assertRisksAccess, risksCollection } from './validators';
import { generateRisksSignatureServer } from './signatureCanonical';

export const risks_registrarRevisao = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const { labId, ...payload } = request.data;
    const auth = request.auth;

    // ─── Guards ───────────────────────────────────────────────────────────

    await assertRisksAccess(auth, labId);

    // Parse input
    let input;
    try {
      input = RegistrarRevisaoInputSchema.parse({
        labId,
        ...payload,
      });
    } catch (error: any) {
      throw new HttpsError('invalid-argument', `Entrada inválida: ${error.message}`);
    }

    const db = admin.firestore();
    const riskRef = risksCollection(db, labId).doc(input.riskId);

    // ─── Fetch existing risk ──────────────────────────────────────────────

    const riskSnap = await riskRef.get();
    if (!riskSnap.exists) {
      throw new HttpsError('not-found', 'Risco não encontrado.');
    }

    const existingRisk = riskSnap.data() as any;
    const now = admin.firestore.Timestamp.now();
    const updates: Record<string, any> = {};

    // ─── Handle resultado logic ───────────────────────────────────────────

    if (input.revisao.resultado === 'reclassificado') {
      // Reclassificação: server recomputes NPR from new P/S/D
      const newP = input.revisao.probabilidadeNova ?? existingRisk.probabilidade;
      const newS = input.revisao.severidadeNova ?? existingRisk.severidade;
      const newD = input.revisao.deteccaoNova ?? existingRisk.deteccao;

      const newNpr = validateAndComputeNPR(newP, newS, newD);
      let newNivel: 'baixo' | 'medio' | 'alto' | 'critico';
      if (newNpr <= 24) newNivel = 'baixo';
      else if (newNpr <= 60) newNivel = 'medio';
      else if (newNpr <= 99) newNivel = 'alto';
      else newNivel = 'critico';

      updates.probabilidade = newP;
      updates.severidade = newS;
      updates.deteccao = newD;
      updates.npr = newNpr;
      updates.nivel = newNivel;

      // Update revisao with computed values
      input.revisao.nprPrevio = existingRisk.npr;
      input.revisao.nprNovo = newNpr;
    }

    if (input.revisao.resultado === 'fechado') {
      updates.status = 'fechado';
      updates.reviewDate = null; // No more reviews for closed risks
    } else {
      // mantido, reduzido: reschedule review for 365d from now
      const nextReviewDate = new admin.firestore.Timestamp(
        now.seconds + 365 * 24 * 60 * 60,
        now.nanoseconds
      );
      updates.reviewDate = nextReviewDate;
    }

    // ─── Append to reviewHistory ──────────────────────────────────────────

    const newReview = {
      ...input.revisao,
      criadoEm: now,
    };

    updates.reviewHistory = admin.firestore.FieldValue.arrayUnion(newReview);

    // ─── Generate new signature + atomic batch ──────────────────────────────

    const signaturePayload = {
      labId,
      codigo: existingRisk.codigo,
      probabilidade: updates.probabilidade ?? existingRisk.probabilidade,
      severidade: updates.severidade ?? existingRisk.severidade,
      deteccao: updates.deteccao ?? existingRisk.deteccao,
      npr: updates.npr ?? existingRisk.npr,
      nivel: updates.nivel ?? existingRisk.nivel,
      status: updates.status ?? existingRisk.status,
      revisaoResultado: input.revisao.resultado,
    };

    const signature = generateRisksSignatureServer(auth!.uid, signaturePayload, now);
    updates.logicalSignature = signature;

    const eventRef = riskRef.collection('events').doc();

    const batch = db.batch();

    batch.update(riskRef, updates);

    batch.set(eventRef, {
      id: eventRef.id,
      timestamp: now,
      operatorId: auth!.uid,
      tipo: 'revisao-registrada',
      changes: {
        resultado: input.revisao.resultado,
        nprPrevio: existingRisk.npr,
        nprNovo: updates.npr ?? existingRisk.npr,
      },
      chainHash: null, // Will be populated by trigger
      prevChainHash: null,
    });

    await batch.commit();

    // ─── Return updated risk ──────────────────────────────────────────────

    return {
      ...existingRisk,
      ...updates,
      logicalSignature: signature,
      reviewHistory: [...(existingRisk.reviewHistory || []), newReview],
      criadoEm: existingRisk.criadoEm.toDate?.() || existingRisk.criadoEm,
      deletadoEm: existingRisk.deletadoEm?.toDate?.() || existingRisk.deletadoEm,
      reviewDate: updates.reviewDate?.toDate?.() || existingRisk.reviewDate?.toDate?.() || null,
    };
  },
);
