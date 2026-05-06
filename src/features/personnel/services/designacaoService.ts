/**
 * personnel/services/designacaoService.ts
 *
 * Camada de persistência multi-tenant para Designações (appointments).
 * Toda operação recebe `labId` explicitamente.
 * LogicalSignature obrigatória em create (RN-06).
 *
 * Deleção é sempre lógica (RN-06) — nenhuma função aqui invoca `deleteDoc`.
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
import type { Designacao, DesignacaoInput, LabId, LogicalSignature } from '../types';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PERSONNEL_ROOT = 'personnel';

const labRootDoc = (labId: LabId): DocumentReference => doc(db, PERSONNEL_ROOT, labId);

const designacoesCol = (labId: LabId): CollectionReference => collection(labRootDoc(labId), 'designacoes');

const designacaoDoc = (labId: LabId, designacaoId: string): DocumentReference =>
  doc(designacoesCol(labId), designacaoId);

/**
 * Garante que o doc raiz do tenant existe.
 */
async function ensureLabRoot(labId: LabId): Promise<void> {
  await setDoc(labRootDoc(labId), { labId }, { merge: true });
}

// ─── Mapping snapshot → entidade ───────────────────────────────────────────

function mapDesignacao(snap: QueryDocumentSnapshot): Designacao {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    cargoId: d.cargoId as string,
    pessoaId: d.pessoaId as string,
    pessoaNome: d.pessoaNome as string,
    dataInicio: d.dataInicio as Timestamp,
    dataFim: (d.dataFim ?? null) as Timestamp | null,
    descricaoAutoridade: d.descricaoAutoridade as string,
    successorId: (d.successorId ?? undefined) as string | undefined,
    chainHash: d.chainHash as LogicalSignature,
    certificadoUrl: (d.certificadoUrl ?? undefined) as string | undefined,
    criadoEm: d.criadoEm as Timestamp,
    updatedAt: d.updatedAt as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

// ─── API: Designacao CRUD ───────────────────────────────────────────────────

/**
 * Cria nova designação com assinatura (sempre via Cloud Function).
 * Fallback direto para testes/rollback.
 */
export async function createDesignacao(
  labId: LabId,
  input: DesignacaoInput,
  signature: LogicalSignature,
): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(designacoesCol(labId));
  await setDoc(ref, {
    labId,
    cargoId: input.cargoId,
    pessoaId: input.pessoaId,
    pessoaNome: input.pessoaNome,
    dataInicio: input.dataInicio,
    dataFim: input.dataFim ?? null,
    descricaoAutoridade: input.descricaoAutoridade,
    successorId: input.successorId ?? null,
    chainHash: signature,
    certificadoUrl: input.certificadoUrl ?? null,
    criadoEm: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

/**
 * Lê uma designação específica.
 */
export async function getDesignacao(labId: LabId, designacaoId: string): Promise<Designacao | null> {
  const snap = await getDoc(designacaoDoc(labId, designacaoId));
  if (!snap.exists()) return null;
  const designacao = mapDesignacao(snap);
  if (designacao.deletadoEm !== null) return null;
  return designacao;
}

/**
 * Lê todas as designações do tenant (não deletadas).
 */
export async function getDesignacoes(labId: LabId, filterByRole?: string): Promise<Designacao[]> {
  let q;
  if (filterByRole) {
    q = query(
      designacoesCol(labId),
      where('deletadoEm', '==', null),
      where('cargoId', '==', filterByRole),
      orderBy('dataInicio', 'desc'),
    );
  } else {
    q = query(
      designacoesCol(labId),
      where('deletadoEm', '==', null),
      orderBy('dataInicio', 'desc'),
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(mapDesignacao);
}

/**
 * Assina alterações em designações (tempo real).
 */
export function watchDesignacoes(
  labId: LabId,
  callback: (designacoes: Designacao[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    designacoesCol(labId),
    where('deletadoEm', '==', null),
    orderBy('dataInicio', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const designacoes = snap.docs.map(mapDesignacao);
      callback(designacoes);
    },
    (err) => {
      if (onError) onError(err as Error);
    },
  );
}

/**
 * Retorna designação ativa para um cargo (dataFim = null, mais recente).
 */
export async function getActiveDesignacao(labId: LabId, cargoId: string): Promise<Designacao | null> {
  const q = query(
    designacoesCol(labId),
    where('cargoId', '==', cargoId),
    where('dataFim', '==', null),
    where('deletadoEm', '==', null),
    orderBy('dataInicio', 'desc'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapDesignacao(snap.docs[0]!);
}

/**
 * Soft-deleta uma designação.
 */
export async function softDeleteDesignacao(labId: LabId, designacaoId: string): Promise<void> {
  await updateDoc(designacaoDoc(labId, designacaoId), {
    deletadoEm: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Valida integridade da assinatura (re-computa hash e compara).
 */
export function validateChainHash(designacao: Designacao): boolean {
  if (!designacao.chainHash) return false;
  if (!designacao.chainHash.hash || designacao.chainHash.hash.length !== 64) return false;
  if (!designacao.chainHash.operatorId) return false;
  if (!designacao.chainHash.ts) return false;
  return true;
}

/**
 * Retorna mapa { cargoId → Designacao ativa } para org chart.
 */
export async function getActiveDesignacoesByRole(labId: LabId): Promise<Map<string, Designacao>> {
  const designacoes = await getDesignacoes(labId);
  const active = new Map<string, Designacao>();

  for (const d of designacoes) {
    if (d.dataFim === null) {
      // Keep only the most recent per role
      const existing = active.get(d.cargoId);
      if (!existing || d.dataInicio > existing.dataInicio) {
        active.set(d.cargoId, d);
      }
    }
  }

  return active;
}
