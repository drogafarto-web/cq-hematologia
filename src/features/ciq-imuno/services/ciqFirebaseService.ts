/**
 * ciqFirebaseService — camada Firestore exclusiva do módulo CIQ-Imuno.
 *
 * Standalone: não usa getDatabaseService() nem a classe FirebaseService
 * do módulo de hematologia. Cada módulo gerencia sua própria subcoleção.
 *
 * Paths:
 *   Lotes: labs/{labId}/ciq-imuno/{lotId}
 *   Runs:  labs/{labId}/ciq-imuno/{lotId}/runs/{runId}
 */

import {
  db,
  storage,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from '../../../shared/services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLLECTIONS, SUBCOLLECTIONS, storagePath } from '../../../constants';
import { firestoreErrorMessage } from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import type { CIQImunoRun, CIQImunoLot } from '../types/CIQImuno';
import type { CIQLotStatus } from '../types/_shared_refs';

// ─── Path helpers ─────────────────────────────────────────────────────────────

function lotsCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_IMUNO);
}

function lotRef(labId: string, lotId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_IMUNO, lotId);
}

function runsCol(labId: string, lotId: string) {
  return collection(
    db,
    COLLECTIONS.LABS, labId,
    SUBCOLLECTIONS.CIQ_IMUNO, lotId,
    SUBCOLLECTIONS.RUNS,
  );
}

function runRef(labId: string, lotId: string, runId: string) {
  return doc(
    db,
    COLLECTIONS.LABS, labId,
    SUBCOLLECTIONS.CIQ_IMUNO, lotId,
    SUBCOLLECTIONS.RUNS, runId,
  );
}

// ─── Lot operations ───────────────────────────────────────────────────────────

/**
 * Busca um lote pelo par (testType, loteControle) — retorna null se não existir.
 * Usado para re-aproveitar um lote já existente ao registrar uma nova corrida.
 */
export async function findCIQLot(
  labId:       string,
  testType:    CIQImunoLot['testType'],
  loteControle: string,
): Promise<CIQImunoLot | null> {
  try {
    const q = query(
      lotsCol(labId),
      where('testType',     '==', testType),
      where('loteControle', '==', loteControle),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<CIQImunoLot, 'id'>) };
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Cria um novo lote de controle.
 * Chamada apenas quando findCIQLot retorna null para o par (testType, loteControle).
 */
export async function createCIQLot(
  labId: string,
  lot:   Omit<CIQImunoLot, 'id' | 'createdAt'>,
): Promise<string> {
  try {
    const id  = crypto.randomUUID();
    const ref = lotRef(labId, id);
    await setDoc(ref, {
      ...lot,
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Atualiza campos mutáveis de um lote (runCount, lotStatus, ciqDecision).
 */
export async function updateCIQLot(
  labId:  string,
  lotId:  string,
  fields: Partial<Pick<CIQImunoLot, 'runCount' | 'lotStatus' | 'ciqDecision'>>,
): Promise<void> {
  try {
    await updateDoc(lotRef(labId, lotId), fields as Record<string, unknown>);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

// ─── Run operations ───────────────────────────────────────────────────────────

/**
 * Persiste uma corrida CIQ-Imuno no Firestore.
 * O run.id deve ser gerado pelo caller (crypto.randomUUID()).
 */
export async function saveCIQRun(
  labId: string,
  lotId: string,
  run:   CIQImunoRun,
): Promise<void> {
  try {
    const { id, ...data } = run;
    await setDoc(runRef(labId, lotId, id), {
      ...data,
      // Garante que createdAt e confirmedAt são serverTimestamp no primeiro save
      createdAt:   serverTimestamp(),
      confirmedAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

/**
 * Busca todas as corridas de um lote (uma vez, sem listener).
 * Usado pelo useCIQWestgard para análise estatística antes de salvar.
 */
export async function getCIQRuns(
  labId: string,
  lotId: string,
): Promise<CIQImunoRun[]> {
  try {
    const q    = query(runsCol(labId, lotId), orderBy('dataRealizacao', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CIQImunoRun, 'id'>) }));
  } catch (err) {
    throw new Error(firestoreErrorMessage(err));
  }
}

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Faz upload da imagem do strip e retorna a URL pública.
 * Não lança — falha silenciosa (imageUrl ficará vazia; run já está salva).
 */
export async function uploadStripImage(
  labId: string,
  lotId: string,
  runId: string,
  file:  File,
): Promise<string> {
  const path     = storagePath.imunoStripImage(labId, lotId, runId);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

// ─── Real-time subscriptions ──────────────────────────────────────────────────

/**
 * Assina a coleção de lotes de um lab em tempo real.
 * Ordena por createdAt decrescente (mais recentes primeiro).
 */
export function subscribeToCIQLots(
  labId:    string,
  callback: (lots: CIQImunoLot[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(lotsCol(labId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const lots = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CIQImunoLot, 'id'>),
      }));
      callback(lots);
    },
    (err) => {
      console.error('[ciqFirebaseService] lots listener error:', err);
      onError?.(new Error(firestoreErrorMessage(err)));
    },
  );
}

/**
 * Assina as corridas de um lote em tempo real.
 * Ordena por dataRealizacao crescente (cronológico).
 */
export function subscribeToCIQRuns(
  labId:    string,
  lotId:    string,
  callback: (runs: CIQImunoRun[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(runsCol(labId, lotId), orderBy('dataRealizacao', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      const runs = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CIQImunoRun, 'id'>),
      }));
      callback(runs);
    },
    (err) => {
      console.error(`[ciqFirebaseService] runs[${lotId}] listener error:`, err);
      onError?.(new Error(firestoreErrorMessage(err)));
    },
  );
}

// ─── Audit ────────────────────────────────────────────────────────────────────

/**
 * Grava um registro de auditoria imutável.
 * Firestore Rules bloqueiam update/delete nesta subcoleção.
 */
export async function writeCIQAuditRecord(
  labId:  string,
  lotId:  string,
  runId:  string,
  record: Record<string, unknown>,
): Promise<void> {
  try {
    const auditRef = doc(
      db,
      COLLECTIONS.LABS, labId,
      SUBCOLLECTIONS.CIQ_IMUNO, lotId,
      'audit', runId,
    );
    await setDoc(auditRef, {
      ...record,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Falha de auditoria não deve bloquear o fluxo principal
    console.error('[ciqFirebaseService] audit write failed:', err);
  }
}

// ─── Re-export para conveniência ──────────────────────────────────────────────
export type { Unsubscribe };
export { Timestamp };
