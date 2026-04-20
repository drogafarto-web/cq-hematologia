/**
 * coagulacaoFirebaseService — camada Firestore exclusiva do módulo CIQ-Coagulação.
 *
 * Standalone: não usa getDatabaseService() nem qualquer serviço de outros módulos.
 * Cada módulo gerencia sua própria subcoleção.
 *
 * Paths:
 *   Lotes: labs/{labId}/ciq-coagulacao/{lotId}
 *   Runs:  labs/{labId}/ciq-coagulacao/{lotId}/runs/{runId}
 *   Audit: labs/{labId}/ciq-coagulacao/{lotId}/audit/{auditId}
 *   Meta:  labs/{labId}/ciq-coagulacao-meta/counters
 *   Audit lab-level: labs/{labId}/ciq-coagulacao-audit/{auditId}
 *
 * Arquitetura: client-direct (setDoc/updateDoc) com Firestore Rules como defense-in-depth.
 * Cloud Functions ficam em backlog para v2.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · CLSI H21-A5 · CLSI H47-A2
 */

import {
  db,
  storage,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from '../../../shared/services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLLECTIONS, SUBCOLLECTIONS, storagePath } from '../../../constants';
import { firestoreErrorMessage } from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import type { CoagulacaoRun, CoagulacaoLot } from '../types/Coagulacao';

// ─── Path helpers ─────────────────────────────────────────────────────────────

/** Referência à coleção de lotes de coagulação de um lab. */
function lotsCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_COAGULACAO);
}

/** Referência a um documento de lote de coagulação. */
function lotRef(labId: string, lotId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_COAGULACAO, lotId);
}

/** Referência à subcoleção de runs de um lote. */
function runsCol(labId: string, lotId: string) {
  return collection(
    db,
    COLLECTIONS.LABS,
    labId,
    SUBCOLLECTIONS.CIQ_COAGULACAO,
    lotId,
    SUBCOLLECTIONS.RUNS,
  );
}

/** Referência a um documento de run dentro de um lote. */
function runRef(labId: string, lotId: string, runId: string) {
  return doc(
    db,
    COLLECTIONS.LABS,
    labId,
    SUBCOLLECTIONS.CIQ_COAGULACAO,
    lotId,
    SUBCOLLECTIONS.RUNS,
    runId,
  );
}

// ─── Lot operations ───────────────────────────────────────────────────────────

/**
 * Busca um lote pelo par (nivel, loteControle) — retorna null se não existir.
 *
 * Cada combinação (nivel × loteControle) é um lote distinto, pois os alvos
 * mean/SD do fabricante diferem por nível de controle (CLSI H47-A2).
 * Usado para reaproveitar um lote ao registrar uma nova corrida.
 */
export async function findCoagLot(
  labId: string,
  nivel: CoagulacaoLot['nivel'],
  loteControle: string,
): Promise<CoagulacaoLot | null> {
  try {
    const q = query(
      lotsCol(labId),
      where('nivel', '==', nivel),
      where('loteControle', '==', loteControle),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<CoagulacaoLot, 'id'>) };
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Cria um novo lote de controle de coagulação.
 * Chamada apenas quando findCoagLot retorna null para o par (nivel, loteControle).
 */
export async function createCoagLot(
  labId: string,
  lot: Omit<CoagulacaoLot, 'id' | 'createdAt'>,
): Promise<string> {
  try {
    const id = crypto.randomUUID();
    const newRef = lotRef(labId, id);
    await setDoc(newRef, {
      ...lot,
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Atualiza campos mutáveis de um lote (runCount, lotStatus, coagDecision, decisão).
 */
export async function updateCoagLot(
  labId: string,
  lotId: string,
  fields: Partial<
    Pick<CoagulacaoLot, 'runCount' | 'lotStatus' | 'coagDecision' | 'decisionBy' | 'decisionAt'>
  >,
): Promise<void> {
  try {
    await updateDoc(lotRef(labId, lotId), fields as Record<string, unknown>);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Registra a decisão formal de aprovação/rejeição de um lote pelo RT.
 * Grava coagDecision, decisionBy e decisionAt atomicamente.
 */
export async function updateCoagLotDecision(
  labId: string,
  lotId: string,
  decision: CoagulacaoLot['coagDecision'],
  decisionBy: string,
): Promise<void> {
  try {
    await updateDoc(lotRef(labId, lotId), {
      coagDecision: decision,
      decisionBy,
      decisionAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Atualiza metadados editáveis de um lote (datas de abertura/validade, mean, sd).
 * Campos estruturais (nivel, loteControle) são imutáveis pós-criação.
 *
 * Registra audit imutável em ciq-coagulacao/{lotId}/audit/{uuid} ANTES de persistir.
 */
export async function updateCoagLotMeta(
  labId: string,
  lotId: string,
  fields: Partial<Pick<CoagulacaoLot, 'aberturaControle' | 'validadeControle' | 'mean' | 'sd'>>,
  actorUid: string,
  prevValues: Partial<Pick<CoagulacaoLot, 'aberturaControle' | 'validadeControle' | 'mean' | 'sd'>>,
): Promise<void> {
  try {
    // Audit first — imutável via Firestore Rules (só create, nunca update/delete)
    const auditDocRef = doc(
      db,
      COLLECTIONS.LABS,
      labId,
      SUBCOLLECTIONS.CIQ_COAGULACAO,
      lotId,
      SUBCOLLECTIONS.AUDIT,
      crypto.randomUUID(),
    );
    await setDoc(auditDocRef, {
      action: 'lot_edit',
      actorUid,
      prevValues,
      newValues: fields,
      createdAt: serverTimestamp(),
    });

    await updateDoc(lotRef(labId, lotId), fields as Record<string, unknown>);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Exclui um lote e todas as suas corridas (cascade via batch).
 *
 * Registra audit em labs/{labId}/ciq-coagulacao-audit/{uuid} ANTES do batch —
 * o registro sobrevive à exclusão do lote e é rastreável mesmo sem o documento.
 */
export async function deleteCoagLot(
  labId: string,
  lotId: string,
  lotSnapshot: Pick<CoagulacaoLot, 'nivel' | 'loteControle' | 'runCount' | 'validadeControle'>,
  actorUid: string,
): Promise<void> {
  try {
    // Audit gravado no nível do lab — sobrevive à exclusão do lote
    const auditDocRef = doc(
      db,
      COLLECTIONS.LABS,
      labId,
      SUBCOLLECTIONS.CIQ_COAGULACAO_AUDIT,
      crypto.randomUUID(),
    );
    await setDoc(auditDocRef, {
      action: 'lot_delete',
      lotId,
      actorUid,
      lotSnapshot,
      createdAt: serverTimestamp(),
    });

    const runsSnap = await getDocs(runsCol(labId, lotId));
    const batch = writeBatch(db);
    runsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(lotRef(labId, lotId));
    await batch.commit();
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Gera o próximo código sequencial de corrida no formato CG-YYYY-NNNN.
 *
 * Usa uma transação Firestore para garantir que o contador seja atômico mesmo
 * sob concorrência (múltiplos operadores salvando simultaneamente).
 *
 * Counter path: labs/{labId}/ciq-coagulacao-meta/counters
 * Field: runCount (number, inicia em 0)
 */
export async function generateCoagRunCode(labId: string): Promise<string> {
  const counterRef = doc(
    db,
    COLLECTIONS.LABS,
    labId,
    SUBCOLLECTIONS.CIQ_COAGULACAO_META,
    'counters',
  );
  const year = new Date().getFullYear();

  const nextCount = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().runCount as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { runCount: next, updatedAt: serverTimestamp() }, { merge: true });
    return next;
  });

  return `CG-${year}-${String(nextCount).padStart(4, '0')}`;
}

// ─── Run operations ───────────────────────────────────────────────────────────

/**
 * Persiste uma corrida de coagulação no Firestore.
 * O run.id deve ser gerado pelo caller (crypto.randomUUID()).
 */
export async function saveCoagRun(labId: string, lotId: string, run: CoagulacaoRun): Promise<void> {
  try {
    const { id, ...data } = run;
    await setDoc(runRef(labId, lotId, id), {
      ...data,
      // Garante que createdAt e confirmedAt são serverTimestamp no primeiro save
      createdAt: serverTimestamp(),
      confirmedAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Busca todas as corridas de um lote (uma vez, sem listener).
 * Usado pelo useSaveCoagRun para análise de Westgard antes de salvar.
 */
export async function getCoagRuns(labId: string, lotId: string): Promise<CoagulacaoRun[]> {
  try {
    const q = query(runsCol(labId, lotId), orderBy('dataRealizacao', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CoagulacaoRun, 'id'>),
    }));
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Faz upload do printout do coagulômetro e retorna a URL pública.
 * Disponível para uso futuro — não é chamado no save flow MVP.
 */
export async function uploadCoagRunImage(
  labId: string,
  lotId: string,
  runId: string,
  file: File,
): Promise<string> {
  const path = storagePath.coagRunImage(labId, lotId, runId);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

// ─── Real-time subscriptions ──────────────────────────────────────────────────

/**
 * Assina a coleção de lotes de coagulação de um lab em tempo real.
 * Ordena por createdAt decrescente (mais recentes primeiro).
 */
export function subscribeToCoagLots(
  labId: string,
  callback: (lots: CoagulacaoLot[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(lotsCol(labId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const lots = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CoagulacaoLot, 'id'>),
      }));
      callback(lots);
    },
    (err) => {
      console.error('[coagulacaoFirebaseService] lots listener error:', err);
      onError?.(new Error(firestoreErrorMessage(err)));
    },
  );
}

/**
 * Assina as corridas de um lote de coagulação em tempo real.
 * Ordena por dataRealizacao crescente (cronológico).
 */
export function subscribeToCoagRuns(
  labId: string,
  lotId: string,
  callback: (runs: CoagulacaoRun[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(runsCol(labId, lotId), orderBy('dataRealizacao', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      const runs = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CoagulacaoRun, 'id'>),
      }));
      callback(runs);
    },
    (err) => {
      console.error(`[coagulacaoFirebaseService] runs[${lotId}] listener error:`, err);
      onError?.(new Error(firestoreErrorMessage(err)));
    },
  );
}

// ─── Audit ────────────────────────────────────────────────────────────────────

/**
 * Grava um registro de auditoria imutável na subcoleção de um lote.
 * Firestore Rules bloqueiam update/delete nesta subcoleção.
 * Falha silenciosa — não bloqueia o fluxo principal.
 */
export async function writeCoagAuditRecord(
  labId: string,
  lotId: string,
  runId: string,
  record: Record<string, unknown>,
): Promise<void> {
  try {
    const auditDocRef = doc(
      db,
      COLLECTIONS.LABS,
      labId,
      SUBCOLLECTIONS.CIQ_COAGULACAO,
      lotId,
      SUBCOLLECTIONS.AUDIT,
      runId,
    );
    await setDoc(auditDocRef, {
      ...record,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Falha de auditoria não deve bloquear o fluxo principal
    console.error('[coagulacaoFirebaseService] audit write failed:', err);
  }
}

// ─── Re-export para conveniência ──────────────────────────────────────────────
export type { Unsubscribe };
export { Timestamp };
