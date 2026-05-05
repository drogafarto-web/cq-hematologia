/**
 * Tests for ExportWizard component.
 * Tests step flow, step indicator, navigation, and cancel/close behaviour.
 * Firebase and useExportInitiate are mocked — no real network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useExportWizardStore } from '../../../src/features/export/hooks/useExportWizardState';

// ── Mock Cloud Callable (no real Firebase) ────────────────────────────────────
vi.mock('../../../src/features/export/hooks/useExportInitiate', () => ({
  useExportInitiate: () => ({
    submit: vi.fn().mockResolvedValue({
      jobId: 'test-job-001',
      status: 'queued',
      estimatedMinutes: 2,
      createdAt: new Date().toISOString(),
    }),
    loading: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

vi.mock('../../../src/config/firebase.config', () => ({
  functions: {},
  db: {},
  auth: {},
  storage: {},
}));

// Import after mocks
import { ExportWizard } from '../../../src/features/export/components/ExportWizard';

const LAB_ID = 'lab-test-123';
const OPERATOR_ID = 'user-op-456';

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

describe('ExportWizard', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders step 1 content when opened', () => {
    useExportWizardStore.getState().open();
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    expect(screen.queryByText(/exportar dados/i)).not.toBeNull();
    expect(screen.queryByText(/passo 1 de 3/i)).not.toBeNull();
  });

  it('shows format selection cards in step 1', () => {
    useExportWizardStore.getState().open();
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    expect(screen.queryByText(/XLSX — CIQ Completo/i)).not.toBeNull();
    expect(screen.queryByText(/XLSX — Não Conformidades/i)).not.toBeNull();
  });

  it('Next button is disabled until format is selected', () => {
    useExportWizardStore.getState().open();
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    const nextBtn = screen.getByRole('button', { name: /próximo/i });
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('Next button enables after selecting a format', () => {
    useExportWizardStore.getState().open();
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    const xlsxCard = screen.getByRole('button', { name: /XLSX — CIQ Completo/i });
    fireEvent.click(xlsxCard);

    const nextBtn = screen.getByRole('button', { name: /próximo/i });
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('advances to step 2 after selecting format and clicking Next', () => {
    useExportWizardStore.getState().open();
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    fireEvent.click(screen.getByRole('button', { name: /XLSX — CIQ Completo/i }));
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));

    expect(screen.queryByText(/passo 2 de 3/i)).not.toBeNull();
    expect(screen.queryByLabelText(/data inicial/i)).not.toBeNull();
    expect(screen.queryByLabelText(/data final/i)).not.toBeNull();
  });

  it('shows step indicator with correct progression', () => {
    useExportWizardStore.setState({ isOpen: true, step: 2, format: 'xlsx' });
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    expect(screen.queryByText(/passo 2 de 3/i)).not.toBeNull();
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('2');
    expect(progressbar.getAttribute('aria-valuemax')).toBe('3');
  });

  it('Back button on step 2 returns to step 1', () => {
    useExportWizardStore.setState({ isOpen: true, step: 2, format: 'xlsx' });
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(screen.queryByText(/passo 1 de 3/i)).not.toBeNull();
  });

  it('Cancel button on step 1 closes the wizard', () => {
    useExportWizardStore.getState().open();
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(useExportWizardStore.getState().isOpen).toBe(false);
  });

  it('advances to step 3 after setting valid date range', () => {
    useExportWizardStore.setState({
      isOpen: true,
      step: 2,
      format: 'xlsx',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    });
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    expect(screen.queryByText(/passo 3 de 3/i)).not.toBeNull();
  });

  it('shows review summary on step 3', () => {
    useExportWizardStore.setState({
      isOpen: true,
      step: 3,
      format: 'xlsx',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    });
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    // Step 3 subtitle says "Passo 3 de 3" and title contains "Confirmar"
    expect(screen.queryByText(/passo 3 de 3/i)).not.toBeNull();
    // Review card shows the format label
    expect(screen.queryByText(/XLSX — CIQ Completo/i)).not.toBeNull();
    // Gerar exportação button appears on step 3
    expect(screen.queryByText(/gerar exportação/i)).not.toBeNull();
  });

  it('shows success view after job is submitted', () => {
    useExportWizardStore.setState({
      isOpen: true,
      step: 3,
      format: 'xlsx',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      submittedJobId: 'job-success-001',
    });
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    expect(screen.queryByText(/exportação em fila/i)).not.toBeNull();
    expect(screen.queryByText(/job-success-001/i)).not.toBeNull();
  });

  it('step 2 Next is disabled when dates are not set', () => {
    useExportWizardStore.setState({
      isOpen: true,
      step: 2,
      format: 'xlsx',
      startDate: '',
      endDate: '',
    });
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    const nextBtn = screen.getByRole('button', { name: /próximo/i });
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('step 2 Next is disabled when end date is before start date', () => {
    useExportWizardStore.setState({
      isOpen: true,
      step: 2,
      format: 'xlsx',
      startDate: '2026-05-01',
      endDate: '2026-01-01',
    });
    render(<ExportWizard labId={LAB_ID} operatorId={OPERATOR_ID} />);

    const nextBtn = screen.getByRole('button', { name: /próximo/i });
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
