import { httpsCallable } from 'firebase/functions';
import {
  auth,
  db,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from '../../../shared/services/firebase';
import { functions } from '../../../config/firebase.config';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { Lab, UserRole, AccessRequest, AccessRequestStatus } from '../../../types';
import type { UserDocument } from '../../auth/services/authService';
import { normalizeLab } from './labSchema';

// ─── Token refresh ────────────────────────────────────────────────────────────
// Must be called after any mutation that changes auth claims (SuperAdmin toggle).

async function afterAuthMutation(): Promise<void> {
  await auth.currentUser?.getIdToken(/* forceRefresh */ true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName: string;
  isSuperAdmin: boolean;
  labIds: string[];
  roles: Record<string, UserRole>;
  activeLabId: string | null;
  disabled: boolean;
  createdAt: Date | null;
}

export interface AdminLabRecord extends Lab {
  memberCount: number;
}

// ─── Users ────────────────────────────────────────────────────────────────────

function mapUserDoc(uid: string, data: UserDocument): AdminUserRecord {
  return {
    uid,
    email: data.email,
    displayName: data.displayName,
    isSuperAdmin: data.isSuperAdmin,
    labIds: data.labIds ?? [],
    roles: data.roles ?? {},
    activeLabId: data.activeLabId ?? null,
    disabled: data.disabled ?? false,
    createdAt: data.createdAt?.toDate() ?? null,
  };
}

export async function fetchAllUsers(): Promise<AdminUserRecord[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.USERS));
  return snap.docs.map((d) => mapUserDoc(d.id, d.data() as UserDocument));
}

export async function fetchUser(uid: string): Promise<AdminUserRecord | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!snap.exists()) return null;
  return mapUserDoc(snap.id, snap.data() as UserDocument);
}

// ─── Mutation CFs ─────────────────────────────────────────────────────────────
// All write operations go through Cloud Functions for server-side auth enforcement.

export async function setSuperAdmin(uid: string, value: boolean): Promise<void> {
  const fn = httpsCallable(functions, 'setUserSuperAdmin');
  await fn({ targetUid: uid, isSuperAdmin: value });
  // Token must be refreshed so the caller's new claim state is reflected locally
  await afterAuthMutation();
}

export async function removeUserFromLab(labId: string, uid: string): Promise<void> {
  const fn = httpsCallable(functions, 'removeUserFromLab');
  await fn({ targetUid: uid, labId });
}

export async function addUserToLab(uid: string, labId: string, role: UserRole): Promise<void> {
  const fn = httpsCallable(functions, 'addUserToLab');
  await fn({ targetUid: uid, labId, role });
}

export async function updateUserLabRole(uid: string, labId: string, role: UserRole): Promise<void> {
  const fn = httpsCallable(functions, 'updateUserLabRole');
  await fn({ targetUid: uid, labId, role });
}

export async function deleteUserViaFunction(uid: string): Promise<void> {
  const fn = httpsCallable(functions, 'deleteUser');
  await fn({ targetUid: uid });
}

// ─── Cloud Function callables ─────────────────────────────────────────────────

interface CreateUserPayload {
  displayName: string;
  email: string;
  password: string;
  labId?: string;
  role?: UserRole;
}

export async function createUserViaFunction(data: CreateUserPayload): Promise<{ uid: string }> {
  const fn = httpsCallable<CreateUserPayload, { uid: string }>(functions, 'createUser');
  const result = await fn(data);
  return result.data;
}

export async function setUserDisabledViaFunction(uid: string, disabled: boolean): Promise<void> {
  const fn = httpsCallable(functions, 'setUserDisabled');
  await fn({ uid, disabled });
}

// ─── Labs ─────────────────────────────────────────────────────────────────────

export async function fetchAllLabs(): Promise<AdminLabRecord[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.LABS));

  const labs = await Promise.all(
    snap.docs.map(async (d) => {
      const membersSnap = await getDocs(
        collection(db, COLLECTIONS.LABS, d.id, SUBCOLLECTIONS.MEMBERS),
      );
      return {
        ...normalizeLab({ ...d.data(), id: d.id }),
        memberCount: membersSnap.size,
      } satisfies AdminLabRecord;
    }),
  );

  return labs.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createLabAsAdmin(name: string, ownerUid: string): Promise<string> {
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

// ─── Batch helpers ────────────────────────────────────────────────────────────
// Firestore batches are capped at 500 ops. We chunk to stay safe.

type WriteBatch = ReturnType<typeof writeBatch>;
type BatchOp = (b: WriteBatch) => void;

async function runBatched(ops: BatchOp[], chunkSize = 450): Promise<void> {
  if (ops.length === 0) return;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const b = writeBatch(db);
    ops.slice(i, i + chunkSize).forEach((op) => op(b));
    await b.commit();
  }
}

export async function deleteLabAsAdmin(labId: string): Promise<void> {
  // STEP 1 — listar members
  const membersSnap = await getDocs(
    collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.MEMBERS),
  );

  // STEP 2 — ler todos os user docs em paralelo (evita N+1), montar batch ops
  const memberEntries = membersSnap.docs.map((d) => ({ uid: d.id, ref: d.ref }));
  const userSnaps = await Promise.all(
    memberEntries.map(({ uid }) => getDoc(doc(db, COLLECTIONS.USERS, uid))),
  );

  const memberOps: BatchOp[] = [];
  for (let i = 0; i < memberEntries.length; i++) {
    const { uid, ref: memberRef } = memberEntries[i];
    const userSnap = userSnaps[i];
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    if (userSnap.exists()) {
      const userData = userSnap.data() as UserDocument;
      const labIds = (userData.labIds ?? []).filter((id) => id !== labId);
      const roles = { ...(userData.roles ?? {}) };
      delete roles[labId];
      const updates: Record<string, unknown> = { labIds, roles };
      if (userData.activeLabId === labId) updates.activeLabId = null;
      memberOps.push((b) => b.update(userRef, updates));
    }
    memberOps.push((b) => b.delete(memberRef));
  }
  await runBatched(memberOps);

  // STEP 3 — listar lots e deletar runs em paralelo
  const lotsSnap = await getDocs(collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.LOTS));

  // STEP 4 — deletar lots e runs (runs de cada lot em paralelo)
  const runsPerLot = await Promise.all(
    lotsSnap.docs.map((lotDoc) =>
      getDocs(
        collection(
          db,
          COLLECTIONS.LABS,
          labId,
          SUBCOLLECTIONS.LOTS,
          lotDoc.id,
          SUBCOLLECTIONS.RUNS,
        ),
      ),
    ),
  );

  const lotOps: BatchOp[] = [];
  lotsSnap.docs.forEach((lotDoc, idx) => {
    runsPerLot[idx].docs.forEach((r) => lotOps.push((b) => b.delete(r.ref)));
    lotOps.push((b) => b.delete(lotDoc.ref));
  });
  await runBatched(lotOps);

  // STEP 5 — deletar data/appState
  const dataSnap = await getDocs(collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.DATA));
  await runBatched(dataSnap.docs.map((d) => (b: WriteBatch) => b.delete(d.ref)));

  // STEP 6 — deletar documento principal do lab
  await deleteDoc(doc(db, COLLECTIONS.LABS, labId));

  // STEP 7 — registrar no auditLogs (não impeditivo)
  if (auth.currentUser) {
    try {
      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
        action: 'DELETE_LAB',
        labId,
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        timestamp: serverTimestamp(),
      });
    } catch {
      // Audit log failure is non-fatal — lab was already deleted successfully
    }
  }
}

// ─── Access Requests ──────────────────────────────────────────────────────────

export async function fetchAllAccessRequests(
  status?: AccessRequestStatus,
): Promise<AccessRequest[]> {
  // Avoid compound where+orderBy to sidestep composite index requirement.
  // Filter by status in Firestore only; sort by createdAt in-memory.
  const constraints = status ? [where('status', '==', status)] : [];

  const snap = await getDocs(query(collection(db, COLLECTIONS.ACCESS_REQUESTS), ...constraints));

  const results = snap.docs.map((d) => {
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

  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function approveAccessRequest(
  requestId: string,
  labId: string,
  uid: string,
  role: UserRole = 'member',
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
    getDocs(query(collection(db, COLLECTIONS.ACCESS_REQUESTS), where('status', '==', 'pending'))),
  ]);

  return {
    totalUsers: usersSnap.size,
    totalLabs: labsSnap.size,
    pendingRequests: requestsSnap.size,
  };
}
