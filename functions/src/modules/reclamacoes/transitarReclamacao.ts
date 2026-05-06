import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/https';
import { db, admin } from '../../shared/firebase';
import { z } from 'zod';
import { isActiveMemberOfLab } from '../../shared/auth';
import { generateChainHash } from '../../shared/signature';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const TransitarReclamacaoInputSchema = z.object({
  labId: z.string(),
  reclamacaoId: z.string(),
  novoStatus: z.enum(['Analisando', 'RCA', 'Resolvida', 'Comunicada', 'Fechada']),
  descricaoTransicao: z.string().optional(),
});

type TransitarReclamacaoInput = z.infer<typeof TransitarReclamacaoInputSchema>;

const transicoes: Record<string, string[]> = {
  Nova: ['Analisando'],
  Analisando: ['RCA'],
  RCA: ['Resolvida'],
  Resolvida: ['Comunicada'],
  Comunicada: ['Fechada'],
};

/**
 * Cloud Function: Transition complaint status (RT/Qualidade role required)
 */
export const transitarReclamacao = onCall<TransitarReclamacaoInput>(
  { enforceAppCheck: false, cors: true },
  async (request) => {
    try {
      const input = TransitarReclamacaoInputSchema.parse(request.data);

      if (!request.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
      }

      // Auth: must be member
      const isMember = await isActiveMemberOfLab(request.auth.uid, input.labId);
      if (!isMember) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Usuário não é membro do laboratório'
        );
      }

      // Get reclamacao
      const reclamacaoRef = db.doc(`labs/${input.labId}/reclamacoes/${input.reclamacaoId}`);
      const reclamacaoSnap = await reclamacaoRef.get();

      if (!reclamacaoSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Reclamação não encontrada');
      }

      const reclamacao = reclamacaoSnap.data()!;

      // Validate state transition
      const validTransicoes = transicoes[reclamacao.status] || [];
      if (!validTransicoes.includes(input.novoStatus)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Transição inválida de ${reclamacao.status} para ${input.novoStatus}`
        );
      }

      // Special validation: RCA status requires 5 Whys to be complete
      if (input.novoStatus === 'Resolvida' && reclamacao.status === 'RCA') {
        if (!reclamacao.rcaFiveWhys || !reclamacao.rcaFiveWhys.nivelRaiz) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'RCA 5 Whys deve estar completa antes de resolver'
          );
        }
      }

      // Create signature
      const signature = {
        hash: generateChainHash(JSON.stringify({ reclamacaoId: input.reclamacaoId })),
        operatorId: request.auth.uid,
        ts: admin.firestore.Timestamp.now(),
      };

      // Update reclamacao
      const updateData: any = {
        status: input.novoStatus,
        responsavelId: request.auth.uid,
        signature: signature,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (input.descricaoTransicao) {
        updateData.descricaoTransicao = input.descricaoTransicao;
      }

      await reclamacaoRef.update(updateData);

      // Send email to reclamant if transitioning to Comunicada
      if (input.novoStatus === 'Comunicada') {
        try {
          const statusLabels: Record<string, string> = {
            Nova: 'registrada',
            Analisando: 'em análise',
            RCA: 'em investigação',
            Resolvida: 'resolvida',
            Comunicada: 'comunicada ao reclamante',
          };

          const htmlBody = `
            <h2>Sua reclamação foi ${statusLabels[input.novoStatus]}</h2>
            <p>Prezado(a) ${reclamacao.reclamante.nome},</p>
            <p>Sua reclamação foi processada e ${statusLabels[input.novoStatus]}.</p>
            <p>Código da reclamação: <strong>${input.reclamacaoId}</strong></p>
            ${input.descricaoTransicao ? `<p><strong>Detalhes:</strong> ${input.descricaoTransicao}</p>` : ''}
          `;

          await resend.emails.send({
            from: 'reclamacoes@hmatologia2.web.app',
            to: reclamacao.reclamante.email,
            subject: 'Sua reclamação foi respondida',
            html: htmlBody,
          });
        } catch (emailError) {
          console.error('Error sending email:', emailError);
        }
      }

      return {
        success: true,
        message: `Reclamação movida para ${input.novoStatus}`,
      };
    } catch (error) {
      console.error('[transitarReclamacao] Error:', error);

      if (error instanceof z.ZodError) {
        throw new functions.https.HttpsError('invalid-argument', error.errors[0].message);
      }

      throw new functions.https.HttpsError('internal', 'Erro ao transitar reclamação');
    }
  }
);
