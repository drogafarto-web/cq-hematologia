import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const criarTreinamento = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin && !request.auth?.token.instrutorId) {
      throw new HttpsError('permission-denied', 'Apenas admin/instrutor podem criar treinamentos');
    }

    const { labId, popId, popNome, popVersaoNumero, tipo, titulo, dataAgendada, instrutorId, duracao_minutos, participantes } = request.data;

    if (!labId || !popId || !tipo || !titulo || !dataAgendada || !instrutorId || !participantes) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
    }

    try {
      const treinamento: any = {
        labId,
        popId,
        popNome,
        popVersaoNumero,
        tipo,
        titulo,
        dataAgendada: admin.firestore.Timestamp.fromDate(new Date(dataAgendada)),
        instrutorId,
        duracao_minutos,
        participantes,
        presenca: {},
        status: 'agendado',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: request.auth.uid,
        deletadoEm: null,
      };

      const tRef = await db.collection(`labs/${labId}/treinamentos`).add(treinamento);

      return {
        success: true,
        treinamentoId: tRef.id,
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao criar treinamento');
    }
  }
);

export const registrarPresenca = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas admin podem registrar presença');
    }

    const { labId, treinamentoId, participanteId, presente } = request.data;

    if (!labId || !treinamentoId || !participanteId) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios');
    }

    try {
      const tRef = db.collection(`labs/${labId}/treinamentos`).doc(treinamentoId);
      await tRef.update({
        [`presenca.${participanteId}`]: {
          presente,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        },
      });

      return { success: true };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao registrar presença');
    }
  }
);

export const emitirCertificado = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas admin podem emitir certificados');
    }

    const { labId, treinamentoId, validadesMeses } = request.data;

    if (!labId || !treinamentoId || !validadesMeses) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios');
    }

    try {
      const numero = `CERT-${Date.now()}`;
      const agora = admin.firestore.Timestamp.now();
      const validoAte = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + validadesMeses * 30 * 24 * 60 * 60 * 1000)
      );

      const tRef = db.collection(`labs/${labId}/treinamentos`).doc(treinamentoId);
      await tRef.update({
        certificado: {
          numero,
          emitidoEm: agora,
          validoAte,
        },
        status: 'realizado',
      });

      return {
        success: true,
        numero,
        validoAte: validoAte.toDate(),
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao emitir certificado');
    }
  }
);
