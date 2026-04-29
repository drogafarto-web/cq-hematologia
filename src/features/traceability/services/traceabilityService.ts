/**
 * traceabilityService.ts
 *
 * Append-only event log que ancora marcos do CIQ (troca de reagente, controle
 * aprovado, calibração, manutenção) ao código sequencial de atendimento do LIS.
 *
 * Path: /labs/{labId}/traceability-events/{id}
 *
 * Modelo é puramente append-only — eventos nunca são editados ou deletados
 * (audit trail ISO 15189:2022). Para "corrigir" um evento, registra-se um
 * novo evento; histórico fica preservado.
 *
 * Volume esperado: ~50-100 eventos/mês por lab. Carregamos todos no cliente
 * e fazemos as range queries in-memory — Firestore composite indexes ficam
 * desnecessários nesta escala. Quando passar de ~10k eventos por lab,
 * migrar para query server-side com índice (unidadeCode, equipmentId, examCodeNum).
 */

import {
  addDoc,
  collection,
  db,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from '../../../shared/services/firebase';
import type {
  TraceabilityEvent,
  TraceabilityEventType,
  TraceabilitySnapshot,
} from '../../../types';

// ─── Path helpers ─────────────────────────────────────────────────────────────

const colEvents = (labId: string) => collection(db, 'labs', labId, 'traceability-events');

// ─── Snapshot mapping ─────────────────────────────────────────────────────────

interface EventSnapshot {
  tenantId: string;
  unidadeCode: string;
  equipmentId: string;
  type: TraceabilityEventType;
  examCodeAtChange: string;
  examCodeNum: number;
  timestamp: Timestamp;
  payload: TraceabilityEvent['payload'];
  registeredBy: string;
  registeredAt: Timestamp;
}

function mapSnapshot(id: string, data: EventSnapshot): TraceabilityEvent {
  return {
    id,
    tenantId: data.tenantId,
    unidadeCode: data.unidadeCode,
    equipmentId: data.equipmentId,
    type: data.type,
    examCodeAtChange: data.examCodeAtChange,
    examCodeNum: data.examCodeNum,
    timestamp: data.timestamp.toDate(),
    payload: data.payload ?? {},
    registeredBy: data.registeredBy,
    registeredAt: data.registeredAt.toDate(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Real-time subscription a todos os eventos de rastreabilidade do lab,
 * ordenados por examCodeNum DESC (mais recentes primeiro). Caller pode
 * filtrar por unidadeCode/equipmentId/type in-memory.
 */
export function subscribeEvents(
  labId: string,
  onChange: (events: TraceabilityEvent[]) => void,
): () => void {
  const q = query(colEvents(labId), orderBy('examCodeNum', 'desc'));
  return onSnapshot(q, (snap) => {
    const events = snap.docs.map((d) => mapSnapshot(d.id, d.data() as EventSnapshot));
    onChange(events);
  });
}

export interface AddEventInput {
  tenantId: string;
  unidadeCode: string;
  equipmentId: string;
  type: TraceabilityEventType;
  /** Ex: '0107036' — preserva zero-padding do LIS. */
  examCodeAtChange: string;
  timestamp?: Date;
  payload: TraceabilityEvent['payload'];
  registeredBy: string;
}

/**
 * Adiciona um evento ao log. Computa `examCodeNum` automaticamente a partir
 * de `examCodeAtChange`. Throws se o código não for parseável como número.
 */
export async function addEvent(labId: string, input: AddEventInput): Promise<string> {
  const examCodeNum = Number.parseInt(input.examCodeAtChange.replace(/\D/g, ''), 10);
  if (!Number.isFinite(examCodeNum) || examCodeNum < 0) {
    throw new Error(
      `Código de atendimento inválido: "${input.examCodeAtChange}". Forneça apenas dígitos.`,
    );
  }

  const docData = {
    tenantId: input.tenantId,
    unidadeCode: input.unidadeCode.toUpperCase().trim(),
    equipmentId: input.equipmentId,
    type: input.type,
    examCodeAtChange: input.examCodeAtChange.trim(),
    examCodeNum,
    timestamp: input.timestamp ? Timestamp.fromDate(input.timestamp) : serverTimestamp(),
    payload: input.payload,
    registeredBy: input.registeredBy,
    registeredAt: serverTimestamp(),
  };

  const ref = await addDoc(colEvents(labId), docData);
  return ref.id;
}

// ─── Range query (pure function) ──────────────────────────────────────────────

/**
 * Resolve a condição vigente em um determinado código de atendimento.
 * Para cada tipo, retorna o evento mais recente com `examCodeNum <= queryNum`
 * e o próximo evento (que define o fim da vigência).
 *
 * Pure function — não toca Firestore. Caller passa `events` já carregados.
 *
 * @param events  Lista de eventos do lab (qualquer ordem).
 * @param unidadeCode  Filtro de unidade (ex: 'CTL').
 * @param equipmentId  Filtro de equipamento.
 * @param queryExamCode  Código de atendimento a consultar (ex: '0107028').
 */
export function resolveTraceability(
  events: TraceabilityEvent[],
  unidadeCode: string,
  equipmentId: string,
  queryExamCode: string,
): TraceabilitySnapshot {
  const queryExamNum = Number.parseInt(queryExamCode.replace(/\D/g, ''), 10);
  const normalizedUnidade = unidadeCode.toUpperCase().trim();

  const scoped = events.filter(
    (e) => e.unidadeCode === normalizedUnidade && e.equipmentId === equipmentId,
  );

  function lastBefore(type: TraceabilityEventType): TraceabilityEvent | null {
    let best: TraceabilityEvent | null = null;
    for (const e of scoped) {
      if (e.type !== type) continue;
      if (e.examCodeNum > queryExamNum) continue;
      if (!best || e.examCodeNum > best.examCodeNum) best = e;
    }
    return best;
  }

  function firstAfter(type: TraceabilityEventType): TraceabilityEvent | null {
    let best: TraceabilityEvent | null = null;
    for (const e of scoped) {
      if (e.type !== type) continue;
      if (e.examCodeNum <= queryExamNum) continue;
      if (!best || e.examCodeNum < best.examCodeNum) best = e;
    }
    return best;
  }

  return {
    unidadeCode: normalizedUnidade,
    equipmentId,
    queryExamCode,
    queryExamNum,
    reagentChange: lastBefore('reagent_change'),
    controlRun: lastBefore('control_run'),
    calibration: lastBefore('calibration'),
    maintenance: lastBefore('maintenance'),
    nextReagentChange: firstAfter('reagent_change'),
    nextControlRun: firstAfter('control_run'),
  };
}
