/**
 * bioquimica/types/run.ts
 *
 * Schema de Run bioquímica — 1 captura de N analitos × 1 nivel × 1 equipamento.
 *
 * Granularidade decidida em CONTEXT (CTO lock 2026-05-06): 1 run agrega
 * todos os analitos medidos numa única corrida do equipamento. Alinha com o
 * workflow Riopomba que captura todo o painel de uma vez no analyzer.
 *
 * Westgard é avaliado server-side em `recordRunBioquimica` callable — client
 * NÃO computa violations (Threat T5 do CONTEXT).
 *
 * Imutabilidade: rules `allow update, delete: if false` em runs após
 * signature. Override registrado em `complianceOverride` com snapshot
 * congelado dos blockers no momento.
 *
 * Compliance: RDC 978/2025 Art. 128 (rastreabilidade insumos), Art. 167
 * (laudo); DICQ 4.3 Bloco F 5.6.3.1 (registro de runs).
 */

import type { Timestamp } from '../../../shared/services/firebase';
import type {
  AnalitoId,
  EquipmentId,
  LabId,
  LogicalSignature,
  NivelId,
  UserId,
  ValidationBlocker,
} from './_shared_refs';
import type { WestgardViolation } from './westgard';

// ─── Status ───────────────────────────────────────────────────────────────

export type RunStatus = 'Aprovada' | 'Rejeitada' | 'Pendente';

// ─── Aproveitamento estatístico ───────────────────────────────────────────
//
// Decidido server-side a partir de `complianceOverride.blockers`. Operador
// NÃO escolhe diretamente. Replica do pattern hematologia para consistência.

export type RunAproveitamento = 'oficial' | 'informativa';

// ─── Reagente snapshot ────────────────────────────────────────────────────
//
// Imutável após signature — preserva FR-10 (rastreabilidade insumos)
// mesmo se o doc mestre do insumo for alterado depois.

export interface ReagenteSnapshot {
  readonly id: string;
  readonly nomeComercial: string;
  readonly fabricante: string;
  readonly lote: string;
}

// ─── Compliance override ──────────────────────────────────────────────────

export interface RunComplianceOverride {
  readonly justificativa: string;
  readonly overriddenAt: Timestamp;
  readonly overriddenBy: UserId;
  /** Snapshot congelado — blockers ativos no momento do override. */
  readonly blockers: ReadonlyArray<ValidationBlocker>;
  /** Assinatura do operador que aprovou override (auditoria forte). */
  readonly signature: LogicalSignature;
}

// ─── Resultados ───────────────────────────────────────────────────────────
//
// Map aninhado: `resultados[analitoId][nivelId] = number`. Permite uma única
// run gravar 17 analitos × 2 níveis = 34 valores numa transação.

export type RunResultados = Record<AnalitoId, Record<NivelId, number>>;

// ─── Run ──────────────────────────────────────────────────────────────────

export interface Run {
  readonly id: string;
  readonly labId: LabId;

  readonly equipmentId: EquipmentId;
  readonly lotId: string;
  readonly operatorId: UserId;

  /** Momento da captura no equipamento (vs. `criadoEm` que é gravação). */
  readonly capturaEm: Timestamp;

  readonly resultados: RunResultados;

  /** Saída do engine Westgard (server-side). Vazio = sem violações. */
  readonly violations: ReadonlyArray<WestgardViolation>;

  readonly status: RunStatus;

  /** `informativa` quando override removeu run da estatística do lote. */
  readonly aproveitamento: RunAproveitamento;

  /** Snapshot dos reagentes em uso — imutável (FR-10 RDC 978). */
  readonly reagentesSnapshot: ReadonlyArray<ReagenteSnapshot>;

  /** Presente apenas quando operador conscientemente burlou um bloqueio. */
  readonly complianceOverride?: RunComplianceOverride;

  /** Assinatura lógica server-computed (Plan 09-04). */
  readonly signature: LogicalSignature;

  /** chainHash server-side — encadeamento criptográfico (ADR 0001). */
  readonly chainHash: string;

  readonly criadoEm: Timestamp;
}

/**
 * Input DTO para `recordRunBioquimica` callable. Service é a única fonte de
 * `id`, `labId`, `criadoEm`, `chainHash` e `signature` (gerados server-side).
 * `violations`, `status` e `aproveitamento` são também computados server-side
 * — client envia só o que mediu.
 */
export type RunInput = Omit<
  Run,
  | 'id'
  | 'labId'
  | 'criadoEm'
  | 'chainHash'
  | 'signature'
  | 'violations'
  | 'status'
  | 'aproveitamento'
>;
