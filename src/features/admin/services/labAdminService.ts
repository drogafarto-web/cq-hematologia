import {
  db,
  storage,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
  writeBatch,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS, storagePath } from '../../../constants';
import type { Lab, UserRole } from '../../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LabMember {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
}

export interface CreateLabPayload {
  name: string;
  logoFile?: File;
}

export interface UpdateLabPayload {
  name?: string;
  logoFile?: File;
}

// ─── Lab CRUD ─────────────────────────────────────────────────────────────────

export async function createLab(
  payload: CreateLabPayload,
  ownerUid: string
): Promise<Lab> {
  const labRef = doc(collection(db, COLLECTIONS.LABS));
  const labId = labRef.id;

  let logoUrl: string | undefined;
  if (payload.logoFile) {
    logoUrl = await uploadLabLogo(labId, payload.logoFile);
  }

  const now = serverTimestamp();
  const labData = {
    name: payload.name.trim(),
    logoUrl: logoUrl ?? null,
    createdAt: now,
  };

  const batch = writeBatch(db);

  batch.set(labRef, labData);

  // Owner member entry
  const memberRef = doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS, ownerUid);
  batch.set(memberRef, { role: 'owner', active: true });

  // Update user document
  const userRef = doc(db, COLLECTIONS.USERS, ownerUid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const labIds: string[] = userData.labIds ?? [];
    const roles: Record<string, string> = userData.roles ?? {};
    batch.update(userRef, {
      labIds: [...labIds, labId],
      [`roles.${labId}`]: 'owner',
    });
  }

  await batch.commit();

  return {
    id: labId,
    name: payload.name.trim(),
    logoUrl,
    createdAt: new Date(),
  };
}

export async function updateLab(
  labId: string,
  payload: UpdateLabPayload
): Promise<Partial<Lab>> {
  const updates: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    updates.name = payload.name.trim();
  }

  if (payload.logoFile) {
    updates.logoUrl = await uploadLabLogo(labId, payload.logoFile);
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, COLLECTIONS.LABS, labId), updates);
  }

  return updates as Partial<Lab>;
}

export async function deleteLab(labId: string): Promise<void> {
  // Remove all members' lab references first
  const membersSnap = await getDocs(
    collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS)
  );

  const batch = writeBatch(db);

  for (const memberDoc of membersSnap.docs) {
    const uid = memberDoc.id;
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const labIds: string[] = (userData.labIds ?? []).filter((id: string) => id !== labId);
      const roles = { ...(userData.roles ?? {}) };
      delete roles[labId];
      batch.update(userRef, { labIds, roles });
    }
    batch.delete(memberDoc.ref);
  }

  batch.delete(doc(db, COLLECTIONS.LABS, labId));
  await batch.commit();
}

// ─── Logo upload ──────────────────────────────────────────────────────────────

export async function uploadLabLogo(labId: string, file: File): Promise<string> {
  const path = storagePath.labLogo(labId);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteLabLogo(labId: string): Promise<void> {
  try {
    const storageRef = ref(storage, storagePath.labLogo(labId));
    await deleteObject(storageRef);
    await updateDoc(doc(db, COLLECTIONS.LABS, labId), { logoUrl: null });
  } catch {
    // Logo may not exist — swallow
  }
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getLabMembers(labId: string): Promise<LabMember[]> {
  const membersSnap = await getDocs(
    collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS)
  );

  const members: LabMember[] = [];

  await Promise.all(
    membersSnap.docs.map(async (memberDoc) => {
      const uid = memberDoc.id;
      const { role, active } = memberDoc.data() as { role: UserRole; active: boolean };
      const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
      if (userSnap.exists()) {
        const u = userSnap.data();
        members.push({
          uid,
          email: u.email ?? '',
          displayName: u.displayName ?? u.email ?? uid,
          role,
          active,
        });
      }
    })
  );

  return members.sort((a, b) => {
    const order: Record<UserRole, number> = { owner: 0, admin: 1, member: 2 };
    return order[a.role] - order[b.role];
  });
}

export async function updateMemberRole(
  labId: string,
  uid: string,
  role: UserRole
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS, uid), { role });
  batch.update(doc(db, COLLECTIONS.USERS, uid), { [`roles.${labId}`]: role });
  await batch.commit();
}

export async function deactivateMember(labId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS, uid), { active: false });
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const labIds: string[] = (userData.labIds ?? []).filter((id: string) => id !== labId);
    const roles = { ...(userData.roles ?? {}) };
    delete roles[labId];
    batch.update(userRef, { labIds, roles });
  }
  await batch.commit();
}

export async function reactivateMember(
  labId: string,
  uid: string,
  role: UserRole = 'member'
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS, uid), {
    active: true,
    role,
  });
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const labIds: string[] = userData.labIds ?? [];
    if (!labIds.includes(labId)) {
      batch.update(userRef, {
        labIds: [...labIds, labId],
        [`roles.${labId}`]: role,
      });
    }
  }
  await batch.commit();
}

// ─── Pending access requests for a specific lab ───────────────────────────────

export async function getPendingRequestsForLab(
  labId: string
): Promise<import('../../../types').AccessRequest[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.ACCESS_REQUESTS),
      where('labId', '==', labId),
      where('status', '==', 'pending')
    )
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
      status: data.status,
      createdAt: data.createdAt?.toDate() ?? new Date(),
    };
  });
}

export async function approveMemberRequest(
  requestId: string,
  labId: string,
  uid: string,
  role: UserRole = 'member'
): Promise<void> {
  const batch = writeBatch(db);

  // Add member to lab
  batch.set(doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS, uid), {
    role,
    active: true,
  });

  // Update user document
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const labIds: string[] = userData.labIds ?? [];
    batch.update(userRef, {
      labIds: labIds.includes(labId) ? labIds : [...labIds, labId],
      [`roles.${labId}`]: role,
      pendingLabId: null,
    });
  }

  // Update request status
  batch.update(doc(db, COLLECTIONS.ACCESS_REQUESTS, requestId), {
    status: 'approved',
  });

  await batch.commit();
}

export async function denyMemberRequest(requestId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.ACCESS_REQUESTS, requestId), { status: 'denied' });
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists() && userSnap.data().pendingLabId) {
    batch.update(userRef, { pendingLabId: null });
  }
  await batch.commit();
}
