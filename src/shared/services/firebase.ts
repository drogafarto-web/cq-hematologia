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

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { FirestoreError } from 'firebase/firestore';

/**
 * Maps Firestore error codes to human-readable Portuguese messages.
 * Use at service boundaries — never expose raw Firebase errors to the UI.
 */
export function firestoreErrorMessage(error: unknown): string {
  if (!(error instanceof FirestoreError)) {
    return 'Erro inesperado. Tente novamente.';
  }

  const messages: Partial<Record<FirestoreError['code'], string>> = {
    'permission-denied':    'Sem permissão para realizar esta operação.',
    'not-found':            'Documento não encontrado.',
    'already-exists':       'Registro já existe.',
    'resource-exhausted':   'Limite de requisições atingido. Aguarde alguns instantes.',
    'unavailable':          'Serviço temporariamente indisponível. Verifique sua conexão.',
    'deadline-exceeded':    'A operação demorou demais. Tente novamente.',
    'unauthenticated':      'Sessão expirada. Faça login novamente.',
    'cancelled':            'Operação cancelada.',
  };

  return messages[error.code] ?? `Erro Firebase: ${error.code}`;
}
