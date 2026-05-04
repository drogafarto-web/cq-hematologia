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
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../shared/services/firebase';
import type { Auditoria, AuditoriaFilters } from '../types/Auditoria';

const auditoriaCollection = (labId: string) =>
  collection(db, `labs/${labId}/auditorias`);

// ─── Subscribe ────────────────────────────────────────────────────────────

export function subscribeAuditorias(
  labId: string,
  filters: AuditoriaFilters = {},
  callback: (auditorias: Auditoria[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const constraints = [where('deletadoEm', '==', null)];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.tipo) {
    constraints.push(where('tipo', '==', filters.tipo));
  }

  const q = query(auditoriaCollection(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const auditorias = snap.docs
        .map((d) => d.data() as Auditoria)
        .filter((auditoria) => {
          if (filters.busca) {
            const search = filters.busca.toLowerCase();
            return (
              auditoria.codigo.toLowerCase().includes(search) ||
              auditoria.titulo.toLowerCase().includes(search)
            );
          }
          return true;
        });
      callback(auditorias);
    },
    onError,
  );
}

// ─── Get single Auditoria ─────────────────────────────────────────────────

export async function getAuditoria(
  labId: string,
  auditoriaId: string,
): Promise<Auditoria | null> {
  const snap = await getDocs(
    query(auditoriaCollection(labId), where('id', '==', auditoriaId)),
  );
  return snap.empty ? null : (snap.docs[0].data() as Auditoria);
}

// ─── Update status ────────────────────────────────────────────────────────

export async function updateAuditoriaStatus(
  labId: string,
  auditoriaId: string,
  novoStatus: Auditoria['status'],
): Promise<void> {
  const docRef = doc(auditoriaCollection(labId), auditoriaId);
  await updateDoc(docRef, {
    status: novoStatus,
  });
}

// ─── Soft delete ──────────────────────────────────────────────────────────

export async function softDeleteAuditoria(labId: string, auditoriaId: string): Promise<void> {
  const docRef = doc(auditoriaCollection(labId), auditoriaId);
  await updateDoc(docRef, {
    deletadoEm: serverTimestamp(),
  });
}

// ─── Get auditorias vencidas ──────────────────────────────────────────────

export async function getAuditoriasVencidas(labId: string): Promise<Auditoria[]> {
  const now = new Date();
  const snap = await getDocs(
    query(
      auditoriaCollection(labId),
      where('prazoClosure', '<', now),
      where('status', 'in', ['planejada', 'em_execucao']),
    ),
  );
  return snap.docs.map((d) => d.data() as Auditoria);
}

// ─── Get auditorias by escopo ──────────────────────────────────────────────

export async function getAuditoriasByEscopo(
  labId: string,
  escopo: string,
): Promise<Auditoria[]> {
  const snap = await getDocs(
    query(
      auditoriaCollection(labId),
      where('escopo', '==', escopo),
      where('deletadoEm', '==', null),
    ),
  );
  return snap.docs.map((d) => d.data() as Auditoria);
}

// ─── Create Auditoria (via Cloud Function callable) ─────────────────────────

export async function createAuditoria(
  labId: string,
  codigo: string,
  titulo: string,
  tipo: 'interna' | 'externa' | 'auditoria_cliente',
  escopo: string,
  agendadaPara: Date,
): Promise<string> {
  const callable = httpsCallable(functions, 'createAuditoria');
  const result: any = await callable({
    labId,
    codigo,
    titulo,
    tipo,
    escopo,
    agendadaPara: agendadaPara.toISOString(),
  });
  return result.data.auditoriaId;
}

// ─── Register Achado (via Cloud Function callable) ──────────────────────────

export async function registerAchado(
  labId: string,
  auditoriaId: string,
  descricao: string,
  severidade: 'critica' | 'grave' | 'moderada' | 'leve' | 'observacao',
  criterio: string,
  evidencias?: string[],
): Promise<{ achadoId: string; requerNCAutomatica: boolean }> {
  const callable = httpsCallable(functions, 'registerAchado');
  const result: any = await callable({
    labId,
    auditoriaId,
    descricao,
    severidade,
    criterio,
    evidencias,
  });
  return {
    achadoId: result.data.achadoId,
    requerNCAutomatica: result.data.requerNCAutomatica,
  };
}

// ─── Create Plano de Ação (via Cloud Function callable) ──────────────────────

export async function createPlanoAcao(
  labId: string,
  auditoriaId: string,
  achadoId: string,
  descricao: string,
  responsavel: string,
  prazo: Date,
): Promise<string> {
  const callable = httpsCallable(functions, 'createPlanoAcao');
  const result: any = await callable({
    labId,
    auditoriaId,
    achadoId,
    descricao,
    responsavel,
    prazo: prazo.toISOString(),
  });
  return result.data.planoId;
}

// ─── Close Auditoria (via Cloud Function callable) ────────────────────────

export async function closeAuditoria(labId: string, auditoriaId: string): Promise<void> {
  const callable = httpsCallable(functions, 'closeAuditoria');
  await callable({ labId, auditoriaId });
}
