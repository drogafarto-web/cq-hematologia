/**
 * Unit tests for useAnalytics hook helpers
 *
 * Tests validate:
 * - formatAnalyticsMetrics produces correct label strings
 * - isAnalyticsStale correctly detects data freshness
 * - Edge cases (null metadata, boundary times)
 *
 * Phase 3.1: Helper function tests.
 * Phase 3.2: Add hook integration tests with Firebase emulator.
 */

import { describe, it, expect } from 'vitest';
import {
  formatAnalyticsMetrics,
  isAnalyticsStale,
} from '../../../src/features/analytics/hooks/useAnalytics';
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
    it('formats compliance label correctly', () => {
      const formatted = formatAnalyticsMetrics(mockMetrics);
      expect(formatted.complianceLabel).toBe('87% conformidade');
    });

    it('formats resolution label correctly', () => {
      const formatted = formatAnalyticsMetrics(mockMetrics);
      expect(formatted.resolutionLabel).toBe('71% resolvido');
    });

    it('formats avg resolution label correctly', () => {
      const formatted = formatAnalyticsMetrics(mockMetrics);
      expect(formatted.avgResolutionLabel).toBe('3.5 dias médio');
    });

    it('formats runs summary correctly', () => {
      const formatted = formatAnalyticsMetrics(mockMetrics);
      expect(formatted.runsSummary).toBe('87/100 corridas válidas');
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

    it('boundary: just over 30 minutes is stale', () => {
      const boundaryMeta: AnalyticsMetadata = {
        labId: 'lab-1',
        lastRefreshAt: new Date(Date.now() - (30 * 60 * 1000 + 1)), // just over 30 min ago
        refreshIntervalMinutes: 60,
        isCached: true,
      };

      expect(isAnalyticsStale(boundaryMeta)).toBe(true);
    });

    it('returns null metadata as stale', () => {
      expect(isAnalyticsStale(null)).toBe(true);
    });

    it('returns metadata without lastRefreshAt as stale', () => {
      const metaNoRefresh: AnalyticsMetadata = {
        labId: 'lab-1',
        lastRefreshAt: null,
        refreshIntervalMinutes: 60,
        isCached: false,
      };

      expect(isAnalyticsStale(metaNoRefresh)).toBe(true);
    });

    it('detects very fresh data (just computed)', () => {
      const veryFreshMeta: AnalyticsMetadata = {
        labId: 'lab-1',
        lastRefreshAt: new Date(), // now
        refreshIntervalMinutes: 60,
        isCached: true,
      };

      expect(isAnalyticsStale(veryFreshMeta)).toBe(false);
    });
  });
});
