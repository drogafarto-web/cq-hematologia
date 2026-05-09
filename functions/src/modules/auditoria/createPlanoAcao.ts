import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';
import type { LogicalSignature } from './types';
import { checkNCs } from '../qualidade/naoConformidade';

const db = admin.firestore();

const CreatePlanoAcaoInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  auditoriaId: z.string().min(1, 'auditoriaId é obrigatório'),
  achadoId: z.string().min(1, 'achadoId é obrigatório'),
  descricao: z.string().min(20, 'Descrição deve ter pelo menos 20 caracteres').max(1000, 'Descrição não pode exceder 1000 caracteres'),
  responsavel: z.string().min(1, 'responsavel é obrigatório'),
  prazo: z.number().int().positive('prazo deve ser um número inteiro positivo'),
});

type CreatePlanoAcaoInputType = z.infer<typeof CreatePlanoAcaoInput>;

async function isActiveMemberOfLab(labId: string, uid: string): Promise<boolean> {
  try {
    const snap = await db.collection('users').doc(uid).collection('labs').doc(labId).get();
    return snap.exists && snap.data()?.ativo === true;
  } catch {
    return false;
  }
}

/**
 * createPlanoAcao: Cria plano de ação vinculado a um achado de auditoria.
 * Valida NC aberto associado e gera assinatura server-side.
 */
export const createPlanoAcao = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Token de autenticação obrigatório');
    }

    let input: CreatePlanoAcaoInputType;
    try {
      input = CreatePlanoAcaoInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', `Validação falhou: ${err.message}`);
    }

    const { labId, auditoriaId, achadoId, descricao, responsavel, prazo } = input;

    const isMember = await isActiveMemberOfLab(labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Você não é membro ativo deste laboratório');
    }

    try {
      // Verify auditoria exists
      const auditoriaSnap = await db.collection('labs').doc(labId).collection('auditorias-internas').doc(auditoriaId).get();
      if (!auditoriaSnap.exists) {
        throw new HttpsError('not-found', 'Auditoria não encontrada');
      }
      const auditoria = auditoriaSnap.data();
      if (auditoria?.deletadoEm) {
        throw new HttpsError('not-found', 'Auditoria foi removida');
      }

      // Verify achado exists under this auditoria
      const achadoSnap = await db.collection('labs').doc(labId).collection('auditorias-internas').doc(auditoriaId).collection('achados').doc(achadoId).get();
      if (!achadoSnap.exists) {
        throw new HttpsError('not-found', 'Achado não encontrado nesta auditoria');
      }
      const achado = achadoSnap.data();
      if (achado?.deletadoEm) {
        throw new HttpsError('not-found', 'Achado foi removido');
      }

      // Cross-check NCs: achado must have an open NC
      const ncCheck = await checkNCs(labId, achadoId);
      if (!ncCheck || ncCheck.blocked) {
        throw new HttpsError('failed-precondition', 'Este achado não tem uma não-conformidade aberta associada');
      }

      // Generate server-side signature
      const ts = Date.now();
      const signatureData = `${labId}|${auditoriaId}|${achadoId}|${request.auth.uid}|${ts}`;
      const hash = crypto.createHash('sha256').update(signatureData).digest('hex');
      const signature: LogicalSignature = {
        hash,
        operatorId: request.auth.uid,
        ts: admin.firestore.Timestamp.fromDate(new Date(ts)),
      };

      // Write plano de ação
      const planoRef = db.collection('labs').doc(labId).collection('auditorias-internas').doc(auditoriaId).collection('planos-acao').doc();
      await planoRef.set({
        labId,
        auditoriaId,
        achadoId,
        descricao,
        responsavel,
        prazo,
        status: 'aberto',
        assinatura: signature,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: request.auth.uid,
        deletadoEm: null,
      });

      return { planoId: planoRef.id };
    } catch (err: any) {
      if (err instanceof HttpsError) {
        throw err;
      }
      console.error('createPlanoAcao error:', err);
      throw new HttpsError('internal', 'Erro ao criar plano de ação');
    }
  }
);
