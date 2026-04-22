/**
 * equipamentoService — CRUD + ciclo de vida dos equipamentos do laboratório.
 *
 * Responsabilidades:
 *   - Criar equipamento novo (Yumizen H550, Cell Dyn, Micros 60, etc).
 *   - Editar campos mutáveis (nome, nº série, observações).
 *   - Entrar/sair de manutenção (motivo obrigatório na entrada).
 *   - Aposentar (soft-delete) com motivo + destino final + cálculo de `retencaoAte`.
 *   - Toda mutação gera doc append-only em `/equipamentos-audit/{id}`
 *     atomicamente via writeBatch — falha parcial é impossível.
 *
 * Delete hard é BLOQUEADO em rules. Só uma Cloud Function com SDK Admin e
 * verificação de `retencaoAte` pode remover o doc após 5 anos.
 *
 * @see ../types/Equipamento.ts
 * @see firestore.rules (match /labs/{labId}/equipamentos/...)
 */

import {
  db,
  doc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type {
  Equipamento,
  EquipamentoAuditEvent,
  EquipamentoAuditEventType,
  EquipamentoDestinoFinal,
  EquipamentoFilters,
  EquipamentoStatus,
} from '../types/Equipamento';
import {
  computeRetencaoAte,
  RETENCAO_ANOS_POS_APOSENTADORIA,
} from '../types/Equipamento';
import type { InsumoModulo } from '../../insumos/types/Insumo';

// ─── Path helpers ─────────────────────────────────────────────────────────────

function equipamentosCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.EQUIPAMENTOS);
}

function equipamentoRef(labId: string, equipamentoId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.EQUIPAMENTOS, equipamentoId);
}

function equipamentosAuditCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.EQUIPAMENTOS_AUDIT);
}

function equipamentoAuditRef(labId: string, auditId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.EQUIPAMENTOS_AUDIT, auditId);
}

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface CreateEquipamentoPayload {
  module: InsumoModulo;
  name: string;
  modelo: string;
  fabricante: string;
  numeroSerie?: string;
  anoFabricacao?: number;
  anoAquisicao?: number;
  registroAnvisa?: string;
  observacoes?: string;
  createdBy: string;
  createdByName?: string;
}

/** Campos que o lab pode editar pós-criação. `module` e `modelo` são imutáveis
 *  (trocar modelo significa trocar o equipamento — aposente o antigo e crie novo). */
export interface UpdateEquipamentoPayload {
  name?: string;
  numeroSerie?: string;
  fabricante?: string;
  anoFabricacao?: number;
  anoAquisicao?: number;
  registroAnvisa?: string;
  observacoes?: string;
  updatedBy: string;
  updatedByName?: string;
}

export interface EnterManutencaoPayload {
  motivo: string;
  operadorId: string;
  operadorName: string;
}

export interface LeaveManutencaoPayload {
  operadorId: string;
  operadorName: string;
  /** Opcional — nota final da manutenção (ex: "Substituição da válvula X concluída"). */
  nota?: string;
}

export interface AposentarPayload {
  motivo: string;
  destinoFinal: EquipamentoDestinoFinal;
  operadorId: string;
  operadorName: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function requireMotivo(motivo: string, min = 10): string {
  const t = motivo?.trim() ?? '';
  if (t.length < min) {
    throw new Error(
      `Motivo obrigatório — mínimo ${min} caracteres para trilha de auditoria.`,
    );
  }
  return t;
}

function requireName(name: string): string {
  const t = name?.trim() ?? '';
  if (t.length < 2) throw new Error('Nome do equipamento é obrigatório (mín. 2 caracteres).');
  return t;
}

function requireModelo(modelo: string): string {
  const t = modelo?.trim() ?? '';
  if (t.length < 2) throw new Error('Modelo do equipamento é obrigatório.');
  return t;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Assinatura em tempo real dos equipamentos do lab. Default: oculta
 * `aposentado` para não poluir UIs de rotina. Passar `status: ['aposentado']`
 * em relatórios históricos.
 */
export function subscribeToEquipamentos(
  labId: string,
  onData: (equipamentos: Equipamento[]) => void,
  onError: (err: Error) => void,
  filters: EquipamentoFilters = {},
): Unsubscribe {
  const constraints = [];
  if (filters.module) constraints.push(where('module', '==', filters.module));

  // Normaliza status em array. Default: ativo + manutencao (esconde aposentado).
  const statuses: EquipamentoStatus[] =
    filters.status === undefined
      ? ['ativo', 'manutencao']
      : Array.isArray(filters.status)
        ? filters.status
        : [filters.status];

  if (statuses.length === 1) {
    constraints.push(where('status', '==', statuses[0]));
  } else if (statuses.length > 1 && statuses.length <= 10) {
    constraints.push(where('status', 'in', statuses));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  return onSnapshot(
    query(equipamentosCol(labId), ...constraints),
    (snap) => {
      onData(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<Equipamento, 'id'>) }) as Equipamento,
        ),
      );
    },
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

/** One-shot fetch — útil em Cloud Functions-like client calls e relatórios. */
export async function getEquipamentoOnce(
  labId: string,
  equipamentoId: string,
): Promise<Equipamento | null> {
  try {
    const snap = await getDoc(equipamentoRef(labId, equipamentoId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Equipamento, 'id'>) } as Equipamento;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function listEquipamentosByModule(
  labId: string,
  module: InsumoModulo,
  includeAposentado = false,
): Promise<Equipamento[]> {
  try {
    const constraints = [where('module', '==', module)];
    if (!includeAposentado) {
      constraints.push(where('status', 'in', ['ativo', 'manutencao'] as EquipamentoStatus[]));
    }
    const snap = await getDocs(query(equipamentosCol(labId), ...constraints));
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Equipamento, 'id'>) }) as Equipamento,
    );
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Cria novo equipamento + audit event 'created' atomicamente.
 * @returns ID gerado (UUID v4).
 */
export async function createEquipamento(
  labId: string,
  payload: CreateEquipamentoPayload,
): Promise<string> {
  try {
    const name = requireName(payload.name);
    const modelo = requireModelo(payload.modelo);
    const fabricante = requireName(payload.fabricante);

    const id = crypto.randomUUID();
    const batch = writeBatch(db);

    const docData: Omit<Equipamento, 'id'> = {
      labId,
      module: payload.module,
      name,
      modelo,
      fabricante,
      ...(payload.numeroSerie !== undefined && { numeroSerie: payload.numeroSerie.trim() }),
      ...(payload.anoFabricacao !== undefined && { anoFabricacao: payload.anoFabricacao }),
      ...(payload.anoAquisicao !== undefined && { anoAquisicao: payload.anoAquisicao }),
      ...(payload.registroAnvisa !== undefined && {
        registroAnvisa: payload.registroAnvisa.trim(),
      }),
      ...(payload.observacoes !== undefined && { observacoes: payload.observacoes.trim() }),
      status: 'ativo',
      createdAt: Timestamp.now(),
      createdBy: payload.createdBy,
      ...(payload.createdByName !== undefined && { createdByName: payload.createdByName }),
    };

    batch.set(equipamentoRef(labId, id), docData);
    stageAuditEvent(batch, labId, {
      equipamentoId: id,
      equipamentoNameSnapshot: name,
      equipamentoModeloSnapshot: modelo,
      type: 'created',
      operadorId: payload.createdBy,
      operadorName: payload.createdByName ?? payload.createdBy,
    });

    await batch.commit();
    return id;
  } catch (err) {
    if (err instanceof Error && err.message.includes('obrigatóri')) throw err;
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Atualiza campos mutáveis + audit event 'updated' com diff (antes → depois).
 * Usa transação-like via batch: lê estado atual fora do batch (aceitável —
 * campos editáveis não têm conflito real de concorrência em equipamento).
 */
export async function updateEquipamento(
  labId: string,
  equipamentoId: string,
  patch: UpdateEquipamentoPayload,
): Promise<void> {
  try {
    const current = await getEquipamentoOnce(labId, equipamentoId);
    if (!current) throw new Error('Equipamento não encontrado.');
    if (current.status === 'aposentado') {
      throw new Error('Equipamento aposentado — não pode ser editado.');
    }

    const { updatedBy, updatedByName, ...fields } = patch;

    // Diff antes → depois para audit
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      const normalized =
        typeof v === 'string' ? v.trim() : v;
      const prev = (current as unknown as Record<string, unknown>)[k];
      if (prev !== normalized) {
        changes[k] = { from: prev ?? null, to: normalized };
      }
    }

    if (Object.keys(changes).length === 0) return; // no-op

    const batch = writeBatch(db);
    const normalizedFields: Record<string, unknown> = {};
    for (const [k, { to }] of Object.entries(changes)) {
      normalizedFields[k] = to;
    }

    batch.update(equipamentoRef(labId, equipamentoId), {
      ...normalizedFields,
      updatedAt: serverTimestamp(),
      updatedBy,
    });

    stageAuditEvent(batch, labId, {
      equipamentoId,
      equipamentoNameSnapshot: current.name,
      equipamentoModeloSnapshot: current.modelo,
      type: 'updated',
      changes,
      operadorId: updatedBy,
      operadorName: updatedByName ?? updatedBy,
    });

    await batch.commit();
  } catch (err) {
    if (err instanceof Error && /não encontrado|aposentado|obrigatóri/i.test(err.message)) {
      throw err;
    }
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Entra em manutenção. Bloqueia criação de corridas até `leaveManutencao`.
 * Motivo obrigatório (≥10 chars) para trilha.
 */
export async function enterManutencao(
  labId: string,
  equipamentoId: string,
  input: EnterManutencaoPayload,
): Promise<void> {
  try {
    const motivo = requireMotivo(input.motivo);
    const current = await getEquipamentoOnce(labId, equipamentoId);
    if (!current) throw new Error('Equipamento não encontrado.');
    if (current.status === 'aposentado') {
      throw new Error('Equipamento aposentado — não pode entrar em manutenção.');
    }
    if (current.status === 'manutencao') return; // no-op idempotente

    const batch = writeBatch(db);
    batch.update(equipamentoRef(labId, equipamentoId), {
      status: 'manutencao',
      manutencaoDesde: serverTimestamp(),
      motivoManutencao: motivo,
      updatedAt: serverTimestamp(),
      updatedBy: input.operadorId,
    });
    stageAuditEvent(batch, labId, {
      equipamentoId,
      equipamentoNameSnapshot: current.name,
      equipamentoModeloSnapshot: current.modelo,
      type: 'manutencao-iniciada',
      motivo,
      operadorId: input.operadorId,
      operadorName: input.operadorName,
    });
    await batch.commit();
  } catch (err) {
    if (err instanceof Error && /não encontrado|aposentado|obrigatóri/i.test(err.message)) {
      throw err;
    }
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function leaveManutencao(
  labId: string,
  equipamentoId: string,
  input: LeaveManutencaoPayload,
): Promise<void> {
  try {
    const current = await getEquipamentoOnce(labId, equipamentoId);
    if (!current) throw new Error('Equipamento não encontrado.');
    if (current.status !== 'manutencao') return; // no-op

    const batch = writeBatch(db);
    batch.update(equipamentoRef(labId, equipamentoId), {
      status: 'ativo',
      manutencaoDesde: null,
      motivoManutencao: null,
      updatedAt: serverTimestamp(),
      updatedBy: input.operadorId,
    });
    stageAuditEvent(batch, labId, {
      equipamentoId,
      equipamentoNameSnapshot: current.name,
      equipamentoModeloSnapshot: current.modelo,
      type: 'manutencao-concluida',
      ...(input.nota && { motivo: input.nota }),
      operadorId: input.operadorId,
      operadorName: input.operadorName,
    });
    await batch.commit();
  } catch (err) {
    if (err instanceof Error && /não encontrado/i.test(err.message)) throw err;
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Aposentadoria (soft-delete). Grava `aposentadoEm`, `retencaoAte` (+5 anos),
 * destino e motivo ≥10 chars. Doc permanece readable até a Cloud Function
 * de cleanup removê-lo após `retencaoAte`.
 *
 * RDC 786/2023 art. 42 + RDC 978/2025: registros de instrumentação devem
 * ser preservados por 5 anos pós-desativação.
 */
export async function aposentarEquipamento(
  labId: string,
  equipamentoId: string,
  input: AposentarPayload,
): Promise<void> {
  try {
    const motivo = requireMotivo(input.motivo);
    const current = await getEquipamentoOnce(labId, equipamentoId);
    if (!current) throw new Error('Equipamento não encontrado.');
    if (current.status === 'aposentado') {
      throw new Error('Equipamento já aposentado.');
    }

    const now = new Date();
    const retencao = computeRetencaoAte(now);

    const batch = writeBatch(db);
    batch.update(equipamentoRef(labId, equipamentoId), {
      status: 'aposentado',
      aposentadoEm: Timestamp.fromDate(now),
      aposentadoPor: input.operadorId,
      aposentadoPorName: input.operadorName,
      motivoAposentadoria: motivo,
      destinoFinal: input.destinoFinal,
      retencaoAte: Timestamp.fromDate(retencao),
      // Limpa estado de manutenção se havia
      manutencaoDesde: null,
      motivoManutencao: null,
      updatedAt: serverTimestamp(),
      updatedBy: input.operadorId,
    });
    stageAuditEvent(batch, labId, {
      equipamentoId,
      equipamentoNameSnapshot: current.name,
      equipamentoModeloSnapshot: current.modelo,
      type: 'aposentado',
      motivo,
      destinoFinal: input.destinoFinal,
      operadorId: input.operadorId,
      operadorName: input.operadorName,
    });
    await batch.commit();
  } catch (err) {
    if (err instanceof Error && /não encontrado|já aposentado|obrigatóri/i.test(err.message)) {
      throw err;
    }
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

// ─── Audit ────────────────────────────────────────────────────────────────────

type StageAuditInput = Omit<EquipamentoAuditEvent, 'id' | 'labId' | 'timestamp'>;

/**
 * Adiciona um audit event ao batch. Caller commita junto com a mutação do
 * equipamento (pattern simétrico a `insumoTransitionService.stageTransition`).
 */
function stageAuditEvent(
  batch: ReturnType<typeof writeBatch>,
  labId: string,
  input: StageAuditInput,
): string {
  const id = crypto.randomUUID();
  batch.set(equipamentoAuditRef(labId, id), {
    ...input,
    labId,
    timestamp: serverTimestamp(),
  });
  return id;
}

/** Subscreve à trilha de auditoria de um equipamento específico. */
export function subscribeToEquipamentoAudit(
  labId: string,
  equipamentoId: string,
  onData: (events: EquipamentoAuditEvent[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    equipamentosAuditCol(labId),
    where('equipamentoId', '==', equipamentoId),
    orderBy('timestamp', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map(
          (d) =>
            ({ id: d.id, ...(d.data() as Omit<EquipamentoAuditEvent, 'id'>) }) as EquipamentoAuditEvent,
        ),
      );
    },
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

// ─── Constants re-export ──────────────────────────────────────────────────────

export { RETENCAO_ANOS_POS_APOSENTADORIA };
