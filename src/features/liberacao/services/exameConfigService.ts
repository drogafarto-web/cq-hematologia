import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { LabId, UserId } from '../types/_shared_refs';
import { ExameConfig } from '../types/exameConfig';

/**
 * Service para gerenciar configuração de exames por lab
 * Convenção: /labs/{labId}/exames-config/{exameId}
 *
 * Define classificação (rotina/revisao-rt/bloqueio-critico) e auto-release rules
 */

/**
 * Subscribe a todas as configs de exame de um lab
 */
export function subscribeExameConfigs(
  labId: LabId,
  onData: (configs: ExameConfig[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(db, 'labs', labId, 'exames-config'),
    where('deletadoEm', '==', null),
    orderBy('examName', 'asc'),
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const configs = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as ExameConfig[];
      onData(configs);
    },
    (error) => {
      console.error('[subscribeExameConfigs] error:', error);
      onError?.(error);
    },
  );

  return unsubscribe;
}

/**
 * Get config por exam code
 */
export async function getExameConfig(labId: LabId, examCode: string): Promise<ExameConfig | null> {
  const q = query(
    collection(db, 'labs', labId, 'exames-config'),
    where('examCode', '==', examCode),
    where('deletadoEm', '==', null),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    ...doc.data(),
    id: doc.id,
  } as ExameConfig;
}

/**
 * Create novo exame config
 * Chamado por Cloud Function em Plan 10-02+
 */
export async function createExameConfig(
  labId: LabId,
  input: Omit<ExameConfig, 'id' | 'labId' | 'criadoEm' | 'deletadoEm'>,
): Promise<ExameConfig> {
  const docRef = doc(collection(db, 'labs', labId, 'exames-config'));

  const config: ExameConfig = {
    ...input,
    id: docRef.id,
    labId,
    criadoEm: Timestamp.now(),
    deletadoEm: null,
  };

  await setDoc(docRef, config);

  return config;
}

/**
 * Update exame config
 */
export async function updateExameConfig(
  labId: LabId,
  configId: string,
  updates: Partial<ExameConfig>,
): Promise<void> {
  const docRef = doc(db, 'labs', labId, 'exames-config', configId);

  const allowed = {
    classification: updates.classification,
    autoReleaseEnabled: updates.autoReleaseEnabled,
    cv_alvo: updates.cv_alvo,
    rtRevisorObrigatorioId: updates.rtRevisorObrigatorioId,
  };

  await updateDoc(docRef, allowed);
}

/**
 * Soft delete exame config
 */
export async function softDeleteExameConfig(labId: LabId, configId: string): Promise<void> {
  const docRef = doc(db, 'labs', labId, 'exames-config', configId);
  await updateDoc(docRef, {
    deletadoEm: Timestamp.now(),
  });
}
