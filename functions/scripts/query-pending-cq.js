const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require('../service-account.json.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'hmatologia2'
});

const db = admin.firestore();

(async () => {
  try {
    const labsSnapshot = await db.collection('labs').get();
    console.log(`\n📦 Found ${labsSnapshot.size} labs\n`);
    
    let totalPending = 0;
    
    for (const labDoc of labsSnapshot.docs) {
      const labId = labDoc.id;
      
      const insumosSnapshot = await db
        .collection('labs')
        .doc(labId)
        .collection('insumo-movimentacoes')
        .get();
      
      const pendingCQ = insumosSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.cqStatus !== 'validated' && data.cqStatus !== undefined;
      });
      
      if (pendingCQ.length > 0) {
        totalPending += pendingCQ.length;
        console.log(`🔴 Lab: ${labId} — ${pendingCQ.length} insumo(s) pending CQ`);
        
        pendingCQ.forEach(doc => {
          const data = doc.data();
          console.log(`\n   ├─ Lote: ${data.lote}`);
          console.log(`   ├─ Fabricante: ${data.fabricante}`);
          console.log(`   ├─ Tipo: ${data.type}`);
          console.log(`   ├─ CQ Status: ${data.cqStatus}`);
          console.log(`   └─ Abert: ${data.dataAbertura ? new Date(data.dataAbertura.toDate()).toLocaleString('pt-BR') : 'N/A'}`);
        });
      }
    }
    
    console.log(`\n✓ Total: ${totalPending} insumo(s) awaiting CQ validation\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
