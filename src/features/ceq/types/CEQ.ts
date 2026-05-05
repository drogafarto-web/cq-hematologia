/**
 * CEQ — Ensaios de Aptidão Externa (External Proficiency Program)
 *
 * CEQ types and interfaces for proficiency testing with Z-score analysis.
 * Integration with NC module for automatic non-conformidade creation when |Z| > 3.
 */

import type { LogicalSignature } from '../../../utils/logicalSignature';

/**
 * CEQParticipacao — Registration in external proficiency program
 * Tracks enrollment in PT provider scheme (e.g., Controllab, EQA provider)
 */
export interface CEQParticipacao {
  id: string;
  labId: string;

  // Proficiency program details
  provedorId: string; // e.g., "controllab", "eqa-provider-x"
  provedorNome: string; // e.g., "Controllab", "BIPEA"
  esquema: string; // e.g., "hematologia-basica", "bioquimica-rotina"

  // Program schedule
  dataInicio: Date;
  dataFim?: Date; // null if ongoing
  frequencia: 'mensal' | 'bimestral' | 'trimestral' | 'anual';

  // Configuration
  analitosParticipados: string[]; // Analyte IDs from 'analitosDisponiveis'
  /**
   * Available analytes the program offers for this laboratory/provider combo.
   * Denormalized to avoid N+1 queries when user selects analytes.
   * Updated on provider/scheme change.
   */
  analitosDisponiveis?: Array<{
    analyteId: string;
    analyteName: string;
  }>;

  // Status
  ativo: boolean;
  suspendoEm?: Date;

  // Audit
  criadoEm: Date;
  criadoPor: string;
  atualizadoEm?: Date;
  atualizadoPor?: string;
  deletadoEm?: Date; // Soft delete per RN-06

  // Signature (ADR 0005 — optional when client-side)
  assinatura?: LogicalSignature;
}

/**
 * CEQAmostra — Sample received from PT provider
 * Represents a single sample in a PT round (e.g., Round 5/2026 Hematologia)
 */
export interface CEQAmostra {
  id: string;
  labId: string;
  ceqParticipacaoId: string;

  // Sample identification
  rodada: number; // e.g., 5 (round number)
  ano: number; // e.g., 2026
  dataRecepcao: Date;

  // Proficiency program reference
  provedorRodadaId?: string; // Provider's round ID if available

  // Status
  status: 'recebida' | 'em_analise' | 'resultado_lancado' | 'processada';

  // Stored when results entered
  dataResultado?: Date;
  resultadoRecebidoEm?: Date;

  // Soft delete
  deletadoEm?: Date;

  // Audit
  criadoEm: Date;
  criadoPor: string;
  atualizadoEm?: Date;
  atualizadoPor?: string;

  // Signature
  assinatura?: LogicalSignature;
}

/**
 * CEQResultado — Result entry for a sample in PT round
 * Links to Amostra and contains Z-score calculation
 */
export interface CEQResultado {
  id: string;
  labId: string;
  ceqAmostraId: string;
  ceqParticipacaoId: string;

  // Analyte measured
  analyteId: string;
  analyteName: string;

  // Value entered by operator
  valorObtido: number;
  unidade: string;

  // Provider reference value (denormalized from provider data)
  valorReferencia: number;
  desvioEstimado: number; // Provider's estimated SD for this analyte/round

  // Z-score calculation
  zScore: number; // (valorObtido - valorReferencia) / desvioEstimado
  /**
   * Interpretation:
   * |Z| < 2: Satisfactory (acceptable)
   * 2 ≤ |Z| < 3: Questionable (warning)
   * |Z| ≥ 3: Unsatisfactory (rejection)
   */
  interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria';

  // Auto-NC creation
  ncAutomaticaCriadaId?: string; // FK to NC if |Z| > 3
  ncAutomaticaCriadaEm?: Date;
  /**
   * When true, indicates a critical NC was automatically created.
   * User must acknowledge this and may need to investigate immediately.
   */
  temNCGrave?: boolean;

  // Optional: manual investigation
  investigacao?: {
    motivo: string;
    realizada: boolean;
    dataInicio: Date;
    dataFim?: Date;
    conclusao?: string;
  };

  // Status
  status: 'lancado' | 'validado' | 'investigado';

  // Audit
  criadoEm: Date;
  criadoPor: string;
  atualizadoEm?: Date;
  atualizadoPor?: string;
  validadoEm?: Date;
  validadoPor?: string;

  // Soft delete
  deletadoEm?: Date;

  // Signature
  assinatura?: LogicalSignature;
}

/**
 * CEQRodada — Summary of a PT round for quick overview
 * Denormalized view for dashboard
 */
export interface CEQRodada {
  id: string;
  labId: string;
  ceqParticipacaoId: string;

  provedorNome: string;
  esquema: string;
  rodada: number;
  ano: number;

  // Aggregate stats
  totalAmostras: number;
  resultadosLancados: number;
  resultadosValidados: number;

  /**
   * Count of unsatisfactory results (|Z| >= 3)
   * Red flag for quality oversight
   */
  resultadosInsatisfatorios: number;

  /**
   * Count of auto-generated critical NCs from this round
   */
  ncsCriticasGeradas: number;

  // Dates
  dataRecepcao: Date;
  dataFechamento?: Date;

  // Status
  ativo: boolean;

  // Metadata
  criadoEm: Date;
  atualizadoEm?: Date;
}

/**
 * Helper type for Z-score API response
 */
export interface ZScoreResult {
  analyteId: string;
  analyteName: string;
  valorObtido: number;
  valorReferencia: number;
  desvioEstimado: number;
  zScore: number;
  interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria';
  bloqueadora: boolean; // true if |Z| >= 3
}

/**
 * Request DTO for creating CEQParticipacao
 */
export type CEQParticipacaoInput = Omit<
  CEQParticipacao,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'atualizadoEm' | 'atualizadoPor' | 'deletadoEm' | 'assinatura'
>;

/**
 * Request DTO for receiving CEQAmostra
 */
export type CEQAmostraInput = Omit<
  CEQAmostra,
  'id' | 'labId' | 'status' | 'criadoEm' | 'criadoPor' | 'atualizadoEm' | 'atualizadoPor' | 'deletadoEm' | 'assinatura'
>;

/**
 * Request DTO for recording CEQResultado
 */
export type CEQResultadoInput = Omit<
  CEQResultado,
  'id' | 'labId' | 'zScore' | 'interpretacao' | 'ncAutomaticaCriadaId' | 'ncAutomaticaCriadaEm' | 'temNCGrave' | 'status' | 'criadoEm' | 'criadoPor' | 'validadoEm' | 'validadoPor' | 'deletadoEm' | 'assinatura'
>;
