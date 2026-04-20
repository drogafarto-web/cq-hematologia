import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { Lab, UserRole } from '../../../types';
import { normalizeLab } from '../../admin/services/labSchema';

// ─── Firestore document shape ─────────────────────────────────────────────────

export interface UserDocument {
  email: string;
  displayName: string;
  labIds: string[];
  /** Denormalized for quick role lookup without fetching /members subcollection */
  roles: Record<string, UserRole>;
  isSuperAdmin: boolean;
  activeLabId: string | null;
  /**
   * Set when a user submits an access request but has no labs yet.
   * Allows the auth flow to show PendingLabAccessScreen without a
   * separate Firestore query (regular users cannot list accessRequests).
   */
  pendingLabId: string | null;
  /** Set by Cloud Function when Super Admin suspends/enables the account. */
  disabled?: boolean;
  /** Set on creation via Cloud Function. Absent for legacy accounts. */
  createdAt?: import('firebase/firestore').Timestamp;
}

export interface PendingUserDocument {
  email: string;
  displayName: string;
  photoURL: string | null;
  provider: 'google' | 'email';
  requestedAt: import('firebase/firestore').FieldValue;
}

// ─── Sign in ──────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

const googleProvider = new GoogleAuthProvider();

/**
 * Signs in via Google OAuth popup.
 * Returns the Firebase user WITHOUT creating any Firestore document.
 * The caller is responsible for checking getUserDocument() and handling
 * unauthorized access (sign out + error) or dispatching to normal flow.
 */
export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// ─── User document ────────────────────────────────────────────────────────────

/**
 * Read-only lookup. Returns null if the document does not exist.
 * NEVER creates a document. Use this in all OAuth and regular auth flows.
 */
export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return snap.exists() ? (snap.data() as UserDocument) : null;
}

/**
 * Creates a user document if it does not exist.
 * Use ONLY as a legacy fallback for email/password accounts that pre-date
 * admin-managed creation. Google OAuth must never call this.
 */
export async function getOrCreateUserDocument(user: User): Promise<UserDocument> {
  const ref = doc(db, COLLECTIONS.USERS, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as UserDocument;
  }

  const newDoc: UserDocument = {
    email: user.email ?? '',
    displayName: user.displayName ?? user.email ?? 'Usuário',
    labIds: [],
    roles: {},
    isSuperAdmin: false,
    activeLabId: null,
    pendingLabId: null,
  };

  await setDoc(ref, newDoc);
  return newDoc;
}

/**
 * Creates a pending_users/{labId}/{uid} entry for a Google OAuth user
 * who has no Firestore document. Must be called BEFORE signOut so the
 * user still has an auth token for the write.
 */
export async function createPendingUser(labId: string, user: User): Promise<void> {
  const ref = doc(collection(db, 'pending_users', labId, 'users'), user.uid);
  const data: PendingUserDocument = {
    email: user.email ?? '',
    displayName: user.displayName ?? user.email ?? 'Usuário',
    photoURL: user.photoURL,
    provider: 'google',
    requestedAt: (await import('firebase/firestore')).serverTimestamp(),
  };
  await setDoc(ref, data);
}

export async function updateUserDocument(
  userId: string,
  fields: Partial<UserDocument>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, userId), fields as Record<string, unknown>);
}

// ─── Labs ─────────────────────────────────────────────────────────────────────

export async function getLabsForUser(labIds: string[] | undefined): Promise<Lab[]> {
  if (!labIds || labIds.length === 0) return [];

  const snaps = await Promise.all(labIds.map((id) => getDoc(doc(db, COLLECTIONS.LABS, id))));

  return snaps.filter((s) => s.exists()).map((s) => normalizeLab({ ...s.data()!, id: s.id }));
}

// ─── Member role ──────────────────────────────────────────────────────────────

/**
 * Returns the user's role if they are an active member of the lab, or null
 * if the document does not exist or the member is inactive.
 */
export async function getUserRole(labId: string, userId: string): Promise<UserRole | null> {
  const ref = doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS, userId);
  const snap = await getDoc(ref);

  if (!snap.exists() || snap.data().active !== true) return null;
  return snap.data().role as UserRole;
}

// ─── Active lab ───────────────────────────────────────────────────────────────

export async function persistActiveLab(userId: string, labId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, userId), { activeLabId: labId });
}

export async function clearActiveLab(userId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, userId), { activeLabId: null });
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
