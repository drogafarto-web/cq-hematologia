import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n🔧 Adicionando equipamentoId ao insumo...\n');

const labId = 'labclin-riopomba';
const insumoId = '173627c9-0bc1-497b-9233-aa9b34f499bb';
const equipamentoId = 'clotimer-duo';
const userId = '2C7CDajpigXfaAVAzzJVFfrhgYB2';

try {
  await db
    .collection('labs')
    .doc(labId)
    .collection('insumos')
    .doc(insumoId)
    .update({
      equipamentoId,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: userId,
    });

  console.log('✅ Insumo atualizado!\n');
  console.log(`   Insumo: APPT REAGENTE (${insumoId})`);
  console.log(`   Equipamento: ${equipamentoId}\n`);

} catch (err) {
  console.error('❌ Erro ao atualizar:');
  console.error('   Mensagem:', err.message);
  process.exit(1);
}
