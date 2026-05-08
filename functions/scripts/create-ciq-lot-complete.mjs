import admin from 'firebase-admin';
import { randomUUID } from 'crypto';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n🧪 Criando CIQ lot APPT 7281/26 com rastreabilidade completa...\n');

const labId = 'labclin-riopomba';
const lotId = randomUUID();
const insumoId = '173627c9-0bc1-497b-9233-aa9b34f499bb'; // APPT REAGENTE que criamos
const notaFiscalId = 'nf-10123-1778213039737'; // NF que acabamos de criar
const userId = '2C7CDajpigXfaAVAzzJVFfrhgYB2'; // drogafarto@gmail.com

try {
  // Verificar que insumo existe
  const insumoSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('insumos')
    .doc(insumoId)
    .get();

  if (!insumoSnap.exists) {
    throw new Error(`Insumo ${insumoId} não encontrado`);
  }
  console.log('   ✅ Insumo APPT REAGENTE validado');

  // Dados do CIQ lot com rastreabilidade completa
  const lotData = {
    labId,
    insumoId, // FK para o insumo APPT REAGENTE
    notaFiscalId, // FK para NF 10123

    // Identificação
    nivel: 'nv1', // APPT é Coagulação nível 1
    loteControle: '7281/26',
    fabricanteControle: 'APPT',

    // Datas
    aberturaControle: '2026-05-08', // String YYYY-MM-DD
    validadeControle: '2027-07-01', // String YYYY-MM-DD
    estabilidadePosAbertura: 90, // dias

    // Rastreabilidade Worklab (RDC 978/2025)
    rastreabilidadeWorklab: {
      exam: 'CTL',
      codigo: '107416'
    },

    // Valores de controle (média e desvio padrão)
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

    // Status
    lotStatus: 'aberto', // em uso
    runCount: 0, // nenhum teste executado ainda

    // Auditoria
    createdBy: userId,
    createdAt: admin.firestore.Timestamp.now(),
  };

  // Criar CIQ lot
  await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .doc(lotId)
    .set(lotData);

  console.log('\n✅ CIQ lot criado com sucesso!\n');
  console.log(`   ID do lote: ${lotId}`);
  console.log(`   Número: ${lotData.loteControle}`);
  console.log(`   Fabricante: ${lotData.fabricanteControle}`);
  console.log(`   Status: ${lotData.lotStatus}`);
  console.log(`   Validade: ${lotData.validadeControle}\n`);

  console.log('   📊 Rastreabilidade:');
  console.log(`     ├─ Insumo: ${insumoId}`);
  console.log(`     ├─ NF: ${notaFiscalId} (NF 10123)`);
  console.log(`     ├─ Worklab: CTL 107416`);
  console.log(`     └─ Valores: AP=100±5, INR=2.5±0.5, TTPA=35±3\n`);

} catch (err) {
  console.error('❌ Erro ao criar CIQ lot:');
  console.error('   Código:', err.code);
  console.error('   Mensagem:', err.message);
  process.exit(1);
}
