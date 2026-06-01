import type { Timestamp } from 'firebase/firestore';
import type { CoagAnalyteId } from '../../coagulacao/types/_shared_refs';

export interface ControlOperacional {
  id: string;
  labId: string;
  nome: string;
  nivel: 'I' | 'II';
  insumoId: string;
  /** Reagente usado para TTPA (insumoId é o reagente de TP/AP+RNI) */
  reagenteTTPAId?: string;
  equipamentoId: string;
  mean: Record<CoagAnalyteId, number>;
  sd: Record<CoagAnalyteId, number>;
  low?: Record<CoagAnalyteId, number>;
  high?: Record<CoagAnalyteId, number>;
  loteControle: string;
  fabricanteControle: string;
  validadeControle: string;
  status: 'ativo' | 'pausado' | 'aposentado';
  criadoEm: Timestamp;
  criadoPor: string;
  atualizadoEm: Timestamp;
}

export type ControlOperacionalInput = Omit<
  ControlOperacional,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'atualizadoEm'
>;
