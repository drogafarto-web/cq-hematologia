/**
 * scheduledMigrateNotaFiscalDates — Scheduled Cloud Function
 *
 * Converts legacy NotaFiscal.dataEmissao from string to Timestamp.
 * Runs automatically on schedule (or can be triggered manually).
 *
 * Deploy: firebase deploy --only functions:scheduledMigrateNotaFiscalDates
 */

import * as functions from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const scheduledMigrateNotaFiscalDates = functions.onSchedule(
  {
    schedule: 'every day 02:00', // Daily at 2 AM
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
  },
  async () => {
    console.log('[scheduledMigrateNotaFiscalDates] Starting migration...');

    try {
      const labsSnap = await db.collection('labs').get();
      console.log(`Found ${labsSnap.docs.length} labs`);

      let totalMigrated = 0;
      let totalFailed = 0;
      let totalSkipped = 0;

      for (const labDoc of labsSnap.docs) {
        const labId = labDoc.id;
        const notasSnap = await db.collection(`labs/${labId}/notas-fiscais`).get();

        for (const notaDoc of notasSnap.docs) {
          const data = notaDoc.data();
          const { dataEmissao } = data;

          // Skip if already Timestamp (has _seconds field)
          if (dataEmissao && typeof dataEmissao === 'object' && '_seconds' in dataEmissao) {
            totalSkipped++;
            continue;
          }

          // Convert string to Timestamp
          if (typeof dataEmissao === 'string') {
            try {
              const timestamp = admin.firestore.Timestamp.fromDate(
                new Date(`${dataEmissao}T00:00:00`),
              );
              await notaDoc.ref.update({ dataEmissao: timestamp });
              totalMigrated++;
            } catch (err) {
              totalFailed++;
              console.error(`Failed to convert ${notaDoc.id} (${dataEmissao}):`, err);
            }
          }
        }
      }

      console.log(
        `[scheduledMigrateNotaFiscalDates] Complete: ${totalMigrated} migrated, ${totalFailed} failed, ${totalSkipped} skipped`,
      );
    } catch (err) {
      console.error('[scheduledMigrateNotaFiscalDates] Error:', err);
      throw err;
    }
  },
);
