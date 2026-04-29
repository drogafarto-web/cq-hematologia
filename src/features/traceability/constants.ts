/**
 * Constantes da feature de rastreabilidade.
 *
 * TODO(fase-2): mover para config por tenant em `labs/{id}/settings/traceability`
 * para suportar múltiplas unidades arbitrárias e múltiplos equipamentos.
 */

export interface Unidade {
  code: string;
  label: string;
}

export const UNIDADES: ReadonlyArray<Unidade> = [
  { code: 'CTL', label: 'Controle (matriz)' },
  { code: 'SIL', label: 'Silvestre' },
  { code: 'GUA', label: 'Guarani' },
  { code: 'MRC', label: 'Mercês' },
];

export const DEFAULT_UNIDADE_CODE = UNIDADES[0].code;

export const DEFAULT_EQUIPMENT_ID = 'yumizen-h550';
export const DEFAULT_EQUIPMENT_LABEL = 'Yumizen H550';
