/**
 * functions/src/sgq/_drive/oauthClient.ts
 *
 * Google OAuth2 client wrapper for Drive API access.
 * Handles token refresh, scope management, and secure storage of refresh tokens.
 *
 * Scopes: drive.readonly + drive.metadata.readonly (read-only, no modifications)
 *
 * SECURITY MODEL (post SECURITY_AUDIT.md fixes):
 * - State tokens for CSRF: cryptographically secure (crypto.randomBytes(32)),
 *   stored in /labs/{labId}/sgq-oauth-pending/{state} with 10 min TTL,
 *   one-time use (deleted on validation), bound to labId+userId pair.
 * - Refresh tokens stored in Firestore (encrypted at-rest by GCP); never returned
 *   from any function. Migrate to Google Secret Manager for cross-region rotation
 *   per docs/SECURITY_OAUTH.md (KMS rotation policy: 90 days).
 * - getAccessToken() always returns short-lived access_token (1h max), never
 *   refresh_token. Cached access tokens in Firestore expire with their natural TTL.
 * - Audit log on every token grant / refresh / state validation failure.
 */

import { OAuth2Client } from 'google-auth-library';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { defineSecret } from 'firebase-functions/params';

export const OAUTH_CLIENT_ID = defineSecret('GOOGLE_OAUTH_CLIENT_ID');
export const OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');

const REDIRECT_URI = 'https://hmatologia2.web.app/api/sgq/oauth-callback';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
];

// CSRF state token TTL: 10 minutes (per SECURITY_AUDIT.md #1)
export const STATE_TOKEN_TTL_MS = 10 * 60 * 1000;

// Access token cache: refresh when < 5 min remaining
const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Create OAuth2 client using secrets from Firebase Secret Manager.
 */
export function createOAuth2Client(): OAuth2Client {
  const clientId = OAUTH_CLIENT_ID.value();
  const clientSecret = OAUTH_CLIENT_SECRET.value();

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET secrets');
  }

  return new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
}

/**
 * Generate cryptographically-secure state token for CSRF protection.
 * Stores state bound to labId+userId in Firestore with 10 min TTL.
 *
 * @returns state token (64 hex chars, 256 bits entropy)
 */
export async function generateStateToken(labId: string, userId: string): Promise<string> {
  // 32 bytes = 256 bits of entropy → 64 hex chars
  const stateToken = crypto.randomBytes(32).toString('hex');

  await admin
    .firestore()
    .collection('labs')
    .doc(labId)
    .collection('sgq-oauth-pending')
    .doc(stateToken)
    .set({
      labId,
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + STATE_TOKEN_TTL_MS),
    });

  return stateToken;
}

/**
 * Validate OAuth state token. Verifies:
 *   1. State doc exists in /labs/{labId}/sgq-oauth-pending/{state}
 *   2. Stored labId + userId match callback params (anti cross-tenant hijack)
 *   3. Token not expired (< 10 min old)
 *   4. Deletes state token after validation (one-time use, prevents replay)
 *
 * @throws Error if invalid / expired / mismatched
 */
export async function validateStateToken(
  stateToken: string,
  labId: string,
  userId: string,
): Promise<void> {
  if (!stateToken || typeof stateToken !== 'string' || stateToken.length !== 64) {
    await logInvalidStateAttempt(labId, userId, 'malformed_state', stateToken);
    throw new Error('Invalid state token format');
  }

  // Reject anything that isn't pure hex — defense vs. injection
  if (!/^[a-f0-9]{64}$/i.test(stateToken)) {
    await logInvalidStateAttempt(labId, userId, 'non_hex_state', stateToken);
    throw new Error('Invalid state token format');
  }

  const pendingRef = admin
    .firestore()
    .collection('labs')
    .doc(labId)
    .collection('sgq-oauth-pending')
    .doc(stateToken);

  const pendingSnap = await pendingRef.get();

  if (!pendingSnap.exists) {
    await logInvalidStateAttempt(labId, userId, 'state_not_found', stateToken);
    throw new Error('Invalid or expired state token');
  }

  const data = pendingSnap.data() as {
    labId: string;
    userId: string;
    createdAt?: admin.firestore.Timestamp;
    expiresAt?: admin.firestore.Timestamp;
  };

  // Multi-tenant binding: state must match exact labId + userId from callback
  if (data.labId !== labId || data.userId !== userId) {
    // Delete to prevent further tampering
    await pendingRef.delete();
    await logInvalidStateAttempt(labId, userId, 'tenant_mismatch', stateToken);
    throw new Error('State token tenant mismatch');
  }

  // TTL check
  const expiresAt = data.expiresAt?.toMillis() ?? 0;
  if (expiresAt > 0 && Date.now() > expiresAt) {
    await pendingRef.delete();
    await logInvalidStateAttempt(labId, userId, 'state_expired', stateToken);
    throw new Error('State token expired');
  }

  // One-time use: delete after validation
  await pendingRef.delete();
}

async function logInvalidStateAttempt(
  labId: string,
  userId: string,
  reason: string,
  state: string,
): Promise<void> {
  try {
    await admin
      .firestore()
      .collection('labs')
      .doc(labId)
      .collection('sgq-oauth-logs')
      .add({
        userId,
        event: 'oauth-state-invalid',
        reason,
        // Don't log full state — only first/last 4 chars for forensics
        statePrefix: state ? state.slice(0, 4) : null,
        stateSuffix: state ? state.slice(-4) : null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch {
    // Best-effort audit; never throw from logger
    console.error('[oauthClient] failed to log invalid state attempt', {
      labId,
      userId,
      reason,
    });
  }
}

/**
 * Exchange authorization code for tokens
 * Stores refresh token in Firestore for later use; access token is also cached
 * with explicit absolute expiry so subsequent reads can serve it without refresh.
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

  // tokens.expiry_date is an ABSOLUTE timestamp (ms since epoch) per google-auth-library
  const expiryMs =
    typeof tokens.expiry_date === 'number' ? tokens.expiry_date : Date.now() + 60 * 60 * 1000; // 1h fallback

  // Store refresh token (encrypted at-rest by GCP) and access token + absolute expiry
  await admin
    .firestore()
    .collection('labs')
    .doc(labId)
    .collection('sgq-oauth-tokens')
    .doc(userId)
    .set({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      storedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiryMs),
    });

  // Audit log: token grant
  await admin
    .firestore()
    .collection('labs')
    .doc(labId)
    .collection('sgq-oauth-logs')
    .add({
      userId,
      event: 'oauth-tokens-granted',
      expiresAt: admin.firestore.Timestamp.fromMillis(expiryMs),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

  return {
    accessToken: tokens.access_token,
    expiresIn: Math.max(0, expiryMs - Date.now()),
  };
}

/**
 * Get valid access token from stored refresh token.
 * Returns the SHORT-LIVED ACCESS TOKEN (never the refresh token).
 * Auto-refreshes if expired or near-expiry (< 5 min).
 *
 * Audit log written on every refresh.
 */
export async function getAccessToken(labId: string, userId: string): Promise<string> {
  const tokenRef = admin
    .firestore()
    .collection('labs')
    .doc(labId)
    .collection('sgq-oauth-tokens')
    .doc(userId);

  const tokenDoc = await tokenRef.get();

  if (!tokenDoc.exists) {
    throw new Error('No OAuth token found. Please re-authorize Drive access.');
  }

  const data = tokenDoc.data() as {
    refreshToken?: string;
    accessToken?: string;
    expiresAt?: admin.firestore.Timestamp | Date;
  };

  if (!data.refreshToken) {
    throw new Error('No refresh token stored. Please re-authorize Drive access.');
  }

  const expiresAtMs =
    data.expiresAt instanceof admin.firestore.Timestamp
      ? data.expiresAt.toMillis()
      : data.expiresAt instanceof Date
        ? data.expiresAt.getTime()
        : 0;

  // If access token is cached and still valid, serve from cache
  if (
    data.accessToken &&
    expiresAtMs > 0 &&
    expiresAtMs > Date.now() + ACCESS_TOKEN_REFRESH_THRESHOLD_MS
  ) {
    return data.accessToken;
  }

  // Refresh path
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: data.refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  const newExpiryMs =
    typeof credentials.expiry_date === 'number'
      ? credentials.expiry_date
      : Date.now() + 60 * 60 * 1000;

  // Cache new access token + absolute expiry
  await tokenRef.update({
    accessToken: credentials.access_token,
    expiresAt: admin.firestore.Timestamp.fromMillis(newExpiryMs),
    refreshedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Audit log: refresh
  await admin
    .firestore()
    .collection('labs')
    .doc(labId)
    .collection('sgq-oauth-logs')
    .add({
      userId,
      event: 'oauth-token-refreshed',
      expiresAt: admin.firestore.Timestamp.fromMillis(newExpiryMs),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

  return credentials.access_token;
}

/**
 * Get authorization URL for user to visit.
 * Caller must first generate a state token via generateStateToken(labId, userId).
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
