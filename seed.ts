/**
 * seed.ts — Creates demo@labclin.com as SuperAdmin with a seed lab.
 *
 * Run:
 *   npx tsx --env-file=.env seed.ts          (Node 20.6+)
 *   OR: npx dotenv -e .env -- npx tsx seed.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  connectAuthEmulator,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, connectFirestoreEmulator } from 'firebase/firestore';

// ─── Config ────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.VITE_FIREBASE_APP_ID!,
};

const USE_EMULATOR = process.env.VITE_USE_EMULATOR === 'true';

const DEMO_EMAIL = 'demo@labclin.com';
const DEMO_PASSWORD = '123456';
const LAB_ID = 'labclin-riopomba';

// ─── Init ──────────────────────────────────────────────────────────────────────

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

if (USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.log('🔧  Conectado aos emuladores (Auth :9099, Firestore :8080)');
}

// ─── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  // 1. Create or sign in demo user
  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    uid = cred.user.uid;
    console.log(`✅  Usuário criado: ${DEMO_EMAIL} (uid: ${uid})`);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
      uid = cred.user.uid;
      console.log(`ℹ️   Usuário já existe, logado: ${DEMO_EMAIL} (uid: ${uid})`);
    } else {
      throw err;
    }
  }

  // 2. User document
  await setDoc(doc(db, 'users', uid), {
    email: DEMO_EMAIL,
    displayName: 'Demo Admin',
    labIds: [LAB_ID],
    roles: { [LAB_ID]: 'owner' },
    isSuperAdmin: true,
    activeLabId: LAB_ID,
    pendingLabId: null,
  });
  console.log(`✅  /users/${uid} atualizado`);

  // 3. Lab document
  await setDoc(doc(db, 'labs', LAB_ID), {
    name: 'LabClin Rio Pomba MG',
    createdAt: new Date(),
  });
  console.log(`✅  /labs/${LAB_ID} criado`);

  // 4. Lab member
  await setDoc(doc(db, 'labs', LAB_ID, 'members', uid), {
    role: 'owner',
    active: true,
  });
  console.log(`✅  /labs/${LAB_ID}/members/${uid} criado`);

  console.log('\n🚀  Seed completo!');
  console.log(`   E-mail:  ${DEMO_EMAIL}`);
  console.log(`   Senha:   ${DEMO_PASSWORD}`);
  console.log(`   UID:     ${uid}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌  Seed falhou:', err);
  process.exit(1);
});
