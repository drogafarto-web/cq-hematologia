const admin = require('firebase-admin');

const serviceAccount = require('../service-account.json.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'hmatologia2',
});

const db = admin.firestore();

(async () => {
  try {
    const labsSnapshot = await db.collection('labs').get();

    for (const labDoc of labsSnapshot.docs) {
      const labId = labDoc.id;
      console.log(`\n🔬 Lab: ${labId}\n`);

      const insumosSnapshot = await db
        .collection('labs')
        .doc(labId)
        .collection('insumo-movimentacoes')
        .get();

      console.log(`   Total docs: ${insumosSnapshot.size}\n`);

      insumosSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log(`   ├─ ID: ${doc.id}`);
        console.log(`   ├─ type: ${data.type}`);
        console.log(`   ├─ lote: ${data.lote}`);
        console.log(`   ├─ cqStatus: ${data.cqStatus || '(undefined)'}`);
        console.log(`   ├─ status: ${data.status || '(undefined)'}`);
        console.log(`   └─ fields: ${Object.keys(data).join(', ')}`);
        console.log();
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
