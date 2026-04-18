"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerLabBackup = exports.scheduledDailyBackup = void 0;
require("./collectors/index");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const registry_1 = require("./registry");
const stalenessService_1 = require("./services/stalenessService");
const pdfService_1 = require("./services/pdfService");
const emailService_1 = require("./services/emailService");
// Region is set globally in functions/src/index.ts via setGlobalOptions.
// ─── Helpers ──────────────────────────────────────────────────────────────────
function periodDates() {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    return { from, to };
}
async function processLabBackup(db, labId, backupConfig, force = false) {
    const { from, to } = periodDates();
    // 1. Collect data from all registered modules
    const collectors = registry_1.moduleRegistry.getAll();
    const sectionResults = await Promise.allSettled(collectors.map(c => c.collect(db, labId, from, to)));
    const sections = sectionResults
        .map((r, i) => {
        if (r.status === 'rejected') {
            console.error(`[emailBackup] Collection failed for module "${collectors[i].moduleId}" lab="${labId}":`, r.reason);
            return null;
        }
        return r.value;
    })
        .filter((s) => s !== null);
    // 2. Detect staleness across all modules
    const stalenessAlerts = await (0, stalenessService_1.detectStaleness)(db, labId, backupConfig.stalenessThresholdDays);
    const totalRuns = sections.reduce((sum, s) => sum + s.totalRuns, 0);
    // 3. Decide whether to send
    const hasStaleness = stalenessAlerts.length > 0;
    const hasData = totalRuns > 0;
    const isFirstOfMonth = new Date().getDate() === 1;
    if (!force && !hasData && !hasStaleness && !isFirstOfMonth) {
        return { sent: false, reason: 'no_data_no_alerts' };
    }
    // 4. Build report
    const labSnap = await db.doc(`labs/${labId}`).get();
    const labData = labSnap.data() ?? {};
    const reportWithoutHash = {
        labId,
        labName: labData['name'] ?? labId,
        labCnpj: labData['cnpj'] ?? undefined,
        periodStart: from,
        periodEnd: to,
        sections,
        stalenessAlerts,
        generatedAt: new Date().toISOString(),
    };
    const contentHash = (0, pdfService_1.computeContentHash)(reportWithoutHash);
    const report = { ...reportWithoutHash, contentHash };
    // 5. Generate PDF
    const pdfBuffer = await (0, pdfService_1.generateBackupPdf)(report);
    // 6. Send email
    await (0, emailService_1.sendBackupEmail)({
        to: backupConfig.email,
        report,
        pdfBuffer,
    });
    // 7. Write backup log (non-blocking)
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logEntry = {
        sentAt: admin.firestore.Timestamp.now(),
        toEmail: backupConfig.email,
        labId,
        periodStart: from.toISOString(),
        periodEnd: to.toISOString(),
        totalRuns,
        sectionsIncluded: sections.map(s => s.moduleId),
        stalenessAlerts: stalenessAlerts.length,
        emailSubject: buildLogSubject(report),
    };
    db.doc(`labs/${labId}/backup-logs/${today}`)
        .set(logEntry)
        .catch(err => console.error(`[emailBackup] Failed to write backup log for ${labId}:`, err));
    return { sent: true };
}
function buildLogSubject(report) {
    const totalRuns = report.sections.reduce((s, m) => s + m.totalRuns, 0);
    const alerts = report.stalenessAlerts.length;
    if (alerts > 0)
        return `[ALERTA] ${report.labName} — ${alerts} alerta(s)`;
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
exports.scheduledDailyBackup = (0, scheduler_1.onSchedule)({
    schedule: 'every day 23:45',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: [emailService_1.RESEND_API_KEY],
}, async () => {
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
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const labDoc of labsSnap.docs) {
        const labId = labDoc.id;
        const labData = labDoc.data();
        const backupConfig = labData['backup'];
        if (!backupConfig?.email) {
            skipped++;
            continue;
        }
        try {
            const result = await processLabBackup(db, labId, backupConfig);
            if (result.sent) {
                sent++;
                console.log(`[emailBackup] Sent backup for lab="${labId}"`);
            }
            else {
                skipped++;
                console.log(`[emailBackup] Skipped lab="${labId}" reason="${result.reason}"`);
            }
        }
        catch (err) {
            failed++;
            console.error(`[emailBackup] Failed for lab="${labId}":`, err);
            // Continue processing remaining labs — one failure should not block others
        }
    }
    console.log(`[emailBackup] Done. sent=${sent} skipped=${skipped} failed=${failed}`);
});
// ─── Manual Trigger (SuperAdmin) ─────────────────────────────────────────────
const TriggerBackupInputSchema = {
    parse(data) {
        if (typeof data !== 'object' ||
            data === null ||
            typeof data['labId'] !== 'string') {
            throw new Error('labId (string) is required');
        }
        const d = data;
        return {
            labId: d['labId'],
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
exports.triggerLabBackup = (0, https_1.onCall)({
    region: 'southamerica-east1',
    memory: '512MiB',
    secrets: [emailService_1.RESEND_API_KEY],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    // SuperAdmin check
    const isSuperAdmin = request.auth.token?.['isSuperAdmin'] === true;
    if (!isSuperAdmin) {
        const userSnap = await admin.firestore().doc(`users/${request.auth.uid}`).get();
        if (!userSnap.exists || userSnap.data()?.['isSuperAdmin'] !== true) {
            throw new https_1.HttpsError('permission-denied', 'Apenas Super Admins podem disparar backups manuais.');
        }
    }
    const { labId, force } = TriggerBackupInputSchema.parse(request.data);
    const labSnap = await admin.firestore().doc(`labs/${labId}`).get();
    if (!labSnap.exists) {
        throw new https_1.HttpsError('not-found', `Laboratório ${labId} não encontrado.`);
    }
    const backupConfig = labSnap.data()?.['backup'];
    if (!backupConfig?.email) {
        throw new https_1.HttpsError('failed-precondition', 'Este laboratório não possui e-mail de backup configurado.');
    }
    if (!backupConfig.enabled && !force) {
        throw new https_1.HttpsError('failed-precondition', 'Backup desabilitado para este laboratório. Use force=true para enviar mesmo assim.');
    }
    const db = admin.firestore();
    const result = await processLabBackup(db, labId, backupConfig, force ?? false);
    return {
        success: true,
        sent: result.sent,
        reason: result.reason ?? null,
    };
});
//# sourceMappingURL=index.js.map