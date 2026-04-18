"use strict";
// ─── CQI Daily Report — Cloud Functions ──────────────────────────────────────
// Scheduled: every day at 23:00 BRT = 02:00 UTC (before the 23:45 backup run).
// Manual:    triggerCQIReport (onCall, SuperAdmin only) — same pattern as
//            triggerLabBackup in the emailBackup module.
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerCQIReport = exports.scheduledDailyCQIReport = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const zod_1 = require("zod");
const generator_1 = require("./generator");
// ─── Scheduled: daily at 23:00 BRT ───────────────────────────────────────────
exports.scheduledDailyCQIReport = (0, scheduler_1.onSchedule)({ schedule: '0 2 * * *', timeZone: 'UTC', region: 'southamerica-east1' }, // 02:00 UTC = 23:00 BRT
async () => {
    const db = admin.firestore();
    const labs = await (0, generator_1.getActiveLabs)(db);
    const date = new Date();
    console.log(`[scheduledDailyCQIReport] processing ${labs.length} labs`);
    await Promise.allSettled(labs.map(lab => (0, generator_1.generateAndSendCQIReport)(lab.labId, date)));
    console.log('[scheduledDailyCQIReport] done');
});
// ─── Manual trigger (SuperAdmin) ──────────────────────────────────────────────
const TriggerSchema = zod_1.z.object({
    labId: zod_1.z.string().min(1),
    date: zod_1.z.string().optional(), // ISO date string; defaults to today
});
exports.triggerCQIReport = (0, https_1.onCall)({ secrets: ['RESEND_API_KEY'], region: 'southamerica-east1' }, async (request) => {
    // Auth guard — mirrors triggerLabBackup pattern
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    const uid = request.auth.uid;
    const token = request.auth.token;
    // SuperAdmin check: custom claim first, Firestore fallback
    const isSuperAdmin = token?.isSuperAdmin === true
        ? true
        : await (async () => {
            const snap = await admin.firestore().doc(`users/${uid}`).get();
            return snap.exists && snap.data()?.isSuperAdmin === true;
        })();
    if (!isSuperAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Apenas Super Admins podem disparar este relatório.');
    }
    const parsed = TriggerSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId, date: dateStr } = parsed.data;
    const date = dateStr ? new Date(dateStr) : new Date();
    console.log(`[triggerCQIReport] uid=${uid} labId=${labId} date=${date.toISOString()}`);
    await (0, generator_1.generateAndSendCQIReport)(labId, date);
    return { ok: true, labId, date: date.toISOString() };
});
//# sourceMappingURL=index.js.map