/**
 * shared/services/firebase.ts
 *
 * Single import point for Firebase instances and Firestore utilities.
 * All feature modules import from here — never directly from firebase.config.ts.
 * This keeps the config layer isolated and makes testing/mocking straightforward.
 */

export { auth, db, storage } from '../../config/firebase.config';

export {
  // Firestore document operations
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,

  // Collections & queries
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,

  // Real-time listeners
  onSnapshot,

  // Timestamps & helpers
  serverTimestamp,
  Timestamp,
  FieldValue,
  increment,
  deleteField,

  // Batch & transaction
  writeBatch,
  runTransaction,
} from 'firebase/firestore';

export type {
  DocumentReference,
  DocumentSnapshot,
  CollectionReference,
  QuerySnapshot,
  QueryDocumentSnapshot,
  Unsubscribe,
  WriteBatch,
  FieldValue as FirestoreFieldValue,
} from 'firebase/firestore';

export {
  // Auth operations
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth';

export type { User, UserCredential } from 'firebase/auth';

export {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

export type { StorageReference, UploadTaskSnapshot } from 'firebase/storage';

// ─── Functions (callables) ───────────────────────────────────────────────────

export { functions } from '../../config/firebase.config';
export { httpsCallable } from 'firebase/functions';
export type { HttpsCallable, HttpsCallableResult } from 'firebase/functions';

// ─── Emulator wiring ─────────────────────────────────────────────────────────
// Activated only when `VITE_USE_EMULATOR === 'true'`. Idempotent — Firebase
// SDK throws if connect* is called twice on the same instance, guarded with try/catch
// to survive Vite HMR re-imports.
import {
  auth as _emuAuth,
  db as _emuDb,
  storage as _emuStorage,
  functions as _emuFunctions,
} from '../../config/firebase.config';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';
import { connectStorageEmulator } from 'firebase/storage';

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  try {
    connectAuthEmulator(_emuAuth, 'http://localhost:9099', { disableWarnings: true });
  } catch {
    // already connected (HMR)
  }
  try {
    connectFirestoreEmulator(_emuDb, 'localhost', 8080);
  } catch {
    // already connected
  }
  try {
    connectFunctionsEmulator(_emuFunctions, 'localhost', 5001);
  } catch {
    // already connected
  }
  try {
    connectStorageEmulator(_emuStorage, 'localhost', 9199);
  } catch {
    // already connected
  }
  // eslint-disable-next-line no-console
  console.info(
    '[firebase] emulator suite connected (auth:9099, firestore:8080, functions:5001, storage:9199)',
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export { firestoreErrorMessage } from '../utils/firebaseErrors';
