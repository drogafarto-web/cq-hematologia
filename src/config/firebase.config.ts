import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

// All values must be set in .env as VITE_FIREBASE_*
// Never hardcode credentials here — this file is committed to the repository.
const firebaseConfig = {
// @ts-ignore
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
// @ts-ignore
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
// @ts-ignore
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
// @ts-ignore
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
// @ts-ignore
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
// @ts-ignore
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} as const;

// Validate at startup — fail loudly rather than silently with broken auth.
const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

// @ts-ignore
const missing = REQUIRED_KEYS.filter((key) => !import.meta.env[key]);

if (missing.length > 0) {
  throw new Error(
    `[firebase.config] Missing environment variables:\n${missing.map((k) => `  • ${k}`).join('\n')}\n` +
      `Copy .env.example to .env and fill in the values.`,
  );
}

// Singleton — safe to call initializeApp multiple times in HMR environments.
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);

// ignoreUndefinedProperties: true — silently drops `undefined` fields instead of
// throwing, preventing "Unsupported field value: undefined" errors from optional
// TypeScript fields that resolve to `undefined` at runtime (e.g. manualOverride,
// sampleId). initializeFirestore must be called before any getFirestore() —
// the try/catch guards against HMR hot-reloads where Firestore is already init.
function createDb(): Firestore {
  const useLongPolling =
    typeof import.meta.env.VITE_FIRESTORE_USE_LONG_POLLING === 'string' &&
    import.meta.env.VITE_FIRESTORE_USE_LONG_POLLING === 'true';

  const settings: Parameters<typeof initializeFirestore>[1] = {
    ignoreUndefinedProperties: true,
    ...(useLongPolling ? { experimentalForceLongPolling: true } : {}),
  };

  try {
    return initializeFirestore(app, settings);
  } catch {
    return getFirestore(app);
  }
}
export const db: Firestore = createDb();
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app, 'southamerica-east1');
export default app;
