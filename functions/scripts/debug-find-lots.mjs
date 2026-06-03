import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);

const labId = 'labclin-riopomba';
const ids = ['81ec231c-2ff4-4933-9777-523692be16d6', '796388e5-8c3e-4415-b6a4-3f34a8a04528'];

for (const id of ids) {
  const lotRef = db.collection('labs').doc(labId).collection('ciq-uroanalise').doc(id);
  const runsSnap = await lotRef.collection('runs').get();
  console.log(`\n--- RUNS FOR LOT ${id} ---`);
  runsSnap.forEach((runDoc) => {
    console.log(`Run ID: ${runDoc.id}`);
    console.log(JSON.stringify(runDoc.data(), null, 2));
  });
}
