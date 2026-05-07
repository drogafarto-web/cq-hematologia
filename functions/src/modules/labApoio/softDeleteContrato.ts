/**
 * labApoio_softDeleteContrato — callable for soft-deleting a support lab contract.
 *
 * RN-LABAPOIO-04: deleção lógica only (never hard-delete).
 *
 * Sets `deletadoEm = serverTimestamp()` and appends audit event with chainHash
 * continuity (resolves RN-LABAPOIO-06).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertLabApoioAccess,
  labApoioCollection,
  SoftDeleteContratoInputSchema,
} from './validators';

interface SoftDeleteContratoResult {
  ok: true;
}

export const labApoio_softDeleteContrato = onCall<unknown, Promise<SoftDeleteContratoResult>>(
  {},
  async (request) => {
    const parsed = SoftDeleteContratoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertLabApoioAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    const labApoioCol = labApoioCollection(db, input.labId);
    const contratoRef = labApoioCol.doc(input.contratoId);
    const contratoSnap = await contratoRef.get();

    if (!contratoSnap.exists) {
      throw new HttpsError('not-found', 'Contrato não encontrado.');
    }

    // Append soft-delete audit event
    const nowTs = admin.firestore.Timestamp.now();
    const auditEventRef = contratoRef.collection('events').doc();
    const auditEvent = {
      tipo: 'softdeleted',
      operadorId: uid,
      timestamp: nowTs,
      mudancas: [
        {
          campo: 'deletadoEm',
          anterior: null,
          novo: input.motivo,
        },
      ],
      chainHash: '', // Will be computed by trigger
      chainHashAnterior: null,
    };

    const batch = db.batch();
    batch.update(contratoRef, {
      deletadoEm: nowTs,
    });
    batch.set(auditEventRef, auditEvent);
    await batch.commit();

    return { ok: true };
  },
);
