/**
 * CIQ-Imuno Module Index
 *
 * Phase 5 Wave 4 — Task W4-A4
 * Exports all CIQ-Imuno components, services, and types for module routing
 * and hub integration.
 */

// Components
export { BancadaImunoView } from './components/BancadaImunoView';
export { CIQAuditor } from './components/CIQAuditor';
export { CIQImunoDashboard } from './components/CIQImunoDashboard';
export { CIQImunoForm } from './components/CIQImunoForm';
export { CIQImunoContent } from './components/CIQImunoContent';
export { CIQIndicadores } from './components/CIQIndicadores';
export { CIQRelatorioPrint } from './components/CIQRelatorioPrint';
export { CIQTestTypeManager } from './components/CIQTestTypeManager';
export { ImunoIADashboard } from './components/ImunoIADashboard';
export { LotDecisionModal } from './components/LotDecisionModal';
export { StripUploadComponent } from './components/StripUploadComponent';

// Form Schema & Types
export { CIQImunoFormSchema } from './components/CIQImunoForm.schema';
export type { CIQImunoFormData } from './components/CIQImunoForm.schema';

// Domain Types
export type { CIQImunoLot, CIQImunoRun } from './types/CIQImuno';
export type { TestType, Classification, RecommendedAction, StripImageMetadata } from './types';
