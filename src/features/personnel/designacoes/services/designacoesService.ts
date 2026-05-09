/**
 * designacoesService.ts — Phase 8 Wave 1
 *
 * Personnel appointments (designações) with cryptographic signatures.
 * Reads: subscribeToDesignacoes, getActiveDesignacao
 * Writes: via callable (Cloud Function server-side only)
 *
 * Multi-tenant: `/labs/{labId}/personnel/designacoes/{designacaoId}`
 * Invariant: Only 1 active designacao per type per lab
 * DICQ 4.1.2.7 + RDC 978 Art. 128 — RT designation with audit log
 */

import {
  collection,
  db,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../../shared/services/firebase';
import type {
  Designacao,
  DesignacaoType,
} from '../../types';
import type { LabId } from '../../types/_shared_refs';

// ─── Paths ────────────────────────────────────────────────────────────────

const designacoesCol = (labId: LabId): CollectionReference =>
  collection(db, 'labs', labId, 'personnel', 'designacoes');

const designacaoDoc = (labId: LabId, designacaoId: string): DocumentReference =>
  doc(designacoesCol(labId), designacaoId);

// ─── Mapping snapshot → entity ─────────────────────────────────────────────

function mapDesignacao(snap: QueryDocumentSnapshot): Designacao {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    type: d.type as DesignacaoType,
    personId: d.personId as string,
    personName: d.personName as string,
    cargoId: d.cargoId as string,
    dataDesignacao: d.dataDesignacao?.toMillis?.() ?? d.dataDesignacao,
    motivo: d.motivo as string,
    vigencia: d.vigencia as number,
    dataExpiracao: d.dataExpiracao?.toMillis?.() ?? d.dataExpiracao,
    assinatura: d.assinatura,
    auditLog: d.auditLog ?? [],
    deletedAt: d.deletedAt,
  } as Designacao;
}

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Subscribe to all active designacoes in the lab.
 * Filters out soft-deleted records and expired designacoes.
 */
export function subscribeToDesignacoes(
  labId: LabId,
  onUpdate: (designacoes: Designacao[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(designacoesCol(labId), where('deletedAt', '==', null));

  return onSnapshot(
    q,
    (snapshot) => {
      const designacoes = snapshot.docs
        .map(mapDesignacao)
        .filter((des) => !des.deletedAt);
      onUpdate(designacoes);
    },
    (err) => {
      if (onError) onError(new Error(`Subscribe error: ${err.message}`));
    },
  );
}

/**
 * Get the currently active designacao for a specific type.
 * Returns null if none are active.
 */
export async function getActiveDesignacao(labId: LabId, type: DesignacaoType): Promise<Designacao | null> {
  const q = query(
    designacoesCol(labId),
    where('type', '==', type),
    where('deletedAt', '==', null),
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const now = Date.now();
  const active = snapshot.docs
    .map(mapDesignacao)
    .filter((des) => {
      const expiration = typeof des.dataExpiracao === 'number' ? des.dataExpiracao : des.dataExpiracao?.toMillis?.() ?? 0;
      return expiration > now;
    });

  return active.length > 0 ? active[0] : null;
}

// ─── Callables (server-side writes) ────────────────────────────────────────

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'southamerica-east1');

export interface CreateDesignacaoInput {
  type: DesignacaoType;
  personId: string;
  personName: string;
  cargoId: string;
  dataDesignacao: number;
  motivo: string;
  vigencia: number;
}

export interface CreateDesignacaoOutput {
  designacaoId: string;
  designacao: Designacao;
}

/**
 * Create a new designacao via Cloud Function.
 * Server validates: only 1 active per type, generates LogicalSignature.
 */
export async function createDesignacaoCallable(
  labId: LabId,
  input: CreateDesignacaoInput,
): Promise<CreateDesignacaoOutput> {
  const fn = httpsCallable<
    { labId: string; payload: CreateDesignacaoInput },
    CreateDesignacaoOutput
  >(functions, 'personnel_createDesignacao');
  return fn({ labId, payload: input }).then((result) => result.data);
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const designacoesService = {
  subscribeToDesignacoes,
  getActiveDesignacao,
  createDesignacaoCallable,
};
