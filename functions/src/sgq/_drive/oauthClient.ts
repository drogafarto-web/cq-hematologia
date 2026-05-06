/**
 * functions/src/sgq/_drive/oauthClient.ts
 *
 * Google OAuth2 client wrapper for Drive API access.
 * Handles token refresh, scope management, and secure storage of refresh tokens.
 *
 * Scopes: drive.readonly + drive.metadata.readonly (read-only, no modifications)
 */

import { OAuth2Client, Credentials } from 'google-auth-library';
import * as admin from 'firebase-admin';

const REDIRECT_URI = 'https://hmatologia2.web.app/api/sgq/oauth-callback';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

/**
 * Create OAuth2 client from environment variables
 * (set via Firebase Cloud Console or functions/src/.env)
 */
export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET env vars',
    );
  }

  return new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
}

/**
 * Exchange authorization code for tokens
 * Stores refresh token in Firestore for later use
 */
export async function exchangeCodeForTokens(
  code: string,
  labId: string,
  userId: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain access and refresh tokens');
  }

  // Store refresh token securely in Firestore (encrypted by default)
  await admin
    .firestore()
    .collection('labs')
    .doc(labId)
    .collection('sgq-oauth-tokens')
    .doc(userId)
    .set({
      refreshToken: tokens.refresh_token,
      storedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + (tokens.expiry_date || 0)),
    });

  return {
    accessToken: tokens.access_token,
    expiresIn: tokens.expiry_date ? tokens.expiry_date - Date.now() : 3600000,
  };
}

/**
 * Get valid access token from stored refresh token
 * Auto-refreshes if expired
 */
export async function getAccessToken(
  labId: string,
  userId: string,
): Promise<string> {
  const tokenDoc = await admin
    .firestore()
    .collection('labs')
    .doc(labId)
    .collection('sgq-oauth-tokens')
    .doc(userId)
    .get();

  if (!tokenDoc.exists) {
    throw new Error('No OAuth token found. Please re-authorize Drive access.');
  }

  const { refreshToken, expiresAt } = tokenDoc.data() as {
    refreshToken: string;
    expiresAt: Date;
  };

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Check if token needs refresh (expired or expiring soon)
  if (!expiresAt || expiresAt.getTime() < Date.now() + 300000) {
    // Refresh if < 5 minutes remaining
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    // Update stored expiry
    await tokenDoc.ref.update({
      expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000),
    });

    return credentials.access_token;
  }

  // Token still valid
  return refreshToken;
}

/**
 * Validate OAuth state token (CSRF protection)
 */
export function generateStateToken(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Get authorization URL for user to visit
 */
export function getAuthorizationUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}
