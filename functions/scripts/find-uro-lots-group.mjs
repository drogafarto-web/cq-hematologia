import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert('./service-account.json.json'),
  projectId: 'hmatologia2',
});

const db = getFirestore();

async function run() {
  console.log('=== Querying ciq-uroanalise Collection Group ===');
  const snap = await db.collectionGroup('ciq-uroanalise').get();
  console.log(`Found ${snap.size} documents in all ciq-uroanalise collections:`);

  for (const doc of snap.docs) {
    const lotData = doc.data();
    // doc.ref.path looks like: labs/{labId}/ciq-uroanalise/{lotId}
    console.log(`\nPath: ${doc.ref.path}`);
    console.log(`Lot ID: ${doc.id}`);
    console.log(`Numero Lote: ${lotData.numeroLote || lotData.lotNumber || 'N/A'}`);
    console.log(`Fabricante: ${lotData.fabricante || lotData.manufacturer || 'N/A'}`);
    console.log(`Nivel: ${lotData.nivel || 'N/A'}`);
    console.log(`Status: ${lotData.status || 'active'}`);

    // Check runs
    const runsSnap = await doc.ref.collection('runs').get();
    console.log(`Runs count: ${runsSnap.size}`);
    runsSnap.forEach((runDoc) => {
      const runData = runDoc.data();
      console.log(`  - Run ID: ${runDoc.id}`);
      console.log(`    SignedBy: ${runData.createdByName || runData.createdBy || 'N/A'}`);
      console.log(`    Nivel: ${runData.nivel || 'N/A'}`);
      console.log(
        `    CreatedAt: ${runData.createdAt?.toDate ? runData.createdAt.toDate().toISOString() : runData.createdAt}`,
      );
    });
  }
}

run().catch(console.error);
