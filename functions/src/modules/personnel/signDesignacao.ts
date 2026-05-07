/**
 * functions/src/modules/personnel/signDesignacao.ts
 *
 * Cloud Function callable: Sign a Designação (appointment) with LogicalSignature.
 * Server-side hash generation + atomic Firestore write.
 *
 * DICQ 4.1.2.7 · RDC 978 Art. 122 · LGPD Art. 18
 */

import { https } from 'firebase-functions';
import { admin, db } from '../../firebase';
import { createHash } from 'crypto';
import type { SignDesignacaoPayload, SignDesignacaoResult, LogicalSignature } from '../../../src/features/personnel/types';

/**
 * Generate LogicalSignature (SHA-256 hash + operatorId + timestamp).
 */
function generateLogicalSignature(
  payload: SignDesignacaoPayload,
  operatorId: string,
  ts: number
): LogicalSignature {
  const input = `${payload.labId}|${payload.cargoId}|${payload.pessoaId}|${payload.pessoaNome}|${operatorId}|${ts}`;
  const hash = createHash('sha256').update(input).digest('hex');

  return {
    hash,
    operatorId,
    ts: admin.firestore.Timestamp.fromMillis(ts),
  };
}

export const signDesignacao = https.onCall(async (data: unknown, context) => {
  if (!context.auth) {
    throw new https.HttpsError('unauthenticated', 'User not authenticated');
  }

  const operatorId = context.auth.uid;
  const payload = data as SignDesignacaoPayload;

  if (!payload.labId || !payload.cargoId || !payload.pessoaId || !payload.pessoaNome) {
    throw new https.HttpsError('invalid-argument', 'Missing required fields');
  }

  if (payload.dataInicio <= 0) {
    throw new https.HttpsError('invalid-argument', 'Invalid dataInicio');
  }

  if (!payload.descricaoAutoridade || payload.descricaoAutoridade.trim().length === 0) {
    throw new https.HttpsError('invalid-argument', 'descricaoAutoridade cannot be empty');
  }

  const memberRef = db.collection('labs').doc(payload.labId).collection('members').doc(operatorId);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists || memberSnap.data()?.active !== true) {
    throw new https.HttpsError('permission-denied', 'User is not an active member of this lab');
  }

  const userCustomClaims = context.auth.token as any;
  const moduleAccess = userCustomClaims.modules?.personnel === true;
  const roleCheck = ['admin', 'owner', 'rt'].includes(memberSnap.data()?.role);

  if (!moduleAccess && !roleCheck) {
    throw new https.HttpsError('permission-denied', 'User does not have permission to sign designações');
  }

  const now = Date.now();
  const signature = generateLogicalSignature(payload, operatorId, now);

  const designacaoId = db.collection('personnel').doc(payload.labId).collection('designacoes').doc().id;
  const designacaoRef = db
    .collection('personnel')
    .doc(payload.labId)
    .collection('designacoes')
    .doc(designacaoId);

  const designacaoDoc = {
    labId: payload.labId,
    cargoId: payload.cargoId,
    pessoaId: payload.pessoaId,
    pessoaNome: payload.pessoaNome,
    dataInicio: admin.firestore.Timestamp.fromMillis(payload.dataInicio),
    dataFim: payload.dataFim
      ? admin.firestore.Timestamp.fromMillis(payload.dataFim)
      : null,
    descricaoAutoridade: payload.descricaoAutoridade,
    successorId: payload.successorId || null,
    chainHash: {
      hash: signature.hash,
      operatorId: signature.operatorId,
      ts: signature.ts,
    },
    certificadoUrl: null,
    criadoEm: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    deletadoEm: null,
  };

  await designacaoRef.set(designacaoDoc);

  const auditRef = designacaoRef.collection('auditLog').doc();
  await auditRef.set({
    action: 'created',
    operatorId,
    ts: admin.firestore.Timestamp.now(),
    designacaoId,
    pessoaNome: payload.pessoaNome,
    cargoId: payload.cargoId,
  });

  const result: SignDesignacaoResult = {
    designacaoId,
    signature,
    success: true,
  };

  return result;
});
