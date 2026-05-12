/**
 * Registro de uso de equipamento (operador + janela de tempo).
 *
 * Firestore: `/labs/{labId}/equipamentos/{equipamentoId}/usos/{id}`
 */

import type { Timestamp } from 'firebase/firestore';

export interface EquipamentoUso {
  id: string;
  labId: string;
  equipamentoId: string;
  operadorId: string;
  operadorNome: string;
  inicio: Timestamp;
  fim?: Timestamp;
  observacoes?: string;
  criadoEm: Timestamp;
}
