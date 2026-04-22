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

// ─── Helpers ──────────────────────────────────────────────────────────────────

export { firestoreErrorMessage } from '../utils/firebaseErrors';
