import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/https';
import { db, admin } from '../../shared/firebase';
import { z } from 'zod';
import { isActiveMemberOfLab } from '../../shared/auth';

const UpvoteSugestaoInputSchema = z.object({
  labId: z.string(),
  sugestaoId: z.string(),
});

type UpvoteSugestaoInput = z.infer<typeof UpvoteSugestaoInputSchema>;

/**
 * Cloud Function: Upvote suggestion (idempotent per user)
 * Uses idempotency: one vote per uid per suggestion
 */
export const upvoteSugestao = onCall<UpvoteSugestaoInput>(
  { enforceAppCheck: false, cors: true },
  async (request) => {
    try {
      const input = UpvoteSugestaoInputSchema.parse(request.data);

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

      // Idempotent: use set with merge (if document exists, no error; if not, creates)
      const votoRef = db.doc(
        `labs/${input.labId}/sugestoes/${input.sugestaoId}/votos/${request.auth.uid}`
      );

      await votoRef.set(
        {
          usuarioId: request.auth.uid,
          votadoEm: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Increment vote count on sugestao (atomic)
      const sugestaoRef = db.doc(`labs/${input.labId}/sugestoes/${input.sugestaoId}`);
      await sugestaoRef.update({
        votos: admin.firestore.FieldValue.increment(1),
      });

      return {
        success: true,
        message: 'Voto registrado',
      };
    } catch (error) {
      console.error('[upvoteSugestao] Error:', error);

      if (error instanceof z.ZodError) {
        throw new functions.https.HttpsError('invalid-argument', error.errors[0].message);
      }

      throw new functions.https.HttpsError('internal', 'Erro ao votar em sugestão');
    }
  }
);
