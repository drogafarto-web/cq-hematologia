/**
 * handleMLTeamFeedback.ts
 * Phase 5 Task 05-04: Placeholder for ML Team Fine-Tuning Feedback (v1.5)
 *
 * This function receives feedback from the ML team after they fine-tune
 * a model on the collected dataset. It updates the lab's IA configuration
 * with the new model version and threshold recommendations.
 *
 * Deployed as placeholder in Phase 5; functional implementation in Phase 11+
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const MLFeedbackPayloadSchema = z.object({
  labId: z.string().min(1),
  modelVersion: z.string().min(1), // e.g. "2.1"
  improvedAccuracy: z.number().min(0).max(1),
  notes: z.string().optional(),
  thresholdRecommendation: z.number().min(0).max(1).optional(),
});

interface MLFeedbackPayload {
  labId: string;
  modelVersion: string;
  improvedAccuracy: number;
  notes?: string;
  thresholdRecommendation?: number;
}

// Return type for handleMLTeamFeedback (inferred from return statement)

/**
 * Cloud Function callable: handleMLTeamFeedback
 *
 * Placeholder for Phase 11+ implementation.
 * Currently logs feedback and stores in Firestore for later processing.
 *
 * When implemented:
 * 1. Update lab's imuno-ia-config with new model version
 * 2. Update confidence threshold if provided
 * 3. Schedule A/B test comparison (old vs new model)
 * 4. Notify lab admin of update
 *
 * @param request.data {MLFeedbackPayload}
 * @returns {Promise<MLFeedbackResult>}
 *
 * @throws HttpsError if validation fails
 */
export const handleMLTeamFeedback = onCall(async (request) => {
  const data = request.data as any;
  // Validate authentication (service account from ML pipeline)
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Request must be authenticated');
  }

  // Parse and validate input
  let payload: MLFeedbackPayload;
  try {
    payload = MLFeedbackPayloadSchema.parse(data);
  } catch (error) {
    const validationError =
      error instanceof z.ZodError
        ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
        : 'Unknown validation error';
    throw new HttpsError('invalid-argument', `Validation error: ${validationError}`);
  }

  try {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // Store feedback in Firestore for audit trail
    await db.collection(`labs/${payload.labId}/imuno-ia-feedback`).add({
      labId: payload.labId,
      modelVersion: payload.modelVersion,
      improvedAccuracy: payload.improvedAccuracy,
      notes: payload.notes || '',
      thresholdRecommendation: payload.thresholdRecommendation,
      status: 'PENDING_IMPLEMENTATION', // Phase 11: will be implemented
      receivedAt: now,
      createdAt: now,
      deletedAt: null,
    });

    console.log(
      `Feedback received for lab ${payload.labId}: model v${payload.modelVersion} ` +
        `(accuracy: ${(payload.improvedAccuracy * 100).toFixed(1)}%)`,
    );

    return {
      success: true,
      message: 'Feedback recorded. Implementation scheduled for Phase 11 IA fine-tuning sprint.',
      updatedAt: now.toDate().toISOString(),
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    console.error('ML feedback error:', error);
    throw new HttpsError(
      'internal',
      `Feedback processing failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
});
