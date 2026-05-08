import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const db = admin.firestore();

console.log(`\n📋 Analisando memberships de usuários em ${projectId}\n`);

// Get all labs
const labsSnap = await db.collection('labs').get();
console.log(`📊 Total de labs: ${labsSnap.size}\n`);

for (const labDoc of labsSnap.docs) {
  const lab = labDoc.data();
  console.log(`🏥 Lab: ${lab.name} (${labDoc.id})`);

  // Get members of this lab
  const membersSnap = await db
    .collection('labs')
    .doc(labDoc.id)
    .collection('members')
    .get();

  for (const memberDoc of membersSnap.docs) {
    const member = memberDoc.data();
    const active = member.active ? '✅' : '❌';
    console.log(`  ${active} ${member.email} (${member.role})`);
  }
  console.log('');
}
