import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/https';
import { db, admin } from '../../shared/firebase';
import { z } from 'zod';
import { isActiveMemberOfLab } from '../../shared/auth';
import { verifyRecaptcha } from '../../shared/recaptcha';
import { generateChainHash } from '../../shared/signature';
import { sendEmail, ALL_SMTP_SECRETS } from '../../shared/email/smtpClient';

const CriarSugestaoInputSchema = z.object({
  labId: z.string(),
  titulo: z.string().min(5).max(200),
  descricao: z.string().min(20).max(2000),
  categoria: z.enum(['produto', 'processo', 'ambiente', 'atendimento', 'outro']),
  recaptchaToken: z.string().optional(),
  consentimentoLgpd: z.object({
    aceito: z.boolean(),
    ipAddress: z.string(),
    userAgent: z.string(),
  }),
});

type CriarSugestaoInput = z.infer<typeof CriarSugestaoInputSchema>;

/**
 * Cloud Function: Create suggestion (internal auth or public reCAPTCHA)
 */
export const criarSugestao = onCall<CriarSugestaoInput>(
  { enforceAppCheck: false, cors: true, secrets: [...ALL_SMTP_SECRETS] },
  async (request) => {
    try {
      const input = CriarSugestaoInputSchema.parse(request.data);

      // Auth: internal user OR public with reCAPTCHA
      let autorId: string | null = null;
      let autorTipo: 'colaborador' | 'paciente' = 'paciente';

      if (request.auth?.uid) {
        // Internal user
        const isMember = await isActiveMemberOfLab(request.auth.uid, input.labId);
        if (!isMember) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'Usuário não é membro do laboratório'
          );
        }
        autorId = request.auth.uid;
        autorTipo = 'colaborador';
      } else {
        // Public user - verify reCAPTCHA
        if (!input.recaptchaToken) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'reCAPTCHA token é obrigatório para pacientes'
          );
        }

        const isValidRecaptcha = await verifyRecaptcha(input.recaptchaToken);
        if (!isValidRecaptcha) {
          throw new functions.https.HttpsError('permission-denied', 'reCAPTCHA inválido');
        }
      }

      // Generate idempotency hash
      const payloadHash = generateChainHash(
        JSON.stringify({
          titulo: input.titulo,
          descricao: input.descricao,
          categoria: input.categoria,
          autorId,
        })
      );

      // Check for duplicate (within 1 hour window)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const duplicateSnap = await db
        .collection(`labs/${input.labId}/sugestoes`)
        .where('payloadHash', '==', payloadHash)
        .where('criadoEm', '>=', oneHourAgo)
        .limit(1)
        .get();

      if (!duplicateSnap.empty) {
        return {
          success: true,
          sugestaoId: duplicateSnap.docs[0].id,
          message: 'Sugestão já registrada',
        };
      }

      // Create suggestion document
      const sugestaoRef = await db.collection(`labs/${input.labId}/sugestoes`).add({
        labId: input.labId,
        titulo: input.titulo,
        descricao: input.descricao,
        categoria: input.categoria,
        autorId: autorId,
        autorTipo: autorTipo,
        status: 'aberta',
        votos: 0,
        consentimentoLgpd: {
          aceito: input.consentimentoLgpd.aceito,
          em: admin.firestore.FieldValue.serverTimestamp(),
          ipAddress: input.consentimentoLgpd.ipAddress,
          userAgent: input.consentimentoLgpd.userAgent,
        },
        payloadHash: payloadHash,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        deletadoEm: null,
      });

      // Send confirmation email if author email is available
      if (autorId) {
        try {
          const userDoc = await db.collection('users').doc(autorId).get();
          const userData = userDoc.data();

          if (userData?.email) {
            await sendEmail({
              to: userData.email,
              subject: 'Sua sugestão foi recebida',
              html: `
                <h2>Obrigado por sua sugestão!</h2>
                <p>Recebemos sua sugestão: <strong>"${input.titulo}"</strong></p>
                <p>Nossa equipe de qualidade analisará em breve.</p>
              `,
            });
          }
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          // Don't fail the whole request due to email error
        }
      }

      return {
        success: true,
        sugestaoId: sugestaoRef.id,
        message: 'Sugestão registrada com sucesso',
      };
    } catch (error) {
      console.error('[criarSugestao] Error:', error);

      if (error instanceof z.ZodError) {
        throw new functions.https.HttpsError('invalid-argument', error.errors[0].message);
      }

      throw new functions.https.HttpsError('internal', 'Erro ao criar sugestão');
    }
  }
);
