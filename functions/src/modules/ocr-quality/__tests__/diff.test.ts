/**
 * OCR Diff Engine — unit tests
 *
 * Covers value normalisation, field-level diff, accepted/retry semantics.
 * Pure functions — no Firestore, no clock.
 */
import { describe, it, expect } from '@jest/globals';
import {
  normaliseValue,
  diffFields,
  isAccepted,
  shouldSuggestRetry,
  RETRY_CONFIDENCE_THRESHOLD,
} from '../diff';
import type { OCRResultSnapshot, FinalResultSnapshot } from '../types';

const ocrSnap = (
  fields: Array<{ name: string; value: string; confidence?: number }>,
  overallConfidence = 0.92,
): OCRResultSnapshot => ({
  fields,
  overallConfidence,
  geminiModel: 'gemini-2.5-flash',
});

const finalSnap = (fields: Array<{ name: string; value: string }>): FinalResultSnapshot => ({
  fields,
  finalisedBy: 'op-rt-1',
  finalisedAt: 1_700_000_000_000,
});

describe('normaliseValue', () => {
  it('treats pt-BR comma decimal and en-US dot decimal as equal', () => {
    expect(normaliseValue('12,4')).toBe(normaliseValue('12.4'));
  });

  it('strips thousands separators in both locales', () => {
    expect(normaliseValue('1.234,56')).toBe('1234.56');
    expect(normaliseValue('1,234.56')).toBe('1234.56');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(normaliseValue('  Negativo  ')).toBe('negativo');
    expect(normaliseValue('NEGATIVO')).toBe('negativo');
  });

  it('preserves trailing-zero significant figures', () => {
    // 12.40 and 12.4 are NOT identical — RT may have added a sig-fig.
    expect(normaliseValue('12.40')).not.toBe(normaliseValue('12.4'));
  });

  it('returns empty string for nullish input', () => {
    expect(normaliseValue(null)).toBe('');
    expect(normaliseValue(undefined)).toBe('');
  });
});

describe('diffFields', () => {
  it('marks identical fields as unchanged', () => {
    const ocr = ocrSnap([
      { name: 'WBC', value: '7.2', confidence: 0.95 },
      { name: 'RBC', value: '4.5', confidence: 0.93 },
    ]);
    const fin = finalSnap([
      { name: 'WBC', value: '7.2' },
      { name: 'RBC', value: '4.5' },
    ]);
    const d = diffFields(ocr, fin);
    expect(d.unchangedCount).toBe(2);
    expect(d.modifiedCount).toBe(0);
    expect(d.errorRate).toBe(0);
  });

  it('detects RT-modified field but ignores locale-only differences', () => {
    const ocr = ocrSnap([
      { name: 'WBC', value: '12,4', confidence: 0.88 }, // pt-BR
      { name: 'HGB', value: '14.0', confidence: 0.91 },
    ]);
    const fin = finalSnap([
      { name: 'WBC', value: '12.4' }, // en-US — same value, different locale
      { name: 'HGB', value: '13.5' }, // RT actually changed this
    ]);
    const d = diffFields(ocr, fin);
    expect(d.unchangedCount).toBe(1);
    expect(d.modifiedCount).toBe(1);
    const hgb = d.edits.find((e) => e.field === 'HGB');
    expect(hgb?.kind).toBe('modified');
    expect(hgb?.ocrValue).toBe('14.0');
    expect(hgb?.finalValue).toBe('13.5');
  });

  it('detects added fields (RT typed a value the OCR missed)', () => {
    const ocr = ocrSnap([{ name: 'WBC', value: '7.2' }]);
    const fin = finalSnap([
      { name: 'WBC', value: '7.2' },
      { name: 'PLT', value: '250' },
    ]);
    const d = diffFields(ocr, fin);
    expect(d.addedCount).toBe(1);
    expect(d.unchangedCount).toBe(1);
    const plt = d.edits.find((e) => e.field === 'PLT');
    expect(plt?.kind).toBe('added');
    expect(plt?.finalValue).toBe('250');
  });

  it('detects removed fields (RT deleted a hallucinated OCR value)', () => {
    const ocr = ocrSnap([
      { name: 'WBC', value: '7.2' },
      { name: 'GHOST', value: '99' },
    ]);
    const fin = finalSnap([{ name: 'WBC', value: '7.2' }]);
    const d = diffFields(ocr, fin);
    expect(d.removedCount).toBe(1);
    expect(d.edits.find((e) => e.field === 'GHOST')?.kind).toBe('removed');
  });

  it('errorRate aggregates modified + added + removed over total', () => {
    const ocr = ocrSnap([
      { name: 'A', value: '1' }, // unchanged
      { name: 'B', value: '2' }, // modified
      { name: 'C', value: '3' }, // removed
    ]);
    const fin = finalSnap([
      { name: 'A', value: '1' },
      { name: 'B', value: '20' },
      { name: 'D', value: '4' }, // added
    ]);
    const d = diffFields(ocr, fin);
    // total = 4 (A,B,C,D) — modified=1, added=1, removed=1, unchanged=1
    expect(d.totalFields).toBe(4);
    expect(d.errorRate).toBeCloseTo(0.75, 5);
  });

  it('handles empty snapshots without throwing', () => {
    const d = diffFields(ocrSnap([]), finalSnap([]));
    expect(d.totalFields).toBe(0);
    expect(d.errorRate).toBe(0);
    expect(d.edits).toEqual([]);
  });

  it('skips malformed fields without a name', () => {
    const ocr = ocrSnap([{ name: 'WBC', value: '7.2' }, { name: '', value: 'ignored' } as any]);
    const fin = finalSnap([{ name: 'WBC', value: '7.2' }]);
    const d = diffFields(ocr, fin);
    expect(d.totalFields).toBe(1);
    expect(d.unchangedCount).toBe(1);
  });
});

describe('isAccepted / shouldSuggestRetry', () => {
  it('accepts a perfect run with high confidence', () => {
    const ocr = ocrSnap([{ name: 'WBC', value: '7.2' }], 0.95);
    const fin = finalSnap([{ name: 'WBC', value: '7.2' }]);
    const d = diffFields(ocr, fin);
    expect(isAccepted(d, ocr.overallConfidence)).toBe(true);
  });

  it('rejects a perfect run when confidence is below retry threshold', () => {
    const ocr = ocrSnap([{ name: 'WBC', value: '7.2' }], 0.5);
    const fin = finalSnap([{ name: 'WBC', value: '7.2' }]);
    const d = diffFields(ocr, fin);
    expect(isAccepted(d, ocr.overallConfidence)).toBe(false);
  });

  it('rejects any run with edits even at 1.0 confidence', () => {
    const ocr = ocrSnap([{ name: 'WBC', value: '7.2' }], 1.0);
    const fin = finalSnap([{ name: 'WBC', value: '7.5' }]);
    const d = diffFields(ocr, fin);
    expect(isAccepted(d, ocr.overallConfidence)).toBe(false);
  });

  it('shouldSuggestRetry triggers strictly below threshold', () => {
    expect(shouldSuggestRetry(RETRY_CONFIDENCE_THRESHOLD - 0.0001)).toBe(true);
    expect(shouldSuggestRetry(RETRY_CONFIDENCE_THRESHOLD)).toBe(false);
  });
});
