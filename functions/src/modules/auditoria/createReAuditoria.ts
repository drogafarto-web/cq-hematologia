import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';
import type { LogicalSignature } from './types';

const db = admin.firestore();

const CreateReAuditoriaInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  auditoriaOriginalId: z.string().min(1, 'auditoriaOriginalId é obrigatório'),
  proximaAuditoriaPlanejada: z.number().int().positive('proximaAuditoriaPlanejada deve ser positiva'),
  responsavelTecnico: z.string().min(1, 'responsavelTecnico é obrigatório'),
  motivacao: z.string().min(20, 'Motivação deve ter pelo menos 20 caracteres').max(1000, 'Motivação não pode exceder 1000 caracteres'),
});

type CreateReAuditoriaInputType = z.infer<typeof CreateReAuditoriaInput>;

async function isActiveMemberOfLab(labId: string, uid: string): Promise<boolean> {
  try {
    const snap = await db.collection('users').doc(uid).collection('labs').doc(labId).get();
    return snap.exists && snap.data()?.ativo === true;
  } catch {
    return false;
  }
}

/**
 * createReAuditoria: Cria re-auditoria vinculada a uma auditoria finalizada.
 * Valida que todos os NCs da auditoria original estão fechados antes de permitir.
 */
export const createReAuditoria = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Token de autenticação obrigatório');
    }

    let input: CreateReAuditoriaInputType;
    try {
      input = CreateReAuditoriaInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', `Validação falhou: ${err.message}`);
    }

    const { labId, auditoriaOriginalId, proximaAuditoriaPlanejada, responsavelTecnico, motivacao } = input;

    const isSuperAdmin = !!request.auth.token.superAdmin || !!request.auth.token.isSuperAdmin;
    const isMember = isSuperAdmin || (await isActiveMemberOfLab(labId, request.auth.uid));
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Você não é membro ativo deste laboratório');
    }

    try {
      // Read original auditoria
      const originalSnap = await db.collection('labs').doc(labId).collection('auditorias-internas').doc(auditoriaOriginalId).get();
      if (!originalSnap.exists) {
        throw new HttpsError('not-found', 'Auditoria original não encontrada');
      }
      const original = originalSnap.data();
      if (original?.deletadoEm) {
        throw new HttpsError('not-found', 'Auditoria original foi removida');
      }

      // Verify original is finalized
      if (original?.status !== 'finalizada') {
        throw new HttpsError('failed-precondition', `Apenas auditorias finalizadas podem gerar re-auditorias. Status atual: ${original?.status}`);
      }

      // Check all NCs from original auditoria are closed
      const ncsSnap = await db.collection('labs').doc(labId).collection('ncs')
        .where('auditoriaOriginalId', '==', auditoriaOriginalId)
        .get();

      const openNCs = ncsSnap.docs
        .map(d => ({ id: d.id, status: d.data().status }))
        .filter(nc => nc.status !== 'fechada');

      if (openNCs.length > 0) {
        const openIds = openNCs.map(nc => nc.id).join(', ');
        throw new HttpsError('failed-precondition', `Não é possível criar re-auditoria. NCs abertas encontradas: ${openIds}`);
      }

      // Generate server-side signature
      const ts = Date.now();
      const signatureData = `${labId}|${auditoriaOriginalId}|${request.auth.uid}|${ts}`;
      const hash = crypto.createHash('sha256').update(signatureData).digest('hex');
      const signature: LogicalSignature = {
        hash,
        operatorId: request.auth.uid,
        ts: admin.firestore.Timestamp.fromDate(new Date(ts)),
      };

      // Create new auditoria with reAuditoriaDe link
      const newAuditoriaRef = db.collection('labs').doc(labId).collection('auditorias-internas').doc();
      await newAuditoriaRef.set({
        labId,
        reAuditoriaDe: auditoriaOriginalId,
        proximaAuditoriaPlanejada,
        responsavelTecnico,
        motivacao,
        status: 'planejada',
        assinatura: signature,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: request.auth.uid,
        deletadoEm: null,
        // Minimal other fields — inherit shape from createAuditoria if needed
        ano: new Date(proximaAuditoriaPlanejada).getFullYear(),
      });

      return { auditoriaId: newAuditoriaRef.id };
    } catch (err: any) {
      if (err instanceof HttpsError) {
        throw err;
      }
      console.error('createReAuditoria error:', err);
      throw new HttpsError('internal', 'Erro ao criar re-auditoria');
    }
  }
);
