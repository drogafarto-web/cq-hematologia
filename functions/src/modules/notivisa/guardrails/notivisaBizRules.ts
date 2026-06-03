/**
 * notivisaBizRules.ts — NOTIVISA business logic validation
 * Wave 3-10 — Gap check, duplicate detection, RT override tracking
 *
 * Rules:
 * 1. No resubmission of identical payload (duplicate detection via hash)
 * 2. Gap check: submission must happen within 24h of RT approval (RDC 978 Art. 167)
 * 3. Lab can override gap check via force=true (logged as notivisa-override-submission-gap)
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { NotivisaPayload } from '../../../shared/notivisa';

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate content hash of NOTIVISA payload for duplicate detection
 */
export function hashNotivisaPayload(payload: NotivisaPayload): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Check if identical payload was already submitted
 */
export async function checkDuplicatePayload(
  db: admin.firestore.Firestore,
  labId: string,
  payloadHash: string,
): Promise<{
  isDuplicate: boolean;
  previousDraftId?: string;
  previousSubmittedAt?: number;
}> {
  try {
    // Query all drafts with matching payload hash
    const snapshot = await db
      .collection(`notivisa-drafts/${labId}/drafts`)
      .where('payloadHash', '==', payloadHash)
      .where('status', 'in', ['submitted', 'acknowledged'])
      .limit(1)
      .get();

    if (snapshot.empty) {
      return {
        isDuplicate: false,
      };
    }

    const existingDraft = snapshot.docs[0].data();
    return {
      isDuplicate: true,
      previousDraftId: snapshot.docs[0].id,
      previousSubmittedAt: existingDraft.submittedAt,
    };
  } catch (err) {
    console.warn('[NOTIVISA_BIZRULES] Duplicate check failed:', err);
    // On error, allow submission but log warning
    return {
      isDuplicate: false,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gap Check (RDC 978 Art. 167)
// ─────────────────────────────────────────────────────────────────────────────

const SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Validate submission happens within 24h of RT approval
 * RDC 978 Art. 167 — notification to NOTIVISA within 24h of laudo release
 */
export async function checkSubmissionGap(
  db: admin.firestore.Firestore,
  labId: string,
  draftId: string,
): Promise<{
  gapExceeded: boolean;
  approvalTimestamp?: number;
  suggestedBy?: number;
  hoursElapsed?: number;
  error?: string;
}> {
  try {
    // Get draft approval timestamp
    const draftDoc = await db.collection(`notivisa-drafts/${labId}/drafts`).doc(draftId).get();

    if (!draftDoc.exists) {
      return {
        gapExceeded: false,
        error: 'Draft not found',
      };
    }

    const draftData = draftDoc.data();
    const approvedAt = draftData?.approvedAt;

    if (!approvedAt) {
      return {
        gapExceeded: false,
        error: 'Draft has not been approved yet',
      };
    }

    const now = Date.now();
    const gap = now - approvedAt;
    const hoursElapsed = Math.round(gap / (60 * 60 * 1000));
    const gapExceeded = gap > SUBMISSION_WINDOW_MS;

    return {
      gapExceeded,
      approvalTimestamp: approvedAt,
      suggestedBy: approvedAt + SUBMISSION_WINDOW_MS,
      hoursElapsed,
      error: gapExceeded
        ? `Submission window exceeded: ${hoursElapsed}h since approval (max 24h)`
        : undefined,
    };
  } catch (err) {
    return {
      gapExceeded: false,
      error: `Database error: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Override Tracking
// ─────────────────────────────────────────────────────────────────────────────

export interface NotivisaGapOverride {
  draftId: string;
  labId: string;
  operatorId: string;
  approvedAt: number;
  submittedAt: number;
  hoursElapsed: number;
  reason?: string;
  createdAt: admin.firestore.Timestamp;
}

/**
 * Log gap override for audit trail (RDC 978 Art. 204)
 */
export async function logGapOverride(
  db: admin.firestore.Firestore,
  labId: string,
  draftId: string,
  operatorId: string,
  hoursElapsed: number,
  reason?: string,
): Promise<{
  overrideId: string;
}> {
  const overrideRef = db.collection('notivisa-gap-overrides').doc();

  const override: NotivisaGapOverride = {
    draftId,
    labId,
    operatorId,
    approvedAt: Date.now() - hoursElapsed * 60 * 60 * 1000,
    submittedAt: Date.now(),
    hoursElapsed,
    reason,
    createdAt: admin.firestore.Timestamp.now(),
  };

  await overrideRef.set(override);

  console.log('[NOTIVISA_GAP_OVERRIDE]', {
    draftId,
    labId,
    operatorId,
    hoursElapsed,
    reason,
  });

  return {
    overrideId: overrideRef.id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Comprehensive Business Rule Validator
// ─────────────────────────────────────────────────────────────────────────────

export interface NotivisaBizRuleCheckResult {
  valid: boolean;
  errors: Array<{
    code: string;
    message: string;
  }>;
  warnings: Array<{
    code: string;
    message: string;
  }>;
  overrideRequired?: boolean;
}

/**
 * Run all business rule checks for submission
 */
export async function validateNotivisaBizRules(
  db: admin.firestore.Firestore,
  labId: string,
  draftId: string,
  payload: NotivisaPayload,
  options: {
    force?: boolean; // Override all checks
  } = {},
): Promise<NotivisaBizRuleCheckResult> {
  const errors: NotivisaBizRuleCheckResult['errors'] = [];
  const warnings: NotivisaBizRuleCheckResult['warnings'] = [];

  if (options.force) {
    return {
      valid: true,
      errors,
      warnings,
      overrideRequired: false,
    };
  }

  // ========== 1. Duplicate check ==========
  const payloadHash = hashNotivisaPayload(payload);
  const duplicateCheck = await checkDuplicatePayload(db, labId, payloadHash);

  if (duplicateCheck.isDuplicate) {
    errors.push({
      code: 'DUPLICATE_PAYLOAD',
      message: `Identical payload already submitted (draft: ${duplicateCheck.previousDraftId}, submitted: ${new Date(duplicateCheck.previousSubmittedAt || 0).toISOString()}). Use force=true to override.`,
    });
  }

  // ========== 2. Gap check ==========
  const gapCheck = await checkSubmissionGap(db, labId, draftId);

  if (gapCheck.gapExceeded) {
    warnings.push({
      code: 'SUBMISSION_GAP_EXCEEDED',
      message: `${gapCheck.hoursElapsed}h since approval (max 24h per RDC 978 Art. 167). Use force=true to override with reason.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    overrideRequired: warnings.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Report
// ─────────────────────────────────────────────────────────────────────────────

export function summarizeNotivisaBizRules(result: NotivisaBizRuleCheckResult): string {
  if (result.valid && result.warnings.length === 0) {
    return 'All business rules passed ✓';
  }

  const parts: string[] = [];

  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} errors:`);
    result.errors.forEach((e) => {
      parts.push(`  • [${e.code}] ${e.message}`);
    });
  }

  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warnings:`);
    result.warnings.forEach((w) => {
      parts.push(`  • [${w.code}] ${w.message}`);
    });
  }

  return parts.join('\n');
}
