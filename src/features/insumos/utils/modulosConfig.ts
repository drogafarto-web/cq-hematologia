/**
 * modulosConfig — requisitos operacionais por módulo de CIQ.
 *
 * Source-of-truth dos requisitos de insumos por módulo ao confirmar uma corrida.
 * Hardcoded por simplicidade: por ora não temos heterogeneidade entre labs que
 * justifique colocar em Firestore. Quando/se um lab precisar relaxar, vira
 * `/labs/{labId}/modulosConfig` — o tipo aqui é estável o suficiente pra
 * preservar contrato.
 *
 * Regra conservadora — minReagentes=1 em todos os módulos com reagentes
 * declaráveis (hemato/coag/uro). Imuno faz CQ por lote e não por corrida, então
 * não exige reagente declarado na run. Aumentar por módulo se o lab consolidar
 * rotina (ex: Yumizen H550 típico consome 3 reagentes — diluente/lise/detergente;
 * elevar pra 3 quando UI tiver confirmação multi-select confortável).
 */
import type { InsumoModulo } from '../types/Insumo';

export interface ModuloRunConfig {
  /** Label humano (para mensagens de erro). */
  label: string;
  /**
   * Mínimo de reagentes/tiras que o operador DEVE declarar em uso na corrida.
   * Zero = módulo não exige declaração (CQ-por-lote).
   */
  minReagentes: number;
}

export const MODULO_RUN_CONFIG: Record<InsumoModulo, ModuloRunConfig> = {
  hematologia: { label: 'Hematologia', minReagentes: 1 },
  coagulacao: { label: 'Coagulação', minReagentes: 1 },
  uroanalise: { label: 'Uroanálise', minReagentes: 1 },
  imunologia: { label: 'Imunologia', minReagentes: 0 },
};
