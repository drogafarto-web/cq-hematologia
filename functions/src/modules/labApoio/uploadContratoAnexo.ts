/**
 * labApoio_uploadContratoAnexo — callable for registering a contract PDF upload.
 *
 * Validates Storage path, size (<10MB), content-type (application/pdf).
 * Storage rules enforce these at upload time; callable re-validates (defense in depth).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertLabApoioAccess,
  labApoioCollection,
  UploadContratoAnexoInputSchema,
} from './validators';

interface UploadContratoAnexoResult {
  ok: true;
  url: string;
}

export const labApoio_uploadContratoAnexo = onCall<unknown, Promise<UploadContratoAnexoResult>>(
  {},
  async (request) => {
    const parsed = UploadContratoAnexoInputSchema.safeParse(request.data);
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

    // Validate path format
    const expectedPath = `labs/${input.labId}/lab-apoio/${input.contratoId}/contrato.pdf`;
    if (input.fileMeta.path !== expectedPath) {
      throw new HttpsError(
        'invalid-argument',
        `Path deve ser ${expectedPath}, recebido ${input.fileMeta.path}`,
      );
    }

    // Validate size and content-type via Storage metadata
    const bucket = admin.storage().bucket();
    const file = bucket.file(input.fileMeta.path);
    let metadata;
    try {
      [metadata] = await file.getMetadata();
    } catch (err: any) {
      throw new HttpsError(
        'not-found',
        `Arquivo não encontrado em Storage: ${input.fileMeta.path}`,
      );
    }

    const fileSize = parseInt(metadata.size as string, 10);
    const contentType = metadata.contentType as string;

    if (fileSize > 10 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'Arquivo excede 10MB.');
    }

    if (contentType !== 'application/pdf') {
      throw new HttpsError('invalid-argument', 'Apenas PDFs são permitidos.');
    }

    // Generate public URL (or signed URL for restricted access)
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
    });

    // Update contrato with PDF metadata
    const nowTs = admin.firestore.Timestamp.now();
    const auditEventRef = contratoRef.collection('events').doc();
    const auditEvent = {
      tipo: 'anexo-uploaded',
      operadorId: uid,
      timestamp: nowTs,
      mudancas: [
        {
          campo: 'anexoContratoUrl',
          anterior: contratoSnap.data()?.anexoContratoUrl ?? null,
          novo: url,
        },
      ],
      chainHash: '',
      chainHashAnterior: null,
    };

    const batch = db.batch();
    batch.update(contratoRef, {
      anexoContratoUrl: url,
      anexoContratoSize: fileSize,
    });
    batch.set(auditEventRef, auditEvent);
    await batch.commit();

    return {
      ok: true,
      url,
    };
  },
);
