import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { RoutingRule, EscalationRecipients } from '../types/threshold';

export type LabId = string;

/**
 * Routing Engine — Match critical values to escalation rules
 *
 * Implements routing precedence:
 * 1. Specific rules (byAnalyteAndSeverity) take precedence
 * 2. Moderate rules (byAnalyte, bySeverity)
 * 3. General rules (all)
 * 4. Fallback to primary RT if no match
 */

function routingCollection(labId: LabId) {
  return collection(db, 'labs', labId, 'criticos-routing');
}

/**
 * Load all active routing rules for a lab
 */
export async function getRoutingRules(labId: LabId): Promise<RoutingRule[]> {
  const q = query(
    routingCollection(labId),
    where('ativo', '==', true),
    where('deletadoEm', '==', null)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<RoutingRule, 'id'>),
    id: doc.id,
  }));
}

/**
 * CriticoDetectionResult — Result of critical value detection
 * (minimal structure for routing engine)
 */
export interface CriticoDetectionResult {
  analitoId: string;
  severidade: 'alta' | 'baixa';
  valor: number;
  unidade: string;
  pacienteId: string;
  laudoId: string;
  timestamp: Timestamp;
}

/**
 * Match a critical value against routing rules and return recipients
 *
 * Routing precedence:
 * 1. byAnalyteAndSeverity (most specific)
 * 2. byAnalyte
 * 3. bySeverity
 * 4. all (fallback)
 * 5. Primary RT (ultimate fallback if no rules match)
 *
 * @param critico Detected critical value
 * @param rules Active routing rules for the lab
 * @param primaryRtId Fallback RT ID (from lab config)
 * @returns Recipients and SLA
 */
export function getEscalationRecipients(
  critico: CriticoDetectionResult,
  rules: RoutingRule[],
  primaryRtId: string
): EscalationRecipients {
  // Score each rule based on specificity
  const scored = rules
    .map((rule) => ({
      rule,
      score: scoreRuleMatch(rule, critico),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // No matching rules — use primary RT fallback
    return {
      operadorIds: [primaryRtId],
      telefones: [],
      emails: [],
      slaMinutos: 30, // Default 30-minute SLA
    };
  }

  // Take the highest-scoring rule
  const bestMatch = scored[0].rule;

  return {
    operadorIds: bestMatch.recipients.operadorIds,
    telefones: bestMatch.recipients.telefones,
    emails: bestMatch.recipients.emails,
    slaMinutos: bestMatch.slaMinutos,
  };
}

/**
 * Score a rule against a critical value
 * Higher score = more specific match
 *
 * Scoring:
 * - byAnalyteAndSeverity: 40 (most specific)
 * - byAnalyte: 20
 * - bySeverity: 10
 * - all: 1 (lowest)
 * - 0 = no match
 */
function scoreRuleMatch(rule: RoutingRule, critico: CriticoDetectionResult): number {
  switch (rule.criterioBloco) {
    case 'byAnalyteAndSeverity':
      if (
        rule.analitoIds?.includes(critico.analitoId) &&
        rule.severidades?.includes(critico.severidade)
      ) {
        return 40; // Most specific
      }
      return 0;

    case 'byAnalyte':
      if (rule.analitoIds?.includes(critico.analitoId)) {
        return 20;
      }
      return 0;

    case 'bySeverity':
      if (rule.severidades?.includes(critico.severidade)) {
        return 10;
      }
      return 0;

    case 'all':
      return 1; // Always matches, but lowest priority

    default:
      return 0;
  }
}

/**
 * Merge multiple escalation sets without duplicates
 * (useful if multiple rules match at same priority)
 */
export function mergeEscalationRecipients(recipients: EscalationRecipients[]): EscalationRecipients {
  const merged: EscalationRecipients = {
    operadorIds: [],
    telefones: [],
    emails: [],
    slaMinutos: Math.max(...recipients.map((r) => r.slaMinutos)),
  };

  recipients.forEach((r) => {
    merged.operadorIds.push(...r.operadorIds);
    merged.telefones.push(...r.telefones);
    merged.emails.push(...r.emails);
  });

  // Deduplicate
  merged.operadorIds = Array.from(new Set(merged.operadorIds));
  merged.telefones = Array.from(new Set(merged.telefones));
  merged.emails = Array.from(new Set(merged.emails));

  return merged;
}
