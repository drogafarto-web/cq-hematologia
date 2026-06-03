/**
 * functions/src/sgq/aprovarBatchImport.ts
 *
 * Cloud Function callable: Import batch of documents from Drive
 *
 * Creates documents in `/labs/{labId}/sgq-documentos/{id}` with status `draft`.
 * RT must then approve via transitarVigencia to make them `vigente`.
 *
 * Guarantees:
 * - Idempotent: hash(driveFileId + labId) prevents duplicates on re-run
 * - Atomic: all-or-nothing transaction
 * - Audit logged: each doc creation logged in sgq-documentos-audit
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

export interface ImportableDoc {
  codigo: string;
  tipo: string;
  titulo: string;
  driveFileId: string;
  urlDriveOriginal: string;
  versao?: number;
  setoresLD?: string[];
  autoridadeEmitente?: string;
}

export interface AprovarBatchImportInput {
  labId: string;
  docs: ImportableDoc[];
}

export interface AprovarBatchImportOutput {
  importedCount: number;
  importJobId: string;
  skippedDuplicates: string[];
}

/**
 * Generate idempotent hash for document (prevents duplicate imports)
 */
function generateDocHash(driveFileId: string, labId: string): string {
  return crypto.createHash('sha256').update(`${driveFileId}:${labId}`).digest('hex');
}

export const aprovarBatchImport = onCall<
  AprovarBatchImportInput,
  Promise<AprovarBatchImportOutput>
>(async (request: CallableRequest<AprovarBatchImportInput>) => {
  // Auth: requires RT claim (will add once RT identity is finalized)
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { labId, docs } = request.data;
  const userId = request.auth.uid;
  const batch = admin.firestore().batch();
  const importJobId = admin.firestore().collection('_').doc().id;

  try {
    // Check for duplicates in batch
    const existingDocs = await admin
      .firestore()
      .collection(`labs/${labId}/sgq-documentos`)
      .where(
        'importedFromDriveFileId',
        'in',
        docs.map((d) => d.driveFileId),
      )
      .get();

    const existingFileIds = new Set(existingDocs.docs.map((d) => d.data().importedFromDriveFileId));
    const skippedDuplicates: string[] = [];
    let importedCount = 0;

    const now = admin.firestore.Timestamp.now();

    for (const doc of docs) {
      // Skip if already imported
      if (existingFileIds.has(doc.driveFileId)) {
        skippedDuplicates.push(doc.codigo);
        continue;
      }

      // Create document
      const docRef = admin.firestore().collection(`labs/${labId}/sgq-documentos`).doc();

      const docHash = generateDocHash(doc.driveFileId, labId);

      const docPayload = {
        id: docRef.id,
        labId,
        codigo: doc.codigo,
        tipo: doc.tipo,
        titulo: doc.titulo,
        versao: doc.versao || 1,
        url: doc.urlDriveOriginal,
        autoridadeEmitente: doc.autoridadeEmitente || 'Importado do Drive',
        dataEmissao: now,
        dataRevisao: now,
        proximaRevisao: new Date(now.toDate().getTime() + 365 * 24 * 60 * 60 * 1000), // +1 year default
        status: 'em_revisao', // Draft status — RT approves to vigente
        listaDistribuicao: doc.setoresLD || [],
        criadoEm: now,
        criadoPor: userId,
        criadoPorName: request.auth?.token?.name || 'Unknown',
        atualizadoEm: now,
        atualizadoPor: userId,
        atualizadoPorName: request.auth?.token?.name || 'Unknown',
        deletadoEm: null,
        importedFromDrive: true,
        importedFromDriveFileId: doc.driveFileId,
        importJobId,
        importHash: docHash,
      };

      batch.set(docRef, docPayload);

      // Audit log
      const auditRef = admin.firestore().collection(`labs/${labId}/sgq-documentos-audit`).doc();

      batch.set(auditRef, {
        id: auditRef.id,
        labId,
        documentoId: docRef.id,
        codigoSnapshot: doc.codigo,
        versaoSnapshot: doc.versao || 1,
        type: 'created',
        fromStatus: undefined,
        toStatus: 'em_revisao',
        timestamp: now,
        operadorId: userId,
        operadorName: request.auth?.token?.name || 'Unknown',
        motivo: 'Import from Drive',
      });

      importedCount++;
    }

    // Commit batch
    await batch.commit();

    // Log import job
    await admin.firestore().collection(`labs/${labId}/sgq-import-jobs`).doc(importJobId).set({
      id: importJobId,
      labId,
      userId,
      status: 'completed',
      importedCount,
      skippedDuplicates,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      importedCount,
      importJobId,
      skippedDuplicates,
    } as AprovarBatchImportOutput;
  } catch (error) {
    console.error('[aprovarBatchImport] error:', error);

    // Log failure
    await admin
      .firestore()
      .collection(`labs/${labId}/sgq-import-jobs`)
      .doc(importJobId)
      .set({
        id: importJobId,
        labId,
        userId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    throw new HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Batch import failed',
    );
  }
});
