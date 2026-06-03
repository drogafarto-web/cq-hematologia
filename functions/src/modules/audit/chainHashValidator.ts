import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { validateChainIntegrity } from './cryptoAudit';
import { HCQ_SIGNATURE_HMAC_KEY } from '../signatures/verifier';

const db = admin.firestore();

/**
 * Scheduled Cloud Function to validate chain integrity
 * Runs every 12 hours
 */
export const validateChainIntegrityScheduled = onSchedule(
  {
    schedule: 'every 12 hours',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    secrets: [HCQ_SIGNATURE_HMAC_KEY],
  },
  async (context: any) => {
    const secret = HCQ_SIGNATURE_HMAC_KEY.value();
    if (!secret) {
      throw new Error('HCQ_SIGNATURE_HMAC_KEY secret not bound to function');
    }

    try {
      // Validate /ciq-audit
      const ciqResult = await validateChainIntegrity('/ciq-audit', secret);

      if (!ciqResult.valid) {
        console.error('[CRITICAL] Chain integrity violation in /ciq-audit', {
          violations: ciqResult.violations,
          stats: ciqResult.stats,
        });

        // Write violation record to audit log
        await db.collection('audit-violations').add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          collection: '/ciq-audit',
          violationCount: ciqResult.violations.length,
          violations: ciqResult.violations.slice(0, 10), // First 10 only
          severity: 'critical',
          action: 'manual-investigation-required',
        });

        // TODO: Open NC automatically (depends on ADR 0003 implementation)
        // await openNonConformidade({
        //   tipo: 'chain-integrity-violation',
        //   colecao: '/ciq-audit',
        //   severidade: 'critica',
        //   descricao: `Chain integrity violation: ${ciqResult.violations.length} entries affected`,
        // });
      } else {
        console.log('[OK] Chain integrity validation passed', ciqResult.stats);
      }
    } catch (error) {
      console.error('[ERROR] Chain integrity validation failed', error);
      throw error;
    }
  },
);

/**
 * Callable Cloud Function to manually trigger chain validation
 * For debugging / on-demand verification
 */
export const validateChainIntegrityOnDemand = onCall(
  {
    region: 'southamerica-east1',
    secrets: [HCQ_SIGNATURE_HMAC_KEY],
  },
  async (request: any) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Require admin role (check custom claims)
    const claims = request.auth.token as any;
    if (!claims.admin) {
      throw new HttpsError('permission-denied', 'Requires admin role');
    }

    const secret = HCQ_SIGNATURE_HMAC_KEY.value();
    if (!secret) {
      throw new HttpsError('internal', 'HCQ_SIGNATURE_HMAC_KEY not configured');
    }

    try {
      const collectionPath = request.data.collectionPath || '/ciq-audit';
      const result = await validateChainIntegrity(collectionPath, secret);

      return {
        valid: result.valid,
        stats: result.stats,
        violations: result.violations.slice(0, 20),
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Validation failed');
    }
  },
);
