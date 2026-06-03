import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);

async function run() {
  const doc = await db.collection('labs').doc('labclin-riopomba').collection('insumos').doc('a6a7bd04-35d7-4fdd-b3ce-e6ea5cad1646').get();
  console.log(JSON.stringify(doc.data(), null, 2));
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
