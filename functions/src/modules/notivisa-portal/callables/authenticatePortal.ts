/**
 * authenticatePortal — NOTIVISA Portal OAuth Callback Handler
 *
 * Cloud Function callable invoked after healthcare professional authorizes
 * with NOTIVISA IDP. Validates OAuth code, exchanges for token,
 * creates session, and issues custom Firebase token for client use.
 *
 * Flow:
 * 1. Frontend redirects from NOTIVISA IDP with authorization code
 * 2. Frontend calls this callable with: { labId, code, redirectUri, state }
 * 3. Function exchanges code for OAuth token from NOTIVISA IDP
 * 4. Function validates token, extracts professional info from idToken (JWT)
 * 5. Function creates session doc in Firestore
 * 6. Function issues custom Firebase token (embedded with session)
 * 7. Client stores token, uses for subsequent API calls
 *
 * Complies with: RDC 978 Art. 41 (audit trail), DICQ 4.4 (security),
 * OAuth 2.0 spec (code exchange, state validation).
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { z } from 'zod';

const db = admin.firestore();
const auth = admin.auth();

// ─── Input Validation ───────────────────────────────────────────────────────

const AuthenticatePortalInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  code: z.string().min(1, 'authorization code required'),
  redirectUri: z.string().url('redirectUri must be valid URL'),
  state: z.string().min(1, 'state parameter required'),
});

const AuthenticatePortalOutputSchema = z.object({
  ok: z.literal(true),
  sessionId: z.string(),
  firebaseToken: z.string(),
  expiresAt: z.number().int(),
  professionalName: z.string(),
  professionalRole: z.enum(['RT', 'MEDICO', 'DIRETOR', 'AUDITOR']),
});

const AuthenticatePortalErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'INVALID_INPUT',
    'UNAUTHORIZED',
    'INVALID_CODE',
    'TOKEN_EXCHANGE_FAILED',
    'INVALID_TOKEN',
    'LAB_NOT_FOUND',
    'USER_NOT_FOUND',
    'STATE_MISMATCH',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type AuthenticatePortalOutput = z.infer<typeof AuthenticatePortalOutputSchema>;
type AuthenticatePortalError = z.infer<typeof AuthenticatePortalErrorSchema>;

// ─── Constants ───────────────────────────────────────────────────────────────

const NOTIVISA_IDP_BASE = process.env.NOTIVISA_IDP_BASE || 'https://idp.notivisa.saude.gov.br';
const OAUTH_CLIENT_ID = process.env.NOTIVISA_OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.NOTIVISA_OAUTH_CLIENT_SECRET;
const TOKEN_EXCHANGE_TIMEOUT = 10000; // 10 seconds

// ─── Main Callable ──────────────────────────────────────────────────────────

export const authenticatePortal = functions.onCall(
  {
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (
    request: functions.CallableRequest<unknown>,
  ): Promise<AuthenticatePortalOutput | AuthenticatePortalError> => {
      try {
        // ========== 1. Validate Input ==========
        const input = AuthenticatePortalInputSchema.parse(request.data);
        const { labId, code, redirectUri, state } = input;

        logger.info('[authenticatePortal] Starting OAuth exchange', {
          labId,
          redirectUri,
        });

        // ========== 2. Validate State Parameter ==========
        // State prevents CSRF attacks; must match what was generated for this request
        const stateDocRef = db.collection('notivisa-portal-oauth-state').doc(state);
        const stateSnap = await stateDocRef.get();

        if (stateSnap.data() === undefined) {
          logger.warn('[authenticatePortal] State parameter not found', {
            state,
            labId,
          });
          return {
            ok: false,
            code: 'STATE_MISMATCH',
            message: 'OAuth state parameter invalid or expired',
          };
        }

        const stateData = stateSnap.data();
        if (!stateData) {
          logger.warn('[authenticatePortal] State data is empty', { state, labId });
          return {
            ok: false,
            code: 'STATE_MISMATCH',
            message: 'OAuth state parameter invalid or expired',
          };
        }

        const stateCreatedAt = stateData.createdAt;
        if (
          stateData.labId !== labId ||
          stateData.redirectUri !== redirectUri ||
          Date.now() - stateCreatedAt > 10 * 60 * 1000 // 10 minute expiry
        ) {
          logger.warn('[authenticatePortal] State validation failed', {
            state,
            labId,
            mismatch: stateData.labId !== labId || stateData.redirectUri !== redirectUri,
            expired: Date.now() - stateCreatedAt > 10 * 60 * 1000,
          });
          return {
            ok: false,
            code: 'STATE_MISMATCH',
            message: 'OAuth state parameter mismatch or expired',
          };
        }

        // Consume state (one-time use)
        await stateDocRef.delete();

        // ========== 3. Validate Lab Exists ==========
        const labRef = db.collection('labs').doc(labId);
        const labSnap = await labRef.get();

        if (labSnap.data() === undefined) {
          logger.warn('[authenticatePortal] Lab not found', { labId });
          return {
            ok: false,
            code: 'LAB_NOT_FOUND',
            message: `Lab ${labId} not found`,
          };
        }

        const labData = labSnap.data();
        if (!labData?.notivisaLabCode) {
          logger.warn('[authenticatePortal] Lab not configured for NOTIVISA', {
            labId,
          });
          return {
            ok: false,
            code: 'LAB_NOT_FOUND',
            message: 'Lab is not configured for NOTIVISA portal integration',
          };
        }

        // ========== 4. Exchange Code for Token ==========
        if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
          logger.error('[authenticatePortal] OAuth credentials not configured');
          return {
            ok: false,
            code: 'INTERNAL_ERROR',
            message: 'Server is not configured for OAuth token exchange',
          };
        }

        let oauthToken;
        try {
          oauthToken = await exchangeOAuthCode(
            code,
            redirectUri,
            OAUTH_CLIENT_ID,
            OAUTH_CLIENT_SECRET,
          );
        } catch (error: any) {
          logger.error('[authenticatePortal] OAuth token exchange failed', {
            error: error.message,
            labId,
          });
          return {
            ok: false,
            code: 'TOKEN_EXCHANGE_FAILED',
            message: `Failed to exchange authorization code: ${error.message}`,
          };
        }

        // ========== 5. Validate and Parse idToken (JWT) ==========
        let professionalInfo;
        try {
          professionalInfo = await parseAndValidateIdToken(oauthToken.id_token);
        } catch (error: any) {
          logger.error('[authenticatePortal] idToken validation failed', {
            error: error.message,
            labId,
          });
          return {
            ok: false,
            code: 'INVALID_TOKEN',
            message: `Failed to validate identity token: ${error.message}`,
          };
        }

        // ========== 6. Create or Get User in Firebase Auth ==========
        let firebaseUser;
        try {
          try {
            firebaseUser = await auth.getUserByEmail(professionalInfo.email);
          } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
              // Create new user (first-time OAuth)
              firebaseUser = await auth.createUser({
                email: professionalInfo.email,
                displayName: professionalInfo.name,
                disabled: false,
              });

              logger.info('[authenticatePortal] New Firebase user created', {
                uid: firebaseUser.uid,
                email: professionalInfo.email,
              });
            } else {
              throw error;
            }
          }
        } catch (error: any) {
          logger.error('[authenticatePortal] Firebase user creation/fetch failed', {
            error: error.message,
            email: professionalInfo.email,
          });
          return {
            ok: false,
            code: 'USER_NOT_FOUND',
            message: `Failed to create/retrieve user: ${error.message}`,
          };
        }

        // ========== 7. Create Portal Session in Firestore ==========
        const now = Date.now();
        const sessionId = `psess_${now}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = now + oauthToken.expires_in * 1000;

        const sessionRef = db
          .collection('notivisa-portal-sessions')
          .doc(labId)
          .collection('sessions')
          .doc(sessionId);

        const xForwardedFor = request.rawRequest.headers['x-forwarded-for'];
        const ipAddress = (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor)?.split(',')[0] || 'unknown';
        const userAgent = request.rawRequest.headers['user-agent'] || 'unknown';

        const sessionDoc = {
          id: sessionId,
          labId,
          userId: firebaseUser.uid,
          accessToken: oauthToken.access_token,
          refreshToken: oauthToken.refresh_token,
          tokenType: oauthToken.token_type,
          scope: oauthToken.scope,
          issuedAt: now,
          expiresAt,
          refreshedAt: null,
          professionalId: professionalInfo.id,
          professionalName: professionalInfo.name,
          professionalEmail: professionalInfo.email,
          professionalRole: professionalInfo.role,
          notivisaLabCode: labData.notivisaLabCode,
          connectedAt: now,
          lastActivityAt: now,
          ipAddress,
          userAgent,
          status: 'active',
          errorMessage: null,
          criadoEm: now,
          atualizadoEm: now,
          deletadoEm: null,
        };

        await sessionRef.set(sessionDoc);

        logger.info('[authenticatePortal] Session created', {
          sessionId,
          labId,
          userId: firebaseUser.uid,
          professionalRole: professionalInfo.role,
        });

        // ========== 8. Issue Custom Firebase Token ==========
        const customToken = await auth.createCustomToken(firebaseUser.uid, {
          labId,
          portalSessionId: sessionId,
          professionalRole: professionalInfo.role,
          portalOAuthToken: {
            accessToken: oauthToken.access_token,
            refreshToken: oauthToken.refresh_token,
            expiresIn: oauthToken.expires_in,
          },
        });

        // ========== 9. Audit Log ==========
        const auditRef = db
          .collection('notivisa-portal-audit')
          .doc(labId)
          .collection('events')
          .doc(`audit_${now}_${Math.random().toString(36).substr(2, 9)}`);

        await auditRef.set({
          action: 'SESSION_CREATED',
          ts: now,
          sessionId,
          userId: firebaseUser.uid,
          professionalEmail: professionalInfo.email,
          professionalRole: professionalInfo.role,
          labId,
          criadoEm: now,
          deletadoEm: null,
        });

        return {
          ok: true,
          sessionId,
          firebaseToken: customToken,
          expiresAt,
          professionalName: professionalInfo.name,
          professionalRole: professionalInfo.role,
        };
      } catch (error: any) {
        logger.error('[authenticatePortal] Unhandled error', {
          error: error.message,
          stack: error.stack,
        });

        if (error instanceof z.ZodError) {
          return {
            ok: false,
            code: 'INVALID_INPUT',
            message: error.errors[0].message,
          };
        }

        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error during OAuth authentication',
        };
      }
    },
);

// ─── OAuth Token Exchange ───────────────────────────────────────────────────

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  id_token: string;
  scope: string;
}

async function exchangeOAuthCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<OAuthTokenResponse> {
  const tokenEndpoint = `${NOTIVISA_IDP_BASE}/oauth/token`;

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(TOKEN_EXCHANGE_TIMEOUT),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OAuth token exchange failed: ${response.status} ${errorData.error_description || response.statusText}`,
    );
  }

  const data = (await response.json()) as OAuthTokenResponse;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    id_token: data.id_token,
    scope: data.scope,
  };
}

// ─── idToken (JWT) Parsing & Validation ──────────────────────────────────────

/**
 * Validates and extracts claims from JWT (idToken)
 * Does NOT verify signature (trust NOTIVISA IDP)
 */
interface IdTokenClaims {
  id: string;
  name: string;
  email: string;
  role: 'RT' | 'MEDICO' | 'DIRETOR' | 'AUDITOR';
  aud: string;
  exp: number;
  iat: number;
}

async function parseAndValidateIdToken(idToken: string): Promise<IdTokenClaims> {
  // JWT format: header.payload.signature
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  // Decode payload (base64url)
  let payload;
  try {
    const decoded = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf-8');
    payload = JSON.parse(decoded);
  } catch (error) {
    throw new Error('Failed to decode JWT payload');
  }

  // Validate claims
  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp < now) {
    throw new Error('Token expired');
  }

  if (!payload.sub && !payload.professional_id) {
    throw new Error('Token missing subject (professional ID)');
  }

  if (!payload.email) {
    throw new Error('Token missing email claim');
  }

  if (!payload.name) {
    throw new Error('Token missing name claim');
  }

  const validRoles = ['RT', 'MEDICO', 'DIRETOR', 'AUDITOR'];
  if (!payload.role || !validRoles.includes(payload.role)) {
    throw new Error(`Invalid role: ${payload.role}`);
  }

  return {
    id: payload.professional_id || payload.sub,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    aud: payload.aud,
    exp: payload.exp,
    iat: payload.iat,
  };
}

export default { authenticatePortal };
