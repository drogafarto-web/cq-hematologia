import { describe, it, expect } from 'vitest';
import { iaStripValidator, validateStripImage, validateStripImageSafe } from '../ia';

describe('ia.ts', () => {
  const validPayload = {
    imageUrl: 'https://example.com/image.jpg',
    imageDim: {
      width: 1024,
      height: 768,
    },
    classesDetected: ['IgG', 'IgM'],
    confidence: 0.95,
    model_version: '2.1',
  };

  describe('iaStripValidator', () => {
    it('should validate correct payload', () => {
      const result = iaStripValidator.safeParse(validPayload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrl).toBe('https://example.com/image.jpg');
        expect(result.data.confidence).toBe(0.95);
        expect(result.data.model_version).toBe('2.1');
      }
    });

    it('should reject non-HTTPS URL', () => {
      const invalidPayload = {
        ...validPayload,
        imageUrl: 'http://example.com/image.jpg',
      };

      const result = iaStripValidator.safeParse(invalidPayload);

      expect(result.success).toBe(false);
    });

    it('should reject invalid URL format', () => {
      const invalidPayload = {
        ...validPayload,
        imageUrl: 'not-a-url',
      };

      const result = iaStripValidator.safeParse(invalidPayload);

      expect(result.success).toBe(false);
    });

    it('should reject missing imageDim', () => {
      const invalidPayload = {
        imageUrl: 'https://example.com/image.jpg',
        classesDetected: ['IgG'],
        confidence: 0.95,
        model_version: '2.1',
      };

      const result = iaStripValidator.safeParse(invalidPayload);

      expect(result.success).toBe(false);
    });

    it('should reject non-integer dimensions', () => {
      const invalidPayload = {
        ...validPayload,
        imageDim: {
          width: 1024.5,
          height: 768,
        },
      };

      const result = iaStripValidator.safeParse(invalidPayload);

      expect(result.success).toBe(false);
    });

    it('should reject zero or negative dimensions', () => {
      const invalidPayload = {
        ...validPayload,
        imageDim: {
          width: 0,
          height: 768,
        },
      };

      const result = iaStripValidator.safeParse(invalidPayload);

      expect(result.success).toBe(false);
    });

    it('should reject unknown classes', () => {
      const invalidPayload = {
        ...validPayload,
        classesDetected: ['IgG', 'UnknownClass'],
      };

      const result = iaStripValidator.safeParse(invalidPayload);

      expect(result.success).toBe(false);
    });

    it('should reject confidence out of range (> 1)', () => {
      const invalidPayload = {
        ...validPayload,
        confidence: 1.5,
      };

      const result = iaStripValidator.safeParse(invalidPayload);

      expect(result.success).toBe(false);
    });

    it('should reject confidence out of range (< 0)', () => {
      const invalidPayload = {
        ...validPayload,
        confidence: -0.1,
      };

      const result = iaStripValidator.safeParse(invalidPayload);

      expect(result.success).toBe(false);
    });

    it('should accept confidence at boundaries', () => {
      const validPayload0 = {
        ...validPayload,
        confidence: 0,
      };

      const validPayload1 = {
        ...validPayload,
        confidence: 1,
      };

      expect(iaStripValidator.safeParse(validPayload0).success).toBe(true);
      expect(iaStripValidator.safeParse(validPayload1).success).toBe(true);
    });

    it('should reject invalid model_version format', () => {
      const invalidPayload = {
        ...validPayload,
        model_version: 'v2',
      };

      const result = iaStripValidator.safeParse(invalidPayload);

      expect(result.success).toBe(false);
    });

    it('should accept valid semantic version formats', () => {
      const validVersions = ['1.0', '2.1', '10.25', '1.0.0', '2.1.5'];

      validVersions.forEach((version) => {
        const payload = {
          ...validPayload,
          model_version: version,
        };

        expect(iaStripValidator.safeParse(payload).success).toBe(true);
      });
    });
  });

  describe('validateStripImage', () => {
    it('should return validated data on success', () => {
      const result = validateStripImage(validPayload);

      expect(result.imageUrl).toBe('https://example.com/image.jpg');
      expect(result.confidence).toBe(0.95);
      expect(result.classesDetected).toEqual(['IgG', 'IgM']);
    });

    it('should throw error on invalid data', () => {
      const invalidPayload = {
        ...validPayload,
        imageUrl: 'http://example.com/image.jpg',
      };

      expect(() => {
        validateStripImage(invalidPayload);
      }).toThrow();
    });
  });

  describe('validateStripImageSafe', () => {
    it('should return success with data', () => {
      const result = validateStripImageSafe(validPayload);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should return errors on validation failure', () => {
      const invalidPayload = {
        ...validPayload,
        imageUrl: 'http://example.com/image.jpg',
        confidence: 1.5,
      };

      const result = validateStripImageSafe(invalidPayload);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(Object.keys(result.errors!).length).toBeGreaterThan(0);
    });

    it('should handle feedback object when present', () => {
      const payloadWithFeedback = {
        ...validPayload,
        feedback: {
          classes: ['IgG'],
          correctedBy: 'rt-user-1',
          correctedAt: new Date(),
        },
      };

      const result = validateStripImageSafe(payloadWithFeedback);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data!.feedback).toBeDefined();
        expect(result.data!.feedback!.classes).toEqual(['IgG']);
      }
    });

    it('should handle optional batch_id', () => {
      const payloadWithBatchId = {
        ...validPayload,
        batch_id: 'batch-123',
      };

      const result = validateStripImageSafe(payloadWithBatchId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data!.batch_id).toBe('batch-123');
      }
    });

    it('should reject incomplete feedback', () => {
      const payloadWithIncompleteFeedback = {
        ...validPayload,
        feedback: {
          classes: ['IgG'],
          // missing correctedBy and correctedAt
        },
      };

      const result = validateStripImageSafe(payloadWithIncompleteFeedback as any);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('allowedClasses', () => {
    it('should accept all allowed immunological classes', () => {
      const allowedClasses = [
        'IgG',
        'IgM',
        'IgA',
        'Anti-TPO',
        'Anti-Transglutaminase',
        'Anti-HCV',
        'Anti-HIV',
        'Anti-HBc',
        'HBsAg',
        'Anti-CMV',
        'Anti-EBV',
        'Anti-Rubella',
        'Anti-Measles',
        'Anti-Varicella',
      ];

      allowedClasses.forEach((cls) => {
        const payload = {
          ...validPayload,
          classesDetected: [cls],
        };

        expect(iaStripValidator.safeParse(payload).success).toBe(true);
      });
    });
  });
});
