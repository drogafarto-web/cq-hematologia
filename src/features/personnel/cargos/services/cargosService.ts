/**
 * cargosService.ts — Phase 8 Wave 1
 *
 * Job descriptions and permission matrix for personnel roles.
 * Admin-only CRUD (Firestore Rules enforce).
 * Soft-delete only (RN-06).
 *
 * Multi-tenant: `/labs/{labId}/personnel/cargos/{cargoId}`
 * DICQ 5.1.3 — job descriptions with competency requirements
 */

import {
  collection,
  db,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
  updateDoc,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from '../../../../shared/services/firebase';
import type {
  Cargo,
  CargoPermissions,
  CargoAuthorityMatrix,
  SecaoLab,
} from '../types';
import type { LabId } from '../../types/_shared_refs';

// ─── Paths ────────────────────────────────────────────────────────────────

const cargosCol = (labId: LabId): CollectionReference =>
  collection(db, 'labs', labId, 'personnel', 'cargos');

const cargoDoc = (labId: LabId, cargoId: string): DocumentReference =>
  doc(cargosCol(labId), cargoId);

// ─── Mapping snapshot → entity ─────────────────────────────────────────────

function mapCargo(snap: QueryDocumentSnapshot): Cargo {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    nome: d.nome as string,
    descricao: d.descricao as string,
    requisitosMinimos: (d.requisitosMinimos ?? '') as string,
    secao: d.secao as SecaoLab,
    reportaA: d.reportaA,
    substituidor: d.substituidor,
    dataDesignacao: d.dataDesignacao?.toMillis?.() ?? d.dataDesignacao ?? 0,
    permissions: d.permissions as CargoPermissions,
    createdAt: d.createdAt?.toMillis?.() ?? d.createdAt ?? 0,
    createdBy: (d.createdBy ?? '') as string,
    deletedAt: d.deletedAt?.toMillis?.() ?? d.deletedAt ?? undefined,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Get all cargos for a lab.
 */
export async function getCargos(labId: LabId): Promise<Cargo[]> {
  const snapshot = await getDocs(cargosCol(labId));
  return snapshot.docs
    .map(mapCargo)
    .filter((cargo) => !cargo.deletedAt);
}

/**
 * Create a new cargo (admin only — rules enforce).
 */
export async function createCargo(labId: LabId, input: Omit<Cargo, 'id' | 'labId' | 'createdAt' | 'deletedAt'>): Promise<string> {
  const ref = doc(cargosCol(labId));
  await setDoc(ref, {
    labId,
    nome: input.nome,
    descricao: input.descricao,
    requisitosMinimos: input.requisitosMinimos,
    secao: input.secao,
    reportaA: input.reportaA,
    substituidor: input.substituidor,
    dataDesignacao: input.dataDesignacao,
    permissions: input.permissions,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    deletedAt: null,
  });
  return ref.id;
}

/**
 * Update cargo details (admin only — rules enforce).
 */
export async function updateCargo(
  labId: LabId,
  cargoId: string,
  updates: Partial<Omit<Cargo, 'id' | 'labId' | 'createdAt' | 'deletedAt'>>,
): Promise<void> {
  const ref = cargoDoc(labId, cargoId);
  const payload: Record<string, unknown> = {};

  if (updates.nome) payload.nome = updates.nome;
  if (updates.descricao) payload.descricao = updates.descricao;
  if (updates.requisitosMinimos) payload.requisitosMinimos = updates.requisitosMinimos;
  if (updates.secao) payload.secao = updates.secao;
  if (updates.reportaA) payload.reportaA = updates.reportaA;
  if (updates.substituidor) payload.substituidor = updates.substituidor;
  if (updates.permissions) payload.permissions = updates.permissions;

  await updateDoc(ref, payload);
}

/**
 * Get authority matrix for the lab (derived from all cargos' permissions).
 */
export async function getAuthorityMatrix(labId: LabId): Promise<CargoAuthorityMatrix> {
  const snapshot = await getDocs(cargosCol(labId));
  const matrix: CargoAuthorityMatrix = {};

  snapshot.docs
    .map(mapCargo)
    .filter((cargo) => !cargo.deletedAt)
    .forEach((cargo) => {
      matrix[cargo.id] = cargo.permissions;
    });

  return matrix;
}

/**
 * Update authority matrix (admin only).
 * Writes individual permission updates to each cargo document.
 */
export async function updateAuthorityMatrix(labId: LabId, matrix: CargoAuthorityMatrix): Promise<void> {
  const updates = Object.entries(matrix).map(([cargoId, permissions]) =>
    updateDoc(cargoDoc(labId, cargoId), { permissions }),
  );
  await Promise.all(updates);
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const cargosService = {
  getCargos,
  createCargo,
  updateCargo,
  getAuthorityMatrix,
  updateAuthorityMatrix,
};
