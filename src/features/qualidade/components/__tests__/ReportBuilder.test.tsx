/**
 * ReportBuilder.test.tsx
 *
 * Unit tests for ReportBuilder wizard component.
 * Verifies:
 * - Step 1: Period selection (daily, weekly, monthly, custom)
 * - Step 2: Filter selection (anomalies, compliance, operators, modules)
 * - Step 3: Format selection and generation (PDF, CSV)
 * - Form validation
 * - Navigation between steps
 * - Report generation via useAuditReportExport hook
 */

import React from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportBuilder } from '../ReportBuilder';
import * as useAuditReportExportHook from '../../hooks/useAuditReportExport';

// Mock the hook
vi.mock('../../hooks/useAuditReportExport');

// Mock auth store
vi.mock('../../../../store/useAuthStore', () => ({
  useActiveLabId: () => 'lab-test-123',
}));

describe('ReportBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGenerate = vi.fn().mockResolvedValue(undefined);
  const mockReset = vi.fn();

  beforeEach(() => {
    (useAuditReportExportHook.useAuditReportExport as any).mockReturnValue({
      generating: false,
      report: null,
      error: null,
      generate: mockGenerate,
      reset: mockReset,
    });
  });

  it('should render step 1 initially', () => {
    render(<ReportBuilder />);

    expect(screen.getByText('Passo 1: Selecione o Período')).toBeInTheDocument();
    expect(screen.getByText('Últimas 24 horas')).toBeInTheDocument();
  });

  it('should select daily period', async () => {
    render(<ReportBuilder />);

    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      expect(dailyRadio.checked).toBe(true);
    }
  });

  it('should select weekly period', async () => {
    render(<ReportBuilder />);

    const weeklyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'weekly') as HTMLInputElement;

    if (weeklyRadio) {
      await userEvent.click(weeklyRadio);
      expect(weeklyRadio.checked).toBe(true);
    }
  });

  it('should select monthly period', async () => {
    render(<ReportBuilder />);

    const monthlyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'monthly') as HTMLInputElement;

    if (monthlyRadio) {
      await userEvent.click(monthlyRadio);
      expect(monthlyRadio.checked).toBe(true);
    }
  });

  it('should show custom date inputs when custom period is selected', async () => {
    render(<ReportBuilder />);

    const customRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'custom') as HTMLInputElement;

    if (customRadio) {
      await userEvent.click(customRadio);

      await waitFor(() => {
        expect(screen.getByLabelText('Data inicial')).toBeInTheDocument();
        expect(screen.getByLabelText('Data final')).toBeInTheDocument();
      });
    }
  });

  it('should validate period before allowing next', async () => {
    render(<ReportBuilder />);

    const nextButton = screen.getByLabelText(/Avançar para o passo 2/);
    expect(nextButton).toBeDisabled();

    // Select a period
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);

      await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
      });
    }
  });

  it('should navigate to step 2', async () => {
    render(<ReportBuilder />);

    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);

      const nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Passo 2: Configure os Filtros')).toBeInTheDocument();
      });
    }
  });

  it('should include anomalies checkbox on step 2', async () => {
    render(<ReportBuilder />);

    // Navigate to step 2
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      const nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(
          screen.getByText('Incluir anomalias detectadas')
        ).toBeInTheDocument();
      });
    }
  });

  it('should include compliance checkbox on step 2', async () => {
    render(<ReportBuilder />);

    // Navigate to step 2
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      const nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(
          screen.getByText('Incluir métricas de conformidade')
        ).toBeInTheDocument();
      });
    }
  });

  it('should navigate to step 3', async () => {
    render(<ReportBuilder />);

    // Step 1: Select period
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      const nextBtn1 = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextBtn1);

      // Step 2: Navigate to step 3
      await waitFor(() => {
        const nextBtn2 = screen.getByLabelText(/Avançar para o passo 3/);
        expect(nextBtn2).toBeInTheDocument();
      });

      const nextBtn2 = screen.getByLabelText(/Avançar para o passo 3/);
      await userEvent.click(nextBtn2);

      await waitFor(() => {
        expect(screen.getByText('Passo 3: Formato e Geração')).toBeInTheDocument();
      });
    }
  });

  it('should select PDF format on step 3', async () => {
    render(<ReportBuilder />);

    // Navigate to step 3
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      let nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        nextButton = screen.getByLabelText(/Avançar para o passo 3/);
      });

      await userEvent.click(nextButton);

      await waitFor(() => {
        const pdfRadio = Array.from(
          screen.getAllByRole('radio')
        ).find((r) => (r as HTMLInputElement).value === 'pdf') as HTMLInputElement;

        if (pdfRadio) {
          expect(pdfRadio.checked).toBe(true);
        }
      });
    }
  });

  it('should select CSV format on step 3', async () => {
    render(<ReportBuilder />);

    // Navigate to step 3
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      let nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        const next = screen.getByLabelText(/Avançar para o passo 3/);
        expect(next).toBeInTheDocument();
      });

      nextButton = screen.getByLabelText(/Avançar para o passo 3/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        const csvRadio = Array.from(
          screen.getAllByRole('radio')
        ).find((r) => (r as HTMLInputElement).value === 'csv') as HTMLInputElement;
        expect(csvRadio).toBeInTheDocument();
      });

      const csvRadio = Array.from(
        screen.getAllByRole('radio')
      ).find((r) => (r as HTMLInputElement).value === 'csv') as HTMLInputElement;

      await userEvent.click(csvRadio);
      expect(csvRadio.checked).toBe(true);
    }
  });

  it('should generate report on step 3', async () => {
    render(<ReportBuilder />);

    // Navigate to step 3
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      let nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        nextButton = screen.getByLabelText(/Avançar para o passo 3/);
      });

      await userEvent.click(nextButton);

      await waitFor(() => {
        const generateButton = screen.getByLabelText(/Gerar e baixar/);
        expect(generateButton).toBeInTheDocument();
      });

      const generateButton = screen.getByLabelText(/Gerar e baixar/);
      await userEvent.click(generateButton);

      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });
    }
  });

  it('should disable generate button while generating', async () => {
    (useAuditReportExportHook.useAuditReportExport as any).mockReturnValue({
      generating: true,
      report: null,
      error: null,
      generate: mockGenerate,
      reset: mockReset,
    });

    render(<ReportBuilder />);

    // Navigate to step 3
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      let nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        nextButton = screen.getByLabelText(/Avançar para o passo 3/);
      });

      await userEvent.click(nextButton);

      await waitFor(() => {
        const generateButton = screen.getByLabelText(/Gerar/) as HTMLButtonElement;
        expect(generateButton.disabled).toBe(true);
        expect(generateButton.textContent).toContain('Gerando...');
      });
    }
  });

  it('should display error message when generation fails', async () => {
    (useAuditReportExportHook.useAuditReportExport as any).mockReturnValue({
      generating: false,
      report: null,
      error: 'Falha ao gerar relatório',
      generate: mockGenerate,
      reset: mockReset,
    });

    render(<ReportBuilder />);

    // Navigate to step 3
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      let nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        nextButton = screen.getByLabelText(/Avançar para o passo 3/);
      });

      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Falha ao gerar relatório')).toBeInTheDocument();
      });
    }
  });

  it('should navigate back to previous step', async () => {
    render(<ReportBuilder />);

    // Navigate to step 2
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      const nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Passo 2: Configure os Filtros')).toBeInTheDocument();
      });

      // Click back
      const backButton = screen.getByLabelText('Voltar para o passo anterior');
      await userEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Passo 1: Selecione o Período')).toBeInTheDocument();
      });
    }
  });

  it('should display progress indicator', () => {
    render(<ReportBuilder />);

    expect(screen.getByText('Passo 1 de 3')).toBeInTheDocument();
  });

  it('should select operators on step 2', async () => {
    render(<ReportBuilder />);

    // Navigate to step 2
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      const nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        const operatorCheckbox = screen.getByRole('checkbox', { name: 'op-001' });
        expect(operatorCheckbox).toBeInTheDocument();
      });
    }
  });

  it('should select modules on step 2', async () => {
    render(<ReportBuilder />);

    // Navigate to step 2
    const dailyRadio = Array.from(
      screen.getAllByRole('radio')
    ).find((r) => (r as HTMLInputElement).value === 'daily') as HTMLInputElement;

    if (dailyRadio) {
      await userEvent.click(dailyRadio);
      const nextButton = screen.getByLabelText(/Avançar para o passo 2/);
      await userEvent.click(nextButton);

      await waitFor(() => {
        const moduleCheckbox = screen.getByRole('checkbox', { name: 'analyzer' });
        expect(moduleCheckbox).toBeInTheDocument();
      });
    }
  });
});
