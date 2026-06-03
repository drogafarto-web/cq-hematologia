import type { VHSStatus, VHSMetodo } from '../types/VHSExam';

/** Tolerancia fixa entre leitura 1 e leitura 2 (mm/h) � RDC 786 + boas praticas */
export const VHS_TOLERANCIA_MM_H = 3;

/** Status validos em transicoes de maquinas de estado */
export const VHS_STATUS_TRANSITIONS: Record<VHSStatus, VHSStatus[]> = {
  pendente: ['liberado', 'divergente', 'cancelado'],
  divergente: ['liberado', 'cancelado'],
  liberado: [], // imutavel
  cancelado: [], // imutavel
};

/** Limite de exibicao na lista */
export const VHS_LIST_LIMIT = 50;

/** Metodos suportados */
export const VHS_METODOS: { value: VHSMetodo; label: string; description: string }[] = [
  {
    value: 'westergren',
    label: 'Westergren',
    description: 'Metodo de referencia � tubo de 200mm, citrato 1:4',
  },
  {
    value: 'automatizado',
    label: 'Automatizado',
    description: 'Equipamento dedicado (ex: Ves-Matic, Test 1)',
  },
];

/** Referencia para adulto (para UI, NAO regra de CIQ) */
export const VHS_REF_ADULTO = { min: 0, max: 20, unit: 'mm/1� hora' };
