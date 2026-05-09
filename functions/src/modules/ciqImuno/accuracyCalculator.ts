/**
 * accuracyCalculator.ts
 * Phase 5 Task 05-04: IA Classification Feedback Loop + Dataset Aggregation
 *
 * Calculates accuracy metrics for Gemini classifications:
 * - Overall accuracy
 * - Confusion matrix
 * - Per-confidence bin metrics (0.7-0.8, 0.8-0.9, 0.9-1.0)
 * - Per-test-kit metrics
 */

export type Classification = 'Positive' | 'Negative' | 'Invalid' | 'Grey-Zone';
export type TestKit = 'HIV' | 'Dengue' | 'Syphilis' | 'COVID' | 'HCG';

/**
 * Represents a verified image with both Gemini and manual classifications
 */
export interface VerifiedImage {
  id: string;
  testKit: TestKit;
  geminiClassification: {
    classification: Classification;
    confidence: number;
  };
  manualVerdict: {
    classification: Classification;
    verifiedBy: string;
    verifiedAt: any; // Firestore Timestamp
  };
}

/**
 * Accuracy metrics result
 */
export interface AccuracyMetrics {
  totalImages: number;
  correctMatches: number;
  accuracy: number;
  confusionMatrix: Record<string, Record<string, number>>;
  confidenceBins: Record<
    string,
    {
      count: number;
      accuracy: number;
    }
  >;
  perTestKitMetrics: Record<
    string,
    {
      accuracy: number;
      count: number;
      confidence_avg: number;
    }
  >;
}

/**
 * Calculate overall and binned accuracy metrics
 *
 * @param images Array of verified images (must have both gemini + manual classifications)
 * @returns AccuracyMetrics object with all calculations
 *
 * Handles:
 * - Zero-division edge cases (returns 0 if no images)
 * - Per-confidence binning (0.7-0.8, 0.8-0.9, 0.9-1.0)
 * - Per-test-kit breakdown
 * - Confusion matrix generation
 */
export function calculateAccuracy(images: VerifiedImage[]): AccuracyMetrics {
  // Filter images with manual verifications
  const verified = images.filter((img) => img.manualVerdict);
  const total = verified.length;

  // Edge case: no verified images
  if (total === 0) {
    return {
      totalImages: 0,
      correctMatches: 0,
      accuracy: 0,
      confusionMatrix: {},
      confidenceBins: {
        '0.7-0.8': { count: 0, accuracy: 0 },
        '0.8-0.9': { count: 0, accuracy: 0 },
        '0.9-1.0': { count: 0, accuracy: 0 },
      },
      perTestKitMetrics: {
        HIV: { accuracy: 0, count: 0, confidence_avg: 0 },
        Dengue: { accuracy: 0, count: 0, confidence_avg: 0 },
        Syphilis: { accuracy: 0, count: 0, confidence_avg: 0 },
        COVID: { accuracy: 0, count: 0, confidence_avg: 0 },
        HCG: { accuracy: 0, count: 0, confidence_avg: 0 },
      },
    };
  }

  // Build confusion matrix
  const matrix: Record<string, Record<string, number>> = {};
  let correct = 0;

  for (const img of verified) {
    const predicted = img.geminiClassification.classification;
    const actual = img.manualVerdict.classification;

    if (predicted === actual) {
      correct++;
    }

    // Initialize matrix row if needed
    if (!matrix[actual]) {
      matrix[actual] = {};
    }

    // Increment count
    matrix[actual][predicted] = (matrix[actual][predicted] || 0) + 1;
  }

  // Calculate per-confidence bins (0.7-0.8, 0.8-0.9, 0.9-1.0)
  const bins: Record<string, { correct: number; total: number }> = {
    '0.7-0.8': { correct: 0, total: 0 },
    '0.8-0.9': { correct: 0, total: 0 },
    '0.9-1.0': { correct: 0, total: 0 },
  };

  for (const img of verified) {
    const conf = img.geminiClassification.confidence;
    const isCorrect =
      img.geminiClassification.classification === img.manualVerdict.classification;

    if (conf >= 0.7 && conf < 0.8) {
      bins['0.7-0.8'].total++;
      if (isCorrect) bins['0.7-0.8'].correct++;
    } else if (conf >= 0.8 && conf < 0.9) {
      bins['0.8-0.9'].total++;
      if (isCorrect) bins['0.8-0.9'].correct++;
    } else if (conf >= 0.9) {
      bins['0.9-1.0'].total++;
      if (isCorrect) bins['0.9-1.0'].correct++;
    }
  }

  // Per-test-kit metrics
  const testKits: TestKit[] = ['HIV', 'Dengue', 'Syphilis', 'COVID', 'HCG'];
  const perKit: Record<string, any> = {};

  for (const kit of testKits) {
    const kitImages = verified.filter((img) => img.testKit === kit);
    const kitCorrect = kitImages.filter(
      (img) =>
        img.geminiClassification.classification === img.manualVerdict.classification
    ).length;

    const avgConf =
      kitImages.length > 0
        ? kitImages.reduce((sum, img) => sum + img.geminiClassification.confidence, 0) /
          kitImages.length
        : 0;

    perKit[kit] = {
      accuracy: kitImages.length > 0 ? kitCorrect / kitImages.length : 0,
      count: kitImages.length,
      confidence_avg: avgConf,
    };
  }

  return {
    totalImages: total,
    correctMatches: correct,
    accuracy: total > 0 ? correct / total : 0,
    confusionMatrix: matrix,
    confidenceBins: {
      '0.7-0.8': {
        count: bins['0.7-0.8'].total,
        accuracy:
          bins['0.7-0.8'].total > 0
            ? bins['0.7-0.8'].correct / bins['0.7-0.8'].total
            : 0,
      },
      '0.8-0.9': {
        count: bins['0.8-0.9'].total,
        accuracy:
          bins['0.8-0.9'].total > 0
            ? bins['0.8-0.9'].correct / bins['0.8-0.9'].total
            : 0,
      },
      '0.9-1.0': {
        count: bins['0.9-1.0'].total,
        accuracy:
          bins['0.9-1.0'].total > 0
            ? bins['0.9-1.0'].correct / bins['0.9-1.0'].total
            : 0,
      },
    },
    perTestKitMetrics: perKit,
  };
}
