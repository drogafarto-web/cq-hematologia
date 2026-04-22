/**
 * EquipmentSetup — setup atual de um equipamento dentro de um lab.
 *
 * Conceito: cada equipamento ativo (Yumizen H550, Micros 60, Cell Dyn etc)
 * tem UM setup persistente com os lotes de reagente/controle/tira em uso
 * naquele momento. A corrida consulta isso implicitamente; o operador
 * apenas confirma na tela ConferenciaInsumoAtivo.
 *
 * Linguagem: "Setup do equipamento", NÃO "configuração de módulo". O
 * vocabulário vai direto pro operador e pro auditor — ambos reconhecem
 * "setup do Yumizen" instantaneamente; "module config" é jargão de engenheiro.
 *
 * Fase A (2026-04-21): docId era o próprio `module` — um setup por módulo.
 * Fase D (2026-04-21, 2º turno): docId passa a ser `equipamentoId`. Um lab
 * pode ter N equipamentos por módulo (Yumizen H550 + Micros 60 + Cell Dyn em
 * hematologia), cada um com seu próprio setup. Backward-compat durante a
 * migração: docs com docId = módulo continuam válidos (useEquipmentSetup
 * legado resolve). A CF `migrateEquipmentSetupsToEquipamentos` reescreve
 * `/equipment-setups/{module}` → `/equipment-setups/{equipamentoId}` +
 * cria o `/equipamentos/{equipamentoId}` correspondente.
 *
 * Firestore path: /labs/{labId}/equipment-setups/{equipamentoId}
 *                 /labs/{labId}/equipment-setups/{module} (legado, transiente)
 */

import type { Timestamp } from 'firebase/firestore';
import type { InsumoModulo } from './Insumo';

export interface EquipmentSetup {
  /** Identificador do módulo — redundante com Equipamento.module, usado em queries. */
  module: InsumoModulo;
  labId: string;

  /**
   * Fase D (2026-04-21): ID do Equipamento ao qual este setup pertence.
   * Ausente em docs legados (pré-Fase D onde docId == module); migração
   * preenche o campo + reescreve o docId. Use como fonte única de verdade
   * ao consumir setups novos.
   */
  equipamentoId?: string;

  /**
   * Nome do equipamento exibido ao operador (ex: "Yumizen H550", "Clotimer Duo").
   * Default vem do catálogo em `constants.ts`, mas pode ser sobrescrito por lab
   * quando o equipamento tem apelido interno ou número de série relevante.
   *
   * Fase D: mantido para UI e backward-compat; pós-migração, consumir via
   * `useEquipamento(equipamentoId)` é preferível.
   */
  equipamentoName: string;

  /**
   * Modelo normalizado do equipamento — útil para relatórios cross-lab
   * ("todos os labs usando H550"). Opcional porque o catálogo inicial cobre
   * só os equipamentos conhecidos.
   */
  equipamentoModelo?: string;

  /**
   * Insumo reagente ativo no equipamento — `null` se módulo não usa reagente
   * declarado (ex: imunologia com tiras prontas) ou se nunca foi configurado.
   */
  activeReagenteId: string | null;

  /** Insumo controle ativo — `null` até primeira configuração. */
  activeControleId: string | null;

  /**
   * Tira de uroanálise ativa — só relevante em `module === 'uroanalise'`.
   * Outros módulos mantêm `null`.
   */
  activeTiraUroId: string | null;

  /** Timestamp de servidor da última troca em qualquer slot. */
  updatedAt: Timestamp;
  updatedBy: string;
  updatedByName: string;
}

/**
 * Slots do EquipmentSetup que referenciam um Insumo. String-tipada para
 * evitar typos em callers.
 */
export type EquipmentSetupSlot =
  | 'activeReagenteId'
  | 'activeControleId'
  | 'activeTiraUroId';
