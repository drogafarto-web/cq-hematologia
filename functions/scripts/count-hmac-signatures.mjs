/**
 * count-hmac-signatures.mjs
 *
 * Conta quantos documentos já possuem `serverHmac` preenchido em todas as
 * coleções onde as triggers da Onda 5 escrevem. Usado para decidir se a
 * rotação de chave HMAC (v1 → v2) é viável sem quebrar verificação retroativa.
 *
 * Escopo:
 *   - labs/{labId}/lots/{lotId}/runs/{runId}           (hematologia)
 *   - labs/{labId}/ciq-imuno/{lotId}/runs/{runId}      (imuno)
 *   - labs/{labId}/insumo-movimentacoes/{movId}        (insumos)
 *
 * Uso:
 *   node scripts/count-hmac-signatures.mjs
 *
 * Pré-requisitos:
 *   - gcloud auth application-default login
 *   - GOOGLE_CLOUD_PROJECT=hmatologia2
 */

import admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

async function main() {
  const labsSnap = await db.collection('labs').get();
  console.log(`Total de labs: ${labsSnap.size}`);

  let totalRunsHema = 0;
  let runsHemaWithHmac = 0;
  let totalRunsImuno = 0;
  let runsImunoWithHmac = 0;
  let totalMov = 0;
  let movWithHmac = 0;
  let movSealed = 0;

  for (const labDoc of labsSnap.docs) {
    const labId = labDoc.id;
    const labName = labDoc.data().name ?? '(sem nome)';

    // Runs de hematologia — labs/{labId}/lots/{lotId}/runs
    const lotsSnap = await db.collection(`labs/${labId}/lots`).get();
    for (const lotDoc of lotsSnap.docs) {
      const runsSnap = await db
        .collection(`labs/${labId}/lots/${lotDoc.id}/runs`)
        .get();
      for (const runDoc of runsSnap.docs) {
        totalRunsHema++;
        if (runDoc.data().serverHmac) runsHemaWithHmac++;
      }
    }

    // Runs de imuno — labs/{labId}/ciq-imuno/{lotId}/runs
    const ciqImunoSnap = await db.collection(`labs/${labId}/ciq-imuno`).get();
    for (const lotDoc of ciqImunoSnap.docs) {
      const runsSnap = await db
        .collection(`labs/${labId}/ciq-imuno/${lotDoc.id}/runs`)
        .get();
      for (const runDoc of runsSnap.docs) {
        totalRunsImuno++;
        if (runDoc.data().serverHmac) runsImunoWithHmac++;
      }
    }

    // Movimentações — labs/{labId}/insumo-movimentacoes
    const movSnap = await db.collection(`labs/${labId}/insumo-movimentacoes`).get();
    for (const movDoc of movSnap.docs) {
      totalMov++;
      const d = movDoc.data();
      if (d.serverHmac) movWithHmac++;
      if (d.chainStatus === 'sealed') movSealed++;
    }

    console.log(
      `  ${labId} (${labName}): lots=${lotsSnap.size} ciq-imuno=${ciqImunoSnap.size} mov=${movSnap.size}`,
    );
  }

  console.log('\n─── Totais ───────────────────────────────────────────────');
  console.log(`Runs hematologia:     ${totalRunsHema} (com serverHmac: ${runsHemaWithHmac})`);
  console.log(`Runs imuno:           ${totalRunsImuno} (com serverHmac: ${runsImunoWithHmac})`);
  console.log(`Movimentações:        ${totalMov} (com serverHmac: ${movWithHmac}, sealed: ${movSealed})`);
  console.log(
    `\nTotal assinaturas HMAC já gravadas: ${runsHemaWithHmac + runsImunoWithHmac + movWithHmac}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
