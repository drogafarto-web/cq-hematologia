import admin from 'firebase-admin';
import { randomUUID } from 'crypto';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n📝 Registrando lote manualmente...\n');

const labId = 'labclin-riopomba';
const lotId = randomUUID();

// Dados extraídos da screenshot
const lotData = {
  labId,
  nivel: 'nv1', // APPT é Coagulação nível 1
  loteControle: '7281/26',
  fabricanteControle: 'APPT', // Reagente APPT
  aberturaControle: '2026-05-08', // String YYYY-MM-DD
  validadeControle: '2027-07-01', // String YYYY-MM-DD
  estabilidadePosAbertura: 90, // dias
  rastreabilidadeWorklab: {
    exam: 'CTL',
    codigo: '107416'
  },
  mean: {
    atividadeProtrombinica: 100,
    rni: 2.5,
    ttpa: 35
  },
  sd: {
    atividadeProtrombinica: 5,
    rni: 0.5,
    ttpa: 3
  },
  runCount: 0,
  lotStatus: 'aberto', // "em uso (abrir agora)"
  createdBy: '2C7CDajpigXfaAVAzzJVFfrhgYB2', // drogafarto@gmail.com
  createdAt: new Date(),
};

try {
  await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .doc(lotId)
    .set(lotData);

  console.log('✅ Lote criado com sucesso!\n');
  console.log(`   ID do lote: ${lotId}`);
  console.log(`   Número: ${lotData.loteControle}`);
  console.log(`   Validade: ${lotData.validadeControle}`);
  console.log(`   Status: ${lotData.lotStatus}\n`);

} catch (err) {
  console.error('❌ Erro ao criar lote:');
  console.error('   Código:', err.code);
  console.error('   Mensagem:', err.message);
  process.exit(1);
}
