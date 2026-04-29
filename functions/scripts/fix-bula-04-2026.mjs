/**
 * Fix one-shot: bula Controllab 04/2026 (HHI-1375/1376/1377) Yumizen H550.
 *
 * O upload da bula via UI falhou silenciosamente (sem error tracking pré-Sentry).
 * Este script:
 *   1. Cria os 3 lotes em /lots e /insumos (dual-write) com manufacturerStats
 *      extraídos do PDF (Versão 2 - 04/2026, página 16, equipamento Yumizen H550).
 *   2. Marca archivedAt em HHI-1372/1373/1374 (bula 03/2026) preservando
 *      sub-coleção runs intacta — RDC 786 / ISO 15189.
 *
 * Idempotente: skipa criação se HHI-1375/76/77 já existem.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);
const labId = 'labclin-riopomba';

// ─── Stats Yumizen H550 — bula Controllab 04/2026 ───────────────────────────
// Extraído manualmente do PDF: MOD12 16/17 (Versão 2 - 04/2026).
// Mapeamento bula → analyteId interno:
//   Hemácias→RBC, Hematócrito→HCT, Hemoglobina→HGB, MCH, MCHC, MCV, MPV,
//   PCT, PDW(=PDW-SD), Plaquetas→PLT, RDW(=RDW-CV).
// Yumizen H550 não publica WBC/diferenciais nessa bula — analytes ausentes
// ficam fora de manufacturerStats e o lote roda Westgard só nos publicados.

const COMMON = {
  controlName: 'Controle Interno Hematologia Automação',
  equipmentName: 'Yumizen H550',
  serialNumber: '',
  startDate: new Date('2026-04-29T00:00:00Z'),
  expiryDate: new Date('2026-06-01T00:00:00Z'),
};

const NEW_LOTS = [
  {
    lotNumber: 'HHI-1375',
    level: 1,
    manufacturerStats: {
      RBC: { mean: 3.127, sd: 0.06 },
      HCT: { mean: 25.87, sd: 0.91 },
      HGB: { mean: 9.3, sd: 0.17 },
      MCHC: { mean: 36.43, sd: 1.21 },
      MCV: { mean: 84.18, sd: 2.93 },
      MPV: { mean: 11.85, sd: 0.95 },
      PDW: { mean: 19.75, sd: 0.49 },
      PLT: { mean: 171.3, sd: 3.1 },
      RDW: { mean: 15.68, sd: 1.23 },
    },
  },
  {
    lotNumber: 'HHI-1376',
    level: 2,
    manufacturerStats: {
      RBC: { mean: 4.335, sd: 0.083 },
      HCT: { mean: 37.95, sd: 0.86 },
      HGB: { mean: 13.68, sd: 0.39 },
      MCH: { mean: 31.55, sd: 1.27 },
      MCHC: { mean: 36.05, sd: 1.3 },
      MCV: { mean: 87.55, sd: 0.94 },
      MPV: { mean: 12.5, sd: 0.98 },
      PCT: { mean: 0.398, sd: 0.04 },
      PDW: { mean: 20.9, sd: 1.98 },
      PLT: { mean: 322.3, sd: 10.2 },
      RDW: { mean: 13.73, sd: 0.87 },
    },
  },
  {
    lotNumber: 'HHI-1377',
    level: 3,
    manufacturerStats: {
      RBC: { mean: 4.835, sd: 0.15 },
      HCT: { mean: 42.28, sd: 1.61 },
      HGB: { mean: 15.3, sd: 0.44 },
      MCH: { mean: 31.7, sd: 1.32 },
      MCHC: { mean: 36.3, sd: 1.53 },
      MCV: { mean: 87.4, sd: 1.02 },
      MPV: { mean: 11.83, sd: 1.01 },
      PCT: { mean: 0.578, sd: 0.053 },
      PDW: { mean: 20.25, sd: 0.64 },
      PLT: { mean: 489.3, sd: 24.7 },
      RDW: { mean: 14.05, sd: 0.84 },
    },
  },
];

const OLD_LOT_NUMBERS = ['HHI-1372', 'HHI-1373', 'HHI-1374'];

const NIVEL_FROM_LEVEL = { 1: 'baixo', 2: 'normal', 3: 'alto' };

async function main() {
  const lotsCol = db.collection('labs').doc(labId).collection('lots');
  const insumosCol = db.collection('labs').doc(labId).collection('insumos');
  const now = Timestamp.now();
  const nowDate = now.toDate();

  // ── 1) Criar novos lotes (idempotente) ───────────────────────────────────
  console.log('\n=== Criando HHI-1375/76/77 ===');
  for (const lot of NEW_LOTS) {
    const dupSnap = await lotsCol
      .where('lotNumber', '==', lot.lotNumber)
      .where('level', '==', lot.level)
      .where('controlName', '==', COMMON.controlName)
      .get();
    if (!dupSnap.empty) {
      console.log(`  SKIP ${lot.lotNumber} — já existe (${dupSnap.docs[0].id.slice(0, 8)})`);
      continue;
    }

    const id = randomUUID();
    const requiredAnalytes = Object.keys(lot.manufacturerStats);
    const lotDoc = {
      labId,
      lotNumber: lot.lotNumber,
      controlName: COMMON.controlName,
      equipmentName: COMMON.equipmentName,
      serialNumber: COMMON.serialNumber,
      level: lot.level,
      startDate: Timestamp.fromDate(COMMON.startDate),
      expiryDate: Timestamp.fromDate(COMMON.expiryDate),
      requiredAnalytes,
      manufacturerStats: lot.manufacturerStats,
      statistics: null,
      runCount: 0,
      createdAt: now,
      createdBy: 'fix-script-bula-04-2026',
    };

    const insumoDoc = {
      labId,
      tipo: 'controle',
      nivel: NIVEL_FROM_LEVEL[lot.level],
      modulo: 'hematologia',
      modulos: ['hematologia'],
      fabricante: 'Controllab',
      nomeComercial: COMMON.controlName,
      lote: lot.lotNumber,
      validade: Timestamp.fromDate(COMMON.expiryDate),
      dataAbertura: null,
      diasEstabilidadeAbertura: 0,
      validadeReal: Timestamp.fromDate(COMMON.expiryDate),
      status: 'ativo',
      createdAt: now,
      createdBy: 'fix-script-bula-04-2026',
      stats: lot.manufacturerStats,
      bulaLevel: lot.level,
      controlProgramName: COMMON.controlName,
      startDate: Timestamp.fromDate(COMMON.startDate),
      equipmentName: COMMON.equipmentName,
      serialNumber: COMMON.serialNumber,
      requiredAnalytes,
    };

    const batch = db.batch();
    batch.set(lotsCol.doc(id), lotDoc);
    batch.set(insumosCol.doc(id), insumoDoc);
    await batch.commit();
    console.log(`  ✓ ${lot.lotNumber} NV${lot.level} criado (id=${id.slice(0, 8)}, analytes=${requiredAnalytes.length})`);
  }

  // ── 2) Arquivar lotes antigos da bula 03/2026 ────────────────────────────
  console.log('\n=== Arquivando HHI-1372/73/74 ===');
  for (const lotNumber of OLD_LOT_NUMBERS) {
    const snap = await lotsCol.where('lotNumber', '==', lotNumber).get();
    if (snap.empty) {
      console.log(`  SKIP ${lotNumber} — não encontrado`);
      continue;
    }
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.archivedAt) {
        console.log(`  SKIP ${lotNumber} (id=${doc.id.slice(0, 8)}) — já arquivado`);
        continue;
      }
      const batch = db.batch();
      batch.update(lotsCol.doc(doc.id), { archivedAt: now });
      // Espelha em /insumos se existir lá também (dual-source)
      const insumoRef = insumosCol.doc(doc.id);
      const insumoSnap = await insumoRef.get();
      if (insumoSnap.exists) {
        batch.update(insumoRef, { archivedAt: now, status: 'fechado' });
      }
      await batch.commit();
      console.log(`  ✓ ${lotNumber} arquivado (id=${doc.id.slice(0, 8)}, archivedAt=${nowDate.toISOString()})`);
    }
  }

  console.log('\n✓ Done.');
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
