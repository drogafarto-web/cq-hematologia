import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { validateChainIntegrity } from './cryptoAudit';

const db = admin.firestore();

/**
 * Scheduled Cloud Function to validate chain integrity
 * Runs every 12 hours
 */
export const validateChainIntegrityScheduled = functions
  .region('southamerica-east1')
  .pubsub.schedule('every 12 hours')
  .onRun(async context => {
    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) {
      throw new Error('HCQ_SIGNATURE_HMAC_KEY environment variable not set');
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

      return {
        success: true,
        result: ciqResult,
      };
    } catch (error) {
      console.error('[ERROR] Chain integrity validation failed', error);
      throw error;
    }
  });

/**
 * Callable Cloud Function to manually trigger chain validation
 * For debugging / on-demand verification
 */
export const validateChainIntegrityOnDemand = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Require authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    // Require admin role (check custom claims)
    const claims = context.auth.token as any;
    if (!claims.admin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Requires admin role'
      );
    }

    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) {
      throw new functions.https.HttpsError(
        'internal',
        'HCQ_SIGNATURE_HMAC_KEY not configured'
      );
    }

    try {
      const collectionPath = data.collectionPath || '/ciq-audit';
      const result = await validateChainIntegrity(collectionPath, secret);

      return {
        valid: result.valid,
        stats: result.stats,
        violations: result.violations.slice(0, 20), // Limit response size
      };
    } catch (error: any) {
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Validation failed'
      );
    }
  });
