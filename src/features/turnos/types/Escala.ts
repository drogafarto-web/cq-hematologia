import type { Timestamp } from './shared_refs';

export type Periodo = 'manha' | 'tarde' | 'noite' | 'integral' | 'plantao';

export const PERIODO_LABEL: Record<Periodo, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  integral: 'Integral',
  plantao: 'Plantão',
};

export interface EscalaColaborador {
  readonly id: string;
  readonly nome: string;
  readonly cargo: string;
}

export interface EscalaDiaria {
  readonly id: string;
  readonly labId: string;
  readonly data: Timestamp;
  readonly periodo: Periodo;
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

export interface EscalaPadraoTurno {
  periodo: Periodo;
  colaboradores: EscalaColaborador[];
  rtPresente: boolean;
  rtSubstitutoPresente: boolean;
}

export interface EscalaPadrao {
  labId: string;
  diasAtivos: number[];
  turnos: EscalaPadraoTurno[];
  updatedAt: Timestamp;
  updatedBy: string;
}
