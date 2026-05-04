import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
  Timestamp,
  type Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../shared/services/firebase';
import type { POP, POPInput, POPFilters, TreinamentoPOP } from '../types/POP';

const popsCollection = (labId: string) => collection(db, `labs/${labId}/pops`);

// ─── Subscribe ─────────────────────────────────────────────────────────────

export function subscribePOPs(
  labId: string,
  filters: POPFilters = {},
  callback: (pops: POP[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const constraints = [where('deletadoEm', '==', null)];

  if (filters.modulo) {
    const modulos = Array.isArray(filters.modulo) ? filters.modulo : [filters.modulo];
    constraints.push(where('modulos', 'array-contains-any', modulos));
  }

  const q = query(popsCollection(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const pops = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as POP))
        .filter((pop) => {
          if (filters.status) {
            const versaoAtiva = pop.versoes?.find((v) => v.status === 'ativa');
            if (!versaoAtiva) return false;
          }
          if (filters.busca) {
            const search = filters.busca.toLowerCase();
            return (
              pop.nome.toLowerCase().includes(search) ||
              pop.codigo.toLowerCase().includes(search)
            );
          }
          return true;
        });
      callback(pops);
    },
    onError,
  );
}

// ─── Get single POP ────────────────────────────────────────────────────────

export async function getPOP(labId: string, popId: string): Promise<POP | null> {
  const docRef = doc(popsCollection(labId), popId);
  const snap = await getDocs(query(popsCollection(labId), where('id', '==', popId)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as POP;
}

// ─── Create POP (via Cloud Function callable) ──────────────────────────────

export async function createPOPClient(labId: string, input: POPInput): Promise<string> {
  const callable = httpsCallable(functions, 'createPOP');
  const result: any = await callable({
    labId,
    nome: input.nome,
    codigo: input.codigo,
    modulos: input.modulos,
    conteudo: input.conteudo,
    treinamentosObrigatorios: input.treinamentosObrigatorios,
  });
  return result.data.popId;
}

export async function createPOP(labId: string, input: POPInput): Promise<string> {
  return createPOPClient(labId, input);
}

// ─── Update POP ────────────────────────────────────────────────────────────

export async function updatePOP(
  labId: string,
  popId: string,
  updates: Partial<Omit<POP, 'id' | 'labId' | 'criadoEm' | 'criadoPor'>>,
): Promise<void> {
  const docRef = doc(popsCollection(labId), popId);
  await updateDoc(docRef, updates);
}

// ─── Soft delete ───────────────────────────────────────────────────────────

export async function softDeletePOP(labId: string, popId: string): Promise<void> {
  const docRef = doc(popsCollection(labId), popId);
  await updateDoc(docRef, {
    deletadoEm: serverTimestamp(),
  });
}

// ─── Search POPs by codigo ────────────────────────────────────────────────

export async function searchPOPByCode(
  labId: string,
  codigo: string,
): Promise<POP | null> {
  const q = query(
    popsCollection(labId),
    where('codigo', '==', codigo),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as POP;
}

// ─── Get POPs by modulo ────────────────────────────────────────────────────

export async function getPOPsByModulo(labId: string, modulo: string): Promise<POP[]> {
  const q = query(
    popsCollection(labId),
    where('modulos', 'array-contains', modulo),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as POP));
}

// ─── Create POP Version (via Cloud Function callable) ────────────────────────

export async function createPOPVersion(
  labId: string,
  popId: string,
  conteudo: { markdown?: string; pdfUrl?: string },
  isMajorVersion?: boolean,
): Promise<{ versao: string; status: string; hashConteudo: string }> {
  const callable = httpsCallable(functions, 'createPOPVersion');
  const result: any = await callable({
    labId,
    popId,
    conteudo,
    isMajorVersion,
  });
  return {
    versao: result.data.versao,
    status: result.data.status,
    hashConteudo: result.data.hashConteudo,
  };
}

// ─── POP Signature by RT (via Cloud Function callable) ────────────────────────

export async function signPOPVersion(
  labId: string,
  popId: string,
  popVersaoNumero: string,
): Promise<{ status: string; assinadoPor: string; assinadoEm: Timestamp }> {
  const callable = httpsCallable(functions, 'assinaturaRT');
  const result: any = await callable({
    labId,
    popId,
    popVersaoNumero,
  });
  return {
    status: result.data.status,
    assinadoPor: result.data.assinadoPor,
    assinadoEm: result.data.assinadoEm,
  };
}

// ─── Record Operator Training (via Cloud Function callable) ──────────────────

export async function recordarTreinamentoPOP(
  labId: string,
  operadorUid: string,
  popId: string,
  popVersaoNumero: string,
  certificado_url?: string,
): Promise<{ success: boolean; validoAte: Date }> {
  const callable = httpsCallable(functions, 'recordarTreinamentoPOP');
  const result: any = await callable({
    labId,
    operadorUid,
    popId,
    popVersaoNumero,
    certificado_url,
  });
  return {
    success: result.data.success,
    validoAte: new Date(result.data.validoAte),
  };
}
