import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Fornecedor } from './types';

const db = admin.firestore();

/**
 * Create or update Fornecedor (Supplier/Vendor)
 * Callable by SuperAdmin or lab admin
 */
export const upsertFornecedor = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Autenticação necessária');
  }

  const { labId, fornecedorId, razaoSocial, cnpj, status, evidencias, categoriasFornecidas } =
    request.data;

  if (!labId || !razaoSocial || !cnpj) {
    throw new functions.HttpsError('invalid-argument', 'labId, razaoSocial, cnpj obrigatórios');
  }

  const docRef = fornecedorId
    ? db.doc(`labs/${labId}/fornecedores/${fornecedorId}`)
    : db.collection(`labs/${labId}/fornecedores`).doc();

  const fornecedor: Partial<Fornecedor> = {
    razaoSocial,
    cnpj,
    status: status || 'pendente',
    categoriasFornecidas: categoriasFornecidas || [],
    evidencias: evidencias || [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
    updatedBy: request.auth.uid,
  };

  if (!fornecedorId) {
    fornecedor.createdAt = admin.firestore.FieldValue.serverTimestamp() as any;
    fornecedor.createdBy = request.auth.uid;
  }

  await docRef.set(fornecedor, { merge: true });

  return { success: true, fornecedorId: docRef.id };
});

/**
 * Verify if Fornecedor is qualified for receiving materials
 * Used in NF reception workflow
 */
export async function isFornecedorQualificado(
  labId: string,
  fornecedorId: string,
): Promise<{ qualified: boolean; reason?: string }> {
  const snap = await db.doc(`labs/${labId}/fornecedores/${fornecedorId}`).get();

  if (!snap.exists) {
    return { qualified: false, reason: 'Fornecedor não encontrado' };
  }

  const fornecedor = snap.data() as Fornecedor;

  if (fornecedor.status !== 'qualificado') {
    return {
      qualified: false,
      reason: `Status: ${fornecedor.status}. Requalificar antes de receber.`,
    };
  }

  // Check requalification deadline
  if (
    fornecedor.proximaRequalificacao &&
    new Date(fornecedor.proximaRequalificacao.toDate()) < new Date()
  ) {
    return {
      qualified: false,
      reason: 'Requalificação vencida. Contate o fornecedor.',
    };
  }

  return { qualified: true };
}
