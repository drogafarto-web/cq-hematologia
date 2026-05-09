/**
 * AlertCenter.test.tsx
 *
 * Unit tests for AlertCenter component.
 * Verifies:
 * - Render alerts from hook
 * - Filter by severity
 * - Filter by operator
 * - Dismiss alert action
 * - Empty state rendering
 * - Pagination
 */

import React from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertCenter } from '../AlertCenter';
import * as useAnomalyAlertsHook from '../../hooks/useAnomalyAlerts';

// Mock the hook
vi.mock('../../hooks/useAnomalyAlerts');

// Mock auth store
vi.mock('../../../../store/useAuthStore', () => ({
  useActiveLabId: () => 'lab-test-123',
}));

describe('AlertCenter', () => {
  const mockAlert = {
    id: 'alert-001',
    labId: 'lab-test-123',
    severity: 'critical' as const,
    status: 'active' as const,
    routedTo: ['user-001'],
    createdAt: Date.now(),
    anomalyScore: {
      entryId: 'entry-001',
      labId: 'lab-test-123',
      operatorId: 'op-001',
      overallScore: 85,
      dimensions: [
        {
          dimension: 'operation_rarity' as const,
          score: 90,
          evidence: 'Operator rarely performs this action',
        },
        {
          dimension: 'time_anomaly' as const,
          score: 60,
          evidence: 'Operation outside normal hours',
        },
      ],
      computedAt: Date.now(),
    },
  };

  const mockAlertHigh = {
    ...mockAlert,
    id: 'alert-002',
    severity: 'high' as const,
    anomalyScore: {
      ...mockAlert.anomalyScore,
      operatorId: 'op-002',
    },
  };

  const mockAlertMedium = {
    ...mockAlert,
    id: 'alert-003',
    severity: 'medium' as const,
    anomalyScore: {
      ...mockAlert.anomalyScore,
      operatorId: 'op-003',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render alerts from hook', async () => {
    const mockDismiss = vi.fn().mockResolvedValue(undefined);
    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: [mockAlert, mockAlertHigh],
      loading: false,
      error: null,
      dismissAlert: mockDismiss,
    });

    render(<AlertCenter />);

    await waitFor(() => {
      expect(screen.getByText('Anomalias Detectadas')).toBeInTheDocument();
      expect(screen.getByText('2 anomalias ativas')).toBeInTheDocument();
    });
  });

  it('should filter alerts by severity', async () => {
    const mockDismiss = vi.fn().mockResolvedValue(undefined);
    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: [mockAlert, mockAlertHigh, mockAlertMedium],
      loading: false,
      error: null,
      dismissAlert: mockDismiss,
    });

    render(<AlertCenter />);

    // Filter by critical
    const severitySelect = screen.getByLabelText('Filtrar por severidade') as HTMLSelectElement;
    await userEvent.selectOptions(severitySelect, 'critical');

    await waitFor(() => {
      expect(screen.getByText('1 anomalia ativa')).toBeInTheDocument();
    });

    // Verify alert count in table
    const rows = screen.getAllByRole('button', { name: /Anomalia \d+/ });
    expect(rows.length).toBe(1);
  });

  it('should filter alerts by operator', async () => {
    const mockDismiss = vi.fn().mockResolvedValue(undefined);
    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: [mockAlert, mockAlertHigh, mockAlertMedium],
      loading: false,
      error: null,
      dismissAlert: mockDismiss,
    });

    render(<AlertCenter />);

    // Filter by operator op-002
    const operatorSelect = screen.getByLabelText('Filtrar por operador') as HTMLSelectElement;
    await userEvent.selectOptions(operatorSelect, 'op-002');

    await waitFor(() => {
      expect(screen.getByText('1 anomalia ativa')).toBeInTheDocument();
    });
  });

  it('should dismiss alert on button click', async () => {
    const mockDismiss = vi.fn().mockResolvedValue(undefined);
    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: [mockAlert],
      loading: false,
      error: null,
      dismissAlert: mockDismiss,
    });

    render(<AlertCenter />);

    await waitFor(() => {
      expect(screen.getByText('Anomalias Detectadas')).toBeInTheDocument();
    });

    const dismissButtons = screen.getAllByLabelText(/Descartar anomalia/);
    await userEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(mockDismiss).toHaveBeenCalledWith('alert-001', 'dismissed_from_dashboard');
    });
  });

  it('should render empty state when no alerts', () => {
    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: [],
      loading: false,
      error: null,
      dismissAlert: vi.fn(),
    });

    render(<AlertCenter />);

    const emptyStateElements = screen.getAllByText('Nenhuma anomalia detectada');
    expect(emptyStateElements.length).toBeGreaterThan(0);
  });

  it('should paginate alerts when exceeding 50 per page', async () => {
    const mockDismiss = vi.fn().mockResolvedValue(undefined);
    // Create 51 alerts
    const manyAlerts = Array.from({ length: 51 }, (_, i) => ({
      ...mockAlert,
      id: `alert-${i}`,
      anomalyScore: {
        ...mockAlert.anomalyScore,
        operatorId: `op-${i}`,
      },
    }));

    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: manyAlerts,
      loading: false,
      error: null,
      dismissAlert: mockDismiss,
    });

    const { rerender } = render(<AlertCenter />);

    await waitFor(() => {
      expect(screen.getByText('51 anomalias ativas')).toBeInTheDocument();
    });

    // First page should show 50
    let rows = screen.getAllByRole('button', { name: /Anomalia \d+/ });
    expect(rows.length).toBe(50);

    // Click next page
    const nextButton = screen.getByLabelText('Próxima página');
    await userEvent.click(nextButton);

    rerender(<AlertCenter />);

    // After navigation, button state should update
    await waitFor(() => {
      const nextBtn = screen.getByLabelText('Próxima página');
      expect(nextBtn).toBeDisabled();
    });
  });

  it('should display error when hook returns error', async () => {
    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: [],
      loading: false,
      error: 'Falha ao carregar alertas',
      dismissAlert: vi.fn(),
    });

    render(<AlertCenter />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar anomalias')).toBeInTheDocument();
      expect(screen.getByText('Falha ao carregar alertas')).toBeInTheDocument();
    });
  });

  it('should display loading state', async () => {
    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: [],
      loading: true,
      error: null,
      dismissAlert: vi.fn(),
    });

    render(<AlertCenter />);

    await waitFor(() => {
      expect(screen.getByText('Carregando anomalias...')).toBeInTheDocument();
    });
  });

  it('should call onDrillDown when row is clicked', async () => {
    const mockOnDrillDown = vi.fn();
    const mockDismiss = vi.fn().mockResolvedValue(undefined);
    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: [mockAlert],
      loading: false,
      error: null,
      dismissAlert: mockDismiss,
    });

    render(<AlertCenter onDrillDown={mockOnDrillDown} />);

    await waitFor(() => {
      expect(screen.getByText('Anomalias Detectadas')).toBeInTheDocument();
    });

    // Click "Investigar" button
    const investigateButton = screen.getByLabelText(/Investigar anomalia/);
    await userEvent.click(investigateButton);

    expect(mockOnDrillDown).toHaveBeenCalledWith(mockAlert);
  });

  it('should clear filters when clear button is clicked', async () => {
    const mockDismiss = vi.fn().mockResolvedValue(undefined);
    (useAnomalyAlertsHook.useAnomalyAlerts as any).mockReturnValue({
      alerts: [mockAlert, mockAlertHigh, mockAlertMedium],
      loading: false,
      error: null,
      dismissAlert: mockDismiss,
    });

    render(<AlertCenter />);

    // Apply a filter
    const severitySelect = screen.getByLabelText('Filtrar por severidade') as HTMLSelectElement;
    await userEvent.selectOptions(severitySelect, 'critical');

    await waitFor(() => {
      expect(screen.getByText('1 anomalia ativa')).toBeInTheDocument();
    });

    // Clear filters
    const clearButton = screen.getByLabelText('Limpar todos os filtros');
    await userEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('3 anomalias ativas')).toBeInTheDocument();
    });
  });
});
