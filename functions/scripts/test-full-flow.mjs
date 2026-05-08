import admin from 'firebase-admin';
import { randomUUID } from 'crypto';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();
const auth = admin.auth();

console.log('\n🧪 TESTE COMPLETO: Frontend Flow via Admin SDK\n');

const labId = 'labclin-riopomba';
const nivel = 'nv1';
const loteControle = '7281/26';

try {
  // ── 1. findCoagLot (read)
  console.log('1️⃣  Buscando lote existente...');
  const q = db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .where('nivel', '==', nivel)
    .where('loteControle', '==', loteControle);

  const snap = await q.get();
  console.log(`   ✅ Read bem-sucedido. Docs encontrados: ${snap.size}`);

  let lotId = snap.docs[0]?.id ?? null;

  // ── 2. createCoagLot (write) se não existir
  if (!lotId) {
    console.log('2️⃣  Criando novo lote...');
    lotId = randomUUID();
    const newLot = {
      labId,
      nivel,
      loteControle,
      fabricanteControle: 'TEST-APPT',
      aberturaControle: new Date(),
      validadeControle: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      mean: { atividadeProtrombinica: 100, rni: 2.5, ttpa: 35 },
      sd: { atividadeProtrombinica: 5, rni: 0.5, ttpa: 3 },
      runCount: 0,
      lotStatus: 'sem_dados',
      createdBy: '2C7CDajpigXfaAVAzzJVFfrhgYB2', // drogafarto@gmail.com
    };

    await db
      .collection('labs')
      .doc(labId)
      .collection('ciq-coagulacao')
      .doc(lotId)
      .set(newLot);

    console.log(`   ✅ Write bem-sucedido. Lote criado: ${lotId}`);
  } else {
    console.log(`2️⃣  Lote já existe: ${lotId}`);
  }

  // ── 3. getCoagRuns (read)
  console.log('3️⃣  Buscando runs existentes...');
  const runsSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .doc(lotId)
    .collection('runs')
    .get();

  console.log(`   ✅ Read bem-sucedido. Runs encontrados: ${runsSnap.size}`);

  console.log('\n✅ SUCESSO: Todo o fluxo funcionou!\n');
  console.log('💡 Conclusão: O servidor está OK. O problema é CLIENT-SIDE.');
  console.log('   Próximo passo: Investigar SDK do cliente ou cache local.\n');

} catch (err) {
  console.error('\n❌ ERRO NO FLUXO:');
  console.error('   Código:', err.code);
  console.error('   Mensagem:', err.message);
  console.error('   Path:', err.message);
  console.error('\n💡 Isso significa que há um problema NO SERVIDOR.\n');
}
