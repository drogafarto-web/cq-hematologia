/**
 * Tests for Laudo OCR Validators
 */

import { describe, it, expect } from 'vitest';
import {
  validateField10,
  validateField11,
  validateField12,
  validateLaudoExtraction,
  getExtractionReviewLevel,
} from '../validators';
import { Field10, Field11, Field12, LaudoExtractedFields } from '../types';
import * as admin from 'firebase-admin';

describe('Field Validators', () => {
  describe('Field 10 (Observações) — Required', () => {
    it('should validate non-empty text', () => {
      const field10: Field10 = {
        text: 'Patient shows normal results.',
        confidence: 'high',
      };

      expect(validateField10(field10)).toBe(true);
    });

    it('should reject empty text', () => {
      const field10: Field10 = { text: '', confidence: 'high' };
      expect(validateField10(field10)).toBe(false);
    });

    it('should reject whitespace-only text', () => {
      const field10: Field10 = { text: '   ', confidence: 'high' };
      expect(validateField10(field10)).toBe(false);
    });

    it('should accept text with high/medium/low confidence', () => {
      expect(validateField10({ text: 'Notes', confidence: 'high' })).toBe(true);
      expect(validateField10({ text: 'Notes', confidence: 'medium' })).toBe(true);
      expect(validateField10({ text: 'Notes', confidence: 'low' })).toBe(true);
    });
  });

  describe('Field 11 (RT Signature) — Advisory', () => {
    it('should pass validation with detected=true and bounding box', () => {
      const field11: Field11 = {
        detected: true,
        boundingBox: { x: 10, y: 75, width: 20, height: 15 },
        confidence: 'high',
      };

      const result = validateField11(field11);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it('should warn if detected=false', () => {
      const field11: Field11 = {
        detected: false,
        confidence: 'high',
      };

      const result = validateField11(field11);
      expect(result.isValid).toBe(true); // Still valid, but with warning
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('not detected');
    });

    it('should warn if detected=true but no bounding box', () => {
      const field11: Field11 = {
        detected: true,
        confidence: 'high',
      };

      const result = validateField11(field11);
      expect(result.warnings.some((w) => w.includes('bounding box'))).toBe(true);
    });

    it('should allow null/undefined bounding box if not detected', () => {
      const field11: Field11 = {
        detected: false,
        confidence: 'high',
      };

      const result = validateField11(field11);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Field 12 (Director Signature + Date) — Advisory', () => {
    it('should pass with detected=true, boundingBox, and date', () => {
      const field12: Field12 = {
        detected: true,
        dateText: '2026-05-08',
        boundingBox: { x: 70, y: 75, width: 20, height: 15 },
        confidence: 'high',
      };

      const result = validateField12(field12);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it('should warn if detected=false', () => {
      const field12: Field12 = {
        detected: false,
        dateText: null,
      };

      const result = validateField12(field12);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn if no dateText extracted', () => {
      const field12: Field12 = {
        detected: true,
        dateText: null,
        boundingBox: { x: 70, y: 75, width: 20, height: 15 },
      };

      const result = validateField12(field12);
      expect(result.warnings.some((w) => w.includes('date'))).toBe(true);
    });
  });
});

describe('Complete Extraction Validation', () => {
  it('should require field10 (fail if empty)', () => {
    const extraction: Partial<LaudoExtractedFields> = {
      field10: { text: '', confidence: 'high' }, // Invalid
      field11: { detected: false },
      field12: { detected: false },
      source: 'auto',
      labId: 'lab-1',
      laudoId: 'laudo-1',
      extractedAt: admin.firestore.Timestamp.now(),
      extractedBy: 'op-1',
    } as any;

    const result = validateLaudoExtraction(extraction as LaudoExtractedFields);
    expect(result.ok).toBe(false);
  });

  it('should accept extraction with field10 + optional signatures', () => {
    const extraction: Partial<LaudoExtractedFields> = {
      field10: { text: 'Valid clinical notes', confidence: 'high' },
      field11: { detected: false }, // Not required
      field12: { detected: false }, // Not required
      source: 'auto',
      labId: 'lab-1',
      laudoId: 'laudo-1',
      extractedAt: admin.firestore.Timestamp.now(),
      extractedBy: 'op-1',
    } as any;

    const result = validateLaudoExtraction(extraction as LaudoExtractedFields);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0); // Warnings about missing signatures
  });

  it('should collect all warnings', () => {
    const extraction: Partial<LaudoExtractedFields> = {
      field10: { text: 'Notes', confidence: 'high' },
      field11: { detected: false }, // Warning
      field12: { detected: false, dateText: null }, // 2 warnings
      source: 'auto',
      labId: 'lab-1',
      laudoId: 'laudo-1',
      extractedAt: admin.firestore.Timestamp.now(),
      extractedBy: 'op-1',
    } as any;

    const result = validateLaudoExtraction(extraction as LaudoExtractedFields);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Review Level Determination', () => {
  it('should auto-save if all high confidence + all detected', () => {
    const extraction: Partial<LaudoExtractedFields> = {
      field10: { text: 'Notes', confidence: 'high' },
      field11: { detected: true, confidence: 'high' },
      field12: { detected: true, confidence: 'high' },
      source: 'auto',
      labId: 'lab-1',
      laudoId: 'laudo-1',
      extractedAt: admin.firestore.Timestamp.now(),
      extractedBy: 'op-1',
    } as any;

    const level = getExtractionReviewLevel(extraction as LaudoExtractedFields);
    expect(level).toBe('auto');
  });

  it('should escalate to manual review if field10 empty', () => {
    const extraction: Partial<LaudoExtractedFields> = {
      field10: { text: '', confidence: 'high' }, // Invalid
      field11: { detected: true, confidence: 'high' },
      field12: { detected: true, confidence: 'high' },
      source: 'auto',
      labId: 'lab-1',
      laudoId: 'laudo-1',
      extractedAt: admin.firestore.Timestamp.now(),
      extractedBy: 'op-1',
    } as any;

    const level = getExtractionReviewLevel(extraction as LaudoExtractedFields);
    expect(level).toBe('manual-review');
  });

  it('should escalate to manual review if signatures not detected', () => {
    const extraction: Partial<LaudoExtractedFields> = {
      field10: { text: 'Notes', confidence: 'high' },
      field11: { detected: false }, // Not detected → warning → manual review
      field12: { detected: false }, // Not detected → warning → manual review
      source: 'auto',
      labId: 'lab-1',
      laudoId: 'laudo-1',
      extractedAt: admin.firestore.Timestamp.now(),
      extractedBy: 'op-1',
    } as any;

    const level = getExtractionReviewLevel(extraction as LaudoExtractedFields);
    expect(level).toBe('manual-review');
  });

  it('should escalate to manual review if any medium/low confidence', () => {
    const extraction: Partial<LaudoExtractedFields> = {
      field10: { text: 'Notes', confidence: 'medium' }, // Not high
      field11: { detected: true, confidence: 'high' },
      field12: { detected: true, confidence: 'high' },
      source: 'auto',
      labId: 'lab-1',
      laudoId: 'laudo-1',
      extractedAt: admin.firestore.Timestamp.now(),
      extractedBy: 'op-1',
    } as any;

    const level = getExtractionReviewLevel(extraction as LaudoExtractedFields);
    expect(level).toBe('manual-review');
  });
});
