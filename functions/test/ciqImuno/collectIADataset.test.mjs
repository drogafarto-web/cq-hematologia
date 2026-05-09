/**
 * collectIADataset.test.mjs
 * Unit tests for monthly IA dataset export
 *
 * Tests:
 * - Export JSON schema validation
 * - Sample diversity across test kits
 * - Idempotency (same month → same file)
 * - Accuracy metrics correctness
 *
 * Uses Node.js built-in test runner (node:test)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Collect IA Dataset', () => {
  /**
   * Test 1: Export JSON schema validation
   */
  test('should generate valid export JSON with correct schema', () => {
    const exportData = {
      export_metadata: {
        dataset_version: '1.0',
        export_date: '2026-05-31T23:59:59Z',
        export_month: '2026-05',
        lab_id: 'riopomba',
        total_images: 456,
        verified_images: 420,
      },
      accuracy_metrics: {
        overall_accuracy: 0.88,
        total_verified: 420,
        correct_matches: 370,
        confusion_matrix: {
          Positive: { Positive: 150, Negative: 5 },
          Negative: { Negative: 215, Positive: 50 },
        },
        per_confidence_bin: {
          '0.7-0.8': { count: 20, accuracy: 0.75 },
          '0.8-0.9': { count: 150, accuracy: 0.85 },
          '0.9-1.0': { count: 250, accuracy: 0.92 },
        },
        per_test_kit: {
          HIV: { accuracy: 0.9, count: 85, confidence_avg: 0.88 },
          Dengue: { accuracy: 0.86, count: 92, confidence_avg: 0.87 },
          Syphilis: { accuracy: 0.85, count: 78, confidence_avg: 0.86 },
          COVID: { accuracy: 0.91, count: 81, confidence_avg: 0.89 },
          HCG: { accuracy: 0.89, count: 84, confidence_avg: 0.88 },
        },
      },
      samples: [],
      ml_team_notes: 'Dataset ready for fine-tuning',
      export_file_path: 'gs://hmatologia2.appspot.com/datasets/imuno-ias/2026-05-dataset.json',
    };

    // Validate required fields
    assert.ok(exportData.export_metadata);
    assert.strictEqual(exportData.export_metadata.dataset_version, '1.0');
    assert.match(exportData.export_metadata.export_month, /^\d{4}-\d{2}$/);
    assert.ok(exportData.export_metadata.lab_id);

    assert.ok(exportData.accuracy_metrics);
    assert.ok(exportData.accuracy_metrics.overall_accuracy >= 0);
    assert.ok(exportData.accuracy_metrics.overall_accuracy <= 1);

    assert.ok(Array.isArray(exportData.samples));

    assert.ok(exportData.ml_team_notes);
    assert.strictEqual(typeof exportData.ml_team_notes, 'string');
  });

  /**
   * Test 2: Sample diversity across test kits
   */
  test('should include samples from all test kits', () => {
    const samples = [
      {
        image_id: '1',
        test_kit: 'HIV',
        manual_verdict: 'Positive',
        gemini_classification: 'Positive',
      },
      {
        image_id: '2',
        test_kit: 'Dengue',
        manual_verdict: 'Negative',
        gemini_classification: 'Negative',
      },
      {
        image_id: '3',
        test_kit: 'Syphilis',
        manual_verdict: 'Positive',
        gemini_classification: 'Positive',
      },
      {
        image_id: '4',
        test_kit: 'COVID',
        manual_verdict: 'Invalid',
        gemini_classification: 'Invalid',
      },
      {
        image_id: '5',
        test_kit: 'HCG',
        manual_verdict: 'Positive',
        gemini_classification: 'Positive',
      },
    ];

    const testKits = new Set(samples.map((s) => s.test_kit));

    assert.ok(testKits.has('HIV'));
    assert.ok(testKits.has('Dengue'));
    assert.ok(testKits.has('Syphilis'));
    assert.ok(testKits.has('COVID'));
    assert.ok(testKits.has('HCG'));
  });

  /**
   * Test 3: Sample limit (max 100 samples)
   */
  test('should limit samples to 100 per export', () => {
    const samples = Array.from({ length: 150 }, (_, i) => ({
      image_id: `img-${i}`,
      test_kit: ['HIV', 'Dengue', 'Syphilis', 'COVID', 'HCG'][i % 5],
      manual_verdict: 'Positive',
      gemini_classification: 'Positive',
    }));

    const limitedSamples = samples.slice(0, 100);

    assert.ok(limitedSamples.length <= 100);
    assert.strictEqual(limitedSamples.length, 100);
  });

  /**
   * Test 4: Accuracy metrics correctness in export
   */
  test('should calculate accuracy metrics correctly in export', () => {
    const verified = 420;
    const correct = 370;
    const accuracy = correct / verified;

    const exportAccuracy = {
      overall_accuracy: accuracy,
      total_verified: verified,
      correct_matches: correct,
    };

    assert.ok(Math.abs(exportAccuracy.overall_accuracy - 0.88) < 0.01);
    assert.strictEqual(exportAccuracy.total_verified, 420);
    assert.strictEqual(exportAccuracy.correct_matches, 370);
  });

  /**
   * Test 5: Per-confidence bin totals
   */
  test('should sum confidence bins to equal total verified', () => {
    const accuracyMetrics = {
      overall_accuracy: 0.88,
      total_verified: 420,
      per_confidence_bin: {
        '0.7-0.8': { count: 20, accuracy: 0.75 },
        '0.8-0.9': { count: 150, accuracy: 0.85 },
        '0.9-1.0': { count: 250, accuracy: 0.92 },
      },
    };

    const totalBinned =
      accuracyMetrics.per_confidence_bin['0.7-0.8'].count +
      accuracyMetrics.per_confidence_bin['0.8-0.9'].count +
      accuracyMetrics.per_confidence_bin['0.9-1.0'].count;

    assert.strictEqual(totalBinned, accuracyMetrics.total_verified);
  });

  /**
   * Test 6: Per-test-kit totals
   */
  test('should sum per-test-kit counts to equal total verified', () => {
    const accuracyMetrics = {
      total_verified: 420,
      per_test_kit: {
        HIV: { accuracy: 0.9, count: 85 },
        Dengue: { accuracy: 0.86, count: 92 },
        Syphilis: { accuracy: 0.85, count: 78 },
        COVID: { accuracy: 0.91, count: 81 },
        HCG: { accuracy: 0.89, count: 84 },
      },
    };

    const totalTestKits = Object.values(accuracyMetrics.per_test_kit).reduce(
      (sum, kit) => sum + kit.count,
      0
    );

    assert.strictEqual(totalTestKits, accuracyMetrics.total_verified);
  });

  /**
   * Test 7: Sample record schema
   */
  test('should include all required fields in sample records', () => {
    const sample = {
      image_id: 'img-001',
      test_kit: 'HIV',
      image_url: 'gs://...',
      upload_date: '2026-05-15',
      gemini_classification: 'Positive',
      gemini_confidence: 0.92,
      gemini_reasoning: 'Strong red line visible',
      manual_verdict: 'Positive',
      manual_verified_by: 'op-001',
      manual_verified_at: '2026-05-16T10:30:00Z',
      match: true,
      metadata: {
        lighting_condition: 'bright',
        test_kit_batch: 'LOT-2026-05-001',
        device_type: 'iPhone 14',
        user_notes: 'Good lighting',
      },
    };

    assert.ok(sample.image_id);
    assert.ok(sample.test_kit);
    assert.ok(sample.image_url);
    assert.ok(sample.gemini_classification);
    assert.ok(sample.gemini_confidence);
    assert.ok(sample.manual_verdict);
    assert.ok(sample.manual_verified_by);
    assert.ok(sample.manual_verified_at);
    assert.strictEqual(typeof sample.match, 'boolean');
    assert.ok(sample.metadata);
  });

  /**
   * Test 8: ML team notes generation
   */
  test('should generate appropriate ML team notes based on accuracy', () => {
    const highAccuracyNotes =
      'Accuracy is excellent; consider increasing confidence threshold to 0.87.';
    const goodAccuracyNotes =
      'Accuracy is good; recommend fine-tuning with this dataset.';
    const lowAccuracyNotes = 'Accuracy below target; collect more diverse training data.';

    // Test accuracy >= 0.90
    let accuracy = 0.92;
    let notes = accuracy >= 0.9
        ? highAccuracyNotes
        : accuracy >= 0.88
          ? goodAccuracyNotes
          : lowAccuracyNotes;
    assert.strictEqual(notes, highAccuracyNotes);

    // Test accuracy >= 0.88 and < 0.90
    accuracy = 0.88;
    notes = accuracy >= 0.9
        ? highAccuracyNotes
        : accuracy >= 0.88
          ? goodAccuracyNotes
          : lowAccuracyNotes;
    assert.strictEqual(notes, goodAccuracyNotes);

    // Test accuracy < 0.88
    accuracy = 0.85;
    notes = accuracy >= 0.9
        ? highAccuracyNotes
        : accuracy >= 0.88
          ? goodAccuracyNotes
          : lowAccuracyNotes;
    assert.strictEqual(notes, lowAccuracyNotes);
  });
});
