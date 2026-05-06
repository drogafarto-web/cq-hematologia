/**
 * RCA (Root Cause Analysis) Types
 *
 * Structured 5 Whys implementation per DICQ 4.14.1 requirement.
 */

import type { Timestamp } from 'firebase/firestore';
import type { RCAFiveWhys, PorquePergunta } from './reclamacao';

/** Validation result for RCA */
export interface RCAValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/** RCA generation heuristic result */
export interface RCAHeuristicResult {
  causaRaizSugerida: string;
  confianca: number;     // 0.0-1.0
}

/** RCA template for guided analysis */
export interface RCATemplate {
  id: string;
  labId: string;
  nome: string;
  tipoReclamacao: string; // which complaint types does this apply to?
  perguntasModelo: {
    nivel: 1 | 2 | 3 | 4 | 5;
    pergunta: string;
    dicas?: string[];
  }[];
  createdAt: Timestamp;
}

/** Exported utility functions for RCA engine */
export interface RCAEngine {
  /**
   * Validates RCA 5 Whys structure
   *
   * Requirements:
   * - Minimum 3 levels filled (descending)
   * - Each resposta must be non-empty
   * - causaRaiz must be non-empty
   * - nivel must be sequential
   */
  validateRCA(rca: RCAFiveWhys): RCAValidationResult;

  /**
   * Generates root cause suggestion from answers
   * Simple heuristic: joins last 2 level responses
   */
  generateCausaRaizHeuristic(porques: PorquePergunta[]): RCAHeuristicResult;
}
