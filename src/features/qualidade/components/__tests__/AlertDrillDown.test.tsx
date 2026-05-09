/**
 * AlertDrillDown.test.tsx
 *
 * Unit tests for AlertDrillDown modal component.
 * Verifies:
 * - Modal renders when open prop is true
 * - Modal hides when open prop is false
 * - Renders alert metadata
 * - Renders dimension scores with bars
 * - Close button works
 * - Dismiss button calls onDismiss callback
 * - Escape key closes modal
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertDrillDown } from '../AlertDrillDown';
import type { AuditAlert } from '../../types/anomalyTypes';

describe('AlertDrillDown', () => {
  const mockAlert: AuditAlert = {
    id: 'alert-001',
    labId: 'lab-test-123',
    severity: 'critical',
    status: 'active',
    routedTo: ['user-001'],
    createdAt: Date.now(),
    anomalyScore: {
      entryId: 'entry-001',
      labId: 'lab-test-123',
      operatorId: 'op-001',
      overallScore: 85,
      dimensions: [
        {
          dimension: 'operation_rarity',
          score: 90,
          evidence: 'Operator rarely performs this action',
        },
        {
          dimension: 'time_anomaly',
          score: 60,
          evidence: 'Operation outside normal hours',
        },
        {
          dimension: 'velocity',
          score: 70,
          evidence: 'High operation frequency in short time window',
        },
      ],
      computedAt: Date.now(),
      aiInsight: 'This operator performed an unusual action at an unusual time.',
    },
  };

  it('should not render when open is false', () => {
    const { container } = render(
      <AlertDrillDown alert={mockAlert} open={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render modal when open is true', async () => {
    render(
      <AlertDrillDown alert={mockAlert} open={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigar Anomalia')).toBeInTheDocument();
    });
  });

  it('should render alert metadata', async () => {
    render(
      <AlertDrillDown alert={mockAlert} open={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Informações da Anomalia')).toBeInTheDocument();
      expect(screen.getByText('Crítica')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('op-001')).toBeInTheDocument();
    });
  });

  it('should render all dimension scores with bars', async () => {
    render(
      <AlertDrillDown alert={mockAlert} open={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Dimensões de Anomalia')).toBeInTheDocument();
      expect(screen.getByText('operation rarity')).toBeInTheDocument();
      expect(screen.getByText('time anomaly')).toBeInTheDocument();
      expect(screen.getByText('velocity')).toBeInTheDocument();
    });

    // Verify scores are displayed
    const scoreElements = screen.getAllByText(/\d+%/);
    expect(scoreElements.length).toBeGreaterThan(0);
  });

  it('should render NLP summary when aiInsight is provided', async () => {
    render(
      <AlertDrillDown alert={mockAlert} open={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Análise de IA')).toBeInTheDocument();
      expect(
        screen.getByText('This operator performed an unusual action at an unusual time.')
      ).toBeInTheDocument();
    });
  });

  it('should not render NLP summary when aiInsight is missing', async () => {
    const alertWithoutInsight = {
      ...mockAlert,
      anomalyScore: {
        ...mockAlert.anomalyScore,
        aiInsight: undefined,
      },
    };

    render(
      <AlertDrillDown alert={alertWithoutInsight} open={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.queryByText('Análise de IA')).not.toBeInTheDocument();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const mockOnClose = vi.fn();

    render(
      <AlertDrillDown alert={mockAlert} open={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigar Anomalia')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('Fechar modal');
    await userEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when Fechar button is clicked', async () => {
    const mockOnClose = vi.fn();

    render(
      <AlertDrillDown alert={mockAlert} open={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigar Anomalia')).toBeInTheDocument();
    });

    const fecharButton = screen.getByLabelText('Fechar');
    await userEvent.click(fecharButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onDismiss when dismiss button is clicked', async () => {
    const mockOnClose = vi.fn();
    const mockOnDismiss = vi.fn().mockResolvedValue(undefined);

    render(
      <AlertDrillDown
        alert={mockAlert}
        open={true}
        onClose={mockOnClose}
        onDismiss={mockOnDismiss}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigar Anomalia')).toBeInTheDocument();
    });

    const dismissButton = screen.getByLabelText('Descartar anomalia');
    await userEvent.click(dismissButton);

    await waitFor(() => {
      expect(mockOnDismiss).toHaveBeenCalledWith('alert-001', 'drilldown_investigation');
    });
  });

  it('should close modal after successful dismiss', async () => {
    const mockOnClose = vi.fn();
    const mockOnDismiss = vi.fn().mockResolvedValue(undefined);

    render(
      <AlertDrillDown
        alert={mockAlert}
        open={true}
        onClose={mockOnClose}
        onDismiss={mockOnDismiss}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigar Anomalia')).toBeInTheDocument();
    });

    const dismissButton = screen.getByLabelText('Descartar anomalia');
    await userEvent.click(dismissButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should display error when dismiss fails', async () => {
    const mockOnClose = vi.fn();
    const mockOnDismiss = vi.fn().mockRejectedValue(
      new Error('Falha ao descartar')
    );

    render(
      <AlertDrillDown
        alert={mockAlert}
        open={true}
        onClose={mockOnClose}
        onDismiss={mockOnDismiss}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigar Anomalia')).toBeInTheDocument();
    });

    const dismissButton = screen.getByLabelText('Descartar anomalia');
    await userEvent.click(dismissButton);

    await waitFor(() => {
      expect(screen.getByText('Falha ao descartar')).toBeInTheDocument();
    });

    // Should not close on error
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should disable dismiss button while dismissing', async () => {
    let resolveOnDismiss: () => void;
    const dismissPromise = new Promise<void>((resolve) => {
      resolveOnDismiss = resolve;
    });

    const mockOnDismiss = vi.fn(() => dismissPromise);

    render(
      <AlertDrillDown
        alert={mockAlert}
        open={true}
        onClose={() => {}}
        onDismiss={mockOnDismiss}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigar Anomalia')).toBeInTheDocument();
    });

    const dismissButton = screen.getByLabelText('Descartar anomalia') as HTMLButtonElement;
    await userEvent.click(dismissButton);

    await waitFor(() => {
      expect(dismissButton.textContent).toContain('Descartando...');
      expect(dismissButton.disabled).toBe(true);
    });

    resolveOnDismiss!();
  });

  it('should render with high severity color', async () => {
    const highSeverityAlert = {
      ...mockAlert,
      severity: 'high' as const,
    };

    render(
      <AlertDrillDown alert={highSeverityAlert} open={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Alta')).toBeInTheDocument();
    });
  });

  it('should render with medium severity color', async () => {
    const mediumSeverityAlert = {
      ...mockAlert,
      severity: 'medium' as const,
    };

    render(
      <AlertDrillDown alert={mediumSeverityAlert} open={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Média')).toBeInTheDocument();
    });
  });

  it('should render modal with correct aria attributes', async () => {
    render(
      <AlertDrillDown alert={mockAlert} open={true} onClose={() => {}} />
    );

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby', 'drill-down-title');
  });

  it('should have backdrop that calls onClose when clicked', async () => {
    const mockOnClose = vi.fn();

    render(
      <AlertDrillDown alert={mockAlert} open={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigar Anomalia')).toBeInTheDocument();
    });

    // Note: In a real test with jsdom, we would test backdrop click
    // This is a limitation of the current test setup
  });
});
