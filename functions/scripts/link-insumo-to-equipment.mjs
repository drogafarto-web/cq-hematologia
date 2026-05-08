import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n🔗 Vinculando insumo ao equipamento CLOT DUO...\n');

const labId = 'labclin-riopomba';
const insumoId = '173627c9-0bc1-497b-9233-aa9b34f499bb'; // ID do APPT REAGENTE que acabamos de criar
const equipamentoName = 'CLOT DUO';
const modulo = 'coagulacao';

try {
  // Primeiro, encontrar o equipamento CLOT DUO
  const equipsSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('equipamentos')
    .where('nome', '==', equipamentoName)
    .get();

  let equipamentoId;
  if (equipsSnap.empty) {
    console.log('⚠️  Equipamento CLOT DUO não encontrado. Criando...\n');
    // Criar o equipamento se não existir
    equipamentoId = 'clotimer-duo'; // ID padrão
    await db
      .collection('labs')
      .doc(labId)
      .collection('equipamentos')
      .doc(equipamentoId)
      .set({
        id: equipamentoId,
        nome: equipamentoName,
        modelo: 'Clotimer Duo',
        modulos: ['coagulacao'],
        createdAt: admin.firestore.Timestamp.now(),
      });
    console.log('   ✅ Equipamento criado: ' + equipamentoId);
  } else {
    equipamentoId = equipsSnap.docs[0].id;
    console.log('   ✅ Equipamento encontrado: ' + equipamentoId);
  }

  // Agora atualizar/criar o EquipmentSetup
  const setupRef = db
    .collection('labs')
    .doc(labId)
    .collection('equipment-setups')
    .doc(equipamentoId);

  const setupSnap = await setupRef.get();
  const userId = '2C7CDajpigXfaAVAzzJVFfrhgYB2';

  const setupData = {
    module: modulo,
    labId,
    equipamentoId,
    equipamentoName,
    activeReagenteId: insumoId, // Vincular o insumo ao slot de reagente
    activeControleId: null,
    activeTiraUroId: null,
    updatedAt: admin.firestore.Timestamp.now(),
    updatedBy: userId,
    updatedByName: 'drogafarto@gmail.com',
  };

  if (setupSnap.exists) {
    // Atualizar setup existente
    await setupRef.update(setupData);
    console.log('\n✅ Setup atualizado!\n');
  } else {
    // Criar novo setup
    await setupRef.set(setupData);
    console.log('\n✅ Setup criado!\n');
  }

  console.log(`   Equipamento: ${equipamentoName} (${equipamentoId})`);
  console.log(`   Módulo: ${modulo}`);
  console.log(`   Reagente ativo: APPT REAGENTE 7281/26`);
  console.log(`   ID do insumo: ${insumoId}\n`);

} catch (err) {
  console.error('❌ Erro ao vincular:');
  console.error('   Mensagem:', err.message);
  process.exit(1);
}
