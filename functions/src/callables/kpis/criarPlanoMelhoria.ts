/**
 * criarPlanoMelhoria — cria documento em `labs/{labId}/planos-melhoria/{planoId}` com status `rascunho`.
 *
 * Auth: SuperAdmin ou membro ativo do laboratório (qualquer role com `active: true`).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();

const inputSchema = z.object({
  labId: z.string().min(1),
  titulo: z.string().min(1),
  descricao: z.string().min(1),
  responsavelId: z.string().min(1),
  prazoMeta: z.unknown(),
  kpiOrigemId: z.string().min(1).optional(),
});

function toFirestoreTimestamp(ts: unknown, fieldLabel: string): admin.firestore.Timestamp {
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
  throw new HttpsError('invalid-argument', `${fieldLabel} inválido.`);
}

async function assertActiveLabMemberOrSuperAdmin(
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
}

async function resolveUserDisplayName(uid: string): Promise<string> {
  const userSnap = await db.doc(`users/${uid}`).get();
  const dn = userSnap.data()?.displayName;
  return typeof dn === 'string' && dn.length > 0 ? dn : uid;
}

export const criarPlanoMelhoria = onCall<unknown, Promise<{ planoId: string }>>(
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

    await assertActiveLabMemberOrSuperAdmin(uid, input.labId, token);

    const prazoMeta = toFirestoreTimestamp(input.prazoMeta, 'prazoMeta');
    const responsavelNome = await resolveUserDisplayName(input.responsavelId);

    const col = db.collection(`labs/${input.labId}/planos-melhoria`);
    const ref = col.doc();

    const payload: Record<string, unknown> = {
      labId: input.labId,
      titulo: input.titulo,
      descricao: input.descricao,
      status: 'rascunho',
      responsavelId: input.responsavelId,
      responsavelNome,
      prazoMeta,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (input.kpiOrigemId !== undefined) {
      payload.kpiOrigemId = input.kpiOrigemId;
    }

    await ref.set(payload);

    return { planoId: ref.id };
  },
);
