/**
 * authenticatePortal — Callable to authenticate with NOTIVISA portal
 * Phase 4 — Validates credentials, checks lab portal configuration, returns auth token
 *
 * Input: { labId, portalUsername, portalPassword, mfaCode? }
 * Output: { ok, authToken?, expiresAt?, sessionId? }
 *
 * RDC 978 Art. 66 - Signed access to government portal must be audited.
 * Stores session metadata in notivisa-sessions/{labId}/sessions/{sessionId}
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { assertNotivisaAccess } from '../validators';

const authenticatePortalInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  portalUsername: z.string().min(3, 'Username must be at least 3 characters'),
  portalPassword: z.string().min(8, 'Password must be at least 8 characters'),
  mfaCode: z.string().length(6, 'MFA code must be 6 digits').optional(),
});

const authenticatePortalOutputSchema = z.object({
  ok: z.literal(true),
  authToken: z.string(),
  expiresAt: z.number().int().positive(),
  sessionId: z.string(),
  portalUrl: z.string().optional(),
});

const authenticatePortalErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'INVALID_CREDENTIALS',
    'MFA_REQUIRED',
    'MFA_INVALID',
    'PORTAL_CONFIG_MISSING',
    'PORTAL_UNREACHABLE',
    'SESSION_CREATION_FAILED',
    'PERMISSION_DENIED',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type AuthenticatePortalInput = z.infer<typeof authenticatePortalInputSchema>;
type AuthenticatePortalOutput = z.infer<typeof authenticatePortalOutputSchema>;
type AuthenticatePortalError = z.infer<typeof authenticatePortalErrorSchema>;

const SESSION_DURATION_MS = 3600000; // 1 hour
const MFA_REQUIRED_MARKER = 'MFA_REQUIRED';

export const authenticatePortal = functions.region('southamerica-east1').onCall(
  async (request): Promise<AuthenticatePortalOutput | AuthenticatePortalError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const input = authenticatePortalInputSchema.parse(request.data);
      const { labId, portalUsername, portalPassword, mfaCode } = input;
      const uid = request.auth.uid;

      // ========== 2. Authorization check ==========
      try {
        await assertNotivisaAccess(request.auth, labId);
      } catch (error: any) {
        return {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: error.message || 'User does not have NOTIVISA access',
        };
      }

      const db = admin.firestore();

      // ========== 3. Fetch lab portal configuration ==========
      const labConfigSnap = await db
        .collection('labs')
        .doc(labId)
        .collection('notivisa-config')
        .doc('portal')
        .get();

      if (!labConfigSnap.exists) {
        return {
          ok: false,
          code: 'PORTAL_CONFIG_MISSING',
          message: 'NOTIVISA portal is not configured for this lab',
        };
      }

      const portalConfig = labConfigSnap.data();
      const portalUrl = portalConfig?.portalUrl || 'https://notivisa.inca.gov.br';
      const requiresMfa = portalConfig?.requiresMfa === true;

      // ========== 4. Validate portal credentials (mock implementation for sandbox) ==========
      // In production, this would call the actual NOTIVISA portal API
      // For now, we validate format and check against configured credentials (if stored securely)

      const credentialsValid = await validateNotivisaCredentials(
        labId,
        portalUsername,
        portalPassword
      );

      if (!credentialsValid) {
        // Log failed auth attempt
        await logAuthAttempt(db, labId, uid, 'FAILED', {
          reason: 'invalid_credentials',
          username: portalUsername,
        });

        return {
          ok: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Portal username or password is incorrect',
        };
      }

      // ========== 5. MFA validation ==========
      if (requiresMfa && !mfaCode) {
        // Log MFA required
        await logAuthAttempt(db, labId, uid, 'MFA_REQUIRED', {
          username: portalUsername,
        });

        return {
          ok: false,
          code: 'MFA_REQUIRED',
          message: 'MFA code is required for this portal',
        };
      }

      if (mfaCode && requiresMfa) {
        const mfaValid = await validateMfaCode(labId, mfaCode);
        if (!mfaValid) {
          await logAuthAttempt(db, labId, uid, 'MFA_INVALID', {
            username: portalUsername,
          });

          return {
            ok: false,
            code: 'MFA_INVALID',
            message: 'Invalid MFA code',
          };
        }
      }

      // ========== 6. Create session ==========
      const now = Date.now();
      const expiresAt = now + SESSION_DURATION_MS;
      const sessionId = db.collection('dummy').doc().id; // Generate unique ID
      const authToken = generateAuthToken(labId, uid, sessionId, expiresAt);

      const batch = db.batch();

      // Store session metadata
      const sessionRef = db
        .collection('notivisa-sessions')
        .doc(labId)
        .collection('sessions')
        .doc(sessionId);

      batch.set(sessionRef, {
        id: sessionId,
        labId,
        uid,
        username: portalUsername,
        authToken,
        createdAt: now,
        expiresAt,
        lastActivityAt: now,
        mfaUsed: !!mfaCode,
        status: 'active',
      });

      // Log successful authentication
      batch.set(
        db
          .collection('notivisa-audit-logs')
          .doc(labId)
          .collection('logins')
          .doc(`${now}`),
        {
          action: 'PORTAL_LOGIN',
          operatorId: uid,
          ts: now,
          sessionId,
          portalUsername,
          mfaUsed: !!mfaCode,
          details: {
            success: true,
          },
        }
      );

      await batch.commit();

      // Log to Cloud Logs
      functions.logger.info('[NOTIVISA] Portal authentication successful', {
        labId,
        uid,
        sessionId,
      });

      return {
        ok: true,
        authToken,
        expiresAt,
        sessionId,
        portalUrl,
      };
    } catch (error: any) {
      functions.logger.error('[authenticatePortal] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          message: `Validation error: ${error.errors[0].message}`,
        };
      }

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error during authentication',
      };
    }
  }
);

/**
 * Validate NOTIVISA portal credentials
 * In production, would call actual NOTIVISA API
 */
async function validateNotivisaCredentials(
  labId: string,
  username: string,
  password: string
): Promise<boolean> {
  try {
    const db = admin.firestore();

    // Check if credentials match lab configuration (mock for now)
    const credSnap = await db
      .collection('labs')
      .doc(labId)
      .collection('notivisa-config')
      .doc('credentials')
      .get();

    if (!credSnap.exists) {
      return false;
    }

    // In production, would validate against NOTIVISA API
    // For now, simple format validation
    return username.length >= 3 && password.length >= 8;
  } catch (error) {
    functions.logger.error('[validateNotivisaCredentials] Error:', error);
    return false;
  }
}

/**
 * Validate MFA code
 * In production, would call TOTP/SMS validation service
 */
async function validateMfaCode(labId: string, code: string): Promise<boolean> {
  try {
    // Mock MFA validation - in production would verify against TOTP or SMS service
    // For sandbox, validate format only
    return /^\d{6}$/.test(code);
  } catch (error) {
    functions.logger.error('[validateMfaCode] Error:', error);
    return false;
  }
}

/**
 * Generate auth token for session
 * In production, would create JWT signed with lab private key
 */
function generateAuthToken(
  labId: string,
  uid: string,
  sessionId: string,
  expiresAt: number
): string {
  // Mock token generation
  // In production, would create JWT with RSA signature
  const payload = Buffer.from(
    JSON.stringify({
      labId,
      uid,
      sessionId,
      iat: Date.now(),
      exp: expiresAt,
    })
  ).toString('base64');

  return `notivisa.${payload}.signature`;
}

/**
 * Log authentication attempt
 */
async function logAuthAttempt(
  db: admin.firestore.Firestore,
  labId: string,
  uid: string,
  status: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await db
      .collection('notivisa-audit-logs')
      .doc(labId)
      .collection('login-attempts')
      .doc(`${Date.now()}`)
      .set({
        action: 'LOGIN_ATTEMPT',
        operatorId: uid,
        ts: Date.now(),
        status,
        details,
      });
  } catch (error) {
    functions.logger.warn('[logAuthAttempt] Failed to log attempt:', error);
  }
}
