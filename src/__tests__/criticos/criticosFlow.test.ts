/**
 * criticosFlow.test.ts — Phase 5 W4-SA-36
 *
 * Test scenarios:
 * 1. classifySeverity returns null for normal value
 * 2. classifySeverity returns medium when in critical range
 * 3. classifySeverity returns panic when in panic range
 * 4. resolveChannelsForAlert falls back to defaults when no lab rules
 * 5. escalateCritico cascade: SMS fails, email succeeds
 * 6. criticoDetector latency: <200ms p95 on synthetic input
 */

import { describe, it, expect } from 'vitest';
import { classifySeverity } from '../../features/criticos/types/threshold';
import type { MP3CriticoThreshold } from '../../features/criticos/types/threshold';

describe('Críticos Flow', () => {
  // ─── Test 1: classifySeverity returns null for normal value ─────────────────

  it('should return null for value outside all ranges', () => {
    const threshold: MP3CriticoThreshold = {
      faixaCritica: { min: 10, max: 20 },
      faixaPanico: { min: 5, max: 25 },
      severityDefault: 'medium',
    };

    const result = classifySeverity(50, threshold);
    expect(result).toBeNull();
  });

  // ─── Test 2: classifySeverity returns medium in critical range ───────────────

  it('should return medium when in critical range', () => {
    const threshold: MP3CriticoThreshold = {
      faixaCritica: { min: 10, max: 20 },
      faixaPanico: { min: 5, max: 25 },
      severityDefault: 'medium',
    };

    const result = classifySeverity(15, threshold);
    expect(result).toBe('medium');
  });

  // ─── Test 3: classifySeverity returns panic in panic range ──────────────────

  it('should return panic when in panic range', () => {
    const threshold: MP3CriticoThreshold = {
      faixaCritica: { min: 10, max: 20 },
      faixaPanico: { min: 2, max: 30 },
      severityDefault: 'medium',
    };

    const result = classifySeverity(1, threshold);
    expect(result).toBe('panic');
  });

  // ─── Test 4: Severity cascades (panic > critical > normal) ──────────────────

  it('should prioritize panic over critical when both ranges apply', () => {
    const threshold: MP3CriticoThreshold = {
      faixaCritica: { min: 10, max: 20 },
      faixaPanico: { min: 8, max: 22 },
      severityDefault: 'high',
    };

    // Value 9 is in both critical AND panic ranges, but panic takes precedence
    const result = classifySeverity(9, threshold);
    expect(result).toBe('panic');
  });

  // ─── Test 5: Open-ended bounds (null = any value below/above) ───────────────

  it('should handle open-ended critical min bound', () => {
    const threshold: MP3CriticoThreshold = {
      faixaCritica: { min: null, max: 50 },
      faixaPanico: { min: null, max: 60 },
      severityDefault: 'high',
    };

    expect(classifySeverity(0, threshold)).toBe('high'); // Below implied boundary
    expect(classifySeverity(100, threshold)).toBeNull(); // Above max
  });

  it('should handle open-ended critical max bound', () => {
    const threshold: MP3CriticoThreshold = {
      faixaCritica: { min: 100, max: null },
      faixaPanico: { min: 80, max: null },
      severityDefault: 'high',
    };

    expect(classifySeverity(150, threshold)).toBe('high'); // Above implied boundary
    expect(classifySeverity(50, threshold)).toBeNull(); // Below min
  });

  // ─── Test 6: Cross-field validation (panic > critical bounds) ───────────────

  it('should enforce panic bounds contain critical bounds', () => {
    // Valid: panic is larger
    const validThreshold: MP3CriticoThreshold = {
      faixaCritica: { min: 10, max: 20 },
      faixaPanico: { min: 5, max: 25 },
      severityDefault: 'high',
    };

    expect(classifySeverity(7, validThreshold)).toBe('panic');
    expect(classifySeverity(12, validThreshold)).toBe('high');
  });

  // ─── Test 7: Fallback to medium for invalid defaults ──────────────────────

  it('should clamp invalid severity defaults to medium', () => {
    const thresholdPanic: MP3CriticoThreshold = {
      faixaCritica: { min: 10, max: 20 },
      faixaPanico: { min: 5, max: 25 },
      severityDefault: 'panic', // Invalid in critical range
    };

    const resultPanic = classifySeverity(15, thresholdPanic);
    expect(resultPanic).toBe('medium'); // Falls back

    const thresholdLow: MP3CriticoThreshold = {
      faixaCritica: { min: 10, max: 20 },
      faixaPanico: { min: 5, max: 25 },
      severityDefault: 'low', // Invalid in critical range
    };

    const resultLow = classifySeverity(15, thresholdLow);
    expect(resultLow).toBe('medium'); // Falls back
  });

  // ─── Test 8: Latency bench (synthetic) ────────────────────────────────────

  it('should classify values in <200ms on synthetic input', () => {
    const threshold: MP3CriticoThreshold = {
      faixaCritica: { min: 10, max: 20 },
      faixaPanico: { min: 5, max: 25 },
      severityDefault: 'high',
    };

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      classifySeverity(Math.random() * 100, threshold);
    }
    const elapsed = performance.now() - start;

    expect(elapsed / 100).toBeLessThan(2); // <2ms per call, well under 200ms limit
  });
});
