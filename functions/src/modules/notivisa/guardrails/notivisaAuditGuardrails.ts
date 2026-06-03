/**
 * notivisaAuditGuardrails.ts — Audit trail validation for NOTIVISA submissions
 * Wave 3-10 — RDC 978 Art. 204 + DICQ 4.4 compliance
 *
 * Purpose: Ensure every NOTIVISA submission has complete audit trail (HMAC chain)
 * and every revocation has reason logged (LGPD Art. 11 — right to erasure).
 *
 * Pattern: Mirrors `educacao-continuada` audit logging
 */

import * as admin from 'firebase-admin';
import {
  LogicalSignature,
  generateLogicalSignature,
  verifyLogicalSignature,
} from '../../../shared/cryptoaudit';

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Types
// ─────────────────────────────────────────────────────────────────────────────

export type NotivisaAuditEventType =
  | 'DRAFT_CREATED'
  | 'DRAFT_APPROVED'
  | 'DRAFT_REJECTED'
  | 'DRAFT_SUBMITTED'
  | 'SUBMISSION_SUCCEEDED'
  | 'SUBMISSION_FAILED'
  | 'DRAFT_REVOKED'
  | 'AUDIT_OVERRIDE';

export interface NotivisaAuditLogEntry {
  id: string;
  labId: string;
  draftId: string;
  eventType: NotivisaAuditEventType;
  operatorId: string;
  timestamp: number;
  details: Record<string, unknown>;
  signature: LogicalSignature;
  prevHash?: string; // For chain linking
  createdAt: admin.firestore.Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Trail Validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that audit trail exists and is unbroken for a draft
 */
export async function validateNotivisaAuditTrail(
  db: admin.firestore.Firestore,
  labId: string,
  draftId: string,
): Promise<{
  valid: boolean;
  chainIntact: boolean;
  entryCount: number;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const auditRef = db
      .collection(`notivisa-drafts/${labId}/drafts/${draftId}/auditLog`)
      .orderBy('timestamp', 'asc');

    const snapshot = await auditRef.get();
    const entries = snapshot.docs.map((doc) => doc.data() as NotivisaAuditLogEntry);

    if (entries.length === 0) {
      errors.push('No audit log entries found for draft');
      return {
        valid: false,
        chainIntact: false,
        entryCount: 0,
        errors,
      };
    }

    // ========== 1. Verify each entry has signature ==========
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.signature || !entry.signature.hash) {
        errors.push(`Entry ${i}: Missing signature hash`);
      }
      if (!entry.operatorId) {
        errors.push(`Entry ${i}: Missing operatorId`);
      }
      if (!entry.timestamp) {
        errors.push(`Entry ${i}: Missing timestamp`);
      }
    }

    // ========== 2. Verify chain integrity ==========
    let prevHash: string | undefined;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const entryPayload = {
        eventType: entry.eventType,
        operatorId: entry.operatorId,
        timestamp: entry.timestamp,
        details: entry.details,
      };

      const isValid = verifyLogicalSignature(entry.signature, entryPayload, prevHash);
      if (!isValid) {
        errors.push(`Entry ${i}: Signature verification failed (chain may be tampered)`);
      }

      prevHash = entry.signature.hash;
    }

    // ========== 3. Check for required events ==========
    const eventTypes = new Set(entries.map((e) => e.eventType));

    // DRAFT_CREATED must be first
    if (entries[0]?.eventType !== 'DRAFT_CREATED') {
      errors.push('First audit event must be DRAFT_CREATED');
    }

    // DRAFT_SUBMITTED requires prior DRAFT_APPROVED
    if (eventTypes.has('DRAFT_SUBMITTED') && !eventTypes.has('DRAFT_APPROVED')) {
      errors.push('DRAFT_SUBMITTED found without prior DRAFT_APPROVED');
    }

    const chainIntact = errors.length === 0;

    return {
      valid: chainIntact,
      chainIntact,
      entryCount: entries.length,
      errors,
    };
  } catch (err) {
    errors.push(`Database error: ${err instanceof Error ? err.message : 'Unknown'}`);
    return {
      valid: false,
      chainIntact: false,
      entryCount: 0,
      errors,
    };
  }
}

/**
 * Validate revocation has required reason (LGPD Art. 11)
 */
export async function validateRevocationReason(
  db: admin.firestore.Firestore,
  labId: string,
  draftId: string,
): Promise<{
  valid: boolean;
  reason?: string;
  error?: string;
}> {
  try {
    // Find the most recent DRAFT_REVOKED event
    const snapshot = await db
      .collection(`notivisa-drafts/${labId}/drafts/${draftId}/auditLog`)
      .where('eventType', '==', 'DRAFT_REVOKED')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return {
        valid: true, // No revocation found — valid state
        reason: undefined,
      };
    }

    const entry = snapshot.docs[0].data() as NotivisaAuditLogEntry;
    const reason = entry.details?.reason as string | undefined;

    if (!reason || reason.length < 10) {
      return {
        valid: false,
        error: 'Revocation reason must be at least 10 characters (LGPD Art. 11 requirement)',
      };
    }

    return {
      valid: true,
      reason,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Database error: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Writer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write immutable audit log entry with HMAC chain
 */
export async function writeNotivisaAuditLog(
  db: admin.firestore.Firestore,
  labId: string,
  draftId: string,
  event: {
    eventType: NotivisaAuditEventType;
    operatorId: string;
    details: Record<string, unknown>;
  },
): Promise<{
  entryId: string;
  signature: LogicalSignature;
}> {
  // ========== 1. Get previous hash (for chain linking) ==========
  let prevHash: string | undefined;
  try {
    const lastSnapshot = await db
      .collection(`notivisa-drafts/${labId}/drafts/${draftId}/auditLog`)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (!lastSnapshot.empty) {
      const lastEntry = lastSnapshot.docs[0].data() as NotivisaAuditLogEntry;
      prevHash = lastEntry.signature.hash;
    }
  } catch (err) {
    console.warn('[NOTIVISA_AUDIT] Could not retrieve previous hash for chain linking:', err);
  }

  // ========== 2. Generate signature ==========
  const eventPayload = {
    eventType: event.eventType,
    operatorId: event.operatorId,
    timestamp: Date.now(),
    details: event.details,
  };

  const signature = generateLogicalSignature(event.operatorId, eventPayload, prevHash);

  // ========== 3. Write to Firestore (immutable) ==========
  const auditRef = db.collection(`notivisa-drafts/${labId}/drafts/${draftId}/auditLog`).doc();

  const logEntry: NotivisaAuditLogEntry = {
    id: auditRef.id,
    labId,
    draftId,
    eventType: event.eventType,
    operatorId: event.operatorId,
    timestamp: Date.now(),
    details: event.details,
    signature,
    prevHash,
    createdAt: admin.firestore.Timestamp.now(),
  };

  await auditRef.set(logEntry);

  return {
    entryId: auditRef.id,
    signature,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Summary Report
// ─────────────────────────────────────────────────────────────────────────────

export async function generateNotivisaAuditSummary(
  db: admin.firestore.Firestore,
  labId: string,
  draftId: string,
): Promise<{
  draftId: string;
  entryCount: number;
  timeline: Array<{
    timestamp: number;
    eventType: string;
    operatorId: string;
    details: Record<string, unknown>;
  }>;
  chainValid: boolean;
  hasRevocation: boolean;
}> {
  const auditRef = db
    .collection(`notivisa-drafts/${labId}/drafts/${draftId}/auditLog`)
    .orderBy('timestamp', 'asc');

  const snapshot = await auditRef.get();
  const entries = snapshot.docs.map((doc) => doc.data() as NotivisaAuditLogEntry);

  // Verify chain
  const validation = await validateNotivisaAuditTrail(db, labId, draftId);

  return {
    draftId,
    entryCount: entries.length,
    timeline: entries.map((e) => ({
      timestamp: e.timestamp,
      eventType: e.eventType,
      operatorId: e.operatorId,
      details: e.details,
    })),
    chainValid: validation.chainIntact,
    hasRevocation: entries.some((e) => e.eventType === 'DRAFT_REVOKED'),
  };
}
