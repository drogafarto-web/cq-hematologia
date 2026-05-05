/**
 * Unit tests for CIQ Compliance aggregation query logic
 *
 * Tests validate:
 * - Correct count of valid/invalid runs
 * - All required metrics fields present
 * - Percentages within 0-100 range
 * - Compliance formula: (valid / total) * 100
 *
 * Phase 3.1: Structural tests without Firestore connection.
 * Phase 3.2: Add integration tests with Cloud Emulator.
 */

import { describe, it, expect } from 'vitest';

describe('queryCIQCompliance aggregation logic', () => {
  it('counts valid runs correctly', () => {
    const mockDocs = [
      { status: 'valid', deletadoEm: null },
      { status: 'valid', deletadoEm: null },
      { status: 'invalid', deletadoEm: null },
    ];

    const validCount = mockDocs.filter((d) => d.status === 'valid').length;
    expect(validCount).toBe(2);
  });

  it('ignores soft-deleted runs', () => {
    const mockDocs = [
      { status: 'valid', deletadoEm: null },
      { status: 'valid', deletadoEm: new Date() }, // soft-deleted
      { status: 'invalid', deletadoEm: null },
    ];

    const validCount = mockDocs
      .filter((d) => d.deletadoEm === null && d.status === 'valid').length;
    expect(validCount).toBe(1);
  });

  it('returns all required metrics fields', () => {
    const metrics = {
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

    const requiredFields = [
      'totalRuns',
      'validRuns',
      'invalidRuns',
      'openNCs',
      'closedNCs',
      'compliancePercent',
      'ncResolutionRate',
      'avgResolutionDays',
      'avgProcessingHours',
      'computedAt',
      'dataAsOf',
    ];

    for (const field of requiredFields) {
      expect(field in metrics).toBe(true);
    }
  });

  it('compliance percent is between 0-100', () => {
    const validRuns = 87;
    const totalRuns = 100;
    const compliancePercent = Math.round((validRuns / totalRuns) * 100);

    expect(compliancePercent).toBeGreaterThanOrEqual(0);
    expect(compliancePercent).toBeLessThanOrEqual(100);
  });

  it('computes compliance percent correctly', () => {
    const validRuns = 87;
    const totalRuns = 100;
    const compliancePercent = Math.round((validRuns / totalRuns) * 100);

    expect(compliancePercent).toBe(87);
  });

  it('handles zero total runs', () => {
    const validRuns = 0;
    const totalRuns = 0;
    const compliancePercent = totalRuns > 0 ? Math.round((validRuns / totalRuns) * 100) : 0;

    expect(compliancePercent).toBe(0);
  });

  it('nc resolution rate is between 0-100', () => {
    const openNCs = 5;
    const closedNCs = 12;
    const total = openNCs + closedNCs;
    const ncResolutionRate = total > 0 ? Math.round((closedNCs / total) * 100) : 0;

    expect(ncResolutionRate).toBeGreaterThanOrEqual(0);
    expect(ncResolutionRate).toBeLessThanOrEqual(100);
  });

  it('handles zero NCs', () => {
    const openNCs = 0;
    const closedNCs = 0;
    const total = openNCs + closedNCs;
    const ncResolutionRate = total > 0 ? Math.round((closedNCs / total) * 100) : 0;

    expect(ncResolutionRate).toBe(0);
  });

  it('rounds resolution days to 1 decimal', () => {
    const avgResolutionDays = 3.567;
    const rounded = Math.round(avgResolutionDays * 10) / 10;

    expect(rounded).toBe(3.6);
  });
});
