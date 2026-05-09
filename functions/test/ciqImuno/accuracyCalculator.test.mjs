/**
 * accuracyCalculator.test.mjs
 * Unit tests for accuracy calculation engine
 *
 * Tests:
 * - Known confusion matrix
 * - Accuracy calculation (percentage)
 * - Per-confidence binning
 * - Per-test-kit metrics
 * - Zero-division edge cases
 *
 * Uses Node.js built-in test runner (node:test)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAccuracy } from '../../lib/modules/ciqImuno/accuracyCalculator.js';

describe('Accuracy Calculator', () => {
  /**
   * Test 1: Known confusion matrix
   * 10 images: 8 correct, 2 incorrect
   * Expected accuracy: 0.8 (80%)
   */
  test('should calculate correct accuracy for known confusion matrix', () => {
    const images = [
      {
        id: '1',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.92 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '2',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.88 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '3',
        testKit: 'Dengue',
        geminiClassification: { classification: 'Negative', confidence: 0.85 },
        manualVerdict: {
          classification: 'Negative',
          verifiedBy: 'op2',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '4',
        testKit: 'Dengue',
        geminiClassification: { classification: 'Positive', confidence: 0.75 },
        manualVerdict: {
          classification: 'Negative',
          verifiedBy: 'op2',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '5',
        testKit: 'Syphilis',
        geminiClassification: { classification: 'Negative', confidence: 0.91 },
        manualVerdict: {
          classification: 'Negative',
          verifiedBy: 'op3',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '6',
        testKit: 'Syphilis',
        geminiClassification: { classification: 'Positive', confidence: 0.78 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op3',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '7',
        testKit: 'COVID',
        geminiClassification: { classification: 'Positive', confidence: 0.93 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op4',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '8',
        testKit: 'COVID',
        geminiClassification: { classification: 'Negative', confidence: 0.82 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op4',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '9',
        testKit: 'HCG',
        geminiClassification: { classification: 'Positive', confidence: 0.89 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op5',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '10',
        testKit: 'HCG',
        geminiClassification: { classification: 'Invalid', confidence: 0.72 },
        manualVerdict: {
          classification: 'Negative',
          verifiedBy: 'op5',
          verifiedAt: { toDate: () => new Date() },
        },
      },
    ];

    const result = calculateAccuracy(images);

    // 7 correct out of 10 = 70%
    assert.strictEqual(result.accuracy, 0.7);
    assert.strictEqual(result.correctMatches, 7);
    assert.strictEqual(result.totalImages, 10);
  });

  /**
   * Test 2: Confusion matrix structure
   */
  test('should generate correct confusion matrix', () => {
    const images = [
      {
        id: '1',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.92 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '2',
        testKit: 'HIV',
        geminiClassification: { classification: 'Negative', confidence: 0.88 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '3',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.85 },
        manualVerdict: {
          classification: 'Negative',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
    ];

    const result = calculateAccuracy(images);

    // Expected matrix:
    // Positive: { Positive: 1, Negative: 1 }
    // Negative: { Positive: 1 }
    assert.deepStrictEqual(result.confusionMatrix['Positive'], {
      Positive: 1,
      Negative: 1,
    });
    assert.deepStrictEqual(result.confusionMatrix['Negative'], {
      Positive: 1,
    });
  });

  /**
   * Test 3: Per-confidence binning (0.7-0.8, 0.8-0.9, 0.9-1.0)
   */
  test('should correctly bin by confidence level', () => {
    const images = [
      // 0.7-0.8 bin
      {
        id: '1',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.75 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      // 0.8-0.9 bin
      {
        id: '2',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.85 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      // 0.9-1.0 bin
      {
        id: '3',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.92 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
    ];

    const result = calculateAccuracy(images);

    assert.strictEqual(result.confidenceBins['0.7-0.8'].count, 1);
    assert.strictEqual(result.confidenceBins['0.7-0.8'].accuracy, 1.0); // 1 correct out of 1

    assert.strictEqual(result.confidenceBins['0.8-0.9'].count, 1);
    assert.strictEqual(result.confidenceBins['0.8-0.9'].accuracy, 1.0);

    assert.strictEqual(result.confidenceBins['0.9-1.0'].count, 1);
    assert.strictEqual(result.confidenceBins['0.9-1.0'].accuracy, 1.0);
  });

  /**
   * Test 4: Per-test-kit metrics
   */
  test('should calculate per-test-kit metrics correctly', () => {
    const images = [
      {
        id: '1',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.92 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '2',
        testKit: 'HIV',
        geminiClassification: { classification: 'Negative', confidence: 0.88 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '3',
        testKit: 'Dengue',
        geminiClassification: { classification: 'Positive', confidence: 0.85 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op2',
          verifiedAt: { toDate: () => new Date() },
        },
      },
    ];

    const result = calculateAccuracy(images);

    // HIV: 1 correct out of 2 = 50%
    assert.strictEqual(result.perTestKitMetrics['HIV'].accuracy, 0.5);
    assert.strictEqual(result.perTestKitMetrics['HIV'].count, 2);
    assert.ok(Math.abs(result.perTestKitMetrics['HIV'].confidence_avg - (0.92 + 0.88) / 2) < 0.001);

    // Dengue: 1 correct out of 1 = 100%
    assert.strictEqual(result.perTestKitMetrics['Dengue'].accuracy, 1.0);
    assert.strictEqual(result.perTestKitMetrics['Dengue'].count, 1);
    assert.ok(Math.abs(result.perTestKitMetrics['Dengue'].confidence_avg - 0.85) < 0.001);

    // Other test kits: no images
    assert.strictEqual(result.perTestKitMetrics['Syphilis'].count, 0);
    assert.strictEqual(result.perTestKitMetrics['Syphilis'].accuracy, 0);
  });

  /**
   * Test 5: Zero-division edge cases
   */
  test('should handle empty image list gracefully', () => {
    const images = [];

    const result = calculateAccuracy(images);

    assert.strictEqual(result.totalImages, 0);
    assert.strictEqual(result.correctMatches, 0);
    assert.strictEqual(result.accuracy, 0);
    assert.deepStrictEqual(result.confusionMatrix, {});
    assert.strictEqual(result.confidenceBins['0.7-0.8'].count, 0);
    assert.strictEqual(result.confidenceBins['0.7-0.8'].accuracy, 0);
  });

  /**
   * Test 6: No verified images (all lack manualVerdict)
   */
  test('should return zero metrics when no verified images exist', () => {
    const images = [
      {
        id: '1',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.92 },
        manualVerdict: null, // Not verified
      },
    ];

    const result = calculateAccuracy(images);

    assert.strictEqual(result.totalImages, 0);
    assert.strictEqual(result.accuracy, 0);
  });

  /**
   * Test 7: Perfect accuracy (100%)
   */
  test('should return 1.0 for perfect accuracy', () => {
    const images = [
      {
        id: '1',
        testKit: 'HIV',
        geminiClassification: { classification: 'Positive', confidence: 0.92 },
        manualVerdict: {
          classification: 'Positive',
          verifiedBy: 'op1',
          verifiedAt: { toDate: () => new Date() },
        },
      },
      {
        id: '2',
        testKit: 'Dengue',
        geminiClassification: { classification: 'Negative', confidence: 0.88 },
        manualVerdict: {
          classification: 'Negative',
          verifiedBy: 'op2',
          verifiedAt: { toDate: () => new Date() },
        },
      },
    ];

    const result = calculateAccuracy(images);

    assert.strictEqual(result.accuracy, 1.0);
    assert.strictEqual(result.correctMatches, 2);
  });
});
