import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { NaoConformidade } from './types';
import { signAuditEntry } from '../audit/cryptoAudit';

const db = admin.firestore();

export const investigarNC = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.responsavelTecnico && !request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas RT pode investigar NC');
    }

    const { labId, ncId, descricao, achados } = request.data;

    if (!labId || !ncId || !descricao) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, ncId, descricao');
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not set');

      const ncRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
      const ncSnap = await ncRef.get();

      if (!ncSnap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrado`);
      }

      const nc = ncSnap.data() as NaoConformidade;

      const updateData: Partial<NaoConformidade> = {
        status: 'investig',
        capa: {
          ...nc.capa,
          investigacao: {
            realizada: true,
            dataInicio: nc.capa?.investigacao?.dataInicio || (admin.firestore.FieldValue.serverTimestamp() as any),
            dataFim: admin.firestore.FieldValue.serverTimestamp() as any,
            descricao,
            investigadorId: request.auth.uid,
            achados: achados || [],
          },
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      const signedEntry = await signAuditEntry(
        `/labs/${labId}/nao-conformidades`,
        request.auth.uid,
        `nc.investigate.${nc.numero}`,
        updateData,
        secret
      );

      updateData.hmac = signedEntry.hmac;
      updateData.previousHash = signedEntry.previousHash;

      await ncRef.update(updateData);

      return { success: true, ncId, status: 'investig' };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro na investigação');
    }
  }
);

export const executarAcaoCorretiva = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.responsavelTecnico && !request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas RT pode executar ação corretiva');
    }

    const { labId, ncId, descricao, dataPrevista } = request.data;

    if (!labId || !ncId || !descricao || !dataPrevista) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, ncId, descricao, dataPrevista');
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not set');

      const ncRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
      const ncSnap = await ncRef.get();

      if (!ncSnap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrado`);
      }

      const nc = ncSnap.data() as NaoConformidade;

      const updateData: Partial<NaoConformidade> = {
        status: 'correcao',
        capa: {
          ...nc.capa,
          acaoCorretiva: {
            descricao,
            dataPrevista: new admin.firestore.Timestamp(Math.floor(dataPrevista / 1000), 0),
            responsavel: request.auth.uid,
            status: 'planejada',
          },
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      const signedEntry = await signAuditEntry(
        `/labs/${labId}/nao-conformidades`,
        request.auth.uid,
        `nc.acaoCorretiva.${nc.numero}`,
        updateData,
        secret
      );

      updateData.hmac = signedEntry.hmac;
      updateData.previousHash = signedEntry.previousHash;

      await ncRef.update(updateData);

      return { success: true, ncId, status: 'correcao' };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro na ação corretiva');
    }
  }
);

export const verificarEficacia = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.responsavelTecnico && !request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas RT pode verificar eficacia');
    }

    const { labId, ncId, resultado, evidencia } = request.data;

    if (!labId || !ncId || !resultado) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, ncId, resultado');
    }

    if (!['eficaz', 'ineficaz', 'nao_concluida'].includes(resultado)) {
      throw new HttpsError('invalid-argument', 'Resultado deve ser eficaz, ineficaz ou nao_concluida');
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not set');

      const ncRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
      const ncSnap = await ncRef.get();

      if (!ncSnap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrado`);
      }

      const nc = ncSnap.data() as NaoConformidade;

      const novoStatus = resultado === 'eficaz' ? 'fechada' : resultado === 'ineficaz' ? 'investig' : 'verif_eficacia';

      const updateData: Partial<NaoConformidade> = {
        status: novoStatus as any,
        capa: {
          ...nc.capa,
          verificacaoEficacia: {
            realizada: true,
            resultado: resultado as any,
            dataVerificacao: admin.firestore.FieldValue.serverTimestamp() as any,
            verificadoPor: request.auth.uid,
            evidencia: evidencia || '',
          },
          reabertura: resultado === 'ineficaz',
        },
        ...(novoStatus === 'fechada' && {
          fechada: {
            timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
            uid: request.auth.uid,
            motivo: 'Ação corretiva verificada como eficaz',
          },
        }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      const signedEntry = await signAuditEntry(
        `/labs/${labId}/nao-conformidades`,
        request.auth.uid,
        `nc.verificaEficacia.${nc.numero}`,
        updateData,
        secret
      );

      updateData.hmac = signedEntry.hmac;
      updateData.previousHash = signedEntry.previousHash;

      await ncRef.update(updateData);

      return { success: true, ncId, status: novoStatus };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro na verificação de eficacia');
    }
  }
);
