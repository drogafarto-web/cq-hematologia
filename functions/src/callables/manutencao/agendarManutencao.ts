/**
 * agendarManutencao — callable v2: cria manutenção preventiva/corretiva agendada.
 *
 * Firestore: `/labs/{labId}/equipamentos/{equipamentoId}/manutencoes/{id}`
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const schema = z.object({
  labId: z.string().min(1),
  equipamentoId: z.string().min(1),
  tipo: z.enum(['preventiva', 'corretiva']),
  descricao: z.string().min(5),
  responsavelId: z.string().min(1),
  responsavelNome: z.string().min(1),
  dataPrevista: z.string().datetime(),
  observacoes: z.string().optional(),
});

export interface AgendarManutencaoOutput {
  manutencaoId: string;
}

export const agendarManutencao = onCall<z.infer<typeof schema>, Promise<AgendarManutencaoOutput>>(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<AgendarManutencaoOutput> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const input = schema.parse(request.data);
    const { labId, equipamentoId, tipo, descricao, responsavelId, responsavelNome, observacoes } =
      input;

    const uid = request.auth.uid;

    const db = admin.firestore();

    const memberDoc = await db
      .collection('labs')
      .doc(labId)
      .collection('members')
      .doc(uid)
      .get();

    if (!memberDoc.exists || memberDoc.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'User must be active member of lab');
    }

    const equipRef = db.collection('labs').doc(labId).collection('equipamentos').doc(equipamentoId);
    const equipSnap = await equipRef.get();
    if (!equipSnap.exists) {
      throw new HttpsError('not-found', 'Equipamento not found');
    }

    const dataPrevistaTs = Timestamp.fromDate(new Date(input.dataPrevista));
    const now = Timestamp.now();
    const manutencaoId = uuid();

    const payload: Record<string, unknown> = {
      id: manutencaoId,
      labId,
      equipamentoId,
      tipo,
      descricao,
      responsavelId,
      responsavelNome,
      dataPrevista: dataPrevistaTs,
      status: 'agendada',
      criadoEm: now,
      updatedAt: now,
    };
    if (observacoes !== undefined && observacoes.length > 0) {
      payload.observacoes = observacoes;
    }

    await equipRef.collection('manutencoes').doc(manutencaoId).set(payload);

    return { manutencaoId };
  },
);
