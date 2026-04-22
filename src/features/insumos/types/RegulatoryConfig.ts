/**
 * RegulatoryConfig — referências regulatórias por módulo.
 *
 * Substitui a string fixa "Diária — RDC 302/2005" que misturava frequência
 * operacional com base normativa. A legislação agora vive num array
 * configurável (com defaults razoáveis) e fica separada do campo de frequência.
 *
 * Configurado uma vez em lab-settings por módulo. Lotes e relatórios herdam.
 */

import type { InsumoModulo } from './Insumo';

export interface ModuleRegulatoryConfig {
  /**
   * Lista de referências — strings livres no formato "RDC 786/2023" ou
   * "CLSI EP26-A". Ordem é preservada; admin lab pode reorganizar na UI.
   */
  regulatoryReferences: string[];
}

/**
 * Defaults aplicados quando o lab ainda não configurou explicitamente. Refletem
 * a base normativa brasileira vigente em 2026-04 para cada módulo. Admin do
 * lab pode editar/expandir via tela de lab-settings.
 */
export const DEFAULT_REGULATORY_REFERENCES: Record<InsumoModulo, string[]> = {
  hematologia: ['RDC 786/2023', 'RDC 302/2005'],
  coagulacao: ['RDC 786/2023', 'RDC 302/2005'],
  uroanalise: ['RDC 786/2023', 'CLSI GP16-A3'],
  imunologia: ['RDC 786/2023', 'RDC 978/2025'],
};

/**
 * Resolve referências para um módulo: retorna as configuradas pelo lab OU os
 * defaults quando ausente/vazio. Use este helper em UI e PDF.
 */
export function resolveRegulatoryReferences(
  module: InsumoModulo,
  labOverrides?: Partial<Record<InsumoModulo, ModuleRegulatoryConfig>>,
): string[] {
  const configured = labOverrides?.[module]?.regulatoryReferences;
  if (Array.isArray(configured) && configured.length > 0) return configured;
  return DEFAULT_REGULATORY_REFERENCES[module];
}
