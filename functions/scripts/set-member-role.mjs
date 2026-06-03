/**
 * set-member-role.mjs
 *
 * Atualiza `members/{uid}.role` num lab — operação privilegiada (Admin SDK).
 * Snapshot do role anterior é gravado em `temp/role-changes/{ts}_{uid}` antes
 * da escrita pra rastreabilidade.
 *
 * Uso:
 *   # Dry-run (default — só imprime o diff)
 *   node scripts/set-member-role.mjs --lab <labId> --uid <uid> --role owner
 *
 *   # Apply (escreve)
 *   node scripts/set-member-role.mjs --lab <labId> --uid <uid> --role owner --apply
 *
 * Roles válidos: owner | admin | member
 */

import admin from 'firebase-admin';

admin.initializeApp();

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const labId = getArg('--lab');
const uid = getArg('--uid');
const role = getArg('--role');

function getArg(name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

const VALID_ROLES = ['owner', 'admin', 'member'];

if (!labId || !uid || !role) {
  console.error(
    '\nUso: node scripts/set-member-role.mjs --lab <labId> --uid <uid> --role <role> [--apply]\n',
  );
  process.exit(2);
}
if (!VALID_ROLES.includes(role)) {
  console.error(`\nRole inválido: "${role}". Use um de: ${VALID_ROLES.join(', ')}\n`);
  process.exit(2);
}

async function main() {
  const db = admin.firestore();
  const memberRef = db.doc(`labs/${labId}/members/${uid}`);
  const labRef = db.doc(`labs/${labId}`);

  const [labSnap, memberSnap] = await Promise.all([labRef.get(), memberRef.get()]);
  if (!labSnap.exists) {
    console.error(`\n❌ Lab "${labId}" não existe.\n`);
    process.exit(1);
  }
  if (!memberSnap.exists) {
    console.error(`\n❌ Member "${uid}" não existe em /labs/${labId}/members.\n`);
    process.exit(1);
  }

  const labName = labSnap.data().name ?? '(sem nome)';
  const current = memberSnap.data();
  const prevRole = current.role ?? '(sem role)';

  console.log(`\nLab:      ${labId} — ${labName}`);
  console.log(`Member:   ${uid}`);
  console.log(`Role:     ${prevRole}  →  ${role}`);
  console.log(`Active:   ${current.active === true}\n`);

  if (prevRole === role) {
    console.log('Nenhuma mudança — role já é o desejado.\n');
    return;
  }

  if (!apply) {
    console.log('Dry-run. Re-rode com --apply para escrever.\n');
    return;
  }

  // Snapshot pra rollback
  const ts = Date.now();
  const snapRef = db.doc(`temp_role_changes/${ts}_${uid}`);
  await snapRef.set({
    labId,
    uid,
    prevRole,
    newRole: role,
    appliedAt: admin.firestore.FieldValue.serverTimestamp(),
    snapshotData: current,
  });

  await memberRef.update({ role });
  console.log(`✅ Aplicado. Snapshot em temp_role_changes/${ts}_${uid}.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
