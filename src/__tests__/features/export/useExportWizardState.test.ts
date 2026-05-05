/**
 * Tests for useExportWizardStore Zustand store.
 * Covers step navigation, form field mutations, and reset behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useExportWizardStore } from '../../../features/export/hooks/useExportWizardState';

/** Reset store before each test to guarantee isolation */
function resetStore() {
  useExportWizardStore.setState({
    step: 1,
    format: null,
    startDate: '',
    endDate: '',
    isOpen: false,
    submittedJobId: null,
  });
}

describe('useExportWizardStore', () => {
  beforeEach(resetStore);

  // ── Initial state ─────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('starts at step 1', () => {
      const { step } = useExportWizardStore.getState();
      expect(step).toBe(1);
    });

    it('starts with no format selected', () => {
      const { format } = useExportWizardStore.getState();
      expect(format).toBeNull();
    });

    it('starts with empty dates', () => {
      const { startDate, endDate } = useExportWizardStore.getState();
      expect(startDate).toBe('');
      expect(endDate).toBe('');
    });

    it('starts closed', () => {
      const { isOpen } = useExportWizardStore.getState();
      expect(isOpen).toBe(false);
    });

    it('starts with no submitted job', () => {
      const { submittedJobId } = useExportWizardStore.getState();
      expect(submittedJobId).toBeNull();
    });
  });

  // ── Modal open/close ──────────────────────────────────────────────────────
  describe('open / close', () => {
    it('open() sets isOpen to true', () => {
      useExportWizardStore.getState().open();
      expect(useExportWizardStore.getState().isOpen).toBe(true);
    });

    it('open() resets step to 1', () => {
      // Pre-condition: advance to step 3
      useExportWizardStore.setState({ step: 3 });
      useExportWizardStore.getState().open();
      expect(useExportWizardStore.getState().step).toBe(1);
    });

    it('open() clears submittedJobId', () => {
      useExportWizardStore.setState({ submittedJobId: 'job-abc' });
      useExportWizardStore.getState().open();
      expect(useExportWizardStore.getState().submittedJobId).toBeNull();
    });

    it('close() sets isOpen to false', () => {
      useExportWizardStore.getState().open();
      useExportWizardStore.getState().close();
      expect(useExportWizardStore.getState().isOpen).toBe(false);
    });

    it('close() resets all form state', () => {
      useExportWizardStore.setState({
        step: 3,
        format: 'xlsx',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        submittedJobId: 'job-xyz',
      });
      useExportWizardStore.getState().close();

      const state = useExportWizardStore.getState();
      expect(state.step).toBe(1);
      expect(state.format).toBeNull();
      expect(state.startDate).toBe('');
      expect(state.endDate).toBe('');
      expect(state.submittedJobId).toBeNull();
    });
  });

  // ── Step navigation ───────────────────────────────────────────────────────
  describe('step navigation', () => {
    it('setStep() jumps directly to given step', () => {
      useExportWizardStore.getState().setStep(3);
      expect(useExportWizardStore.getState().step).toBe(3);
    });

    it('nextStep() advances from step 1 to 2', () => {
      useExportWizardStore.getState().nextStep();
      expect(useExportWizardStore.getState().step).toBe(2);
    });

    it('nextStep() advances from step 2 to 3', () => {
      useExportWizardStore.setState({ step: 2 });
      useExportWizardStore.getState().nextStep();
      expect(useExportWizardStore.getState().step).toBe(3);
    });

    it('nextStep() does not go past step 3', () => {
      useExportWizardStore.setState({ step: 3 });
      useExportWizardStore.getState().nextStep();
      expect(useExportWizardStore.getState().step).toBe(3);
    });

    it('prevStep() goes from step 2 to 1', () => {
      useExportWizardStore.setState({ step: 2 });
      useExportWizardStore.getState().prevStep();
      expect(useExportWizardStore.getState().step).toBe(1);
    });

    it('prevStep() does not go below step 1', () => {
      useExportWizardStore.getState().prevStep();
      expect(useExportWizardStore.getState().step).toBe(1);
    });

    it('prevStep() goes from step 3 to 2', () => {
      useExportWizardStore.setState({ step: 3 });
      useExportWizardStore.getState().prevStep();
      expect(useExportWizardStore.getState().step).toBe(2);
    });
  });

  // ── Format selection ──────────────────────────────────────────────────────
  describe('format selection', () => {
    it('setFormat() stores xlsx', () => {
      useExportWizardStore.getState().setFormat('xlsx');
      expect(useExportWizardStore.getState().format).toBe('xlsx');
    });

    it('setFormat() stores csv', () => {
      useExportWizardStore.getState().setFormat('csv');
      expect(useExportWizardStore.getState().format).toBe('csv');
    });

    it('setFormat() can switch format', () => {
      useExportWizardStore.getState().setFormat('xlsx');
      useExportWizardStore.getState().setFormat('csv');
      expect(useExportWizardStore.getState().format).toBe('csv');
    });
  });

  // ── Date range ────────────────────────────────────────────────────────────
  describe('date range', () => {
    it('setStartDate() updates startDate', () => {
      useExportWizardStore.getState().setStartDate('2026-01-01');
      expect(useExportWizardStore.getState().startDate).toBe('2026-01-01');
    });

    it('setEndDate() updates endDate', () => {
      useExportWizardStore.getState().setEndDate('2026-03-31');
      expect(useExportWizardStore.getState().endDate).toBe('2026-03-31');
    });

    it('start and end dates are independent', () => {
      useExportWizardStore.getState().setStartDate('2026-01-01');
      useExportWizardStore.getState().setEndDate('2026-06-30');

      const { startDate, endDate } = useExportWizardStore.getState();
      expect(startDate).toBe('2026-01-01');
      expect(endDate).toBe('2026-06-30');
    });
  });

  // ── Submitted job tracking ────────────────────────────────────────────────
  describe('submitted job', () => {
    it('setSubmittedJobId() stores the job id', () => {
      useExportWizardStore.getState().setSubmittedJobId('job-abc123');
      expect(useExportWizardStore.getState().submittedJobId).toBe('job-abc123');
    });

    it('setSubmittedJobId(null) clears the job id', () => {
      useExportWizardStore.setState({ submittedJobId: 'job-abc' });
      useExportWizardStore.getState().setSubmittedJobId(null);
      expect(useExportWizardStore.getState().submittedJobId).toBeNull();
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────────
  describe('reset', () => {
    it('reset() returns form to initial state without closing', () => {
      useExportWizardStore.setState({
        isOpen: true,
        step: 3,
        format: 'xlsx',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        submittedJobId: 'job-xyz',
      });

      useExportWizardStore.getState().reset();

      const state = useExportWizardStore.getState();
      expect(state.isOpen).toBe(true); // modal stays open
      expect(state.step).toBe(1);
      expect(state.format).toBeNull();
      expect(state.startDate).toBe('');
      expect(state.endDate).toBe('');
      expect(state.submittedJobId).toBeNull();
    });
  });

  // ── Integration: full wizard flow ─────────────────────────────────────────
  describe('full wizard flow', () => {
    it('completes a full flow: open → select format → set dates → confirm → close', () => {
      const store = useExportWizardStore.getState();

      // Open wizard
      store.open();
      expect(useExportWizardStore.getState().isOpen).toBe(true);
      expect(useExportWizardStore.getState().step).toBe(1);

      // Step 1: select format
      useExportWizardStore.getState().setFormat('xlsx');
      useExportWizardStore.getState().nextStep();
      expect(useExportWizardStore.getState().step).toBe(2);

      // Step 2: set date range
      useExportWizardStore.getState().setStartDate('2026-01-01');
      useExportWizardStore.getState().setEndDate('2026-03-31');
      useExportWizardStore.getState().nextStep();
      expect(useExportWizardStore.getState().step).toBe(3);

      // Step 3: confirm — simulate successful job submission
      useExportWizardStore.getState().setSubmittedJobId('job-finished');
      expect(useExportWizardStore.getState().submittedJobId).toBe('job-finished');

      // Close
      useExportWizardStore.getState().close();
      expect(useExportWizardStore.getState().isOpen).toBe(false);
      expect(useExportWizardStore.getState().submittedJobId).toBeNull();
    });
  });
});
