const admin = require('firebase-admin');

const serviceAccount = require('../service-account.json.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'hmatologia2',
});

const db = admin.firestore();

(async () => {
  try {
    const labId = 'labclin-riopomba';

    // Get all insumos
    const insumosSnapshot = await db.collection('labs').doc(labId).collection('insumos').get();

    console.log(`\n🔬 Lab: ${labId}`);
    console.log(`Total insumos: ${insumosSnapshot.size}\n`);

    const pendingCQ = [];
    const allRecords = [];

    insumosSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      allRecords.push({
        id: doc.id,
        lote: data.lote,
        fabricante: data.fabricante,
        tipo: data.tipo,
        status: data.status,
        cqStatus: data.cqStatus,
        dataAbertura: data.dataAbertura,
        nomeComercial: data.nomeComercial,
      });

      // Check if CQ status is missing or pending
      if (!data.cqStatus || data.cqStatus === 'pending' || data.cqStatus === 'awaiting') {
        pendingCQ.push({
          id: doc.id,
          lote: data.lote,
          fabricante: data.fabricante,
          tipo: data.tipo,
          status: data.status,
          cqStatus: data.cqStatus,
          nomeComercial: data.nomeComercial,
          dataAbertura: data.dataAbertura,
        });
      }
    });

    if (pendingCQ.length > 0) {
      console.log(`⚠️  PENDING CQ (${pendingCQ.length}):\n`);
      pendingCQ.forEach((item) => {
        console.log(`   Lote: ${item.lote}`);
        console.log(`   Fabricante: ${item.fabricante}`);
        console.log(`   Nome Comercial: ${item.nomeComercial}`);
        console.log(`   Tipo: ${item.tipo}`);
        console.log(`   Status: ${item.status}`);
        console.log(`   CQ Status: ${item.cqStatus || '(undefined)'}`);
        console.log(`   ID: ${item.id}\n`);
      });
    } else {
      console.log(`✓ All insumos have CQ status defined.\n`);
      console.log(`Summary of all insumos:\n`);
      allRecords.forEach((item) => {
        console.log(
          `   ${item.lote} (${item.fabricante}) — cqStatus: ${item.cqStatus || 'UNDEFINED'}`,
        );
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
