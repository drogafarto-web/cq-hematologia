/**
 * touch-runs-for-hmac.mjs
 *
 * Faz um no-op update (campo `_hmacBackfillTouchedAt = serverTimestamp`) em
 * todas as runs de hematologia e imuno. O único objetivo é disparar o trigger
 * `onHematologiaRunSignature` / `onImunoRunSignature` (onDocumentWritten) para
 * que calcule e grave `serverHmac` retroativamente.
 *
 * O trigger é idempotente (early return se serverHmac já bate), então rodar
 * múltiplas vezes é seguro. O campo de touch fica como marcador que o backfill
 * aconteceu.
 *
 * Uso:
 *   # Dry-run
 *   node scripts/touch-runs-for-hmac.mjs
 *
 *   # Aplicar
 *   node scripts/touch-runs-for-hmac.mjs --apply
 */

import admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

const apply = process.argv.includes('--apply');

async function main() {
  const labsSnap = await db.collection('labs').get();
  const queue = []; // { ref, kind, docId }

  for (const labDoc of labsSnap.docs) {
    const labId = labDoc.id;

    // Runs de hematologia — labs/{labId}/lots/{lotId}/runs
    const lotsSnap = await db.collection(`labs/${labId}/lots`).get();
    for (const lotDoc of lotsSnap.docs) {
      const runsSnap = await db
        .collection(`labs/${labId}/lots/${lotDoc.id}/runs`)
        .get();
      for (const runDoc of runsSnap.docs) {
        if (runDoc.data().serverHmac) continue;
        queue.push({ ref: runDoc.ref, kind: 'hematologia-run', docId: runDoc.id });
      }
    }

    // Runs de imuno — labs/{labId}/ciq-imuno/{lotId}/runs
    const ciqSnap = await db.collection(`labs/${labId}/ciq-imuno`).get();
    for (const lotDoc of ciqSnap.docs) {
      const runsSnap = await db
        .collection(`labs/${labId}/ciq-imuno/${lotDoc.id}/runs`)
        .get();
      for (const runDoc of runsSnap.docs) {
        if (runDoc.data().serverHmac) continue;
        queue.push({ ref: runDoc.ref, kind: 'imuno-run', docId: runDoc.id });
      }
    }
  }

  console.log(`${queue.length} docs sem serverHmac:`);
  const byKind = queue.reduce((acc, q) => {
    acc[q.kind] = (acc[q.kind] || 0) + 1;
    return acc;
  }, {});
  for (const [k, v] of Object.entries(byKind)) console.log(`  ${k}: ${v}`);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: --apply');
    return;
  }

  console.log('\nTocando docs em batches de 10...');
  for (let i = 0; i < queue.length; i += 10) {
    const batch = db.batch();
    const slice = queue.slice(i, i + 10);
    for (const { ref } of slice) {
      batch.update(ref, {
        _hmacBackfillTouchedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    process.stdout.write(`  ${Math.min(i + 10, queue.length)}/${queue.length}\r`);
  }
  console.log('\n✅ Todos os touches aplicados. Aguarde ~30s para triggers processarem.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
