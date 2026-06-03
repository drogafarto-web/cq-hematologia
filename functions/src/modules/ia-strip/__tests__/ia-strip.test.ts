/**
 * IA Strip Image Module Tests
 * Phase 9 placeholder tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateStripImage,
  validateStripImageSafe,
  isConfidenceAcceptable,
  getConfidenceCategory,
  getSupportedClasses,
} from '../../../shared/ia';

describe('IA Strip Image Module', () => {
  describe('Image Validation', () => {
    it('should validate correct strip image metadata', () => {
      const validImage = {
        imageUrl: 'https://storage.googleapis.com/example/strip.jpg',
        imageDim: { width: 1024, height: 768 },
        classesDetected: ['IgG', 'IgM'],
        confidence: 0.95,
        model_version: '1.0.0',
      };

      const result = validateStripImage(validImage);
      expect(result).toBeDefined();
      expect(result.imageUrl).toBe(validImage.imageUrl);
    });

    it('should reject invalid image URL', () => {
      const invalidImage = {
        imageUrl: 'not-a-url',
        imageDim: { width: 1024, height: 768 },
        classesDetected: [],
        confidence: 0.8,
        model_version: '1.0.0',
      };

      expect(() => validateStripImage(invalidImage)).toThrow();
    });

    it('should reject missing dimensions', () => {
      const noSize = {
        imageUrl: 'https://example.com/image.jpg',
        classesDetected: [],
        confidence: 0.8,
        model_version: '1.0.0',
      };

      expect(() => validateStripImage(noSize as any)).toThrow();
    });

    it('should reject invalid confidence (>1)', () => {
      const highConfidence = {
        imageUrl: 'https://example.com/image.jpg',
        imageDim: { width: 1024, height: 768 },
        classesDetected: [],
        confidence: 1.5,
        model_version: '1.0.0',
      };

      expect(() => validateStripImage(highConfidence)).toThrow();
    });

    it('should reject invalid model version format', () => {
      const badVersion = {
        imageUrl: 'https://example.com/image.jpg',
        imageDim: { width: 1024, height: 768 },
        classesDetected: [],
        confidence: 0.8,
        model_version: 'latest',
      };

      expect(() => validateStripImage(badVersion)).toThrow();
    });

    it('should accept optional feedback field if complete', () => {
      const withFeedback = {
        imageUrl: 'https://example.com/image.jpg',
        imageDim: { width: 1024, height: 768 },
        classesDetected: ['IgG'],
        confidence: 0.85,
        model_version: '1.0.0',
        feedback: {
          classes: ['IgM'],
          correctedBy: 'operator-123',
          correctedAt: Date.now(),
        },
      };

      const result = validateStripImage(withFeedback);
      expect(result.feedback).toBeDefined();
    });

    it('should reject unknown immunology class', () => {
      const unknownClass = {
        imageUrl: 'https://example.com/image.jpg',
        imageDim: { width: 1024, height: 768 },
        classesDetected: ['UnknownClass'],
        confidence: 0.8,
        model_version: '1.0.0',
      };

      expect(() => validateStripImage(unknownClass)).toThrow();
    });
  });

  describe('Safe Validation', () => {
    it('should return success for valid image', () => {
      const validImage = {
        imageUrl: 'https://example.com/strip.jpg',
        imageDim: { width: 800, height: 600 },
        classesDetected: ['IgG'],
        confidence: 0.92,
        model_version: '1.0.0',
      };

      const result = validateStripImageSafe(validImage);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error message for invalid image', () => {
      const invalidImage = {
        imageUrl: 'invalid-url',
        imageDim: { width: 800, height: 600 },
        classesDetected: [],
        confidence: 0.8,
        model_version: '1.0.0',
      };

      const result = validateStripImageSafe(invalidImage);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Confidence Evaluation', () => {
    it('should accept high confidence (>0.7)', () => {
      expect(isConfidenceAcceptable(0.95)).toBe(true);
      expect(isConfidenceAcceptable(0.85)).toBe(true);
      expect(isConfidenceAcceptable(0.7)).toBe(true);
    });

    it('should reject low confidence (<0.7)', () => {
      expect(isConfidenceAcceptable(0.65)).toBe(false);
      expect(isConfidenceAcceptable(0.5)).toBe(false);
    });

    it('should categorize confidence levels', () => {
      expect(getConfidenceCategory(0.4)).toBe('LOW');
      expect(getConfidenceCategory(0.65)).toBe('MEDIUM');
      expect(getConfidenceCategory(0.9)).toBe('HIGH');
    });

    it('should support custom confidence threshold', () => {
      expect(isConfidenceAcceptable(0.8, 0.85)).toBe(false);
      expect(isConfidenceAcceptable(0.9, 0.85)).toBe(true);
    });
  });

  describe('Supported Classes', () => {
    it('should provide list of supported immunology classes', () => {
      const classes = getSupportedClasses();
      expect(classes).toContain('IgG');
      expect(classes).toContain('IgM');
      expect(classes).toContain('IgA');
      expect(classes.length).toBeGreaterThan(5);
    });

    it('should include anti-TPO class', () => {
      const classes = getSupportedClasses();
      expect(classes).toContain('Anti-TPO');
    });

    it('should include CRP class', () => {
      const classes = getSupportedClasses();
      expect(classes).toContain('CRP');
    });
  });
});
