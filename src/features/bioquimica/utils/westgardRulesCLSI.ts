import { Timestamp } from 'firebase/firestore';

export interface WestgardCheckInput {
  current: {
    value: number;
    analitoId: string;
    nivelId: string;
    equipmentId: string;
    capturaEm: Timestamp;
  };
  history: Array<{ value: number; capturaEm: Timestamp }>;
  stats: { mean: number; sd: number };
}

export interface WestgardViolation {
  rule: '1-2s' | '1-3s' | '2-2s' | 'R-4s';
  severity: 'warn' | 'reject';
  detail: string;
}

/**
 * Check Westgard CLSI subset (4 rules) for bioquímica
 * Returns array of violations, empty if compliant
 */
export function checkWestgardCLSI(input: WestgardCheckInput): WestgardViolation[] {
  const violations: WestgardViolation[] = [];

  // Guard: invalid stats
  if (
    !Number.isFinite(input.stats.mean) ||
    !Number.isFinite(input.stats.sd) ||
    input.stats.sd <= 0
  ) {
    return [];
  }

  const z = (input.current.value - input.stats.mean) / input.stats.sd;

  // Guard: invalid z-score
  if (!Number.isFinite(z)) {
    return [];
  }

  // Rule 1-2s: warn (1 point beyond 2σ)
  if (Math.abs(z) > 2 && Math.abs(z) <= 3) {
    violations.push({
      rule: '1-2s',
      severity: 'warn',
      detail: `Valor a ${z.toFixed(2)}σ da média (limite: ±2σ)`,
    });
  }

  // Rule 1-3s: reject (1 point beyond 3σ)
  if (Math.abs(z) > 3) {
    violations.push({
      rule: '1-3s',
      severity: 'reject',
      detail: `Valor a ${z.toFixed(2)}σ da média (limite: ±3σ)`,
    });
  }

  // Rule 2-2s: reject (2 consecutive runs same side beyond 2σ)
  if (input.history.length > 0) {
    const zPrev = (input.history[0].value - input.stats.mean) / input.stats.sd;
    if (Number.isFinite(zPrev) && Math.abs(z) > 2 && Math.abs(zPrev) > 2) {
      // Check same side (same sign)
      if (Math.sign(z) === Math.sign(zPrev)) {
        violations.push({
          rule: '2-2s',
          severity: 'reject',
          detail: `2 corridas consecutivas a ${z.toFixed(2)}σ e ${zPrev.toFixed(2)}σ (mesmo lado de 2σ)`,
        });
      }
    }
  }

  // Rule R-4s: reject (range 4σ between 2 consecutive runs)
  if (input.history.length > 0) {
    const zPrev = (input.history[0].value - input.stats.mean) / input.stats.sd;
    if (Number.isFinite(zPrev)) {
      const range = Math.abs(z - zPrev);
      if (range > 4) {
        violations.push({
          rule: 'R-4s',
          severity: 'reject',
          detail: `Range 4σ entre corridas: ${z.toFixed(2)}σ e ${zPrev.toFixed(2)}σ (amplitude: ${range.toFixed(2)}σ)`,
        });
      }
    }
  }

  return violations;
}

/**
 * Suggest run status based on violations
 */
export function suggestStatus(violations: WestgardViolation[]): 'Aprovada' | 'Rejeitada' {
  return violations.some((v) => v.severity === 'reject') ? 'Rejeitada' : 'Aprovada';
}

/**
 * Advanced rules (disabled by default, enableable in v1.4)
 */
export interface AdvancedRuleConfig {
  '4-1s': boolean; // 4 consecutive runs beyond 1σ
  '10x': boolean; // 10 consecutive runs on same side
  '6T': boolean; // 6 consecutive runs trending up/down
  '6X': boolean; // 6 consecutive runs alternating above/below
}

export const DEFAULT_ADVANCED_RULES: AdvancedRuleConfig = {
  '4-1s': false,
  '10x': false,
  '6T': false,
  '6X': false,
};

/**
 * Check advanced rules (stubs for v1.4 implementation)
 */
export function checkAdvancedRules(
  current: WestgardCheckInput['current'],
  history: WestgardCheckInput['history'],
  stats: WestgardCheckInput['stats'],
  config: AdvancedRuleConfig,
): WestgardViolation[] {
  // Placeholder for v1.4
  return [];
}
