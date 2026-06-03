import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);
const labId = 'labclin-riopomba';

// Look for bulas / bula docs and any extraction artifacts
const bulasSnap = await db
  .collection('labs')
  .doc(labId)
  .collection('bulas')
  .get()
  .catch(() => null);
console.log(`/labs/${labId}/bulas size: ${bulasSnap?.size ?? 'N/A'}`);

// Try a few common collection names
for (const name of ['bulas', 'documents', 'controllabBulas', 'bulasExtractions']) {
  const snap = await db
    .collection('labs')
    .doc(labId)
    .collection(name)
    .get()
    .catch(() => null);
  if (snap && snap.size > 0) {
    console.log(`\n=== /labs/${labId}/${name} (${snap.size} docs) ===`);
    snap.forEach((doc) => {
      const d = doc.data();
      console.log(`  ${doc.id.slice(0, 8)}: keys=[${Object.keys(d).slice(0, 10).join(',')}]`);
      if (d.lotNumbers || d.lots) {
        console.log(`    lots: ${JSON.stringify(d.lotNumbers || d.lots).slice(0, 200)}`);
      }
    });
  }
}

// Inspect HHI-1375 lot doc full data to see if there are bula references / extracted data
const hhi1375Snap = await db.collection('labs').doc(labId).collection('lots').get();
hhi1375Snap.forEach((doc) => {
  const d = doc.data();
  if (d.lotNumber === 'HHI-1375') {
    console.log('\n=== HHI-1375 full doc keys ===');
    console.log(Object.keys(d).join(', '));
    console.log('\n=== manufacturerStats keys ===');
    console.log(Object.keys(d.manufacturerStats || {}).sort());
    console.log('\n=== requiredAnalytes ===');
    console.log(d.requiredAnalytes);
    if (d.bulaData) {
      console.log('\n=== bulaData keys ===', Object.keys(d.bulaData));
    }
    if (d.bulaSource) console.log('\nbulaSource:', d.bulaSource);
    if (d.bulaImportedAt) console.log('bulaImportedAt:', d.bulaImportedAt?.toDate?.());
  }
  if (d.lotNumber === 'HHI-1376') {
    console.log('\n=== HHI-1376 (NV2) manufacturerStats keys ===');
    console.log(Object.keys(d.manufacturerStats || {}).sort());
  }
});
