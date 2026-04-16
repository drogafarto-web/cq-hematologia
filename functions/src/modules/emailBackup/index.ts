// ─── emailBackup module entry point ──────────────────────────────────────────
//
// Exports two Cloud Functions:
//
//   scheduledDailyBackup  — runs every day at 23:45 BRT, processes all labs
//                           that have backup.enabled = true and backup.email set.
//
//   triggerLabBackup      — onCall, SuperAdmin only — manually triggers a backup
//                           for a specific lab. Useful for on-demand exports or
//                           testing the backup pipeline without waiting for the
//                           scheduled run.
//
// Module registration is side-effectful — importing ./collectors/index seeds
// the moduleRegistry with all available collectors before any function runs.

import './collectors/index';

import { onSchedule }             from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError }     from 'firebase-functions/v2/https';
import { setGlobalOptions }       from 'firebase-functions/v2';
import * as admin                 from 'firebase-admin';
import { createHash }             from 'crypto';

import type { BackupReport, BackupLog, LabBackupConfig } from './types';
import { moduleRegistry }                                from './registry';
import { detectStaleness }                               from './services/stalenessService';
import { generateBackupPdf, computeContentHash }         from './services/pdfService';
import { sendBackupEmail, RESEND_API_KEY }               from './services/emailService';

// Region is set globally in index.ts; repeated here for module self-containment
setGlobalOptions({ region: 'southamerica-east1' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodDates(): { from: Date; to: Date } {
  const to   = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

async function processLabBackup(
  db: admin.firestore.Firestore,
  labId: string,
  backupConfig: LabBackupConfig,
  force: boolean = false,
): Promise<{ sent: boolean; reason?: string }> {
  const { from, to } = periodDates();

  // 1. Collect data from all registered modules
  const collectors = moduleRegistry.getAll();
  const sectionResults = await Promise.allSettled(
    collectors.map(c => c.collect(db, labId, from, to)),
  );

  const sections = sectionResults
    .map((r, i) => {
      if (r.status === 'rejected') {
        console.error(
          `[emailBackup] Collection failed for module "${collectors[i].moduleId}" lab="${labId}":`,
          r.reason,
        );
        return null;
      }
      return r.value;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // 2. Detect staleness across all modules
  const stalenessAlerts = await detectStaleness(
    db, labId, backupConfig.stalenessThresholdDays,
  );

  const totalRuns = sections.reduce((sum, s) => sum + s.totalRuns, 0);

  // 3. Decide whether to send
  const hasStaleness   = stalenessAlerts.length > 0;
  const hasData        = totalRuns > 0;
  const isFirstOfMonth = new Date().getDate() === 1;

  if (!force && !hasData && !hasStaleness && !isFirstOfMonth) {
    return { sent: false, reason: 'no_data_no_alerts' };
  }

  // 4. Build report
  const labSnap = await db.doc(`labs/${labId}`).get();
  const labData = labSnap.data() ?? {};

  const reportWithoutHash: Omit<BackupReport, 'contentHash'> = {
    labId,
    labName:         labData['name'] ?? labId,
    labCnpj:         labData['cnpj']  ?? undefined,
    periodStart:     from,
    periodEnd:       to,
    sections,
    stalenessAlerts,
    generatedAt:     new Date().toISOString(),
  };

  const contentHash = computeContentHash(reportWithoutHash);
  const report: BackupReport = { ...reportWithoutHash, contentHash };

  // 5. Generate PDF
  const pdfBuffer = await generateBackupPdf(report);

  // 6. Send email
  await sendBackupEmail({
    to:        backupConfig.email!,
    report,
    pdfBuffer,
  });

  // 7. Write backup log (non-blocking)
  const today     = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const logEntry: BackupLog = {
    sentAt:           admin.firestore.Timestamp.now(),
    toEmail:          backupConfig.email!,
    labId,
    periodStart:      from.toISOString(),
    periodEnd:        to.toISOString(),
    totalRuns,
    sectionsIncluded: sections.map(s => s.moduleId),
    stalenessAlerts:  stalenessAlerts.length,
    emailSubject:     buildLogSubject(report),
  };

  db.doc(`labs/${labId}/backup-logs/${today}`)
    .set(logEntry)
    .catch(err => console.error(`[emailBackup] Failed to write backup log for ${labId}:`, err));

  return { sent: true };
}

function buildLogSubject(report: BackupReport): string {
  const totalRuns = report.sections.reduce((s, m) => s + m.totalRuns, 0);
  const alerts    = report.stalenessAlerts.length;
  if (alerts > 0) return `[ALERTA] ${report.labName} — ${alerts} alerta(s)`;
  return `${report.labName} — ${totalRuns} corrida(s)`;
}

// ─── Scheduled Function ───────────────────────────────────────────────────────

/**
 * Runs every day at 23:45 BRT (02:45 UTC the following day during -03:00).
 * Iterates all labs with backup enabled and processes each one.
 *
 * Memory: 512MiB — PDF generation is memory-bound.
 * Timeout: 540s  — allows processing up to ~20 labs per run at ~25s each.
 */
export const scheduledDailyBackup = onSchedule(
  {
    schedule:       'every day 23:45',
    timeZone:       'America/Sao_Paulo',
    memory:         '512MiB',
    timeoutSeconds: 540,
    secrets:        [RESEND_API_KEY],
  },
  async () => {
    const db = admin.firestore();

    // Query all labs that have backup enabled — server-side filter
    const labsSnap = await db
      .collection('labs')
      .where('backup.enabled', '==', true)
      .get();

    if (labsSnap.empty) {
      console.log('[emailBackup] No labs with backup enabled. Exiting.');
      return;
    }

    console.log(`[emailBackup] Processing ${labsSnap.size} lab(s)`);

    let sent    = 0;
    let skipped = 0;
    let failed  = 0;

    for (const labDoc of labsSnap.docs) {
      const labId       = labDoc.id;
      const labData     = labDoc.data();
      const backupConfig = labData['backup'] as LabBackupConfig | undefined;

      if (!backupConfig?.email) {
        skipped++;
        continue;
      }

      try {
        const result = await processLabBackup(db, labId, backupConfig);
        if (result.sent) {
          sent++;
          console.log(`[emailBackup] Sent backup for lab="${labId}"`);
        } else {
          skipped++;
          console.log(`[emailBackup] Skipped lab="${labId}" reason="${result.reason}"`);
        }
      } catch (err) {
        failed++;
        console.error(`[emailBackup] Failed for lab="${labId}":`, err);
        // Continue processing remaining labs — one failure should not block others
      }
    }

    console.log(
      `[emailBackup] Done. sent=${sent} skipped=${skipped} failed=${failed}`,
    );
  },
);

// ─── Manual Trigger (SuperAdmin) ─────────────────────────────────────────────

const TriggerBackupInputSchema = {
  parse(data: unknown): { labId: string; force?: boolean } {
    if (
      typeof data !== 'object' ||
      data === null ||
      typeof (data as Record<string, unknown>)['labId'] !== 'string'
    ) {
      throw new Error('labId (string) is required');
    }
    const d = data as Record<string, unknown>;
    return {
      labId: d['labId'] as string,
      force: typeof d['force'] === 'boolean' ? d['force'] : false,
    };
  },
};

/**
 * Manually triggers a backup for a specific lab.
 * Restricted to SuperAdmin. Useful for on-demand exports and debugging.
 *
 * Usage:
 *   triggerLabBackup({ labId: 'abc123' })           // respects send conditions
 *   triggerLabBackup({ labId: 'abc123', force: true }) // sends even if no data today
 */
export const triggerLabBackup = onCall(
  {
    memory:  '512MiB',
    secrets: [RESEND_API_KEY],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    // SuperAdmin check
    const isSuperAdmin = request.auth.token?.['isSuperAdmin'] === true;
    if (!isSuperAdmin) {
      const userSnap = await admin.firestore().doc(`users/${request.auth.uid}`).get();
      if (!userSnap.exists || userSnap.data()?.['isSuperAdmin'] !== true) {
        throw new HttpsError('permission-denied', 'Apenas Super Admins podem disparar backups manuais.');
      }
    }

    const { labId, force } = TriggerBackupInputSchema.parse(request.data);

    const labSnap = await admin.firestore().doc(`labs/${labId}`).get();
    if (!labSnap.exists) {
      throw new HttpsError('not-found', `Laboratório ${labId} não encontrado.`);
    }

    const backupConfig = labSnap.data()?.['backup'] as LabBackupConfig | undefined;
    if (!backupConfig?.email) {
      throw new HttpsError(
        'failed-precondition',
        'Este laboratório não possui e-mail de backup configurado.',
      );
    }
    if (!backupConfig.enabled && !force) {
      throw new HttpsError(
        'failed-precondition',
        'Backup desabilitado para este laboratório. Use force=true para enviar mesmo assim.',
      );
    }

    const db = admin.firestore();
    const result = await processLabBackup(db, labId, backupConfig, force ?? false);

    return {
      success: true,
      sent:    result.sent,
      reason:  result.reason ?? null,
    };
  },
);
