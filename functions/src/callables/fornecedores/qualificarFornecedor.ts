/**
 * qualificarFornecedor — grava `qualificacao` no doc do fornecedor + evento em `events`.
 *
 * Primeira qualificação: admin ou owner (ou SuperAdmin).
 * Substituição se já existir `qualificacao`: apenas RT (ou SuperAdmin).
 */

import { createHash } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const logicalSignatureSchema = z.object({
  hash: z.string().length(64),
  operatorId: z.string().min(1),
  ts: z.unknown(),
});

const inputSchema = z.object({
  labId: z.string().min(1),
  fornecedorId: z.string().min(1),
  criteriosDocumentados: z.string().min(1),
  categorias: z.array(z.string()),
  logicalSignature: logicalSignatureSchema,
});

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function toFirestoreTimestamp(ts: unknown): admin.firestore.Timestamp {
  if (ts instanceof admin.firestore.Timestamp) {
    return ts;
  }
  if (ts && typeof ts === 'object') {
    const o = ts as Record<string, unknown>;
    const sec = (o.seconds ?? o._seconds) as number | undefined;
    const nan = (o.nanoseconds ?? o._nanoseconds) as number | undefined;
    if (typeof sec === 'number' && typeof nan === 'number') {
      return new admin.firestore.Timestamp(sec, nan);
    }
  }
  throw new HttpsError('invalid-argument', 'logicalSignature.ts inválido.');
}

async function resolveOperatorDisplayName(uid: string): Promise<string> {
  const userSnap = await admin.firestore().doc(`users/${uid}`).get();
  const dn = userSnap.data()?.displayName;
  return typeof dn === 'string' && dn.length > 0 ? dn : uid;
}

async function assertQualificacaoAuth(
  uid: string,
  labId: string,
  token: Record<string, unknown> | undefined,
  replacingExisting: boolean,
): Promise<void> {
  if (token?.isSuperAdmin === true) {
    return;
  }
  const userSnap = await admin.firestore().doc(`users/${uid}`).get();
  if (userSnap.data()?.isSuperAdmin === true) {
    return;
  }

  const memberSnap = await admin.firestore().doc(`labs/${labId}/members/${uid}`).get();
  if (!memberSnap.exists || memberSnap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Acesso negado.');
  }
  const role = memberSnap.data()?.role as string | undefined;

  if (replacingExisting) {
    if (role !== 'RT') {
      throw new HttpsError(
        'permission-denied',
        'Somente o RT pode substituir qualificação já registrada.',
      );
    }
    return;
  }

  if (role !== 'admin' && role !== 'owner') {
    throw new HttpsError(
      'permission-denied',
      'Apenas administradores do laboratório podem qualificar o fornecedor.',
    );
  }
}

export const qualificarFornecedor = onCall<unknown, Promise<{ ok: true }>>(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;
    const uid = request.auth.uid;
    const token = request.auth.token as Record<string, unknown> | undefined;

    if (input.logicalSignature.operatorId !== uid) {
      throw new HttpsError(
        'invalid-argument',
        'logicalSignature.operatorId deve ser o usuário autenticado.',
      );
    }

    const db = admin.firestore();
    const fornecedorRef = db.doc(`labs/${input.labId}/fornecedores/${input.fornecedorId}`);
    const fornecedorSnap = await fornecedorRef.get();

    if (!fornecedorSnap.exists) {
      throw new HttpsError('not-found', 'Fornecedor não encontrado.');
    }

    const existingQual = fornecedorSnap.data()?.qualificacao;
    const replacingExisting = Boolean(existingQual);

    await assertQualificacaoAuth(uid, input.labId, token, replacingExisting);

    const nowTs = admin.firestore.Timestamp.now();
    const logicalSignature = {
      hash: input.logicalSignature.hash,
      operatorId: input.logicalSignature.operatorId,
      ts: toFirestoreTimestamp(input.logicalSignature.ts),
    };

    const qualificadoPorNome = await resolveOperatorDisplayName(uid);

    const qualificacao = {
      qualificadoEm: nowTs,
      qualificadoPor: uid,
      qualificadoPorNome,
      criteriosDocumentados: input.criteriosDocumentados,
      categorias: input.categorias,
      logicalSignature,
    };

    const batch = db.batch();
    batch.update(fornecedorRef, {
      qualificacao,
      categorias: input.categorias,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    });

    const eventRef = fornecedorRef.collection('events').doc();
    const mudancas = { qualificacao: replacingExisting ? 'substituida' : 'criada' };
    const firstEventPayload = {
      labId: input.labId,
      fornecedorId: input.fornecedorId,
      mudancas,
      tipo: replacingExisting ? 'fornecedor_qualificacao_substituida' : 'fornecedor_qualificado',
    };
    const firstEventHash = sha256Hex(JSON.stringify(firstEventPayload));

    batch.set(eventRef, {
      tipo: replacingExisting ? 'fornecedor_qualificacao_substituida' : 'fornecedor_qualificado',
      operadorId: uid,
      timestamp: nowTs,
      mudancas,
      chainHash: firstEventHash,
      chainHashAnterior: null,
    });

    await batch.commit();
    return { ok: true };
  },
);
