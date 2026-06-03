/**
 * registrarAvaliacaoFornecedor — grava avaliação periódica + evento em `events` (chain-hash).
 *
 * Membro ativo do laboratório (qualquer role) ou SuperAdmin.
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

const criteriosAvaliadosSchema = z.object({
  prazoEntrega: z.boolean(),
  qualidadeProduto: z.boolean(),
  documentacaoCorreta: z.boolean(),
  atendimento: z.boolean(),
});

const inputSchema = z.object({
  labId: z.string().min(1),
  fornecedorId: z.string().min(1),
  resultado: z.enum(['aprovado', 'aprovado_com_ressalva', 'reprovado']),
  criteriosAvaliados: criteriosAvaliadosSchema,
  observacoes: z.string().max(8000).optional(),
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

async function assertActiveLabMemberOrSuperAdmin(
  uid: string,
  labId: string,
  token: Record<string, unknown> | undefined,
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
}

export const registrarAvaliacaoFornecedor = onCall<
  unknown,
  Promise<{ ok: true; avaliacaoId: string }>
>(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<{ ok: true; avaliacaoId: string }> => {
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

    await assertActiveLabMemberOrSuperAdmin(uid, input.labId, token);

    const db = admin.firestore();
    const fornecedorRef = db.doc(`labs/${input.labId}/fornecedores/${input.fornecedorId}`);
    const fornecedorSnap = await fornecedorRef.get();

    if (!fornecedorSnap.exists) {
      throw new HttpsError('not-found', 'Fornecedor não encontrado.');
    }

    const nowTs = admin.firestore.Timestamp.now();
    const logicalSignature = {
      hash: input.logicalSignature.hash,
      operatorId: input.logicalSignature.operatorId,
      ts: toFirestoreTimestamp(input.logicalSignature.ts),
    };

    const responsavelNome = await resolveOperatorDisplayName(uid);
    const avaliacaoId = db.collection('_').doc().id;

    const avaliacaoDoc: Record<string, unknown> = {
      labId: input.labId,
      fornecedorId: input.fornecedorId,
      data: nowTs,
      resultado: input.resultado,
      responsavel: uid,
      responsavelNome,
      criteriosAvaliados: input.criteriosAvaliados,
      criadoEm: nowTs,
      logicalSignature,
    };
    if (input.observacoes !== undefined && input.observacoes.length > 0) {
      avaliacaoDoc.observacoes = input.observacoes;
    }

    const eventsCol = fornecedorRef.collection('events');
    const lastEventQ = await eventsCol.orderBy('timestamp', 'desc').limit(1).get();
    const prevHash = lastEventQ.empty
      ? null
      : ((lastEventQ.docs[0].data()['chainHash'] as string | undefined) ?? null);

    const eventCanon = JSON.stringify({
      tipo: 'fornecedor_avaliacao_periodica',
      operadorId: uid,
      fornecedorId: input.fornecedorId,
      avaliacaoId,
      resultado: input.resultado,
      tsMillis: nowTs.toMillis(),
    });
    const eventPayloadHash = sha256Hex(eventCanon);
    const chainHash = sha256Hex(prevHash ? `${prevHash}::${eventPayloadHash}` : eventPayloadHash);

    const eventRef = eventsCol.doc();
    const mudancas = [
      {
        campo: 'avaliacoes-periodicas',
        anterior: '—',
        novo: avaliacaoId,
      },
    ];

    const batch = db.batch();
    batch.set(fornecedorRef.collection('avaliacoes-periodicas').doc(avaliacaoId), avaliacaoDoc);
    batch.set(eventRef, {
      tipo: 'fornecedor_avaliacao_periodica' as const,
      operadorId: uid,
      timestamp: nowTs,
      mudancas,
      chainHash,
      chainHashAnterior: prevHash,
    });

    await batch.commit();
    return { ok: true, avaliacaoId };
  },
);
