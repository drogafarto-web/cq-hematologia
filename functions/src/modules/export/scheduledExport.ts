/**
 * Scheduled Weekly Export — Phase 3.3
 *
 * Cloud Scheduler trigger: every Sunday at 02:00 UTC
 * Reads all labs with exportSchedule.enabled=true and exportSchedule.frequency='weekly',
 * then initiates batch export for each lab's configured formats and email recipient.
 *
 * Audit trail: writes to /labs/{labId}/auditLogs with operatorId='system/scheduler'
 * (T-03.3-14 mitigation: scheduled export is traceable).
 *
 * Failure mode: per-lab failures are non-fatal (loop continues on error).
 * Lab-level error is logged; lastRunAt is NOT updated for failed labs.
 *
 * Multi-tenant: collectionGroup('exportSchedule') scoped to enabled+weekly docs.
 * Schedule docs live at: /labs/{labId}/exportSchedule (single doc per lab).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { randomUUID } from 'crypto';
import type { SupportedFormat33 } from './batchExport';

const pubsub = new PubSub({ projectId: process.env['GCLOUD_PROJECT'] });

/** Builds the date range covering the previous 7 days (last week) */
function buildLastWeekRange(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Structure of the exportSchedule config document */
interface ExportScheduleConfig {
  enabled: boolean;
  frequency: 'weekly' | 'monthly';
  labId: string;
  formats: SupportedFormat33[];
  emailRecipient?: string;
  lastRunAt?: Timestamp | Date | null;
}

/**
 * Creates job records and enqueues to Pub/Sub for a single lab's scheduled export.
 * Writes to auditLogs for traceability (T-03.3-14).
 */
async function triggerLabExport(
  db: FirebaseFirestore.Firestore,
  labId: string,
  config: ExportScheduleConfig,
  scheduleDocRef: FirebaseFirestore.DocumentReference,
): Promise<void> {
  const { start, end } = buildLastWeekRange();
  const formats = config.formats ?? [];
  const batchId = randomUUID();
  const operatorId = 'system/scheduler';
  const now = new Date();

  if (formats.length === 0) {
    console.warn(`[ScheduledExport] Lab ${labId}: no formats configured, skipping`);
    return;
  }

  // Create job records atomically
  const batch = db.batch();
  const jobIds: string[] = [];

  for (const format of formats) {
    const jobId = randomUUID();
    jobIds.push(jobId);

    const jobRef = db
      .collection('labs')
      .doc(labId)
      .collection('export-jobs')
      .doc(jobId);

    const jobData: Record<string, unknown> = {
      jobId,
      labId,
      format,
      startDate: start,
      endDate: end,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      operatorId,
      batchId,
      triggeredBy: 'scheduler',
    };

    if (config.emailRecipient) {
      jobData['emailRecipient'] = config.emailRecipient;
    }

    batch.set(jobRef, jobData);
  }

  // Audit log entry (T-03.3-14: scheduled export must be traceable)
  const auditRef = db.collection('labs').doc(labId).collection('auditLogs').doc();
  batch.set(auditRef, {
    action: 'SCHEDULED_EXPORT_TRIGGERED',
    operatorId,
    labId,
    triggeredBy: 'scheduler',
    scheduleId: scheduleDocRef.id,
    batchId,
    formats,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    emailRecipient: config.emailRecipient ?? null,
    timestamp: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  console.log(
    `[ScheduledExport] Lab ${labId}: created ${jobIds.length} jobs (batch ${batchId})`,
  );

  // Enqueue to Pub/Sub (non-atomic — jobs exist if enqueue partially fails)
  const topic = pubsub.topic('exports');
  const enqueueResults = await Promise.allSettled(
    jobIds.map((jobId, i) =>
      topic.publish(
        Buffer.from(
          JSON.stringify({ jobId, labId, format: formats[i] }),
        ),
      ),
    ),
  );

  enqueueResults.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(
        `[ScheduledExport] Pub/Sub failed for job ${jobIds[i]} (${formats[i]}):`,
        result.reason,
      );
    }
  });

  // Update lastRunAt after successful job creation
  await scheduleDocRef.update({ lastRunAt: FieldValue.serverTimestamp() });

  console.log(`[ScheduledExport] Lab ${labId}: lastRunAt updated`);
}

/**
 * Cloud Scheduler trigger: weekly export for all labs with active schedule.
 * Cron: every Sunday at 02:00 UTC (0 2 * * 0)
 * Region: southamerica-east1 (same as all other HC Quality functions)
 */
export const scheduledWeeklyExport = onSchedule(
  {
    schedule: '0 2 * * 0',
    timeZone: 'UTC',
    region: 'southamerica-east1',
  },
  async () => {
    const db = getFirestore();
    const runStart = Date.now();

    console.log('[ScheduledExport] Starting weekly export run');

    // Fetch all active weekly schedules across all labs via collectionGroup
    // T-03.3-10: scheduler reads only /exportSchedule docs with enabled:true
    let schedulesSnap: FirebaseFirestore.QuerySnapshot;
    try {
      schedulesSnap = await db
        .collectionGroup('exportSchedule')
        .where('enabled', '==', true)
        .where('frequency', '==', 'weekly')
        .get();
    } catch (err) {
      console.error('[ScheduledExport] Failed to fetch schedule configs:', err);
      return;
    }

    if (schedulesSnap.empty) {
      console.log('[ScheduledExport] No active weekly schedules found');
      return;
    }

    console.log(`[ScheduledExport] Processing ${schedulesSnap.docs.length} lab schedules`);

    let successCount = 0;
    let errorCount = 0;

    for (const schedDoc of schedulesSnap.docs) {
      const config = schedDoc.data() as ExportScheduleConfig;
      const labId = config.labId;

      if (!labId) {
        console.warn('[ScheduledExport] Schedule doc missing labId, skipping:', schedDoc.ref.path);
        errorCount++;
        continue;
      }

      try {
        await triggerLabExport(db, labId, config, schedDoc.ref);
        successCount++;
      } catch (err) {
        // Non-fatal: log error but continue to next lab
        console.error(`[ScheduledExport] Failed for lab ${labId}:`, err);
        errorCount++;
      }
    }

    const durationMs = Date.now() - runStart;
    console.log(
      `[ScheduledExport] Weekly run complete: ` +
      `${successCount} succeeded, ${errorCount} failed, ` +
      `${durationMs}ms total`,
    );
  },
);
