import type { LabId, Timestamp } from '../../educacao-continuada/types/_shared_refs';
import type { Categoria, Deteccao, Processo, Probabilidade, Severidade } from './Risk';

/**
 * Template reutilizável para criação de riscos (coleção `/labs/{labId}/risk-templates`).
 * `labId === 'global'` = seeds padrão do sistema.
 */
export interface RiskTemplate {
  readonly id: string;
  readonly labId: LabId | 'global';
  categoria: Categoria;
  processo: Processo;
  titulo: string;
  descricao: string;
  causaPotencial: string;
  efeitoPotencial: string;
  pDefault: Probabilidade;
  sDefault: Severidade;
  dDefault: Deteccao;
  ativo: boolean;
  readonly criadoEm: Timestamp;
}
