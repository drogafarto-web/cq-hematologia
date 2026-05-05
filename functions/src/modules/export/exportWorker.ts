import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { generateXlsx } from './generators/xlsxGenerator';
import { ExportJobMessage, ExportJob } from '../../../src/features/export/types';

const db = getFirestore();
const storage = getStorage();

/**
 * Cloud Function: process export jobs from Pub/Sub
 *
 * 1. Read job document from Firestore
 * 2. Query CIQ runs for the date range
 * 3. Generate XLSX via SheetJS
 * 4. Upload to Cloud Storage
 * 5. Generate signed URL (7-day expiry)
 * 6. Update job document with result
 *
 * Timeout: 540s (9 minutes) for large labs
 * Memory: 512MB (sufficient for 100k rows)
 */
export const exportWorker = onMessagePublished(
  {
    topic: 'exports',
    region: 'southamerica-east1',
    timeoutSeconds: 540,
    memory: '512MB',
  },
  async (event) => {
    const startTime = Date.now();
    let message: ExportJobMessage | null = null;

    try {
      // 1. Decode Pub/Sub message
      const messageData = event.data.message.data
        ? Buffer.from(event.data.message.data, 'base64').toString()
        : '';

      message = JSON.parse(messageData);
      const { jobId, labId, format } = message;

      console.log(`[Export Worker] Processing job ${jobId} for lab ${labId}, format ${format}`);

      // 2. Load job document
      const jobRef = db
        .collection('labs')
        .doc(labId)
        .collection('export-jobs')
        .doc(jobId);

      const jobDoc = await jobRef.get();
      if (!jobDoc.exists) {
        throw new Error(`Job document not found: ${jobId}`);
      }

      const job = jobDoc.data() as ExportJob;

      // 3. Update job status to 'processing'
      await jobRef.update({
        status: 'processing',
        startedAt: new Date(),
        updatedAt: new Date(),
      });

      // 4. Query CIQ runs for date range
      const runsQuery = db
        .collection('runs')
        .doc(labId)
        .collection('entries')
        .where('criadoEm', '>=', job.startDate)
        .where('criadoEm', '<=', job.endDate)
        .where('deletadoEm', '==', null); // Soft-delete safety

      const runsSnap = await runsQuery.get();
      const runDocs = runsSnap.docs;

      console.log(`[Export Worker] Found ${runDocs.length} runs for ${jobId}`);

      // 5. Build data array
      const data = runDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 6. Generate XLSX (or PDF/CSV in Phase 3.2)
      let buffer: Buffer;
      let contentType: string;
      let fileExt: string;

      if (format === 'xlsx') {
        buffer = await generateXlsx(data);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExt = 'xlsx';
      } else {
        throw new Error(`Format ${format} not supported in Phase 3.1`);
      }

      // 7. Upload to Cloud Storage
      const bucket = storage.bucket(`${process.env.GCLOUD_PROJECT}.appspot.com`);
      const fileName = `exports/${labId}/${jobId}/export.${fileExt}`;
      const file = bucket.file(fileName);

      await file.save(buffer, {
        metadata: {
          contentType,
          cacheControl: 'private, max-age=604800', // 7 days
        },
      });

      console.log(`[Export Worker] Uploaded to ${fileName}, size: ${buffer.length} bytes`);

      // 8. Generate signed URL (7-day expiry)
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read' as const,
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      // 9. Update job document with result
      const completedAt = new Date();
      const processingDurationMs = completedAt.getTime() - startTime;

      await jobRef.update({
        status: 'completed',
        downloadUrl: signedUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        fileSizeBytes: buffer.length,
        generatedAt: completedAt,
        completedAt,
        updatedAt: completedAt,
        processingDurationMs,
      });

      console.log(
        `[Export Worker] ✓ Job ${jobId} completed in ${processingDurationMs}ms, URL expires in 7 days`
      );

      return { success: true, jobId, processingDurationMs };
    } catch (error: any) {
      console.error(`[Export Worker] ✗ Error:`, error);

      if (message) {
        try {
          // Update job with error status
          const jobRef = db
            .collection('labs')
            .doc(message.labId)
            .collection('export-jobs')
            .doc(message.jobId);

          await jobRef.update({
            status: 'failed',
            errorMessage: error.message || 'Unknown error',
            completedAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (updateErr) {
          console.error('[Export Worker] Failed to update job status:', updateErr);
        }
      }

      throw error; // Pub/Sub will retry
    }
  }
);
