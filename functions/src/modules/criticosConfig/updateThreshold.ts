/**
 * updateThreshold.ts (server — criticos-config module)
 *
 * Cloud Function callable: `criticosConfig_updateThreshold`
 *
 * Mutable fields: lowThreshold, highThreshold, panicLow, panicHigh, unit, notas
 * Immutable fields (rejected if attempted): analyteId, ageGroup, sex, labId,
 *   criadoEm, criadoPor, criadoPorRole, id, logicalSignature.
 *
 * Why immutability matters: changing analyteId/ageGroup/sex mid-life would
 * silently re-key the threshold, invalidating any historical reference. If
 * a clinician needs different values for a different demographic, they
 * create a NEW threshold and soft-delete this one (audit-clear).
 *
 * To clear a numeric bound, send `null` (distinct from "not provided" =
 * `undefined`). The server treats `null` as an explicit clear.
 *
 * Atomic batch: threshold update + audit event with field-level diff.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  UpdateThresholdInputSchema,
  assertCriticosConfigWriteAccess,
  criticosConfigCollection,
} from './validators';
import { generateCriticosConfigSignature } from './signatureCanonical';

const NUMERIC_FIELDS = ['lowThreshold', 'highThreshold', 'panicLow', 'panicHigh'] as const;

export const criticosConfig_updateThreshold = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const { labId, ...payload } = request.data ?? {};
    const auth = request.auth;

    const { uid, role } = await assertCriticosConfigWriteAccess(auth, labId);

    let input;
    try {
      input = UpdateThresholdInputSchema.parse({ labId, ...payload });
    } catch (error: any) {
      throw new HttpsError('invalid-argument', `Entrada inválida: ${error.message}`);
    }

    const db = admin.firestore();
    const thresholdRef = criticosConfigCollection(db, labId).doc(input.thresholdId);

    const snap = await thresholdRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Threshold não encontrado.');
    }
    const existing = snap.data() as any;

    if (existing.deletadoEm) {
      throw new HttpsError(
        'failed-precondition',
        'Threshold já foi excluído (soft-delete). Crie um novo.',
      );
    }

    // ─── Build update + diff with combined-bounds validation ─────────────────
    const updates: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const field of NUMERIC_FIELDS) {
      const incoming = (input as any)[field];
      if (incoming === undefined) continue;
      // null = explicit clear; number = explicit set
      const newValue: number | null = incoming === null ? null : Number(incoming);
      if (existing[field] !== newValue) {
        updates[field] = newValue;
        changes[field] = { from: existing[field] ?? null, to: newValue };
      }
    }

    if (input.unit !== undefined && input.unit !== existing.unit) {
      updates.unit = input.unit;
      changes.unit = { from: existing.unit, to: input.unit };
    }

    if (input.notas !== undefined) {
      const newNotas = input.notas === null ? null : input.notas;
      if (newNotas !== (existing.notas ?? null)) {
        updates.notas = newNotas;
        changes.notas = { from: existing.notas ?? null, to: newNotas };
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new HttpsError('failed-precondition', 'Nenhuma mudança para aplicar.');
    }

    // ─── Re-validate bounds against the merged final state ───────────────────
    const finalLow =
      updates.lowThreshold !== undefined
        ? (updates.lowThreshold as number | null)
        : (existing.lowThreshold as number | null);
    const finalHigh =
      updates.highThreshold !== undefined
        ? (updates.highThreshold as number | null)
        : (existing.highThreshold as number | null);
    const finalPLow =
      updates.panicLow !== undefined
        ? (updates.panicLow as number | null)
        : (existing.panicLow as number | null);
    const finalPHigh =
      updates.panicHigh !== undefined
        ? (updates.panicHigh as number | null)
        : (existing.panicHigh as number | null);

    if (finalLow !== null && finalHigh !== null && finalLow > finalHigh) {
      throw new HttpsError('invalid-argument', 'lowThreshold deve ser ≤ highThreshold.');
    }
    if (finalPLow !== null && finalLow !== null && finalPLow > finalLow) {
      throw new HttpsError('invalid-argument', 'panicLow deve ser ≤ lowThreshold.');
    }
    if (finalPHigh !== null && finalHigh !== null && finalPHigh < finalHigh) {
      throw new HttpsError('invalid-argument', 'panicHigh deve ser ≥ highThreshold.');
    }
    if (finalPLow !== null && finalPHigh !== null && finalPLow > finalPHigh) {
      throw new HttpsError('invalid-argument', 'panicLow deve ser ≤ panicHigh.');
    }
    if (finalLow === null && finalHigh === null && finalPLow === null && finalPHigh === null) {
      throw new HttpsError(
        'invalid-argument',
        'Threshold não pode ficar sem nenhum limite definido.',
      );
    }

    // ─── New signature over final state ──────────────────────────────────────
    const now = admin.firestore.Timestamp.now();
    const signaturePayload: Record<string, string | number | boolean | null> = {
      labId,
      analyteId: existing.analyteId,
      lowThreshold: finalLow,
      highThreshold: finalHigh,
      panicLow: finalPLow,
      panicHigh: finalPHigh,
      unit: (updates.unit as string | undefined) ?? existing.unit,
      ageGroup: existing.ageGroup,
      sex: existing.sex,
    };
    const signature = generateCriticosConfigSignature(uid, signaturePayload, now);

    updates.logicalSignature = signature;
    updates.atualizadoEm = now;
    updates.atualizadoPor = uid;

    const eventRef = thresholdRef.collection('events').doc();

    const batch = db.batch();
    batch.update(thresholdRef, updates);
    batch.set(eventRef, {
      id: eventRef.id,
      timestamp: now,
      operatorId: uid,
      operatorRole: role,
      tipo: 'updated',
      changes,
      payloadHash: signature.hash,
    });

    await batch.commit();

    return {
      id: input.thresholdId,
      labId,
      analyteId: existing.analyteId,
      analyteName: existing.analyteName,
      lowThreshold: finalLow,
      highThreshold: finalHigh,
      panicLow: finalPLow,
      panicHigh: finalPHigh,
      unit: signaturePayload.unit,
      ageGroup: existing.ageGroup,
      sex: existing.sex,
      notas: updates.notas !== undefined ? updates.notas : (existing.notas ?? null),
      logicalSignature: signature,
      criadoEm: existing.criadoEm.toDate?.() ?? existing.criadoEm,
      atualizadoEm: now.toDate(),
      deletadoEm: null,
    };
  },
);
