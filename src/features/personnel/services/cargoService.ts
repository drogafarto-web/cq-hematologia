/**
 * personnel/services/cargoService.ts
 *
 * Camada de persistência multi-tenant para Cargos (job descriptions).
 * Toda operação recebe `labId` explicitamente — não há caminho sem tenant.
 * Documentos carregam `labId` redundante no payload (RN-06 defense-in-depth).
 *
 * Deleção é sempre lógica (RN-06) — nenhuma função aqui invoca `deleteDoc`.
 * Guarda de 5 anos conforme RDC 978/2025.
 */

import {
  Timestamp,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type { Cargo, CargoInput, LabId } from '../types';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PERSONNEL_ROOT = 'personnel';

const labRootDoc = (labId: LabId): DocumentReference => doc(db, PERSONNEL_ROOT, labId);

const cargosCol = (labId: LabId): CollectionReference => collection(labRootDoc(labId), 'cargos');

const cargoDoc = (labId: LabId, cargoId: string): DocumentReference =>
  doc(cargosCol(labId), cargoId);

/**
 * Garante que o doc raiz do tenant existe antes de escrever em subcoleções.
 * `merge: true` torna a operação idempotente.
 */
async function ensureLabRoot(labId: LabId): Promise<void> {
  await setDoc(labRootDoc(labId), { labId }, { merge: true });
}

// ─── Mapping snapshot → entidade ───────────────────────────────────────────

function mapCargo(snap: QueryDocumentSnapshot): Cargo {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    titulo: d.titulo as string,
    descricao: d.descricao as string,
    responsabilidades: (d.responsabilidades ?? []) as readonly string[],
    autoridades: (d.autoridades ?? []) as readonly string[],
    certificacoes: (d.certificacoes ?? undefined) as readonly string[] | undefined,
    reportaA: (d.reportaA ?? undefined) as string | undefined,
    criadoEm: d.criadoEm as Timestamp,
    updatedAt: d.updatedAt as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

// ─── API: Cargo CRUD ────────────────────────────────────────────────────────

/**
 * Cria um novo cargo no tenant.
 * Service é a única fonte de `labId`, `criadoEm` e `deletadoEm`.
 */
export async function createCargo(labId: LabId, input: CargoInput): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(cargosCol(labId));
  await setDoc(ref, {
    labId,
    titulo: input.titulo,
    descricao: input.descricao,
    responsabilidades: input.responsabilidades,
    autoridades: input.autoridades,
    certificacoes: input.certificacoes ?? [],
    reportaA: input.reportaA ?? null,
    criadoEm: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

/**
 * Lê um cargo específico.
 */
export async function getCargo(labId: LabId, cargoId: string): Promise<Cargo | null> {
  const snap = await getDoc(cargoDoc(labId, cargoId));
  if (!snap.exists()) return null;
  const cargo = mapCargo(snap);
  if (cargo.deletadoEm !== null) return null;
  return cargo;
}

/**
 * Lê todos os cargos do tenant (em memória; não deletados).
 */
export async function getCargos(labId: LabId): Promise<Cargo[]> {
  const q = query(cargosCol(labId), where('deletadoEm', '==', null), orderBy('titulo', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(mapCargo);
}

/**
 * Assina alterações em todos os cargos do tenant (em tempo real).
 */
export function watchCargos(
  labId: LabId,
  callback: (cargos: Cargo[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(cargosCol(labId), where('deletadoEm', '==', null), orderBy('titulo', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const cargos = snap.docs.map(mapCargo);
      callback(cargos);
    },
    (err) => {
      if (onError) onError(err as Error);
    },
  );
}

/**
 * Atualiza um cargo existente.
 * Sempre via Cloud Function em Fase 0c+.
 * Mantido como fallback pra RN-06.
 */
export async function updateCargo(
  labId: LabId,
  cargoId: string,
  updates: Partial<CargoInput>,
): Promise<void> {
  await updateDoc(cargoDoc(labId, cargoId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Soft-deleta um cargo (marca como deletado, não remove).
 */
export async function softDeleteCargo(labId: LabId, cargoId: string): Promise<void> {
  await updateDoc(cargoDoc(labId, cargoId), {
    deletadoEm: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reconstrói a hierarquia de cargos (reportaA) para visualização.
 * Retorna árvore pronta para OrgChart.
 */
export async function getCargoHierarchy(
  labId: LabId,
): Promise<{ roots: string[]; parents: Map<string, string> }> {
  const cargos = await getCargos(labId);
  const roots: string[] = [];
  const parents = new Map<string, string>();

  for (const cargo of cargos) {
    if (!cargo.reportaA) {
      roots.push(cargo.id);
    } else {
      parents.set(cargo.id, cargo.reportaA);
    }
  }

  return { roots, parents };
}
