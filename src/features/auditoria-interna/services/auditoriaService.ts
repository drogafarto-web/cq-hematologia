/**
 * Auditoria Interna Service Layer
 *
 * Handles CRUD operations + real-time subscriptions for audit entities.
 * Thin service pattern: only Firebase operations + snapshot mapping.
 * Business logic (validation, atomic orchestration) lives in hooks.
 *
 * Multi-tenant: all operations require explicit labId parameter.
 * Soft-delete only (RN-06): never calls deleteDoc, uses soft-delete callables.
 */

import {
  collection,
  doc,
  DocumentSnapshot,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../../../shared/services/firebase';
import type {
  Achado,
  Auditoria,
  ChecklistItem,
  Sessao,
} from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Path helpers
// ──────────────────────────────────────────────────────────────────────────

function auditoriaCol(labId: string) {
  return collection(db, `labs/${labId}/auditorias-internas`);
}

function auditoriaDoc(labId: string, auditoriaId: string) {
  return doc(db, `labs/${labId}/auditorias-internas/${auditoriaId}`);
}

function sessaoCol(labId: string, auditoriaId: string) {
  return collection(
    db,
    `labs/${labId}/auditorias-internas/${auditoriaId}/sessoes`
  );
}

function sessaoDoc(labId: string, auditoriaId: string, sessaoId: string) {
  return doc(
    db,
    `labs/${labId}/auditorias-internas/${auditoriaId}/sessoes/${sessaoId}`
  );
}

function checklistCol(labId: string, auditoriaId: string, sessaoId: string) {
  return collection(
    db,
    `labs/${labId}/auditorias-internas/${auditoriaId}/sessoes/${sessaoId}/checklist-items`
  );
}

function achadoCol(labId: string, auditoriaId: string, sessaoId: string) {
  return collection(
    db,
    `labs/${labId}/auditorias-internas/${auditoriaId}/sessoes/${sessaoId}/achados`
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Snapshot mappers
// ──────────────────────────────────────────────────────────────────────────

function mapDocToAuditoria(snap: DocumentSnapshot): Auditoria {
  const data = snap.data() as any;
  return {
    id: snap.id,
    labId: data.labId,
    ano: data.ano,
    frequencia: data.frequencia,
    responsavelTecnico: data.responsavelTecnico,
    proximaAuditoriaPlanejada: data.proximaAuditoriaPlanejada,
    status: data.status,
    criadoEm: data.criadoEm,
    criadoPor: data.criadoPor,
    deletadoEm: data.deletadoEm,
  };
}

function mapDocToSessao(snap: DocumentSnapshot): Sessao {
  const data = snap.data() as any;
  return {
    id: snap.id,
    auditoriaId: data.auditoriaId,
    labId: data.labId,
    auditor: data.auditor,
    dataInicio: data.dataInicio,
    dataFim: data.dataFim,
    status: data.status,
    totalItens: data.totalItens,
    itensConforme: data.itensConforme,
    itensNãoConforme: data.itensNãoConforme,
    itensNA: data.itensNA,
    criadoEm: data.criadoEm,
    criadoPor: data.criadoPor,
    deletadoEm: data.deletadoEm,
  };
}

function mapDocToChecklistItem(snap: DocumentSnapshot): ChecklistItem {
  const data = snap.data() as any;
  return {
    id: snap.id,
    sessaoId: data.sessaoId,
    labId: data.labId,
    numeroDICQ: data.numeroDICQ,
    descricao: data.descricao,
    categoria: data.categoria,
    bloco: data.bloco,
    isApplicable: data.isApplicable,
    resposta: data.resposta,
    severidade: data.severidade,
    observacoes: data.observacoes,
    criadoEm: data.criadoEm,
    criadoPor: data.criadoPor,
  };
}

function mapDocToAchado(snap: DocumentSnapshot): Achado {
  const data = snap.data() as any;
  return {
    id: snap.id,
    sessaoId: data.sessaoId,
    labId: data.labId,
    checklistItemId: data.checklistItemId,
    descricao: data.descricao,
    evidencia: data.evidencia,
    severidade: data.severidade,
    statusNC: data.statusNC,
    ncId: data.ncId,
    assinatura: data.assinatura,
    criadoEm: data.criadoEm,
    criadoPor: data.criadoPor,
    deletadoEm: data.deletadoEm,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Ensure lab root exists (multi-tenant defense-in-depth)
// ──────────────────────────────────────────────────────────────────────────

async function ensureLabRoot(labId: string): Promise<void> {
  const labRef = doc(db, `labs/${labId}`);
  await setDoc(labRef, {}, { merge: true });
}

// ──────────────────────────────────────────────────────────────────────────
// Subscribe functions (real-time listeners)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to all auditorias in a lab (non-deleted)
 *
 * Filters out deletadoEm != null client-side.
 * Returns unsubscribe function for cleanup.
 */
export function subscribeAuditorias(
  labId: string,
  callback: (auditorias: Auditoria[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    auditoriaCol(labId),
    where('deletadoEm', '==', null)
  );

  return onSnapshot(
    q,
    (snap) => {
      const auditorias = snap.docs.map(mapDocToAuditoria);
      callback(auditorias);
    },
    (err) => {
      if (onError) onError(err as Error);
    }
  );
}

/**
 * Subscribe to all sessoes of an auditoria (non-deleted)
 */
export function subscribeSessoes(
  labId: string,
  auditoriaId: string,
  callback: (sessoes: Sessao[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    sessaoCol(labId, auditoriaId),
    where('deletadoEm', '==', null)
  );

  return onSnapshot(
    q,
    (snap) => {
      const sessoes = snap.docs.map(mapDocToSessao);
      callback(sessoes);
    },
    (err) => {
      if (onError) onError(err as Error);
    }
  );
}

/**
 * Subscribe to all checklist items in a sessao
 *
 * Ordered by numeroDICQ lexicographically (e.g., "4.1.1.2").
 */
export function subscribeChecklistItems(
  labId: string,
  auditoriaId: string,
  sessaoId: string,
  callback: (items: ChecklistItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const col = checklistCol(labId, auditoriaId, sessaoId);

  return onSnapshot(
    col,
    (snap) => {
      const items = snap.docs
        .map(mapDocToChecklistItem)
        .sort((a, b) => a.numeroDICQ.localeCompare(b.numeroDICQ));
      callback(items);
    },
    (err) => {
      if (onError) onError(err as Error);
    }
  );
}

/**
 * Subscribe to all achados in a sessao
 */
export function subscribeAchados(
  labId: string,
  auditoriaId: string,
  sessaoId: string,
  callback: (achados: Achado[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    achadoCol(labId, auditoriaId, sessaoId),
    where('deletadoEm', '==', null)
  );

  return onSnapshot(
    q,
    (snap) => {
      const achados = snap.docs.map(mapDocToAchado);
      callback(achados);
    },
    (err) => {
      if (onError) onError(err as Error);
    }
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Soft-delete operations (via Cloud Function callables)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Mark an auditoria as deleted (soft-delete via callable)
 *
 * Client cannot directly delete. Cloud Function is the authority.
 */
export async function softDeleteAuditoria(
  labId: string,
  auditoriaId: string,
  motivo?: string
): Promise<void> {
  await ensureLabRoot(labId);
  const callable = httpsCallable(functions, 'deleteAuditoria');
  await callable({ labId, auditoriaId, motivo });
}

/**
 * Mark a sessao as deleted (soft-delete via callable)
 */
export async function softDeleteSessao(
  labId: string,
  sessaoId: string,
  motivo?: string
): Promise<void> {
  await ensureLabRoot(labId);
  const callable = httpsCallable(functions, 'deleteSessao');
  await callable({ labId, sessaoId, motivo });
}

/**
 * Mark an achado as deleted (soft-delete via callable)
 */
export async function softDeleteAchado(
  labId: string,
  achadoId: string,
  motivo?: string
): Promise<void> {
  await ensureLabRoot(labId);
  const callable = httpsCallable(functions, 'deleteAchado');
  await callable({ labId, achadoId, motivo });
}
