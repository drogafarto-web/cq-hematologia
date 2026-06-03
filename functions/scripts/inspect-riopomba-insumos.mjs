import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);

async function run() {
  const labId = 'labclin-riopomba';
  console.log(`\n=== ALL INSUMOS FOR ${labId} ===`);

  const insumosSnap = await db.collection('labs').doc(labId).collection('insumos').get();
  insumosSnap.forEach((doc) => {
    const data = doc.data();
    console.log(
      `  - [${doc.id}] Lote: ${data.lote} | Nome: ${data.nomeComercial} | Tipo: ${data.tipo} | Nível: ${data.nivel} | Status: ${data.status} | Modulo: ${data.modulo || (data.modulos ? data.modulos.join(',') : '')} | TestTypesCompativeis: ${data.testTypesCompativeis ? data.testTypesCompativeis.join(',') : 'none'}`,
    );
  });
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
