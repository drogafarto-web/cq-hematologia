import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin (assuming default credentials or project ID)
const projectId = 'hmatologia2';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: projectId,
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function diagnose(labId = 'labclin-riopomba') {
  console.log(`🔍 Diagnosing for Lab: ${labId}\n`);

  const listUsersResult = await auth.listUsers();
  const users = listUsersResult.users;

  for (const user of users) {
    console.log(`--- User: ${user.email} (${user.uid}) ---`);
    
    // 1. users/{uid}
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      console.log(`❌ users/${user.uid} DOES NOT EXIST`);
    } else {
      const data = userDoc.data();
      const labIds = data.labIds || [];
      const activeLabId = data.activeLabId || 'NONE';
      const hasLab = labIds.includes(labId);
      console.log(`✅ users/${user.uid} exists. activeLabId: ${activeLabId}. labIds: [${labIds.join(', ')}]. Contains ${labId}: ${hasLab ? 'YES' : '❌ NO'}`);
    }

    // 2. labs/{labId}/members/{uid}
    const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(user.uid).get();
    if (!memberDoc.exists) {
      console.log(`❌ labs/${labId}/members/${user.uid} DOES NOT EXIST`);
    } else {
      const data = memberDoc.data();
      const active = data.active;
      console.log(`✅ labs/${labId}/members/${user.uid} exists. active: ${active} (${typeof active})`);
    }

    // 3. Custom Claims
    const claims = user.customClaims || {};
    const modules = claims.modules || {};
    const hasCeq = !!modules.ceq;
    console.log(`🔑 Custom Claims: ${JSON.stringify(claims)}`);
    console.log(`   modules.ceq: ${hasCeq ? '✅ TRUE' : '❌ FALSE'}`);
    console.log('\n');
  }
}

diagnose().catch(console.error);
