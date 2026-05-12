import admin from 'firebase-admin';
const projectId = 'hmatologia2';
if (!admin.apps.length) admin.initializeApp({ projectId });
const db = admin.firestore();
const labId = 'labclin-riopomba';
const members = await db.collection('labs').doc(labId).collection('members').get();
console.log(`Members in ${labId}: ${members.size}`);
members.forEach(doc => {
  console.log(`- ${doc.id}: active=${doc.data().active}`);
});
