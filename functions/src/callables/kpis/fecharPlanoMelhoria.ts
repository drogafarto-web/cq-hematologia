/**
 * fecharPlanoMelhoria — transição `ativo` → `concluido` em
 * `labs/{labId}/planos-melhoria/{planoId}` com assinatura lógica.
 *
 * Auth: SuperAdmin ou membro ativo com role `admin` | `owner`.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();

const logicalSignatureSchema = z.object({
  hash: z.string().length(64),
  operatorId: z.string().min(1),
  ts: z.unknown(),
});

const inputSchema = z.object({
  labId: z.string().min(1),
  planoId: z.string().min(1),
  logicalSignature: logicalSignatureSchema,
});

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

async function assertLabAdminOrSuperAdmin(
  uid: string,
  labId: string,
  token: Record<string, unknown> | undefined,
): Promise<void> {
  if (token?.isSuperAdmin === true) {
    return;
  }
  const userSnap = await db.doc(`users/${uid}`).get();
  if (userSnap.data()?.isSuperAdmin === true) {
    return;
  }

  const memberSnap = await db.doc(`labs/${labId}/members/${uid}`).get();
  if (!memberSnap.exists || memberSnap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Acesso negado.');
  }
  const role = memberSnap.data()?.role as string | undefined;
  if (role !== 'admin' && role !== 'owner') {
    throw new HttpsError(
      'permission-denied',
      'Apenas administradores do laboratório podem fechar o plano de melhoria.',
    );
  }
}

export const fecharPlanoMelhoria = onCall<unknown, Promise<{ ok: true }>>(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
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

    await assertLabAdminOrSuperAdmin(uid, input.labId, token);

    const planoRef = db.doc(`labs/${input.labId}/planos-melhoria/${input.planoId}`);
    const planoSnap = await planoRef.get();

    if (!planoSnap.exists) {
      throw new HttpsError('not-found', 'Plano de melhoria não encontrado.');
    }

    const data = planoSnap.data();
    const labIdOnDoc = data?.labId as string | undefined;
    if (labIdOnDoc !== undefined && labIdOnDoc !== input.labId) {
      throw new HttpsError('permission-denied', 'Laboratório inconsistente com o documento.');
    }

    if (data?.status !== 'ativo') {
      throw new HttpsError(
        'failed-precondition',
        'Só é possível fechar um plano com status ativo.',
      );
    }

    const logicalSignature = {
      hash: input.logicalSignature.hash,
      operatorId: input.logicalSignature.operatorId,
      ts: toFirestoreTimestamp(input.logicalSignature.ts),
    };

    const conclusaoEm = admin.firestore.Timestamp.now();

    await planoRef.update({
      status: 'concluido',
      conclusaoEm,
      logicalSignature,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  },
);
