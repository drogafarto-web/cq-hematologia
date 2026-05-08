/**
 * src/features/admin/index.ts
 * Admin module exports
 */

export { SuperAdminDashboard } from './SuperAdminDashboard';
export { ConsentBackfillManager } from './ConsentBackfillManager';
export { ConsentBackfillDashboard } from './ConsentBackfillDashboard';
export { useConsentBackfillPhases } from './hooks/useConsentBackfillPhases';

export type {
  ConsentBackfillPhase,
  BackfillStats,
} from './hooks/useConsentBackfillPhases';
