import {
  ImunoResult,
  ImunoIAClassification,
  ImunoIADatasetRecord,
} from '../strip-classifier/types';

/**
 * Parses confidence score from Gemini response, normalizing to 0–1 range.
 * Handles markdown formatting cleanup (e.g., "**0.92**" → 0.92).
 *
 * @param rawScore Raw confidence value (string or number)
 * @returns Normalized confidence score (0–1)
 * @throws Error if score cannot be parsed or is outside valid range
 */
export function parseConfidenceScore(rawScore: string | number): number {
  let score: number;

  if (typeof rawScore === 'number') {
    score = rawScore;
  } else if (typeof rawScore === 'string') {
    // Clean markdown formatting (e.g., "**0.92**" or "0.92" or " 0.92 ")
    const cleaned = rawScore.replace(/[\*\s]/g, '');
    score = parseFloat(cleaned);
  } else {
    throw new Error(`Invalid confidence score type: ${typeof rawScore}`);
  }

  if (Number.isNaN(score) || !Number.isFinite(score)) {
    throw new Error(`Invalid confidence score: ${rawScore}`);
  }

  if (score < 0 || score > 1) {
    throw new Error(`Confidence score out of range [0, 1]: ${score}`);
  }

  return score;
}

/**
 * Validates confidence threshold enforcement (default 0.85).
 * Raises error if classification confidence is below threshold without error handling.
 *
 * @param confidence Confidence score (0–1)
 * @param threshold Minimum acceptable confidence (default: 0.85)
 * @throws Error if confidence < threshold
 */
export function validateConfidenceThreshold(confidence: number, threshold = 0.85): void {
  if (confidence < threshold) {
    throw new Error(
      `Confidence ${confidence} below threshold ${threshold}. Manual review required.`,
    );
  }
}

/**
 * Classifies a strip image via Gemini Vision API response.
 * Parses confidence, validates threshold, and returns structured result.
 *
 * @param geminiResponse Raw Gemini API response containing result, confidence, and rawText
 * @param operatorId UID of operator submitting classification
 * @param labId Lab ID for multi-tenant isolation
 * @returns Structured ImunoIAClassification (without id/labId — service assigns)
 * @throws Error if confidence < 0.85 or response format invalid
 */
export async function classifyStripImage(
  geminiResponse: {
    result: string;
    confidence: number | string;
    rawText: string;
    analyte: string;
  },
  operatorId: string,
  labId: string,
): Promise<Omit<ImunoIAClassification, 'id' | 'labId' | 'hash' | 'createdAt'>> {
  // Validate result enum
  const resultStr = geminiResponse.result.toLowerCase();
  if (!Object.values(ImunoResult).includes(resultStr as ImunoResult)) {
    throw new Error(`Invalid result enum: ${geminiResponse.result}`);
  }

  // Parse and validate confidence
  const confidence = parseConfidenceScore(geminiResponse.confidence);
  validateConfidenceThreshold(confidence);

  return {
    analyte: geminiResponse.analyte,
    result: resultStr as ImunoResult,
    confidence,
    rawText: geminiResponse.rawText,
    operatorId,
    imageUrl: '', // Assigned by service during callable
    modelVersion: 'gemini-2.5-flash',
  };
}

/**
 * Calculates accuracy delta from dataset record comparison.
 * Accuracy increases by 0.01 per matching classification, decreases by 0.01 per mismatch.
 *
 * @param records Array of ImunoIADatasetRecord
 * @returns Accuracy percentage (0–100)
 */
export function calculateAccuracy(records: ImunoIADatasetRecord[]): number {
  if (records.length === 0) {
    return 100; // No data = no errors (conservative)
  }

  const accurateCount = records.filter((r) => r.isAccurate).length;
  const accuracyPct = (accurateCount / records.length) * 100;

  return Math.round(accuracyPct * 100) / 100; // 2 decimal places
}

/**
 * Aggregates accuracy metrics by month from dataset records.
 * Groups by creation timestamp (YYYY-MM) and computes monthly accuracy.
 *
 * @param records Array of ImunoIADatasetRecord
 * @returns Map of period (YYYY-MM) → accuracy percentage
 */
export function aggregateAccuracyByMonth(
  records: ImunoIADatasetRecord[],
): Map<string, { accuracy: number; count: number }> {
  const byMonth = new Map<string, { accurate: number; total: number }>();

  records.forEach((record) => {
    if (record.deletedAt) {
      return; // Skip soft-deleted records
    }

    // Extract YYYY-MM from createdAt (Firestore Timestamp)
    const date = new Date(record.createdAt.toMillis());
    const period = date.toISOString().slice(0, 7); // "2026-05"

    const existing = byMonth.get(period) || { accurate: 0, total: 0 };
    existing.total += 1;
    if (record.isAccurate) {
      existing.accurate += 1;
    }
    byMonth.set(period, existing);
  });

  // Convert to accuracy percentages
  const result = new Map<string, { accuracy: number; count: number }>();
  byMonth.forEach((value, period) => {
    const accuracy = (value.accurate / value.total) * 100;
    result.set(period, {
      accuracy: Math.round(accuracy * 100) / 100,
      count: value.total,
    });
  });

  return result;
}
