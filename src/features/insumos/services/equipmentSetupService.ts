/**
 * equipmentSetupService — setup atual do equipamento por módulo.
 *
 * Cada módulo (`hematologia`, `coagulacao`, `uroanalise`, `imunologia`) tem
 * um doc em `/labs/{labId}/equipment-setups/{module}` com os slots do insumo
 * reagente/controle/tira-uro atualmente em uso no equipamento. A corrida
 * assume esses valores implicitamente — o operador só confirma, não seleciona.
 *
 * Mudança de slot é atômica (writeBatch) com:
 *   1. Update do doc de setup (slot + updatedAt/By).
 *   2. Incremento de `activationsCount` no insumo que virou ativo.
 *   3. Registro em `/insumo-transitions/{id}` imutável.
 *
 * Falha em qualquer etapa aborta todas. Piloto Fase A — 2026-04-21.
 *
 * @see ./insumoTransitionService.ts
 * @see ../types/EquipmentSetup.ts
 */

import {
  db,
  doc,
  writeBatch,
  getDoc,
  onSnapshot,
  serverTimestamp,
  increment,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import {
  COLLECTIONS,
  SUBCOLLECTIONS,
  DEFAULT_EQUIPAMENTO_POR_MODULO,
} from '../../../constants';
import type { InsumoModulo } from '../types/Insumo';
import type { EquipmentSetup, EquipmentSetupSlot } from '../types/EquipmentSetup';
import type { InsumoTransitionType } from '../types/InsumoTransition';
import { stageTransition } from './insumoTransitionService';

// ─── Path helpers ────────────────────────────────────────────────────────────

/**
 * Setup doc reference. Em Fase A (pré-2026-04-21 à tarde) o docId era o módulo
 * ('hematologia', ...). Na Fase D (2º turno) o docId passa a ser o equipamentoId.
 * Caller escolhe qual identificador passar — path é idêntico.
 */
function setupRef(labId: string, setupDocId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.EQUIPMENT_SETUPS, setupDocId);
}

function insumoRef(labId: string, insumoId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMOS, insumoId);
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Fetch one-shot — retorna `null` se o setup ainda não existe para o módulo
 * (primeiro uso em um lab novo). Caller cria via `setActiveInsumo`.
 *
 * Legado (Fase A): docId = module. Para Fase D use `getEquipmentSetupById`.
 */
export async function getEquipmentSetup(
  labId: string,
  module: InsumoModulo,
): Promise<EquipmentSetup | null> {
  return getEquipmentSetupById(labId, module);
}

/**
 * Fase D (2026-04-21 — 2º turno): setup por equipamentoId. Alias tipado
 * chamando o mesmo `setupRef` do legado — mesma coleção, docId diferente.
 */
export async function getEquipmentSetupById(
  labId: string,
  setupDocId: string,
): Promise<EquipmentSetup | null> {
  try {
    const snap = await getDoc(setupRef(labId, setupDocId));
    if (!snap.exists()) return null;
    return snap.data() as EquipmentSetup;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Assinatura em tempo real do setup. Banner persistente nas telas de corrida
 * (EquipmentSetupBar) consome isso — precisa refletir troca em tempo real.
 *
 * Legado (Fase A): docId = module. Para Fase D use `subscribeToSetupById`.
 */
export function subscribeToEquipmentSetup(
  labId: string,
  module: InsumoModulo,
  onData: (setup: EquipmentSetup | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return subscribeToSetupById(labId, module, onData, onError);
}

/** Fase D: subscription por docId explícito (equipamentoId OU module legado). */
export function subscribeToSetupById(
  labId: string,
  setupDocId: string,
  onData: (setup: EquipmentSetup | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    setupRef(labId, setupDocId),
    (snap) => {
      onData(snap.exists() ? (snap.data() as EquipmentSetup) : null);
    },
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

// ─── Write ───────────────────────────────────────────────────────────────────

export interface SetActiveInsumoInput {
  module: InsumoModulo;
  slot: EquipmentSetupSlot;
  /** `null` apaga o slot. Raro mas suportado. */
  newInsumoId: string | null;
  operadorId: string;
  operadorName: string;
  /**
   * Justificativa obrigatória em `correction` e `override-*`. Opcional em
   * `activation` e `swap` — mas recomendada para compliance forte.
   */
  motivo?: string;
  /**
   * Default: `'activation'` se slot estava vazio, `'swap'` caso contrário.
   * Caller sobrescreve para marcar `correction` ou `override-*` (Fase B).
   */
  type?: InsumoTransitionType;
  /**
   * Opcional. Quando fornecido, substitui o nome default do catálogo.
   * Útil quando o lab quer customizar ("Yumizen H550 — Sala 2") ou quando
   * o módulo está sendo setupado pela primeira vez e o lab já quer definir
   * o apelido do equipamento.
   */
  equipamentoName?: string;
  /**
   * Fase D (2026-04-21 — 2º turno): ID do equipamento ao qual este setup
   * pertence. Quando fornecido, o docId do setup passa a ser `equipamentoId`
   * (permite N equipamentos por módulo). Quando omitido, mantém o docId
   * legado (== module) — backward-compat com código pré-Fase D.
   */
  equipamentoId?: string;
}

/**
 * Troca o insumo ativo de um slot + registra transição + incrementa
 * `activationsCount` do insumo novo. Atômico via writeBatch.
 *
 * Cria o doc de setup se ainda não existir (primeiro uso do módulo no lab),
 * populando `equipamentoName` com o default do catálogo ou o custom fornecido.
 *
 * @returns ID da transição criada.
 */
export async function setActiveInsumo(
  labId: string,
  input: SetActiveInsumoInput,
): Promise<string> {
  try {
    const batch = writeBatch(db);
    // Fase D: se equipamentoId foi passado, usa como docId; senão mantém legado = module.
    const setupDocId = input.equipamentoId ?? input.module;
    const ref = setupRef(labId, setupDocId);
    const existing = await getDoc(ref);
    const prev = existing.exists() ? (existing.data() as EquipmentSetup) : null;

    const fromInsumoId = prev?.[input.slot] ?? null;
    const toInsumoId = input.newInsumoId;

    if (fromInsumoId === toInsumoId) {
      throw new Error('Insumo já é o ativo neste slot.');
    }

    // Guard de abertura — lote fechado/vencido/descartado ou sem dataAbertura
    // não pode ser ativado num equipamento. Regra regulatória (RDC 786 art. 42)
    // e operacional: sem timestamp formal de abertura, a cadeia de estabilidade
    // pós-abertura é irrecuperável. Guard vive aqui pra manter o invariante
    // single-path — qualquer caller (UI, script, import) passa por esta função.
    if (toInsumoId) {
      const insumoSnap = await getDoc(insumoRef(labId, toInsumoId));
      if (!insumoSnap.exists()) {
        throw new Error('Lote não encontrado.');
      }
      const insumo = insumoSnap.data() as { status?: string; dataAbertura?: unknown };
      if (insumo.status === 'vencido' || insumo.status === 'descartado') {
        throw new Error(
          `Lote está ${insumo.status === 'vencido' ? 'vencido' : 'descartado'} — não pode ser ativado.`,
        );
      }
      if (insumo.status === 'fechado' || !insumo.dataAbertura) {
        throw new Error(
          'Lote ainda fechado. Abra o lote (registra a data de abertura) antes de ativar no equipamento.',
        );
      }
    }

    const type =
      input.type ?? (fromInsumoId === null ? 'activation' : 'swap');

    // 1. Setup update — merge preserva slots não afetados. Primeiro write
    //    popula `equipamentoName` a partir do catálogo ou do input.
    const equipamentoDefault = DEFAULT_EQUIPAMENTO_POR_MODULO[input.module];
    const equipamentoName =
      input.equipamentoName ??
      prev?.equipamentoName ??
      equipamentoDefault?.name ??
      input.module;
    const equipamentoModelo = prev?.equipamentoModelo ?? equipamentoDefault?.modelo;

    const setupPatch = {
      module: input.module,
      labId,
      equipamentoName,
      ...(equipamentoModelo && { equipamentoModelo }),
      ...(input.equipamentoId && { equipamentoId: input.equipamentoId }),
      activeReagenteId: prev?.activeReagenteId ?? null,
      activeControleId: prev?.activeControleId ?? null,
      activeTiraUroId: prev?.activeTiraUroId ?? null,
      [input.slot]: toInsumoId,
      updatedAt: serverTimestamp(),
      updatedBy: input.operadorId,
      updatedByName: input.operadorName,
    };

    batch.set(ref, setupPatch, { merge: true });

    // 2. Incrementa activationsCount do insumo novo (se houver).
    //    FieldValue.increment é atômico — seguro mesmo em trocas concorrentes.
    if (toInsumoId) {
      batch.update(insumoRef(labId, toInsumoId), {
        activationsCount: increment(1),
      });
    }

    // 3. Transition log — enfileirada no mesmo batch.
    const transitionId = stageTransition(batch, labId, {
      module: input.module,
      slot: input.slot,
      fromInsumoId,
      toInsumoId,
      type,
      ...(input.motivo !== undefined && { motivo: input.motivo }),
      operadorId: input.operadorId,
      operadorName: input.operadorName,
    });

    await batch.commit();
    return transitionId;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Transition ')) throw err;
    if (err instanceof Error && err.message === 'Insumo já é o ativo neste slot.') throw err;
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
