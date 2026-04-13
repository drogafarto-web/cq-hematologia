import {
  db,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { Lab, UserRole, AccessRequest, AccessRequestStatus } from '../../../types';
import type { UserDocument } from '../../auth/services/authService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName: string;
  isSuperAdmin: boolean;
  labIds: string[];
  roles: Record<string, UserRole>;
  activeLabId: string | null;
}

export interface AdminLabRecord extends Lab {
  memberCount: number;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function fetchAllUsers(): Promise<AdminUserRecord[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.USERS));
  return snap.docs.map((d) => {
    const data = d.data() as UserDocument;
    return {
      uid: d.id,
      email: data.email,
      displayName: data.displayName,
      isSuperAdmin: data.isSuperAdmin,
      labIds: data.labIds ?? [],
      roles: data.roles ?? {},
      activeLabId: data.activeLabId ?? null,
    };
  });
}

export async function fetchUser(uid: string): Promise<AdminUserRecord | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!snap.exists()) return null;
  const data = snap.data() as UserDocument;
  return {
    uid: snap.id,
    email: data.email,
    displayName: data.displayName,
    isSuperAdmin: data.isSuperAdmin,
    labIds: data.labIds ?? [],
    roles: data.roles ?? {},
    activeLabId: data.activeLabId ?? null,
  };
}

export async function setSuperAdmin(uid: string, value: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), { isSuperAdmin: value });
}

export async function removeUserFromLab(labId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);

  batch.delete(doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS, uid));

  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data() as UserDocument;
    const labIds = (userData.labIds ?? []).filter((id) => id !== labId);
    const roles = { ...(userData.roles ?? {}) };
    delete roles[labId];
    const updates: Record<string, unknown> = { labIds, roles };
    if (userData.activeLabId === labId) updates.activeLabId = null;
    batch.update(userRef, updates);
  }

  await batch.commit();
}

// ─── Labs ─────────────────────────────────────────────────────────────────────

export async function fetchAllLabs(): Promise<AdminLabRecord[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.LABS));

  const labs = await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data();
      const membersSnap = await getDocs(
        collection(db, COLLECTIONS.LABS, d.id, SUBCOLLECTIONS.MEMBERS)
      );
      return {
        id: d.id,
        name: data.name as string,
        logoUrl: data.logoUrl as string | undefined,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        memberCount: membersSnap.size,
      } satisfies AdminLabRecord;
    })
  );

  return labs.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createLabAsAdmin(
  name: string,
  ownerUid: string
): Promise<string> {
  const labRef = doc(collection(db, COLLECTIONS.LABS));
  const labId = labRef.id;

  const batch = writeBatch(db);

  batch.set(labRef, { name: name.trim(), createdAt: serverTimestamp() });

  batch.set(doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS, ownerUid), {
    role: 'owner',
    active: true,
  });

  const userRef = doc(db, COLLECTIONS.USERS, ownerUid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data() as UserDocument;
    const labIds = userData.labIds ?? [];
    batch.update(userRef, {
      labIds: [...labIds, labId],
      [`roles.${labId}`]: 'owner',
    });
  }

  await batch.commit();
  return labId;
}

export async function deleteLabAsAdmin(labId: string): Promise<void> {
  // Collect all member UIDs
  const membersSnap = await getDocs(
    collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS)
  );

  const batch = writeBatch(db);

  for (const memberDoc of membersSnap.docs) {
    const uid = memberDoc.id;
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as UserDocument;
      const labIds = (userData.labIds ?? []).filter((id) => id !== labId);
      const roles = { ...(userData.roles ?? {}) };
      delete roles[labId];
      const updates: Record<string, unknown> = { labIds, roles };
      if (userData.activeLabId === labId) updates.activeLabId = null;
      batch.update(userRef, updates);
    }
    batch.delete(memberDoc.ref);
  }

  batch.delete(doc(db, COLLECTIONS.LABS, labId));
  await batch.commit();
}

// ─── Access Requests ──────────────────────────────────────────────────────────

export async function fetchAllAccessRequests(
  status?: AccessRequestStatus
): Promise<AccessRequest[]> {
  const constraints = status
    ? [where('status', '==', status), orderBy('createdAt', 'desc')]
    : [orderBy('createdAt', 'desc')];

  const snap = await getDocs(
    query(collection(db, COLLECTIONS.ACCESS_REQUESTS), ...constraints)
  );

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      uid: data.uid,
      email: data.email,
      displayName: data.displayName ?? data.email,
      labId: data.labId,
      labName: data.labName ?? '',
      status: data.status as AccessRequestStatus,
      createdAt: data.createdAt?.toDate() ?? new Date(),
    };
  });
}

export async function approveAccessRequest(
  requestId: string,
  labId: string,
  uid: string,
  role: UserRole = 'member'
): Promise<void> {
  const batch = writeBatch(db);

  batch.set(doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS, uid), {
    role,
    active: true,
  });

  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data() as UserDocument;
    const labIds = userData.labIds ?? [];
    batch.update(userRef, {
      labIds: labIds.includes(labId) ? labIds : [...labIds, labId],
      [`roles.${labId}`]: role,
      pendingLabId: null,
    });
  }

  batch.update(doc(db, COLLECTIONS.ACCESS_REQUESTS, requestId), { status: 'approved' });
  await batch.commit();
}

export async function denyAccessRequest(requestId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.ACCESS_REQUESTS, requestId), { status: 'denied' });
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists() && userSnap.data().pendingLabId) {
    batch.update(userRef, { pendingLabId: null });
  }
  await batch.commit();
}

export async function deleteAccessRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.ACCESS_REQUESTS, requestId));
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface SuperAdminStats {
  totalUsers: number;
  totalLabs: number;
  pendingRequests: number;
}

export async function fetchSuperAdminStats(): Promise<SuperAdminStats> {
  const [usersSnap, labsSnap, requestsSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.USERS)),
    getDocs(collection(db, COLLECTIONS.LABS)),
    getDocs(
      query(
        collection(db, COLLECTIONS.ACCESS_REQUESTS),
        where('status', '==', 'pending')
      )
    ),
  ]);

  return {
    totalUsers: usersSnap.size,
    totalLabs: labsSnap.size,
    pendingRequests: requestsSnap.size,
  };
}
