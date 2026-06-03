import admin from 'firebase-admin';
import { randomUUID } from 'crypto';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n🔬 ═══════════════════════════════════════════════════════════════');
console.log('   SMOKE TEST DETALHADO — MÓDULO COAGULAÇÃO');
console.log('═══════════════════════════════════════════════════════════════\n');

const labId = 'labclin-riopomba';
const userId = '2C7CDajpigXfaAVAzzJVFfrhgYB2';
const results = {
  checks: [],
  errors: [],
  warnings: [],
};

function check(title, passed, details = '') {
  results.checks.push({ title, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${title}`);
  if (details) console.log(`   ${details}`);
}

function warn(msg) {
  results.warnings.push(msg);
  console.log(`⚠️  ${msg}`);
}

function error(msg) {
  results.errors.push(msg);
  console.log(`❌ ${msg}`);
}

try {
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📋 FASE 1: VALIDAÇÃO DE INFRAESTRUTURA\n');

  // 1.1 Verificar fornecedor
  const fornecedorSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('fornecedores')
    .doc('appt-fornecedor')
    .get();
  check(
    'Fornecedor APPT existe',
    fornecedorSnap.exists,
    fornecedorSnap.exists ? 'appt-fornecedor' : 'não encontrado',
  );

  // 1.2 Verificar nota fiscal
  const notasSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('notas-fiscais')
    .where('numero', '==', '10123')
    .get();
  check(
    'Nota Fiscal 10123 existe',
    notasSnap.size === 1,
    `${notasSnap.size} documento(s) encontrado(s)`,
  );
  const notaId = notasSnap.docs[0]?.id || null;

  // 1.3 Verificar insumo
  const insumoId = '173627c9-0bc1-497b-9233-aa9b34f499bb';
  const insumoSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('insumos')
    .doc(insumoId)
    .get();

  if (insumoSnap.exists) {
    const insumo = insumoSnap.data();
    check('Insumo APPT REAGENTE existe', true, insumoId);
    check('  └─ tipo: reagente', insumo.tipo === 'reagente', insumo.tipo);
    check('  └─ status: ativo', insumo.status === 'ativo', insumo.status);
    check(
      '  └─ modulos: [coagulacao]',
      Array.isArray(insumo.modulos) && insumo.modulos.includes('coagulacao'),
      insumo.modulos?.join(', ') || 'vazio',
    );
    check('  └─ notaFiscalId preenchido', !!insumo.notaFiscalId, insumo.notaFiscalId || 'vazio');
    check(
      '  └─ equipamentoId: clotimer-duo',
      insumo.equipamentoId === 'clotimer-duo',
      insumo.equipamentoId || 'vazio',
    );
  } else {
    error('Insumo APPT REAGENTE não existe');
  }

  // 1.4 Verificar equipamento
  const equipSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('equipamentos')
    .doc('clotimer-duo')
    .get();
  check(
    'Equipamento CLOT DUO existe',
    equipSnap.exists,
    equipSnap.exists ? 'clotimer-duo' : 'não encontrado',
  );

  // 1.5 Verificar EquipmentSetup
  const setupSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('equipment-setups')
    .doc('clotimer-duo')
    .get();

  if (setupSnap.exists) {
    const setup = setupSnap.data();
    check('EquipmentSetup existe', true, 'clotimer-duo');
    check('  └─ module: coagulacao', setup.module === 'coagulacao', setup.module);
    check(
      '  └─ activeReagenteId preenchido',
      setup.activeReagenteId === insumoId,
      setup.activeReagenteId || 'vazio',
    );
    check('  └─ equipamentoName', setup.equipamentoName === 'CLOT DUO', setup.equipamentoName);
  } else {
    error('EquipmentSetup não existe');
  }

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n📋 FASE 2: VALIDAÇÃO DE LOTES\n');

  const lotSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('ciq-coagulacao')
    .where('loteControle', '==', '7281/26')
    .get();

  if (lotSnap.size === 0) {
    error('Nenhum CIQ lot 7281/26 encontrado');
  } else if (lotSnap.size > 1) {
    warn(`${lotSnap.size} lotes com número 7281/26 (duplicados?)`);
  }

  const lotId = lotSnap.docs[0]?.id;
  const lot = lotSnap.docs[0]?.data();

  if (lot) {
    check('CIQ Lot 7281/26 existe', true, lotId);
    check('  └─ nivel: nv1', lot.nivel === 'nv1', lot.nivel);
    check('  └─ lotStatus: aberto', lot.lotStatus === 'aberto', lot.lotStatus);
    check('  └─ insumoId preenchido', !!lot.insumoId, lot.insumoId || 'vazio');
    check('  └─ notaFiscalId preenchido', !!lot.notaFiscalId, lot.notaFiscalId || 'vazio');
    check('  └─ setupType: principal', lot.setupType === 'principal', lot.setupType || 'vazio');
    check('  └─ pinnedAt preenchido', !!lot.pinnedAt, lot.pinnedAt ? 'sim' : 'não');

    // Verificar valores de mean/sd
    const hasMean = lot.mean && lot.mean.atividadeProtrombinica !== undefined;
    const hasSD = lot.sd && lot.sd.atividadeProtrombinica !== undefined;
    check(
      '  └─ mean preenchido',
      hasMean,
      hasMean ? `AP=${lot.mean.atividadeProtrombinica}` : 'vazio',
    );
    check('  └─ sd preenchido', hasSD, hasSD ? `AP=${lot.sd.atividadeProtrombinica}` : 'vazio');

    // ───────────────────────────────────────────────────────────────────────
    console.log('\n📋 FASE 3: TESTE DE CORRIDA (RUN)\n');

    // Criar um run de teste
    const runId = randomUUID();
    const runData = {
      id: runId,
      labId,
      lotId,
      equipamentoId: 'clotimer-duo',
      nivel: 'nv1',
      loteControle: '7281/26',
      fabricanteControle: 'APPT',
      aberturaControle: '2026-05-08',
      validadeControle: '2027-07-01',
      loteReagente: '7281/26',
      fabricanteReagente: 'APPT',
      aberturaReagente: '2026-05-08',
      validadeReagente: '2027-07-01',
      isi: 2.0,
      mnpt: 12.0,
      temperaturaAmbiente: 24,
      umidadeAmbiente: 55,
      dataRealizacao: '2026-05-08',
      resultados: {
        atividadeProtrombinica: 100,
        rni: 2.5,
        ttpa: 35,
      },
      conformidade: 'A',
      analitosComViolacao: [],
      createdBy: userId,
      createdAt: admin.firestore.Timestamp.now(),
      status: 'confirmed',
    };

    await db
      .collection('labs')
      .doc(labId)
      .collection('ciq-coagulacao')
      .doc(lotId)
      .collection('runs')
      .doc(runId)
      .set(runData);

    check('Run criado com sucesso', true, `runId: ${runId.slice(0, 8)}...`);

    // Verificar que o run foi salvo
    const runCheckSnap = await db
      .collection('labs')
      .doc(labId)
      .collection('ciq-coagulacao')
      .doc(lotId)
      .collection('runs')
      .doc(runId)
      .get();

    check(
      '  └─ Run persistido no Firestore',
      runCheckSnap.exists,
      runCheckSnap.exists ? 'sim' : 'não',
    );

    if (runCheckSnap.exists) {
      const savedRun = runCheckSnap.data();
      check(
        '  └─ Resultados presentes',
        !!savedRun.resultados,
        `${Object.keys(savedRun.resultados).length} analitos`,
      );
      check('  └─ Conformidade: A', savedRun.conformidade === 'A', savedRun.conformidade);
      check('  └─ Status: confirmed', savedRun.status === 'confirmed', savedRun.status);
    }

    // ───────────────────────────────────────────────────────────────────────
    console.log('\n📋 FASE 4: RASTREABILIDADE\n');

    // Verificar cadeia completa
    const traceOk =
      lot.insumoId === insumoId &&
      lot.notaFiscalId === notaId &&
      insumoSnap.data().notaFiscalId === notaId &&
      insumoSnap.data().equipamentoId === 'clotimer-duo';

    check('Cadeia de rastreabilidade completa', traceOk, `Lot→Insumo→NF→Fornecedor→Equipamento`);

    if (traceOk) {
      console.log(`   └─ Lote: ${lot.loteControle}`);
      console.log(`   └─ Insumo: ${insumoSnap.data().nomeComercial}`);
      console.log(`   └─ NF: 10123`);
      console.log(`   └─ Fornecedor: APPT`);
      console.log(`   └─ Equipamento: CLOT DUO`);
    }

    // ───────────────────────────────────────────────────────────────────────
    console.log('\n📋 FASE 5: CONFORMIDADE RDC\n');

    check('RDC 786/2023 (rastreabilidade fiscal)', !!lot.notaFiscalId, 'notaFiscalId presente');
    check(
      'RDC 978/2025 (worklab)',
      !!lot.rastreabilidadeWorklab,
      lot.rastreabilidadeWorklab
        ? `${lot.rastreabilidadeWorklab.exam} ${lot.rastreabilidadeWorklab.codigo}`
        : 'vazio',
    );
    check('CLSI H47-A2 (níveis)', ['nv1', 'nv2'].includes(lot.nivel), `Nível ${lot.nivel}`);
    check('Westgard (mean/SD)', hasMean && hasSD, 'Valores de controle presentes');
  }

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n📋 FASE 6: RELATÓRIO FINAL\n');

  const totalChecks = results.checks.length;
  const passedChecks = results.checks.filter((c) => c.passed).length;
  const failedChecks = results.checks.filter((c) => !c.passed).length;

  console.log(`Total de checks: ${totalChecks}`);
  console.log(`✅ Passou: ${passedChecks}`);
  console.log(`❌ Falhou: ${failedChecks}`);
  console.log(`⚠️  Avisos: ${results.warnings.length}`);

  if (failedChecks === 0 && results.errors.length === 0) {
    console.log('\n🎉 SMOKE TEST APROVADO — COAGULAÇÃO PRONTA PARA PRODUÇÃO\n');
  } else {
    console.log('\n⚠️  SMOKE TEST COM FALHAS — REVISAR ACIMA\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════\n');
} catch (err) {
  console.error('❌ ERRO CRÍTICO NO TESTE:');
  console.error('   Mensagem:', err.message);
  console.error('   Stack:', err.stack);
  process.exit(1);
}
