/**
 * vincularNcAoRisco.ts — callable `risks_vincularNcAoRisco`
 *
 * Adiciona NC ou CAPA ao risco via `arrayUnion` em `ncIds` / `capaIds` e grava evento de auditoria.
 */

import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  assertRisksAccess,
  risksCollection,
  VincularNcAoRiscoInputSchema,
} from './validators';

export const risks_vincularNcAoRisco = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const { labId, ...payload } = request.data;
    const auth = request.auth;

    await assertRisksAccess(auth, labId);
    const uid = auth!.uid;

    let input: ReturnType<typeof VincularNcAoRiscoInputSchema.parse>;
    try {
      input = VincularNcAoRiscoInputSchema.parse({ labId, ...payload });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpsError('invalid-argument', `Entrada inválida: ${msg}`);
    }

    const db = admin.firestore();
    const riskRef = risksCollection(db, labId).doc(input.riskId);
    const snap = await riskRef.get();

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Risco não encontrado.');
    }

    const risk = snap.data() as Record<string, unknown>;
    if (risk['deletadoEm'] != null) {
      throw new HttpsError('failed-precondition', 'Risco arquivado — não é possível vincular.');
    }

    const now = admin.firestore.Timestamp.now();
    const updates: Record<string, unknown> = {};
    const eventIds: string[] = [];

    if (input.ncId) {
      updates.ncIds = FieldValue.arrayUnion(input.ncId);
    }
    if (input.capaId) {
      updates.capaIds = FieldValue.arrayUnion(input.capaId);
    }

    if (Object.keys(updates).length === 0) {
      throw new HttpsError('invalid-argument', 'Nada a vincular.');
    }

    const batch = db.batch();
    batch.update(riskRef, updates);

    let tsCursor = now.toMillis();

    if (input.ncId) {
      const eventRef = riskRef.collection('events').doc();
      batch.set(eventRef, {
        id: eventRef.id,
        timestamp: admin.firestore.Timestamp.fromMillis(tsCursor),
        operatorId: uid,
        tipo: 'vincular_nc',
        changes: { ncId: input.ncId },
        chainHash: null,
        prevChainHash: null,
      });
      eventIds.push(eventRef.id);
      tsCursor += 1;
    }

    if (input.capaId) {
      const eventRef = riskRef.collection('events').doc();
      batch.set(eventRef, {
        id: eventRef.id,
        timestamp: admin.firestore.Timestamp.fromMillis(tsCursor),
        operatorId: uid,
        tipo: 'vincular_capa',
        changes: { capaId: input.capaId },
        chainHash: null,
        prevChainHash: null,
      });
      eventIds.push(eventRef.id);
    }

    await batch.commit();

    logger.info('risks_vincularNcAoRisco', {
      labId,
      riskId: input.riskId,
      eventCount: eventIds.length,
    });

    return { ok: true, eventIds };
  },
);
