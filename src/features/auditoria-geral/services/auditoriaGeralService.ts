/**
 * Auditoria Geral Service Layer
 *
 * Handles CRUD operations + real-time subscriptions for DICQ general audit.
 * Thin service pattern: only Firebase operations + snapshot mapping.
 * Business logic (score calculation, bloco navigation) lives in hooks.
 *
 * Multi-tenant: all operations require explicit labId parameter.
 * Soft-delete only (RN-06): never calls deleteDoc.
 */

import {
  collection,
  doc,
  DocumentSnapshot,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

import { db, storage } from '../../../shared/services/firebase';
import type {
  AuditoriaGeral,
  AuditoriaGeralInput,
  BlocoId,
  FotoEvidencia,
  PlanoAcao,
  RespostaIndicador,
  ScoresPorBloco,
} from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Path helpers
// ──────────────────────────────────────────────────────────────────────────

export function auditoriaGeralCol(labId: string) {
  return collection(db, `auditoria-geral/${labId}/auditorias`);
}

export function auditoriaGeralDoc(labId: string, auditoriaId: string) {
  return doc(db, `auditoria-geral/${labId}/auditorias/${auditoriaId}`);
}

export function respostasCol(labId: string, auditoriaId: string) {
  return collection(
    db,
    `auditoria-geral/${labId}/auditorias/${auditoriaId}/respostas`
  );
}

export function respostaDoc(
  labId: string,
  auditoriaId: string,
  indicadorId: string
) {
  return doc(
    db,
    `auditoria-geral/${labId}/auditorias/${auditoriaId}/respostas/${indicadorId}`
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Snapshot mappers
// ──────────────────────────────────────────────────────────────────────────

export function mapDocToAuditoria(snap: DocumentSnapshot): AuditoriaGeral {
  const data = snap.data() as any;
  return {
    id: snap.id,
    labId: data.labId,
    titulo: data.titulo,
    status: data.status,
    auditor: data.auditor,
    dataInicio: data.dataInicio,
    dataFim: data.dataFim,
    blocoAtual: data.blocoAtual,
    scoreTotal: data.scoreTotal,
    scoresPorBloco: data.scoresPorBloco,
    totalRespondidos: data.totalRespondidos,
    totalNaoAplica: data.totalNaoAplica,
    criadoEm: data.criadoEm,
    criadoPor: data.criadoPor,
    deletadoEm: data.deletadoEm,
  };
}

export function mapDocToResposta(snap: DocumentSnapshot): RespostaIndicador {
  const data = snap.data() as any;
  return {
    id: snap.id,
    numero: data.numero,
    indicador: data.indicador,
    bloco: data.bloco,
    score: data.score,
    naoAplica: data.naoAplica,
    observacoes: data.observacoes,
    fotos: data.fotos ?? [],
    comprovacaoLink: data.comprovacaoLink ?? null,
    respondidoEm: data.respondidoEm,
    respondidoPor: data.respondidoPor,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// CRUD functions
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a new auditoria geral document with initial state.
 * Returns the generated document ID.
 */
export async function createAuditoria(
  labId: string,
  uid: string,
  input: AuditoriaGeralInput
): Promise<string> {
  const colRef = auditoriaGeralCol(labId);
  const newDocRef = doc(colRef);

  await setDoc(newDocRef, {
    labId,
    titulo: input.titulo,
    auditor: input.auditor,
    dataInicio: input.dataInicio,
    dataFim: null,
    status: 'rascunho',
    blocoAtual: 'A',
    scoreTotal: 0,
    scoresPorBloco: {},
    totalRespondidos: 0,
    totalNaoAplica: 0,
    criadoEm: Timestamp.now(),
    criadoPor: uid,
    deletadoEm: null,
  });

  return newDocRef.id;
}

/**
 * Save or update a resposta for a specific indicador (merge mode).
 */
export async function saveResposta(
  labId: string,
  auditoriaId: string,
  indicadorId: string,
  data: Partial<Omit<RespostaIndicador, 'id'>>
): Promise<void> {
  const ref = respostaDoc(labId, auditoriaId, indicadorId);
  await setDoc(ref, { ...data, respondidoEm: Timestamp.now() }, { merge: true });
}

/**
 * Upload a photo to Storage and append its metadata to the resposta's fotos array.
 * Storage path: auditoria-geral/{labId}/{auditoriaId}/{indicadorId}/{uuid}.{ext}
 */
export async function uploadFotoEvidencia(
  labId: string,
  auditoriaId: string,
  indicadorId: string,
  file: File,
  uid: string,
  existingFotos: FotoEvidencia[]
): Promise<FotoEvidencia> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const uuid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `auditoria-geral/${labId}/${auditoriaId}/${indicadorId}/${uuid}.${ext}`;
  const fileRef = storageRef(storage, path);

  await uploadBytes(fileRef, file, { contentType: file.type });
  const url = await getDownloadURL(fileRef);

  const foto: FotoEvidencia = {
    url,
    path,
    nome: file.name,
    uploadedAt: Timestamp.now(),
    uploadedBy: uid,
  };

  const ref = respostaDoc(labId, auditoriaId, indicadorId);
  await setDoc(ref, { fotos: [...existingFotos, foto] }, { merge: true });

  return foto;
}

/**
 * Update aggregated scores on the auditoria document.
 */
export async function updateAuditoriaScores(
  labId: string,
  auditoriaId: string,
  scoreTotal: number,
  scoresPorBloco: ScoresPorBloco,
  totalRespondidos: number,
  totalNaoAplica: number
): Promise<void> {
  const ref = auditoriaGeralDoc(labId, auditoriaId);
  await updateDoc(ref, {
    scoreTotal,
    scoresPorBloco,
    totalRespondidos,
    totalNaoAplica,
  });
}

/**
 * Update the current bloco being answered.
 */
export async function updateBlocoAtual(
  labId: string,
  auditoriaId: string,
  blocoAtual: BlocoId
): Promise<void> {
  const ref = auditoriaGeralDoc(labId, auditoriaId);
  await updateDoc(ref, { blocoAtual });
}

/**
 * Finalize an auditoria — sets status to 'finalizada' and records dataFim.
 */
export async function finalizarAuditoria(
  labId: string,
  auditoriaId: string,
  scoreTotal: number,
  scoresPorBloco: ScoresPorBloco
): Promise<void> {
  const ref = auditoriaGeralDoc(labId, auditoriaId);
  await updateDoc(ref, {
    status: 'finalizada',
    dataFim: Timestamp.now(),
    scoreTotal,
    scoresPorBloco,
  });
}

/**
 * Update the status of an auditoria.
 */
export async function updateStatus(
  labId: string,
  auditoriaId: string,
  status: AuditoriaGeral['status']
): Promise<void> {
  const ref = auditoriaGeralDoc(labId, auditoriaId);
  await updateDoc(ref, { status });
}

// ──────────────────────────────────────────────────────────────────────────
// Subscriptions (real-time listeners)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to all auditorias in a lab (non-deleted), ordered by criadoEm desc.
 * Returns unsubscribe function for cleanup.
 */
export function subscribeAuditorias(
  labId: string,
  callback: (auditorias: AuditoriaGeral[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    auditoriaGeralCol(labId),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc')
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
 * Subscribe to a single auditoria document.
 */
export function subscribeAuditoria(
  labId: string,
  auditoriaId: string,
  callback: (auditoria: AuditoriaGeral | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = auditoriaGeralDoc(labId, auditoriaId);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(mapDocToAuditoria(snap));
    },
    (err) => {
      if (onError) onError(err as Error);
    }
  );
}

/**
 * Subscribe to all respostas of an auditoria.
 */
export function subscribeRespostas(
  labId: string,
  auditoriaId: string,
  callback: (respostas: RespostaIndicador[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const col = respostasCol(labId, auditoriaId);

  return onSnapshot(
    col,
    (snap) => {
      const respostas = snap.docs.map(mapDocToResposta);
      callback(respostas);
    },
    (err) => {
      if (onError) onError(err as Error);
    }
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Planos de Ação
// ──────────────────────────────────────────────────────────────────────────

export function planosAcaoCol(labId: string, auditoriaId: string) {
  return collection(
    db,
    `auditoria-geral/${labId}/auditorias/${auditoriaId}/planos-acao`
  );
}

export function planoAcaoDoc(
  labId: string,
  auditoriaId: string,
  indicadorId: string
) {
  return doc(
    db,
    `auditoria-geral/${labId}/auditorias/${auditoriaId}/planos-acao/${indicadorId}`
  );
}

export async function savePlanoAcao(
  labId: string,
  auditoriaId: string,
  indicadorId: string,
  data: Omit<PlanoAcao, 'indicadorId' | 'criadoEm'>
): Promise<void> {
  const ref = planoAcaoDoc(labId, auditoriaId, indicadorId);
  await setDoc(
    ref,
    { ...data, indicadorId, criadoEm: Timestamp.now() },
    { merge: true }
  );
}

export function subscribePlanosAcao(
  labId: string,
  auditoriaId: string,
  callback: (planos: PlanoAcao[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const col = planosAcaoCol(labId, auditoriaId);

  return onSnapshot(
    col,
    (snap) => {
      const planos = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          indicadorId: d.id,
          numero: data.numero,
          indicador: data.indicador,
          bloco: data.bloco,
          score: data.score,
          acaoCorretiva: data.acaoCorretiva ?? '',
          responsavel: data.responsavel ?? '',
          prazo: data.prazo ?? null,
          status: data.status ?? 'pendente',
          criadoEm: data.criadoEm,
        } as PlanoAcao;
      });
      callback(planos);
    },
    (err) => {
      if (onError) onError(err as Error);
    }
  );
}
