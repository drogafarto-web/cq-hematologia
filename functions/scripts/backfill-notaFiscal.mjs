import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'hmatologia2' });
const db = admin.firestore();

const labId = process.argv.find((a) => a.startsWith('--labId='))?.split('=')[1];
if (!labId) {
  console.error('Usage: node backfill-notaFiscal.mjs --labId=<lab>');
  process.exit(1);
}

async function backfill() {
  const insumos = await db.collection(`labs/${labId}/insumos`).get();
  let updated = 0,
    skipped = 0;

  // Create catch-all Fornecedor
  const forn = await db.collection(`labs/${labId}/fornecedores`).add({
    razaoSocial: 'Fornecedor Legado (Sem Rastreabilidade)',
    cnpj: '00.000.000/0000-00',
    status: 'qualificado',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create synthetic NF
  const nf = await db.collection(`labs/${labId}/notas-fiscais`).add({
    numero: `LEGADO-${Date.now()}`,
    serie: '1',
    dataEmissao: '2026-01-01',
    fornecedorId: forn.id,
    itens: [],
    valorTotal: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Backfill Insumos
  for (const doc of insumos.docs) {
    if (doc.data().notaFiscalId) {
      skipped++;
      continue;
    }
    await doc.ref.update({
      notaFiscalId: nf.id,
      fornecedorId: forn.id,
      _legacyMigrated: true,
      _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    updated++;
  }

  console.log(`✅ Backfill completo: ${updated} atualizados, ${skipped} pulados`);
  process.exit(0);
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
