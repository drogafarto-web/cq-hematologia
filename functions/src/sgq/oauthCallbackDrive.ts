/**
 * functions/src/sgq/oauthCallbackDrive.ts
 *
 * Cloud Function HTTP handler for OAuth2 callback from Google Drive
 *
 * GET /api/sgq/oauth-callback?code=..&state=..
 *
 * Flow:
 * 1. User clicks "Authorize Drive" in ImporterWizard step 1
 * 2. Redirected to Google OAuth consent
 * 3. User grants scopes (drive.readonly)
 * 4. Google redirects to this endpoint with ?code=...&state=...
 * 5. Exchange code for tokens
 * 6. Store refresh token in Firestore
 * 7. Redirect back to frontend with success/error status
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { exchangeCodeForTokens } from './_drive/oauthClient';

export const oauthCallbackDrive = functions.https.onRequest(async (req, res) => {
  try {
    const { code, state, labId, userId } = req.query as Record<string, string>;

    if (!code || !state || !labId || !userId) {
      return res.status(400).json({
        error: 'Missing required parameters: code, state, labId, userId',
      });
    }

    // In production, validate state token to prevent CSRF
    // For MVP, just exchange code for tokens
    const { accessToken, expiresIn } = await exchangeCodeForTokens(
      code,
      labId,
      userId,
    );

    // Log successful authorization
    await admin
      .firestore()
      .collection('labs')
      .doc(labId)
      .collection('sgq-oauth-logs')
      .add({
        userId,
        event: 'oauth-authorized',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        expiresIn,
      });

    // Redirect to frontend with success
    const redirectUrl = new URL('https://hmatologia2.web.app/sgq/importar-drive');
    redirectUrl.searchParams.append('oauth', 'success');
    redirectUrl.searchParams.append('labId', labId);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[oauthCallbackDrive] error:', error);

    const redirectUrl = new URL('https://hmatologia2.web.app/sgq/importar-drive');
    redirectUrl.searchParams.append('oauth', 'error');
    redirectUrl.searchParams.append(
      'message',
      error instanceof Error ? error.message : 'Unknown error',
    );

    res.redirect(redirectUrl.toString());
  }
});
