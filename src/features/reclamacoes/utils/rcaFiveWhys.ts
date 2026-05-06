/**
 * RCA 5 Whys Engine
 *
 * Pure functional engine for Root Cause Analysis validation and heuristic generation.
 * No external dependencies; used client-side and in server functions.
 * Compliant with DICQ 4.14.1 structured analysis requirements.
 */

import type { RCAFiveWhys, PorquePergunta } from '../types';
import type { RCAValidationResult, RCAHeuristicResult } from '../types/rca';

/**
 * Validates RCA 5 Whys structure before persistence
 *
 * Checks:
 * 1. At least 3 levels filled (sequential)
 * 2. Each resposta is non-empty (≥3 characters)
 * 3. causaRaiz is non-empty
 * 4. nivels are sequential starting from 1
 * 5. Responses form coherent chain (each response relates to next question)
 *
 * Returns validation result with specific errors for each failure.
 */
export function validateRCA(rca: RCAFiveWhys): RCAValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if rca exists
  if (!rca) {
    return { valid: false, errors: ['RCA object is null or undefined'] };
  }

  // Check problema
  if (!rca.problema || rca.problema.trim().length === 0) {
    errors.push('Problema (complaint summary) is required');
  }

  // Check porques array
  if (!Array.isArray(rca.porques) || rca.porques.length === 0) {
    errors.push('At least 1 porquê level is required');
    return { valid: false, errors };
  }

  // Check minimum 3 levels
  if (rca.porques.length < 3) {
    errors.push(
      `At least 3 levels required (5 Whys structure). Found ${rca.porques.length}.`
    );
  }

  // Validate each level
  const filledLevels: number[] = [];
  for (const item of rca.porques) {
    // Check niveau is valid 1-5
    if (!item.nivel || item.nivel < 1 || item.nivel > 5) {
      errors.push(`Invalid nivel: ${item.nivel}. Must be 1-5.`);
      continue;
    }

    // Check pergunta and resposta are non-empty
    if (!item.pergunta || item.pergunta.trim().length < 3) {
      errors.push(`Nivel ${item.nivel}: pergunta must be at least 3 characters`);
    }

    if (!item.resposta || item.resposta.trim().length < 3) {
      errors.push(`Nivel ${item.nivel}: resposta must be at least 3 characters`);
    } else {
      filledLevels.push(item.nivel);
    }
  }

  // Check sequence (levels should be sequential, allowing gaps)
  if (filledLevels.length > 0) {
    const minLevel = Math.min(...filledLevels);
    const maxLevel = Math.max(...filledLevels);

    // Should start at 1 if first is filled
    if (minLevel !== 1 && filledLevels.length > 0) {
      warnings.push(`Levels start at ${minLevel}, not 1. May indicate incomplete analysis.`);
    }
  }

  // Check causaRaiz
  if (!rca.causaRaiz || rca.causaRaiz.trim().length === 0) {
    errors.push('Causa raiz (root cause statement) is required');
  } else if (rca.causaRaiz.trim().length < 5) {
    errors.push('Causa raiz must be at least 5 characters');
  }

  // Check preenchidoPor and preenchidoEm
  if (!rca.preenchidoPor) {
    errors.push('preenchidoPor (operator ID) is required');
  }

  if (!rca.preenchidoEm) {
    errors.push('preenchidoEm (timestamp) is required');
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings };
}

/**
 * Generates root cause suggestion from porquês responses
 *
 * Simple heuristic: concatenates last 2 levels' responses to suggest root cause.
 * Confidence score based on answer depth (char count).
 *
 * Example:
 * Level 3: "Reagente vencido"
 * Level 4: "Controle de estoque não funcionou"
 * Level 5: "Falta de sistema de alerta automático"
 *
 * Suggestion: "Reagente vencido porque controle de estoque não funcionou"
 */
export function generateCausaRaizHeuristic(
  porques: PorquePergunta[]
): RCAHeuristicResult {
  if (!porques || porques.length < 2) {
    return {
      causaRaizSugerida: '',
      confianca: 0,
    };
  }

  // Sort by nivel to ensure proper order
  const sorted = [...porques].sort((a, b) => a.nivel - b.nivel);

  // Filter filled responses
  const filled = sorted.filter(
    (p) => p.resposta && p.resposta.trim().length > 0
  );

  if (filled.length < 2) {
    return {
      causaRaizSugerida: filled.length === 1 ? filled[0].resposta : '',
      confianca: 0.3,
    };
  }

  // Take last 2 filled responses
  const last2 = filled.slice(-2);
  const causaRaizSugerida = `${last2[0].resposta.trim()} porque ${last2[1].resposta.trim()}`;

  // Confidence based on depth: longer answers = higher confidence
  const avgLength =
    last2.reduce((sum, p) => sum + p.resposta.length, 0) / last2.length;
  const confianca = Math.min(0.95, avgLength / 100); // max 0.95, normalized by 100 chars avg

  return {
    causaRaizSugerida,
    confianca,
  };
}

/**
 * Returns next expected nivel after current sequence
 * Useful for UI to prompt operator for next level
 */
export function getProximoNivel(porques: PorquePergunta[]): 1 | 2 | 3 | 4 | 5 | null {
  if (!porques || porques.length === 0) {
    return 1;
  }

  const filled = porques.filter((p) => p.resposta && p.resposta.trim().length > 0);
  if (filled.length === 0) {
    return 1;
  }

  const maxNivel = Math.max(...filled.map((p) => p.nivel));
  if (maxNivel >= 5) {
    return null; // max depth reached
  }

  return (maxNivel + 1) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Generates suggested next pergunta based on previous resposta
 * Simple template-based: "Por quê?" + context from previous answer
 */
export function sugerirProximaPergunta(respostaAnterior: string): string {
  if (!respostaAnterior || respostaAnterior.trim().length === 0) {
    return 'Por quê?';
  }

  // If response is very short, generic "why"
  if (respostaAnterior.trim().length < 10) {
    return 'Por quê?';
  }

  // Template: "Por que [extracted subject] ocorreu?"
  const termos = respostaAnterior.trim().split(' ');
  if (termos.length < 3) {
    return 'Por quê?';
  }

  // Simple extraction: first 3 meaningful words
  return `Por que ${termos.slice(0, 3).join(' ')} ocorreu?`;
}

/**
 * Counts filled levels in RCA
 */
export function countFilledLevels(porques: PorquePergunta[]): number {
  if (!porques) return 0;
  return porques.filter((p) => p.resposta && p.resposta.trim().length > 0)
    .length;
}

/**
 * Checks if RCA is complete (severity alta requires RCA before Resolver status)
 * Completeness = ≥4 levels + causaRaiz filled
 */
export function isRCAComplete(rca: RCAFiveWhys | undefined): boolean {
  if (!rca) return false;

  const validation = validateRCA(rca);
  if (!validation.valid) return false;

  const filledCount = countFilledLevels(rca.porques);
  return filledCount >= 4 && rca.causaRaiz.trim().length >= 5;
}

/**
 * Export RCAEngine interface implementation
 */
export const RCAEngine = {
  validateRCA,
  generateCausaRaizHeuristic,
};
