/**
 * Zustand store for the Export Wizard 3-step form state.
 * Manages step navigation, format selection, date range, and post-submission tracking.
 */

import { create } from 'zustand';
import type { ExportWizardState } from '../types/Exports';
import type { ExportFormat } from '../types';

interface ExportWizardActions {
  /** Open the wizard modal */
  open: () => void;
  /** Close the wizard and reset all state */
  close: () => void;
  /** Advance to a specific step */
  setStep: (step: 1 | 2 | 3 | 4) => void;
  /** Go to next step (capped at 3) */
  nextStep: () => void;
  /** Go to previous step (floored at 1) */
  prevStep: () => void;
  /** Set export format selection */
  setFormat: (format: ExportFormat) => void;
  /** Set ISO date string for range start (YYYY-MM-DD) */
  setStartDate: (date: string) => void;
  /** Set ISO date string for range end (YYYY-MM-DD) */
  setEndDate: (date: string) => void;
  /** Record the submitted job ID after successful initiation */
  setSubmittedJobId: (jobId: string | null) => void;
  /** Reset wizard form to initial state without closing */
  reset: () => void;
}

const INITIAL_STATE: ExportWizardState = {
  step: 1,
  format: null,
  startDate: '',
  endDate: '',
  isOpen: false,
  submittedJobId: null,
};

export const useExportWizardStore = create<ExportWizardState & ExportWizardActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    open: () => set({ isOpen: true, step: 1, submittedJobId: null }),

    close: () => set({ ...INITIAL_STATE }),

    setStep: (step) => set({ step }),

    nextStep: () => {
      const current = get().step;
      if (current < 4) set({ step: (current + 1) as 1 | 2 | 3 | 4 });
    },

    prevStep: () => {
      const current = get().step;
      if (current > 1) set({ step: (current - 1) as 1 | 2 | 3 | 4 });
    },

    setFormat: (format) => set({ format }),

    setStartDate: (startDate) => set({ startDate }),

    setEndDate: (endDate) => set({ endDate }),

    setSubmittedJobId: (submittedJobId) => set({ submittedJobId }),

    reset: () =>
      set({
        step: 1 as const,
        format: null,
        startDate: '',
        endDate: '',
        submittedJobId: null,
      }),
  }),
);
