/**
 * softDeleteRisk.ts (server — risks module)
 *
 * Cloud Function callable: `risks_softDeleteRisk`
 *
 * Flow:
 *   1. assertRisksAccess (auth guard)
 *   2. validateInput (Zod)
 *   3. Fetch existing risk
 *   4. Reject if status === 'fechado' (preserve evidence)
 *   5. Atomic batch: soft-delete + audit event
 *   6. Caller sees success
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { SoftDeleteRiskInputSchema, assertRisksAccess, risksCollection } from './validators';

export const risks_softDeleteRisk = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const { labId, ...payload } = request.data;
    const auth = request.auth;

    // ─── Guards ───────────────────────────────────────────────────────────

    await assertRisksAccess(auth, labId);

    // Parse input
    let input;
    try {
      input = SoftDeleteRiskInputSchema.parse({
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

    const riskData = riskSnap.data() as any;

    // ─── Reject if status === 'fechado' (preserve evidence) ────────────────

    if (riskData.status === 'fechado') {
      throw new HttpsError(
        'failed-precondition',
        'Não é possível arquivar um risco fechado. Riscos fechados preservam evidência indefinidamente.',
      );
    }

    // ─── Atomic batch: soft-delete + audit event ──────────────────────────

    const now = admin.firestore.Timestamp.now();
    const eventRef = riskRef.collection('events').doc();

    const batch = db.batch();

    batch.update(riskRef, {
      deletadoEm: now,
    });

    batch.set(eventRef, {
      id: eventRef.id,
      timestamp: now,
      operatorId: auth!.uid,
      tipo: 'softdeleted',
      changes: { motivo: input.motivo },
      chainHash: null, // Will be populated by trigger
      prevChainHash: null,
    });

    await batch.commit();

    return {
      success: true,
      riskId: input.riskId,
      deletadoEm: now.toDate?.() || now,
    };
  },
);
