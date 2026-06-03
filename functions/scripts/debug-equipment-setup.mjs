import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n🔍 Verificando EquipmentSetup e Insumos...\n');

const labId = 'labclin-riopomba';
const equipamentoId = 'clotimer-duo';

try {
  // 1. Verificar setup
  console.log('1️⃣  EquipmentSetup:');
  const setupSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('equipment-setups')
    .doc(equipamentoId)
    .get();

  if (setupSnap.exists) {
    const setup = setupSnap.data();
    console.log(`   ✅ Encontrado (${equipamentoId})`);
    console.log(`   - module: ${setup.module}`);
    console.log(`   - equipamentoId: ${setup.equipamentoId}`);
    console.log(`   - equipamentoName: ${setup.equipamentoName}`);
    console.log(`   - activeReagenteId: ${setup.activeReagenteId}`);
    console.log(`   - activeControleId: ${setup.activeControleId}`);
  } else {
    console.log(`   ❌ Não encontrado (${equipamentoId})`);
  }

  // 2. Verificar insumo
  console.log('\n2️⃣  Insumo:');
  const insumoId = '173627c9-0bc1-497b-9233-aa9b34f499bb';
  const insumoSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('insumos')
    .doc(insumoId)
    .get();

  if (insumoSnap.exists) {
    const insumo = insumoSnap.data();
    console.log(`   ✅ Encontrado (${insumoId})`);
    console.log(`   - tipo: ${insumo.tipo}`);
    console.log(`   - nomeComercial: ${insumo.nomeComercial}`);
    console.log(`   - status: ${insumo.status}`);
    console.log(`   - notaFiscalId: ${insumo.notaFiscalId || '(vazio)'}`);
    console.log(`   - modulos: ${insumo.modulos?.join(', ') || '(vazio)'}`);
  } else {
    console.log(`   ❌ Não encontrado (${insumoId})`);
  }

  // 3. Listar todos insumos ativos
  console.log('\n3️⃣  Todos insumos ativos:');
  const insumosSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('insumos')
    .where('status', '==', 'ativo')
    .get();

  console.log(`   Total: ${insumosSnap.size}`);
  insumosSnap.docs.forEach((doc) => {
    const data = doc.data();
    console.log(`   - ${doc.id}`);
    console.log(`     tipo: ${data.tipo}, nome: ${data.nomeComercial}`);
  });

  // 4. Listar todos setups
  console.log('\n4️⃣  Todos EquipmentSetups:');
  const setupsSnap = await db.collection('labs').doc(labId).collection('equipment-setups').get();

  console.log(`   Total: ${setupsSnap.size}`);
  setupsSnap.docs.forEach((doc) => {
    const data = doc.data();
    console.log(`   - docId: ${doc.id}`);
    console.log(`     module: ${data.module}, equipamentoId: ${data.equipamentoId || '(vazio)'}`);
    console.log(`     activeReagenteId: ${data.activeReagenteId || 'null'}`);
  });

  console.log('\n');
} catch (err) {
  console.error('❌ Erro:');
  console.error('   Mensagem:', err.message);
  process.exit(1);
}
