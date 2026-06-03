import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/https';
import { db, admin } from '../../shared/firebase';
import { z } from 'zod';
import { verifyNPSToken } from '../../shared/tokenUtils';
import { enforcePublicRateLimit } from '../../shared/rateLimit';

// Per SECURITY_AUDIT.md #3 + #14: strict schema, all string fields capped,
// .strict() on objects rejects unknown keys.
const NPSRespostaInputSchema = z
  .object({
    npsToken: z.string().min(20).max(2048),
    nota: z.number().int().min(0).max(10),
    comentario: z.string().max(1000).optional(),
    consentimentoLgpd: z
      .object({
        aceito: z.boolean(),
        ipAddress: z.string().max(45),
        userAgent: z.string().max(1000),
      })
      .strict(),
  })
  .strict();

type NPSRespostaInput = z.infer<typeof NPSRespostaInputSchema>;

/**
 * Public callable: Submit NPS response via token
 * Token is valid for 14 days from reclamacao resolution or quarterly campaign
 *
 * Categorization automatic:
 * 0-6: detrator
 * 7-8: neutro
 * 9-10: promotor
 */
export const submitNPSResposta = onCall<NPSRespostaInput>(
  { enforceAppCheck: false, cors: true },
  async (request) => {
    try {
      // Rate limit per IP (SECURITY_AUDIT.md #18): 10/min for public endpoints.
      // NPS is anonymous-via-token, so IP is the only stable identifier.
      const clientIp =
        (request.rawRequest?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.rawRequest?.ip ||
        'unknown';

      const rl = await enforcePublicRateLimit({
        bucketKey: `submitNPSResposta:${clientIp}`,
        maxRequests: 10,
        windowMs: 60 * 1000,
      });
      if (!rl.allowed) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Muitas requisições. Tente novamente em ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
          { retryAfterSeconds: Math.ceil(rl.retryAfterMs / 1000) },
        );
      }

      // Parse & validate input
      const input = NPSRespostaInputSchema.parse(request.data);

      // Verify token
      const tokenData = await verifyNPSToken(input.npsToken);
      if (!tokenData) {
        throw new functions.https.HttpsError('unauthenticated', 'Token inválido ou expirado');
      }

      const { reclamacaoId, labId, pacienteId } = tokenData;

      // Auto-categorize based on score
      const categoria =
        input.nota >= 0 && input.nota <= 6
          ? 'detrator'
          : input.nota >= 7 && input.nota <= 8
            ? 'neutro'
            : 'promotor';

      // Create response document
      const respostaRef = await db.collection(`labs/${labId}/satisfacao-respostas`).add({
        labId,
        pacienteId,
        reclamacaoId: reclamacaoId || null,
        nota: input.nota,
        categoria,
        comentario: input.comentario || '',
        consentimentoLgpd: {
          aceito: input.consentimentoLgpd.aceito,
          em: admin.firestore.FieldValue.serverTimestamp(),
          ipAddress: input.consentimentoLgpd.ipAddress,
          userAgent: input.consentimentoLgpd.userAgent,
        },
        respondidoEm: admin.firestore.FieldValue.serverTimestamp(),
        anonimizadoEm: null, // Will be set 90d later by cron job
        origem: reclamacaoId ? 'pos-reclamacao' : 'trimestral',
      });

      // Update reclamacao if applicable
      if (reclamacaoId) {
        await db.doc(`labs/${labId}/reclamacoes/${reclamacaoId}`).update({
          npsPendente: false,
          npsRespostaId: respostaRef.id,
          npsRespondidoEm: admin.firestore.FieldValue.serverTimestamp(),
          status: 'Fechada', // Auto-close if NPS response received
        });
      }

      return {
        success: true,
        respostaId: respostaRef.id,
        message: 'Obrigado por sua avaliação!',
      };
    } catch (error) {
      console.error('[submitNPSResposta] Error:', error);

      // Re-throw HttpsError (e.g., from rate limiter) without re-wrapping
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      if (error instanceof z.ZodError) {
        throw new functions.https.HttpsError('invalid-argument', error.errors[0].message);
      }

      throw new functions.https.HttpsError('internal', 'Erro ao submeter resposta');
    }
  },
);
