const admin = require('firebase-admin');

const serviceAccount = require('../service-account.json.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'hmatologia2'
});

const db = admin.firestore();

(async () => {
  try {
    const labId = 'labclin-riopomba';
    
    // List all collections under this lab
    const labRef = db.collection('labs').doc(labId);
    const collections = await labRef.listCollections();
    
    console.log(`\n📂 Collections in lab "${labId}":\n`);
    collections.forEach(col => {
      console.log(`   - ${col.id}`);
    });
    
    // Check if there's an 'insumos' collection
    const insumosRef = db.collection('labs').doc(labId).collection('insumos');
    const insumosSnapshot = await insumosRef.get();
    
    console.log(`\n🔍 insumos collection: ${insumosSnapshot.size} docs`);
    if (insumosSnapshot.size > 0) {
      console.log('\nFirst insumo doc:');
      const firstDoc = insumosSnapshot.docs[0];
      console.log('ID:', firstDoc.id);
      console.log('Data:', JSON.stringify(firstDoc.data(), null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
