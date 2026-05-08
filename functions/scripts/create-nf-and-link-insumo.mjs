import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log('\n📄 Criando nota fiscal e vinculando insumo...\n');

const labId = 'labclin-riopomba';
const insumoId = '173627c9-0bc1-497b-9233-aa9b34f499bb'; // APPT REAGENTE que criamos
const userId = '2C7CDajpigXfaAVAzzJVFfrhgYB2'; // drogafarto@gmail.com

try {
  // Passo 1: Encontrar ou criar fornecedor APPT
  console.log('   Procurando fornecedor APPT...');
  const fornecedoresSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('fornecedores')
    .where('razaoSocial', '==', 'APPT')
    .get();

  let fornecedorId;
  if (fornecedoresSnap.empty) {
    console.log('   ⚠️  Fornecedor APPT não encontrado. Criando...');
    fornecedorId = 'appt-fornecedor';

    // CNPJ fictício válido para teste (11.222.333/0001-81)
    const cnpjTeste = '11222333000181';

    await db
      .collection('labs')
      .doc(labId)
      .collection('fornecedores')
      .doc(fornecedorId)
      .set({
        id: fornecedorId,
        labId,
        razaoSocial: 'APPT',
        nomeFantasia: 'APPT Reagentes',
        cnpj: cnpjTeste,
        inscricaoEstadual: 'isento',
        ativo: true,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: userId,
      });
    console.log('   ✅ Fornecedor criado: APPT');
  } else {
    fornecedorId = fornecedoresSnap.docs[0].id;
    console.log('   ✅ Fornecedor encontrado: ' + fornecedorId);
  }

  // Passo 2: Criar nota fiscal NF 10123
  console.log('\n   Criando nota fiscal 10123...');
  const notaId = 'nf-10123-' + Date.now();

  const hoje = new Date();
  const dataEmissao = new Date(2026, 4, 1); // 01/05/2026 (mesmo dia que abriu o lote)
  const dataRecebimento = new Date(2026, 4, 8); // 08/05/2026 (quando o lote foi aberto)

  await db
    .collection('labs')
    .doc(labId)
    .collection('notas-fiscais')
    .doc(notaId)
    .set({
      id: notaId,
      labId,
      fornecedorId,
      numero: '10123',
      serie: '1',
      dataEmissao: admin.firestore.Timestamp.fromDate(dataEmissao),
      dataRecebimento: admin.firestore.Timestamp.fromDate(dataRecebimento),
      observacoes: 'NF de entrada - APPT REAGENTE 7281/26',
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: userId,
    });

  console.log('   ✅ Nota fiscal criada: 10123');

  // Passo 3: Atualizar insumo para referenciar a nota fiscal
  console.log('\n   Vinculando insumo à nota fiscal...');
  await db
    .collection('labs')
    .doc(labId)
    .collection('insumos')
    .doc(insumoId)
    .update({
      notaFiscalId: notaId,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: userId,
    });

  console.log('   ✅ Insumo atualizado com notaFiscalId');

  console.log('\n✅ Fluxo concluído!\n');
  console.log(`   Fornecedor: APPT (${fornecedorId})`);
  console.log(`   Nota Fiscal: 10123 (${notaId})`);
  console.log(`   Insumo: APPT REAGENTE (${insumoId})`);
  console.log(`   Associação: Insumo → NF 10123 → Fornecedor APPT\n`);

} catch (err) {
  console.error('❌ Erro:');
  console.error('   Código:', err.code);
  console.error('   Mensagem:', err.message);
  process.exit(1);
}
