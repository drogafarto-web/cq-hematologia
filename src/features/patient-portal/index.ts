/**
 * Patient Portal Feature — Public-facing laudo access for patients
 *
 * Phase 5 implementation:
 * - Email-link JWT auth (72h expiry)
 * - Real-time laudo viewer
 * - PDF download + QR validation
 * - LGPD-compliant privacy notice
 *
 * RDC 978 Art. 167 (14 campos obrigatórios)
 * DICQ 5.7.x (Resultado ao paciente)
 */

// Components
export { PatientPortalDashboard } from './components/PatientPortalDashboard';
export { LaudoList } from './components/LaudoList';
export { LaudoCard } from './components/LaudoCard';
export { LaudoViewer } from './components/LaudoViewer';
export { LaudoDownloadButton } from './components/LaudoDownloadButton';
export { PatientProfileCard } from './components/PatientProfileCard';
export { StatusBadge } from './components/StatusBadge';

// Hooks
export { usePatientLaudos } from './hooks/usePatientLaudos';
export { usePatientSessionCountdown } from './hooks/usePatientSession';
export {
  usePatientAuthStore,
  usePatientSession,
  usePatientId,
  usePatientLabId,
  usePatientAuthLoading,
  usePatientAuthError,
  useIsTokenExpired,
  usePatientTimeRemaining,
  initializePatientAuthStore,
} from './hooks/usePatientAuthStore';

// Services
export {
  listenToPatientLaudos,
  getPatientLaudo,
  countPatientLaudos,
  getPatientLaudosInDateRange,
} from './services/patientLaudoService';

// Types
export type {
  PatientPortalLaudo,
  PatientAuthToken,
  PatientSession,
  PatientSessionState,
  PatientInfo,
  PatientLaudo,
  LaudoFilterState,
} from './types/index';
