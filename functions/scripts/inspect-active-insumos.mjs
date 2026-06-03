import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Initialize firebase admin
const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);

async function run() {
  const labsSnapshot = await db.collection('labs').get();
  for (const labDoc of labsSnapshot.docs) {
    const labId = labDoc.id;
    const name = labDoc.data().name || labDoc.data().razaoSocial || '';
    console.log(`\n=== LAB: ${labId} (${name}) ===`);

    const insumosSnap = await db
      .collection('labs')
      .doc(labId)
      .collection('insumos')
      .where('status', '==', 'ativo')
      .get();
    if (insumosSnap.empty) {
      console.log('No active insumos.');
      continue;
    }

    insumosSnap.forEach((doc) => {
      const data = doc.data();
      console.log(
        `  - [${doc.id}] Lote: ${data.lote} | Nome: ${data.nomeComercial} | Tipo: ${data.tipo} | Nível: ${data.nivel} | Modulo: ${data.modulo || (data.modulos ? data.modulos.join(',') : '')} | TestTypesCompativeis: ${data.testTypesCompativeis ? data.testTypesCompativeis.join(',') : 'none'}`,
      );
    });
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
