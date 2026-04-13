/**
 * westgardRules.ts — Pure Westgard rule evaluators
 *
 * No React, no side effects. All functions are deterministic and testable.
 *
 * Terminology:
 *   z(v) = (v - mean) / sd   ← z-score relative to the stats in use
 *   "previous" = ordered newest → oldest (previous[0] = most recent prior value)
 */

import type { WestgardViolation, AnalyteStats } from '../../../types';

// ─── Individual rules ─────────────────────────────────────────────────────────

/** 1-2s  Warning  — 1 value beyond ±2 SD */
function rule_1_2s(z0: number): boolean {
  return Math.abs(z0) >= 2;
}

/** 1-3s  Rejection — 1 value beyond ±3 SD */
function rule_1_3s(z0: number): boolean {
  return Math.abs(z0) >= 3;
}

/** 2-2s  Rejection — 2 consecutive values beyond ±2 SD on the same side */
function rule_2_2s(z0: number, z1: number): boolean {
  return Math.abs(z0) >= 2 && Math.abs(z1) >= 2 && Math.sign(z0) === Math.sign(z1);
}

/** R-4s  Rejection — 2 consecutive values span > 4 SD (opposite sides) */
function rule_R_4s(z0: number, z1: number): boolean {
  return Math.abs(z0 - z1) >= 4;
}

/** 4-1s  Rejection — 4 consecutive values all beyond ±1 SD on the same side */
function rule_4_1s(last4: number[]): boolean {
  return last4.every((z) => z >= 1) || last4.every((z) => z <= -1);
}

/** 10x   Rejection — 10 consecutive values all on the same side of the mean */
function rule_10x(last10: number[]): boolean {
  return last10.every((z) => z > 0) || last10.every((z) => z < 0);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluates all Westgard rules for a single new analyte value.
 *
 * @param current  The new measurement value to evaluate
 * @param previous Previous values for the same analyte, newest-first
 * @param stats    Mean and SD to compute z-scores against
 * @returns        Array of violated rules (may be empty)
 */
export function checkWestgardRules(
  current: number,
  previous: number[],
  stats: AnalyteStats
): WestgardViolation[] {
  const { mean, sd } = stats;
  if (sd <= 0) return []; // Cannot evaluate without a valid SD

  const z = (v: number) => (v - mean) / sd;
  const z0 = z(current);
  const zPrev = previous.map(z);

  const violations: WestgardViolation[] = [];

  // Single-value rules (always evaluable)
  if (rule_1_2s(z0)) violations.push('1-2s');
  if (rule_1_3s(z0)) violations.push('1-3s');

  // Two-value rules
  if (zPrev.length >= 1) {
    if (rule_2_2s(z0, zPrev[0])) violations.push('2-2s');
    if (rule_R_4s(z0, zPrev[0])) violations.push('R-4s');
  }

  // Four-value rule
  if (zPrev.length >= 3) {
    if (rule_4_1s([z0, zPrev[0], zPrev[1], zPrev[2]])) violations.push('4-1s');
  }

  // Ten-value rule
  if (zPrev.length >= 9) {
    if (rule_10x([z0, ...zPrev.slice(0, 9)])) violations.push('10x');
  }

  return violations;
}

/** Rules that require run rejection (vs. warning-only) */
const REJECTION_RULES = new Set<WestgardViolation>(['1-3s', '2-2s', 'R-4s', '4-1s', '10x']);

/** Returns true if any violation in the list triggers run rejection */
export function isRejection(violations: WestgardViolation[]): boolean {
  return violations.some((v) => REJECTION_RULES.has(v));
}

/** Returns true if the violation is a warning only (does not reject the run) */
export function isWarningOnly(violations: WestgardViolation[]): boolean {
  return violations.length > 0 && !isRejection(violations);
}
