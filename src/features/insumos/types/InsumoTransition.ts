/**
 * InsumoTransition — registro append-only de troca no Setup do Equipamento.
 *
 * Toda mudança em `/equipment-setups/{module}` gera um doc aqui. Base para:
 *   - Auditoria PALC/RDC 978/2025 — quem trocou o quê, quando e por quê.
 *   - Override auditado (Fase B) — `motivoOverride` + `overrideType` permitem
 *     rodar corrida fora do caminho normal com trilha defensável.
 *   - Linha do tempo do insumo (aba Rastreabilidade) — narrativa auditável
 *     "entrou em [data], virou ativo em [data], saiu em [data]".
 *   - Relatórios cross-lote — correlação entre troca e variação analítica.
 *
 * Firestore path: /labs/{labId}/insumo-transitions/{transitionId}
 * Imutável: rules negam update/delete. Cloud Function pode selar com hash
 * (simétrico a insumo-movimentacoes) em versão futura — por enquanto basta
 * timestamp de servidor.
 */

import type { Timestamp } from 'firebase/firestore';
import type { InsumoModulo } from './Insumo';
import type { EquipmentSetupSlot } from './EquipmentSetup';

/**
 * Tipo da transição — permite filtrar relatórios e, na Fase B, diferenciar
 * troca normal de override auditado.
 */
export type InsumoTransitionType =
  | 'activation'    // primeira vez que um slot é populado (era null)
  | 'swap'          // troca normal: caixa antiga acabou, entrou nova
  | 'correction'    // operador selecionou lote errado, corrigiu em seguida
  | 'override-vencido'   // Fase B — liberou uso de insumo vencido com justificativa
  | 'override-qc-pendente'; // Fase B — liberou uso com CQ pendente

export interface InsumoTransition {
  id: string;
  labId: string;
  module: InsumoModulo;
  /** Qual slot do EquipmentSetup foi afetado. */
  slot: EquipmentSetupSlot;

  /** `null` em `activation` (não havia nada antes). */
  fromInsumoId: string | null;
  /**
   * `null` em "desativação" — limpa slot sem substituir. Raro, mas modelado.
   */
  toInsumoId: string | null;

  type: InsumoTransitionType;

  /**
   * Justificativa textual obrigatória em `correction` e em todo `override-*`.
   * Opcional em `activation` e `swap` normais.
   */
  motivo?: string;

  /** Timestamp de servidor — ordenação canônica. */
  timestamp: Timestamp;

  /** uid + displayName do operador — displayName evita lookup posterior. */
  operadorId: string;
  operadorName: string;
}
