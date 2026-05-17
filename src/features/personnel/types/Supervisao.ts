/**
 * personnel/types/Supervisao.ts
 *
 * Tipos de domínio para Período de Supervisão.
 * RDC 978/2025 Art. 122 + DICQ 4.1.2.7
 */

import type { Timestamp } from '../../../shared/services/firebase';

export type StatusSupervisao = 'em_supervisao' | 'liberado';

export interface SupervisaoRegistro {
  id: string;
  labId: string;
  colaboradorId: string;
  colaboradorNome: string;
  supervisorId: string;
  supervisorNome: string;
  status: StatusSupervisao;
  dataInicioSupervisao: Timestamp;
  dataLiberacao?: Timestamp;
  checklistConcluido: string[];
  checklistTotal: string[];
  observacoes?: string;
  criadoEm: Timestamp;
  updatedAt: Timestamp;
  deletadoEm: Timestamp | null;
}

export type SupervisaoInput = Omit<
  SupervisaoRegistro,
  'id' | 'labId' | 'criadoEm' | 'updatedAt' | 'deletadoEm'
>;
