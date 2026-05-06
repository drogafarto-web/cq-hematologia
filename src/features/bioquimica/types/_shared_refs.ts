/**
 * bioquimica/types/_shared_refs.ts
 *
 * Tipos primitivos e referências cross-doc compartilhadas pelo módulo
 * bioquimica. Mantidos em arquivo separado para evitar ciclos quando
 * múltiplos types/*.ts precisam dos mesmos aliases.
 */

import type { Timestamp } from '../../../shared/services/firebase';

// Identidade — multi-tenant + auth.
export type LabId = string;
export type UserId = string;

// IDs de domínio (string opaca; checados em runtime no Firestore).
export type AnalitoId = string;
export type NivelId = string;
export type EquipmentId = string;

// ─── LogicalSignature ─────────────────────────────────────────────────────
//
// Wrapper auditável obrigatório em runs e traceability events.
// Hash é SHA-256 hex (64 chars) computado server-side em Cloud Function.
// `operatorId` deve igualar `request.auth.uid` — rules validam.

export interface LogicalSignature {
  readonly hash: string;
  readonly operatorId: UserId;
  readonly ts: Timestamp;
}

// ─── Validation blockers (compliance override) ─────────────────────────────
//
// Snapshot imutável do que estava bloqueando uma run no momento do override.
// Replicado da estrutura usada em hematologia (`RunComplianceOverride`),
// mantido enxuto para o caso bioquimica.

export interface ValidationBlocker {
  readonly kind: string;
  readonly insumoId: string;
  readonly insumoNome: string;
  readonly insumoLote: string;
  readonly message: string;
}
