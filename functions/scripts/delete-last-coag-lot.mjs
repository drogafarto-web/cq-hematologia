import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n🗑️  Deletando lote antigo...\n');

const labId = 'labclin-riopomba';

try {
  // Listar os lotes mais recentes
  const snap = await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snap.empty) {
    console.log('❌ Nenhum lote encontrado');
    process.exit(0);
  }

  const lotId = snap.docs[0].id;
  const lotData = snap.docs[0].data();

  console.log(`Deletando: ${lotData.loteControle} (${lotId})`);

  await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .doc(lotId)
    .delete();

  console.log('✅ Lote deletado com sucesso!\n');

} catch (err) {
  console.error('❌ Erro ao deletar:');
  console.error('   Mensagem:', err.message);
  process.exit(1);
}
