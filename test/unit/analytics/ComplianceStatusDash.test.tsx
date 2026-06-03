/**
 * Unit tests for ComplianceStatusDash
 *
 * Mocks: Zustand analytics store hooks
 * Tests: rendering of 4 KPI cards, loading state, error state, empty state
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Hoisted mock state (resolved before imports) ────────────────────────────

const { mockAggregate, mockLoading, mockError } = vi.hoisted(() => {
  const mockAggregate = vi.fn();
  const mockLoading = vi.fn();
  const mockError = vi.fn();
  return { mockAggregate, mockLoading, mockError };
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../src/features/analytics/hooks/useAnalyticsCache', () => ({
  useAnalyticsAggregate: mockAggregate,
  useAnalyticsLoading: mockLoading,
  useAnalyticsError: mockError,
  useAnalyticsStore: Object.assign(
    vi.fn(() => ({})),
    {
      getState: vi.fn(() => ({})),
    },
  ),
}));

// Import after mocks are registered
import { ComplianceStatusDash } from '../../../src/features/analytics/components/ComplianceStatusDash';
import type { AnalyticsAggregate } from '../../../src/features/analytics/types/Analytics';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const makeAggregate = (overrides: Partial<AnalyticsAggregate> = {}): AnalyticsAggregate => ({
  labId: 'lab-test',
  totalRuns: 100,
  validRuns: 95,
  invalidRuns: 5,
  compliancePercent: 95,
  openNCs: 2,
  closedNCs: 8,
  ncResolutionRate: 80,
  avgResolutionDays: 3.5,
  avgProcessingHours: 1.8,
  retrabalhoCount: 3,
  retrabalhoPercent: 3,
  ncByModule: { 'ciq-imuno': 2 },
  ncAgeBuckets: { '7d': 2, '30d': 0, '60d': 0, '>60d': 0 },
  computedAt: new Date('2026-01-01T12:00:00Z'),
  dataAsOf: new Date('2026-01-01T11:00:00Z'),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ComplianceStatusDash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loaded state with data', () => {
    beforeEach(() => {
      mockAggregate.mockReturnValue(makeAggregate());
      mockLoading.mockReturnValue(false);
      mockError.mockReturnValue(null);
    });

    it('renders the compliance section', () => {
      render(<ComplianceStatusDash />);
      // Section title is present
      expect(screen.getByText(/Status de Conformidade/i)).toBeTruthy();
    });

    it('displays compliance percentage', () => {
      render(<ComplianceStatusDash />);
      expect(screen.getByText('95%')).toBeTruthy();
    });

    it('displays open NCs count', () => {
      render(<ComplianceStatusDash />);
      // The value "2" appears in the NCs card
      expect(screen.getByText('2')).toBeTruthy();
    });

    it('displays turnaround hours', () => {
      render(<ComplianceStatusDash />);
      expect(screen.getByText('1.8h')).toBeTruthy();
    });

    it('displays retrabalho percentage', () => {
      render(<ComplianceStatusDash />);
      expect(screen.getByText('3%')).toBeTruthy();
    });

    it('shows 4 KPI cards as list items', () => {
      render(<ComplianceStatusDash />);
      const items = screen.getAllByRole('listitem');
      expect(items.length).toBe(4);
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockAggregate.mockReturnValue(null);
      mockLoading.mockReturnValue(true);
      mockError.mockReturnValue(null);
    });

    it('renders skeleton cards (no actual values)', () => {
      render(<ComplianceStatusDash />);
      // In loading state, no numeric compliance shown
      expect(screen.queryByText('95%')).toBeNull();
      expect(screen.queryByText('1.8h')).toBeNull();
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      mockAggregate.mockReturnValue(null);
      mockLoading.mockReturnValue(false);
      mockError.mockReturnValue('Network error');
    });

    it('displays error message', () => {
      render(<ComplianceStatusDash />);
      expect(screen.getByText(/Network error/i)).toBeTruthy();
    });

    it('does not render KPI list on error', () => {
      render(<ComplianceStatusDash />);
      expect(screen.queryByRole('list')).toBeNull();
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockAggregate.mockReturnValue(null);
      mockLoading.mockReturnValue(false);
      mockError.mockReturnValue(null);
    });

    it('shows empty state notice', () => {
      render(<ComplianceStatusDash />);
      expect(screen.getByText(/Nenhum dado de analytics/i)).toBeTruthy();
    });
  });

  describe('compliance variant thresholds', () => {
    it('renders for high compliance (>= 95%)', () => {
      mockAggregate.mockReturnValue(makeAggregate({ validRuns: 95, totalRuns: 100 }));
      mockLoading.mockReturnValue(false);
      mockError.mockReturnValue(null);
      render(<ComplianceStatusDash />);
      expect(screen.getByText('95%')).toBeTruthy();
    });

    it('renders for low compliance (< 85%)', () => {
      mockAggregate.mockReturnValue(
        makeAggregate({ validRuns: 80, totalRuns: 100, compliancePercent: 80 }),
      );
      mockLoading.mockReturnValue(false);
      mockError.mockReturnValue(null);
      render(<ComplianceStatusDash />);
      expect(screen.getByText('80%')).toBeTruthy();
    });
  });
});
