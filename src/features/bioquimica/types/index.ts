/**
 * bioquimica/types/index.ts
 *
 * Barrel exports do domínio bioquimica. Consumidores devem importar daqui
 * (`import type { Analito } from './types'`), nunca do arquivo concreto.
 */

// Primitivos compartilhados
export type {
  AnalitoId,
  EquipmentId,
  LabId,
  LogicalSignature,
  NivelId,
  UserId,
  ValidationBlocker,
} from './_shared_refs';

// Analito
export type { Analito, AnalitoInput, RangeBiologico } from './analito';

// ControlMaterial
export type {
  AnalyteLevelStat,
  ControlLevel,
  ControlMaterial,
  ControlMaterialInput,
  ControlMaterialOrigem,
  ManufacturerStatsBio,
} from './controlMaterial';

// Run
export type {
  ReagenteSnapshot,
  Run,
  RunAproveitamento,
  RunComplianceOverride,
  RunInput,
  RunResultados,
  RunStatus,
} from './run';

// Westgard
export type {
  WestgardConfigPerAnalito,
  WestgardRule,
  WestgardRuleCLSI,
  WestgardRuleExtended,
  WestgardSeverity,
  WestgardViolation,
} from './westgard';
export { CLSI_RULES, EXTENDED_RULES } from './westgard';
