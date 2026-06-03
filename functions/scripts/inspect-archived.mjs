import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);
const labId = 'labclin-riopomba';

console.log('=== /lots ===');
const lotsSnap = await db.collection('labs').doc(labId).collection('lots').get();
lotsSnap.forEach((d) => {
  const x = d.data();
  console.log(
    `  ${x.lotNumber}  archivedAt=${x.archivedAt?.toDate()?.toISOString() || 'NULL'}  manualHidden=${x.manualHidden}`,
  );
});

console.log('\n=== /insumos (tipo=controle) ===');
const insumosSnap = await db
  .collection('labs')
  .doc(labId)
  .collection('insumos')
  .where('tipo', '==', 'controle')
  .get();
insumosSnap.forEach((d) => {
  const x = d.data();
  console.log(
    `  ${x.lote}  archivedAt=${x.archivedAt?.toDate()?.toISOString() || 'NULL'}  status=${x.status}  manualHidden=${x.manualHidden}`,
  );
});
