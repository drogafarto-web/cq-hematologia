import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n📌 Vinculando CIQ lot à bancada (setupType = principal)...\n');

const labId = 'labclin-riopomba';
const lotId = 'b65dea11-5e53-4f7d-a695-c32fd0c28f73'; // ID do lote que criamos
const userId = '2C7CDajpigXfaAVAzzJVFfrhgYB2'; // drogafarto@gmail.com

try {
  await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .doc(lotId)
    .update({
      setupType: 'principal',
      pinnedBy: userId,
      pinnedAt: admin.firestore.Timestamp.now(),
      pinHistory: admin.firestore.FieldValue.arrayUnion({
        at: admin.firestore.Timestamp.now(),
        by: userId,
        action: 'vinculado',
        setupType: 'principal',
      }),
    });

  console.log('✅ Lote vinculado à bancada!\n');
  console.log(`   Lote ID: ${lotId}`);
  console.log(`   Setup Type: principal`);
  console.log(`   Status: Pronto para registrar corridas\n`);
} catch (err) {
  console.error('❌ Erro ao vincular:');
  console.error('   Mensagem:', err.message);
  process.exit(1);
}
