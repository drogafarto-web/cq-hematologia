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
 * Wizard form state persisted in Zustand during the 3-step export flow.
 */
export interface ExportWizardState {
  /** Current step: 1=Format, 2=DateRange, 3=Review */
  step: 1 | 2 | 3;
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
