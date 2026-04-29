import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);
const labId = 'labclin-riopomba';

const snap = await db.collection('labs').doc(labId).collection('insumos')
  .where('tipo', '==', 'controle').get();
console.log(`Insumos tipo='controle': ${snap.size}\n`);

const items = [];
snap.forEach(doc => {
  const d = doc.data();
  const validade = d.validade?.toDate?.();
  const startDate = d.startDate?.toDate?.();
  const created = d.createdAt?.toDate?.();
  items.push({
    id: doc.id.slice(0,8),
    lote: d.lote,
    bulaLevel: d.bulaLevel,
    nivel: d.nivel,
    nomeComercial: (d.nomeComercial || '').slice(0,30),
    modulo: d.modulo,
    validade: validade ? validade.toISOString().slice(0,10) : '?',
    startDate: startDate ? startDate.toISOString().slice(0,10) : '?',
    createdAt: created ? created.toISOString().slice(0,10) : '?',
    status: d.status,
    hasStats: d.stats != null && Object.keys(d.stats || {}).length > 0,
  });
});

items.sort((a,b) => (a.lote||'').localeCompare(b.lote||''));
console.log('lote     | NV | nome              | modulo      | start | valid | created | status | stats');
console.log('---------+----+-------------------+-------------+-------+-------+---------+--------+------');
for (const i of items) {
  console.log(`${(i.lote||'?').padEnd(9)} | ${String(i.bulaLevel ?? '-').padStart(2)} | ${i.nomeComercial.padEnd(18)} | ${(i.modulo||'?').padEnd(11)} | ${i.startDate} | ${i.validade} | ${i.createdAt} | ${(i.status||'?').padEnd(6)} | ${i.hasStats?'yes':'NULL'}`);
}
