import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { NaoConformidade, NCStatus, NCSeveridade } from './types';
import { signAuditEntry } from '../audit/cryptoAudit';

const db = admin.firestore();

export const openNaoConformidade = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }

    const { labId, origem, origemId, moduloOrigemId, descricao, severidade } = request.data;

    if (!labId || !origem || !moduloOrigemId || !descricao || !severidade) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, origem, moduloOrigemId, descricao, severidade');
    }

    if (!['leve', 'grave', 'critica'].includes(severidade)) {
      throw new HttpsError('invalid-argument', 'Severidade deve ser leve, grave ou critica');
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not set');

      const labDoc = await db.collection('labs').doc(labId).get();
      if (!labDoc.exists) {
        throw new HttpsError('not-found', `Lab ${labId} não encontrado`);
      }

      const counterRef = db.collection(`labs/${labId}`).doc('_nc_counter');
      const counterSnap = await counterRef.get();
      const seq = ((counterSnap.get('counter') || 0) + 1).toString().padStart(4, '0');
      
      const ano = new Date().getFullYear();
      const numero = `NC-${ano}-${seq}`;

      const ncData: Partial<NaoConformidade> = {
        labId,
        numero,
        origem,
        origemId: origemId || null,
        moduloOrigemId,
        descricao,
        severidade: severidade as NCSeveridade,
        status: 'aberta' as NCStatus,
        statusHistory: [
          {
            timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
            novoStatus: 'aberta',
            mudadoPor: request.auth.uid,
            motivo: 'Abertura inicial',
            hmac: '', // Will be filled by HMAC signing
          },
        ],
        capa: {},
        aberta: {
          timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
          uid: request.auth.uid,
          motivo: 'Aberta por operador',
        },
        bloqueiaOperacoes: severidade === 'critica' || severidade === 'grave',
        createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      // Sign NC via ADR 0005
      const signedEntry = await signAuditEntry(
        `/labs/${labId}/nao-conformidades`,
        request.auth.uid,
        `nc.open.${numero}`,
        ncData,
        secret
      );

      ncData.hmac = signedEntry.hmac;
      ncData.previousHash = signedEntry.previousHash;

      const ncRef = await db.collection(`labs/${labId}/nao-conformidades`).add(ncData);
      await counterRef.set({ counter: parseInt(seq) }, { merge: true });

      return {
        success: true,
        ncId: ncRef.id,
        numero,
        status: 'aberta',
      };
    } catch (error: any) {
      console.error('Error opening NC:', error);
      throw new HttpsError('internal', error.message || 'Erro ao abrir NC');
    }
  }
);

export const updateNaoConformidade = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }

    const { labId, ncId, novoStatus, motivoStatus, capaField, capaValue } = request.data;

    if (!labId || !ncId || !novoStatus) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, ncId, novoStatus');
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

      // Validate status transition
      const validTransitions: { [key in NCStatus]: NCStatus[] } = {
        aberta: ['investig', 'cancelada'],
        investig: ['correcao', 'aberta'],
        correcao: ['verif_eficacia'],
        verif_eficacia: ['fechada', 'investig'],
        fechada: [],
        cancelada: [],
      };

      if (!validTransitions[nc.status].includes(novoStatus as NCStatus)) {
        throw new HttpsError('invalid-argument', `Transição inválida: ${nc.status} → ${novoStatus}`);
      }

      // Add status history entry
      const newHistory = nc.statusHistory || [];
      newHistory.push({
        timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
        novoStatus: novoStatus as NCStatus,
        mudadoPor: request.auth.uid,
        motivo: motivoStatus || '',
        hmac: '', // Will be filled
      });

      const updateData: Partial<NaoConformidade> = {
        status: novoStatus as NCStatus,
        statusHistory: newHistory,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      // Update CAPA field if provided
      if (capaField && capaValue) {
        updateData.capa = { ...nc.capa, [capaField]: capaValue };
      }

      // Sign update
      const signedEntry = await signAuditEntry(
        `/labs/${labId}/nao-conformidades`,
        request.auth.uid,
        `nc.update.${nc.numero}`,
        updateData,
        secret
      );

      updateData.hmac = signedEntry.hmac;
      updateData.previousHash = signedEntry.previousHash;

      await ncRef.update(updateData);

      return {
        success: true,
        ncId,
        novoStatus,
      };
    } catch (error: any) {
      console.error('Error updating NC:', error);
      throw new HttpsError('internal', error.message || 'Erro ao atualizar NC');
    }
  }
);

export async function checkNCs(
  labId: string,
  modulo: string
): Promise<{ blocked: boolean; blockingNC?: NaoConformidade }> {
  try {
    const ncs = await db
      .collection(`labs/${labId}/nao-conformidades`)
      .where('status', '!=', 'fechada')
      .where('severidade', 'in', ['grave', 'critica'])
      .get();

    for (const doc of ncs.docs) {
      const nc = doc.data() as NaoConformidade;
      if (nc.bloqueiaOperacoes) {
        const blocksModule =
          !nc.operacoesTodasBloqueadas ||
          nc.operacoesTodasBloqueadas.length === 0 ||
          nc.operacoesTodasBloqueadas.includes(modulo);

        if (blocksModule) {
          return { blocked: true, blockingNC: nc };
        }
      }
    }

    return { blocked: false };
  } catch (error) {
    console.error('Error checking NCs:', error);
    return { blocked: false };
  }
}
