/**
 * insumoTransitionService — append-only log de trocas de insumo ativo.
 *
 * Cada doc em `/labs/{labId}/insumo-transitions/{transitionId}` representa
 * uma mudança de slot em um `ModuleConfig`. Imutável por design — rules
 * negam update/delete.
 *
 * Não é chamado diretamente pela UI: o `moduleConfigService.setActiveInsumo`
 * orquestra (set config + log transition) atomicamente. Este módulo existe
 * separado pra (a) permitir queries de histórico isoladas e (b) servir de
 * ponto de extensão para override auditado (Fase B).
 *
 * @see ./moduleConfigService.ts
 * @see ../types/InsumoTransition.ts
 */

import {
  db,
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import type { Unsubscribe, WriteBatch } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type {
  InsumoTransition,
  InsumoTransitionType,
} from '../types/InsumoTransition';
import type { InsumoModulo } from '../types/Insumo';
import type { EquipmentSetupSlot } from '../types/EquipmentSetup';

// ─── Path helpers ────────────────────────────────────────────────────────────

function transitionsCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMO_TRANSITIONS);
}

function transitionRef(labId: string, transitionId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMO_TRANSITIONS, transitionId);
}

// ─── Input shape ─────────────────────────────────────────────────────────────

/**
 * Payload fornecido pelo caller. Service deriva `id` e `timestamp` — timestamp
 * vem de servidor para ordenação canônica. `labId` vem do contexto (não
 * confiável se vindo do caller de outro lab, mas rules bloqueiam cross-lab).
 */
export interface TransitionInput {
  module: InsumoModulo;
  slot: EquipmentSetupSlot;
  fromInsumoId: string | null;
  toInsumoId: string | null;
  type: InsumoTransitionType;
  motivo?: string;
  operadorId: string;
  operadorName: string;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Adiciona um batch write que grava o transition. Pattern intencional: o
 * caller (moduleConfigService) decide o batch e commita atômicamente — config
 * update + transition create não podem divergir.
 *
 * @returns ID gerado para o transition (para caller referir em logs).
 */
export function stageTransition(
  batch: WriteBatch,
  labId: string,
  input: TransitionInput,
): string {
  validateInput(input);
  const id = crypto.randomUUID();

  const docData: Omit<InsumoTransition, 'id' | 'timestamp'> & {
    timestamp: ReturnType<typeof serverTimestamp>;
  } = {
    labId,
    module: input.module,
    slot: input.slot,
    fromInsumoId: input.fromInsumoId,
    toInsumoId: input.toInsumoId,
    type: input.type,
    ...(input.motivo !== undefined && { motivo: input.motivo }),
    operadorId: input.operadorId,
    operadorName: input.operadorName,
    timestamp: serverTimestamp(),
  };

  batch.set(transitionRef(labId, id), docData);
  return id;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validação estrutural dos inputs — rules fazem o mesmo no servidor mas falhar
 * cedo no cliente dá erro melhor. `correction` e todo `override-*` exigem
 * motivo — desalinhamento com a Fase B dificulta refactor depois.
 *
 * Exportada para que testes unitários validem sem mockar Firestore.
 */
export function validateTransitionInput(input: TransitionInput): void {
  const requiresMotivo =
    input.type === 'correction' ||
    input.type === 'override-vencido' ||
    input.type === 'override-qc-pendente';

  if (requiresMotivo && (!input.motivo || !input.motivo.trim())) {
    throw new Error(`Transition tipo "${input.type}" exige motivo.`);
  }

  if (input.type === 'activation' && input.fromInsumoId !== null) {
    throw new Error('Transition "activation" deve ter fromInsumoId=null.');
  }
}

function validateInput(input: TransitionInput): void {
  return validateTransitionInput(input);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Assinatura em tempo real às últimas N transições de um módulo. Usado por
 * telas de auditoria (futura: aba Rastreabilidade). Ordem decrescente por
 * timestamp — mais recente primeiro.
 */
export function subscribeToTransitions(
  labId: string,
  params: { module?: InsumoModulo; maxResults?: number },
  onData: (transitions: InsumoTransition[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const constraints = [];
  if (params.module) constraints.push(where('module', '==', params.module));
  constraints.push(orderBy('timestamp', 'desc'));
  if (params.maxResults) constraints.push(limit(params.maxResults));

  const q = query(transitionsCol(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map(
          (d) =>
            ({ id: d.id, ...(d.data() as Omit<InsumoTransition, 'id'>) }) as InsumoTransition,
        ),
      );
    },
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

/**
 * One-shot fetch — útil para relatórios que rodam fora da UI reativa.
 */
export async function getTransitions(
  labId: string,
  params: { module?: InsumoModulo; maxResults?: number },
): Promise<InsumoTransition[]> {
  try {
    const constraints = [];
    if (params.module) constraints.push(where('module', '==', params.module));
    constraints.push(orderBy('timestamp', 'desc'));
    if (params.maxResults) constraints.push(limit(params.maxResults));

    const snap = await getDocs(query(transitionsCol(labId), ...constraints));
    return snap.docs.map(
      (d) =>
        ({ id: d.id, ...(d.data() as Omit<InsumoTransition, 'id'>) }) as InsumoTransition,
    );
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
