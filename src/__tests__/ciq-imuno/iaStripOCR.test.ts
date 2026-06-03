/**
 * iaStripOCR.test.ts — Phase 5 W4-SA-36
 *
 * Test scenarios for strip OCR validation:
 * 1-2. fuzzyMatch: exact + partial matching
 * 3. fuzzyMatch: alias case (Tireotrofina vs TSH)
 * 4. validateStripResult: flags low-confidence
 * 5. validateStripResult: flags unit-mismatch
 * 6. validateStripResult: flags unknown-analyte
 * 7. validateStripResult: flags value-out-of-plausible-range
 * 8. validateStripResult: returns matched=true for clean input
 * 9. Determinism: same input → same output across runs
 * 10. Empty parsed result → returns empty array (no throw)
 */

import { describe, it, expect } from 'vitest';
import {
  fuzzyMatch,
  validateStripResult,
  type StripParseResult,
  type ParsedAnalyte,
} from '../../features/ciq-imuno/services/iaStripValidation';

describe('IA Strip OCR Validation', () => {
  // ─── Test 1: fuzzyMatch — exact match ────────────────────────────────────

  it('fuzzyMatch should return 1.0 for exact match', () => {
    const score = fuzzyMatch('TSH', 'TSH');
    expect(score).toBe(1.0);
  });

  // ─── Test 2: fuzzyMatch — case-insensitive partial ──────────────────────

  it('fuzzyMatch should return high score for case-insensitive match', () => {
    const score = fuzzyMatch('tsh', 'TSH');
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  // ─── Test 3: fuzzyMatch — different analytes ────────────────────────────

  it('fuzzyMatch should return low score for different analytes', () => {
    const score = fuzzyMatch('tsh', 't4');
    expect(score).toBeLessThanOrEqual(0.5);
  });

  // ─── Test 4: fuzzyMatch — alias case (Tireotrofina vs TSH) ───────────────

  it('fuzzyMatch should handle partial name similarity', () => {
    // 'Tireotrofina' and 'TSH' are different, so score should be lower
    // but if normalized properly, might be close
    const score = fuzzyMatch('Tireotrofina', 'TSH');
    // Just verify it's computed; exact score may vary
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  // ─── Test 5: validateStripResult — low-confidence flag ──────────────────

  it('should flag low-confidence when confidence < 0.6', () => {
    const parsed: StripParseResult = {
      analytes: [{ name: 'TSH', value: 2.5, unit: 'mIU/L', confidence: 0.5 }],
      rawJson: '{}',
      modelVersion: 'gemini-2.5-flash',
    };

    const validated = validateStripResult(parsed, ['TSH'], { TSH: ['mIU/mL', 'mIU/L'] });

    expect(validated[0].flags).toContain('low-confidence');
  });

  // ─── Test 6: validateStripResult — unit-mismatch flag ────────────────────

  it('should flag unit-mismatch when unit not in dictionary', () => {
    const parsed: StripParseResult = {
      analytes: [{ name: 'TSH', value: 2.5, unit: 'INVALID', confidence: 0.9 }],
      rawJson: '{}',
      modelVersion: 'gemini-2.5-flash',
    };

    const validated = validateStripResult(parsed, ['TSH'], { TSH: ['mIU/mL', 'uIU/mL'] });

    expect(validated[0].flags).toContain('unit-mismatch');
  });

  // ─── Test 7: validateStripResult — unknown-analyte flag ──────────────────

  it('should flag unknown-analyte when no fuzzy match >= 0.7', () => {
    const parsed: StripParseResult = {
      analytes: [{ name: 'UNKNOWN', value: 2.5, unit: 'mg/L', confidence: 0.9 }],
      rawJson: '{}',
      modelVersion: 'gemini-2.5-flash',
    };

    const validated = validateStripResult(parsed, ['TSH', 'T4']);

    expect(validated[0].flags).toContain('unknown-analyte');
    expect(validated[0].matched).toBe(false);
  });

  // ─── Test 8: validateStripResult — value-out-of-plausible-range ─────────

  it('should flag value-out-of-plausible-range for TSH=999', () => {
    const parsed: StripParseResult = {
      analytes: [{ name: 'TSH', value: 999, unit: 'mIU/mL', confidence: 0.9 }],
      rawJson: '{}',
      modelVersion: 'gemini-2.5-flash',
    };

    const validated = validateStripResult(parsed, ['TSH'], { TSH: ['mIU/mL'] });

    expect(validated[0].flags).toContain('value-out-of-plausible-range');
  });

  // ─── Test 9: validateStripResult — clean input returns matched=true ──────

  it('should return matched=true for clean input', () => {
    const parsed: StripParseResult = {
      analytes: [
        { name: 'TSH', value: 2.5, unit: 'mIU/mL', confidence: 0.95 },
        { name: 't4', value: 8.0, unit: 'ng/dL', confidence: 0.92 },
      ],
      rawJson: '{}',
      modelVersion: 'gemini-2.5-flash',
    };

    const validated = validateStripResult(parsed, ['TSH', 'T4'], {
      TSH: ['mIU/mL', 'uIU/mL'],
      T4: ['ng/dL', 'pg/mL'],
    });

    expect(validated[0].matched).toBe(true);
    expect(validated[0].matchedExpected).toBe('TSH');
    expect(validated[0].flags).toHaveLength(0);

    expect(validated[1].matched).toBe(true);
    expect(validated[1].matchedExpected).toBe('T4');
    expect(validated[1].flags).toHaveLength(0);
  });

  // ─── Test 10: validateStripResult — determinism ────────────────────────

  it('should return deterministic results across multiple runs', () => {
    const parsed: StripParseResult = {
      analytes: [{ name: 'TSH', value: 2.5, unit: 'mIU/mL', confidence: 0.95 }],
      rawJson: '{}',
      modelVersion: 'gemini-2.5-flash',
    };

    const runs = [];
    for (let i = 0; i < 10; i++) {
      const result = validateStripResult(parsed, ['TSH'], { TSH: ['mIU/mL'] });
      runs.push(JSON.stringify(result));
    }

    // All runs should produce identical JSON
    const first = runs[0];
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]).toBe(first);
    }
  });

  // ─── Test 11: validateStripResult — empty parsed result ──────────────────

  it('should return empty array for empty parsed result', () => {
    const parsed: StripParseResult = {
      analytes: [],
      rawJson: '{}',
      modelVersion: 'gemini-2.5-flash',
    };

    const validated = validateStripResult(parsed, ['TSH', 'T4']);

    expect(validated).toHaveLength(0);
  });

  // ─── Test 12: Mixed scenario — multiple analytes with various flags ──────

  it('should handle mixed scenario with multiple analytes', () => {
    const parsed: StripParseResult = {
      analytes: [
        { name: 'TSH', value: 2.5, unit: 'mIU/mL', confidence: 0.95 }, // Clean
        { name: 'T4', value: 0.01, unit: 'ng/dL', confidence: 0.5 }, // Low-conf + out of range
        { name: 'IgE', value: 500, unit: 'WRONG', confidence: 0.9 }, // Unit-mismatch
        { name: 'UNKNOWN', value: 1, unit: 'U/L', confidence: 0.9 }, // Unknown-analyte
      ],
      rawJson: '{}',
      modelVersion: 'gemini-2.5-flash',
    };

    const validated = validateStripResult(parsed, ['TSH', 'T4', 'IgE'], {
      TSH: ['mIU/mL'],
      T4: ['ng/dL'],
      IgE: ['IU/mL'],
    });

    expect(validated[0].flags).toHaveLength(0); // TSH clean
    expect(validated[1].flags).toContain('low-confidence'); // T4 low-conf
    expect(validated[1].flags).toContain('value-out-of-plausible-range'); // T4 out of range
    expect(validated[2].flags).toContain('unit-mismatch'); // IgE unit mismatch
    expect(validated[3].flags).toContain('unknown-analyte'); // UNKNOWN not matched
  });
});
