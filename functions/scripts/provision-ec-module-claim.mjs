/**
 * provision-ec-module-claim.mjs
 *
 * Aplica o claim `modules['educacao-continuada']: true` a todos os usuários
 * ativos (com ≥1 `labIds`) no projeto. Complemento ao provisioning após a
 * introdução do 5º módulo.
 *
 * Equivalente funcional ao callable `provisionModulesClaims` mas executável
 * local via Admin SDK + Application Default Credentials — não exige UI nem
 * `firebase functions:call` (que não existe no CLI).
 *
 * Usa a mesma semântica do callable: setCustomUserClaims com `modules` =
 * `fullAccess()` para todo user com labIds. Idempotente.
 *
 * Uso:
 *   # 1. Dry-run — só inspeciona
 *   node scripts/provision-ec-module-claim.mjs
 *
 *   # 2. Apply — precisa --reason ≥ 20 chars
 *   node scripts/provision-ec-module-claim.mjs --apply \
 *     --reason "Provisionamento do claim Educação Continuada pós-deploy"
 *
 * Pré-requisitos:
 *   - gcloud auth application-default login  (ou GOOGLE_APPLICATION_CREDENTIALS)
 *   - GOOGLE_CLOUD_PROJECT=hmatologia2  (ou gcloud config set-project)
 */

import admin from 'firebase-admin';

// ─── Args ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const reason = getArg('--reason');

function getArg(name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

const MIN_REASON_LENGTH = 20;

if (apply) {
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    console.error(
      `\n❌ --reason é obrigatória com ≥ ${MIN_REASON_LENGTH} caracteres.\n`,
    );
    process.exit(2);
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  'hmatologia2';

admin.initializeApp({ projectId });
const auth = admin.auth();
const db = admin.firestore();

console.log(`\n🔧 projeto: ${projectId}`);
console.log(`🔧 modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);
if (apply) console.log(`🔧 reason: ${reason}`);
console.log('');

// ─── Target state ────────────────────────────────────────────────────────────

const FULL_ACCESS = {
  hematologia: true,
  imunologia: true,
  coagulacao: true,
  uroanalise: true,
  'educacao-continuada': true,
};

const ALL_MODULES = Object.keys(FULL_ACCESS);

function modulesEqual(a, b) {
  for (const k of ALL_MODULES) {
    if (a?.[k] !== b[k]) return false;
  }
  return true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function listAllAuthUsers() {
  const out = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    out.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return out;
}

// ─── Core ────────────────────────────────────────────────────────────────────

const runId = `provision-ec-${Date.now()}`;
const users = await listAllAuthUsers();

console.log(`📋 usuários no Firebase Auth: ${users.length}`);

// Firestore /users/{uid} para ler labIds
const firestoreStates = new Map();
const chunks = [];
for (let i = 0; i < users.length; i += 30) chunks.push(users.slice(i, i + 30));
for (const chunk of chunks) {
  const refs = chunk.map((u) => db.doc(`users/${u.uid}`));
  const snaps = await db.getAll(...refs);
  for (const snap of snaps) {
    firestoreStates.set(
      snap.id,
      snap.exists ? (snap.data() ?? null) : null,
    );
  }
}

// Diffs
const diffs = users.map((u) => {
  const claims = u.customClaims ?? {};
  const beforeModules = (claims.modules ?? null);
  const fs = firestoreStates.get(u.uid);
  const labIds = Array.isArray(fs?.labIds) ? fs.labIds : [];
  const hasLabs = labIds.length > 0;
  const needsUpdate =
    hasLabs &&
    (beforeModules === null || !modulesEqual(beforeModules, FULL_ACCESS));
  return {
    uid: u.uid,
    email: u.email ?? null,
    hasLabs,
    labIdCount: labIds.length,
    beforeModules,
    needsUpdate,
  };
});

const toUpdate = diffs.filter((d) => d.needsUpdate);
const noLabs = diffs.filter((d) => !d.hasLabs);
const alreadyOk = diffs.filter((d) => d.hasLabs && !d.needsUpdate);

console.log(`\n📊 resumo:`);
console.log(`   sem labs (skipped): ${noLabs.length}`);
console.log(`   já com claim ok:    ${alreadyOk.length}`);
console.log(`   serão atualizados:  ${toUpdate.length}`);

if (toUpdate.length > 0) {
  console.log(`\n👥 exemplos a atualizar:`);
  for (const d of toUpdate.slice(0, 30)) {
    const hadModules = d.beforeModules !== null;
    console.log(
      `   • ${d.email ?? d.uid}${hadModules ? ' (merge)' : ' (new)'} · ${d.labIdCount} lab(s)`,
    );
  }
  if (toUpdate.length > 30) {
    console.log(`   … + ${toUpdate.length - 30} outros`);
  }
}

if (!apply) {
  console.log(`\n✋ dry-run concluído. Nada foi escrito.`);
  console.log(
    `   Pra aplicar: node scripts/provision-ec-module-claim.mjs --apply --reason "…"\n`,
  );
  process.exit(0);
}

// ─── Apply ───────────────────────────────────────────────────────────────────

console.log(`\n⚡ aplicando ${toUpdate.length} atualização(ões)…`);

let done = 0;
let failed = 0;
for (const d of toUpdate) {
  try {
    // Firestore `/users/{uid}.modules` espelha o claim (consistente com callable)
    await db.doc(`users/${d.uid}`).set(
      { modules: FULL_ACCESS },
      { merge: true },
    );

    // Custom claim (merge preservando demais claims como isSuperAdmin)
    const user = await auth.getUser(d.uid);
    const existing = user.customClaims ?? {};
    await auth.setCustomUserClaims(d.uid, {
      ...existing,
      modules: FULL_ACCESS,
    });

    done++;
    process.stdout.write(`\r   progresso: ${done}/${toUpdate.length}`);
  } catch (err) {
    failed++;
    console.error(
      `\n   ❌ falha em ${d.email ?? d.uid}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

// Audit master
await db.collection('auditLogs').add({
  action: 'PROVISION_EC_MODULE_CLAIM_APPLY_LOCAL',
  callerUid: 'local-script',
  callerEmail: null,
  runId,
  payload: {
    scanned: users.length,
    skippedNoLabs: noLabs.length,
    alreadyOk: alreadyOk.length,
    toUpdate: toUpdate.length,
    applied: done,
    failed,
    reason,
  },
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
});

console.log(`\n\n✅ concluído`);
console.log(`   atualizados: ${done}`);
console.log(`   falhas:      ${failed}`);
console.log(`   runId:       ${runId}`);
console.log(
  `\n💡 usuários precisam fazer logout+login OU chamar getIdToken(true) pra ver o claim atualizado.\n`,
);

process.exit(failed > 0 ? 1 : 0);
