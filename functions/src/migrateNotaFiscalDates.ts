/**
 * migrateNotaFiscalDates.ts — One-time migration script
 *
 * Converts legacy NotaFiscal.dataEmissao from string (YYYY-MM-DD) to Timestamp.
 * This fixes the schema mismatch that caused TypeError: g.dataEmissao.toDate is not a function
 *
 * Run once after deploying the fix:
 *   cd functions
 *   npx ts-node src/migrateNotaFiscalDates.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS to point to a service account JSON.
 */

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function migrate() {
  try {
    const labsSnap = await db.collection('labs').get();
    console.log(`Found ${labsSnap.docs.length} labs`);

    let totalMigrated = 0;
    let totalFailed = 0;

    for (const labDoc of labsSnap.docs) {
      const labId = labDoc.id;
      const notasSnap = await db.collection(`labs/${labId}/notas-fiscais`).get();

      console.log(`\nLab ${labId}: processing ${notasSnap.docs.length} notas fiscais`);

      for (const notaDoc of notasSnap.docs) {
        const data = notaDoc.data();
        const { dataEmissao } = data;

        // Skip if already Timestamp
        if (dataEmissao && typeof dataEmissao === 'object' && '_seconds' in dataEmissao) {
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
            console.log(`  ✓ ${notaDoc.id}: "${dataEmissao}" → Timestamp`);
          } catch (err) {
            totalFailed++;
            console.log(
              `  ✗ ${notaDoc.id}: FAILED — ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    }

    console.log(`\n✅ Migration complete: ${totalMigrated} converted, ${totalFailed} failed`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate().then(() => {
  console.log('Done');
  process.exit(0);
});
