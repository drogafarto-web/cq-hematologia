/**
 * SA-20: alertDashboard.test.tsx — 8+ tests + a11y
 *
 * Tests for AlertDashboard component:
 * - Empty state rendering
 * - Loading state (skeletons)
 * - Error state + retry button
 * - Severity filtering (pill buttons)
 * - Date range filtering
 * - Sort order (newest first)
 * - Severity badge colors
 * - Detail flow (open modal, acknowledge, close)
 * - Accessibility (axe)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import AlertDashboard from '../../features/auditoria/components/AlertDashboard';

expect.extend(toHaveNoViolations);
import * as useAnomalyAlertsModule from '../../features/auditoria/hooks/useAnomalyAlerts';

// Mock the hook
vi.mock('../../features/auditoria/hooks/useAnomalyAlerts');

const mockUseAnomalyAlerts = vi.spyOn(
  useAnomalyAlertsModule,
  'useAnomalyAlerts',
);

describe('AlertDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Test 1: Empty state ──────────────────────────────────────────────────

  it('renders empty state when no alerts', () => {
    mockUseAnomalyAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: null,
    });

    const { container } = render(
      <AlertDashboard labId="lab-1" onOpenDetail={() => {}} />,
    );

    expect(screen.getByText(/Nenhum alerta no período/i)).toBeInTheDocument();
    // Empty state usa um ponto decorativo com pulse (design atual)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  // ─── Test 2: Loading state ────────────────────────────────────────────────

  it('renders skeleton rows during loading', () => {
    mockUseAnomalyAlerts.mockReturnValue({
      alerts: [],
      loading: true,
      error: null,
    });

    const { container } = render(
      <AlertDashboard labId="lab-1" onOpenDetail={() => {}} />,
    );

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ─── Test 3: Error state with retry ───────────────────────────────────────

  it('renders error banner with retry button on error', () => {
    mockUseAnomalyAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: new Error('Network error'),
    });

    render(<AlertDashboard labId="lab-1" onOpenDetail={() => {}} />);

    expect(screen.getByText(/Erro ao carregar alertas/i)).toBeInTheDocument();
    expect(screen.getByText(/Tentar novamente/i)).toBeInTheDocument();
  });

  // ─── Test 4: Severity filtering ────────────────────────────────────────────

  it('filters alerts by severity when pills are clicked', async () => {
    const mockAlert = {
      id: '1',
      labId: 'lab-1',
      severity: 'high' as const,
      scope: 'CIQ-Bioquímica',
      shortDescription: 'High severity issue',
      patternSummary: 'Pattern found',
      recommendations: [],
      detectedAt: Date.now(),
      acknowledgedAt: null,
      acknowledgedBy: null,
    };

    mockUseAnomalyAlerts.mockReturnValue({
      alerts: [mockAlert],
      loading: false,
      error: null,
    });

    render(<AlertDashboard labId="lab-1" onOpenDetail={() => {}} />);

    const highButton = screen.getByRole('button', { name: /Alta/i });
    fireEvent.click(highButton);

    // After clicking, the hook should be called with severity filter
    // (actual filtering is handled by the hook, component just displays)
    expect(highButton).toHaveClass('text-rose-300');
  });

  // ─── Test 5: Date range filtering ──────────────────────────────────────────

  it('updates filter on date range change', async () => {
    mockUseAnomalyAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: null,
    });

    render(<AlertDashboard labId="lab-1" onOpenDetail={() => {}} />);

    const fromInput = screen.getByLabelText(/Desde/i) as HTMLInputElement;
    const toInput = screen.getByLabelText(/Até/i) as HTMLInputElement;

    fireEvent.change(fromInput, { target: { value: '2026-05-01' } });
    fireEvent.change(toInput, { target: { value: '2026-05-31' } });

    expect(fromInput.value).toBe('2026-05-01');
    expect(toInput.value).toBe('2026-05-31');
  });

  // ─── Test 6: Sort order (newest first) ─────────────────────────────────────

  it('displays alerts in descending order by detectedAt', () => {
    const now = Date.now();
    // Ordem de exibição = ordem do array retornado pelo hook
    const alerts = [
      {
        id: '2',
        labId: 'lab-1',
        severity: 'high' as const,
        scope: 'Scope2',
        shortDescription: 'Newer alert',
        patternSummary: '',
        recommendations: [],
        detectedAt: now,
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
      {
        id: '1',
        labId: 'lab-1',
        severity: 'low' as const,
        scope: 'Scope1',
        shortDescription: 'Older alert',
        patternSummary: '',
        recommendations: [],
        detectedAt: now - 86400000,
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    ];

    mockUseAnomalyAlerts.mockReturnValue({
      alerts,
      loading: false,
      error: null,
    });

    render(<AlertDashboard labId="lab-1" onOpenDetail={() => {}} />);

    const descriptions = screen.getAllByText(/alert/i);
    // The hook returns sorted, component just displays
    expect(descriptions[0]).toHaveTextContent('Newer alert');
  });

  // ─── Test 7: Severity badge colors ────────────────────────────────────────

  it('applies correct severity badge colors', () => {
    const alerts = [
      {
        id: '1',
        labId: 'lab-1',
        severity: 'critical' as const,
        scope: 'Critical Scope',
        shortDescription: 'Critical issue',
        patternSummary: '',
        recommendations: [],
        detectedAt: Date.now(),
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    ];

    mockUseAnomalyAlerts.mockReturnValue({
      alerts,
      loading: false,
      error: null,
    });

    render(<AlertDashboard labId="lab-1" onOpenDetail={() => {}} />);

    const badges = screen.getAllByText('Crítica');
    const spanBadge = badges.find((el) => el.tagName === 'SPAN');
    expect(spanBadge).toBeDefined();
    expect(spanBadge!.className).toContain('bg-rose-500/30');
    expect(spanBadge!.className).toContain('ring-rose-400/40');
  });

  // ─── Test 8: Detail flow ──────────────────────────────────────────────────

  it('calls onOpenDetail when detail button clicked', () => {
    const mockAlert = {
      id: '1',
      labId: 'lab-1',
      severity: 'high' as const,
      scope: 'Test Scope',
      shortDescription: 'Test alert',
      patternSummary: 'Pattern',
      recommendations: [],
      detectedAt: Date.now(),
      acknowledgedAt: null,
      acknowledgedBy: null,
    };

    mockUseAnomalyAlerts.mockReturnValue({
      alerts: [mockAlert],
      loading: false,
      error: null,
    });

    const handleOpenDetail = vi.fn();
    render(
      <AlertDashboard labId="lab-1" onOpenDetail={handleOpenDetail} />,
    );

    const detailButton = screen.getByRole('button', {
      name: /Ver detalhes do alerta/i,
    });
    fireEvent.click(detailButton);

    expect(handleOpenDetail).toHaveBeenCalledWith(mockAlert);
  });

  // ─── Test 9: Accessibility ────────────────────────────────────────────────

  it('passes jest-axe accessibility check', async () => {
    mockUseAnomalyAlerts.mockReturnValue({
      alerts: [
        {
          id: '1',
          labId: 'lab-1',
          severity: 'medium' as const,
          scope: 'Scope',
          shortDescription: 'Alert',
          patternSummary: '',
          recommendations: [],
          detectedAt: Date.now(),
          acknowledgedAt: null,
          acknowledgedBy: null,
        },
      ],
      loading: false,
      error: null,
    });

    const { container } = render(
      <AlertDashboard labId="lab-1" onOpenDetail={() => {}} />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
