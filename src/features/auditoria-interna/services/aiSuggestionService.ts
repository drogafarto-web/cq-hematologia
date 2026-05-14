/**
 * AI Suggestion Service — Client-side layer
 *
 * Calls Cloud Function callables for AI-powered audit suggestions.
 * Rule-based deterministic analysis (no external AI API calls).
 *
 * Functions:
 * - getAISuggestion: Get conformity level suggestion for a checklist item
 * - detectGaps: Detect gaps across all modules before audit
 * - checkRecurrence: Check recurrence of NCs for an indicator
 */

import { httpsCallable } from 'firebase/functions';

import { functions } from '../../../shared/services/firebase';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface AISuggestion {
  indicadorId: string;
  nivelSugerido: number; // 1-5
  confianca: 'alta' | 'media' | 'baixa';
  justificativa: string;
  dadosAnalisados: string[]; // what data points were considered
  gaps: string[]; // identified gaps/issues
}

export interface GapDetection {
  moduloOrigem: string;
  descricao: string;
  severidade: 'critica' | 'alta' | 'media' | 'baixa';
  recomendacao: string;
  indicadorRelacionado: string;
}

export interface RecurrenceResult {
  isRecurrent: boolean;
  occurrences: number;
  lastAuditDate: Date | null;
  recommendation: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Service functions
// ──────────────────────────────────────────────────────────────────────────

/**
 * Calls Cloud Function to get AI suggestion for a checklist item.
 *
 * Analyzes module data related to the indicator and returns a deterministic
 * conformity level suggestion (1-5) with justification.
 */
export async function getAISuggestion(
  labId: string,
  indicadorId: string
): Promise<AISuggestion> {
  const callable = httpsCallable<
    { labId: string; indicadorId: string },
    AISuggestion
  >(functions, 'generateAISuggestion');

  const result = await callable({ labId, indicadorId });
  return result.data;
}

/**
 * Calls Cloud Function to detect gaps across all modules before audit.
 *
 * Scans fornecedores, equipamentos, treinamentos, documentos, riscos,
 * and NCs for compliance gaps that should be addressed.
 */
export async function detectGaps(labId: string): Promise<GapDetection[]> {
  const callable = httpsCallable<
    { labId: string },
    { gaps: GapDetection[] }
  >(functions, 'detectGaps');

  const result = await callable({ labId });
  return result.data.gaps;
}

/**
 * Calls Cloud Function to check recurrence of NCs for an indicator.
 *
 * Queries previous audits for the same indicator and determines if
 * non-conformances are recurring (present in last 2 audits).
 */
export async function checkRecurrence(
  labId: string,
  indicadorId: string
): Promise<RecurrenceResult> {
  const callable = httpsCallable<
    { labId: string; indicadorId: string },
    { isRecurrent: boolean; occurrences: number; lastAuditDate: string | null; recommendation: string }
  >(functions, 'checkRecurrence');

  const result = await callable({ labId, indicadorId });

  return {
    isRecurrent: result.data.isRecurrent,
    occurrences: result.data.occurrences,
    lastAuditDate: result.data.lastAuditDate
      ? new Date(result.data.lastAuditDate)
      : null,
    recommendation: result.data.recommendation,
  };
}
