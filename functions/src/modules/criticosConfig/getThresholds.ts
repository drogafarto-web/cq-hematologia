/**
 * getThresholds.ts (server — criticos-config module)
 *
 * Cloud Function callable: `criticosConfig_getThresholds`
 *
 * Returns active thresholds for a lab, optionally filtered by analyteId,
 * ageGroup, and sex. Read access only requires lab membership (not RT/admin).
 *
 * Why server-mediated read (not client direct): this lets us inject
 * lab-level fallbacks, log lookups for audit, and gate sensitive fields.
 * Direct client read is also allowed (rules permit) but consumers should
 * prefer this callable for symmetric behavior with create/update.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  GetThresholdsInputSchema,
  assertCriticosConfigReadAccess,
  criticosConfigCollection,
} from './validators';

export const criticosConfig_getThresholds = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const { labId, ...payload } = request.data ?? {};
    const auth = request.auth;

    await assertCriticosConfigReadAccess(auth, labId);

    let input;
    try {
      input = GetThresholdsInputSchema.parse({ labId, ...payload });
    } catch (error: any) {
      throw new HttpsError(
        'invalid-argument',
        `Entrada inválida: ${error.message}`,
      );
    }

    const db = admin.firestore();
    let q: admin.firestore.Query = criticosConfigCollection(db, labId);

    if (input.analyteId) {
      q = q.where('analyteId', '==', input.analyteId);
    }
    if (input.ageGroup) {
      q = q.where('ageGroup', '==', input.ageGroup);
    }
    if (input.sex) {
      q = q.where('sex', '==', input.sex);
    }
    if (!input.includeDeleted) {
      q = q.where('deletadoEm', '==', null);
    }

    const snap = await q.get();

    const items = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        labId: data.labId,
        analyteId: data.analyteId,
        analyteName: data.analyteName,
        lowThreshold: data.lowThreshold ?? null,
        highThreshold: data.highThreshold ?? null,
        panicLow: data.panicLow ?? null,
        panicHigh: data.panicHigh ?? null,
        unit: data.unit,
        ageGroup: data.ageGroup,
        sex: data.sex,
        notas: data.notas ?? null,
        logicalSignature: data.logicalSignature,
        criadoEm: data.criadoEm?.toDate?.() ?? data.criadoEm,
        criadoPor: data.criadoPor,
        atualizadoEm: data.atualizadoEm?.toDate?.() ?? data.atualizadoEm,
        atualizadoPor: data.atualizadoPor,
        deletadoEm: data.deletadoEm?.toDate?.() ?? data.deletadoEm,
      };
    });

    return { items, count: items.length };
  },
);
