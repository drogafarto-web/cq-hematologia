/**
 * bioquimica/types/westgardCLSI.ts
 *
 * Full CLSI Multirule 1981 type definitions. Extends legacy 4-rule subset
 * with 8 complete rules per CLSI EP15 standard.
 *
 * Compliance: CLSI EP15, DICQ 4.3 Bloco F 5.6.2, RDC 978 Arts. 179-183.
 */

import type { AnalitoId, EquipmentId, NivelId } from './_shared_refs';

// ─── CLSI 8-Rule Westgard Rules ───────────────────────────────────────────

export type WestgardRuleCLSI8 =
  | '1-3s'   // 1 result > ±3 SD → reject
  | '2-2s'   // 2 consecutive same-side > ±2 SD → reject
  | 'R-4s'   // range between 2 consecutive runs > 4 SD → reject
  | '4-1s'   // 4 consecutive results > ±1 SD same side → reject
  | '10x'    // 10 consecutive same-side from mean → reject
  | '7T'     // 7 consecutive trending up or down → reject
  | '8x'     // 8 consecutive same-side from mean → warn
  | '12x';   // 12 consecutive same-side from mean → warn

// ─── Severity Classification ──────────────────────────────────────────────

export type WestgardSeverityCLSI8 = 'warn' | 'reject';

// ─── Observation (input to detector functions) ────────────────────────────

export interface WestgardObservation {
  runId: string;
  analitoId: AnalitoId;
  equipmentId: EquipmentId;
  nivelId: NivelId;
  value: number;           // raw measurement
  mean: number;            // reference mean (from bula or internal stats)
  sd: number;              // standard deviation
  zScore: number;          // (value - mean) / sd
  ts: number;              // unix timestamp (milliseconds)
}

// ─── Violation (output of detector functions) ─────────────────────────────

export interface WestgardViolationCLSI8 {
  rule: WestgardRuleCLSI8;
  severity: WestgardSeverityCLSI8;
  detectedAt: number;      // unix timestamp when violation detected
  windowRuns: string[];    // runIds participating in the violation window
  description: string;     // human-readable, e.g. "1 result at +3.2 SD (rule 1-3s)"
}

// ─── Rule Configuration ────────────────────────────────────────────────────

export interface WestgardRuleConfigCLSI8 {
  rule: WestgardRuleCLSI8;
  enabled: boolean;
  severity: WestgardSeverityCLSI8;
}

// ─── CLSI 8 Defaults ───────────────────────────────────────────────────────

/**
 * Standard CLSI EP15 severity mapping.
 * Rules 1-3s, 2-2s, R-4s, 4-1s, 10x, 7T → reject
 * Rules 8x, 12x → warn
 */
export const CLSI8_DEFAULTS: Record<WestgardRuleCLSI8, WestgardSeverityCLSI8> = {
  '1-3s': 'reject',
  '2-2s': 'reject',
  'R-4s': 'reject',
  '4-1s': 'reject',
  '10x': 'reject',
  '7T': 'reject',
  '8x': 'warn',
  '12x': 'warn',
} as const;

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Determine if a rule should cause rejection (vs. warning).
 * Uses CLSI8_DEFAULTS mapping.
 */
export function isRejectRule(rule: WestgardRuleCLSI8): boolean {
  return CLSI8_DEFAULTS[rule] === 'reject';
}
