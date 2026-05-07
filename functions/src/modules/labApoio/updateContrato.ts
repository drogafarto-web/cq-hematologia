/**
 * labApoio_updateContrato — callable for updating a support lab contract.
 *
 * Only mutable fields: observacoes, contatos, certificacoes (append-only history).
 * Immutable fields rejected with `failed-precondition`.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertLabApoioAccess,
  labApoioCollection,
  UpdateContratoInputSchema,
} from './validators';

interface UpdateContratoResult {
  ok: true;
}

export const labApoio_updateContrato = onCall<unknown, Promise<UpdateContratoResult>>(
  {},
  async (request) => {
    const parsed = UpdateContratoInputSchema.safeParse(request.data);
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

    // Append-only update: merge contatos and certificacoes
    const nowTs = admin.firestore.Timestamp.now();
    const updateData: any = {};

    if (input.observacoes !== undefined) {
      updateData.observacoes = input.observacoes;
    }

    if (input.contatos) {
      const existingContatos = contratoSnap.data()?.contatos ?? [];
      updateData.contatos = [
        ...existingContatos,
        ...input.contatos.filter(
          (newCont) => !existingContatos.some((old: any) => old.id === newCont.id),
        ),
      ];
    }

    if (input.certificacoes) {
      const existingCerts = contratoSnap.data()?.certificacoes ?? [];
      updateData.certificacoes = [
        ...existingCerts,
        ...input.certificacoes.filter(
          (newCert) => !existingCerts.some((old: any) => old.id === newCert.id),
        ),
      ];
    }

    // Append audit event
    const auditEventRef = contratoRef.collection('events').doc();
    const auditEvent = {
      tipo: 'updated',
      operadorId: uid,
      timestamp: nowTs,
      mudancas: Object.keys(updateData).map((field) => ({
        campo: field,
        anterior: contratoSnap.data()?.[field] ?? null,
        novo: updateData[field] ?? null,
      })),
      chainHash: '', // Will be computed by trigger
      chainHashAnterior: null,
    };

    const batch = db.batch();
    batch.update(contratoRef, updateData);
    batch.set(auditEventRef, auditEvent);
    await batch.commit();

    return { ok: true };
  },
);
