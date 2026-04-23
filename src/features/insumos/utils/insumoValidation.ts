/**
 * insumoValidation — validação de reagentes/tiras/controles pra uma corrida de CIQ.
 *
 * Usado em 3 pontos:
 *   1. UI (ReviewRunModal) — decide se botão "Confirmar" libera ou exige override
 *   2. Hook (useRuns.confirmRun) — revalida client-side antes do write otimista
 *   3. Trigger server-side (onCreate de run) — revalida com Admin SDK, grava
 *      `complianceViolation` + auditLog se divergir
 *
 * Pureza: sem dependência de Firestore SDK — opera sobre entidades já carregadas.
 * Helper puro tanto no front quanto em Cloud Functions (compilam juntos).
 *
 * Regulatório: RDC 978/2025 Art.128, CLSI EP26-A (Reagent Lot Variation),
 * RDC 786/2023 art. 42 (rastreabilidade de insumos).
 */

import { diasAteVencer } from './validadeReal';
import { hasQCValidationPending } from '../types/Insumo';
import { MODULO_RUN_CONFIG } from './modulosConfig';
import type { Insumo, InsumoModulo } from '../types/Insumo';

export type ReagenteIssueKind =
  | 'vencido' // validadeReal < now — hard block
  | 'nao_ativo' // status !== 'ativo' (fechado/vencido/descartado) — hard block
  | 'lote_reprovado' // qcStatus === 'reprovado' (imuno) — hard block
  | 'qc_pendente' // qcValidationRequired === true — warn only (a própria corrida valida)
  | 'lote_nao_aprovado' // qcStatus === 'pendente' (imuno) — warn only
  | 'modulo_incompativel'; // reagente não cobre o módulo da corrida — hard block

export type IssueSeverity = 'block' | 'warn';

export interface ReagenteIssue {
  kind: ReagenteIssueKind;
  severity: IssueSeverity;
  insumo: Pick<Insumo, 'id' | 'nomeComercial' | 'fabricante' | 'lote'>;
  message: string;
}

export interface ValidateReagentesResult {
  /**
   * true quando a corrida pode seguir sem override. `false` quando há pelo
   * menos um issue `block` OU mínimo de reagentes não atingido.
   */
  canProceed: boolean;
  /**
   * true quando há avisos mas sem bloqueadores. Caller pode mostrar banner sem
   * exigir override (apenas ciência).
   */
  hasWarnings: boolean;
  /** Todos os problemas detectados — UI itera pra exibir em lista. */
  issues: ReagenteIssue[];
  /** Bloqueadores (severity === 'block'). Subset de issues. */
  blockers: ReagenteIssue[];
  /** Warnings (severity === 'warn'). Subset de issues. */
  warnings: ReagenteIssue[];
  /**
   * `null` quando mínimo atendido; {expected, got} quando falta reagente.
   * Separado de issues porque não é atrelado a um insumo específico — é
   * estrutural da corrida.
   */
  minimoFaltando: { expected: number; got: number; modulo: string } | null;
}

export interface ValidateReagentesInput {
  reagentes: readonly Insumo[];
  modulo: InsumoModulo;
  /** now injetável pra testes. Default: Date.now() no momento da chamada. */
  now?: Date;
}

/**
 * Avalia o conjunto de reagentes declarados pra uma corrida e retorna o veredito.
 *
 * - `vencido` / `nao_ativo` / `lote_reprovado` / `modulo_incompativel` → block
 * - `qc_pendente` / `lote_nao_aprovado` → warn (a corrida de CQ é que valida)
 * - mínimo de reagentes não atingido → block
 */
export function validateReagentesForRun(
  input: ValidateReagentesInput,
): ValidateReagentesResult {
  const now = input.now ?? new Date();
  const issues: ReagenteIssue[] = [];

  for (const r of input.reagentes) {
    const slim = { id: r.id, nomeComercial: r.nomeComercial, fabricante: r.fabricante, lote: r.lote };

    // 1. Validade — hard block
    const validadeDate = r.validadeReal.toDate();
    const dias = diasAteVencer(validadeDate, now);
    if (dias < 0) {
      issues.push({
        kind: 'vencido',
        severity: 'block',
        insumo: slim,
        message: `${r.nomeComercial} (lote ${r.lote}) vencido há ${Math.abs(dias)} dia(s). Não pode ser usado em corridas de CIQ.`,
      });
    }

    // 2. Status — hard block quando ≠ 'ativo'
    if (r.status !== 'ativo') {
      issues.push({
        kind: 'nao_ativo',
        severity: 'block',
        insumo: slim,
        message: `${r.nomeComercial} (lote ${r.lote}) está com status "${r.status}" — só insumos ativos podem ser declarados em corrida.`,
      });
    }

    // 3. Módulo compatível — hard block quando declarado fora do módulo da corrida
    const modulos = Array.isArray(r.modulos) && r.modulos.length > 0 ? r.modulos : [r.modulo];
    if (!modulos.includes(input.modulo)) {
      issues.push({
        kind: 'modulo_incompativel',
        severity: 'block',
        insumo: slim,
        message: `${r.nomeComercial} não está cadastrado para ${MODULO_RUN_CONFIG[input.modulo]?.label ?? input.modulo}.`,
      });
    }

    // 4. Imuno: lote reprovado → block, pendente → warn
    if (r.tipo === 'reagente' || r.tipo === 'tira-uro') {
      if (r.qcStatus === 'reprovado') {
        issues.push({
          kind: 'lote_reprovado',
          severity: 'block',
          insumo: slim,
          message: `${r.nomeComercial} (lote ${r.lote}) foi reprovado no CQ — uso bloqueado.${r.motivoReprovacao ? ` Motivo: ${r.motivoReprovacao}` : ''}`,
        });
      } else if (r.qcStatus === 'pendente') {
        issues.push({
          kind: 'lote_nao_aprovado',
          severity: 'warn',
          insumo: slim,
          message: `${r.nomeComercial} (lote ${r.lote}) ainda aguarda aprovação no CQ deste lote.`,
        });
      }
    }

    // 5. qcValidationRequired — warn (a própria corrida valida o reagente)
    if (hasQCValidationPending(r)) {
      issues.push({
        kind: 'qc_pendente',
        severity: 'warn',
        insumo: slim,
        message: `${r.nomeComercial} (lote ${r.lote}) foi aberto e aguarda validação por uma corrida de CQ aprovada.`,
      });
    }
  }

  const blockers = issues.filter((i) => i.severity === 'block');
  const warnings = issues.filter((i) => i.severity === 'warn');

  // Mínimo de reagentes por módulo (estrutural — não atrelado a um insumo)
  const config = MODULO_RUN_CONFIG[input.modulo];
  const minExpected = config?.minReagentes ?? 0;
  const minimoFaltando =
    minExpected > 0 && input.reagentes.length < minExpected
      ? { expected: minExpected, got: input.reagentes.length, modulo: config?.label ?? input.modulo }
      : null;

  const canProceed = blockers.length === 0 && minimoFaltando === null;

  return {
    canProceed,
    hasWarnings: warnings.length > 0,
    issues,
    blockers,
    warnings,
    minimoFaltando,
  };
}

/**
 * Subset dos kinds que podem ser superados com override auditado. Hoje: todos.
 * Reservado para o caso de ter regras que NÃO permitam override (ex: lote
 * descartado nunca deveria poder ser usado). Esse delta futuro vive aqui.
 */
export function isOverridable(_kind: ReagenteIssueKind): boolean {
  // Por ora todos são override-ables com justificativa. Reavaliar por kind
  // quando surgir caso concreto.
  return true;
}
