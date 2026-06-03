/**
 * Achados (Findings) Service Layer
 *
 * Manages structured nonconformity records generated from audit responses.
 * Supports the full cycle: finding → root cause → action → verification.
 */

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';
import type { Achado, TipoAchado, VerificacaoEficacia } from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Path helpers
// ──────────────────────────────────────────────────────────────────────────

export function achadosCol(labId: string, auditoriaId: string) {
  return collection(db, `auditoria-geral/${labId}/auditorias/${auditoriaId}/achados`);
}

export function achadoDoc(labId: string, auditoriaId: string, achadoId: string) {
  return doc(db, `auditoria-geral/${labId}/auditorias/${auditoriaId}/achados/${achadoId}`);
}

// ──────────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────────

export async function createAchado(
  labId: string,
  auditoriaId: string,
  data: Omit<Achado, 'id' | 'criadoEm'>,
): Promise<string> {
  const colRef = achadosCol(labId, auditoriaId);
  const newRef = doc(colRef);
  await setDoc(newRef, {
    ...data,
    criadoEm: Timestamp.now(),
  });
  return newRef.id;
}

export async function updateAchado(
  labId: string,
  auditoriaId: string,
  achadoId: string,
  data: Partial<Omit<Achado, 'id' | 'criadoEm' | 'criadoPor'>>,
): Promise<void> {
  const ref = achadoDoc(labId, auditoriaId, achadoId);
  await updateDoc(ref, data);
}

export async function saveVerificacaoEficacia(
  labId: string,
  auditoriaId: string,
  achadoId: string,
  verificacao: VerificacaoEficacia,
): Promise<void> {
  const ref = achadoDoc(labId, auditoriaId, achadoId);
  await updateDoc(ref, {
    verificacaoEficacia: verificacao,
    status: verificacao.resultado === 'eficaz' ? 'fechado' : 'em-tratamento',
  });
}

/**
 * Auto-generate achados from responses with score 0-1 (NC) or score 2 (Oportunidade).
 * Called on audit finalization.
 */
export async function gerarAchadosAutomaticos(
  labId: string,
  auditoriaId: string,
  respostas: {
    numero: number;
    indicador: string;
    bloco: string;
    score: number | null;
    naoAplica: boolean;
    observacoes: string;
  }[],
  uid: string,
): Promise<number> {
  let count = 0;

  for (const r of respostas) {
    if (r.naoAplica || r.score === null || r.score > 2) continue;

    let tipo: TipoAchado;
    if (r.score === 0) tipo = 'nc-critica';
    else if (r.score === 1) tipo = 'nc-maior';
    else tipo = 'oportunidade-melhoria';

    await createAchado(labId, auditoriaId, {
      auditoriaId,
      indicadorId: `fr044-${String(r.numero).padStart(2, '0')}`,
      numero: r.numero,
      indicador: r.indicador,
      bloco: r.bloco as any,
      tipo,
      descricao: `Score ${r.score}/5 — ${r.indicador}`,
      evidenciaObjetiva: r.observacoes || '',
      causaRaiz: '',
      metodoCausaRaiz: '',
      status: 'aberto',
      acaoCorretiva: '',
      responsavel: '',
      prazo: null,
      dataConclusao: null,
      verificacaoEficacia: null,
      criadoPor: uid,
    });
    count++;
  }

  return count;
}

// ──────────────────────────────────────────────────────────────────────────
// Subscriptions
// ──────────────────────────────────────────────────────────────────────────

export function subscribeAchados(
  labId: string,
  auditoriaId: string,
  callback: (achados: Achado[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(achadosCol(labId, auditoriaId), orderBy('criadoEm', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const achados = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data } as Achado;
      });
      callback(achados);
    },
    (err) => {
      if (onError) onError(err as Error);
    },
  );
}
