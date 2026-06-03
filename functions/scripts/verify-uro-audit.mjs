import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert('./service-account.json.json'),
  projectId: 'hmatologia2',
});

const db = getFirestore();
const LAB_ID = 'labclin-riopomba';

async function run() {
  console.log(`=== Querying ciq-uroanalise-audit for Lab: ${LAB_ID} ===`);
  const snap = await db.collection('labs').doc(LAB_ID).collection('ciq-uroanalise-audit').get();
  console.log(`Found ${snap.size} audit logs:`);
  
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`\nAudit ID: ${doc.id}`);
    console.log(`  - Action: ${data.action}`);
    console.log(`  - Lot ID: ${data.lotId}`);
    console.log(`  - Actor UID: ${data.actorUid}`);
    console.log(`  - Lot Snapshot: ${JSON.stringify(data.lotSnapshot)}`);
    console.log(`  - Metadata: ${JSON.stringify(data.metadata)}`);
    console.log(`  - CreatedAt: ${data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt}`);
  });
}

run().catch(console.error);
