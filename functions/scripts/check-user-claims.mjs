/**
 * check-user-claims.mjs
 *
 * Lista todos os users e seus custom claims de módulo — verifica se o apply
 * do provisionModulesClaims realmente foi aplicado ou se silenciou.
 *
 * Uso:
 *   cd functions
 *   node scripts/check-user-claims.mjs
 */

import admin from 'firebase-admin';

admin.initializeApp();

async function main() {
  const out = [];
  let pageToken;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const u of result.users) {
      const claims = u.customClaims ?? {};
      out.push({
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        isSuperAdmin: claims.isSuperAdmin ?? false,
        modules: claims.modules ?? null,
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`Total users: ${out.length}\n`);
  for (const u of out) {
    const mods = u.modules
      ? Object.entries(u.modules)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(', ')
      : '(sem claim modules)';
    const sa = u.isSuperAdmin ? ' [SuperAdmin]' : '';
    console.log(`  ${u.email ?? u.uid}${sa}`);
    console.log(`    modules: ${mods}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
