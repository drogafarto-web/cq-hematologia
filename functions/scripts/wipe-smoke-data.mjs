/**
 * wipe-smoke-data.mjs
 *
 * Limpeza de dados de smoke/seed do laboratório alvo (default: Rio Pomba).
 *
 * Escopo:
 *   - labs/{labId}/ciq-imuno/{lotId}                — lotes CIQ-Imuno
 *   - labs/{labId}/ciq-imuno/{lotId}/runs/*         — corridas
 *   - labs/{labId}/ciq-imuno/{lotId}/audit/*        — audit do lote (imutável via Rules
 *                                                     mas pode ser deletado pelo admin SDK
 *                                                     que bypassa Rules — incluído no wipe)
 *   - labs/{labId}/insumos/{insumoId}               — catálogo de insumos
 *   - labs/{labId}/insumo-movimentacoes/*           — movimentações (chain-hash reset)
 *   - labs/{labId}/produtos-insumo/*                — produtos (catálogo de produtos)
 *
 * Audit logs do lab (labs/{labId}/auditLogs) NÃO são tocados — preservar trilha histórica.
 *
 * Uso:
 *   cd functions
 *   node scripts/wipe-smoke-data.mjs                  # DRY RUN — só lista contadores
 *   node scripts/wipe-smoke-data.mjs --lab=<id>       # outro lab
 *   node scripts/wipe-smoke-data.mjs --apply          # APLICA — irreversível
 *
 * Pré-requisitos:
 *   - gcloud auth application-default login (ou GOOGLE_APPLICATION_CREDENTIALS)
 *   - GOOGLE_CLOUD_PROJECT=hmatologia2
 */

import admin from 'firebase-admin';

admin.initializeApp();

// ─── CLI parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const labArg = args.find((a) => a.startsWith('--lab='));
const overrideLabId = labArg ? labArg.slice('--lab='.length) : null;

const TARGET_LAB_NAME = 'LabClin Rio Pomba MG';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findTargetLab(db) {
  if (overrideLabId) {
    const doc = await db.collection('labs').doc(overrideLabId).get();
    if (!doc.exists) throw new Error(`Lab ${overrideLabId} não existe.`);
    return doc;
  }
  const snap = await db.collection('labs').where('name', '==', TARGET_LAB_NAME).get();
  if (snap.empty) throw new Error(`Nenhum lab com name="${TARGET_LAB_NAME}".`);
  if (snap.size > 1) {
    console.warn(`⚠️  ${snap.size} labs com mesmo nome — usando o primeiro.`);
  }
  return snap.docs[0];
}

async function deleteCollectionRecursive(ref) {
  // Admin SDK helper: deleteRecursive não existe, mas bulkWriter cuida.
  const bulkWriter = admin.firestore().bulkWriter();
  let total = 0;
  bulkWriter.onWriteResult(() => {
    total++;
  });
  await admin.firestore().recursiveDelete(ref, bulkWriter);
  return total;
}

async function countCollection(ref) {
  const snap = await ref.count().get();
  return snap.data().count;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = admin.firestore();

  console.log(`\n${'═'.repeat(64)}`);
  console.log(apply ? '🔥 APPLY MODE — mudanças serão persistidas' : '🔍 DRY RUN — nada será alterado');
  console.log('═'.repeat(64));

  const labDoc = await findTargetLab(db);
  const labId = labDoc.id;
  const labName = labDoc.data().name ?? '(sem nome)';
  console.log(`\nLab alvo: ${labId}`);
  console.log(`Nome:     ${labName}\n`);

  // ─── Contadores ─────────────────────────────────────────────────────────────
  const lotsRef = labDoc.ref.collection('ciq-imuno');
  const lotsSnap = await lotsRef.get();

  let totalRuns = 0;
  let totalAudit = 0;
  for (const lot of lotsSnap.docs) {
    totalRuns += await countCollection(lot.ref.collection('runs'));
    totalAudit += await countCollection(lot.ref.collection('audit'));
  }

  const insumosCount = await countCollection(labDoc.ref.collection('insumos'));
  const movimCount = await countCollection(labDoc.ref.collection('insumo-movimentacoes'));
  const produtosCount = await countCollection(labDoc.ref.collection('produtos-insumo'));

  console.log('Inventário do que seria apagado:\n');
  console.log(`  ciq-imuno (lotes):                ${lotsSnap.size}`);
  console.log(`    └─ runs (corridas):             ${totalRuns}`);
  console.log(`    └─ audit (lot decisions):       ${totalAudit}`);
  console.log(`  insumos:                          ${insumosCount}`);
  console.log(`  insumo-movimentacoes (chain):     ${movimCount}`);
  console.log(`  produtos-insumo:                  ${produtosCount}`);

  // Sample lots
  if (lotsSnap.size > 0) {
    console.log('\nLotes (primeiros 10):');
    for (const lot of lotsSnap.docs.slice(0, 10)) {
      const d = lot.data();
      console.log(
        `  ${d.testType?.padEnd(20) ?? '?'} ${d.loteControle?.padEnd(28) ?? '?'} ` +
          `setup=${d.setupType ?? '—'} runs=${d.runCount ?? 0} dec=${d.ciqDecision ?? '—'}`,
      );
    }
    if (lotsSnap.size > 10) console.log(`  … +${lotsSnap.size - 10} outros`);
  }

  // ─── Apply ──────────────────────────────────────────────────────────────────
  if (!apply) {
    console.log('\n→ Para aplicar: rode novamente com --apply');
    console.log('  ATENÇÃO: chain-hash de insumo-movimentacoes será resetado (irreversível)\n');
    return;
  }

  console.log('\nIniciando wipe...\n');

  console.log('  • ciq-imuno (cascade lotes/runs/audit)...');
  const lotsDeleted = await deleteCollectionRecursive(lotsRef);
  console.log(`    ✓ ${lotsDeleted} docs removidos`);

  console.log('  • insumos...');
  const insumosDeleted = await deleteCollectionRecursive(labDoc.ref.collection('insumos'));
  console.log(`    ✓ ${insumosDeleted} docs removidos`);

  console.log('  • insumo-movimentacoes (chain-hash reset)...');
  const movimDeleted = await deleteCollectionRecursive(
    labDoc.ref.collection('insumo-movimentacoes'),
  );
  console.log(`    ✓ ${movimDeleted} docs removidos`);

  console.log('  • produtos-insumo...');
  const produtosDeleted = await deleteCollectionRecursive(
    labDoc.ref.collection('produtos-insumo'),
  );
  console.log(`    ✓ ${produtosDeleted} docs removidos`);

  console.log('\n✅ Wipe concluído. Lab pronto pra uso real.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Falhou:', err);
    process.exit(1);
  });
