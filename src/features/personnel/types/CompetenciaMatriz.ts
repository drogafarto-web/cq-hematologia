/**
 * personnel/types/CompetenciaMatriz.ts
 *
 * Matriz de Competências Técnicas — DICQ 5.1.4 + ISO 15189:2022 6.2.3
 *
 * Mapeia Colaborador × (Analito | Equipamento | Procedimento) com nível de habilitação.
 * Firestore path: `personnel/{labId}/competencias/{id}`
 *
 * RN-06: soft-delete only (nunca deleteDoc).
 */

import type { Timestamp } from '../../../shared/services/firebase';

// ─── Enums ───────────────────────────────────────────────────────────────────

export type CategoriaCompetencia = 'analito' | 'equipamento' | 'procedimento';

export type NivelCompetencia = 'nao_habilitado' | 'em_treinamento' | 'habilitado' | 'especialista';

export const NIVEL_LABEL: Record<NivelCompetencia, string> = {
  nao_habilitado: 'Não habilitado',
  em_treinamento: 'Em treinamento',
  habilitado: 'Habilitado',
  especialista: 'Especialista',
};

export const NIVEL_ORDER: Record<NivelCompetencia, number> = {
  nao_habilitado: 0,
  em_treinamento: 1,
  habilitado: 2,
  especialista: 3,
};

export const CATEGORIA_LABEL: Record<CategoriaCompetencia, string> = {
  analito: 'Analito',
  equipamento: 'Equipamento',
  procedimento: 'Procedimento',
};

// ─── Entity ──────────────────────────────────────────────────────────────────

export interface CompetenciaTecnica {
  readonly id: string;
  readonly labId: string;
  readonly colaboradorId: string;
  readonly colaboradorNome: string;
  readonly categoria: CategoriaCompetencia;
  /** ID do item (analito, equipamento ou POP). String livre quando não há FK. */
  readonly itemId: string;
  readonly itemNome: string;
  readonly nivel: NivelCompetencia;
  /** FK opcional para AvaliacaoCompetencia em educacao-continuada. */
  readonly avaliacaoCompetenciaId?: string;
  readonly dataUltimaAvaliacao?: Timestamp;
  readonly dataProximaAvaliacao?: Timestamp;
  /** Texto livre ou URL de evidência documental. */
  readonly evidencia?: string;
  readonly criadoEm: Timestamp;
  readonly updatedAt: Timestamp;
  readonly deletadoEm: Timestamp | null;
}

export type CompetenciaTecnicaInput = Omit<
  CompetenciaTecnica,
  'id' | 'labId' | 'criadoEm' | 'updatedAt' | 'deletadoEm'
>;
