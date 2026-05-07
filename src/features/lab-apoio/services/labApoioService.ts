/**
 * labApoioService.ts
 *
 * Camada de persistência multi-tenant do módulo Lab Apoio.
 * Toda operação recebe `labId` explicitamente — não há caminho que permita
 * escrita sem tenant. Documentos também carregam `labId` redundante para
 * defense-in-depth nas security rules.
 *
 * DL-1 — LOCKED DECISION: Todas as escritas (create/update/delete) são
 * Cloud Function callables. Service client-side é read-only.
 */

import {
  Timestamp,
  collection,
  db,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type { Contrato, LabApoioFilters, LabApoioAuditEvent } from '../types/LabApoio';
import type { LabId } from '../types/shared_refs';

// ─── Raiz e caminhos ──────────────────────────────────────────────────────────

const LABAPOIO_ROOT = 'labs';

const labApoioCol = (labId: LabId): CollectionReference =>
  collection(db, LABAPOIO_ROOT, labId, 'lab-apoio');

const contratoDoc = (labId: LabId, contratoId: string): DocumentReference =>
  doc(labApoioCol(labId), contratoId);

const contratoEventsCol = (labId: LabId, contratoId: string): CollectionReference =>
  collection(contratoDoc(labId, contratoId), 'events');

// ─── Mapping snapshot → entidade ──────────────────────────────────────────────

function mapContrato(snap: QueryDocumentSnapshot): Contrato {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    nome: d.nome as string,
    razaoSocial: d.razaoSocial as string,
    cnpj: d.cnpj as string,
    habilitacaoAnvisa: d.habilitacaoAnvisa as string,
    vigenciaInicio: d.vigenciaInicio as string,
    vigenciaFim: d.vigenciaFim as string,
    criticidade: d.criticidade as Contrato['criticidade'],
    exames: (d.exames ?? []) as Contrato['exames'],
    endereco: d.endereco as Contrato['endereco'],
    certificacoes: (d.certificacoes ?? []) as Contrato['certificacoes'],
    contatos: (d.contatos ?? []) as Contrato['contatos'],
    observacoes: (d.observacoes ?? undefined) as string | undefined,
    anexoContratoUrl: (d.anexoContratoUrl ?? undefined) as string | undefined,
    anexoContratoSize: (d.anexoContratoSize ?? undefined) as number | undefined,
    avaliacaoPeriodica: (d.avaliacaoPeriodica ?? []) as Contrato['avaliacaoPeriodica'],
    proximaAvaliacaoEm: (d.proximaAvaliacaoEm ?? null) as Timestamp | null,
    ativo: (d.ativo ?? true) as boolean,
    logicalSignature: d.logicalSignature as Contrato['logicalSignature'],
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

function mapAuditEvent(snap: QueryDocumentSnapshot): LabApoioAuditEvent {
  const d = snap.data();
  return {
    id: snap.id,
    tipo: d.tipo as LabApoioAuditEvent['tipo'],
    operadorId: d.operadorId as string,
    timestamp: d.timestamp as Timestamp,
    mudancas: d.mudancas ?? undefined,
    chainHash: d.chainHash as string,
    chainHashAnterior: (d.chainHashAnterior ?? null) as string | null,
  };
}

// ─── API: Read-only (subscribe + get) ────────────────────────────────────────

export interface SubscribeContratosOptions extends LabApoioFilters {
  limit?: number;
}

/**
 * Subscribe em tempo real aos contratos do lab ativo.
 * Aplica filtros client-side para deletadoEm conforme opção.
 * Ordena por vigenciaFim ASC (vencendo primeiro).
 *
 * @param labId — Tenant ativo
 * @param options — Filtros e opções de subscription
 * @param callback — Chamado com a lista de contratos quando muda
 * @param onError — Callback de erro (opcional)
 * @returns Unsubscribe function
 */
export function subscribeContratos(
  labId: LabId,
  options: SubscribeContratosOptions = {},
  callback: (contratos: Contrato[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const {
    ativo,
    criticidade,
    vencendo,
    semavaliacaoAnual,
    includeDeleted = false,
    limit = 1000,
  } = options;

  const whereConstraints = [];

  // Build where constraints
  if (ativo !== undefined) {
    whereConstraints.push(where('ativo', '==', ativo));
  }
  if (criticidade) {
    whereConstraints.push(where('criticidade', '==', criticidade));
  }

  const q = query(labApoioCol(labId), ...whereConstraints, orderBy('vigenciaFim', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const contratos = snapshot.docs
        .map(mapContrato)
        .filter((c) => {
          if (!includeDeleted && c.deletadoEm !== null) return false;

          // Vencendo nos próximos 90 dias
          if (vencendo) {
            const daysUntil = Math.floor(
              (new Date(c.vigenciaFim).getTime() - new Date(now).getTime()) /
                (1000 * 60 * 60 * 24),
            );
            if (daysUntil > 90 || daysUntil < 0) return false;
          }

          // Sem avaliação anual em dia
          if (semavaliacaoAnual && c.proximaAvaliacaoEm) {
            const proximaAvalTs = typeof c.proximaAvaliacaoEm === 'object' && 'toDate' in c.proximaAvaliacaoEm
              ? c.proximaAvaliacaoEm.toDate()
              : new Date(c.proximaAvaliacaoEm as any);
            if (proximaAvalTs.getTime() > new Date(now).getTime()) {
              return false;
            }
          }

          return true;
        })
        .slice(0, limit);

      callback(contratos);
    },
    (error) => {
      const err = new Error(`Subscribe contratos error: ${error.message}`);
      if (onError) onError(err);
    },
  );
}

/**
 * Fetch um contrato específico por ID.
 *
 * @param labId — Tenant
 * @param contratoId — ID do contrato
 * @returns Contrato ou null se não encontrado
 */
export async function getContrato(labId: LabId, contratoId: string): Promise<Contrato | null> {
  const snap = await getDoc(contratoDoc(labId, contratoId));
  if (!snap.exists()) return null;
  return mapContrato(snap);
}

/**
 * Fetch eventos de auditoria de um contrato.
 *
 * @param labId — Tenant
 * @param contratoId — ID do contrato
 * @returns Array de eventos ordenados por timestamp DESC
 */
export async function getContratoAuditTrail(
  labId: LabId,
  contratoId: string,
): Promise<LabApoioAuditEvent[]> {
  const q = query(contratoEventsCol(labId, contratoId), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapAuditEvent);
}

// ─── Callable wrappers (read-only adapters) ──────────────────────────────────

/**
 * Helper para unwrap callable errors em formato legível.
 * Traduz FirebaseError → Error com mensagem em PT-BR.
 */
export function unwrapCallableError(error: unknown): Error {
  if (error instanceof Error) {
    const message = (error as any).message || error.message;
    // Try to extract Firebase error details
    if (typeof message === 'string' && message.includes('INTERNAL')) {
      return new Error('Erro ao processar solicitação (cloud function)');
    }
    return new Error(message);
  }
  return new Error('Erro desconhecido ao chamar função');
}

// ─── Callable stubs (will be imported from functions) ──────────────────────

/**
 * Stub for lazy-loading callable wrappers.
 * Real implementations are httpsCallable in useLabApoio hook.
 */
export async function labApoio_createContrato(
  labId: LabId,
  input: any,
): Promise<{ id: string }> {
  throw new Error('Not implemented in service; use useLabApoio.createContrato');
}

export async function labApoio_updateContrato(labId: LabId, contratoId: string, input: any): Promise<void> {
  throw new Error('Not implemented in service; use useLabApoio.updateContrato');
}

export async function labApoio_softDeleteContrato(
  labId: LabId,
  contratoId: string,
  motivo: string,
): Promise<void> {
  throw new Error('Not implemented in service; use useLabApoio.softDeleteContrato');
}

export async function labApoio_registrarAvaliacaoPeriodica(
  labId: LabId,
  contratoId: string,
  avaliacao: any,
): Promise<void> {
  throw new Error('Not implemented in service; use useLabApoio.registrarAvaliacaoPeriodica');
}

export async function labApoio_uploadContratoAnexo(
  labId: LabId,
  contratoId: string,
  fileMeta: any,
): Promise<void> {
  throw new Error('Not implemented in service; use useLabApoio.uploadContratoAnexo');
}
