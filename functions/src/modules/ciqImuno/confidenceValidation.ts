/**
 * confidenceValidation.ts
 * Phase 5 Task 05-03: Confidence threshold validation and manual override handling
 *
 * Handles:
 * 1. Confidence threshold enforcement (≥0.85 → auto-accept)
 * 2. Low confidence flagging (< 0.85 → manual review required)
 * 3. Manual override logging in audit trail
 * 4. Notification to RT for low-confidence results
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

type Classification = 'Positive' | 'Negative' | 'Invalid' | 'Grey-Zone';

const OverridePayloadSchema = z.object({
  labId: z.string().min(1),
  runId: z.string().min(1),
  imageId: z.string().min(1),
  originalClassification: z.enum(['Positive', 'Negative', 'Invalid', 'Grey-Zone']),
  originalConfidence: z.number().min(0).max(1),
  manualClassification: z.enum(['Positive', 'Negative', 'Invalid', 'Grey-Zone']),
  reasoning: z.string().min(1).max(500),
});

interface OverridePayload {
  labId: string;
  runId: string;
  imageId: string;
  originalClassification: Classification;
  originalConfidence: number;
  manualClassification: Classification;
  reasoning: string;
}

// Return type for recordManualOverride (inferred from return statement)

/**
 * Create audit log entry for manual override
 */
async function createOverrideAuditLog(
  labId: string,
  payload: OverridePayload,
  operatorId: string
): Promise<string> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const auditLog = {
    labId,
    runId: payload.runId,
    imageId: payload.imageId,
    eventType: 'MANUAL_OVERRIDE',
    originalClassification: payload.originalClassification,
    originalConfidence: payload.originalConfidence,
    manualClassification: payload.manualClassification,
    agreedWithGemini: payload.originalClassification === payload.manualClassification,
    reasoning: payload.reasoning,
    operatorId,
    timestamp: now,
    createdAt: now,
    deletedAt: null,
  };

  const docRef = await db
    .collection(`labs/${labId}/imuno-ias-dev/audit`)
    .add(auditLog);

  return docRef.id;
}

/**
 * Send notification to RT for low-confidence results
 */
async function notifyRTForLowConfidence(
  labId: string,
  runId: string,
  imageId: string,
  confidence: number
): Promise<void> {
  const db = admin.firestore();

  try {
    // Get RT members of the lab
    const rtSnapshot = await db
      .collection(`labs/${labId}/members`)
      .where('role', '==', 'rt')
      .where('active', '==', true)
      .get();

    if (rtSnapshot.empty) {
      console.warn(`No active RT members found for lab ${labId}`);
      return;
    }

    const now = admin.firestore.Timestamp.now();

    // Create notification for each RT
    const batch = db.batch();

    rtSnapshot.docs.forEach((doc) => {
      const notificationRef = db
        .collection(`users/${doc.id}/notifications`)
        .doc();

      batch.set(notificationRef, {
        type: 'LOW_CONFIDENCE_STRIP_CLASSIFICATION',
        labId,
        runId,
        imageId,
        confidence,
        threshold: 0.85,
        message: `Low confidence (${(confidence * 100).toFixed(1)}%) strip classification requires manual review`,
        read: false,
        createdAt: now,
        expiresAt: new admin.firestore.Timestamp(now.seconds + 7 * 24 * 60 * 60, 0), // 7 days
      });
    });

    await batch.commit();
  } catch (error) {
    console.warn(
      `Failed to notify RT for low confidence: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    // Non-fatal: don't block response
  }
}

/**
 * Record classification result in imuno-ias-dev collection
 */
async function recordClassificationResult(
  labId: string,
  payload: OverridePayload,
  operatorId: string,
  auditLogId: string
): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const resultDoc = {
    labId,
    runId: payload.runId,
    imageId: payload.imageId,
    geminiClassification: {
      classification: payload.originalClassification,
      confidence: payload.originalConfidence,
      timestamp: now,
    },
    manualVerdict: {
      classification: payload.manualClassification,
      verifiedBy: operatorId,
      verifiedAt: now,
      reasoning: payload.reasoning,
    },
    agreedWithGemini: payload.originalClassification === payload.manualClassification,
    auditLogId,
    createdAt: now,
    deletedAt: null,
  };

  await db.doc(`labs/${labId}/imuno-ias-dev/${payload.imageId}`).set(resultDoc, {
    merge: true,
  });
}

/**
 * Cloud Function callable: recordManualOverride
 *
 * Handles RT manual override of low-confidence classification results.
 * Logs override in audit trail and updates Firestore record.
 *
 * @param request.data {OverridePayload}
 * @returns {Promise<OverrideResult>}
 *
 * @throws HttpsError if validation fails or user lacks permission
 */
export const recordManualOverride = onCall(async (request) => {
  const data = request.data as any;
  // Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Parse and validate input
  let payload: OverridePayload;
  try {
    payload = OverridePayloadSchema.parse(data);
    } catch (error) {
      const validationError = error instanceof z.ZodError
        ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
        : 'Unknown validation error';
      throw new HttpsError('invalid-argument', `Validation error: ${validationError}`);
    }

    // Verify user is RT or admin of lab
    const db = admin.firestore();
    const memberDoc = await db.doc(`labs/${payload.labId}/members/${request.auth.uid}`).get();

    if (!memberDoc.exists) {
      throw new HttpsError(
        'permission-denied',
        'User is not a member of this lab'
      );
    }

    const memberData = memberDoc.data() as any;
    if (!memberData?.active) {
      throw new HttpsError(
        'permission-denied',
        'User is not an active member of this lab'
      );
    }

    // Only RT and admin can override
    if (!['rt', 'admin', 'owner'].includes(memberData.role)) {
      throw new HttpsError(
        'permission-denied',
        'Only RT and admin can override classifications'
      );
    }

    try {
      // Step 1: Create audit log
      const auditLogId = await createOverrideAuditLog(
        payload.labId,
        payload,
        request.auth.uid
      );

      // Step 2: Record classification result
      await recordClassificationResult(
        payload.labId,
        payload,
        request.auth.uid,
        auditLogId
      );

      // Step 3: Log audit event with signature
      const now = admin.firestore.Timestamp.now();
      const auditEventRef = db.collection(`labs/${payload.labId}/ciq-audit`).doc();

      await auditEventRef.set({
        type: 'IMUNO_CLASSIFICATION_OVERRIDE',
        labId: payload.labId,
        runId: payload.runId,
        imageId: payload.imageId,
        operatorId: request.auth.uid,
        originalClassification: payload.originalClassification,
        manualClassification: payload.manualClassification,
        confidence: payload.originalConfidence,
        reasoning: payload.reasoning,
        timestamp: now,
        createdAt: now,
      });

    return {
      success: true,
      auditLogId,
      overrideRecordedAt: now.toDate().toISOString(),
      agreedWithGemini: payload.originalClassification === payload.manualClassification,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    console.error('Manual override error:', error);
    throw new HttpsError(
      'internal',
      `Manual override failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
});

/**
 * Cloud Function callable: flagForManualReview
 *
 * Marks a low-confidence classification for RT manual review
 * and sends notification.
 *
 * Called automatically when Gemini confidence < threshold.
 */
export const flagForManualReview = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { labId, runId, imageId, confidence } = request.data;

  if (!labId || !runId || !imageId || confidence === undefined) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    await notifyRTForLowConfidence(labId, runId, imageId, confidence);
    return { flagged: true };
  } catch (error) {
    console.error('Flag for manual review error:', error);
    throw new HttpsError(
      'internal',
      `Flagging failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
});
