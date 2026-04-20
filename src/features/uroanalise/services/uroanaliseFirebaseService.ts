/**
 * uroanaliseFirebaseService — camada Firestore exclusiva do módulo CIQ-Uroanálise.
 *
 * Standalone: não usa getDatabaseService() nem qualquer serviço de outros módulos.
 * Cada módulo gerencia sua própria subcoleção.
 *
 * Paths:
 *   Lotes: labs/{labId}/ciq-uroanalise/{lotId}
 *   Runs:  labs/{labId}/ciq-uroanalise/{lotId}/runs/{runId}
 *   Audit: labs/{labId}/ciq-uroanalise/{lotId}/audit/{auditId}
 *   Meta:  labs/{labId}/ciq-uroanalise-meta/counters
 *   Audit lab-level: labs/{labId}/ciq-uroanalise-audit/{auditId}
 *
 * Arquitetura: client-direct (setDoc/updateDoc) com Firestore Rules como defense-in-depth.
 * Cloud Functions ficam em backlog para v2.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · CLSI GP16-A3 · EUG
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
import type { UroanaliseRun, UroanaliseLot } from '../types/Uroanalise';

// ─── Path helpers ─────────────────────────────────────────────────────────────

/** Referência à coleção de lotes de uroanálise de um lab. */
function lotsCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_UROANALISE);
}

/** Referência a um documento de lote de uroanálise. */
function lotRef(labId: string, lotId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_UROANALISE, lotId);
}

/** Referência à subcoleção de runs de um lote. */
function runsCol(labId: string, lotId: string) {
  return collection(
    db,
    COLLECTIONS.LABS,
    labId,
    SUBCOLLECTIONS.CIQ_UROANALISE,
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
    SUBCOLLECTIONS.CIQ_UROANALISE,
    lotId,
    SUBCOLLECTIONS.RUNS,
    runId,
  );
}

// ─── Lot operations ───────────────────────────────────────────────────────────

/**
 * Busca um lote pelo par (nivel, loteControle) — retorna null se não existir.
 *
 * Cada combinação (nivel × loteControle) é um lote distinto, pois os valores
 * esperados diferem por nível de controle (CLSI GP16-A3).
 * Usado para reaproveitar um lote ao registrar uma nova corrida.
 */
export async function findUroLot(
  labId: string,
  nivel: UroanaliseLot['nivel'],
  loteControle: string,
): Promise<UroanaliseLot | null> {
  try {
    const q = query(
      lotsCol(labId),
      where('nivel', '==', nivel),
      where('loteControle', '==', loteControle),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<UroanaliseLot, 'id'>) };
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Cria um novo lote de controle de uroanálise.
 * Chamada apenas quando findUroLot retorna null para o par (nivel, loteControle).
 */
export async function createUroLot(
  labId: string,
  lot: Omit<UroanaliseLot, 'id' | 'createdAt'>,
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
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Atualiza campos mutáveis de um lote (runCount, lotStatus, uroDecision, decisão).
 */
export async function updateUroLot(
  labId: string,
  lotId: string,
  fields: Partial<
    Pick<UroanaliseLot, 'runCount' | 'lotStatus' | 'uroDecision' | 'decisionBy' | 'decisionAt'>
  >,
): Promise<void> {
  try {
    await updateDoc(lotRef(labId, lotId), fields as Record<string, unknown>);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Registra a decisão formal de aprovação/rejeição de um lote pelo RT.
 * Grava uroDecision, decisionBy e decisionAt atomicamente.
 */
export async function updateUroLotDecision(
  labId: string,
  lotId: string,
  decision: UroanaliseLot['uroDecision'],
  decisionBy: string,
): Promise<void> {
  try {
    await updateDoc(lotRef(labId, lotId), {
      uroDecision: decision,
      decisionBy,
      decisionAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Atualiza metadados editáveis de um lote
 * (datas de abertura/validade e resultados esperados da bula).
 * Campos estruturais (nivel, loteControle) são imutáveis pós-criação.
 *
 * Registra audit imutável em ciq-uroanalise/{lotId}/audit/{uuid} ANTES de persistir.
 */
export async function updateUroLotMeta(
  labId: string,
  lotId: string,
  fields: Partial<
    Pick<UroanaliseLot, 'aberturaControle' | 'validadeControle' | 'resultadosEsperados'>
  >,
  actorUid: string,
  prevValues: Partial<
    Pick<UroanaliseLot, 'aberturaControle' | 'validadeControle' | 'resultadosEsperados'>
  >,
): Promise<void> {
  try {
    // Audit first — imutável via Firestore Rules (só create, nunca update/delete)
    const auditDocRef = doc(
      db,
      COLLECTIONS.LABS,
      labId,
      SUBCOLLECTIONS.CIQ_UROANALISE,
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
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Exclui um lote e todas as suas corridas (cascade via batch).
 *
 * Registra audit em labs/{labId}/ciq-uroanalise-audit/{uuid} ANTES do batch —
 * o registro sobrevive à exclusão do lote e é rastreável mesmo sem o documento.
 */
export async function deleteUroLot(
  labId: string,
  lotId: string,
  lotSnapshot: Pick<UroanaliseLot, 'nivel' | 'loteControle' | 'runCount' | 'validadeControle'>,
  actorUid: string,
): Promise<void> {
  try {
    // Audit gravado no nível do lab — sobrevive à exclusão do lote
    const auditDocRef = doc(
      db,
      COLLECTIONS.LABS,
      labId,
      SUBCOLLECTIONS.CIQ_UROANALISE_AUDIT,
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
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Gera o próximo código sequencial de corrida no formato UR-YYYY-NNNN.
 *
 * Usa uma transação Firestore para garantir que o contador seja atômico mesmo
 * sob concorrência (múltiplos operadores salvando simultaneamente).
 *
 * Counter path: labs/{labId}/ciq-uroanalise-meta/counters
 * Field: runCount (number, inicia em 0)
 */
export async function generateUroRunCode(labId: string): Promise<string> {
  const counterRef = doc(
    db,
    COLLECTIONS.LABS,
    labId,
    SUBCOLLECTIONS.CIQ_UROANALISE_META,
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

  return `UR-${year}-${String(nextCount).padStart(4, '0')}`;
}

// ─── Run operations ───────────────────────────────────────────────────────────

/**
 * Persiste uma corrida de uroanálise no Firestore.
 * O run.id deve ser gerado pelo caller (crypto.randomUUID()).
 */
export async function saveUroRun(labId: string, lotId: string, run: UroanaliseRun): Promise<void> {
  try {
    const { id, ...data } = run;
    await setDoc(runRef(labId, lotId, id), {
      ...data,
      // Garante que createdAt e confirmedAt são serverTimestamp no primeiro save
      createdAt: serverTimestamp(),
      confirmedAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Busca todas as corridas de um lote (uma vez, sem listener).
 * Usado pelo useSaveUroRun para análise de conformidade antes de salvar.
 */
export async function getUroRuns(labId: string, lotId: string): Promise<UroanaliseRun[]> {
  try {
    const q = query(runsCol(labId, lotId), orderBy('dataRealizacao', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<UroanaliseRun, 'id'>),
    }));
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Faz upload da foto da tira reagente e retorna a URL pública.
 * Usada pelo OCR em v2 — disponível agora para upload manual.
 */
export async function uploadUroTiraImage(
  labId: string,
  lotId: string,
  runId: string,
  file: File,
): Promise<string> {
  const path = storagePath.uroTiraImage(labId, lotId, runId);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

// ─── Real-time subscriptions ──────────────────────────────────────────────────

/**
 * Assina a coleção de lotes de uroanálise de um lab em tempo real.
 * Ordena por createdAt decrescente (mais recentes primeiro).
 */
export function subscribeToUroLots(
  labId: string,
  callback: (lots: UroanaliseLot[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(lotsCol(labId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const lots = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UroanaliseLot, 'id'>),
      }));
      callback(lots);
    },
    (err) => {
      console.error('[uroanaliseFirebaseService] lots listener error:', err);
      onError?.(new Error(firestoreErrorMessage(err)));
    },
  );
}

/**
 * Assina as corridas de um lote de uroanálise em tempo real.
 * Ordena por dataRealizacao crescente (cronológico).
 */
export function subscribeToUroRuns(
  labId: string,
  lotId: string,
  callback: (runs: UroanaliseRun[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(runsCol(labId, lotId), orderBy('dataRealizacao', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      const runs = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UroanaliseRun, 'id'>),
      }));
      callback(runs);
    },
    (err) => {
      console.error(`[uroanaliseFirebaseService] runs[${lotId}] listener error:`, err);
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
export async function writeUroAuditRecord(
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
      SUBCOLLECTIONS.CIQ_UROANALISE,
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
    console.error('[uroanaliseFirebaseService] audit write failed:', err);
  }
}

// ─── Re-export para conveniência ──────────────────────────────────────────────
export type { Unsubscribe };
export { Timestamp };
