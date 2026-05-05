/**
 * Export feature — supplementary type definitions
 * Re-exports core types and adds Wizard-specific state shapes.
 */

export type {
  ExportFormat,
  ExportJob,
  ExportJobStatus,
  ExportRequest,
  ExportInitiateResponse,
} from './index';

/**
 * Wizard form state persisted in Zustand during the 4-step export flow.
 * Phase 3.3: step 3 (Email) added as optional email delivery step.
 */
export interface ExportWizardState {
  /** Current step: 1=Format, 2=DateRange, 3=Email (optional), 4=Review */
  step: 1 | 2 | 3 | 4;
  /** Export format chosen in step 1 */
  format: import('./index').ExportFormat | null;
  /** ISO date string (YYYY-MM-DD) for range start */
  startDate: string;
  /** ISO date string (YYYY-MM-DD) for range end */
  endDate: string;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Job ID returned after successful submission (for tracking) */
  submittedJobId: string | null;
}
