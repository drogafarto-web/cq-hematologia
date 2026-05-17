/**
 * qualificacaoService — CRUD de qualificações IQ/OQ/PQ de equipamentos.
 *
 * DICQ 5.3.1.2: qualificação formal obrigatória para equipamentos novos.
 *
 * Firestore: /labs/{labId}/equipamentos/{equipamentoId}/qualificacoes/{qualId}
 * Soft-delete only.
 */

import {
  db,
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import type { Qualificacao, QualificacaoInput } from '../types/Qualificacao';

// ─── Path helpers ─────────────────────────────────────────────────────────────

function qualificacoesCol(labId: string, equipamentoId: string) {
  return collection(db, 'labs', labId, 'equipamentos', equipamentoId, 'qualificacoes');
}

function qualificacaoRef(labId: string, equipamentoId: string, qualId: string) {
  return doc(db, 'labs', labId, 'equipamentos', equipamentoId, 'qualificacoes', qualId);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function criarQualificacao(
  labId: string,
  equipamentoId: string,
  input: QualificacaoInput,
): Promise<string> {
  const data: Omit<Qualificacao, 'id'> = {
    labId,
    equipamentoId,
    etapa: input.etapa,
    resultado: input.resultado,
    dataRealizacao: Timestamp.fromDate(input.dataRealizacao),
    responsavelId: input.responsavelId,
    responsavelNome: input.responsavelNome,
    observacoes: input.observacoes || undefined,
    documentoIds: input.documentoIds || [],
    criadoEm: Timestamp.now(),
    criadoPor: input.responsavelId,
    deletadoEm: null,
  };

  const ref = await addDoc(qualificacoesCol(labId, equipamentoId), data);
  return ref.id;
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export function subscribeQualificacoes(
  labId: string,
  equipamentoId: string,
  callback: (quals: Qualificacao[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    qualificacoesCol(labId, equipamentoId),
    where('deletadoEm', '==', null),
    orderBy('dataRealizacao', 'asc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const quals = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Qualificacao);
      callback(quals);
    },
    onError,
  );
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateQualificacao(
  labId: string,
  equipamentoId: string,
  qualId: string,
  updates: Partial<Pick<QualificacaoInput, 'resultado' | 'observacoes' | 'documentoIds'>>,
): Promise<void> {
  await updateDoc(qualificacaoRef(labId, equipamentoId, qualId), {
    ...updates,
    ...(updates.resultado && { resultado: updates.resultado }),
  });
}

// ─── Soft delete ──────────────────────────────────────────────────────────────

export async function softDeleteQualificacao(
  labId: string,
  equipamentoId: string,
  qualId: string,
): Promise<void> {
  await updateDoc(qualificacaoRef(labId, equipamentoId, qualId), {
    deletadoEm: serverTimestamp(),
  });
}
