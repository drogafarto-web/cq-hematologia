import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);

const labId = 'labclin-riopomba';

const snap = await db.collection('labs').doc(labId).collection('lots').get();
console.log(`Total lots in /labs/${labId}/lots: ${snap.size}\n`);

const lots = [];
snap.forEach(doc => {
  const d = doc.data();
  const start = d.startDate?.toDate ? d.startDate.toDate() : d.startDate;
  const expiry = d.expiryDate?.toDate ? d.expiryDate.toDate() : d.expiryDate;
  const created = d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt;
  const archived = d.archivedAt?.toDate ? d.archivedAt.toDate() : null;
  lots.push({
    id: doc.id.slice(0,8),
    lotNumber: d.lotNumber,
    level: d.level,
    controlName: (d.controlName || '').slice(0, 30),
    startDate: start ? new Date(start).toISOString().slice(0,10) : '?',
    expiryDate: expiry ? new Date(expiry).toISOString().slice(0,10) : '?',
    createdAt: created ? new Date(created).toISOString().slice(0,10) : '?',
    bulaPendente: d.bulaPendente === true,
    manualHidden: d.manualHidden === true,
    archivedAt: archived ? new Date(archived).toISOString().slice(0,10) : null,
    runCount: d.runCount ?? 0,
    hasStats: d.manufacturerStats != null && Object.keys(d.manufacturerStats || {}).length > 0,
  });
});

lots.sort((a,b) => (a.lotNumber || '').localeCompare(b.lotNumber || ''));
console.log('lotNumber | NV | start | expiry | created | bulaPend | hidden | archivedAt | runs | stats?');
console.log('----------+----+-------+--------+---------+----------+--------+-----------+------+-------');
for (const l of lots) {
  console.log(
    `${(l.lotNumber||'?').padEnd(9)} | ${String(l.level).padStart(2)} | ${l.startDate} | ${l.expiryDate} | ${l.createdAt} | ${l.bulaPendente?'YES':'no '}     | ${l.manualHidden?'YES':'no '}    | ${(l.archivedAt||'-').padEnd(10)}| ${String(l.runCount).padStart(4)} | ${l.hasStats?'yes':'NULL'}`
  );
}
