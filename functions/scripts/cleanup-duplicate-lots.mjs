import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n🔍 Buscando lotes duplicados 7281/26...\n');

const labId = 'labclin-riopomba';

try {
  const snap = await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .where('loteControle', '==', '7281/26')
    .get();

  console.log(`   Encontrados: ${snap.size} lotes\n`);

  if (snap.size <= 1) {
    console.log('✅ Nenhum duplicado encontrado\n');
    process.exit(0);
  }

  // Manter o mais recente, deletar os antigos
  const lots = snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.() || new Date(0),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  console.log('Mantendo:', lots[0].id, '(mais recente)');
  console.log(
    'Deletando:',
    lots
      .slice(1)
      .map((l) => l.id)
      .join(', '),
  );
  console.log();

  // Deletar antigos
  for (let i = 1; i < lots.length; i++) {
    await db.collection('labs').doc(labId).collection('ciq-coagulacao').doc(lots[i].id).delete();
    console.log(`   ✅ ${lots[i].id} deletado`);
  }

  console.log('\n✅ Limpeza concluída!\n');
} catch (err) {
  console.error('❌ Erro:', err.message);
  process.exit(1);
}
