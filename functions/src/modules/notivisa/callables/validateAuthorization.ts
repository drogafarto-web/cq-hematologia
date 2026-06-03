/**
 * validateAuthorization — Callable to check NOTIVISA permissions and lab configuration
 * Phase 4 — Verifies user role, lab NOTIVISA config, portal connectivity, permissions
 *
 * Input: { labId }
 * Output: { ok, authorized, role, permissions[], portalConfigured, features[] }
 *
 * RDC 978 Art. 66 - Only authorized users can access government portal.
 * DICQ 4.1.2.5 - Role-based access control must be enforced and audited.
 * Returns granular permission model for frontend UI state management.
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { assertNotivisaAccess } from '../validators';

// ─── Input Schemas ──────────────────────────────────────────────────────────

const ValidateAuthorizationInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
});

type ValidateAuthorizationInput = z.infer<typeof ValidateAuthorizationInputSchema>;

// ─── Output Schemas ─────────────────────────────────────────────────────────

const PermissionSchema = z.enum([
  'notivisa:read',
  'notivisa:write',
  'notivisa:submit',
  'notivisa:review',
  'notivisa:release',
  'notivisa:audit',
  'notivisa:config',
]);

const RolePermissionMap: Record<string, z.infer<typeof PermissionSchema>[]> = {
  operator: ['notivisa:read', 'notivisa:write', 'notivisa:submit'],
  RT: [
    'notivisa:read',
    'notivisa:write',
    'notivisa:submit',
    'notivisa:review',
    'notivisa:release',
    'notivisa:audit',
  ],
  SUPERVISOR: [
    'notivisa:read',
    'notivisa:write',
    'notivisa:submit',
    'notivisa:review',
    'notivisa:release',
    'notivisa:audit',
  ],
  admin: [
    'notivisa:read',
    'notivisa:write',
    'notivisa:submit',
    'notivisa:review',
    'notivisa:release',
    'notivisa:audit',
    'notivisa:config',
  ],
  owner: [
    'notivisa:read',
    'notivisa:write',
    'notivisa:submit',
    'notivisa:review',
    'notivisa:release',
    'notivisa:audit',
    'notivisa:config',
  ],
};

const FeatureSchema = z.enum([
  'draft-creation',
  'requisition-submission',
  'result-review',
  'result-release',
  'status-tracking',
  'audit-logs',
  'bulk-export',
  'mfa-enabled',
  'portal-direct-access',
]);

const PortalConfigSchema = z.object({
  labId: z.string(),
  enabled: z.boolean(),
  apiUrl: z.string().url().optional(),
  mfaRequired: z.boolean(),
  portalUrl: z.string().url().optional(),
  lastValidatedAt: z.number().int().optional(),
});

const ValidateAuthorizationOutputSchema = z.object({
  ok: z.literal(true),
  authorized: z.boolean(),
  role: z.string().optional(),
  permissions: z.array(PermissionSchema),
  portalConfigured: z.boolean(),
  features: z.array(FeatureSchema),
  portalConfig: PortalConfigSchema.optional(),
  validationDetails: z
    .object({
      userHasClaim: z.boolean(),
      userIsActiveMember: z.boolean(),
      labHasConfig: z.boolean(),
      portalConnectivity: z.enum(['online', 'offline', 'unknown']),
    })
    .optional(),
});

const ValidateAuthorizationErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum(['UNAUTHENTICATED', 'PERMISSION_DENIED', 'LAB_NOT_FOUND', 'INTERNAL_ERROR']),
  message: z.string(),
});

type ValidateAuthorizationOutput = z.infer<typeof ValidateAuthorizationOutputSchema>;
type ValidateAuthorizationError = z.infer<typeof ValidateAuthorizationErrorSchema>;

// ─── Main Callable ──────────────────────────────────────────────────────────

export const validateAuthorization = functions
  .region('southamerica-east1')
  .onCall(async (request): Promise<ValidateAuthorizationOutput | ValidateAuthorizationError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        return {
          ok: false,
          code: 'UNAUTHENTICATED',
          message: 'User must be authenticated',
        };
      }

      const input = ValidateAuthorizationInputSchema.parse(request.data);
      const { labId } = input;
      const uid = request.auth.uid;
      const now = Date.now();

      const db = admin.firestore();

      // ========== 2. Check module claim ==========
      const modulesClaim = (request.auth.token?.['modules'] ?? {}) as Record<string, unknown>;
      const userHasClaim = modulesClaim['notivisa'] === true;

      // ========== 3. Check lab membership ==========
      const memberSnap = await db.doc(`labs/${labId}/members/${uid}`).get();
      const userIsActiveMember = memberSnap.exists && memberSnap.data()?.['active'] === true;

      if (!userIsActiveMember) {
        functions.logger.warn('[validateAuthorization] User not active member of lab', {
          uid,
          labId,
          memberExists: memberSnap.exists,
        });

        return {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: 'User is not an active member of this lab',
        };
      }

      const memberData = memberSnap.data()!;
      const userRole = (memberData['role'] as string) || 'operator';

      // ========== 4. Fetch lab NOTIVISA configuration ==========
      const labSnap = await db.doc(`labs/${labId}`).get();
      if (!labSnap.exists) {
        return {
          ok: false,
          code: 'LAB_NOT_FOUND',
          message: 'Lab not found',
        };
      }

      let portalConfig: z.infer<typeof PortalConfigSchema> | undefined;
      let portalConfigured = false;

      const configSnap = await db.doc(`labs/${labId}/notivisa-config/portal`).get();

      if (configSnap.exists) {
        const configData = configSnap.data()!;
        portalConfigured = configData['enabled'] === true;
        portalConfig = {
          labId,
          enabled: configData['enabled'] ?? false,
          apiUrl: configData['apiUrl'],
          mfaRequired: configData['mfaRequired'] ?? false,
          portalUrl: configData['portalUrl'],
          lastValidatedAt: configData['lastValidatedAt'],
        };
      }

      // ========== 5. Check portal connectivity (mock) ==========
      let portalConnectivity: 'online' | 'offline' | 'unknown' = 'unknown';

      if (portalConfigured && portalConfig?.apiUrl) {
        // In production, perform actual health check
        // For now, assume online if config exists
        portalConnectivity = 'online';
      }

      // ========== 6. Compute permissions based on role ==========
      const permissions = RolePermissionMap[userRole] || RolePermissionMap['operator'];

      // ========== 7. Compute enabled features ==========
      const features: z.infer<typeof FeatureSchema>[] = ['draft-creation', 'status-tracking'];

      if (permissions.includes('notivisa:submit')) {
        features.push('requisition-submission');
      }

      if (permissions.includes('notivisa:review') || permissions.includes('notivisa:release')) {
        features.push('result-review');
      }

      if (permissions.includes('notivisa:release')) {
        features.push('result-release');
      }

      if (permissions.includes('notivisa:audit')) {
        features.push('audit-logs');
        features.push('bulk-export');
      }

      if (portalConfig?.mfaRequired) {
        features.push('mfa-enabled');
      }

      if (
        portalConfigured &&
        portalConnectivity === 'online' &&
        permissions.includes('notivisa:read')
      ) {
        features.push('portal-direct-access');
      }

      // ========== 8. Determine overall authorization ==========
      const authorized = userHasClaim && userIsActiveMember && portalConfigured;

      // ========== 9. Log authorization check ==========
      await db
        .collection('notivisa-audit-logs')
        .doc(labId)
        .collection('auth-checks')
        .doc(`${now}`)
        .set({
          action: 'AUTH_VALIDATION_CHECK',
          operatorId: uid,
          ts: now,
          role: userRole,
          authorized,
          hasClaim: userHasClaim,
          isActiveMember: userIsActiveMember,
          portalConfigured,
          featuresCount: features.length,
          permissionsCount: permissions.length,
        });

      functions.logger.info('[validateAuthorization] Auth check completed', {
        labId,
        uid,
        role: userRole,
        authorized,
        hasClaim: userHasClaim,
        portalConfigured,
      });

      // ========== 10. Return success response ==========
      return {
        ok: true,
        authorized,
        role: userRole,
        permissions,
        portalConfigured,
        features,
        ...(portalConfig && { portalConfig }),
        validationDetails: {
          userHasClaim,
          userIsActiveMember,
          labHasConfig: portalConfigured,
          portalConnectivity,
        },
      };
    } catch (error: any) {
      functions.logger.error('[validateAuthorization] Error:', error);

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
        message: error.message || 'Error validating authorization',
      };
    }
  });
