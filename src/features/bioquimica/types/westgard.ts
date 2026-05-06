/**
 * bioquimica/types/westgard.ts
 *
 * Engine Westgard subset CLSI clássico — 4 regras ativas no MVP:
 *
 *   1-2s  → warning (não bloqueia run)
 *   1-3s  → reject
 *   2-2s  → reject (2 runs consecutivas mesmo lado)
 *   R-4s  → reject (range 4σ entre 2 runs consecutivas)
 *
 * Regras estendidas (4-1s, 10x, 6T, 6X) ficam definidas em código mas com
 * `enabled: false` por default — ativáveis em v1.4 por analito via UI admin
 * (CTO lock 2026-05-06).
 *
 * Implementação concreta vive em `utils/westgardRulesCLSI.ts` (Phase 09-02);
 * este arquivo só define o domínio (tipos + tabela canônica de severidade).
 *
 * NÃO reaproveitar `westgardRules.ts` de hematologia diretamente — fork
 * enxuto evita regressão hema durante evolução bioquimica.
 *
 * Compliance: CLSI EP15 (subset Westgard), DICQ 4.3 Bloco F 5.6.2.
 */

import type { AnalitoId, NivelId } from './_shared_refs';

// ─── Regras ativas no MVP ─────────────────────────────────────────────────

export type WestgardRuleCLSI = '1-2s' | '1-3s' | '2-2s' | 'R-4s';

// ─── Regras estendidas (definidas, default disabled) ──────────────────────

export type WestgardRuleExtended = '4-1s' | '10x' | '6T' | '6X';

// União completa — cobre o que o engine pode emitir após v1.4 ativar
// regras estendidas via flag por analito.
export type WestgardRule = WestgardRuleCLSI | WestgardRuleExtended;

// ─── Severidade ───────────────────────────────────────────────────────────

export type WestgardSeverity = 'warn' | 'reject';

// ─── Tabela canônica de severidade (CLSI subset) ──────────────────────────

export const CLSI_RULES: Record<WestgardRuleCLSI, WestgardSeverity> = {
  '1-2s': 'warn',
  '1-3s': 'reject',
  '2-2s': 'reject',
  'R-4s': 'reject',
} as const;

// ─── Tabela severidade quando regras estendidas estão ativas ──────────────

export const EXTENDED_RULES: Record<WestgardRuleExtended, WestgardSeverity> = {
  '4-1s': 'reject',
  '10x': 'reject',
  '6T': 'reject',
  '6X': 'reject',
} as const;

// ─── Violation ────────────────────────────────────────────────────────────
//
// Saída do engine — uma por (regra, analitoId, nivelId) violada na run.
// `detail` é a string human-readable mostrada no chip da UI (ex: "Run 4:
// 3.2σ acima da média"). Nunca confiar no client para gerar — engine
// canônico server-side em `recordRunBioquimica` Cloud Function.

export interface WestgardViolation {
  readonly rule: WestgardRule;
  readonly analitoId: AnalitoId;
  readonly nivelId: NivelId;
  readonly severity: WestgardSeverity;
  readonly detail: string;
}

// ─── Configuração por analito (v1.4 — toggle de regras estendidas) ─────────
//
// Persistido em `/labs/{labId}/bioquimica/config/westgard` (singleton por lab)
// ou em campo no próprio Analito. Decisão final em Plan 09-02 quando engine
// for implementado. Tipo já definido aqui para evitar churn.

export interface WestgardConfigPerAnalito {
  readonly analitoId: AnalitoId;
  readonly enabledRules: ReadonlyArray<WestgardRule>;
}
