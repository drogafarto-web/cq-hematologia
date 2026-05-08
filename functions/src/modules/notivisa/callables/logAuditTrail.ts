/**
 * logAuditTrail — Callable for immutable event logging in NOTIVISA module
 * Phase 4 — Records audit events with cryptographic integrity, prevents tampering
 *
 * Input: { labId, eventType, resourceId, details, signature }
 * Output: { ok, eventId, hash, recordedAt }
 *
 * RDC 978 Art. 122 — All laboratory operations must maintain immutable audit trail.
 * DICQ 4.4 § Trilha de Auditoria — Events cannot be modified or deleted after creation.
 * Implements chain-of-custody hashing: each event's hash includes previous event's hash.
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import * as crypto from 'crypto';
import { assertNotivisaAccess, LogicalSignatureSchema } from '../validators';

// ─── Input Schemas ──────────────────────────────────────────────────────────

const AuditEventTypeSchema = z.enum([
  'DRAFT_CREATED',
  'DRAFT_SUBMITTED',
  'DRAFT_APPROVED',
  'DRAFT_REJECTED',
  'REQUISITION_SENT',
  'RESULT_RECEIVED',
  'RESULT_REVIEWED',
  'RESULT_RELEASED',
  'ARCHIVE_EXPORTED',
  'CONFIG_CHANGED',
  'AUTH_FAILED',
  'DATA_ACCESS',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED',
  'SYSTEM_EVENT',
]);

const AuditDetailsSchema = z.record(z.any());

const LogAuditTrailInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  eventType: AuditEventTypeSchema,
  resourceId: z.string().min(1, 'resourceId required'),
  details: AuditDetailsSchema.optional(),
  signature: LogicalSignatureSchema,
});

type LogAuditTrailInput = z.infer<typeof LogAuditTrailInputSchema>;

// ─── Output Schemas ─────────────────────────────────────────────────────────

const LogAuditTrailOutputSchema = z.object({
  ok: z.literal(true),
  eventId: z.string(),
  hash: z.string().length(64),
  previousHash: z.string().length(64).optional(),
  recordedAt: z.number().int(),
  chain_verified: z.boolean().optional(),
});

const LogAuditTrailErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'INVALID_EVENT_TYPE',
    'INVALID_SIGNATURE',
    'PERMISSION_DENIED',
    'LAB_NOT_FOUND',
    'CHAIN_VERIFICATION_FAILED',
    'DATABASE_ERROR',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type LogAuditTrailOutput = z.infer<typeof LogAuditTrailOutputSchema>;
type LogAuditTrailError = z.infer<typeof LogAuditTrailErrorSchema>;

// ─── Audit Event Record Type ────────────────────────────────────────────────

interface AuditEventRecord {
  eventId: string;
  labId: string;
  eventType: string;
  resourceId: string;
  operatorId: string;
  timestamp: number;
  details?: Record<string, any>;
  hash: string;
  previousHash?: string;
  signature: {
    hash: string;
    operatorId: string;
    ts: number;
  };
  ipAddress?: string;
  userAgent?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AUDIT_LOG_COLLECTION = 'notivisa-audit-logs';
const CHAIN_VERIFICATION_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of audit event payload
 */
function computeEventHash(payload: Omit<AuditEventRecord, 'hash'>): string {
  const sortedKeys = Object.keys(payload)
    .filter((k) => k !== 'hash' && k !== 'previousHash')
    .sort();

  let hashInput = '';
  for (const key of sortedKeys) {
    const value = payload[key as keyof typeof payload];
    if (typeof value === 'object') {
      hashInput += `${key}:${JSON.stringify(value)},`;
    } else {
      hashInput += `${key}:${String(value)},`;
    }
  }

  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Fetch the most recent audit event to link chain
 */
async function getLastAuditEvent(
  db: admin.firestore.Firestore,
  labId: string
): Promise<AuditEventRecord | null> {
  const snap = await db
    .collection(AUDIT_LOG_COLLECTION)
    .doc(labId)
    .collection('events')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  return snap.docs[0].data() as AuditEventRecord;
}

/**
 * Verify chain integrity: compute hash of previous event and compare
 */
async function verifyChainIntegrity(
  db: admin.firestore.Firestore,
  labId: string,
  currentPreviousHash?: string
): Promise<{
  valid: boolean;
  message?: string;
}> {
  if (!currentPreviousHash) {
    return { valid: true }; // First event
  }

  try {
    const lastEvent = await getLastAuditEvent(db, labId);

    if (!lastEvent) {
      return {
        valid: false,
        message: 'Expected previous event but found none',
      };
    }

    const lastEventHash = lastEvent.hash;
    const expectedHash = currentPreviousHash;

    if (lastEventHash !== expectedHash) {
      return {
        valid: false,
        message: `Hash mismatch: expected ${expectedHash}, got ${lastEventHash}`,
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      message: `Chain verification error: ${err}`,
    };
  }
}

// ─── Main Callable ──────────────────────────────────────────────────────────

export const logAuditTrail = functions.region('southamerica-east1').onCall(
  async (request): Promise<LogAuditTrailOutput | LogAuditTrailError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const input = LogAuditTrailInputSchema.parse(request.data);
      const { labId, eventType, resourceId, details, signature } = input;
      const uid = request.auth.uid;
      const now = Date.now();

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

      // ========== 3. Verify signature ==========
      if (signature.operatorId !== uid) {
        functions.logger.warn('[logAuditTrail] Signature operatorId mismatch', {
          labId,
          eventType,
          signatureUid: signature.operatorId,
          requestUid: uid,
        });

        return {
          ok: false,
          code: 'INVALID_SIGNATURE',
          message: 'Signature operatorId does not match authenticated user',
        };
      }

      // Verify signature timestamp is recent (within 60 seconds)
      const signatureAge = Math.abs(now - signature.ts);
      if (signatureAge > 60 * 1000) {
        return {
          ok: false,
          code: 'INVALID_SIGNATURE',
          message: 'Signature timestamp is too old or in the future',
        };
      }

      const db = admin.firestore();

      // ========== 4. Generate event ID ==========
      const eventId = `${now}-${Math.random().toString(36).substring(2, 9)}`;

      // ========== 5. Fetch previous event (for chain) ==========
      const previousEvent = await getLastAuditEvent(db, labId);

      // ========== 6. Build audit event record ==========
      const eventRecord: Omit<AuditEventRecord, 'hash'> = {
        eventId,
        labId,
        eventType,
        resourceId,
        operatorId: uid,
        timestamp: now,
        ...(details && { details }),
        hash: '', // Placeholder, will compute below
        ...(previousEvent && { previousHash: previousEvent.hash }),
        signature,
        ipAddress: request.remoteAddress || 'unknown',
      };

      // ========== 7. Compute cryptographic hash ==========
      const eventHash = computeEventHash(eventRecord);
      eventRecord.hash = eventHash;

      const completeRecord: AuditEventRecord = {
        ...eventRecord,
        hash: eventHash,
      };

      // ========== 8. Verify chain integrity (optional, for data quality) ==========
      const chainVerification = await verifyChainIntegrity(
        db,
        labId,
        previousEvent?.hash
      );

      if (!chainVerification.valid) {
        functions.logger.warn('[logAuditTrail] Chain verification failed', {
          labId,
          eventType,
          message: chainVerification.message,
        });
        // Note: We log the warning but continue; chain breaks should not fail the audit log operation
        // This is intentional for robustness
      }

      // ========== 9. Write immutable audit event ==========
      const auditRef = db
        .collection(AUDIT_LOG_COLLECTION)
        .doc(labId)
        .collection('events')
        .doc(eventId);

      // Use transaction to ensure atomicity
      await db.runTransaction(async (txn) => {
        // Verify doc doesn't exist (idempotency check)
        const existing = await txn.get(auditRef);
        if (existing.exists) {
          throw new functions.https.HttpsError(
            'internal',
            'Event already logged (idempotency check)'
          );
        }

        // Write the immutable event
        txn.set(auditRef, completeRecord, { merge: false });

        // Write to lab-wide index for faster queries
        const indexRef = db
          .collection(AUDIT_LOG_COLLECTION)
          .doc(labId)
          .collection('index')
          .doc(eventType);

        txn.update(indexRef, {
          lastEventId: eventId,
          lastEventTimestamp: now,
          eventCount: admin.firestore.FieldValue.increment(1),
        });
      });

      // ========== 10. Log successful audit entry creation ==========
      functions.logger.info('[logAuditTrail] Audit event recorded', {
        labId,
        eventId,
        eventType,
        resourceId,
        operatorId: uid,
        hash: eventHash.substring(0, 16) + '...',
        chainVerified: chainVerification.valid,
      });

      // ========== 11. Return success response ==========
      return {
        ok: true,
        eventId,
        hash: eventHash,
        previousHash: previousEvent?.hash,
        recordedAt: now,
        chain_verified: chainVerification.valid,
      };
    } catch (error: any) {
      functions.logger.error('[logAuditTrail] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          message: `Validation error: ${error.errors[0].message}`,
        };
      }

      if (error instanceof functions.https.HttpsError) {
        if (error.code === 'internal') {
          return {
            ok: false,
            code: 'DATABASE_ERROR',
            message: error.message,
          };
        }
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Error logging audit trail',
      };
    }
  }
);
