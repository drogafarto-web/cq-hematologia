/**
 * src/__tests__/bioquimica/ocrValidation.test.ts
 *
 * 10 unit tests for OCR validation report generator.
 */

import { describe, it, expect } from 'vitest';
import { validateOCRResult } from '../../features/bioquimica/services/ocrValidationService';
import type { OCRParsedResult } from '../../features/bioquimica/types/ocrResults';
import type { AnalitoExpandedMetadata } from '../../features/bioquimica/types/analitoExpansion';

// ─── Test Fixtures ────────────────────────────────────────────────────────

const minimalCatalog: AnalitoExpandedMetadata[] = [
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
  {
    id: 'ggt',
    category: 'enzimologia',
    unit: 'U/L',
    refRangeLow: 9,
    refRangeHigh: 48,
    refRangeUnit: 'adult-male',
    expectedMethods: ['enzymatic'],
    alternativeNames: ['GGT'],
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────

describe('OCR Validation Service', () => {
  it('should accept when all expected analytes matched with high confidence', () => {
    const parsed: OCRParsedResult = {
      imageStoragePath: 'test',
      imageHash: 'abc123',
      parsedAt: 1000000,
      geminiModel: 'gemini-2.5-flash',
      rawText: 'test',
      analytes: [
        {
          rawName: 'ALT',
          matchedAnalitoId: 'alt',
          matchConfidence: 'high',
          rawValue: '80',
          parsedValue: 80,
          rawUnit: 'U/L',
          unitMatched: true,
        },
        {
          rawName: 'AST',
          matchedAnalitoId: 'ast',
          matchConfidence: 'high',
          rawValue: '35',
          parsedValue: 35,
          rawUnit: 'U/L',
          unitMatched: true,
        },
      ],
      overallConfidence: 'high',
      warnings: [],
    };

    const report = validateOCRResult({
      parsed,
      expectedAnalytes: ['alt', 'ast'],
      catalog: minimalCatalog,
    });

    expect(report.validationSeverity).toBe('accept');
    expect(report.unmatched).toHaveLength(0);
  });

  it('should review when 1 analyte unmatched', () => {
    const parsed: OCRParsedResult = {
      imageStoragePath: 'test',
      imageHash: 'abc123',
      parsedAt: 1000000,
      geminiModel: 'gemini-2.5-flash',
      rawText: 'test',
      analytes: [
        {
          rawName: 'ALT',
          matchedAnalitoId: 'alt',
          matchConfidence: 'high',
          rawValue: '80',
          parsedValue: 80,
          rawUnit: 'U/L',
          unitMatched: true,
        },
      ],
      overallConfidence: 'high',
      warnings: [],
    };

    const report = validateOCRResult({
      parsed,
      expectedAnalytes: ['alt', 'ast'],
      catalog: minimalCatalog,
    });

    expect(report.validationSeverity).toBe('review');
    expect(report.unmatched).toContain('ast');
  });

  it('should reject when 3 analytes unmatched', () => {
    const parsed: OCRParsedResult = {
      imageStoragePath: 'test',
      imageHash: 'abc123',
      parsedAt: 1000000,
      geminiModel: 'gemini-2.5-flash',
      rawText: 'test',
      analytes: [
        {
          rawName: 'ALT',
          matchedAnalitoId: 'alt',
          matchConfidence: 'high',
          rawValue: '80',
          parsedValue: 80,
          rawUnit: 'U/L',
          unitMatched: true,
        },
      ],
      overallConfidence: 'high',
      warnings: [],
    };

    const report = validateOCRResult({
      parsed,
      expectedAnalytes: ['alt', 'ast', 'ggt'],
      catalog: minimalCatalog,
    });

    expect(report.validationSeverity).toBe('reject');
    expect(report.unmatched).toHaveLength(2);
  });

  it('should reject on low overall confidence', () => {
    const parsed: OCRParsedResult = {
      imageStoragePath: 'test',
      imageHash: 'abc123',
      parsedAt: 1000000,
      geminiModel: 'gemini-2.5-flash',
      rawText: 'test',
      analytes: [
        {
          rawName: 'ALT',
          matchedAnalitoId: 'alt',
          matchConfidence: 'high',
          rawValue: '80',
          parsedValue: 80,
          rawUnit: 'U/L',
          unitMatched: true,
        },
      ],
      overallConfidence: 'low',
      warnings: [],
    };

    const report = validateOCRResult({
      parsed,
      expectedAnalytes: ['alt'],
      catalog: minimalCatalog,
    });

    expect(report.validationSeverity).toBe('reject');
  });

  it('should track unexpected analytes', () => {
    const parsed: OCRParsedResult = {
      imageStoragePath: 'test',
      imageHash: 'abc123',
      parsedAt: 1000000,
      geminiModel: 'gemini-2.5-flash',
      rawText: 'test',
      analytes: [
        {
          rawName: 'ALT',
          matchedAnalitoId: 'alt',
          matchConfidence: 'high',
          rawValue: '80',
          parsedValue: 80,
          rawUnit: 'U/L',
          unitMatched: true,
        },
        {
          rawName: 'UNKNOWN',
          matchedAnalitoId: undefined,
          matchConfidence: 'low',
          rawValue: '123',
          parsedValue: 123,
          rawUnit: 'U/L',
          unitMatched: true,
        },
      ],
      overallConfidence: 'medium',
      warnings: [],
    };

    const report = validateOCRResult({
      parsed,
      expectedAnalytes: ['alt'],
      catalog: minimalCatalog,
    });

    expect(report.unexpected).toContain('UNKNOWN');
  });

  it('should handle alias matches (medium confidence)', () => {
    const parsed: OCRParsedResult = {
      imageStoragePath: 'test',
      imageHash: 'abc123',
      parsedAt: 1000000,
      geminiModel: 'gemini-2.5-flash',
      rawText: 'test',
      analytes: [
        {
          rawName: 'TGP',
          matchedAnalitoId: 'alt',
          matchConfidence: 'high',
          rawValue: '80',
          parsedValue: 80,
          rawUnit: 'U/L',
          unitMatched: true,
        },
        {
          rawName: 'AST',
          matchedAnalitoId: 'ast',
          matchConfidence: 'medium',
          rawValue: '35',
          parsedValue: 35,
          rawUnit: 'U/L',
          unitMatched: true,
        },
      ],
      overallConfidence: 'high',
      warnings: [],
    };

    const report = validateOCRResult({
      parsed,
      expectedAnalytes: ['alt', 'ast'],
      catalog: minimalCatalog,
    });

    expect(report.validationSeverity).toBe('accept');
    expect(report.matched).toContain('alt');
    expect(report.matched).toContain('ast');
  });

  it('should review with 1 unmatched + medium confidence', () => {
    const parsed: OCRParsedResult = {
      imageStoragePath: 'test',
      imageHash: 'abc123',
      parsedAt: 1000000,
      geminiModel: 'gemini-2.5-flash',
      rawText: 'test',
      analytes: [
        {
          rawName: 'ALT',
          matchedAnalitoId: 'alt',
          matchConfidence: 'medium',
          rawValue: '80',
          parsedValue: 80,
          rawUnit: 'U/L',
          unitMatched: true,
        },
      ],
      overallConfidence: 'medium',
      warnings: [],
    };

    const report = validateOCRResult({
      parsed,
      expectedAnalytes: ['alt', 'ast'],
      catalog: minimalCatalog,
    });

    expect(report.validationSeverity).toBe('review');
  });

  it('should handle empty parsed analytes with non-empty expected', () => {
    const parsed: OCRParsedResult = {
      imageStoragePath: 'test',
      imageHash: 'abc123',
      parsedAt: 1000000,
      geminiModel: 'gemini-2.5-flash',
      rawText: 'test',
      analytes: [],
      overallConfidence: 'low',
      warnings: [],
    };

    const report = validateOCRResult({
      parsed,
      expectedAnalytes: ['alt', 'ast'],
      catalog: minimalCatalog,
    });

    expect(report.validationSeverity).toBe('reject');
    expect(report.unmatched).toContain('alt');
    expect(report.unmatched).toContain('ast');
  });

  it('should mix high + medium + 1 unmatched = review', () => {
    const parsed: OCRParsedResult = {
      imageStoragePath: 'test',
      imageHash: 'abc123',
      parsedAt: 1000000,
      geminiModel: 'gemini-2.5-flash',
      rawText: 'test',
      analytes: [
        {
          rawName: 'ALT',
          matchedAnalitoId: 'alt',
          matchConfidence: 'high',
          rawValue: '80',
          parsedValue: 80,
          rawUnit: 'U/L',
          unitMatched: true,
        },
        {
          rawName: 'AST',
          matchedAnalitoId: 'ast',
          matchConfidence: 'medium',
          rawValue: '35',
          parsedValue: 35,
          rawUnit: 'U/L',
          unitMatched: true,
        },
      ],
      overallConfidence: 'medium',
      warnings: [],
    };

    const report = validateOCRResult({
      parsed,
      expectedAnalytes: ['alt', 'ast', 'ggt'],
      catalog: minimalCatalog,
    });

    expect(report.validationSeverity).toBe('review');
    expect(report.unmatched).toContain('ggt');
  });
});
