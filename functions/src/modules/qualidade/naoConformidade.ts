import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { NaoConformidade, NCSeveridade, NCOrigem } from './types';
import { signAuditEntry } from '../audit/cryptoAudit';

const db = admin.firestore();

export const openNaoConformidade = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }

    const { labId, titulo, descricao, categoria, severidade, origem } = request.data;

    if (!labId || !titulo || !descricao || !severidade) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, titulo, descricao, severidade');
    }

    // Gate: severidade CRITICA bloqueia operação
    if (severidade === NCSeveridade.CRITICA) {
      return {
        success: false,
        message: 'NC crítica requer aprovação de RT antes de ser aberta',
        requiresApproval: true,
      };
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      const numero = `NC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const nc: Partial<NaoConformidade> = {
        labId,
        numero,
        titulo,
        descricao,
        categoria: categoria || 'geral',
        severidade: severidade as NCSeveridade,
        status: 'aberta',
        origem: (origem || { tipo: 'manual', modulo: 'geral' }) as NCOrigem,
        abertaPor: request.auth.uid,
        dataAbertura: admin.firestore.FieldValue.serverTimestamp() as any,
        criadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      if (secret) {
        const hmac = await signAuditEntry(
          `/labs/${labId}/naoConformidades`,
          request.auth.uid,
          `nc.aberta.${numero}`,
          nc,
          secret
        );
        (nc as any).hmac = hmac.hmac;
      }

      const ncRef = await db.collection(`labs/${labId}/naoConformidades`).add(nc);

      return {
        success: true,
        ncId: ncRef.id,
        numero,
        status: 'aberta',
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao abrir NC');
    }
  }
);

export const updateNaoConformidade = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }

    const { labId, ncId, updates } = request.data;

    if (!labId || !ncId || !updates) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, ncId, updates');
    }

    try {
      const docRef = db.collection(`labs/${labId}/naoConformidades`).doc(ncId);
      const snap = await docRef.get();

      if (!snap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrada`);
      }

      const updateData: any = {
        ...updates,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Prevent modification of core fields
      delete updateData.labId;
      delete updateData.numero;
      delete updateData.abertaPor;
      delete updateData.dataAbertura;

      await docRef.update(updateData);

      return {
        success: true,
        ncId,
        updated: Object.keys(updates),
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao atualizar NC');
    }
  }
);

export const addAcao = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }

    const { labId, ncId, descricao, responsavel, dataPlanejada } = request.data;

    if (!labId || !ncId || !descricao || !responsavel) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, ncId, descricao, responsavel');
    }

    try {
      const docRef = db.collection(`labs/${labId}/naoConformidades`).doc(ncId);
      const snap = await docRef.get();

      if (!snap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrada`);
      }

      const nc = snap.data() as NaoConformidade;
      const novaAcao = {
        descricao,
        responsavel,
        dataPrevista: admin.firestore.Timestamp.fromDate(new Date(dataPlanejada)),
        status: 'planejada' as const,
      };

      const newCapa = {
        ...(nc.capa || {}),
        acaoCorretiva: novaAcao,
      };

      await docRef.update({
        capa: newCapa,
        status: 'acaoPropostaPela_acao',
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        ncId,
        status: 'acaoPropostaPela_acao',
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao adicionar ação');
    }
  }
);
