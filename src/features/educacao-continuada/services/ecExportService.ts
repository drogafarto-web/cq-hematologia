/**
 * ecExportService.ts
 *
 * Helpers para exportação/impressão dos formulários regulatórios:
 *   FR-001 (execução), FR-013 (ação corretiva), FR-027 (planejamento).
 *
 * Render + disparo da impressão ficam no componente ECRelatorioPrint via
 * `react-to-print` (mesmo padrão do módulo Uroanálise). Este service só
 * expõe os tipos de payload e helpers de formatação reutilizáveis.
 */

import type {
  AvaliacaoCompetencia,
  AvaliacaoEficacia,
  Colaborador,
  Execucao,
  Treinamento,
} from '../types/EducacaoContinuada';
import type { Timestamp } from '../types/_shared_refs';

export type TipoRelatorio = 'FR-001' | 'FR-013' | 'FR-027';

export interface ParticipanteRelatorio {
  colaborador: Colaborador;
  presente: boolean;
}

export interface RelatorioFR001 {
  tipo: 'FR-001';
  execucao: Execucao;
  treinamento: Treinamento;
  participantes: ParticipanteRelatorio[];
  avaliacaoEficacia: AvaliacaoEficacia | null;
  /**
   * Avaliações individuais de competência (ISO 15189:2022 cl. 6.2.4) já
   * filtradas pela execucaoId. Caller resolve o set completo — o layout
   * imprime "Pendente" para participantes presentes sem registro.
   */
  avaliacoesCompetencia: AvaliacaoCompetencia[];
}

export interface RelatorioFR013 {
  tipo: 'FR-013';
  avaliacaoEficacia: AvaliacaoEficacia;
  execucao: Execucao;
  treinamento: Treinamento;
}

export interface RelatorioFR027 {
  tipo: 'FR-027';
  treinamentos: Treinamento[];
  periodoInicio: Timestamp;
  periodoFim: Timestamp;
}

export type RelatorioPayload = RelatorioFR001 | RelatorioFR013 | RelatorioFR027;

/** Formata Timestamp como `dd/mm/aaaa` pt-BR. Usado pelos layouts de relatório. */
export function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR');
}

/** Formata Timestamp como `dd/mm/aaaa hh:mm` pt-BR. Usado em assinaturas. */
export function formatDateTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString('pt-BR');
}
