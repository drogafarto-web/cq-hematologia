/**
 * src/__tests__/bioquimica/acceptanceEngine.test.ts
 *
 * 12 unit tests for acceptance decision matrix.
 */

import { describe, it, expect } from 'vitest';
import { evaluateAcceptance } from '../../features/bioquimica/services/acceptanceEngine';
import type { AcceptanceInput } from '../../features/bioquimica/services/acceptanceEngine';

// ─── Test Fixtures ────────────────────────────────────────────────────────

const cleanWestgard = {
  violations: [],
  rejectCount: 0,
  warnCount: 0,
};

const rejectWestgard = {
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

const satisfactoryZScore = {
  zScore: 1.5,
  classification: 'satisfactory' as const,
};

const questionableZScore = {
  zScore: 2.5,
  classification: 'questionable' as const,
};

const unsatisfactoryZScore = {
  zScore: 3.5,
  classification: 'unsatisfactory' as const,
};

const acceptOCR = {
  parsedResultId: 'test',
  expectedAnalytes: ['alt', 'ast'],
  matched: ['alt', 'ast'],
  unmatched: [],
  unexpected: [],
  validationSeverity: 'accept' as const,
};

const reviewOCR = {
  parsedResultId: 'test',
  expectedAnalytes: ['alt', 'ast'],
  matched: ['alt'],
  unmatched: ['ast'],
  unexpected: [],
  validationSeverity: 'review' as const,
};

const rejectOCR = {
  parsedResultId: 'test',
  expectedAnalytes: ['alt', 'ast'],
  matched: ['alt'],
  unmatched: ['ast'],
  unexpected: [],
  validationSeverity: 'reject' as const,
};

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Acceptance Engine', () => {
  describe('Westgard isolate', () => {
    it('should reject on Westgard reject', () => {
      const input: AcceptanceInput = {
        westgardResult: rejectWestgard,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('reject');
      expect(result.blockers).toHaveLength(1);
    });

    it('should accept on clean Westgard', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('accept');
    });
  });

  describe('Interlab z-score isolate', () => {
    it('should reject on unsatisfactory z-score', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
        interlabZScore: unsatisfactoryZScore,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('reject');
      expect(result.blockers.some((b) => b.includes('unsatisfactory'))).toBe(true);
    });

    it('should warn on questionable z-score', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
        interlabZScore: questionableZScore,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('warn');
    });

    it('should accept on satisfactory z-score', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
        interlabZScore: satisfactoryZScore,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('accept');
    });
  });

  describe('OCR validation isolate', () => {
    it('should reject on OCR reject', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
        ocrValidation: rejectOCR,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('reject');
      expect(result.blockers.some((b) => b.includes('unmatched'))).toBe(true);
    });

    it('should warn on OCR review', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
        ocrValidation: reviewOCR,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('warn');
    });

    it('should accept on OCR accept', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
        ocrValidation: acceptOCR,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('accept');
    });
  });

  describe('Combined scenarios', () => {
    it('should reject on Westgard + clean interlab', () => {
      const input: AcceptanceInput = {
        westgardResult: rejectWestgard,
        interlabZScore: satisfactoryZScore,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('reject');
      expect(result.blockers).toHaveLength(1);
    });

    it('should reject on clean Westgard + unsatisfactory interlab', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
        interlabZScore: unsatisfactoryZScore,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('reject');
      expect(result.blockers.some((b) => b.includes('unsatisfactory'))).toBe(true);
    });

    it('should warn on all clean + questionable interlab', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
        interlabZScore: questionableZScore,
        ocrValidation: acceptOCR,
      };
      const result = evaluateAcceptance(input);
      expect(result.decision).toBe('warn');
      expect(result.reasons.some((r) => r.includes('questionable'))).toBe(true);
    });

    it('should have empty blockers on warn', () => {
      const input: AcceptanceInput = {
        westgardResult: cleanWestgard,
        interlabZScore: questionableZScore,
      };
      const result = evaluateAcceptance(input);
      expect(result.blockers).toHaveLength(0);
    });
  });
});
