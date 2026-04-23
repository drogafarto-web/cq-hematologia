/**
 * revoke-superadmin-all.mjs
 *
 * Reverte o grant feito por `grant-superadmin-all.mjs`. Lê os snapshots em
 * `temp/superadmin-grant/snapshots` e demove apenas os usuários que estavam
 * como SuperAdmin=false antes do grant. SuperAdmins legítimos preexistentes
 * (não têm snapshot) NÃO são tocados.
 *
 * Uso:
 *   # Dry-run
 *   node scripts/revoke-superadmin-all.mjs
 *
 *   # Apply
 *   node scripts/revoke-superadmin-all.mjs --apply --token "REVOGAR"
 */

import admin from 'firebase-admin';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const token = argv[argv.indexOf('--token') + 1];

const REVOKE_TOKEN = 'REVOGAR';

if (apply && token !== REVOKE_TOKEN) {
  console.error(`\n❌ --token deve ser exatamente "${REVOKE_TOKEN}"\n`);
  process.exit(2);
}

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  'hmatologia2';

admin.initializeApp({ projectId });
const auth = admin.auth();
const db = admin.firestore();

console.log(`\n🔧 projeto: ${projectId}`);
console.log(`🔧 modo: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

async function getExistingClaims(uid) {
  const user = await auth.getUser(uid);
  return user.customClaims ?? {};
}

const snap = await db.collection('temp/superadmin-grant/snapshots').get();

if (snap.empty) {
  console.log(`📭 nenhum snapshot encontrado — nada a reverter.\n`);
  process.exit(0);
}

const toRevoke = snap.docs
  .filter((d) => d.data().wasSuperAdminBefore === false)
  .map((d) => ({
    uid: d.id,
    email: d.data().email ?? null,
    ref: d.ref,
  }));

console.log(`📊 resumo:`);
console.log(`   snapshots encontrados:      ${snap.size}`);
console.log(`   a serem revogados:          ${toRevoke.length}`);
console.log(
  `   mantidos SuperAdmin:        ${snap.size - toRevoke.length}  (já eram antes)`,
);

if (toRevoke.length > 0) {
  console.log(`\n👥 serão revogados:`);
  for (const d of toRevoke.slice(0, 50)) {
    console.log(`   • ${d.email ?? d.uid}`);
  }
  if (toRevoke.length > 50) {
    console.log(`   … + ${toRevoke.length - 50} outros`);
  }
}

if (!apply) {
  console.log(`\n✋ dry-run concluído. Nada foi escrito.`);
  console.log(
    `   Pra aplicar: node scripts/revoke-superadmin-all.mjs --apply --token "REVOGAR"\n`,
  );
  process.exit(0);
}

console.log(`\n⚡ revogando…`);

let done = 0;
let failed = 0;
for (const d of toRevoke) {
  try {
    await db.doc(`users/${d.uid}`).set({ isSuperAdmin: false }, { merge: true });

    const existing = await getExistingClaims(d.uid);
    await auth.setCustomUserClaims(d.uid, {
      ...existing,
      isSuperAdmin: false,
    });

    await d.ref.delete();

    done++;
    process.stdout.write(`\r   progresso: ${done}/${toRevoke.length}`);
  } catch (err) {
    failed++;
    console.error(
      `\n   ❌ falha em ${d.email ?? d.uid}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

await db.collection('auditLogs').add({
  action: 'TEMP_SUPERADMIN_REVOKE_APPLY_LOCAL',
  callerUid: 'local-script',
  callerEmail: null,
  payload: {
    scanned: snap.size,
    revoked: done,
    failed,
    keptSuperAdmin: snap.size - toRevoke.length,
  },
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
});

console.log(`\n\n✅ concluído`);
console.log(`   revogados: ${done}`);
console.log(`   falhas:    ${failed}\n`);
console.log(
  `💡 usuários revogados precisam fazer logout+login pra que o claim novo tome efeito.\n`,
);

process.exit(failed > 0 ? 1 : 0);
