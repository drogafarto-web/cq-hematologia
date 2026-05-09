/**
 * src/__tests__/bioquimica/integration.test.ts
 *
 * 5 end-to-end OCR → fuzzy match → Westgard → acceptance pipeline tests.
 * These are integration tests combining multiple services.
 */

import { describe, it, expect } from 'vitest';
import { detectWestgardViolations } from '../../features/bioquimica/services/westgardEngine';
import { evaluateAcceptance } from '../../features/bioquimica/services/acceptanceEngine';
import { fuzzyMatchAnalyte } from '../../features/bioquimica/services/fuzzyAnalyteMatch';
import type { WestgardObservation } from '../../features/bioquimica/types/westgardCLSI';
import type { AnalitoExpandedMetadata } from '../../features/bioquimica/types/analitoExpansion';

// ─── Test Fixtures ────────────────────────────────────────────────────────

const testCatalog: AnalitoExpandedMetadata[] = [
  {
    id: 'alt',
    category: 'enzimologia',
    unit: 'U/L',
    refRangeLow: 7,
    refRangeHigh: 56,
    refRangeUnit: 'adult-male',
    expectedMethods: ['enzymatic'],
    alternativeNames: ['ALT', 'TGP'],
  },
  {
    id: 'ast',
    category: 'enzimologia',
    unit: 'U/L',
    refRangeLow: 10,
    refRangeHigh: 40,
    refRangeUnit: 'adult-male',
    expectedMethods: ['enzymatic'],
    alternativeNames: ['AST', 'TGO'],
  },
];

function createObs(id: string, value: number, offset: number): WestgardObservation {
  const mean = 100;
  const sd = 20;
  const zScore = (value - mean) / sd;

  return {
    runId: `run-${id}`,
    analitoId: 'test-analito',
    equipmentId: 'eq-1',
    nivelId: 'nivel-2',
    value,
    mean,
    sd,
    zScore,
    ts: 1000000 + offset,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Bioquímica Integration Pipeline', () => {
  it('scenario 1: clean image, 4 analytes within 1 SD → accept', () => {
    // Simulate OCR result with all analytes at z < 1 SD
    const observations = [
      createObs('1', 95, 0),
      createObs('2', 105, 1000),
      createObs('3', 98, 2000),
      createObs('4', 102, 3000),
    ];

    const westgardResult = detectWestgardViolations({
      windowObservations: observations,
      rulesConfig: [
        { rule: '1-3s', enabled: true, severity: 'reject' },
        { rule: '2-2s', enabled: true, severity: 'reject' },
        { rule: 'R-4s', enabled: true, severity: 'reject' },
        { rule: '4-1s', enabled: true, severity: 'reject' },
        { rule: '10x', enabled: true, severity: 'reject' },
        { rule: '7T', enabled: true, severity: 'reject' },
        { rule: '8x', enabled: true, severity: 'warn' },
        { rule: '12x', enabled: true, severity: 'warn' },
      ],
    });

    const acceptance = evaluateAcceptance({
      westgardResult,
    });

    expect(acceptance.decision).toBe('accept');
    expect(acceptance.blockers).toHaveLength(0);
  });

  it('scenario 2: clean image, 1 analyte z=3.5 → reject', () => {
    // One observation exceeds 3 SD
    const observations = [
      createObs('1', 95, 0),
      createObs('2', 105, 1000),
      createObs('3', 170, 2000), // (170-100)/20 = 3.5 SD → 1-3s violation
    ];

    const westgardResult = detectWestgardViolations({
      windowObservations: observations,
      rulesConfig: [
        { rule: '1-3s', enabled: true, severity: 'reject' },
        { rule: '2-2s', enabled: true, severity: 'reject' },
        { rule: 'R-4s', enabled: true, severity: 'reject' },
        { rule: '4-1s', enabled: true, severity: 'reject' },
        { rule: '10x', enabled: true, severity: 'reject' },
        { rule: '7T', enabled: true, severity: 'reject' },
        { rule: '8x', enabled: true, severity: 'warn' },
        { rule: '12x', enabled: true, severity: 'warn' },
      ],
    });

    const acceptance = evaluateAcceptance({
      westgardResult,
    });

    expect(acceptance.decision).toBe('reject');
    expect(acceptance.reasons[0]).toContain('1-3s');
    expect(acceptance.blockers).toHaveLength(1);
  });

  it('scenario 3: 1 unmatched analyte (OCR review) + Westgard clean → warn', () => {
    const observations = [createObs('1', 100, 0)];

    const westgardResult = detectWestgardViolations({
      windowObservations: observations,
      rulesConfig: [
        { rule: '1-3s', enabled: true, severity: 'reject' },
        { rule: '2-2s', enabled: true, severity: 'reject' },
        { rule: 'R-4s', enabled: true, severity: 'reject' },
        { rule: '4-1s', enabled: true, severity: 'reject' },
        { rule: '10x', enabled: true, severity: 'reject' },
        { rule: '7T', enabled: true, severity: 'reject' },
        { rule: '8x', enabled: true, severity: 'warn' },
        { rule: '12x', enabled: true, severity: 'warn' },
      ],
    });

    const ocrValidation = {
      parsedResultId: 'test',
      expectedAnalytes: ['alt', 'ast'],
      matched: ['alt'],
      unmatched: ['ast'],
      unexpected: [],
      validationSeverity: 'review' as const,
    };

    const acceptance = evaluateAcceptance({
      westgardResult,
      ocrValidation,
    });

    expect(acceptance.decision).toBe('warn');
    expect(acceptance.blockers).toHaveLength(0);
  });

  it('scenario 4: interlab z-score unsatisfactory + Westgard clean → reject', () => {
    const observations = [createObs('1', 100, 0)];

    const westgardResult = detectWestgardViolations({
      windowObservations: observations,
      rulesConfig: [
        { rule: '1-3s', enabled: true, severity: 'reject' },
        { rule: '2-2s', enabled: true, severity: 'reject' },
        { rule: 'R-4s', enabled: true, severity: 'reject' },
        { rule: '4-1s', enabled: true, severity: 'reject' },
        { rule: '10x', enabled: true, severity: 'reject' },
        { rule: '7T', enabled: true, severity: 'reject' },
        { rule: '8x', enabled: true, severity: 'warn' },
        { rule: '12x', enabled: true, severity: 'warn' },
      ],
    });

    const interlabZScore = {
      zScore: 3.5,
      classification: 'unsatisfactory' as const,
    };

    const acceptance = evaluateAcceptance({
      westgardResult,
      interlabZScore,
    });

    expect(acceptance.decision).toBe('reject');
    expect(acceptance.blockers[0]).toContain('unsatisfactory');
  });

  it('scenario 5: blockers populated only on reject paths', () => {
    const observations = [
      createObs('1', 95, 0),
      createObs('2', 105, 1000),
    ];

    const westgardResult = detectWestgardViolations({
      windowObservations: observations,
      rulesConfig: [
        { rule: '1-3s', enabled: true, severity: 'reject' },
        { rule: '2-2s', enabled: true, severity: 'reject' },
        { rule: 'R-4s', enabled: true, severity: 'reject' },
        { rule: '4-1s', enabled: true, severity: 'reject' },
        { rule: '10x', enabled: true, severity: 'reject' },
        { rule: '7T', enabled: true, severity: 'reject' },
        { rule: '8x', enabled: true, severity: 'warn' },
        { rule: '12x', enabled: true, severity: 'warn' },
      ],
    });

    const acceptance = evaluateAcceptance({
      westgardResult,
    });

    // Accept case: blockers empty
    expect(acceptance.decision).toBe('accept');
    expect(acceptance.blockers).toHaveLength(0);

    // Reject case: blockers populated
    const rejectWestgardResult = {
      violations: [
        {
          rule: '1-3s' as const,
          severity: 'reject' as const,
          detectedAt: 1000000,
          windowRuns: ['r1'],
          description: 'Test reject',
        },
      ],
      rejectCount: 1,
      warnCount: 0,
    };

    const rejectAcceptance = evaluateAcceptance({
      westgardResult: rejectWestgardResult,
    });

    expect(rejectAcceptance.decision).toBe('reject');
    expect(rejectAcceptance.blockers).toHaveLength(1);
  });
});
