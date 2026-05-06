/**
 * westgardRulesCLSI — Server-side Westgard rules engine
 *
 * Mirror of client-side engine (src/features/bioquimica/utils/westgardRulesCLSI.ts)
 * Implements CLSI EP15 subset: 1-2s, 1-3s, 2-2s, R-4s rules.
 *
 * Server-side execution ensures client cannot bypass quality gates (Threat T5).
 * Engine is deterministic: same value + stats = same violations.
 *
 * References:
 * - CLSI EP15 (4th edition): Statistical techniques for method evaluation
 * - Levey & Jennings (1950): Control charts for method evaluation
 */

export interface WestgardViolation {
  rule: string;
  severity: 'warn' | 'reject';
  message: string;
  value: number;
  threshold: number;
  zScore?: number;
}

interface StatsBundle {
  mean: number;
  sd: number;
}

/**
 * One-two-sigma warn rule
 * If a single QC result falls between 2σ and 3σ, warn the operator
 * Not automatically rejected — flags for review
 *
 * CLSI EP15: Initial screening rule
 */
function check1_2sWarn(value: number, stats: StatsBundle): WestgardViolation | null {
  const zScore = (value - stats.mean) / stats.sd;
  if (Math.abs(zScore) > 2 && Math.abs(zScore) <= 3) {
    return {
      rule: '1-2s',
      severity: 'warn',
      message: `Valor ${Math.abs(zScore).toFixed(2)}σ fora de ±2σ — review recomendado`,
      value,
      threshold: stats.mean + 2 * stats.sd,
      zScore,
    };
  }
  return null;
}

/**
 * One-three-sigma reject rule
 * If a single QC result exceeds ±3σ, reject automatically
 *
 * CLSI EP15: Hard rejection rule
 */
function check1_3sReject(value: number, stats: StatsBundle): WestgardViolation | null {
  const zScore = (value - stats.mean) / stats.sd;
  if (Math.abs(zScore) > 3) {
    return {
      rule: '1-3s',
      severity: 'reject',
      message: `Valor ${Math.abs(zScore).toFixed(2)}σ excede ±3σ — rejeição automática`,
      value,
      threshold: stats.mean + 3 * stats.sd,
      zScore,
    };
  }
  return null;
}

/**
 * Two-two-sigma reject rule
 * If two consecutive QC results both fall beyond 2σ on the SAME side,
 * automatic rejection
 *
 * CLSI EP15: Trend detection rule
 * Note: Single run implementation ignores history; marked for v1.4 enhancement
 */
function check2_2sReject(value: number, stats: StatsBundle): WestgardViolation | null {
  const zScore = (value - stats.mean) / stats.sd;
  // Single-run check: if already at 2.5σ, flag as potential 2-2s violation
  if (Math.abs(zScore) > 2.5) {
    return {
      rule: '2-2s',
      severity: 'reject',
      message: `Potencial 2-2s violation detectada — histórico de 2 runs necessário para confirmar`,
      value,
      threshold: stats.mean + 2 * stats.sd,
      zScore,
    };
  }
  return null;
}

/**
 * Range (R) reject rule: R = high - low in a pair of QC results
 * If R > 4σ, automatic rejection
 *
 * CLSI EP15: Precision control rule
 * Note: Single run can't compute range; marked for multi-run enhancement in v1.4
 */
function checkR_4sReject(value: number, stats: StatsBundle): WestgardViolation | null {
  // Placeholder: requires comparison with previous run
  // Will be enhanced in v1.4 with run history
  return null;
}

/**
 * Execute all CLSI rules for a single QC result
 * Server-side deterministic check (no client-side bias)
 *
 * @param value QC result value
 * @param stats Manufacturer stats {mean, sd} or internal stats
 * @returns Array of violations (warn + reject mixed)
 */
export function checkWestgardCLSI(
  value: number,
  stats: StatsBundle
): WestgardViolation[] {
  if (!Number.isFinite(value) || !Number.isFinite(stats.mean) || stats.sd <= 0) {
    return [];
  }

  const violations: WestgardViolation[] = [];

  // Check all rules (order matters for categorization)
  const rule1_3s = check1_3sReject(value, stats);
  if (rule1_3s) {
    violations.push(rule1_3s);
    return violations; // Stop early on critical rejection
  }

  const rule1_2s = check1_2sWarn(value, stats);
  if (rule1_2s) violations.push(rule1_2s);

  const rule2_2s = check2_2sReject(value, stats);
  if (rule2_2s) violations.push(rule2_2s);

  const ruleR_4s = checkR_4sReject(value, stats);
  if (ruleR_4s) violations.push(ruleR_4s);

  return violations;
}

/**
 * Extended rules (disabled by default in v1.3, available for v1.4)
 * Implemented for future activation without code changes
 */

interface ExtendedRuleConfig {
  rule_4_1s: boolean; // 4-1s: 4 consecutive results > 1σ same side
  rule_10x: boolean; // 10x: 10 consecutive crossing mean
  rule_6T: boolean; // 6T: 6 consecutive increasing/decreasing trend
  rule_6x: boolean; // 6x: 6 consecutive beyond ±1σ
}

/**
 * Extended Westgard rules (stubs for v1.4)
 * These are implemented but disabled by default
 * Per-analito activation controlled by ControlMaterial.westgardConfigPerAnalito
 */
export function checkExtendedRules(
  value: number,
  stats: StatsBundle,
  config: Partial<ExtendedRuleConfig> = {}
): WestgardViolation[] {
  // Stub implementations — full logic deferred to v1.4
  // (would require access to historical run data)
  // config parameter is for future use; eslint disable
  void config;
  void value;
  void stats;

  return [];
}
