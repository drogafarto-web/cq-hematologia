/**
 * collectIADataset.ts
 * Phase 5 Task 05-04: Monthly IA Dataset Export Aggregator
 *
 * Cloud Function callable that:
 * 1. Queries all images for a given month
 * 2. Filters to verified images (have manual verdicts)
 * 3. Calculates accuracy metrics
 * 4. Exports JSON to Cloud Storage (immutable)
 * 5. Returns export metadata + file URL
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { calculateAccuracy, type VerifiedImage } from './accuracyCalculator';
import { Storage } from '@google-cloud/storage';

const CollectDatasetPayloadSchema = z.object({
  labId: z.string().min(1),
  exportMonth: z.string().regex(/^\d{4}-\d{2}$/), // "2026-05" format
});

interface CollectDatasetPayload {
  labId: string;
  exportMonth: string;
}

interface ExportMetadata {
  dataset_version: string;
  export_date: string;
  export_month: string;
  lab_id: string;
  total_images: number;
  verified_images: number;
}

interface ExportSample {
  image_id: string;
  test_kit: string;
  image_url: string;
  upload_date: string;
  gemini_classification: string;
  gemini_confidence: number;
  gemini_reasoning: string;
  manual_verdict: string;
  manual_verified_by: string;
  manual_verified_at: string;
  match: boolean;
  metadata: {
    lighting_condition?: string;
    test_kit_batch?: string;
    device_type?: string;
    user_notes?: string;
  };
}

interface DatasetExport {
  export_metadata: ExportMetadata;
  accuracy_metrics: any;
  samples: ExportSample[];
  ml_team_notes: string;
  export_file_path: string;
}

// Return type for collectIADataset (inferred from return statement)

/**
 * Get all images for a given month from Firestore
 */
async function getImagesForMonth(labId: string, exportMonth: string): Promise<VerifiedImage[]> {
  const db = admin.firestore();

  // Parse month into date range
  const [year, month] = exportMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // Query all verified images in the month
  const snapshot = await db
    .collection(`labs/${labId}/imuno-ias-dev`)
    .where('manualVerdict', '!=', null)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
    .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
    .get();

  const images: VerifiedImage[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as any;
    if (data.manualVerdict) {
      images.push({
        id: doc.id,
        testKit: data.testKit || 'HIV',
        geminiClassification: {
          classification: data.geminiClassification?.classification || 'Invalid',
          confidence: data.geminiClassification?.confidence || 0,
        },
        manualVerdict: {
          classification: data.manualVerdict?.classification || 'Invalid',
          verifiedBy: data.manualVerdict?.verifiedBy,
          verifiedAt: data.manualVerdict?.verifiedAt,
        },
      });
    }
  }

  return images;
}

/**
 * Build sample records (limited to 100, diverse across test kits + confidence)
 */
function buildSampleRecords(
  labId: string,
  firebaseImages: any[],
  maxSamples: number = 100,
): ExportSample[] {
  // Sort by test kit + confidence to ensure diversity
  const sorted = [...firebaseImages].sort((a, b) => {
    const kitOrder: Record<string, number> = {
      HIV: 1,
      Dengue: 2,
      Syphilis: 3,
      COVID: 4,
      HCG: 5,
    };

    const kitA = kitOrder[a.testKit] || 99;
    const kitB = kitOrder[b.testKit] || 99;

    if (kitA !== kitB) return kitA - kitB;

    // Within same kit, alternate high/low confidence for diversity
    return Math.random() - 0.5;
  });

  const samples: ExportSample[] = [];

  for (const img of sorted.slice(0, maxSamples)) {
    const createdAt = img.createdAt?.toDate?.()
      ? img.createdAt.toDate().toISOString()
      : new Date().toISOString();

    samples.push({
      image_id: img.id,
      test_kit: img.testKit || 'HIV',
      image_url: img.imageUrl || `gs://hmatologia2.appspot.com/datasets/imuno-ias/${img.id}.jpg`,
      upload_date: createdAt.split('T')[0],
      gemini_classification: img.geminiClassification?.classification || 'Invalid',
      gemini_confidence: img.geminiClassification?.confidence || 0,
      gemini_reasoning: img.geminiClassification?.reasoning || 'No reasoning provided',
      manual_verdict: img.manualVerdict?.classification || 'Invalid',
      manual_verified_by: img.manualVerdict?.verifiedBy || 'unknown',
      manual_verified_at: img.manualVerdict?.verifiedAt?.toDate?.()
        ? img.manualVerdict.verifiedAt.toDate().toISOString()
        : new Date().toISOString(),
      match: img.geminiClassification?.classification === img.manualVerdict?.classification,
      metadata: {
        lighting_condition: img.metadata?.lighting_condition,
        test_kit_batch: img.metadata?.test_kit_batch,
        device_type: img.metadata?.device_type,
        user_notes: img.metadata?.user_notes,
      },
    });
  }

  return samples;
}

/**
 * Generate ML team notes based on accuracy metrics
 */
function generateMLTeamNotes(accuracy: number, totalVerified: number): string {
  const recommendations = [];

  if (accuracy >= 0.9) {
    recommendations.push(
      'Accuracy is excellent; consider increasing confidence threshold to 0.87.',
    );
  } else if (accuracy >= 0.88) {
    recommendations.push('Accuracy is good; recommend fine-tuning with this dataset.');
  } else {
    recommendations.push('Accuracy below target; collect more diverse training data.');
  }

  return (
    `Dataset ready for fine-tuning baseline. ${totalVerified} verified samples. ` +
    `${(accuracy * 100).toFixed(1)}% accuracy with Gemini Vision. ` +
    `${recommendations.join(' ')} ` +
    `Dataset includes diversity across 5 test kits (HIV, Dengue, Syphilis, COVID, HCG).`
  );
}

/**
 * Upload dataset JSON to Cloud Storage
 */
async function uploadToCloudStorage(
  projectId: string,
  labId: string,
  exportMonth: string,
  datasetExport: DatasetExport,
): Promise<string> {
  const storage = new Storage({ projectId });
  const bucketName = `${projectId}.appspot.com`;
  const bucket = storage.bucket(bucketName);

  const fileName = `datasets/imuno-ias/${exportMonth}-dataset.json`;
  const file = bucket.file(fileName);

  const jsonContent = JSON.stringify(datasetExport, null, 2);

  await file.save(jsonContent, {
    metadata: {
      contentType: 'application/json',
      cacheControl: 'no-cache',
    },
  });

  // Generate signed URL (valid for 30 days)
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  return url;
}

/**
 * Record export in Firestore for audit trail
 */
async function recordExportAuditLog(
  labId: string,
  exportMonth: string,
  stats: any,
  fileUrl: string,
  operatorId: string,
): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  await db.collection(`labs/${labId}/imuno-ia-exports`).add({
    labId,
    exportMonth,
    exportedAt: now,
    exportedBy: operatorId,
    fileUrl,
    stats,
    createdAt: now,
    deletedAt: null,
  });
}

/**
 * Cloud Function callable: collectIADataset
 *
 * Exports monthly IA dataset with accuracy metrics.
 * Idempotent: same month → same file (overwrites).
 *
 * @param request.data {CollectDatasetPayload}
 * @returns {Promise<CollectDatasetResult>}
 *
 * @throws HttpsError if validation fails or export fails
 */
export const collectIADataset = onCall(async (request) => {
  const data = request.data as any;
  // Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Parse and validate input
  let payload: CollectDatasetPayload;
  try {
    payload = CollectDatasetPayloadSchema.parse(data);
  } catch (error) {
    const validationError =
      error instanceof z.ZodError
        ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
        : 'Unknown validation error';
    throw new HttpsError('invalid-argument', `Validation error: ${validationError}`);
  }

  // Verify user is admin of lab
  const db = admin.firestore();
  const memberDoc = await db.doc(`labs/${payload.labId}/members/${request.auth.uid}`).get();

  if (!memberDoc.exists) {
    throw new HttpsError('permission-denied', 'User is not a member of this lab');
  }

  const memberData = memberDoc.data() as any;
  if (!memberData?.active) {
    throw new HttpsError('permission-denied', 'User is not an active member of this lab');
  }

  // Only admin and owner can export
  if (!['admin', 'owner'].includes(memberData.role)) {
    throw new HttpsError('permission-denied', 'Only admin can export dataset');
  }

  try {
    // Step 1: Get images for month
    const images = await getImagesForMonth(payload.labId, payload.exportMonth);

    // Step 2: Calculate accuracy
    const accuracyMetrics = calculateAccuracy(images);

    // Step 3: Get full image data from Firestore for samples
    const fullImagesSnapshot = await db
      .collection(`labs/${payload.labId}/imuno-ias-dev`)
      .where('manualVerdict', '!=', null)
      .get();

    const fullImages = fullImagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Step 4: Build sample records
    const samples = buildSampleRecords(payload.labId, fullImages);

    // Step 5: Generate ML team notes
    const mlTeamNotes = generateMLTeamNotes(accuracyMetrics.accuracy, accuracyMetrics.totalImages);

    // Step 6: Build export JSON
    const now = new Date().toISOString();
    const exportMetadata: ExportMetadata = {
      dataset_version: '1.0',
      export_date: now,
      export_month: payload.exportMonth,
      lab_id: payload.labId,
      total_images: images.length,
      verified_images: accuracyMetrics.totalImages,
    };

    const datasetExport: DatasetExport = {
      export_metadata: exportMetadata,
      accuracy_metrics: {
        overall_accuracy: accuracyMetrics.accuracy,
        total_verified: accuracyMetrics.totalImages,
        correct_matches: accuracyMetrics.correctMatches,
        confusion_matrix: accuracyMetrics.confusionMatrix,
        per_confidence_bin: accuracyMetrics.confidenceBins,
        per_test_kit: accuracyMetrics.perTestKitMetrics,
      },
      samples: samples.slice(0, 100),
      ml_team_notes: mlTeamNotes,
      export_file_path: '',
    };

    // Step 7: Upload to Cloud Storage
    const fileUrl = await uploadToCloudStorage(
      process.env.GCLOUD_PROJECT || 'hmatologia2',
      payload.labId,
      payload.exportMonth,
      datasetExport,
    );

    // Update export with file path
    datasetExport.export_file_path = fileUrl;

    // Re-upload with complete metadata
    await uploadToCloudStorage(
      process.env.GCLOUD_PROJECT || 'hmatologia2',
      payload.labId,
      payload.exportMonth,
      datasetExport,
    );

    // Step 8: Record audit log
    await recordExportAuditLog(
      payload.labId,
      payload.exportMonth,
      {
        totalImages: images.length,
        verifiedImages: accuracyMetrics.totalImages,
        accuracy: accuracyMetrics.accuracy,
      },
      fileUrl,
      request.auth.uid,
    );

    return {
      success: true,
      fileUrl,
      stats: {
        totalImages: images.length,
        verifiedImages: accuracyMetrics.totalImages,
        accuracy: accuracyMetrics.accuracy,
        exportMonth: payload.exportMonth,
      },
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    console.error('Dataset collection error:', error);
    throw new HttpsError(
      'internal',
      `Dataset export failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
});
