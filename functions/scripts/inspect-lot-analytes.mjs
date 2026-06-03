import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);
const labId = 'labclin-riopomba';

// Check both /lots and /insumos for each active lot
const targets = ['HHI-1375', 'HHI-1376', 'HHI-1377'];

console.log('========== /lots ==========');
const lotsSnap = await db.collection('labs').doc(labId).collection('lots').get();
lotsSnap.forEach((doc) => {
  const d = doc.data();
  if (!targets.includes(d.lotNumber)) return;
  const stats = d.manufacturerStats || {};
  const req = d.requiredAnalytes || [];
  console.log(
    `\n${d.lotNumber} NV${d.level} | id=${doc.id.slice(0, 8)} | archivedAt=${d.archivedAt ? 'YES' : 'no'}`,
  );
  console.log(`  requiredAnalytes (${req.length}): [${req.join(', ')}]`);
  console.log(
    `  manufacturerStats keys (${Object.keys(stats).length}): [${Object.keys(stats).join(', ')}]`,
  );
  if (stats.RBC) console.log(`  RBC stats: ${JSON.stringify(stats.RBC)}`);
});

console.log('\n========== /insumos (tipo=controle) ==========');
const insumosSnap = await db
  .collection('labs')
  .doc(labId)
  .collection('insumos')
  .where('tipo', '==', 'controle')
  .get();
insumosSnap.forEach((doc) => {
  const d = doc.data();
  const lotNumber = d.lotNumber || d.numeroLote;
  if (!targets.includes(lotNumber)) return;
  const stats = d.manufacturerStats || d.bulaData?.manufacturerStats || {};
  const req = d.requiredAnalytes || d.bulaData?.requiredAnalytes || [];
  const modulos = d.modulos || [d.modulo].filter(Boolean);
  console.log(
    `\n${lotNumber} NV${d.level || d.nivel} | id=${doc.id.slice(0, 8)} | archivedAt=${d.archivedAt ? 'YES' : 'no'} | modulos=[${modulos.join(',')}]`,
  );
  console.log(`  requiredAnalytes (${req.length}): [${req.join(', ')}]`);
  console.log(
    `  manufacturerStats keys (${Object.keys(stats).length}): [${Object.keys(stats).join(', ')}]`,
  );
  if (stats.RBC) console.log(`  RBC stats: ${JSON.stringify(stats.RBC)}`);
});
