/**
 * atualizarAcaoMelhoria — atualiza `status` e opcionalmente `evidencia` em
 * `labs/{labId}/planos-melhoria/{planoId}/acoes/{acaoId}`.
 *
 * Auth: SuperAdmin ou membro ativo do laboratório.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();

const acaoStatusSchema = z.enum(['pendente', 'em_andamento', 'concluida', 'cancelada']);

const inputSchema = z.object({
  labId: z.string().min(1),
  planoId: z.string().min(1),
  acaoId: z.string().min(1),
  status: acaoStatusSchema,
  evidencia: z.string().min(1).max(8000).optional(),
});

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

function hasPrazoField(data: Record<string, unknown> | undefined): boolean {
  if (!data || !('prazo' in data)) {
    return false;
  }
  const p = data.prazo;
  if (p == null) {
    return false;
  }
  if (p instanceof admin.firestore.Timestamp) {
    return true;
  }
  if (typeof p === 'object') {
    const o = p as Record<string, unknown>;
    const sec = (o.seconds ?? o._seconds) as number | undefined;
    const nan = (o.nanoseconds ?? o._nanoseconds) as number | undefined;
    return typeof sec === 'number' && typeof nan === 'number';
  }
  return false;
}

export const atualizarAcaoMelhoria = onCall<unknown, Promise<{ ok: true }>>(
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

    const acaoRef = db.doc(
      `labs/${input.labId}/planos-melhoria/${input.planoId}/acoes/${input.acaoId}`,
    );
    const snap = await acaoRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Ação não encontrada.');
    }

    const data = snap.data() as Record<string, unknown> | undefined;
    if (!hasPrazoField(data)) {
      throw new HttpsError('failed-precondition', 'Documento da ação sem campo prazo válido.');
    }

    const update: Record<string, unknown> = {
      status: input.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (input.evidencia !== undefined) {
      update.evidencia = input.evidencia;
    }

    await acaoRef.update(update);

    return { ok: true };
  },
);
