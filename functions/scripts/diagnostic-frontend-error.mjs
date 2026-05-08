import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n🔍 DIAGNÓSTICO: Simulando carga do frontend\n');

const labId = 'labclin-riopomba';
const COAG_ANALYTE_IDS = ['atividadeProtrombinica', 'rni', 'ttpa'];

// Simular o que buildChartLot() faz
async function testBuildChartLot() {
  console.log('1️⃣  Carregando lote...');
  const lotSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .where('loteControle', '==', '7281/26')
    .get();

  if (lotSnap.size === 0) {
    console.log('   ❌ Lote não encontrado');
    return;
  }

  const coagLot = lotSnap.docs[0].data();
  console.log(`   ✅ Lote carregado: ${coagLot.loteControle}`);
  console.log(`      nivel: ${coagLot.nivel}`);
  console.log(`      mean: ${JSON.stringify(coagLot.mean)}`);
  console.log(`      sd: ${JSON.stringify(coagLot.sd)}`);

  // Simular buildChartLot()
  console.log('\n2️⃣  Executando buildChartLot()...');

  // Simular COAG_ANALYTES (baseline values)
  const COAG_ANALYTES = {
    atividadeProtrombinica: {
      label: 'Atividade Protrombínica',
      levels: {
        I: { mean: 100, sd: 5, unit: '%' },
        II: { mean: 50, sd: 5, unit: '%' },
      },
    },
    rni: {
      label: 'INR',
      levels: {
        I: { mean: 1.0, sd: 0.2, unit: '(adimensional)' },
        II: { mean: 2.5, sd: 0.5, unit: '(adimensional)' },
      },
    },
    ttpa: {
      label: 'TP Ativado',
      levels: {
        I: { mean: 30, sd: 2, unit: 's' },
        II: { mean: 35, sd: 3, unit: 's' },
      },
    },
  };

  // Tentar montar manufacturerStats (é aqui que o erro ocorre)
  try {
    const manufacturerStats = Object.fromEntries(
      COAG_ANALYTE_IDS.map((id) => {
        console.log(`   Processando analito: ${id}`);
        console.log(`     nivel: ${coagLot.nivel}`);

        // Aqui tenta acessar baseline.mean
        const baseline = COAG_ANALYTES[id].levels[coagLot.nivel];
        console.log(`     baseline: ${JSON.stringify(baseline)}`);

        if (!baseline) {
          throw new Error(
            `Cannot read properties of undefined (reading 'mean')\n` +
            `  - COAG_ANALYTES[${id}].levels[${coagLot.nivel}] é undefined\n` +
            `  - Valores válidos para 'nivel': 'I' | 'II'\n` +
            `  - Valor fornecido: '${coagLot.nivel}'`
          );
        }

        const mean = coagLot.mean?.[id] ?? baseline.mean;
        const sd = coagLot.sd?.[id] ?? baseline.sd;

        console.log(`     ✅ mean=${mean}, sd=${sd}`);

        return [id, { mean, sd }];
      }),
    );

    console.log('\n   ✅ manufacturerStats calculado com sucesso');
    console.log(`      ${JSON.stringify(manufacturerStats, null, 2)}`);

  } catch (err) {
    console.log(`\n   ❌ ERRO: ${err.message}`);
    throw err;
  }

  // Simular carga de runs
  console.log('\n3️⃣  Carregando runs...');
  const runsSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .doc(lotSnap.docs[0].id)
    .collection('runs')
    .get();

  console.log(`   ✅ ${runsSnap.size} run(s) encontrado(s)`);
  runsSnap.docs.forEach((doc, idx) => {
    const run = doc.data();
    console.log(`      Run ${idx + 1}:`);
    console.log(`        - resultados: ${JSON.stringify(run.resultados)}`);
    console.log(`        - conformidade: ${run.conformidade}`);
  });
}

try {
  await testBuildChartLot();
  console.log('\n✅ DIAGNÓSTICO COMPLETO — Frontend deve funcionar agora\n');
} catch (err) {
  console.error('\n❌ ERRO ENCONTRADO:');
  console.error(err.message);
  process.exit(1);
}
