/**
 * labApoio_checkExpiry — scheduled Cloud Scheduler function (daily, 06:00 BRT).
 *
 * For each lab's active contracts, compute daysUntil(vigenciaFim).
 * If threshold (60d / 30d / 7d / 0d reached), write notification to
 * /labs/{labId}/notifications/ + send email intent.
 *
 * Idempotency: use key `${contratoId}-${threshold}` to avoid duplicate notifications.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

interface ExpiryNotification {
  tipo: 'contrato-vencendo' | 'contrato-vencido';
  contratoId: string;
  contratoNome: string;
  cnpj: string;
  diasRestantes: number;
  vigenciaFim: string;
  timestamp: admin.firestore.Timestamp;
  idempotencyKey: string;
  emailSent: boolean;
}

export const labApoio_checkExpiry = onSchedule(
  {
    schedule: '0 6 * * *', // 06:00 UTC = 03:00 BRT (summer); 02:00 BRT (winter)
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
  },
  async (event) => {
    const db = admin.firestore();

    // 1. Get all labs
    const labsSnap = await db.collection('labs').get();
    let processedCount = 0;
    let notificationsCreated = 0;

    for (const labDoc of labsSnap.docs) {
      const labId = labDoc.id;

      // 2. Get active, non-deleted contracts
      const contratosSnap = await db
        .collection(`labs/${labId}/lab-apoio`)
        .where('ativo', '==', true)
        .where('deletadoEm', '==', null)
        .get();

      const now = new Date();
      const thresholds = [60, 30, 7, 0]; // days

      for (const contratoDoc of contratosSnap.docs) {
        const contrato = contratoDoc.data();
        const vigenciaFim = new Date(contrato.vigenciaFim as string);
        const daysUntil = Math.floor((vigenciaFim.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Check each threshold
        for (const threshold of thresholds) {
          let shouldNotify = false;

          if (threshold === 0) {
            // 0d = vencido (daysUntil <= 0)
            shouldNotify = daysUntil <= 0;
          } else {
            // daysUntil within [threshold - 1, threshold] (e.g., 60d: daysUntil in [59..60])
            shouldNotify = daysUntil >= threshold - 1 && daysUntil <= threshold;
          }

          if (shouldNotify) {
            const idempotencyKey = `${contratoDoc.id}-${threshold}d`;

            // Check if notification already exists (idempotency)
            const existingNotif = await db
              .collection(`labs/${labId}/notifications`)
              .where('idempotencyKey', '==', idempotencyKey)
              .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(
                new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24h
              ))
              .limit(1)
              .get();

            if (existingNotif.empty) {
              // Create new notification
              const notification: ExpiryNotification = {
                tipo: daysUntil <= 0 ? 'contrato-vencido' : 'contrato-vencendo',
                contratoId: contratoDoc.id,
                contratoNome: contrato.nome as string,
                cnpj: contrato.cnpj as string,
                diasRestantes: Math.max(0, daysUntil),
                vigenciaFim: contrato.vigenciaFim as string,
                timestamp: admin.firestore.Timestamp.now(),
                idempotencyKey,
                emailSent: false,
              };

              await db.collection(`labs/${labId}/notifications`).add(notification);
              notificationsCreated++;

              // TODO: Send email via emailBackup module or logging
              console.log(`[LABAPOIO_EXPIRY] Created notification for ${labId}/${contratoDoc.id}: ${threshold}d threshold`);
            }
          }
        }

        processedCount++;
      }
    }

    console.log(
      `[LABAPOIO_EXPIRY] Daily cron completed: ${processedCount} contracts processed, ${notificationsCreated} notifications created`,
    );
  },
);
