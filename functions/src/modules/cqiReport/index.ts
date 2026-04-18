// ─── CQI Daily Report — Cloud Functions ──────────────────────────────────────
// Scheduled: every day at 23:00 BRT = 02:00 UTC (before the 23:45 backup run).
// Manual:    triggerCQIReport (onCall, SuperAdmin only) — same pattern as
//            triggerLabBackup in the emailBackup module.

import { onSchedule }         from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin             from 'firebase-admin';
import { z }                  from 'zod';

import { generateAndSendCQIReport, getActiveLabs } from './generator';

// ─── Scheduled: daily at 23:00 BRT ───────────────────────────────────────────

export const scheduledDailyCQIReport = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'UTC' },   // 02:00 UTC = 23:00 BRT
  async () => {
    const db   = admin.firestore();
    const labs = await getActiveLabs(db);
    const date = new Date();

    console.log(`[scheduledDailyCQIReport] processing ${labs.length} labs`);

    await Promise.allSettled(
      labs.map(lab => generateAndSendCQIReport(lab.labId, date)),
    );

    console.log('[scheduledDailyCQIReport] done');
  },
);

// ─── Manual trigger (SuperAdmin) ──────────────────────────────────────────────

const TriggerSchema = z.object({
  labId: z.string().min(1),
  date:  z.string().optional(),   // ISO date string; defaults to today
});

export const triggerCQIReport = onCall(
  { secrets: ['RESEND_API_KEY'] },
  async (request) => {
    // Auth guard — mirrors triggerLabBackup pattern
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const uid   = request.auth.uid;
    const token = request.auth.token as Record<string, unknown>;

    // SuperAdmin check: custom claim first, Firestore fallback
    const isSuperAdmin = token?.isSuperAdmin === true
      ? true
      : await (async () => {
          const snap = await admin.firestore().doc(`users/${uid}`).get();
          return snap.exists && snap.data()?.isSuperAdmin === true;
        })();

    if (!isSuperAdmin) {
      throw new HttpsError('permission-denied', 'Apenas Super Admins podem disparar este relatório.');
    }

    const parsed = TriggerSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }

    const { labId, date: dateStr } = parsed.data;
    const date = dateStr ? new Date(dateStr) : new Date();

    console.log(`[triggerCQIReport] uid=${uid} labId=${labId} date=${date.toISOString()}`);
    await generateAndSendCQIReport(labId, date);

    return { ok: true, labId, date: date.toISOString() };
  },
);
