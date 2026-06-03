/**
 * definirMetaKPI — desativa metas ativas do mesmo tipo e cria nova meta em
 * `labs/{labId}/kpi-metas/{metaId}` (Admin SDK; client rules seguem read-only para writes regulatórios).
 *
 * Auth: SuperAdmin ou membro ativo com role `admin` | `owner`.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();

const inputSchema = z.object({
  labId: z.string().min(1),
  tipoKPI: z.string().min(1),
  valor: z.number().finite(),
  unidade: z.enum(['percent', 'hours', 'count']),
  vigenciaInicio: z.unknown(),
  vigenciaFim: z.unknown().optional(),
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

async function resolveOperatorDisplayName(uid: string): Promise<string> {
  const userSnap = await db.doc(`users/${uid}`).get();
  const dn = userSnap.data()?.displayName;
  return typeof dn === 'string' && dn.length > 0 ? dn : uid;
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
      'Apenas administradores do laboratório podem definir metas de KPI.',
    );
  }
}

export const definirMetaKPI = onCall<unknown, Promise<{ ok: true; metaId: string }>>(
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

    await assertLabAdminOrSuperAdmin(uid, input.labId, token);

    const vigenciaInicio = toFirestoreTimestamp(input.vigenciaInicio, 'vigenciaInicio');
    const vigenciaFimOpt =
      input.vigenciaFim === undefined || input.vigenciaFim === null
        ? undefined
        : toFirestoreTimestamp(input.vigenciaFim, 'vigenciaFim');

    if (vigenciaFimOpt !== undefined && vigenciaFimOpt.toMillis() < vigenciaInicio.toMillis()) {
      throw new HttpsError('invalid-argument', 'vigenciaFim deve ser >= vigenciaInicio.');
    }

    const definidoPorNome = await resolveOperatorDisplayName(uid);
    const col = db.collection(`labs/${input.labId}/kpi-metas`);
    const now = admin.firestore.Timestamp.now();

    let metaId = '';

    await db.runTransaction(async (tx) => {
      const q = col.where('tipoKPI', '==', input.tipoKPI).limit(50);
      const snap = await tx.get(q);
      for (const doc of snap.docs) {
        const d = doc.data();
        if (d?.ativo === true) {
          tx.update(doc.ref, { ativo: false, vigenciaFim: now });
        }
      }

      const newRef = col.doc();
      metaId = newRef.id;

      const payload: Record<string, unknown> = {
        labId: input.labId,
        tipoKPI: input.tipoKPI,
        valor: input.valor,
        unidade: input.unidade,
        vigenciaInicio,
        definidoPor: uid,
        definidoPorNome,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        ativo: true,
      };
      if (vigenciaFimOpt !== undefined) {
        payload.vigenciaFim = vigenciaFimOpt;
      }

      tx.set(newRef, payload);
    });

    return { ok: true, metaId };
  },
);
