/**
 * Unit tests for React analytics hooks and helpers
 *
 * Tests validate:
 * - Metrics formatting for display
 * - Staleness detection (>30min old)
 * - Helper function correctness
 *
 * Phase 3.1: Structural tests for helpers.
 * Phase 3.2: Add React Testing Library tests for hook with mocked Firestore.
 */

import { describe, it, expect } from 'vitest';
import { formatAnalyticsMetrics, isAnalyticsStale } from '../../../src/features/analytics/hooks/useAnalytics';
import type { CIQComplianceMetrics, AnalyticsMetadata } from '../../../src/features/analytics/types';

describe('useAnalytics helpers', () => {
  const mockMetrics: CIQComplianceMetrics = {
    totalRuns: 100,
    validRuns: 87,
    invalidRuns: 13,
    openNCs: 5,
    closedNCs: 12,
    compliancePercent: 87,
    ncResolutionRate: 71,
    avgResolutionDays: 3.5,
    avgProcessingHours: 2.1,
    computedAt: new Date(),
    dataAsOf: new Date(),
  };

  describe('formatAnalyticsMetrics', () => {
    it('formats compliance percent as percentage label', () => {
      const formatted = formatAnalyticsMetrics(mockMetrics);
      expect(formatted.complianceLabel).toContain('87%');
      expect(formatted.complianceLabel).toContain('conformidade');
    });

    it('formats resolution rate label', () => {
      const formatted = formatAnalyticsMetrics(mockMetrics);
      expect(formatted.resolutionLabel).toContain('71%');
      expect(formatted.resolutionLabel).toContain('resolvido');
    });

    it('formats average resolution days with 1 decimal', () => {
      const formatted = formatAnalyticsMetrics(mockMetrics);
      expect(formatted.avgResolutionLabel).toContain('3.5');
      expect(formatted.avgResolutionLabel).toContain('dias');
    });

    it('formats runs summary as valid/total', () => {
      const formatted = formatAnalyticsMetrics(mockMetrics);
      expect(formatted.runsSummary).toContain('87/100');
      expect(formatted.runsSummary).toContain('válidas');
    });

    it('handles zero compliance correctly', () => {
      const zeroMetrics = { ...mockMetrics, validRuns: 0, compliancePercent: 0 };
      const formatted = formatAnalyticsMetrics(zeroMetrics);
      expect(formatted.complianceLabel).toContain('0%');
    });

    it('handles 100% compliance correctly', () => {
      const perfectMetrics = {
        ...mockMetrics,
        validRuns: 100,
        totalRuns: 100,
        compliancePercent: 100,
      };
      const formatted = formatAnalyticsMetrics(perfectMetrics);
      expect(formatted.complianceLabel).toContain('100%');
    });
  });

  describe('isAnalyticsStale', () => {
    it('detects stale data (>30min old)', () => {
      const staleMeta: AnalyticsMetadata = {
        labId: 'lab-1',
        lastRefreshAt: new Date(Date.now() - 31 * 60 * 1000), // 31 min ago
        refreshIntervalMinutes: 60,
        isCached: true,
      };

      expect(isAnalyticsStale(staleMeta)).toBe(true);
    });

    it('detects fresh data (<30min old)', () => {
      const freshMeta: AnalyticsMetadata = {
        labId: 'lab-1',
        lastRefreshAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
        refreshIntervalMinutes: 60,
        isCached: true,
      };

      expect(isAnalyticsStale(freshMeta)).toBe(false);
    });

    it('treats null metadata as stale', () => {
      expect(isAnalyticsStale(null)).toBe(true);
    });

    it('treats metadata with null lastRefreshAt as stale', () => {
      const metaNoRefresh: AnalyticsMetadata = {
        labId: 'lab-1',
        lastRefreshAt: null,
        refreshIntervalMinutes: 60,
        isCached: false,
      };

      expect(isAnalyticsStale(metaNoRefresh)).toBe(true);
    });

    it('treats data exactly 30min old as fresh (boundary)', () => {
      const boundaryMeta: AnalyticsMetadata = {
        labId: 'lab-1',
        lastRefreshAt: new Date(Date.now() - 30 * 60 * 1000), // exactly 30 min ago
        refreshIntervalMinutes: 60,
        isCached: true,
      };

      expect(isAnalyticsStale(boundaryMeta)).toBe(false);
    });

    it('treats data >30min old (30min + 1sec) as stale', () => {
      const staleMeta: AnalyticsMetadata = {
        labId: 'lab-1',
        lastRefreshAt: new Date(Date.now() - 30 * 60 * 1000 - 1000), // 30min + 1sec
        refreshIntervalMinutes: 60,
        isCached: true,
      };

      expect(isAnalyticsStale(staleMeta)).toBe(true);
    });
  });
});
