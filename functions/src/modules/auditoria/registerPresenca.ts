import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';
import type { LogicalSignature } from './types';

const db = admin.firestore();

const RegisterPresencaInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  auditoriaId: z.string().min(1, 'auditoriaId é obrigatório'),
  sessaoId: z.string().min(1, 'sessaoId é obrigatório'),
  reuniao: z.enum(['abertura', 'encerramento'], {
    message: 'reuniao deve ser abertura ou encerramento',
  }),
  participantes: z
    .array(
      z.object({
        userId: z.string().min(1, 'userId é obrigatório'),
        nome: z.string().min(1, 'nome é obrigatório'),
        papel: z.string().min(1, 'papel é obrigatório'),
      }),
    )
    .min(1, 'Deve haver pelo menos um participante'),
});

type RegisterPresencaInputType = z.infer<typeof RegisterPresencaInput>;

async function isActiveMemberOfLab(labId: string, uid: string): Promise<boolean> {
  try {
    const snap = await db.collection('users').doc(uid).collection('labs').doc(labId).get();
    return snap.exists && snap.data()?.ativo === true;
  } catch {
    return false;
  }
}

/**
 * registerPresenca: Registra presença em reunião de abertura/encerramento de auditoria.
 * Cria documento imutável assinado server-side.
 */
export const registerPresenca = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Token de autenticação obrigatório');
    }

    let input: RegisterPresencaInputType;
    try {
      input = RegisterPresencaInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', `Validação falhou: ${err.message}`);
    }

    const { labId, auditoriaId, sessaoId, reuniao, participantes } = input;

    const isMember = await isActiveMemberOfLab(labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Você não é membro ativo deste laboratório');
    }

    try {
      // Verify auditoria exists
      const auditoriaSnap = await db
        .collection('labs')
        .doc(labId)
        .collection('auditorias-internas')
        .doc(auditoriaId)
        .get();
      if (!auditoriaSnap.exists) {
        throw new HttpsError('not-found', 'Auditoria não encontrada');
      }
      const auditoria = auditoriaSnap.data();
      if (auditoria?.deletadoEm) {
        throw new HttpsError('not-found', 'Auditoria foi removida');
      }

      // Verify sessao exists under this auditoria
      const sessaoSnap = await db
        .collection('labs')
        .doc(labId)
        .collection('auditorias-internas')
        .doc(auditoriaId)
        .collection('sessoes')
        .doc(sessaoId)
        .get();
      if (!sessaoSnap.exists) {
        throw new HttpsError('not-found', 'Sessão não encontrada nesta auditoria');
      }
      const sessao = sessaoSnap.data();
      if (sessao?.deletadoEm) {
        throw new HttpsError('not-found', 'Sessão foi removida');
      }

      // Generate server-side signature
      const ts = Date.now();
      const signatureData = `${labId}|${auditoriaId}|${sessaoId}|${reuniao}|${request.auth.uid}|${ts}`;
      const hash = crypto.createHash('sha256').update(signatureData).digest('hex');
      const signature: LogicalSignature = {
        hash,
        operatorId: request.auth.uid,
        ts: admin.firestore.Timestamp.fromDate(new Date(ts)),
      };

      // Write reunião record (immutable)
      const reuniaoRef = db
        .collection('labs')
        .doc(labId)
        .collection('auditorias-internas')
        .doc(auditoriaId)
        .collection('sessoes')
        .doc(sessaoId)
        .collection('reunioes')
        .doc();
      await reuniaoRef.set({
        labId,
        auditoriaId,
        sessaoId,
        reuniao,
        participantes,
        assinatura: signature,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: request.auth.uid,
        deletadoEm: null,
      });

      return { reuniaoId: reuniaoRef.id };
    } catch (err: any) {
      if (err instanceof HttpsError) {
        throw err;
      }
      console.error('registerPresenca error:', err);
      throw new HttpsError('internal', 'Erro ao registrar presença');
    }
  },
);
