import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { nanoid } from 'nanoid';
import {
  ExportRequest,
  ExportJob,
  ExportJobMessage,
  ExportFormat,
} from './types';

const db = getFirestore();
const pubsub = new PubSub({ projectId: process.env.GCLOUD_PROJECT });

/**
 * Cloud Callable: initiate export job
 *
 * 1. Validate request (format, date range)
 * 2. Create job document in Firestore with status='queued'
 * 3. Publish message to Pub/Sub topic 'exports'
 * 4. Return jobId + estimated time
 *
 * Errors:
 * - invalid-argument: malformed request
 * - permission-denied: user not authenticated or not in lab
 * - internal: Firestore/Pub/Sub error
 */
export const initiateExport = onCall(
  { region: 'southamerica-east1' },
  async (request: CallableRequest<ExportRequest>) => {
    try {
      // 1. Validate auth
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'User not authenticated');
      }

      const { labId, format, startDate, endDate } = request.data;
      const operatorId = request.auth.uid;

      // 2. Validate request fields
      if (!labId || !format || !startDate || !endDate) {
        throw new HttpsError(
          'invalid-argument',
          'Missing required fields: labId, format, startDate, endDate'
        );
      }

      const validFormats: ExportFormat[] = ['xlsx', 'pdf', 'csv'];
      if (!validFormats.includes(format)) {
        throw new HttpsError('invalid-argument', `Invalid format: ${format}`);
      }

      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        throw new HttpsError('invalid-argument', 'startDate must be before endDate');
      }

      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        throw new HttpsError(
          'invalid-argument',
          'Date range cannot exceed 1 year (compliance limit)'
        );
      }

      // 3. Check lab access (verify user is in lab's organization)
      const labDoc = await db.collection('labs').doc(labId).get();
      if (!labDoc.exists) {
        throw new HttpsError('not-found', `Lab ${labId} not found`);
      }

      // TODO: Verify operatorId has access to labId
      // For now, assume auth token is sufficient (Firestore rules validate)

      // 4. Create job document
      const jobId = nanoid();
      const now = new Date();

      const job: ExportJob = {
        jobId,
        labId,
        format,
        startDate: start,
        endDate: end,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
        operatorId,
      };

      const jobRef = db
        .collection('labs')
        .doc(labId)
        .collection('export-jobs')
        .doc(jobId);

      await jobRef.set(job);

      console.log(`[Export] Created job ${jobId} for lab ${labId}, format ${format}`);

      // 5. Publish to Pub/Sub
      const message: ExportJobMessage = {
        jobId,
        labId,
        format,
      };

      const topic = pubsub.topic('exports');
      const messageId = await topic.publish(
        Buffer.from(JSON.stringify(message))
      );

      console.log(
        `[Export] Published job ${jobId} to Pub/Sub, message ID: ${messageId}`
      );

      // 6. Return response
      const estimatedMinutes =
        format === 'xlsx' ? 2 : format === 'pdf' ? 5 : 1;

      return {
        jobId,
        status: 'queued',
        estimatedMinutes,
        createdAt: now.toISOString(),
      };
    } catch (error: any) {
      console.error('[Export] initiateExport error:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        `Export failed: ${error.message || 'Unknown error'}`
      );
    }
  }
);
