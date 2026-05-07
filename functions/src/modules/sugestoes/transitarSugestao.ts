import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/https';
import { db, admin } from '../../shared/firebase';
import { z } from 'zod';
import { isActiveMemberOfLab } from '../../shared/auth';
import { generateChainHash } from '../../shared/signature';
import { Resend } from 'resend';

let resend: Resend | null = null;

function getResendClient() {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

const TransitarSugestaoInputSchema = z.object({
  labId: z.string(),
  sugestaoId: z.string(),
  novoStatus: z.enum(['analisada', 'implementada', 'rejeitada']),
  motivo: z.string().optional(),
});

type TransitarSugestaoInput = z.infer<typeof TransitarSugestaoInputSchema>;

// State machine validation
const transicoes: Record<string, string[]> = {
  aberta: ['analisada'],
  analisada: ['implementada', 'rejeitada'],
};

/**
 * Cloud Function: Transition suggestion status (qualidade role required)
 */
export const transitarSugestao = onCall<TransitarSugestaoInput>(
  { enforceAppCheck: false, cors: true },
  async (request) => {
    try {
      const input = TransitarSugestaoInputSchema.parse(request.data);

      // Auth: must be member with 'qualidade' or 'admin' role
      const isMember = await isActiveMemberOfLab(request.auth!.uid, input.labId);
      if (!isMember) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Usuário não é membro do laboratório'
        );
      }

      // Check for qualidade/admin claim
      const userDoc = await db.collection('users').doc(request.auth!.uid).get();
      const userRoles = userDoc.data()?.roles || [];
      if (!userRoles.includes('qualidade') && !userRoles.includes('admin')) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Usuário não tem permissão para aprovar sugestões'
        );
      }

      // Get sugestao
      const sugestaoRef = db.doc(`labs/${input.labId}/sugestoes/${input.sugestaoId}`);
      const sugestaoSnap = await sugestaoRef.get();

      if (!sugestaoSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Sugestão não encontrada');
      }

      const sugestao = sugestaoSnap.data()!;

      // Validate state transition
      const validTransicoes = transicoes[sugestao.status] || [];
      if (!validTransicoes.includes(input.novoStatus)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Transição inválida de ${sugestao.status} para ${input.novoStatus}`
        );
      }

      // Update sugestao
      const signature = {
        hash: generateChainHash(JSON.stringify({ sugestaoId: input.sugestaoId })),
        operatorId: request.auth!.uid,
        ts: admin.firestore.Timestamp.now(),
      };

      await sugestaoRef.update({
        status: input.novoStatus,
        motivo: input.motivo || '',
        analisadaPor: request.auth!.uid,
        analisadoEm: admin.firestore.FieldValue.serverTimestamp(),
        signature: signature,
      });

      // Send email to author if applicable
      if (sugestao.autorId) {
        try {
          const userDoc = await db.collection('users').doc(sugestao.autorId).get();
          const userData = userDoc.data();

          if (userData?.email) {
            const statusLabels: Record<string, string> = {
              analisada: 'em análise',
              implementada: 'foi implementada',
              rejeitada: 'foi rejeitada',
            };

            const subject = `Sua sugestão ${statusLabels[input.novoStatus]}`;
            const html = `
              <h2>${subject}</h2>
              <p>Prezado(a),</p>
              <p>Sua sugestão "<strong>${sugestao.titulo}</strong>" ${statusLabels[input.novoStatus]}.</p>
              ${input.motivo ? `<p><strong>Motivo:</strong> ${input.motivo}</p>` : ''}
            `;

            const client = getResendClient();
            await client.emails.send({
              from: 'qualidade@hmatologia2.web.app',
              to: userData.email,
              subject: subject,
              html: html,
            });
          }
        } catch (emailError) {
          console.error('Error sending status email:', emailError);
        }
      }

      return {
        success: true,
        message: `Sugestão movida para ${input.novoStatus}`,
      };
    } catch (error) {
      console.error('[transitarSugestao] Error:', error);

      if (error instanceof z.ZodError) {
        throw new functions.https.HttpsError('invalid-argument', error.errors[0].message);
      }

      throw new functions.https.HttpsError('internal', 'Erro ao transitar sugestão');
    }
  }
);
