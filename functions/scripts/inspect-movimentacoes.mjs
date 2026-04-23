/**
 * inspect-movimentacoes.mjs
 *
 * Lista todas as movimentações em todos os labs com seu estado de selamento.
 * Usa para decidir se backfill é necessário e quais docs processar.
 */

import admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

async function main() {
  const labsSnap = await db.collection('labs').get();
  for (const labDoc of labsSnap.docs) {
    const labId = labDoc.id;
    const movsSnap = await db
      .collection(`labs/${labId}/insumo-movimentacoes`)
      .orderBy('timestamp', 'asc')
      .get();

    if (movsSnap.empty) {
      console.log(`Lab ${labId}: sem movimentações`);
      continue;
    }

    console.log(`\nLab ${labId} — ${movsSnap.size} movimentações:\n`);
    for (const movDoc of movsSnap.docs) {
      const d = movDoc.data();
      const ts = d.timestamp?.toDate?.().toISOString?.() ?? '(sem timestamp)';
      console.log(
        `  ${movDoc.id}`,
        `\n    insumoId: ${d.insumoId}`,
        `\n    tipo: ${d.tipo ?? '?'}`,
        `\n    timestamp: ${ts}`,
        `\n    chainStatus: ${d.chainStatus}`,
        `\n    chainHash: ${d.chainHash ? d.chainHash.slice(0, 16) + '...' : 'null'}`,
        `\n    payloadSignature: ${d.payloadSignature?.slice(0, 16)}... (len=${d.payloadSignature?.length})`,
        `\n    sealedAt: ${d.sealedAt?.toDate?.().toISOString?.() ?? 'null'}`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
