import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);

const labId = 'labclin-riopomba';

// Find HHI-1375 (NV1 active) and HHI-1372 (NV1 archived)
const lotsSnap = await db.collection('labs').doc(labId).collection('lots').get();
const targets = [];
lotsSnap.forEach((doc) => {
  const d = doc.data();
  if (
    d.lotNumber === 'HHI-1375' ||
    d.lotNumber === 'HHI-1372' ||
    d.lotNumber === 'HHI-1376' ||
    d.lotNumber === 'HHI-1377'
  ) {
    targets.push({ id: doc.id, ...d });
  }
});

for (const lot of targets) {
  console.log(
    `\n=== ${lot.lotNumber} (NV${lot.level}) ${lot.archivedAt ? '[ARCHIVED]' : '[ACTIVE]'} id=${lot.id.slice(0, 8)} ===`,
  );
  console.log(`  runCount field: ${lot.runCount ?? 0}`);
  const runsSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('lots')
    .doc(lot.id)
    .collection('runs')
    .get();
  console.log(`  actual runs subcollection size: ${runsSnap.size}`);
  runsSnap.forEach((r) => {
    const rd = r.data();
    const date = rd.date?.toDate ? rd.date.toDate().toISOString().slice(0, 16) : rd.date;
    const created = rd.createdAt?.toDate
      ? rd.createdAt.toDate().toISOString().slice(0, 16)
      : rd.createdAt;
    console.log(
      `    run ${r.id.slice(0, 8)} | date=${date} | created=${created} | analytes=${Object.keys(rd.results || rd.values || {}).length} | hidden=${rd.hidden ?? rd.manualHidden ?? false}`,
    );
    // print first analyte
    const results = rd.results || rd.values || {};
    const keys = Object.keys(results).slice(0, 3);
    for (const k of keys) {
      console.log(`      ${k}: ${JSON.stringify(results[k])}`);
    }
  });
}
