import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../shared/services/firebase';
import type {
  LGPDPolicy,
  SolicitacaoDados,
  DPIA,
  ConsentimentoUsuario,
  LogExclusao,
} from './types/LGPD';

const solicitacoesCollection = (labId: string) => collection(db, `labs/${labId}/lgpd-solicitacoes`);
const dpiaCollection = (labId: string) => collection(db, `labs/${labId}/lgpd-dpia`);
const consentimentoCollection = (labId: string) => collection(db, `labs/${labId}/lgpd-consentimento`);
const exclusaoCollection = (labId: string) => collection(db, `labs/${labId}/lgpd-exclusao`);

export function subscribeSolicitacoes(
  labId: string,
  callback: (solicitacoes: SolicitacaoDados[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(solicitacoesCollection(labId), orderBy('data_solicitacao', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const solicitacoes = snap.docs.map((d) => d.data() as SolicitacaoDados);
      callback(solicitacoes);
    },
    onError,
  );
}

export function subscribeDPIAs(
  labId: string,
  callback: (dpias: DPIA[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(dpiaCollection(labId), orderBy('data_criacao', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const dpias = snap.docs.map((d) => d.data() as DPIA);
      callback(dpias);
    },
    onError,
  );
}

export function subscribeConsentimentos(
  labId: string,
  usuarioId: string,
  callback: (consentimentos: ConsentimentoUsuario[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(consentimentoCollection(labId), where('usuario_id', '==', usuarioId));

  return onSnapshot(
    q,
    (snap) => {
      const consentimentos = snap.docs.map((d) => d.data() as ConsentimentoUsuario);
      callback(consentimentos);
    },
    onError,
  );
}

export function subscribeLogsExclusao(
  labId: string,
  callback: (logs: LogExclusao[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(exclusaoCollection(labId), orderBy('data_exclusao', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map((d) => d.data() as LogExclusao);
      callback(logs);
    },
    onError,
  );
}

/**
 * @deprecated Use the `criarSolicitacao` Cloud Function callable instead.
 * Client-side writes to lgpd-solicitacoes are deprecated as of Phase 0b.
 * This function will be removed after one sprint transition period.
 */
export async function createSolicitacao(
  labId: string,
  input: Omit<SolicitacaoDados, 'id' | 'labId' | 'criadoEm' | 'criadoPor'>,
  uid?: string,
): Promise<string> {
  console.warn(
    '[lgpdService] createSolicitacao is deprecated — use the criarSolicitacao callable instead.',
  );
  const newDocRef = doc(solicitacoesCollection(labId));

  const data: SolicitacaoDados = {
    id: newDocRef.id,
    labId,
    ...input,
    criadoEm: serverTimestamp() as Timestamp,
    criadoPor: uid ?? 'system',
  };

  await setDoc(newDocRef, data);
  return newDocRef.id;
}

export async function updateSolicitacao(
  labId: string,
  id: string,
  updates: Partial<SolicitacaoDados>,
): Promise<void> {
  const docRef = doc(solicitacoesCollection(labId), id);
  const { id: _, labId: __, criadoEm, criadoPor, ...safeUpdates } = updates;
  await updateDoc(docRef, safeUpdates);
}

/**
 * @deprecated Use the `gerarDPIA` Cloud Function callable instead.
 * Client-side writes to lgpd-dpia are deprecated as of Phase 0b.
 * This function will be removed after one sprint transition period.
 */
export async function createDPIA(
  labId: string,
  input: Omit<DPIA, 'id' | 'labId' | 'criadoEm'>,
  uid?: string,
): Promise<string> {
  console.warn(
    '[lgpdService] createDPIA is deprecated — use the gerarDPIA callable instead.',
  );
  const newDocRef = doc(dpiaCollection(labId));

  const data: DPIA = {
    id: newDocRef.id,
    labId,
    ...input,
    criadoEm: serverTimestamp() as Timestamp,
  };

  await setDoc(newDocRef, data);
  return newDocRef.id;
}

/**
 * @deprecated Client-side writes to lgpd-consentimento are deprecated as of Phase 0b.
 * Migrate to a server-side callable for audit-grade consent records.
 * This function will be removed after one sprint transition period.
 */
export async function createConsentimento(
  labId: string,
  input: Omit<ConsentimentoUsuario, 'id' | 'labId' | 'criadoEm'>,
  uid?: string,
): Promise<string> {
  console.warn(
    '[lgpdService] createConsentimento is deprecated — migrate to a server-side callable.',
  );
  const newDocRef = doc(consentimentoCollection(labId));

  const data: ConsentimentoUsuario = {
    id: newDocRef.id,
    labId,
    ...input,
    criadoEm: serverTimestamp() as Timestamp,
  };

  await setDoc(newDocRef, data);
  return newDocRef.id;
}

/**
 * @deprecated Deletion logs are now written server-side by the `processarExclusao` callable.
 * Client-side writes to lgpd-exclusao are deprecated as of Phase 0b.
 * This function will be removed after one sprint transition period.
 */
export async function createLogExclusao(
  labId: string,
  input: Omit<LogExclusao, 'id' | 'labId' | 'criadoEm' | 'criadoPor'>,
  uid?: string,
): Promise<string> {
  console.warn(
    '[lgpdService] createLogExclusao is deprecated — deletion logs are written by the processarExclusao callable.',
  );
  const newDocRef = doc(exclusaoCollection(labId));

  const data: LogExclusao = {
    id: newDocRef.id,
    labId,
    ...input,
    criadoEm: serverTimestamp() as Timestamp,
    criadoPor: uid ?? 'system',
  };

  await setDoc(newDocRef, data);
  return newDocRef.id;
}
