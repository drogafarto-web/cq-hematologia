/**
 * registrarManutencaoRealizada — callable v2: conclui manutenção agendada com assinatura lógica.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const logicalSignatureSchema = z.object({
  hash: z
    .string()
    .length(64)
    .regex(/^[a-f0-9]{64}$/),
  operatorId: z.string().min(1),
  ts: z.unknown(),
});

const schema = z.object({
  labId: z.string().min(1),
  equipamentoId: z.string().min(1),
  manutencaoId: z.string().min(1),
  dataRealizada: z.string().datetime(),
  observacoes: z.string().optional(),
  logicalSignature: logicalSignatureSchema,
});

function toFirestoreTimestamp(ts: unknown): Timestamp {
  if (ts instanceof Timestamp) {
    return ts;
  }
  if (ts && typeof ts === 'object') {
    const o = ts as Record<string, unknown>;
    const sec = (o.seconds ?? o._seconds) as number | undefined;
    const nan = (o.nanoseconds ?? o._nanoseconds) as number | undefined;
    if (typeof sec === 'number' && typeof nan === 'number') {
      return new Timestamp(sec, nan);
    }
  }
  throw new HttpsError('invalid-argument', 'logicalSignature.ts inválido.');
}

export interface RegistrarManutencaoRealizadaOutput {
  ok: true;
}

export const registrarManutencaoRealizada = onCall<
  z.infer<typeof schema>,
  Promise<RegistrarManutencaoRealizadaOutput>
>({ region: 'southamerica-east1', cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const input = schema.parse(request.data);
  const uid = request.auth.uid;

  if (input.logicalSignature.operatorId !== uid) {
    throw new HttpsError(
      'invalid-argument',
      'logicalSignature.operatorId deve ser o usuário autenticado.',
    );
  }

  const db = admin.firestore();

  const memberDoc = await db
    .collection('labs')
    .doc(input.labId)
    .collection('members')
    .doc(uid)
    .get();

  if (!memberDoc.exists || memberDoc.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'User must be active member of lab');
  }

  const manRef = db
    .collection('labs')
    .doc(input.labId)
    .collection('equipamentos')
    .doc(input.equipamentoId)
    .collection('manutencoes')
    .doc(input.manutencaoId);

  const snap = await manRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Manutenção não encontrada.');
  }

  const current = snap.data();
  if (current?.status !== 'agendada') {
    throw new HttpsError('failed-precondition', 'Manutenção não está agendada.');
  }

  const dataRealizadaTs = Timestamp.fromDate(new Date(input.dataRealizada));
  const logicalSignature = {
    hash: input.logicalSignature.hash,
    operatorId: input.logicalSignature.operatorId,
    ts: toFirestoreTimestamp(input.logicalSignature.ts),
  };

  const update: Record<string, unknown> = {
    status: 'realizada',
    dataRealizada: dataRealizadaTs,
    logicalSignature,
    updatedAt: Timestamp.now(),
  };
  if (input.observacoes !== undefined) {
    update.observacoes = input.observacoes;
  }

  await manRef.update(update);

  return { ok: true };
});
