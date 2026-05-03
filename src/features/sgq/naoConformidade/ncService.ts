import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  getDocs,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type {
  NaoConformidade,
  NCFilters,
  CAPAStatus,
  CAPAEvent,
} from '../types/NaoConformidade';

const ncsCollection = (labId: string) =>
  collection(db, `labs/${labId}/naoConformidades`);

// ─── Subscribe ────────────────────────────────────────────────────────────

export function subscribeNCs(
  labId: string,
  filters: NCFilters = {},
  callback: (ncs: NaoConformidade[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const constraints = [where('deletadoEm', '==', null)];

  if (filters.severidade) {
    const severidades = Array.isArray(filters.severidade)
      ? filters.severidade
      : [filters.severidade];
    constraints.push(where('severidade', 'in', severidades));
  }

  if (filters.capaStatus) {
    const statuses = Array.isArray(filters.capaStatus)
      ? filters.capaStatus
      : [filters.capaStatus];
    constraints.push(where('capaStatus', 'in', statuses));
  }

  if (filters.bloqueiaOperacoes !== undefined) {
    constraints.push(where('bloqueiaOperacoes', '==', filters.bloqueiaOperacoes));
  }

  const q = query(ncsCollection(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const ncs = snap.docs
        .map((d) => d.data() as NaoConformidade)
        .filter((nc) => {
          if (filters.busca) {
            const search = filters.busca.toLowerCase();
            return (
              nc.codigo.toLowerCase().includes(search) ||
              nc.titulo.toLowerCase().includes(search)
            );
          }
          if (filters.origem) {
            return nc.origem === filters.origem;
          }
          return true;
        });
      callback(ncs);
    },
    onError,
  );
}

// ─── Get single NC ────────────────────────────────────────────────────────

export async function getNC(labId: string, ncId: string): Promise<NaoConformidade | null> {
  const snap = await getDocs(
    query(ncsCollection(labId), where('id', '==', ncId)),
  );
  return snap.empty ? null : (snap.docs[0].data() as NaoConformidade);
}

// ─── Get NCs by modulo ────────────────────────────────────────────────────

export async function getNCsByModulo(
  labId: string,
  modulo: string,
): Promise<NaoConformidade[]> {
  const q = query(
    ncsCollection(labId),
    where('modulosBloqueados', 'array-contains', modulo),
    where('bloqueiaOperacoes', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as NaoConformidade);
}

// ─── Update CAPA Status ────────────────────────────────────────────────────

export async function updateCAPAStatus(
  labId: string,
  ncId: string,
  novoStatus: CAPAStatus,
  descricao?: string,
  realizadoPor?: string,
  realizadoPorName?: string,
): Promise<void> {
  const docRef = doc(ncsCollection(labId), ncId);

  const capaEvent: CAPAEvent = {
    status: novoStatus,
    timestamp: Timestamp.now(),
    realizadoPor: realizadoPor || 'system',
    realizadoPorName: realizadoPorName || 'Sistema',
    descricao,
    evidencias: [],
  };

  await updateDoc(docRef, {
    capaStatus: novoStatus,
    capaHistorico: (await getNC(labId, ncId))?.capaHistorico.concat(capaEvent) || [capaEvent],
  });
}

// ─── Soft delete ──────────────────────────────────────────────────────────

export async function softDeleteNC(labId: string, ncId: string): Promise<void> {
  const docRef = doc(ncsCollection(labId), ncId);
  await updateDoc(docRef, {
    deletadoEm: serverTimestamp(),
  });
}

// ─── Get ativas and bloqueando ────────────────────────────────────────────

export async function getNCsAtivas(labId: string): Promise<NaoConformidade[]> {
  const q = query(
    ncsCollection(labId),
    where('capaStatus', 'in', ['nao_iniciada', 'investigacao', 'acao', 'eficacia']),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as NaoConformidade);
}

export async function getNCsBloqueando(labId: string): Promise<NaoConformidade[]> {
  const q = query(
    ncsCollection(labId),
    where('bloqueiaOperacoes', '==', true),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as NaoConformidade);
}
