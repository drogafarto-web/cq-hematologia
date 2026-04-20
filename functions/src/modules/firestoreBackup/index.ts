// ─── Firestore Backup Module ─────────────────────────────────────────────────
//
// Daily Firestore export to Cloud Storage. Defense layer complementing PITR:
//
//   PITR        — 7-day rollback window, ~millisecond granularity, in-place.
//   This module — daily snapshot in GCS, 90-day retention, off-site copy.
//
// Schedule: every day at 03:00 BRT (06:00 UTC), after the 23:45 email run.
//
// Output path: gs://hmatologia2-firestore-backups/daily/YYYY-MM-DD/
//
// Manual trigger: triggerFirestoreExport (onCall, SuperAdmin only).
//
// Restore: see docs/runbooks/firestore-restore.md.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECT_ID = 'hmatologia2';
const DATABASE_ID = '(default)';
const BACKUP_BUCKET = 'hmatologia2-firestore-backups';

const FIRESTORE_ADMIN_API = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${encodeURIComponent(DATABASE_ID)}:exportDocuments`;

// ─── Core export logic ──────────────────────────────────────────────────────

interface ExportRequestBody {
  outputUriPrefix: string;
  collectionIds?: string[]; // omit = export all collections
  namespaceIds?: string[];
  snapshotTime?: string; // RFC 3339; PITR-based consistent snapshot
}

interface ExportResult {
  operationName: string;
  outputUri: string;
  triggeredAt: string;
}

async function triggerFirestoreExport(): Promise<ExportResult> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const outputUri = `gs://${BACKUP_BUCKET}/daily/${today}`;

  const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/datastore' });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error('[firestoreBackup] Failed to obtain OAuth token');
  }

  // PITR-consistent snapshot: 2 minutes ago, rounded DOWN to exact minute
  // (Firestore export API rejects sub-minute precision with INVALID_ARGUMENT).
  const snapDate = new Date(Date.now() - 2 * 60 * 1000);
  snapDate.setSeconds(0, 0);
  const snapshotTime = snapDate.toISOString();

  const body: ExportRequestBody = {
    outputUriPrefix: outputUri,
    snapshotTime,
  };

  const res = await fetch(FIRESTORE_ADMIN_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[firestoreBackup] Export API returned ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { name?: string };
  if (!json.name) {
    throw new Error(
      `[firestoreBackup] Export response missing operation name: ${JSON.stringify(json)}`,
    );
  }

  return {
    operationName: json.name,
    outputUri,
    triggeredAt: new Date().toISOString(),
  };
}

async function writeBackupLog(
  result: ExportResult,
  kind: 'scheduled' | 'manual',
  actorUid?: string,
): Promise<void> {
  try {
    await admin
      .firestore()
      .collection('firestore-backup-logs')
      .doc(result.triggeredAt.slice(0, 10))
      .set(
        {
          kind,
          actorUid: actorUid ?? null,
          operationName: result.operationName,
          outputUri: result.outputUri,
          triggeredAt: admin.firestore.Timestamp.now(),
        },
        { merge: true },
      );
  } catch (err) {
    // Non-blocking — if logging fails, export is still underway
    console.error('[firestoreBackup] Failed to write backup log:', err);
  }
}

// ─── Scheduled: daily at 03:00 BRT (06:00 UTC) ──────────────────────────────

/**
 * Daily backup snapshot. Runs at 03:00 BRT after the 23:45 email run so
 * end-of-day writes are captured.
 *
 * Timeout 540s — exports are async in Firestore (function returns after
 * issuing the export request; Firestore completes it in background, typically
 * in 5-30min for small databases).
 */
export const scheduledFirestoreExport = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async () => {
    try {
      const result = await triggerFirestoreExport();
      console.log(
        `[firestoreBackup][scheduled] Triggered export. ` +
          `operation=${result.operationName} output=${result.outputUri}`,
      );
      await writeBackupLog(result, 'scheduled');
    } catch (err) {
      console.error('[firestoreBackup][scheduled] FAILED:', err);
      throw err; // Let Cloud Scheduler record the failure and retry
    }
  },
);

// ─── Manual Trigger (SuperAdmin) ─────────────────────────────────────────────

/**
 * Triggers a Firestore export on demand. Restricted to SuperAdmin.
 * Use for pre-deploy snapshots, incident response, or verifying the pipeline.
 */
export const triggerFirestoreExport_onCall = onCall(
  {
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const uid = request.auth.uid;
    const token = request.auth.token as Record<string, unknown>;

    const isSuperAdmin =
      token?.isSuperAdmin === true
        ? true
        : await (async () => {
            const snap = await admin.firestore().doc(`users/${uid}`).get();
            return snap.exists && snap.data()?.isSuperAdmin === true;
          })();

    if (!isSuperAdmin) {
      throw new HttpsError(
        'permission-denied',
        'Apenas Super Admins podem disparar backups manuais.',
      );
    }

    console.log(`[firestoreBackup][manual] Triggered by uid=${uid}`);
    const result = await triggerFirestoreExport();
    await writeBackupLog(result, 'manual', uid);

    return {
      ok: true,
      operationName: result.operationName,
      outputUri: result.outputUri,
      triggeredAt: result.triggeredAt,
    };
  },
);
