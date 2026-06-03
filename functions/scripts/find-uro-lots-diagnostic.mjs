import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert('./service-account.json.json'),
  projectId: 'hmatologia2',
});

const db = getFirestore();

async function run() {
  console.log("=== Listing labs in Firestore ===");
  const labsSnap = await db.collection('labs').get();
  console.log(`Found ${labsSnap.size} lab documents:`);
  
  for (const labDoc of labsSnap.docs) {
    const data = labDoc.data();
    console.log(`Lab ID: ${labDoc.id} | Name: ${data.name || data.razaoSocial || 'N/A'}`);
    
    // Now look into ciq-uroanalise collection
    const uroCollection = db.collection('labs').doc(labDoc.id).collection('ciq-uroanalise');
    const uroSnap = await uroCollection.get();
    if (uroSnap.size > 0) {
      console.log(`  -> Found ${uroSnap.size} lots in ciq-uroanalise:`);
      for (const lotDoc of uroSnap.docs) {
        const lotData = lotDoc.data();
        console.log(`     Lot ID: ${lotDoc.id}`);
        console.log(`     Numero Lote: ${lotData.numeroLote || lotData.lotNumber || 'N/A'}`);
        console.log(`     Fabricante: ${lotData.fabricante || lotData.manufacturer || 'N/A'}`);
        console.log(`     Nivel: ${lotData.nivel || 'N/A'}`);
        console.log(`     Status: ${lotData.status || 'active'}`);
        
        // Let's also check runs
        const runsSnap = await uroCollection.doc(lotDoc.id).collection('runs').get();
        console.log(`     Runs: ${runsSnap.size}`);
        runsSnap.forEach(runDoc => {
          const runData = runDoc.data();
          console.log(`       Run ID: ${runDoc.id} | signedBy: ${runData.createdByName || runData.createdBy || 'N/A'} | signedAt: ${runData.createdAt?.toDate ? runData.createdAt.toDate().toISOString() : runData.createdAt}`);
        });
      }
    }
  }
}

run().catch(console.error);
