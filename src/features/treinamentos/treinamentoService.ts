import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { Treinamento, TreinamentoFilters } from './types/Treinamento';

const treinamentosCollection = (labId: string) =>
  collection(db, `labs/${labId}/treinamentos`);

// ─── Subscribe ────────────────────────────────────────────────────────────

export function subscribeTrainamentos(
  labId: string,
  filters: TreinamentoFilters = {},
  callback: (trainamentos: Treinamento[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const constraints = [where('deletadoEm', '==', null)];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.tipo) {
    constraints.push(where('tipo', '==', filters.tipo));
  }

  if (filters.popId) {
    constraints.push(where('popId', '==', filters.popId));
  }

  if (filters.instrutorId) {
    constraints.push(where('instrutorId', '==', filters.instrutorId));
  }

  constraints.push(orderBy('dataAgendada', 'desc'));

  const q = query(treinamentosCollection(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const treinamentos = snap.docs
        .map((d) => d.data() as Treinamento)
        .filter((t) => {
          if (filters.busca) {
            const search = filters.busca.toLowerCase();
            return (
              t.titulo.toLowerCase().includes(search) ||
              t.popNome.toLowerCase().includes(search)
            );
          }
          return true;
        });
      callback(treinamentos);
    },
    onError,
  );
}

// ─── Get single ───────────────────────────────────────────────────────────

export async function getTreinamento(
  labId: string,
  treinamentoId: string,
): Promise<Treinamento | null> {
  const snap = await getDocs(
    query(treinamentosCollection(labId), where('id', '==', treinamentoId)),
  );
  return snap.empty ? null : (snap.docs[0].data() as Treinamento);
}

// ─── Get by POP ────────────────────────────────────────────────────────────

export async function getTreinamentosByPopId(
  labId: string,
  popId: string,
): Promise<Treinamento[]> {
  const q = query(
    treinamentosCollection(labId),
    where('popId', '==', popId),
    where('deletadoEm', '==', null),
    orderBy('dataAgendada', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Treinamento);
}

// ─── Get atrasados ────────────────────────────────────────────────────────

export async function getTreinamentosAtrasados(labId: string): Promise<Treinamento[]> {
  const now = Timestamp.now();
  const q = query(
    treinamentosCollection(labId),
    where('dataAgendada', '<', now),
    where('status', 'in', ['planejado', 'agendado']),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Treinamento);
}

// ─── Get certificados vencendo ────────────────────────────────────────────

export async function getCertificadosVencendo(
  labId: string,
  diasLimite: number = 30,
): Promise<Treinamento[]> {
  const now = new Date();
  const venceLimite = new Date(now.getTime() + diasLimite * 24 * 60 * 60 * 1000);

  const q = query(
    treinamentosCollection(labId),
    where('status', '==', 'realizado'),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => d.data() as Treinamento)
    .filter((t) => {
      if (!t.certificado?.validoAte) return false;
      const validoAte = t.certificado.validoAte.toDate();
      return validoAte > now && validoAte <= venceLimite;
    });
}

// ─── Update status ────────────────────────────────────────────────────────

export async function updateTreinamentoStatus(
  labId: string,
  treinamentoId: string,
  novoStatus: Treinamento['status'],
  motivoCancelamento?: string,
): Promise<void> {
  const docRef = doc(treinamentosCollection(labId), treinamentoId);
  const updateData: Record<string, any> = { status: novoStatus };

  if (novoStatus === 'cancelado' && motivoCancelamento) {
    updateData.motivoCancelamento = motivoCancelamento;
  }

  if (novoStatus === 'realizado') {
    updateData.dataRealizacao = serverTimestamp();
  }

  await updateDoc(docRef, updateData);
}

// ─── Registrar presença ────────────────────────────────────────────────────

export async function registrarPresenca(
  labId: string,
  treinamentoId: string,
  participanteId: string,
  presente: boolean,
  assinatura?: string,
): Promise<void> {
  const docRef = doc(treinamentosCollection(labId), treinamentoId);
  const presencaPath = `presenca.${participanteId}`;

  const updateData: Record<string, any> = {
    [presencaPath]: {
      presente,
      assinatura: assinatura || null,
    },
  };

  await updateDoc(docRef, updateData);
}

// ─── Emitir certificado ────────────────────────────────────────────────────

export async function emitirCertificado(
  labId: string,
  treinamentoId: string,
  validadesMeses: number,
  certificadoUrl?: string,
): Promise<void> {
  const docRef = doc(treinamentosCollection(labId), treinamentoId);

  const agora = Timestamp.now();
  const validoAte = new Date(agora.toDate().getTime() + validadesMeses * 30 * 24 * 60 * 60 * 1000);

  const certificado = {
    numero: `CERT-${treinamentoId.slice(0, 8).toUpperCase()}-${Date.now()}`,
    emitidoEm: agora,
    validoAte: Timestamp.fromDate(validoAte),
    url: certificadoUrl || null,
  };

  await updateDoc(docRef, {
    certificado,
    status: 'realizado',
  });
}

// ─── Soft delete ──────────────────────────────────────────────────────────

export async function softDeleteTreinamento(labId: string, treinamentoId: string): Promise<void> {
  const docRef = doc(treinamentosCollection(labId), treinamentoId);
  await updateDoc(docRef, {
    deletadoEm: serverTimestamp(),
  });
}
