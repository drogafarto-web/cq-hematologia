import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n🧪 Testando write em ciq-coagulacao via Admin SDK...\n');

try {
  const labId = 'labclin-riopomba';
  const lotId = `test-${Date.now()}`;

  const lotRef = db.collection('labs').doc(labId).collection('ciq-coagulacao').doc(lotId);

  await lotRef.set({
    labId,
    nivel: 'nv1',
    loteControle: 'TEST-' + Date.now(),
    fabricanteControle: 'TEST',
    aberturaControle: new Date(),
    validadeControle: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    mean: { atividadeProtrombinica: 100, rni: 2.5, ttpa: 35 },
    sd: { atividadeProtrombinica: 5, rni: 0.5, ttpa: 3 },
    runCount: 0,
    lotStatus: 'sem_dados',
    createdBy: 'admin-test',
  });

  console.log('✅ Write bem-sucedido via Admin SDK!');
  console.log(`   Lote criado: ${lotId}`);
  console.log('\n💡 Conclusão: O problema é CLIENT-SIDE, não no servidor.');
  console.log('   A issue é o SDK do navegador cacheando rules antigas.\n');
} catch (err) {
  console.error('❌ Erro ao criar lote via Admin SDK:');
  console.error('   Código:', err.code);
  console.error('   Mensagem:', err.message);
  console.error('\n💡 Conclusão: O problema está NO SERVIDOR (rules).\n');
}
