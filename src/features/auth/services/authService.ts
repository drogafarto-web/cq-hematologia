import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { Lab, UserRole } from '../../../types';

// ─── Firestore document shape ─────────────────────────────────────────────────
// Internal to this service — consumers receive typed domain objects (Lab, AppProfile).

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
}

// ─── User document ────────────────────────────────────────────────────────────

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

export async function updateUserDocument(
  userId: string,
  fields: Partial<UserDocument>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, userId), fields as Record<string, unknown>);
}

// ─── Labs ─────────────────────────────────────────────────────────────────────

export async function getLabsForUser(labIds: string[]): Promise<Lab[]> {
  if (labIds.length === 0) return [];

  const snaps = await Promise.all(
    labIds.map((id) => getDoc(doc(db, COLLECTIONS.LABS, id)))
  );

  return snaps
    .filter((s) => s.exists())
    .map((s) => {
      const d = s.data()!;
      return {
        id: s.id,
        name: d.name as string,
        logoUrl: d.logoUrl as string | undefined,
        createdAt: d.createdAt?.toDate() ?? new Date(),
      } satisfies Lab;
    });
}

// ─── Member role ──────────────────────────────────────────────────────────────

/**
 * Returns the user's role if they are an active member of the lab, or null
 * if the document does not exist or the member is inactive.
 */
export async function getUserRole(
  labId: string,
  userId: string
): Promise<UserRole | null> {
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
