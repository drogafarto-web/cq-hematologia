/**
 * bioquimica/services/westgardEngine.ts
 *
 * Pure-function CLSI 8-rule Westgard engine for client-side preview.
 * Server-side parallel implementation in functions/ is authoritative (Threat T5).
 *
 * All functions are pure — no side effects, no I/O, no Date.now() calls.
 *
 * Compliance: CLSI EP15, DICQ 4.3 Bloco F 5.6.2, RDC 978 Art. 179.
 */

import type {
  WestgardObservation,
  WestgardViolationCLSI8,
  WestgardRuleCLSI8,
  WestgardRuleConfigCLSI8,
} from '../types/westgardCLSI';

// ─── Engine Input/Output ──────────────────────────────────────────────────

export interface WestgardEngineInput {
  windowObservations: WestgardObservation[]; // ordered by ts ASC, oldest first
  rulesConfig: WestgardRuleConfigCLSI8[];
}

export interface WestgardEngineOutput {
  violations: WestgardViolationCLSI8[];
  rejectCount: number;
  warnCount: number;
}

// ─── Main Engine ──────────────────────────────────────────────────────────

/**
 * Main detection engine. Applies all enabled rules from rulesConfig
 * and returns violations in order of detection.
 */
export function detectWestgardViolations(input: WestgardEngineInput): WestgardEngineOutput {
  const { windowObservations, rulesConfig } = input;
  const allViolations: WestgardViolationCLSI8[] = [];

  // Build a map of rule → enabled
  const enabledRules = new Map<WestgardRuleCLSI8, boolean>();
  rulesConfig.forEach((cfg) => {
    enabledRules.set(cfg.rule, cfg.enabled);
  });

  // Apply each rule detector if enabled
  if (enabledRules.get('1-3s') !== false) {
    allViolations.push(...detect_1_3s(windowObservations));
  }
  if (enabledRules.get('2-2s') !== false) {
    allViolations.push(...detect_2_2s(windowObservations));
  }
  if (enabledRules.get('R-4s') !== false) {
    allViolations.push(...detect_R_4s(windowObservations));
  }
  if (enabledRules.get('4-1s') !== false) {
    allViolations.push(...detect_4_1s(windowObservations));
  }
  if (enabledRules.get('10x') !== false) {
    allViolations.push(...detect_10x(windowObservations));
  }
  if (enabledRules.get('7T') !== false) {
    allViolations.push(...detect_7T(windowObservations));
  }
  if (enabledRules.get('8x') !== false) {
    allViolations.push(...detect_8x(windowObservations));
  }
  if (enabledRules.get('12x') !== false) {
    allViolations.push(...detect_12x(windowObservations));
  }

  // Aggregate counts
  const rejectCount = allViolations.filter((v) => v.severity === 'reject').length;
  const warnCount = allViolations.filter((v) => v.severity === 'warn').length;

  return {
    violations: allViolations,
    rejectCount,
    warnCount,
  };
}

// ─── Individual Rule Detectors (exported for unit testing) ────────────────

/**
 * Detect 1-3s: 1 result > ±3 SD → reject
 */
export function detect_1_3s(obs: WestgardObservation[]): WestgardViolationCLSI8[] {
  const violations: WestgardViolationCLSI8[] = [];

  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (Math.abs(o.zScore) > 3) {
      violations.push({
        rule: '1-3s',
        severity: 'reject',
        detectedAt: o.ts,
        windowRuns: [o.runId],
        description: `1 result at ${o.zScore > 0 ? '+' : ''}${o.zScore.toFixed(1)} SD (rule 1-3s)`,
      });
    }
  }

  return violations;
}

/**
 * Detect 2-2s: 2 consecutive same-side > ±2 SD → reject
 * Window size: 2
 */
export function detect_2_2s(obs: WestgardObservation[]): WestgardViolationCLSI8[] {
  const violations: WestgardViolationCLSI8[] = [];

  for (let i = 1; i < obs.length; i++) {
    const prev = obs[i - 1];
    const curr = obs[i];

    // Both > +2 or both < -2
    const bothAbove = prev.zScore > 2 && curr.zScore > 2;
    const bothBelow = prev.zScore < -2 && curr.zScore < -2;

    if (bothAbove || bothBelow) {
      violations.push({
        rule: '2-2s',
        severity: 'reject',
        detectedAt: curr.ts,
        windowRuns: [prev.runId, curr.runId],
        description: `2 consecutive results ${bothAbove ? 'above' : 'below'} ±2 SD (rule 2-2s)`,
      });
    }
  }

  return violations;
}

/**
 * Detect R-4s: range between 2 consecutive runs > 4 SD → reject
 * Range = max(z) - min(z) across 2 consecutive observations
 */
export function detect_R_4s(obs: WestgardObservation[]): WestgardViolationCLSI8[] {
  const violations: WestgardViolationCLSI8[] = [];

  for (let i = 1; i < obs.length; i++) {
    const prev = obs[i - 1];
    const curr = obs[i];

    const range = Math.abs(curr.zScore - prev.zScore);
    if (range > 4) {
      violations.push({
        rule: 'R-4s',
        severity: 'reject',
        detectedAt: curr.ts,
        windowRuns: [prev.runId, curr.runId],
        description: `Range ${range.toFixed(1)} SD between consecutive runs exceeds 4 SD (rule R-4s)`,
      });
    }
  }

  return violations;
}

/**
 * Detect 4-1s: 4 consecutive results > ±1 SD same side → reject
 * Window size: 4
 */
export function detect_4_1s(obs: WestgardObservation[]): WestgardViolationCLSI8[] {
  const violations: WestgardViolationCLSI8[] = [];

  for (let i = 3; i < obs.length; i++) {
    const window = [obs[i - 3], obs[i - 2], obs[i - 1], obs[i]];
    const allAbove = window.every((o) => o.zScore > 1);
    const allBelow = window.every((o) => o.zScore < -1);

    if (allAbove || allBelow) {
      violations.push({
        rule: '4-1s',
        severity: 'reject',
        detectedAt: obs[i].ts,
        windowRuns: window.map((o) => o.runId),
        description: `4 consecutive results ${allAbove ? 'above' : 'below'} ±1 SD (rule 4-1s)`,
      });
    }
  }

  return violations;
}

/**
 * Detect 10x: 10 consecutive same-side from mean → reject
 * "Same-side" = zScore > 0 or < 0, ignoring magnitude
 * Window size: 10
 */
export function detect_10x(obs: WestgardObservation[]): WestgardViolationCLSI8[] {
  const violations: WestgardViolationCLSI8[] = [];

  for (let i = 9; i < obs.length; i++) {
    const window = obs.slice(i - 9, i + 1);
    const allAboveZero = window.every((o) => o.zScore > 0);
    const allBelowZero = window.every((o) => o.zScore < 0);

    if (allAboveZero || allBelowZero) {
      violations.push({
        rule: '10x',
        severity: 'reject',
        detectedAt: obs[i].ts,
        windowRuns: window.map((o) => o.runId),
        description: `10 consecutive results ${allAboveZero ? 'above' : 'below'} mean (rule 10x)`,
      });
    }
  }

  return violations;
}

/**
 * Detect 7T: 7 consecutive monotonic trend (strictly increasing or decreasing) → reject
 * Window size: 7
 */
export function detect_7T(obs: WestgardObservation[]): WestgardViolationCLSI8[] {
  const violations: WestgardViolationCLSI8[] = [];

  for (let i = 6; i < obs.length; i++) {
    const window = obs.slice(i - 6, i + 1);
    let isIncreasing = true;
    let isDecreasing = true;

    for (let j = 1; j < window.length; j++) {
      if (window[j].zScore <= window[j - 1].zScore) {
        isIncreasing = false;
      }
      if (window[j].zScore >= window[j - 1].zScore) {
        isDecreasing = false;
      }
    }

    if (isIncreasing || isDecreasing) {
      violations.push({
        rule: '7T',
        severity: 'reject',
        detectedAt: obs[i].ts,
        windowRuns: window.map((o) => o.runId),
        description: `7 consecutive results trending ${isIncreasing ? 'up' : 'down'} (rule 7T)`,
      });
    }
  }

  return violations;
}

/**
 * Detect 8x: 8 consecutive same-side from mean → warn
 * "Same-side" = zScore > 0 or < 0, ignoring magnitude
 * Window size: 8
 */
export function detect_8x(obs: WestgardObservation[]): WestgardViolationCLSI8[] {
  const violations: WestgardViolationCLSI8[] = [];

  for (let i = 7; i < obs.length; i++) {
    const window = obs.slice(i - 7, i + 1);
    const allAboveZero = window.every((o) => o.zScore > 0);
    const allBelowZero = window.every((o) => o.zScore < 0);

    if (allAboveZero || allBelowZero) {
      violations.push({
        rule: '8x',
        severity: 'warn',
        detectedAt: obs[i].ts,
        windowRuns: window.map((o) => o.runId),
        description: `8 consecutive results ${allAboveZero ? 'above' : 'below'} mean (rule 8x)`,
      });
    }
  }

  return violations;
}

/**
 * Detect 12x: 12 consecutive same-side from mean → warn
 * "Same-side" = zScore > 0 or < 0, ignoring magnitude
 * Window size: 12
 */
export function detect_12x(obs: WestgardObservation[]): WestgardViolationCLSI8[] {
  const violations: WestgardViolationCLSI8[] = [];

  for (let i = 11; i < obs.length; i++) {
    const window = obs.slice(i - 11, i + 1);
    const allAboveZero = window.every((o) => o.zScore > 0);
    const allBelowZero = window.every((o) => o.zScore < 0);

    if (allAboveZero || allBelowZero) {
      violations.push({
        rule: '12x',
        severity: 'warn',
        detectedAt: obs[i].ts,
        windowRuns: window.map((o) => o.runId),
        description: `12 consecutive results ${allAboveZero ? 'above' : 'below'} mean (rule 12x)`,
      });
    }
  }

  return violations;
}
