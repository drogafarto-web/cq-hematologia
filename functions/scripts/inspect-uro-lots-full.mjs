import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert('./service-account.json.json'),
  projectId: 'hmatologia2',
});

const db = getFirestore();

async function run() {
  const ids = [
    '796388e5-8c3e-4415-b6a4-3f34a8a04528',
    '81ec231c-2ff4-4933-9777-523692be16d6',
    'ce612564-fa43-4ce7-8e90-d341b2aa69b7',
    'daff28d7-24a4-44b0-b230-3101e2088da3',
  ];

  const labId = 'labclin-riopomba';

  for (const id of ids) {
    const lotRef = db.collection('labs').doc(labId).collection('ciq-uroanalise').doc(id);
    const snap = await lotRef.get();
    console.log(`\n=== LOT: ${id} ===`);
    if (snap.exists) {
      console.log(JSON.stringify(snap.data(), null, 2));
    } else {
      console.log('NOT FOUND!');
    }
  }
}

run().catch(console.error);
