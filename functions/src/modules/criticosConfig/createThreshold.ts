/**
 * createThreshold.ts (server — criticos-config module)
 *
 * Cloud Function callable: `criticosConfig_createThreshold`
 *
 * Flow:
 *   1. assertCriticosConfigWriteAccess (auth + role guard: rt/admin/owner)
 *   2. Validate input (Zod) + bounds (panicLow ≤ low ≤ high ≤ panicHigh)
 *   3. Enforce uniqueness of (analyteId, ageGroup, sex) per lab — only one
 *      active threshold can exist for a given combination.
 *   4. Generate server-side LogicalSignature
 *   5. Atomic batch: threshold doc + audit event
 *
 * Compliance: RDC 978/2025 Art. 167, DICQ 5.7.1.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  CreateThresholdInputSchema,
  assertCriticosConfigWriteAccess,
  criticosConfigCollection,
  ensureCriticosConfigLabRoot,
} from './validators';
import { generateCriticosConfigSignature } from './signatureCanonical';

export const criticosConfig_createThreshold = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const { labId, ...payload } = request.data ?? {};
    const auth = request.auth;

    const { uid, role } = await assertCriticosConfigWriteAccess(auth, labId);

    let input;
    try {
      input = CreateThresholdInputSchema.parse({ labId, ...payload });
    } catch (error: any) {
      throw new HttpsError(
        'invalid-argument',
        `Entrada inválida: ${error.message}`,
      );
    }

    const db = admin.firestore();

    // ─── Uniqueness: (analyteId, ageGroup, sex) per lab ──────────────────────
    const existingSnap = await criticosConfigCollection(db, labId)
      .where('analyteId', '==', input.analyteId)
      .where('ageGroup', '==', input.ageGroup)
      .where('sex', '==', input.sex)
      .where('deletadoEm', '==', null)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new HttpsError(
        'failed-precondition',
        `Já existe threshold ativo para ${input.analyteId} (${input.ageGroup}/${input.sex}). ` +
          `Edite o existente em vez de criar um duplicado.`,
      );
    }

    const now = admin.firestore.Timestamp.now();

    // ─── Signature payload (only domain fields, ordered by sortedStringify) ──
    const signaturePayload: Record<string, string | number | boolean | null> = {
      labId,
      analyteId: input.analyteId,
      lowThreshold: input.lowThreshold ?? null,
      highThreshold: input.highThreshold ?? null,
      panicLow: input.panicLow ?? null,
      panicHigh: input.panicHigh ?? null,
      unit: input.unit,
      ageGroup: input.ageGroup,
      sex: input.sex,
    };

    const signature = generateCriticosConfigSignature(uid, signaturePayload, now);

    // ─── Atomic write: threshold + audit event ───────────────────────────────
    await ensureCriticosConfigLabRoot(db, labId);

    const thresholdRef = criticosConfigCollection(db, labId).doc();
    const eventRef = thresholdRef.collection('events').doc();

    const docData = {
      id: thresholdRef.id,
      labId,
      analyteId: input.analyteId,
      analyteName: input.analyteName,
      lowThreshold: input.lowThreshold ?? null,
      highThreshold: input.highThreshold ?? null,
      panicLow: input.panicLow ?? null,
      panicHigh: input.panicHigh ?? null,
      unit: input.unit,
      ageGroup: input.ageGroup,
      sex: input.sex,
      notas: input.notas ?? null,
      logicalSignature: signature,
      criadoEm: now,
      criadoPor: uid,
      criadoPorRole: role,
      atualizadoEm: now,
      atualizadoPor: uid,
      deletadoEm: null,
      deletadoPor: null,
    };

    const batch = db.batch();

    batch.set(thresholdRef, docData);

    batch.set(eventRef, {
      id: eventRef.id,
      timestamp: now,
      operatorId: uid,
      operatorRole: role,
      tipo: 'created',
      changes: null,
      payloadHash: signature.hash,
    });

    await batch.commit();

    return {
      ...docData,
      criadoEm: now.toDate(),
      atualizadoEm: now.toDate(),
      deletadoEm: null,
    };
  },
);
