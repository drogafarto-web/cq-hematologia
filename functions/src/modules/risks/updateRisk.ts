/**
 * updateRisk.ts (server — risks module)
 *
 * Cloud Function callable: `risks_updateRisk`
 *
 * Allows mutation of P/S/D (triggers NPR + nivel recompute), status transitions,
 * and treatment.acoes[] append. Server recomputes NPR and derives nivel.
 * Appends audit event with changes diff.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { UpdateRiskInputSchema, validateAndComputeNPR, assertRisksAccess, risksCollection } from './validators';
import { generateRisksSignatureServer } from './signatureCanonical';

export const risks_updateRisk = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const { labId, ...payload } = request.data;
    const auth = request.auth;

    // ─── Guards ───────────────────────────────────────────────────────────

    await assertRisksAccess(auth, labId);

    // Parse input
    let input;
    try {
      input = UpdateRiskInputSchema.parse({
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

    // ─── Prepare updates (allow P/S/D mutation, status transitions, tratamento) ────

    const updates: Record<string, any> = {};
    const changes: Record<string, unknown> = {};

    // If P/S/D changed, recompute NPR + derive nivel
    const newP = input.probabilidade ?? existingRisk.probabilidade;
    const newS = input.severidade ?? existingRisk.severidade;
    const newD = input.deteccao ?? existingRisk.deteccao;

    if (
      newP !== existingRisk.probabilidade ||
      newS !== existingRisk.severidade ||
      newD !== existingRisk.deteccao
    ) {
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

      changes.probabilidade = { from: existingRisk.probabilidade, to: newP };
      changes.severidade = { from: existingRisk.severidade, to: newS };
      changes.deteccao = { from: existingRisk.deteccao, to: newD };
      changes.npr = { from: existingRisk.npr, to: newNpr };
      changes.nivel = { from: existingRisk.nivel, to: newNivel };
    }

    // Status transition
    if (input.status) {
      updates.status = input.status;
      changes.status = { from: existingRisk.status, to: input.status };
    }

    // Extended domain fields
    if (input.descricao !== undefined) {
      updates.descricao = input.descricao;
      changes.descricao = { from: existingRisk.descricao, to: input.descricao };
    }
    if (input.processo !== undefined) {
      updates.processo = input.processo;
      changes.processo = { from: existingRisk.processo, to: input.processo };
    }
    if (input.categoria !== undefined) {
      updates.categoria = input.categoria;
      changes.categoria = { from: existingRisk.categoria, to: input.categoria };
    }
    if (input.causaPotencial !== undefined) {
      updates.causaPotencial = input.causaPotencial;
      changes.causaPotencial = { from: existingRisk.causaPotencial, to: input.causaPotencial };
    }
    if (input.efeitoPotencial !== undefined) {
      updates.efeitoPotencial = input.efeitoPotencial;
      changes.efeitoPotencial = { from: existingRisk.efeitoPotencial, to: input.efeitoPotencial };
    }
    if (input.responsavel !== undefined) {
      updates.responsavel = input.responsavel;
      changes.responsavel = { from: existingRisk.responsavel, to: input.responsavel };
    }
    if (input.setor !== undefined) {
      updates.setor = input.setor;
      changes.setor = { from: existingRisk.setor, to: input.setor };
    }
    if (input.evidencias !== undefined) {
      updates.evidencias = input.evidencias;
      changes.evidencias = { from: existingRisk.evidencias, to: input.evidencias };
    }
    if (input.eficacia !== undefined) {
      updates.eficacia = input.eficacia;
      changes.eficacia = { from: existingRisk.eficacia, to: input.eficacia };
    }

    // Tratamento (append-only acoes)
    if (input.tratamento) {
      const newTratamento = {
        ...existingRisk.tratamento,
        ...input.tratamento,
      };
      updates.tratamento = newTratamento;
    }

    if (Object.keys(updates).length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Nenhuma mudança para aplicar.'
      );
    }

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
      tipo: 'updated',
      changes,
      chainHash: null, // Will be populated by trigger
      prevChainHash: null,
    });

    await batch.commit();

    // ─── Return updated risk ──────────────────────────────────────────────

    return {
      ...existingRisk,
      ...updates,
      logicalSignature: signature,
      criadoEm: existingRisk.criadoEm.toDate?.() || existingRisk.criadoEm,
      deletadoEm: existingRisk.deletadoEm?.toDate?.() || existingRisk.deletadoEm,
      reviewDate: existingRisk.reviewDate?.toDate?.() || existingRisk.reviewDate,
    };
  },
);
