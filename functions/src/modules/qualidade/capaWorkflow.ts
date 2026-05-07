import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { NaoConformidade } from './types';
import { signAuditEntry } from '../audit/cryptoAudit';
import { HCQ_SIGNATURE_HMAC_KEY } from '../signatures/verifier';

const db = admin.firestore();

export const investigarNC = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.token.responsavelTecnico && !request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas RT pode investigar NC');
    }

    const { labId, ncId, descricao, achados } = request.data;

    if (!labId || !ncId || !descricao) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, ncId, descricao');
    }

    try {
      const secret = HCQ_SIGNATURE_HMAC_KEY.value();
      if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not set');

      const ncRef = db.collection(`labs/${labId}/naoConformidades`).doc(ncId);
      const ncSnap = await ncRef.get();

      if (!ncSnap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrado`);
      }

      const nc = ncSnap.data() as NaoConformidade;

      const updateData: Partial<NaoConformidade> = {
        capaStatus: 'investigacao',
        capaHistorico: [
          ...(nc.capaHistorico || []),
          {
            estado: 'investigacao',
            dataTransicao: admin.firestore.FieldValue.serverTimestamp() as any,
            responsavel: request.auth.uid,
            descricao,
            achados: achados || [],
          },
        ],
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      const signedEntry = await signAuditEntry(
        `/labs/${labId}/naoConformidades`,
        request.auth.uid,
        `nc.investigate.${nc.codigo}`,
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
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.token.responsavelTecnico && !request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas RT pode executar ação corretiva');
    }

    const { labId, ncId, descricao, dataPrevista } = request.data;

    if (!labId || !ncId || !descricao || !dataPrevista) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, ncId, descricao, dataPrevista');
    }

    try {
      const secret = HCQ_SIGNATURE_HMAC_KEY.value();
      if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not set');

      const ncRef = db.collection(`labs/${labId}/naoConformidades`).doc(ncId);
      const ncSnap = await ncRef.get();

      if (!ncSnap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrado`);
      }

      const nc = ncSnap.data() as NaoConformidade;

      const updateData: Partial<NaoConformidade> = {
        capaStatus: 'acao',
        capaHistorico: [
          ...(nc.capaHistorico || []),
          {
            estado: 'acao',
            dataTransicao: admin.firestore.FieldValue.serverTimestamp() as any,
            responsavel: request.auth.uid,
            descricao,
            dataPrevista: new admin.firestore.Timestamp(Math.floor(dataPrevista / 1000), 0),
          },
        ],
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      const signedEntry = await signAuditEntry(
        `/labs/${labId}/naoConformidades`,
        request.auth.uid,
        `nc.acaoCorretiva.${nc.codigo}`,
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
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
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
      const secret = HCQ_SIGNATURE_HMAC_KEY.value();
      if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not set');

      const ncRef = db.collection(`labs/${labId}/naoConformidades`).doc(ncId);
      const ncSnap = await ncRef.get();

      if (!ncSnap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrado`);
      }

      const nc = ncSnap.data() as NaoConformidade;

      const novoCapaStatus = resultado === 'eficaz' ? 'fechada' : resultado === 'ineficaz' ? 'investigacao' : 'eficacia';

      const updateData: Partial<NaoConformidade> = {
        capaStatus: novoCapaStatus,
        capaHistorico: [
          ...(nc.capaHistorico || []),
          {
            estado: novoCapaStatus,
            dataTransicao: admin.firestore.FieldValue.serverTimestamp() as any,
            responsavel: request.auth.uid,
            resultado: resultado as any,
            evidencia: evidencia || '',
          },
        ],
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      const signedEntry = await signAuditEntry(
        `/labs/${labId}/naoConformidades`,
        request.auth.uid,
        `nc.verificaEficacia.${nc.codigo}`,
        updateData,
        secret
      );

      updateData.hmac = signedEntry.hmac;
      updateData.previousHash = signedEntry.previousHash;

      await ncRef.update(updateData);

      return { success: true, ncId, status: novoCapaStatus };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro na verificação de eficacia');
    }
  }
);
