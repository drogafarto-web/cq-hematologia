/**
 * SA-17: archiveAuditReport callable + monthly cron
 *
 * Callable: Archives single report immutably with hash + signature.
 * Cron: Runs 03:00 Sao Paulo on month 1st — archives previous month's reports.
 *
 * RDC 978 5.3 + DICQ 4.4 — immutable audit trail with cryptographic integrity.
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';

const db = admin.firestore();

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArchivePayload {
  labId: string;
  yearMonth: string;
  reportId: string;
  snapshot: any;
  hash: string;
  assinatura: {
    hash: string;
    operatorId: string;
    ts: admin.firestore.Timestamp;
  };
  archivedAt: admin.firestore.Timestamp;
  archivedBy: string;
}

// ─── Input validation ────────────────────────────────────────────────────────

const ArchiveInput = z.object({
  labId: z.string().min(1),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/), // "2026-05"
  reportId: z.string().min(1),
});

type ArchiveInputType = z.infer<typeof ArchiveInput>;

// ─── Helper: Check lab membership ─────────────────────────────────────────────

async function isActiveMemberOfLab(labId: string, uid: string): Promise<boolean> {
  try {
    const snap = await db.collection(`labs/${labId}/members`).doc(uid).get();
    return snap.exists && snap.data()?.active === true;
  } catch {
    return false;
  }
}

// ─── Helper: Generate LogicalSignature ────────────────────────────────────────

function generateSignature(data: any, uid: string): {
  hash: string;
  operatorId: string;
  ts: admin.firestore.Timestamp;
} {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');

  return {
    hash,
    operatorId: uid,
    ts: admin.firestore.Timestamp.now(),
  };
}

// ─── Helper: Archive single report ─────────────────────────────────────────────

async function archiveSingleReport(
  labId: string,
  yearMonth: string,
  reportId: string,
  operatorUid: string,
): Promise<{ archiveId: string; hash: string }> {
  // Check if already archived
  const archivePath = `labs/${labId}/auditoria-archive/${yearMonth}/${reportId}`;
  const archiveSnap = await db.doc(archivePath).get();

  if (archiveSnap.exists) {
    // Idempotent — return existing archive
    return {
      archiveId: reportId,
      hash: archiveSnap.data()?.hash || '',
    };
  }

  // Fetch source report
  const reportSnap = await db.collection(`labs/${labId}/audit-reports`).doc(reportId).get();
  if (!reportSnap.exists) {
    throw new Error(`Report ${reportId} not found`);
  }

  const reportData = reportSnap.data();
  const dataHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(reportData))
    .digest('hex');

  const signature = generateSignature(reportData, operatorUid);

  const payload: ArchivePayload = {
    labId,
    yearMonth,
    reportId,
    snapshot: reportData,
    hash: dataHash,
    assinatura: signature,
    archivedAt: admin.firestore.Timestamp.now(),
    archivedBy: operatorUid,
  };

  // Write to archive (immutable)
  const archiveRef = db.doc(archivePath);
  await archiveRef.set(payload);

  return {
    archiveId: reportId,
    hash: dataHash,
  };
}

// ─── Callable ────────────────────────────────────────────────────────────────

/**
 * archiveAuditReport: Callable to manually archive a report
 */
export const archiveAuditReport = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
  },
  async (request: CallableRequest<ArchiveInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    let input: ArchiveInputType;
    try {
      input = ArchiveInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    const isMember = await isActiveMemberOfLab(input.labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      const result = await archiveSingleReport(
        input.labId,
        input.yearMonth,
        input.reportId,
        request.auth.uid,
      );

      return {
        success: true,
        archiveId: result.archiveId,
        hash: result.hash,
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Archive failed');
    }
  },
);

// ─── Cron Job ─────────────────────────────────────────────────────────────────

/**
 * archiveAuditReportsMonthly: Cron job that runs 03:00 Sao Paulo on month 1st
 * Archives all reports from the previous calendar month for all labs.
 */
export const archiveAuditReportsMonthly = onSchedule(
  {
    schedule: '0 3 1 * *', // 03:00 UTC on the 1st of each month
    timeZone: 'America/Sao_Paulo', // Convert to Sao Paulo time
    region: 'southamerica-east1',
  },
  async () => {
    console.log('[archiveAuditReportsMonthly] Starting monthly archive...');

    try {
      // Calculate previous month
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const yearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

      // Iterate all labs
      const labsSnap = await db.collection('labs').get();
      let totalArchived = 0;

      for (const labSnap of labsSnap.docs) {
        const labId = labSnap.id;

        try {
          // Fetch reports from previous month
          const startDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
          const endDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 1);

          const reportsSnap = await db
            .collection(`labs/${labId}/audit-reports`)
            .where('generatedAt', '>=', startDate)
            .where('generatedAt', '<', endDate)
            .get();

          // Archive each report
          for (const reportSnap of reportsSnap.docs) {
            try {
              await archiveSingleReport(
                labId,
                yearMonth,
                reportSnap.id,
                'system', // System operator UID
              );
              totalArchived++;
            } catch (err) {
              console.warn(`[archiveAuditReportsMonthly] Failed to archive ${reportSnap.id}:`, err);
              // Continue with next report
            }
          }
        } catch (err) {
          console.warn(`[archiveAuditReportsMonthly] Failed to archive lab ${labId}:`, err);
          // Continue with next lab
        }
      }

      console.log(`[archiveAuditReportsMonthly] Completed. Archived ${totalArchived} reports.`);
    } catch (error: any) {
      console.error('[archiveAuditReportsMonthly] Fatal error:', error);
      throw error;
    }
  },
);
