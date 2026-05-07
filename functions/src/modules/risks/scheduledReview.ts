/**
 * scheduledReview.ts (server — risks module)
 *
 * Cloud Scheduler cron triggers:
 *   - Daily at 07:00 BRT: identify risks due for annual review (reviewDate <= today)
 *   - Monthly (1st of month, 07:00 BRT): flag top-5 critical (npr >= 100)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

export const scheduledReview = onSchedule(
  {
    schedule: '0 7 * * *', // Daily at 07:00 UTC (14:00 BRT, UTC-7 in May)
    region: 'southamerica-east1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const today = new Date(now.toDate()).toISOString().split('T')[0];

    // ─── Query 1: Annual reviews due (reviewDate <= today) ──────────────────

    const annualDue = await db
      .collectionGroup('risks')
      .where('reviewDate', '<=', admin.firestore.Timestamp.fromDate(new Date(today)))
      .where('status', '!=', 'fechado')
      .where('deletadoEm', '==', null)
      .get();

    // Create idempotent notifications (one per risk per date)
    for (const doc of annualDue.docs) {
      const risk = doc.data() as any;
      const labId = risk.labId;
      const riskId = doc.id;
      const idempotencyKey = `${riskId}-annual-${today}`;

      const notifRef = db.doc(
        `labs/${labId}/notifications/${idempotencyKey}`
      );
      const notifSnap = await notifRef.get();

      if (!notifSnap.exists) {
        await notifRef.set(
          {
            riskId,
            type: 'review-due-annual',
            nivel: risk.nivel,
            npr: risk.npr,
            codigo: risk.codigo,
            descricao: risk.descricao,
            createdAt: now,
            read: false,
          },
          { merge: true }
        );
        console.log('[RISK_REVIEW_DUE_ANNUAL]', { riskId, labId });
      }
    }

    // ─── Query 2: Monthly check for top-5 critical (npr >= 100) ───────────

    const currentDate = new Date();
    const isFirstOfMonth = currentDate.getDate() === 1;

    if (isFirstOfMonth) {
      const topCritical = await db
        .collectionGroup('risks')
        .where('npr', '>=', 100)
        .where('status', '!=', 'fechado')
        .where('deletadoEm', '==', null)
        .orderBy('npr', 'desc')
        .limit(5)
        .get();

      const monthKey = today.substring(0, 7); // YYYY-MM

      for (const doc of topCritical.docs) {
        const risk = doc.data() as any;
        const labId = risk.labId;
        const riskId = doc.id;
        const idempotencyKey = `${riskId}-monthly-${monthKey}`;

        const notifRef = db.doc(
          `labs/${labId}/notifications/${idempotencyKey}`
        );
        const notifSnap = await notifRef.get();

        if (!notifSnap.exists) {
          await notifRef.set(
            {
              riskId,
              type: 'review-due-monthly-top5',
              nivel: risk.nivel,
              npr: risk.npr,
              codigo: risk.codigo,
              descricao: risk.descricao,
              createdAt: now,
              read: false,
            },
            { merge: true }
          );
          console.log('[RISK_REVIEW_DUE_MONTHLY]', { riskId, labId, npr: risk.npr });
        }
      }
    }

    console.log('[SCHEDULED_REVIEW_COMPLETE]', {
      timestamp: now.toDate(),
      annualCount: annualDue.size,
      monthlyCheck: isFirstOfMonth,
    });
  },
);
