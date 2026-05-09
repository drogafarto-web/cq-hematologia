/**
 * bioquimica/services/acceptanceEngine.ts
 *
 * Combined acceptance decision engine: Westgard + interlab z-score + OCR validation.
 * Pure function — no I/O.
 */

import type { WestgardEngineOutput } from './westgardEngine';
import type { InterlabZScoreOutput } from './zscoreCalculator';
import type { OCRValidationReport } from '../types/ocrResults';

// ─── Acceptance Types ──────────────────────────────────────────────────────

export type AcceptanceDecision = 'accept' | 'warn' | 'reject';

export interface AcceptanceInput {
  westgardResult: WestgardEngineOutput;
  interlabZScore?: InterlabZScoreOutput;       // optional — only when CEQ cycle exists
  ocrValidation?: OCRValidationReport;         // optional — only when OCR was used
}

export interface AcceptanceOutput {
  decision: AcceptanceDecision;
  reasons: string[];                           // human-readable explanations
  blockers: string[];                          // subset of reasons that drove a 'reject' verdict
}

// ─── Main Acceptance Engine ────────────────────────────────────────────────

/**
 * Evaluate acceptance decision based on all available validation signals.
 * Priority order (Westgard reject > interlab reject > OCR reject > warns > accept).
 */
export function evaluateAcceptance(input: AcceptanceInput): AcceptanceOutput {
  const { westgardResult, interlabZScore, ocrValidation } = input;
  const reasons: string[] = [];
  const blockers: string[] = [];

  // Priority 1: Westgard reject rules
  if (westgardResult.rejectCount > 0) {
    for (const violation of westgardResult.violations) {
      if (violation.severity === 'reject') {
        const reason = `Westgard ${violation.rule} reject: ${violation.description}`;
        reasons.push(reason);
        blockers.push(reason);
      }
    }
  }

  // Priority 2: Interlab z-score unsatisfactory
  if (interlabZScore && interlabZScore.classification === 'unsatisfactory') {
    const reason = `Interlab z-score ${interlabZScore.zScore.toFixed(1)} classification=${interlabZScore.classification}`;
    reasons.push(reason);
    blockers.push(reason);
  }

  // Priority 3: OCR validation rejected
  if (ocrValidation && ocrValidation.validationSeverity === 'reject') {
    const reason = `OCR validation rejected: ${ocrValidation.unmatched.length} unmatched analytes`;
    reasons.push(reason);
    blockers.push(reason);
  }

  // If any blocker, decision is reject
  if (blockers.length > 0) {
    return {
      decision: 'reject',
      reasons,
      blockers,
    };
  }

  // Priority 4: Westgard warnings
  if (westgardResult.warnCount > 0) {
    for (const violation of westgardResult.violations) {
      if (violation.severity === 'warn') {
        reasons.push(`Westgard ${violation.rule} warning: ${violation.description}`);
      }
    }
  }

  // Priority 4b: Interlab z-score questionable
  if (interlabZScore && interlabZScore.classification === 'questionable') {
    reasons.push(`Interlab z-score ${interlabZScore.zScore.toFixed(1)} classification=${interlabZScore.classification}`);
  }

  // Priority 4c: OCR validation review
  if (ocrValidation && ocrValidation.validationSeverity === 'review') {
    reasons.push(`OCR validation review: ${ocrValidation.unmatched.length} unmatched analytes`);
  }

  // If any warn-level signal, decision is warn
  if (reasons.length > 0) {
    return {
      decision: 'warn',
      reasons,
      blockers: [],
    };
  }

  // Otherwise, accept
  return {
    decision: 'accept',
    reasons: ['All validation checks passed'],
    blockers: [],
  };
}
