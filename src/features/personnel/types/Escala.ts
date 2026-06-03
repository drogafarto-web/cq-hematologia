/**
 * personnel/types/Escala.ts
 *
 * Tipos para Escala de Trabalho / Cobertura RT (Point 6).
 * Firestore path: `personnel/{labId}/escalas/{id}`
 * RDC 978 Art. 122 — cobertura RT obrigatória.
 */

import type { Timestamp } from '../../../shared/services/firebase';

export type Turno = 'manha' | 'tarde' | 'noite' | 'integral';

export interface EscalaColaborador {
  readonly id: string;
  readonly nome: string;
  readonly cargo: string;
}

export interface EscalaDiaria {
  readonly id: string;
  readonly labId: string;
  readonly data: Timestamp;
  readonly turno: Turno;
  readonly colaboradores: EscalaColaborador[];
  readonly rtPresente: boolean;
  readonly rtSubstitutoPresente: boolean;
  readonly observacoes?: string;
  readonly criadoEm: Timestamp;
  readonly updatedAt: Timestamp;
  readonly deletadoEm: Timestamp | null;
}

export type EscalaDiariaInput = Omit<
  EscalaDiaria,
  'id' | 'labId' | 'criadoEm' | 'updatedAt' | 'deletadoEm'
>;

export const TURNO_LABEL: Record<Turno, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  integral: 'Integral',
};
