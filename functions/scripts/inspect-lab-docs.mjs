import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert('./service-account.json.json'),
  projectId: 'hmatologia2',
});

const db = getFirestore();

async function run() {
  const ids = ['labclin-riopomba', 'F1NkH9FfLqUvGjH6jNlw'];
  for (const id of ids) {
    const docRef = db.collection('labs').doc(id);
    const snap = await docRef.get();
    console.log(`\n=== Lab: ${id} ===`);
    if (snap.exists) {
      console.log(JSON.stringify(snap.data(), null, 2));
    } else {
      console.log('NOT FOUND!');
    }
  }
}

run().catch(console.error);
