/**
 * _shared_refs.ts — Fonte única de verdade para tipos compartilhados do módulo CIQ-Imuno.
 *
 * Importar daqui em todos os hooks, components e services do módulo.
 * NÃO duplicar estes tipos em outros arquivos do módulo.
 */

// ─── Tipos de Teste ───────────────────────────────────────────────────────────

/**
 * Imunoensaio — string livre configurável pelo laboratório.
 * A lista canônica é gerenciada em Firestore via useCIQTestTypes/saveTestTypes.
 * Historicamente: HCG | BhCG | HIV | HBsAg | Anti-HCV | Sifilis | Dengue | COVID | PCR | Troponina
 */
export type TestType = string;

// ─── Status de Decisão do Lote ────────────────────────────────────────────────

/**
 * Decisão final de aceitação do lote após análise dos runs.
 * Distinto de `RunStatus` (status da corrida individual no sistema).
 * Usar no campo `ciqDecision` do documento de lote — não sobrescrever RunStatus.
 *
 *  A  = Aceitável  — lote dentro dos critérios RDC 978
 *  NA = Não Aceitável — lote com falhas, mas sem reprovação formal
 *  Rejeitado = Lote reprovado formalmente, requer investigação e registro
 */
export type CIQStatus = 'A' | 'NA' | 'Rejeitado';

// ─── Alertas Westgard Categórico ──────────────────────────────────────────────

/**
 * Alertas de qualidade para dados categóricos R/NR (imunoensaios).
 * Gerados pelo hook `useCIQWestgard` — independente do `westgardRules.ts` quantitativo.
 *
 *  taxa_falha_10pct  — >10% NR no total do lote (mínimo 10 runs para ativar)
 *  consecutivos_3nr  — 3 resultados NR consecutivos
 *  consecutivos_4nr  — 4+ NR nos últimos 10 runs
 *  lote_expirado     — validadeControle anterior à dataRealizacao → lotStatus: reprovado
 *  validade_30d      — validadeControle expira em menos de 30 dias → lotStatus: atencao
 */
export type WestgardCatAlert =
  | 'taxa_falha_10pct'
  | 'consecutivos_3nr'
  | 'consecutivos_4nr'
  | 'lote_expirado'
  | 'validade_30d';

// ─── Status do Lote (calculado pelo useCIQWestgard) ──────────────────────────

/** Resultado da avaliação Westgard sobre o conjunto de runs do lote. */
export type CIQLotStatus = 'valido' | 'atencao' | 'reprovado' | 'sem_dados';
