/**
 * crons/pollNotivisaStatus.ts — Poll NOTIVISA submission status
 *
 * Wave 3 Agent 3 — Cloud Scheduler cron
 *
 * Every 5 minutes:
 *   1. Query all drafts with status: 'submitted-http'
 *   2. For each draft:
 *      a. Call HTTP client checkStatus(statusId)
 *      b. If approved: call retrieveApproval(), store certificateUrl
 *      c. If rejected: mark status 'rejected-http', log reason
 *      d. If pending: increment poll count, re-enqueue for next cycle
 *   3. Log summary: how many polled, approved, rejected, pending
 *
 * Pagination: max 100 drafts per poll cycle (to avoid timeout)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';

import { NotivisaHTTPClient } from '../http/client';
import { writeAuditLog } from '../../../shared/audit/writeAuditLog';

const notivisaSandboxKey = defineSecret('NOTIVISA_SANDBOX_KEY');
const notivisaSandboxUrl = defineSecret('NOTIVISA_SANDBOX_URL');
const notivisaProdKey = defineSecret('NOTIVISA_PROD_KEY');
const notivisaProdUrl = defineSecret('NOTIVISA_PROD_URL');

const POLL_BATCH_SIZE = 100; // Max drafts per poll cycle
const MAX_POLL_COUNT = 12; // Max 1 hour of polling (5 min × 12 = 60 min)

interface DraftPollStatus {
  labId: string;
  draftId: string;
  statusId: string;
  docRef: admin.firestore.DocumentReference;
}

interface PollCycleResult {
  polled: number;
  approved: number;
  rejected: number;
  pending: number;
  errors: number;
}

/**
 * Get credentials for the given lab
 * For now, all labs use sandbox credentials.
 */
function getCredentials(mode: 'sandbox' | 'prod'): {
  apiKey: string;
  baseUrl: string;
} {
  if (mode === 'prod') {
    return {
      apiKey: process.env.NOTIVISA_PROD_KEY || 'PENDING_SET_NOTIVISA_PROD_KEY',
      baseUrl: process.env.NOTIVISA_PROD_URL || 'PENDING_SET_NOTIVISA_PROD_URL',
    };
  }

  return {
    apiKey:
      process.env.NOTIVISA_SANDBOX_KEY || 'PENDING_SET_NOTIVISA_SANDBOX_KEY',
    baseUrl:
      process.env.NOTIVISA_SANDBOX_URL || 'PENDING_SET_NOTIVISA_SANDBOX_URL',
  };
}

/**
 * Run one poll cycle
 *
 * Queries drafts with status 'submitted-http', checks their status,
 * and updates accordingly.
 */
export async function runPollCycleOnce(
  db: admin.firestore.Firestore = admin.firestore(),
): Promise<PollCycleResult> {
  const result: PollCycleResult = {
    polled: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    errors: 0,
  };

  // Query all drafts with status 'submitted-http' across all labs
  // Using collectionGroup to avoid iterating labs explicitly
  const snap = await db
    .collectionGroup('drafts')
    .where('status', '==', 'submitted-http')
    .where('notivisaStatusId', '!=', null)
    .limit(POLL_BATCH_SIZE)
    .get();

  console.info('[NOTIVISA_POLL_CYCLE] Started', {
    draftCount: snap.size,
    timestamp: new Date().toISOString(),
  });

  for (const doc of snap.docs) {
    const data = doc.data() as any;

    // Verify this is actually in notivisa-drafts collection
    if (!doc.ref.path.includes('notivisa-drafts/')) continue;

    const statusId = data.notivisaStatusId as string;
    const labId = data.labId as string;
    const draftId = data.id as string;
    const pollCount = (data.notivisaPollCount || 0) + 1;

    result.polled += 1;

    // Use sandbox credentials for now (Phase 8 will add lab-based routing)
    const creds = getCredentials('sandbox');
    const client = new NotivisaHTTPClient(creds.apiKey, creds.baseUrl);

    // Check status
    const statusResult = await client.checkStatus(statusId);

    if ('status' in statusResult && statusResult.status === 'error') {
      // HTTP error during status check
      result.errors += 1;
      await writeAuditLog({
        action: 'NOTIVISA_POLL_STATUS_FAILED',
        labId,
        payload: {
          draftId,
          statusId,
          error: statusResult.reason,
        },
      });
      continue;
    }

    const govStatus = statusResult.status;

    // Handle based on government status
    const nowTs = admin.firestore.Timestamp.now();

    if (govStatus === 'approved') {
      // Fetch approval details
      const approvalResult = await client.retrieveApproval(statusId);

      if ('status' in approvalResult && approvalResult.status === 'error') {
        // Approval fetch failed, but submission was approved
        // Leave in 'submitted-http' and will retry next poll
        result.errors += 1;
        continue;
      }

      // Update draft: approved
      await doc.ref.update({
        status: 'approved-http',
        notivisaPollCount: pollCount,
        notivisaApprovedAt: nowTs,
        notivisaCertificateUrl: approvalResult.certificateUrl,
        notivisaApprovalId: approvalResult.approvalId,
      });

      result.approved += 1;

      await writeAuditLog({
        action: 'NOTIVISA_DRAFT_APPROVED',
        labId,
        payload: {
          draftId,
          statusId,
          approvalId: approvalResult.approvalId,
          certificateUrl: approvalResult.certificateUrl,
        },
      });
    } else if (govStatus === 'rejected') {
      // Update draft: rejected
      await doc.ref.update({
        status: 'rejected-http',
        notivisaPollCount: pollCount,
        notivisaRejectedAt: nowTs,
        notivisaRejectionReason: statusResult.reason,
      });

      result.rejected += 1;

      await writeAuditLog({
        action: 'NOTIVISA_DRAFT_REJECTED',
        labId,
        payload: {
          draftId,
          statusId,
          reason: statusResult.reason,
        },
      });
    } else if (govStatus === 'processing' || govStatus === 'pending') {
      // Still processing; check if we should give up or re-enqueue
      if (pollCount >= MAX_POLL_COUNT) {
        // Max polling reached; mark as permanently pending
        await doc.ref.update({
          status: 'poll-timeout',
          notivisaPollCount: pollCount,
        });

        await writeAuditLog({
          action: 'NOTIVISA_POLL_TIMEOUT',
          labId,
          payload: {
            draftId,
            statusId,
            pollCount,
          },
        });
      } else {
        // Re-enqueue for next poll cycle
        await doc.ref.update({
          notivisaPollCount: pollCount,
        });

        result.pending += 1;
      }
    }
  }

  // Log cycle summary
  console.info('[NOTIVISA_POLL_CYCLE] Complete', {
    timestamp: new Date().toISOString(),
    ...result,
  });

  await writeAuditLog({
    action: 'NOTIVISA_POLL_CYCLE_COMPLETE',
    payload: result,
  });

  return result;
}

/**
 * Cloud Scheduler cron: every 5 minutes
 */
export const pollNotivisaStatus = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    retryCount: 0,
    secrets: [
      notivisaSandboxKey,
      notivisaSandboxUrl,
      notivisaProdKey,
      notivisaProdUrl,
    ],
  },
  async () => {
    await runPollCycleOnce();
  },
);
