// Weekly integrity check for daily Firestore exports.
//
// Reads the last N days from `/firestore-backup-logs`, queries the Firestore
// Admin Operations API for each operationName, and verifies the export
// finished with state=DONE and no errors. Misses or failures are written to
// `/firestore-backup-alerts` for SuperAdmin review and surfaced via Cloud
// Logging at ERROR severity (which is what hooks Sentry/PagerDuty later).
//
// Schedule: every Monday 04:00 BRT (after the Sunday backup completes).

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';

const PROJECT_ID = 'hmatologia2';
const WINDOW_DAYS = 7;

interface BackupLogDoc {
  operationName: string;
  outputUri: string;
  triggeredAt: admin.firestore.Timestamp;
  kind: 'scheduled' | 'manual';
}

interface OperationStatus {
  date: string;
  operationName: string;
  done: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

async function fetchOperationStatus(
  token: string,
  operationName: string,
): Promise<{ done: boolean; hasError: boolean; errorMessage: string | null }> {
  // operationName is fully-qualified: projects/{p}/databases/{d}/operations/{id}
  const url = `https://firestore.googleapis.com/v1/${operationName}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    return { done: false, hasError: true, errorMessage: `HTTP ${res.status}: ${await res.text()}` };
  }
  const op = (await res.json()) as {
    done?: boolean;
    error?: { code?: number; message?: string };
  };
  return {
    done: op.done === true,
    hasError: op.error != null,
    errorMessage: op.error?.message ?? null,
  };
}

export const scheduledVerifyBackupIntegrity = onSchedule(
  {
    schedule: 'every monday 04:00',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expectedDates: string[] = [];
    for (let i = 1; i <= WINDOW_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      expectedDates.push(d.toISOString().slice(0, 10));
    }

    const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/datastore' });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    if (!tokenRes.token) throw new Error('Failed to obtain OAuth token');
    const token = tokenRes.token;

    const missingDates: string[] = [];
    const failures: OperationStatus[] = [];
    const checked: OperationStatus[] = [];

    for (const date of expectedDates) {
      const snap = await db.collection('firestore-backup-logs').doc(date).get();
      if (!snap.exists) {
        missingDates.push(date);
        continue;
      }
      const log = snap.data() as BackupLogDoc;
      const status = await fetchOperationStatus(token, log.operationName);
      const entry: OperationStatus = {
        date,
        operationName: log.operationName,
        done: status.done,
        hasError: status.hasError,
        errorMessage: status.errorMessage,
      };
      checked.push(entry);
      if (status.hasError || !status.done) failures.push(entry);
    }

    const ok = missingDates.length === 0 && failures.length === 0;

    await db
      .collection('firestore-backup-alerts')
      .doc(today.toISOString().slice(0, 10))
      .set({
        windowDays: WINDOW_DAYS,
        ok,
        missingDates,
        failures,
        checkedCount: checked.length,
        runAt: admin.firestore.Timestamp.now(),
        projectId: PROJECT_ID,
      });

    if (!ok) {
      // ERROR severity in Cloud Logging — hooks alerting later.
      console.error(
        '[verifyBackupIntegrity] ALERT — backup window has gaps or failures.',
        { missingDates, failures },
      );
      throw new Error(
        `Backup integrity FAILED: ${missingDates.length} missing, ${failures.length} failed (last ${WINDOW_DAYS}d)`,
      );
    }

    console.log(
      `[verifyBackupIntegrity] OK — ${checked.length}/${WINDOW_DAYS} backups verified for last ${WINDOW_DAYS} days.`,
    );
  },
);
