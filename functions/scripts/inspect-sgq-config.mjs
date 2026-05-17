#!/usr/bin/env node
/**
 * inspect-sgq-config.mjs — Inspeciona configs SGQ existentes
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'hmatologia2';

try { admin.initializeApp({ projectId: PROJECT_ID }); } catch {}
const db = admin.firestore();

async function main() {
  console.log('=== Inspecionando configs SGQ ===\n');
  
  // Check all labs
  const labsSnap = await db.collection('labs').get();
  console.log(`Labs encontrados: ${labsSnap.size}\n`);
  
  for (const labDoc of labsSnap.docs) {
    const labId = labDoc.id;
    const labData = labDoc.data();
    console.log(`Lab: ${labId} (nome: ${labData.nome || 'N/A'})`);
    
    // Check sgq-config/drive
    const driveConfigSnap = await db.doc(`/labs/${labId}/sgq-config/drive`).get();
    if (driveConfigSnap.exists) {
      console.log(`  ✅ sgq-config/drive: ${JSON.stringify(driveConfigSnap.data())}`);
    } else {
      console.log(`  ❌ sgq-config/drive: não existe`);
    }
    
    // Check sgq-documentos count and statuses
    const docsSnap = await db.collection(`/labs/${labId}/sgq-documentos`).get();
    const statusCount = {};
    let emRevisaoCount = 0;
    let emRevisaoDocs = [];
    
    docsSnap.forEach(d => {
      const data = d.data();
      const status = data.status || 'unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;
      if (status === 'em_revisao') {
        emRevisaoCount++;
        emRevisaoDocs.push({ id: d.id, ...data });
      }
    });
    
    console.log(`  sgq-documentos: ${docsSnap.size} total`);
    console.log(`  Status: ${JSON.stringify(statusCount)}`);
    
    if (emRevisaoDocs.length > 0) {
      console.log(`  Documentos em revisão:`);
      for (const doc of emRevisaoDocs.slice(0, 3)) {
        console.log(`    - ${doc.id}: ${doc.codigo} - ${doc.titulo} (v${doc.versao}, googleDocId: ${doc.googleDocId || 'não'})`);
      }
    }
    
    console.log('');
  }
}

main().catch(console.error);
