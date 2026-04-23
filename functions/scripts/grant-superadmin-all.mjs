/**
 * grant-superadmin-all.mjs
 *
 * Concede SuperAdmin a todos os usuários cadastrados MANTENDO snapshot
 * reversível em `temp/superadmin-grant/snapshots/{uid}`. Funcionalmente
 * equivalente ao callable `grantTemporarySuperAdminToAll`, mas executável
 * local via Admin SDK + Application Default Credentials — não exige
 * deploy das funções.
 *
 * AUTORIZAÇÃO EXPLÍCITA do CTO em 2026-04-22.
 *
 * Uso:
 *   # 1. Dry-run obrigatório — inspeciona lista
 *   node scripts/grant-superadmin-all.mjs
 *
 *   # 2. Apply — precisa token literal + reason ≥ 20 chars
 *   node scripts/grant-superadmin-all.mjs --apply \
 *     --token "EU-ENTENDO-OS-RISCOS-LGPD" \
 *     --reason "Período de testes pré-lançamento 2026-04-22 a 2026-05-05"
 *
 * Pré-requisitos:
 *   - gcloud auth application-default login    (ou GOOGLE_APPLICATION_CREDENTIALS)
 *   - Projeto correto: GOOGLE_CLOUD_PROJECT=hmatologia2 (ou gcloud config set-project)
 *
 * Reverter:
 *   node scripts/revoke-superadmin-all.mjs --apply --token "REVOGAR"
 */

import admin from 'firebase-admin';

// ─── Args ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const token = getArg('--token');
const reason = getArg('--reason');

function getArg(name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

const GRANT_TOKEN = 'EU-ENTENDO-OS-RISCOS-LGPD';
const MIN_REASON_LENGTH = 20;

if (apply) {
  if (token !== GRANT_TOKEN) {
    console.error(`\n❌ --token deve ser exatamente "${GRANT_TOKEN}"\n`);
    process.exit(2);
  }
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

async function getExistingClaims(uid) {
  const user = await auth.getUser(uid);
  return user.customClaims ?? {};
}

// ─── Core ────────────────────────────────────────────────────────────────────

const grantId = `grant-${Date.now()}-local`;
const users = await listAllAuthUsers();

console.log(`📋 usuários no Firebase Auth: ${users.length}`);

// Cross-check Firestore
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
  const claims = (u.customClaims ?? {});
  const firestore = firestoreStates.get(u.uid);
  const claimSa = claims.isSuperAdmin === true;
  const firestoreSa = firestore?.isSuperAdmin === true;
  const wasSuperAdminBefore = claimSa || firestoreSa;
  return {
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    wasSuperAdminBefore,
    willPromote: !wasSuperAdminBefore,
  };
});

const toPromote = diffs.filter((d) => d.willPromote);
const already = diffs.filter((d) => !d.willPromote);

console.log(`\n📊 resumo:`);
console.log(`   já SuperAdmin:      ${already.length}`);
console.log(`   a serem promovidos: ${toPromote.length}`);

if (toPromote.length > 0) {
  console.log(`\n👥 seriam promovidos:`);
  for (const d of toPromote.slice(0, 50)) {
    console.log(`   • ${d.email ?? d.uid}${d.displayName ? ` (${d.displayName})` : ''}`);
  }
  if (toPromote.length > 50) {
    console.log(`   … + ${toPromote.length - 50} outros`);
  }
}

if (!apply) {
  console.log(`\n✋ dry-run concluído. Nada foi escrito.`);
  console.log(
    `   Pra aplicar: node scripts/grant-superadmin-all.mjs --apply --token "${GRANT_TOKEN}" --reason "…"\n`,
  );
  process.exit(0);
}

// ─── Apply ───────────────────────────────────────────────────────────────────

console.log(`\n⚡ aplicando ${toPromote.length} promoção(ões)…`);

let done = 0;
let failed = 0;
for (const d of toPromote) {
  try {
    // Snapshot ANTES de mutar — proteção contra falha parcial
    await db.doc(`temp/superadmin-grant/snapshots/${d.uid}`).set({
      uid: d.uid,
      email: d.email,
      displayName: d.displayName,
      wasSuperAdminBefore: false,
      grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      grantedBy: 'local-script',
      grantId,
      reason,
    });

    // Firestore
    await db.doc(`users/${d.uid}`).set(
      { isSuperAdmin: true },
      { merge: true },
    );

    // Custom claim (merge com existentes)
    const existing = await getExistingClaims(d.uid);
    await auth.setCustomUserClaims(d.uid, {
      ...existing,
      isSuperAdmin: true,
    });

    done++;
    process.stdout.write(`\r   progresso: ${done}/${toPromote.length}`);
  } catch (err) {
    failed++;
    console.error(
      `\n   ❌ falha em ${d.email ?? d.uid}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

// Audit master
await db.collection('auditLogs').add({
  action: 'TEMP_SUPERADMIN_GRANT_APPLY_LOCAL',
  callerUid: 'local-script',
  callerEmail: null,
  grantId,
  payload: {
    scanned: users.length,
    toPromote: toPromote.length,
    alreadySuperAdmin: already.length,
    applied: done,
    failed,
    reason,
  },
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
});

console.log(`\n\n✅ concluído`);
console.log(`   promovidos: ${done}`);
console.log(`   falhas:     ${failed}`);
console.log(`   grantId:    ${grantId}`);
console.log(
  `   snapshot:   temp/superadmin-grant/snapshots (${done} docs)\n`,
);
console.log(
  `💡 usuários precisam fazer logout+login OU chamar getIdToken(true) pra ver o claim atualizado.\n`,
);

process.exit(failed > 0 ? 1 : 0);
