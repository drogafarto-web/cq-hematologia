import admin from 'firebase-admin';
import { randomUUID } from 'crypto';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n📦 Criando insumo (reagente) APPT 7281/26...\n');

const labId = 'labclin-riopomba';
const insumoId = randomUUID();

// Dados extraídos do formulário de "Novo lote de insumo"
const insumo = {
  // Identificação
  tipo: 'reagente',
  modulo: 'coagulacao',
  modulos: ['coagulacao'],

  // Produto
  nomeComercial: 'APPT REAGENTE',
  fabricante: 'APPT', // Assumindo que é o mesmo do fabricante
  lote: '7281/26',

  // Validade (01/07/2027)
  validade: admin.firestore.Timestamp.fromDate(new Date(2027, 6, 1)),

  // Abertura (08/05/2026)
  dataAbertura: admin.firestore.Timestamp.fromDate(new Date(2026, 4, 8)),

  // Estabilidade pós-abertura: 90 dias
  diasEstabilidadeAbertura: 90,

  // Status inicial (já aberto)
  status: 'ativo',

  // Worklab (rastreabilidade - CTL 107416)
  // Campo customizado se não existir no schema padrão
  worklabExam: 'CTL',
  worklabCodigo: '107416',

  // Timestamps
  createdAt: admin.firestore.Timestamp.now(),
  createdBy: '2C7CDajpigXfaAVAzzJVFfrhgYB2', // drogafarto@gmail.com

  // Counters
  activationsCount: 0,
  runCount: 0,
};

// Calcular validadeReal (min entre validade e dataAbertura + diasEstabilidade)
const validadeDate = insumo.validade.toDate();
const aberturaDate = insumo.dataAbertura.toDate();
const diasMs = insumo.diasEstabilidadeAbertura * 24 * 60 * 60 * 1000;
const validadeAbertura = new Date(aberturaDate.getTime() + diasMs);
const validadeReal = validadeDate < validadeAbertura ? validadeDate : validadeAbertura;

insumo.validadeReal = admin.firestore.Timestamp.fromDate(validadeReal);

try {
  await db.collection('labs').doc(labId).collection('insumos').doc(insumoId).set(insumo);

  console.log('✅ Insumo criado com sucesso!\n');
  console.log(`   ID: ${insumoId}`);
  console.log(`   Tipo: ${insumo.tipo}`);
  console.log(`   Produto: ${insumo.nomeComercial}`);
  console.log(`   Lote: ${insumo.lote}`);
  console.log(`   Status: ${insumo.status}`);
  console.log(`   Aberto em: 08/05/2026`);
  console.log(`   Validade: 01/07/2027 (ou antes se atingir estabilidade)\n`);
} catch (err) {
  console.error('❌ Erro ao criar insumo:');
  console.error('   Código:', err.code);
  console.error('   Mensagem:', err.message);
  process.exit(1);
}
