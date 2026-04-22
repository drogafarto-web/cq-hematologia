/**
 * Usabilidade de insumo — decidir se um insumo está apto para uso numa
 * corrida, e classificar o motivo quando não estiver.
 *
 * Central pra Fase B1 (2026-04-21): é o que o submit da corrida consulta pra
 * decidir se bloqueia, ou abre o modal de override.
 *
 * Puro, sem IO. Alimentado pelo snapshot do EquipmentSetup no momento do save.
 */

import { validadeStatus } from './validadeReal';
import { hasQCValidationPending } from '../types/Insumo';
import type { Insumo } from '../types/Insumo';

export type InsumoBloqueioMotivo =
  | 'vencido'
  | 'qc-pendente'
  | 'imuno-nao-aprovado'
  | 'descartado';

export interface InsumoUsabilidade {
  /** true quando livre pra uso sem override. */
  ok: boolean;
  /** Motivo do bloqueio — uma única razão (a mais severa ganha). */
  motivo?: InsumoBloqueioMotivo;
  /** Copy curta pt-BR pra exibir ao usuário. */
  mensagem?: string;
}

/**
 * Avalia usabilidade de um insumo pra uma corrida. Ordem de severidade:
 *   1. descartado → sempre bloqueio
 *   2. vencido → bloqueio (override-vencido possível)
 *   3. imuno-nao-aprovado → bloqueio (override-qc-pendente possível)
 *   4. qc-pendente (reagente recém-aberto) → bloqueio (override-qc-pendente)
 */
export function evaluateInsumoUsability(insumo: Insumo): InsumoUsabilidade {
  if (insumo.status === 'descartado') {
    return {
      ok: false,
      motivo: 'descartado',
      mensagem: `Este insumo foi descartado (${insumo.motivoDescarte ?? 'sem motivo'}). Selecione outro.`,
    };
  }

  const v = validadeStatus(insumo.validadeReal.toDate());
  if (v === 'expired') {
    return {
      ok: false,
      motivo: 'vencido',
      mensagem: 'Insumo vencido. Necessário override com justificativa.',
    };
  }

  // Imuno: qcStatus é o que manda (CQ por lote, não por corrida).
  if (insumo.tipo === 'reagente' && insumo.modulos?.includes('imunologia')) {
    if (insumo.qcStatus === 'reprovado') {
      return {
        ok: false,
        motivo: 'imuno-nao-aprovado',
        mensagem:
          'Lote reprovado no CQ de insumo. Uso só permitido com override auditado.',
      };
    }
    if (insumo.qcStatus !== 'aprovado') {
      return {
        ok: false,
        motivo: 'imuno-nao-aprovado',
        mensagem:
          'Lote sem CQ aprovado ainda. Esta corrida será tratada como validação. Aprovação explícita antes de uso normal.',
      };
    }
    // Aprovado → livre.
    return { ok: true };
  }

  // Demais módulos (Hemato/Coag/Uro): usa qcValidationRequired.
  if (hasQCValidationPending(insumo)) {
    return {
      ok: false,
      motivo: 'qc-pendente',
      mensagem:
        'Reagente/tira recém-aberto sem CQ validado. Override com justificativa liberado pro operador.',
    };
  }

  return { ok: true };
}

/**
 * Mapeia motivo de bloqueio → tipo de InsumoTransition para logar override.
 * Usado pelo caller do modal de override.
 */
export function motivoToTransitionType(
  motivo: InsumoBloqueioMotivo,
): 'override-vencido' | 'override-qc-pendente' {
  if (motivo === 'vencido') return 'override-vencido';
  // qc-pendente, imuno-nao-aprovado, descartado → tratados como qc-pendente
  // (descartado na prática não deveria chegar aqui; rules bloqueiam).
  return 'override-qc-pendente';
}
