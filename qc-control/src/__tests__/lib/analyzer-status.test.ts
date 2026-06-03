import { describe, it, expect } from 'vitest';
import { deriveAnalyzerStatus } from '@/lib/analyzer-status';

function makeAnalyzer(overrides: Partial<Parameters<typeof deriveAnalyzerStatus>[0]> = {}) {
  return {
    status: 'OPERATIONAL',
    calibrations: [{ nextDueAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }],
    maintenances: [],
    ...overrides,
  };
}

describe('deriveAnalyzerStatus', () => {
  it('returns OUT_OF_SERVICE when status is OUT_OF_SERVICE', () => {
    const result = deriveAnalyzerStatus(makeAnalyzer({ status: 'OUT_OF_SERVICE' }));
    expect(result).toBe('OUT_OF_SERVICE');
  });

  it('returns CAL_OVERDUE when no calibrations exist', () => {
    const result = deriveAnalyzerStatus(makeAnalyzer({ calibrations: [] }));
    expect(result).toBe('CAL_OVERDUE');
  });

  it('returns CAL_OVERDUE when latest calibration is past due', () => {
    const result = deriveAnalyzerStatus(
      makeAnalyzer({
        calibrations: [{ nextDueAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) }],
      }),
    );
    expect(result).toBe('CAL_OVERDUE');
  });

  it('returns CAL_DUE_SOON when calibration due within 30 days', () => {
    const result = deriveAnalyzerStatus(
      makeAnalyzer({
        calibrations: [{ nextDueAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) }],
      }),
    );
    expect(result).toBe('CAL_DUE_SOON');
  });

  it('returns MAINTENANCE_OVERDUE when maintenance is past due', () => {
    const result = deriveAnalyzerStatus(
      makeAnalyzer({
        maintenances: [{ nextScheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }],
      }),
    );
    expect(result).toBe('MAINTENANCE_OVERDUE');
  });

  it('returns MAINTENANCE_DUE when maintenance due within 30 days', () => {
    const result = deriveAnalyzerStatus(
      makeAnalyzer({
        maintenances: [{ nextScheduledAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) }],
      }),
    );
    expect(result).toBe('MAINTENANCE_DUE');
  });

  it('returns OPERATIONAL when everything is fine', () => {
    const result = deriveAnalyzerStatus(makeAnalyzer());
    expect(result).toBe('OPERATIONAL');
  });
});
