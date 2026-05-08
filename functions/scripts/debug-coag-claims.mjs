import admin from 'firebase-admin';

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'hmatologia2';
admin.initializeApp({ projectId });

const auth = admin.auth();
const db = admin.firestore();

console.log(`\n📋 Analisando claims de usuários em ${projectId}\n`);

// List all users
let users = [];
let pageToken = undefined;
do {
  const result = await auth.listUsers(1000, pageToken);
  users.push(...result.users);
  pageToken = result.pageToken;
} while (pageToken);

console.log(`📊 Total de usuários: ${users.length}\n`);

for (const user of users) {
  const modules = user.customClaims?.modules || {};
  const coag = modules.coagulacao ? '✅' : '❌';
  const isSuperAdmin = user.customClaims?.isSuperAdmin ? '(SuperAdmin)' : '';

  console.log(`${coag} ${user.email || user.uid}`);
  console.log(`   UID: ${user.uid}`);
  console.log(`   Claims: ${JSON.stringify(user.customClaims || {})}`);
  console.log('');
}
