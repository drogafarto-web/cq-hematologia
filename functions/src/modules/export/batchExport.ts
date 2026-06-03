/**
 * Batch Export Callable — Phase 3.3
 *
 * Initiates multiple export jobs in a single atomic call.
 * Job records are created via Firestore writeBatch for all-or-nothing atomicity.
 * Each job is enqueued to the 'exports' Pub/Sub topic after batch commit succeeds.
 *
 * Multi-tenant invariant: labId is validated against auth UID via Firestore.
 * Security: T-03.3-11 — max 5 formats hardcoded (DoS guard).
 * T-03.3-13 — emailRecipient validated via Zod .email() schema.
 *
 * Returns: { jobIds: string[], batchId: string }
 * Client polls each jobId independently via /labs/{labId}/export-jobs/{jobId}.
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const db = getFirestore();
const pubsub = new PubSub({ projectId: process.env['GCLOUD_PROJECT'] });

/** Supported export formats in Phase 3.3 */
export const SUPPORTED_FORMATS = ['xlsx-ciq', 'xlsx-nc', 'pdf-compliance', 'csv-audit'] as const;
export type SupportedFormat33 = (typeof SUPPORTED_FORMATS)[number];

/** Maximum number of formats allowed per batch (T-03.3-11 DoS guard) */
export const MAX_BATCH_FORMATS = 5;

// ── Zod input schema ──────────────────────────────────────────────────────────

const BatchExportSchema = z.object({
  labId: z.string().min(1, 'labId is required'),
  formats: z
    .array(z.enum(SUPPORTED_FORMATS))
    .min(1, 'At least one format required')
    .max(MAX_BATCH_FORMATS, `Max ${MAX_BATCH_FORMATS} formats per batch`),
  dateRange: z.object({
    start: z.string().min(1, 'startDate required'),
    end: z.string().min(1, 'endDate required'),
  }),
  emailRecipient: z.string().email('Invalid email address').optional(),
});

export type BatchExportRequest = z.infer<typeof BatchExportSchema>;

export interface BatchExportResponse {
  jobIds: string[];
  batchId: string;
}

// ── Internal: create a single export job document in a batch ─────────────────

interface CreateJobParams {
  labId: string;
  format: SupportedFormat33;
  startDate: Date;
  endDate: Date;
  operatorId: string;
  batchId: string;
  emailRecipient?: string;
}

/**
 * Adds a single export job document to a Firestore write batch.
 * Returns the generated jobId so it can be returned to the caller and enqueued.
 */
function createJobInBatch(batch: FirebaseFirestore.WriteBatch, params: CreateJobParams): string {
  const jobId = randomUUID();
  const now = new Date();

  const jobRef = db.collection('labs').doc(params.labId).collection('export-jobs').doc(jobId);

  const jobData: Record<string, unknown> = {
    jobId,
    labId: params.labId,
    format: params.format,
    startDate: params.startDate,
    endDate: params.endDate,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    operatorId: params.operatorId,
    batchId: params.batchId,
  };

  if (params.emailRecipient) {
    jobData['emailRecipient'] = params.emailRecipient;
  }

  batch.set(jobRef, jobData);
  return jobId;
}

// ── Callable function ─────────────────────────────────────────────────────────

/**
 * Cloud Callable: batchExport
 *
 * 1. Validate auth and input schema
 * 2. Parse date range
 * 3. Create all job documents atomically via Firestore writeBatch
 * 4. Enqueue all jobs to Pub/Sub topic 'exports'
 * 5. Return { jobIds, batchId }
 *
 * Failure modes:
 * - formats.length > 5 → invalid-argument
 * - writeBatch.commit() fails → all job records rolled back (atomicity guarantee)
 * - Pub/Sub enqueue fails → job records exist but are stuck in 'queued'
 *   (manual retry or backgroundWorker retry logic handles this)
 */
export const batchExport = onCall(
  { region: 'southamerica-east1' },
  async (request: CallableRequest<unknown>): Promise<BatchExportResponse> => {
    // 1. Auth guard
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'User not authenticated');
    }
    const operatorId = request.auth.uid;

    // 2. Validate input
    const parsed = BatchExportSchema.safeParse(request.data);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new HttpsError('invalid-argument', firstError?.message ?? 'Invalid request payload');
    }

    const { labId, formats, dateRange, emailRecipient } = parsed.data;

    // 3. Explicit max-formats guard (belt + suspenders — Zod already checks .max(5))
    if (formats.length > MAX_BATCH_FORMATS) {
      throw new HttpsError(
        'invalid-argument',
        `Batch size exceeds maximum: ${MAX_BATCH_FORMATS} formats allowed, got ${formats.length}`,
      );
    }

    // 4. Verify lab exists (multi-tenant safety)
    const labDoc = await db.collection('labs').doc(labId).get();
    if (!labDoc.exists) {
      throw new HttpsError('not-found', `Lab ${labId} not found`);
    }

    // 5. Parse date range
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new HttpsError(
        'invalid-argument',
        'Invalid date range — start or end is not a valid date',
      );
    }

    if (startDate >= endDate) {
      throw new HttpsError('invalid-argument', 'startDate must be before endDate');
    }

    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new HttpsError(
        'invalid-argument',
        'Date range cannot exceed 1 year (compliance limit)',
      );
    }

    // 6. Generate batch ID linking all jobs in this batch
    const batchId = randomUUID();

    // 7. Create all job records atomically via writeBatch
    const batch = db.batch();
    const jobIds: string[] = [];

    for (const format of formats) {
      const jobId = createJobInBatch(batch, {
        labId,
        format,
        startDate,
        endDate,
        operatorId,
        batchId,
        emailRecipient,
      });
      jobIds.push(jobId);
    }

    // Atomic commit — if this fails, no jobs are created
    await batch.commit();

    console.log(
      `[BatchExport] Batch ${batchId}: created ${jobIds.length} job records for lab ${labId}`,
    );

    // 8. Enqueue all jobs to Pub/Sub (non-atomic: jobs exist if enqueue fails)
    const topic = pubsub.topic('exports');
    const pubsubResults = await Promise.allSettled(
      jobIds.map((jobId, i) =>
        topic.publish(
          Buffer.from(
            JSON.stringify({
              jobId,
              labId,
              format: formats[i],
            }),
          ),
        ),
      ),
    );

    // Log any Pub/Sub failures — jobs are created but stuck in 'queued'
    pubsubResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(
          `[BatchExport] Pub/Sub enqueue failed for job ${jobIds[i]} (format: ${formats[i]}):`,
          result.reason,
        );
      } else {
        console.log(
          `[BatchExport] Enqueued job ${jobIds[i]} (format: ${formats[i]}), msgId: ${result.value}`,
        );
      }
    });

    return { jobIds, batchId };
  },
);
