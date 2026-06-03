import { describe, it, expect, vi } from 'vitest';
import {
  classifyStripImage,
  parseConfidenceScore,
  calculateAccuracy,
  validateConfidenceThreshold,
  aggregateAccuracyByMonth,
} from '../utils/classificationHelpers';
import { ImunoResult } from '../strip-classifier/types';
import type { ImunoIADatasetRecord } from '../strip-classifier/types';
import { Timestamp } from 'firebase/firestore';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockOperatorId = 'op-001';
const mockLabId = 'lab-riopomba';

// ─── parseConfidenceScore tests ────────────────────────────────────────────────

describe('parseConfidenceScore', () => {
  it('should parse numeric confidence score', () => {
    expect(parseConfidenceScore(0.95)).toBe(0.95);
  });

  it('should parse string confidence score', () => {
    expect(parseConfidenceScore('0.92')).toBe(0.92);
  });

  it('should clean markdown formatting', () => {
    expect(parseConfidenceScore('**0.88**')).toBe(0.88);
  });

  it('should trim whitespace', () => {
    expect(parseConfidenceScore('  0.85  ')).toBe(0.85);
  });

  it('should handle boundary value 0.0', () => {
    expect(parseConfidenceScore(0.0)).toBe(0.0);
  });

  it('should handle boundary value 1.0', () => {
    expect(parseConfidenceScore(1.0)).toBe(1.0);
  });

  it('should throw on NaN', () => {
    expect(() => parseConfidenceScore('abc')).toThrow('Invalid confidence score');
  });

  it('should throw on Infinity', () => {
    expect(() => parseConfidenceScore(Infinity)).toThrow('Invalid confidence score');
  });

  it('should throw on score < 0', () => {
    expect(() => parseConfidenceScore(-0.1)).toThrow('Confidence score out of range');
  });

  it('should throw on score > 1', () => {
    expect(() => parseConfidenceScore(1.5)).toThrow('Confidence score out of range');
  });

  it('should throw on invalid type', () => {
    expect(() => parseConfidenceScore({} as never)).toThrow('Invalid confidence score type');
  });
});

// ─── validateConfidenceThreshold tests ─────────────────────────────────────────

describe('validateConfidenceThreshold', () => {
  it('should allow confidence at threshold (0.85)', () => {
    expect(() => validateConfidenceThreshold(0.85)).not.toThrow();
  });

  it('should allow confidence above threshold (0.95)', () => {
    expect(() => validateConfidenceThreshold(0.95)).not.toThrow();
  });

  it('should throw on confidence below threshold', () => {
    expect(() => validateConfidenceThreshold(0.84)).toThrow('below threshold');
  });

  it('should throw on very low confidence', () => {
    expect(() => validateConfidenceThreshold(0.5)).toThrow('Manual review required');
  });

  it('should respect custom threshold', () => {
    expect(() => validateConfidenceThreshold(0.9, 0.95)).toThrow();
    expect(() => validateConfidenceThreshold(0.96, 0.95)).not.toThrow();
  });
});

// ─── classifyStripImage tests ──────────────────────────────────────────────────

describe('classifyStripImage', () => {
  it('should classify positive strip with high confidence', async () => {
    const result = await classifyStripImage(
      {
        result: 'positive',
        confidence: 0.96,
        rawText: 'HIV strip: 2 lines visible',
        analyte: 'HIV',
      },
      mockOperatorId,
      mockLabId,
    );

    expect(result.result).toBe(ImunoResult.POSITIVE);
    expect(result.confidence).toBe(0.96);
    expect(result.analyte).toBe('HIV');
    expect(result.operatorId).toBe(mockOperatorId);
  });

  it('should classify negative strip with high confidence', async () => {
    const result = await classifyStripImage(
      {
        result: 'negative',
        confidence: 0.93,
        rawText: 'HIV strip: 1 line visible (control only)',
        analyte: 'HIV',
      },
      mockOperatorId,
      mockLabId,
    );

    expect(result.result).toBe(ImunoResult.NEGATIVE);
    expect(result.confidence).toBe(0.93);
  });

  it('should classify inconclusive result', async () => {
    const result = await classifyStripImage(
      {
        result: 'inconclusive',
        confidence: 0.88,
        rawText: 'Strip quality degraded; recommend re-test',
        analyte: 'Syphilis',
      },
      mockOperatorId,
      mockLabId,
    );

    expect(result.result).toBe(ImunoResult.INCONCLUSIVE);
    expect(result.confidence).toBe(0.88);
  });

  it('should accept confidence exactly at 0.85 threshold', async () => {
    const result = await classifyStripImage(
      {
        result: 'positive',
        confidence: 0.85,
        rawText: 'HepB strip: borderline clear',
        analyte: 'HepB',
      },
      mockOperatorId,
      mockLabId,
    );

    expect(result.confidence).toBe(0.85);
  });

  it('should throw on confidence below 0.85', async () => {
    await expect(
      classifyStripImage(
        {
          result: 'positive',
          confidence: 0.8,
          rawText: 'Low quality strip',
          analyte: 'HIV',
        },
        mockOperatorId,
        mockLabId,
      ),
    ).rejects.toThrow('below threshold');
  });

  it('should throw on invalid result enum', async () => {
    await expect(
      classifyStripImage(
        {
          result: 'invalid-result',
          confidence: 0.95,
          rawText: 'Strip image',
          analyte: 'HIV',
        },
        mockOperatorId,
        mockLabId,
      ),
    ).rejects.toThrow('Invalid result enum');
  });

  it('should parse string confidence score', async () => {
    const result = await classifyStripImage(
      {
        result: 'negative',
        confidence: '0.91',
        rawText: 'Clear negative',
        analyte: 'Syphilis',
      },
      mockOperatorId,
      mockLabId,
    );

    expect(result.confidence).toBe(0.91);
  });

  it('should clean markdown in confidence', async () => {
    const result = await classifyStripImage(
      {
        result: 'positive',
        confidence: '**0.94**',
        rawText: 'Strip data',
        analyte: 'HIV',
      },
      mockOperatorId,
      mockLabId,
    );

    expect(result.confidence).toBe(0.94);
  });

  it('should include required fields in response', async () => {
    const result = await classifyStripImage(
      {
        result: 'positive',
        confidence: 0.92,
        rawText: 'Test strip',
        analyte: 'HepC',
      },
      mockOperatorId,
      mockLabId,
    );

    expect(result.analyte).toBe('HepC');
    expect(result.result).toBe(ImunoResult.POSITIVE);
    expect(result.confidence).toBe(0.92);
    expect(result.rawText).toBe('Test strip');
    expect(result.operatorId).toBe(mockOperatorId);
    expect(result.modelVersion).toBe('gemini-2.5-flash');
    expect(typeof result.imageUrl).toBe('string');
  });

  it('should handle case-insensitive result', async () => {
    const result = await classifyStripImage(
      {
        result: 'POSITIVE',
        confidence: 0.9,
        rawText: 'Strip data',
        analyte: 'HIV',
      },
      mockOperatorId,
      mockLabId,
    );

    expect(result.result).toBe(ImunoResult.POSITIVE);
  });
});

// ─── calculateAccuracy tests ───────────────────────────────────────────────────

describe('calculateAccuracy', () => {
  const createRecord = (accurate: boolean): ImunoIADatasetRecord => ({
    id: 'rec-' + Math.random(),
    labId: mockLabId,
    aiClassification: {
      id: 'clas-' + Math.random(),
      labId: mockLabId,
      analyte: 'HIV',
      result: accurate ? ImunoResult.POSITIVE : ImunoResult.POSITIVE,
      confidence: 0.95,
      rawText: 'test',
      operatorId: mockOperatorId,
      hash: '0'.repeat(64),
      createdAt: Timestamp.now(),
      imageUrl: 'gs://test.jpg',
      modelVersion: 'gemini-2.5-flash',
    },
    manualVerdict: {
      result: ImunoResult.POSITIVE,
      operatorId: mockOperatorId,
      justification: 'Manually verified',
      verifiedAt: Timestamp.now(),
    },
    isAccurate: accurate,
    exported: false,
    createdAt: Timestamp.now(),
    createdBy: mockOperatorId,
  });

  it('should return 100% for empty dataset', () => {
    expect(calculateAccuracy([])).toBe(100);
  });

  it('should return 100% for all accurate classifications', () => {
    const records = [createRecord(true), createRecord(true), createRecord(true)];
    expect(calculateAccuracy(records)).toBe(100);
  });

  it('should return 0% for zero accurate classifications', () => {
    const records = [createRecord(false), createRecord(false)];
    expect(calculateAccuracy(records)).toBe(0);
  });

  it('should calculate 50% accuracy (5/10 accurate)', () => {
    const records = [
      ...Array(5)
        .fill(null)
        .map(() => createRecord(true)),
      ...Array(5)
        .fill(null)
        .map(() => createRecord(false)),
    ];
    expect(calculateAccuracy(records)).toBe(50);
  });

  it('should calculate 90% accuracy (9/10 accurate)', () => {
    const records = [
      ...Array(9)
        .fill(null)
        .map(() => createRecord(true)),
      createRecord(false),
    ];
    expect(calculateAccuracy(records)).toBe(90);
  });

  it('should round to 2 decimal places', () => {
    const records = [createRecord(true), createRecord(true), createRecord(false)];
    // 2/3 = 66.666...%
    const result = calculateAccuracy(records);
    expect(result).toBe(66.67);
  });

  it('should handle single accurate record', () => {
    expect(calculateAccuracy([createRecord(true)])).toBe(100);
  });

  it('should handle single inaccurate record', () => {
    expect(calculateAccuracy([createRecord(false)])).toBe(0);
  });
});

// ─── aggregateAccuracyByMonth tests ────────────────────────────────────────────

describe('aggregateAccuracyByMonth', () => {
  const createRecordForDate = (date: Date, accurate: boolean): ImunoIADatasetRecord => ({
    id: 'rec-' + Math.random(),
    labId: mockLabId,
    aiClassification: {
      id: 'clas-' + Math.random(),
      labId: mockLabId,
      analyte: 'HIV',
      result: ImunoResult.POSITIVE,
      confidence: 0.95,
      rawText: 'test',
      operatorId: mockOperatorId,
      hash: '0'.repeat(64),
      createdAt: Timestamp.fromDate(date),
      imageUrl: 'gs://test.jpg',
      modelVersion: 'gemini-2.5-flash',
    },
    manualVerdict: {
      result: ImunoResult.POSITIVE,
      operatorId: mockOperatorId,
      justification: 'Verified',
      verifiedAt: Timestamp.now(),
    },
    isAccurate: accurate,
    exported: false,
    createdAt: Timestamp.fromDate(date),
    createdBy: mockOperatorId,
  });

  it('should return empty map for empty records', () => {
    expect(aggregateAccuracyByMonth([])).toHaveLength(0);
  });

  it('should aggregate single month with 100% accuracy', () => {
    const date = new Date('2026-05-15');
    const records = [createRecordForDate(date, true), createRecordForDate(date, true)];
    const result = aggregateAccuracyByMonth(records);

    expect(result.size).toBe(1);
    expect(result.get('2026-05')).toEqual({ accuracy: 100, count: 2 });
  });

  it('should aggregate single month with mixed accuracy', () => {
    const date = new Date('2026-05-10');
    const records = [
      createRecordForDate(date, true),
      createRecordForDate(date, true),
      createRecordForDate(date, false),
    ];
    const result = aggregateAccuracyByMonth(records);

    expect(result.get('2026-05')).toEqual({ accuracy: 66.67, count: 3 });
  });

  it('should separate records by month', () => {
    const records = [
      ...Array(2)
        .fill(null)
        .map(() => createRecordForDate(new Date('2026-04-10'), true)),
      ...Array(3)
        .fill(null)
        .map(() => createRecordForDate(new Date('2026-05-15'), true)),
      createRecordForDate(new Date('2026-05-20'), false),
    ];
    const result = aggregateAccuracyByMonth(records);

    expect(result.size).toBe(2);
    expect(result.get('2026-04')).toEqual({ accuracy: 100, count: 2 });
    expect(result.get('2026-05')).toEqual({ accuracy: 75, count: 4 });
  });

  it('should skip soft-deleted records', () => {
    const date = new Date('2026-05-10');
    const records: ImunoIADatasetRecord[] = [
      createRecordForDate(date, true),
      {
        ...createRecordForDate(date, false),
        deletedAt: Timestamp.now(),
      },
      createRecordForDate(date, true),
    ];
    const result = aggregateAccuracyByMonth(records);

    // Should only count 2 records (deleted one ignored)
    expect(result.get('2026-05')).toEqual({ accuracy: 100, count: 2 });
  });

  it('should handle multiple years', () => {
    const records = [
      createRecordForDate(new Date('2025-12-10'), true),
      createRecordForDate(new Date('2026-01-15'), true),
      createRecordForDate(new Date('2026-01-20'), false),
    ];
    const result = aggregateAccuracyByMonth(records);

    expect(result.size).toBe(2);
    expect(result.get('2025-12')).toEqual({ accuracy: 100, count: 1 });
    expect(result.get('2026-01')).toEqual({ accuracy: 50, count: 2 });
  });
});
