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

    // Query for insumos with qcValidationRequired = true and status = ativo
    const insumosSnapshot = await db
      .collection('labs')
      .doc(labId)
      .collection('insumos')
      .where('status', '==', 'ativo')
      .get();

    console.log(`\n🔍 Querying insumos with status='ativo' (${insumosSnapshot.size} docs)\n`);

    const withQCRequired = insumosSnapshot.docs.filter((doc) => {
      const data = doc.data();
      return data.qcValidationRequired === true;
    });

    if (withQCRequired.length > 0) {
      console.log(`⚠️  Found ${withQCRequired.length} insumo(s) with qcValidationRequired=true:\n`);
      withQCRequired.forEach((doc) => {
        const data = doc.data();
        console.log(`   Lote: ${data.lote}`);
        console.log(`   Fabricante: ${data.fabricante}`);
        console.log(`   Nome Comercial: ${data.nomeComercial}`);
        console.log(`   Tipo: ${data.tipo}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   qcValidationRequired: ${data.qcValidationRequired}`);
        console.log(
          `   dataAbertura: ${data.dataAbertura ? new Date(data.dataAbertura.toDate()).toLocaleString('pt-BR') : 'null'}`,
        );
        console.log(`   ID: ${doc.id}\n`);
      });
    } else {
      console.log(`✓ No insumos with qcValidationRequired=true found.\n`);

      // List all ativo insumos and their qcValidationRequired status
      console.log(`All status='ativo' insumos:\n`);
      insumosSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log(
          `   ${data.lote} — qcValidationRequired: ${data.qcValidationRequired || 'undefined'}`,
        );
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
