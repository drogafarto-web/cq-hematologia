import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);

async function run() {
  const doc = await db.collection('labs').doc('labclin-riopomba').collection('insumos').doc('0990fd8a-f029-4671-9ef2-d9bd414a9b52').get();
  console.log(JSON.stringify(doc.data(), null, 2));
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
