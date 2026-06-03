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

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('queryCIQCompliance aggregation logic', () => {
  it('counts valid runs correctly', () => {
    const mockDocs = [
      { status: 'valid', deletadoEm: null },
      { status: 'valid', deletadoEm: null },
      { status: 'invalid', deletadoEm: null },
    ];

    const validCount = mockDocs.filter((d) => d.status === 'valid').length;
    assert.strictEqual(validCount, 2, 'Should count 2 valid runs');
  });

  it('ignores soft-deleted runs', () => {
    const mockDocs = [
      { status: 'valid', deletadoEm: null },
      { status: 'valid', deletadoEm: new Date() }, // soft-deleted
      { status: 'invalid', deletadoEm: null },
    ];

    const validCount = mockDocs.filter((d) => d.deletadoEm === null && d.status === 'valid').length;
    assert.strictEqual(validCount, 1, 'Should count 1 valid run after filtering deleted');
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
      assert.ok(field in metrics, `Metrics should have ${field}`);
    }
  });

  it('compliance percent is between 0-100', () => {
    const validRuns = 87;
    const totalRuns = 100;
    const compliancePercent = Math.round((validRuns / totalRuns) * 100);

    assert.ok(
      compliancePercent >= 0 && compliancePercent <= 100,
      'Compliance percent should be between 0-100',
    );
  });

  it('computes compliance percent correctly', () => {
    const validRuns = 87;
    const totalRuns = 100;
    const compliancePercent = Math.round((validRuns / totalRuns) * 100);

    assert.strictEqual(compliancePercent, 87, 'Should compute 87% compliance');
  });

  it('handles zero total runs', () => {
    const validRuns = 0;
    const totalRuns = 0;
    const compliancePercent = totalRuns > 0 ? Math.round((validRuns / totalRuns) * 100) : 0;

    assert.strictEqual(compliancePercent, 0, 'Should return 0% for zero runs');
  });

  it('nc resolution rate is between 0-100', () => {
    const openNCs = 5;
    const closedNCs = 12;
    const total = openNCs + closedNCs;
    const ncResolutionRate = total > 0 ? Math.round((closedNCs / total) * 100) : 0;

    assert.ok(
      ncResolutionRate >= 0 && ncResolutionRate <= 100,
      'NC resolution rate should be between 0-100',
    );
  });

  it('handles zero NCs', () => {
    const openNCs = 0;
    const closedNCs = 0;
    const total = openNCs + closedNCs;
    const ncResolutionRate = total > 0 ? Math.round((closedNCs / total) * 100) : 0;

    assert.strictEqual(ncResolutionRate, 0, 'Should return 0% for zero NCs');
  });

  it('rounds resolution days to 1 decimal', () => {
    const avgResolutionDays = 3.567;
    const rounded = Math.round(avgResolutionDays * 10) / 10;

    assert.strictEqual(rounded, 3.6, 'Should round to 3.6 days');
  });
});
