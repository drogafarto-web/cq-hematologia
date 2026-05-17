#!/usr/bin/env node
/**
 * test-sgq-gdocs.mjs — Testa integração Google Docs do módulo SGQ
 *
 * Uso:
 *   cd functions
 *   node scripts/test-sgq-gdocs.mjs
 *
 * Requer:
 *   - GOOGLE_APPLICATION_CREDENTIALS apontando para service account com acesso Firestore
 *   - Ou estar logado no firebase CLI com acesso ao projeto hmatologia2
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'hmatologia2';
const LAB_ID = 'labclin-riopomba';

// Initialize Admin SDK
try {
  admin.initializeApp({ projectId: PROJECT_ID });
} catch {
  // Already initialized
}

const db = admin.firestore();

async function checkDriveConfig() {
  console.log('\n=== Verificando configuração do Drive ===');
  const configSnap = await db.doc(`/labs/${LAB_ID}/sgq-config/drive`).get();
  
  if (!configSnap.exists) {
    console.error(`❌ Config não existe em /labs/${LAB_ID}/sgq-config/drive`);
    return null;
  }
  
  const config = configSnap.data();
  console.log('Config encontrada:', JSON.stringify(config, null, 2));
  
  if (!config.folderId) {
    console.error('❌ folderId não encontrado na config');
    return null;
  }
  
  console.log(`✅ folderId: ${config.folderId}`);
  return config;
}

async function findEmRevisaoDocument() {
  console.log('\n=== Buscando documento em revisão ===');
  const q = db.collection(`/labs/${LAB_ID}/sgq-documentos`)
    .where('status', '==', 'em_revisao')
    .where('deletadoEm', '==', null)
    .limit(1);
  
  const snap = await q.get();
  
  if (snap.empty) {
    // Try without deletadoEm filter (maybe field doesn't exist)
    const q2 = db.collection(`/labs/${LAB_ID}/sgq-documentos`)
      .where('status', '==', 'em_revisao')
      .limit(5);
    
    const snap2 = await q2.get();
    
    if (snap2.empty) {
      console.error('❌ Nenhum documento com status "em_revisao" encontrado');
      
      // Show some docs for debugging
      const allSnap = await db.collection(`/labs/${LAB_ID}/sgq-documentos`).limit(3).get();
      console.log('\nDocumentos existentes (amostra):');
      allSnap.forEach(d => {
        const data = d.data();
        console.log(`  - ${d.id}: status=${data.status}, codigo=${data.codigo}, titulo=${data.titulo}`);
      });
      
      return null;
    }
    
    const doc = snap2.docs[0];
    const data = doc.data();
    console.log(`✅ Documento encontrado: ${doc.id}`);
    console.log(`   codigo: ${data.codigo}`);
    console.log(`   titulo: ${data.titulo}`);
    console.log(`   status: ${data.status}`);
    console.log(`   versao: ${data.versao}`);
    console.log(`   googleDocId: ${data.googleDocId || '(não vinculado)'}`);
    
    return { id: doc.id, ...data };
  }
  
  const doc = snap.docs[0];
  const data = doc.data();
  console.log(`✅ Documento encontrado: ${doc.id}`);
  console.log(`   codigo: ${data.codigo}`);
  console.log(`   titulo: ${data.titulo}`);
  console.log(`   status: ${data.status}`);
  console.log(`   versao: ${data.versao}`);
  console.log(`   googleDocId: ${data.googleDocId || '(não vinculado)'}`);
  
  return { id: doc.id, ...data };
}

async function main() {
  console.log('🧪 Teste de Integração SGQ Google Docs');
  console.log(`Projeto: ${PROJECT_ID}`);
  console.log(`Lab: ${LAB_ID}`);
  
  const config = await checkDriveConfig();
  if (!config) {
    console.error('\n⛔ Pré-requisito falhou: config do Drive não encontrada');
    console.error('Crie o documento /labs/labclin-riopomba/sgq-config/drive com campo folderId');
    process.exit(1);
  }
  
  const documento = await findEmRevisaoDocument();
  if (!documento) {
    console.error('\n⛔ Pré-requisito falhou: nenhum documento em revisão encontrado');
    process.exit(1);
  }
  
  console.log('\n=== Pré-requisitos OK ===');
  console.log(`Documento ID: ${documento.id}`);
  console.log(`Drive Folder: ${config.folderId}`);
  console.log('\nPronto para testar callables.');
  console.log('Execute os testes via browser (app em produção) ou use o script de invocação.');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
