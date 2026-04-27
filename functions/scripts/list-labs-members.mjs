/**
 * list-labs-members.mjs
 *
 * Diagnóstico read-only: lista todos os labs e seus members com role.
 *
 * Uso:
 *   cd functions
 *   node scripts/list-labs-members.mjs
 *
 * Pré-requisitos:
 *   - gcloud auth application-default login (ou GOOGLE_APPLICATION_CREDENTIALS)
 *   - Projeto correto: GOOGLE_CLOUD_PROJECT=hmatologia2
 */

import admin from 'firebase-admin';

admin.initializeApp();

async function main() {
  const db = admin.firestore();
  const auth = admin.auth();

  const labsSnap = await db.collection('labs').get();
  console.log(`\nTotal labs: ${labsSnap.size}\n`);

  // Pre-busca user emails pra correlacionar uid → email
  const usersByUid = new Map();
  let pageToken;
  do {
    const r = await auth.listUsers(1000, pageToken);
    for (const u of r.users) usersByUid.set(u.uid, u.email ?? '(sem email)');
    pageToken = r.pageToken;
  } while (pageToken);

  for (const labDoc of labsSnap.docs) {
    const lab = labDoc.data();
    console.log(`Lab: ${labDoc.id} — ${lab.name ?? '(sem nome)'}`);

    const membersSnap = await labDoc.ref.collection('members').get();
    if (membersSnap.empty) {
      console.log('  (sem members)');
      continue;
    }

    for (const m of membersSnap.docs) {
      const data = m.data();
      const email = usersByUid.get(m.id) ?? '(uid desconhecido em Auth)';
      const role = data.role ?? '(sem role)';
      const active = data.active === true ? 'ativo' : 'INATIVO';
      console.log(`  ${m.id}  ${role.padEnd(8)}  ${active.padEnd(7)}  ${email}`);
    }
    console.log();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
