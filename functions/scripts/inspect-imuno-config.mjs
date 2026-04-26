/**
 * inspect-imuno-config.mjs (READ-ONLY)
 *
 * Inspeciona o estado de configuração do módulo CIQ Imuno para diagnosticar
 * por que um insumo (ex: WAMA PCR) não aparece no fluxo de cadastro de corrida.
 *
 * Imprime, por lab:
 *   - Test types em labs/{labId}/ciq-imuno-config/testTypes
 *     (com flag `manual` por tipo)
 *   - Equipamentos do módulo imunologia
 *   - Insumos ATIVOS do módulo imunologia (lote, equipamentos cobertos,
 *     testTypesCompativeis)
 *   - EquipmentSetup ativo por equipamento de imunologia
 */

import admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

function fmt(v) {
  if (v === undefined || v === null) return 'null';
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

async function main() {
  const labsSnap = await db.collection('labs').get();
  for (const labDoc of labsSnap.docs) {
    const labId = labDoc.id;
    console.log(`\n══════ LAB: ${labId} ══════`);

    // 1) Test Types — RAW dump
    const ttDoc = await db.doc(`labs/${labId}/ciq-imuno-config/testTypes`).get();
    if (!ttDoc.exists) {
      console.log('  [testTypes] (doc não existe)');
    } else {
      const data = ttDoc.data();
      console.log('  [testTypes RAW DOC]:', JSON.stringify(data, null, 2));
      console.log('  [updatedAt]:', data?.updatedAt?.toDate?.().toISOString?.() ?? '(sem)');
    }

    // 2) Equipamentos do módulo imunologia
    const eqSnap = await db
      .collection(`labs/${labId}/equipamentos`)
      .where('module', '==', 'imunologia')
      .get();
    console.log(`\n  [equipamentos imunologia] ${eqSnap.size}:`);
    for (const eq of eqSnap.docs) {
      const d = eq.data();
      console.log(
        `    ${eq.id}: name="${d.name}" modelo="${d.modelo}" subType="${d.subType ?? d.tipo ?? '?'}" ativo=${d.ativo ?? '?'}`,
      );
    }

    // 3a) Produtos-insumos — só os que mencionam "wama" ou imuno
    const prodSnap = await db.collection(`labs/${labId}/produtos-insumos`).get();
    console.log(`\n  [produtos-insumos relevantes]:`);
    for (const p of prodSnap.docs) {
      const d = p.data();
      const isImuno =
        d.modulo === 'imunologia' ||
        (Array.isArray(d.modulos) && d.modulos.includes('imunologia'));
      const matchesText = /(wama|pcr|latex|látex)/i.test(d.nomeComercial ?? '');
      if (!isImuno && !matchesText) continue;
      console.log(`    ${p.id}:`);
      console.log(`      nomeComercial: ${fmt(d.nomeComercial)}  fabricante: ${fmt(d.fabricante)}`);
      console.log(`      modulo: ${fmt(d.modulo)}  modulos: ${fmt(d.modulos)}  tipo: ${fmt(d.tipo)}`);
      console.log(`      equipamentoIds: ${fmt(d.equipamentoIds)}`);
      console.log(`      equipamentosCompativeis: ${fmt(d.equipamentosCompativeis)}`);
      console.log(`      testTypesCompativeis: ${fmt(d.testTypesCompativeis)}`);
    }

    // 3b) Insumos (lotes) — TODOS, com nomes de campo corretos
    const insumosSnap = await db.collection(`labs/${labId}/insumos`).get();
    console.log(`\n  [insumos TOTAL] ${insumosSnap.size}:`);
    for (const ins of insumosSnap.docs) {
      const d = ins.data();
      console.log(`    ${ins.id}:`);
      console.log(`      nomeComercial: ${fmt(d.nomeComercial)}  produtoId: ${fmt(d.produtoId)}`);
      console.log(`      modulo: ${fmt(d.modulo)}  modulos: ${fmt(d.modulos)}`);
      console.log(`      status: ${fmt(d.status)}  tipo: ${fmt(d.tipo)}`);
      console.log(`      lote: ${fmt(d.lote)}  fabricante: ${fmt(d.fabricante)}`);
      console.log(`      equipamentoIds: ${fmt(d.equipamentoIds)}`);
      console.log(`      equipamentosCompativeis: ${fmt(d.equipamentosCompativeis)}`);
      console.log(`      testTypesCompativeis: ${fmt(d.testTypesCompativeis)}`);
      console.log(`      runCount: ${fmt(d.runCount)}  qcStatus: ${fmt(d.qcStatus)}`);
    }

    // 4) Equipment setups por equipamento de imunologia
    console.log(`\n  [equipment-setups imunologia]:`);
    for (const eq of eqSnap.docs) {
      const setupDoc = await db.doc(`labs/${labId}/equipment-setups/${eq.id}`).get();
      if (!setupDoc.exists) {
        console.log(`    ${eq.id}: (sem setup)`);
        continue;
      }
      const s = setupDoc.data();
      console.log(`    ${eq.id} (${s?.equipamentoName ?? '?'}):`);
      console.log(`      activeReagenteId: ${fmt(s.activeReagenteId)}`);
      console.log(`      activeControleId: ${fmt(s.activeControleId)}`);
      console.log(`      activeTiraUroId: ${fmt(s.activeTiraUroId)}`);
    }

    // 5) Setup legado (docId = module)
    const legacySetup = await db.doc(`labs/${labId}/equipment-setups/imunologia`).get();
    if (legacySetup.exists) {
      const s = legacySetup.data();
      console.log(`\n  [equipment-setups legado docId=imunologia]:`);
      console.log(`    activeReagenteId: ${fmt(s.activeReagenteId)}`);
      console.log(`    activeControleId: ${fmt(s.activeControleId)}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
