import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  generateStateToken,
  getAuthorizationUrl,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
} from './_drive/oauthClient';

const db = admin.firestore();

interface IniciarOAuthInput {
  labId: string;
}

interface IniciarOAuthOutput {
  authUrl: string;
}

export const iniciarOAuthDrive = onCall<IniciarOAuthInput>(
  {
    region: 'southamerica-east1',
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET],
  },
  async (request): Promise<IniciarOAuthOutput> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const { labId } = request.data;
    const userId = request.auth.uid;

    // Verify lab membership
    const memberRef = db.collection(`labs/${labId}/members`).doc(userId);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists || memberSnap.data()?.active !== true) {
      throw new HttpsError('permission-denied', `Acesso negado ao lab ${labId}`);
    }

    // Generate secure state token (stored in Firestore with 10 min TTL)
    const state = await generateStateToken(labId, userId);

    // Build authorization URL
    const authUrl = getAuthorizationUrl(state);

    return { authUrl };
  },
);
