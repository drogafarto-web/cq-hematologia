/**
 * Unit tests for kpiCalculators.ts
 *
 * All functions are pure — no mocking needed.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCompliance,
  calculateTurnaround,
  calculateRetrabalho,
  calculateNCResolutionRate,
  deriveKPISummary,
  normalizeHeatmapIntensities,
  isAggregateStale,
} from '../../../src/features/analytics/services/kpiCalculators';
import type { AnalyticsAggregate } from '../../../src/features/analytics/types/Analytics';

// ─── calculateCompliance ──────────────────────────────────────────────────────

describe('calculateCompliance', () => {
  it('returns correct percentage rounded to 1 decimal', () => {
    expect(calculateCompliance(87, 100)).toBe(87);
    expect(calculateCompliance(1, 3)).toBe(33.3);
    expect(calculateCompliance(2, 3)).toBe(66.7);
  });

  it('returns 0 when totalRuns is 0 (no division-by-zero)', () => {
    expect(calculateCompliance(0, 0)).toBe(0);
    expect(calculateCompliance(5, 0)).toBe(0);
  });

  it('returns 100 when all runs are valid', () => {
    expect(calculateCompliance(50, 50)).toBe(100);
  });

  it('returns 0 when no runs are valid', () => {
    expect(calculateCompliance(0, 10)).toBe(0);
  });

  it('handles decimal valid/total ratios cleanly', () => {
    const result = calculateCompliance(33, 99);
    expect(result).toBe(33.3);
  });
});

// ─── calculateTurnaround ──────────────────────────────────────────────────────

describe('calculateTurnaround', () => {
  it('returns value rounded to 2 decimal places', () => {
    expect(calculateTurnaround(3.14159)).toBe(3.14);
    expect(calculateTurnaround(1.126)).toBe(1.13);
  });

  it('returns 0 for negative values (invalid input)', () => {
    expect(calculateTurnaround(-1)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(calculateTurnaround(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(calculateTurnaround(Infinity)).toBe(0);
  });

  it('returns 0 for exact 0', () => {
    expect(calculateTurnaround(0)).toBe(0);
  });
});

// ─── calculateRetrabalho ──────────────────────────────────────────────────────

describe('calculateRetrabalho', () => {
  it('calculates rework percentage correctly', () => {
    expect(calculateRetrabalho(5, 100)).toBe(5);
    expect(calculateRetrabalho(1, 3)).toBe(33.3);
  });

  it('returns 0 when totalRuns is 0', () => {
    expect(calculateRetrabalho(0, 0)).toBe(0);
  });

  it('returns 0 when no rework', () => {
    expect(calculateRetrabalho(0, 50)).toBe(0);
  });

  it('caps at 100% (all runs reworked)', () => {
    expect(calculateRetrabalho(10, 10)).toBe(100);
  });
});

// ─── calculateNCResolutionRate ────────────────────────────────────────────────

describe('calculateNCResolutionRate', () => {
  it('calculates correctly', () => {
    expect(calculateNCResolutionRate(2, 8)).toBe(80);
    expect(calculateNCResolutionRate(0, 10)).toBe(100);
  });

  it('returns 100 when there are no NCs at all', () => {
    expect(calculateNCResolutionRate(0, 0)).toBe(100);
  });

  it('returns 0 when none are closed', () => {
    expect(calculateNCResolutionRate(5, 0)).toBe(0);
  });
});

// ─── deriveKPISummary ─────────────────────────────────────────────────────────

const makeAggregate = (overrides: Partial<AnalyticsAggregate> = {}): AnalyticsAggregate => ({
  labId: 'lab-test',
  totalRuns: 100,
  validRuns: 90,
  invalidRuns: 10,
  compliancePercent: 90,
  openNCs: 3,
  closedNCs: 7,
  ncResolutionRate: 70,
  avgResolutionDays: 5.2,
  avgProcessingHours: 2.5,
  retrabalhoCount: 4,
  retrabalhoPercent: 4,
  ncByModule: { 'ciq-imuno': 2, pops: 1 },
  ncAgeBuckets: { '7d': 2, '30d': 1, '60d': 0, '>60d': 0 },
  computedAt: new Date(),
  dataAsOf: new Date(),
  ...overrides,
});

describe('deriveKPISummary', () => {
  it('derives KPI summary from aggregate', () => {
    const agg = makeAggregate();
    const summary = deriveKPISummary(agg);
    expect(summary.compliancePercent).toBe(90);
    expect(summary.openNCs).toBe(3);
    expect(summary.retrabalhoPercent).toBe(4);
    expect(summary.avgResolutionDays).toBe(5.2);
  });

  it('includes deltas when prior aggregate provided', () => {
    const current = makeAggregate({ validRuns: 90, totalRuns: 100, openNCs: 3 });
    const prior = makeAggregate({ validRuns: 85, totalRuns: 100, openNCs: 5 });
    const summary = deriveKPISummary(current, prior);
    expect(summary.complianceDelta).toBe(5); // 90 - 85
    expect(summary.ncDelta).toBe(-2);         // 3 - 5
  });

  it('has no delta fields when prior is not provided', () => {
    const summary = deriveKPISummary(makeAggregate());
    expect(summary.complianceDelta).toBeUndefined();
    expect(summary.ncDelta).toBeUndefined();
  });

  it('has no delta fields when prior is null', () => {
    const summary = deriveKPISummary(makeAggregate(), null);
    expect(summary.complianceDelta).toBeUndefined();
  });
});

// ─── normalizeHeatmapIntensities ──────────────────────────────────────────────

describe('normalizeHeatmapIntensities', () => {
  it('normalizes to [0, 1] range', () => {
    const cells = [{ count: 0 }, { count: 5 }, { count: 10 }];
    const intensities = normalizeHeatmapIntensities(cells);
    expect(intensities[0]).toBe(0);
    expect(intensities[1]).toBe(0.5);
    expect(intensities[2]).toBe(1);
  });

  it('returns all zeros for all-zero counts', () => {
    const cells = [{ count: 0 }, { count: 0 }];
    const intensities = normalizeHeatmapIntensities(cells);
    expect(intensities).toEqual([0, 0]);
  });

  it('returns 1 for single non-zero cell', () => {
    const intensities = normalizeHeatmapIntensities([{ count: 7 }]);
    expect(intensities[0]).toBe(1);
  });

  it('returns same order as input', () => {
    const cells = [{ count: 2 }, { count: 10 }, { count: 5 }];
    const intensities = normalizeHeatmapIntensities(cells);
    expect(intensities[0]).toBeLessThan(intensities[2]);
    expect(intensities[2]).toBeLessThan(intensities[1]);
  });
});

// ─── isAggregateStale ─────────────────────────────────────────────────────────

describe('isAggregateStale', () => {
  it('returns true for null computedAt', () => {
    expect(isAggregateStale(null)).toBe(true);
  });

  it('returns false for very recent date', () => {
    const now = new Date();
    expect(isAggregateStale(now, 30)).toBe(false);
  });

  it('returns true for date older than threshold', () => {
    const old = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    expect(isAggregateStale(old, 30)).toBe(true);
  });

  it('uses 30 min default threshold', () => {
    const recent = new Date(Date.now() - 20 * 60 * 1000); // 20 min ago
    expect(isAggregateStale(recent)).toBe(false);

    const stale = new Date(Date.now() - 35 * 60 * 1000); // 35 min ago
    expect(isAggregateStale(stale)).toBe(true);
  });
});
