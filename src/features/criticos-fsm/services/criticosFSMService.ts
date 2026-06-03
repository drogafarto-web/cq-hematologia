/**
 * criticosFSMService.ts — Phase 10 (MP-4)
 *
 * Transactional state machine logic for critical value cases.
 * Multi-tenant: `/labs/{labId}/criticos-fsm-cases/{caseId}`
 * Soft-delete only (RN-06).
 * History is append-only post-CRITICO (immutability invariant).
 */

import {
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  runTransaction,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type {
  CriticoCase,
  CriticoFSMState,
  CriticoTransitionEvent,
  FSMTransitionRecord,
} from '../types';
import { isValidStateTransition, getNextState } from '../types';
import { getFSMConfig } from '../config/thresholdsConfig';

// ─── Local hash helper ────────────────────────────────────────────────────

async function sha256Hex(payload: string): Promise<string> {
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Paths ────────────────────────────────────────────────────────────────

const casesCol = (labId: string): CollectionReference =>
  collection(db, 'labs', labId, 'criticos-fsm-cases');

const caseDoc = (labId: string, caseId: string): DocumentReference => doc(casesCol(labId), caseId);

const historyCol = (labId: string, caseId: string): CollectionReference =>
  collection(caseDoc(labId, caseId), 'history');

// ─── Mapping snapshot → entity ─────────────────────────────────────────────

function mapCriticoCaseDocument(snap: QueryDocumentSnapshot): CriticoCase {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId,
    resultId: d.resultId,
    analitoId: d.analitoId,
    currentState: d.currentState as CriticoFSMState,
    history: d.history ?? [],
    detectedAt: d.detectedAt,
    resolvedAt: d.resolvedAt ?? null,
    slaTargetMs: d.slaTargetMs,
    slaBreached: d.slaBreached ?? false,
    criadoEm: d.criadoEm,
    criadoPor: d.criadoPor,
    deletadoEm: d.deletadoEm,
  };
}

// ─── Create Case ──────────────────────────────────────────────────────────

/**
 * Create a new critical value case.
 * Initializes with NORMAL state and immediately performs detect transition to CRITICO.
 * Returns caseId.
 */
export async function createCase(
  labId: string,
  input: {
    resultId: string;
    analitoId: string;
    valor: number;
    detectedAt: number;
    slaTargetMs?: number;
    criadoPor: string;
  },
): Promise<string> {
  const config = await getFSMConfig(labId);
  const slaTargetMs = input.slaTargetMs ?? config.slaTargetMs;

  const ref = doc(casesCol(labId));
  const now = Date.now();
  const userId = input.criadoPor;

  // Generate signature for detect event
  const detectEvent: CriticoTransitionEvent = {
    type: 'detect',
    detectedAt: input.detectedAt,
    valor: input.valor,
    analitoId: input.analitoId,
  };

  const signatureHash = await sha256Hex(
    JSON.stringify({
      from: 'NORMAL',
      to: 'CRITICO',
      event: detectEvent,
      at: now,
      operatorId: userId,
    }),
  );
  const signature = { hash: signatureHash, operatorId: userId, ts: now };

  const record: FSMTransitionRecord = {
    from: 'NORMAL',
    to: 'CRITICO',
    at: now,
    event: detectEvent,
    operatorId: userId,
    signature,
    immutable: true, // CRITICO state is immutable
  };

  await setDoc(ref, {
    labId,
    resultId: input.resultId,
    analitoId: input.analitoId,
    currentState: 'CRITICO',
    history: [record],
    detectedAt: input.detectedAt,
    resolvedAt: null,
    slaTargetMs,
    slaBreached: false,
    criadoEm: now,
    criadoPor: userId,
  } as Omit<CriticoCase, 'id' | 'deletadoEm'>);

  return ref.id;
}

// ─── Transition ───────────────────────────────────────────────────────────

/**
 * Transition a case to a new state via event.
 * Uses runTransaction for atomicity.
 * Validates transition rules.
 * Appends immutable record post-CRITICO.
 * Returns newState + appended record.
 */
export async function transition(
  labId: string,
  caseId: string,
  event: CriticoTransitionEvent,
): Promise<{ newState: CriticoFSMState; record: FSMTransitionRecord }> {
  const config = await getFSMConfig(labId);

  const result = await runTransaction(db, async (txn) => {
    const ref = caseDoc(labId, caseId);
    const snap = await txn.get(ref);

    if (!snap.exists()) {
      throw new Error(`Case not found: ${caseId}`);
    }

    const caseData = snap.data() as Omit<CriticoCase, 'id'>;
    const currentState = caseData.currentState;

    // Compute next state
    const nextState = getNextState(currentState, event);

    if (!nextState || !isValidStateTransition(currentState, nextState)) {
      throw new Error(
        `Invalid transition: ${currentState} -> ${nextState} for event ${event.type}`,
      );
    }

    const now = Date.now();
    const operatorId =
      event.type === 'alert'
        ? 'system' // cron/callable auto-escalation
        : event.type === 'acknowledge'
          ? event.userId
          : event.type === 'resolve'
            ? event.userId
            : 'unknown';

    // Generate signature
    const signatureHash = await sha256Hex(
      JSON.stringify({
        from: currentState,
        to: nextState,
        event,
        at: now,
        operatorId,
      }),
    );
    const signature = { hash: signatureHash, operatorId, ts: now };

    // Create transition record
    const record: FSMTransitionRecord = {
      from: currentState,
      to: nextState,
      at: now,
      event,
      operatorId,
      signature,
      immutable: nextState === 'CRITICO' || nextState === 'ALERTADO' || nextState === 'RESOLVIDO',
    };

    // Compute SLA breach: if transitioning from CRITICO to ALERTADO
    let slaBreached = caseData.slaBreached;
    if (currentState === 'CRITICO' && nextState === 'ALERTADO' && event.type === 'alert') {
      const elapsedMs = event.alertedAt - caseData.detectedAt;
      slaBreached = elapsedMs > caseData.slaTargetMs;
    }

    // Update case state
    const historyArray = [...caseData.history, record];
    const historyToStore = historyArray.slice(-50); // keep last 50 in-document

    txn.update(ref, {
      currentState: nextState,
      history: historyToStore,
      slaBreached,
      resolvedAt: nextState === 'RESOLVIDO' ? now : caseData.resolvedAt,
    });

    // Also append to /history subcollection for full audit trail
    if (record.immutable) {
      const historyRef = doc(historyCol(labId, caseId));
      txn.set(historyRef, record);
    }

    return { newState: nextState, record };
  });

  return result;
}

// ─── Subscribe Case ────────────────────────────────────────────────────────

/**
 * Real-time subscription to a single case.
 * Returns unsubscribe callback.
 */
export function subscribeCase(
  labId: string,
  caseId: string,
  callback: (c: CriticoCase | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const ref = caseDoc(labId, caseId);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
      } else {
        callback(mapCriticoCaseDocument(snap as QueryDocumentSnapshot));
      }
    },
    (err) => {
      if (onError) onError(new Error(`Subscribe error: ${err.message}`));
    },
  );
}

// ─── List Cases ────────────────────────────────────────────────────────────

export interface ListCasesFilter {
  state?: CriticoFSMState;
  from?: number;
  to?: number;
}

/**
 * List all cases in the lab with optional filtering.
 * Paginated client-side (assumes ≤500 docs per lab).
 */
export async function listCases(labId: string, filter?: ListCasesFilter): Promise<CriticoCase[]> {
  let q = query(casesCol(labId), orderBy('detectedAt', 'desc'));

  if (filter?.state) {
    q = query(
      casesCol(labId),
      where('currentState', '==', filter.state),
      orderBy('detectedAt', 'desc'),
    );
  }

  const snapshot = await getDocs(q);
  const cases = snapshot.docs.map((snap) => mapCriticoCaseDocument(snap as QueryDocumentSnapshot));

  // Client-side filtering by date range if provided
  if (filter?.from || filter?.to) {
    return cases.filter((c) => {
      if (filter.from && c.detectedAt < filter.from) return false;
      if (filter.to && c.detectedAt > filter.to) return false;
      return true;
    });
  }

  return cases;
}

// ─── Soft Delete ───────────────────────────────────────────────────────────

/**
 * Soft-delete a case (sets deletadoEm timestamp).
 * Only allowed if currentState is NORMAL (not yet escalated).
 */
export async function softDeleteCase(labId: string, caseId: string): Promise<void> {
  const snap = await getDoc(caseDoc(labId, caseId));

  if (!snap.exists()) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const caseData = snap.data() as Omit<CriticoCase, 'id'>;

  if (caseData.currentState !== 'NORMAL') {
    throw new Error(
      `Cannot soft-delete case in ${caseData.currentState} state. Only NORMAL state can be deleted.`,
    );
  }

  await updateDoc(caseDoc(labId, caseId), {
    deletadoEm: Date.now(),
  });
}
