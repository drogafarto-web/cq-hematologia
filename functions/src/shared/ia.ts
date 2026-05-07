/**
 * IA Strip Image Validation
 * Zod schema for strip image metadata + classification results
 */

import { z } from 'zod';

/**
 * Supported immunology strip classes
 */
const SUPPORTED_CLASSES = [
  'IgG',
  'IgM',
  'IgA',
  'Anti-TPO',
  'Anti-Transglutaminase',
  'Anti-Tissue Transglutaminase',
  'Rheumatoid Factor',
  'CRP',
  'ESR',
  'ANA',
  'Other'
] as const;

/**
 * Feedback object schema
 */
export const stripFeedbackSchema = z.object({
  classes: z.array(z.enum(SUPPORTED_CLASSES)).min(1),
  correctedBy: z.string().min(1, 'Operator ID required'),
  correctedAt: z.number().int().positive('Invalid timestamp')
});

/**
 * Image dimensions schema
 */
export const imageDimensionsSchema = z.object({
  width: z.number().int().positive('Width must be positive'),
  height: z.number().int().positive('Height must be positive')
});

/**
 * Main strip image validator schema
 */
export const iaStripValidator = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  imageDim: imageDimensionsSchema,
  classesDetected: z.array(z.enum(SUPPORTED_CLASSES)).min(0),
  confidence: z.number().min(0).max(1, 'Confidence must be 0-1'),
  model_version: z.string().regex(/^\d+\.\d+/, 'Invalid model version format'),
  feedback: stripFeedbackSchema.optional(),
  batch_id: z.string().optional(),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional()
});

/**
 * Type extracted from schema
 */
export type StripImage = z.infer<typeof iaStripValidator>;
export type StripFeedback = z.infer<typeof stripFeedbackSchema>;

/**
 * Validate and parse strip image metadata
 * Throws ZodError on validation failure
 *
 * @param data Raw image metadata
 * @returns Validated StripImage
 */
export const validateStripImage = (data: unknown): StripImage => {
  return iaStripValidator.parse(data);
};

/**
 * Safe validation - returns result with error info
 */
export const validateStripImageSafe = (
  data: unknown
): { success: boolean; data?: StripImage; error?: string } => {
  const result = iaStripValidator.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
  };
};

/**
 * Create a new strip image with defaults
 */
export const createStripImage = (
  input: Omit<StripImage, 'createdAt' | 'updatedAt'>
): StripImage => {
  const now = Date.now();
  return {
    ...input,
    createdAt: now,
    updatedAt: now
  };
};

/**
 * Update strip image with new metadata
 */
export const updateStripImage = (
  existing: StripImage,
  updates: Partial<Omit<StripImage, 'createdAt'>>
): StripImage => {
  return {
    ...existing,
    ...updates,
    updatedAt: Date.now()
  };
};

/**
 * Check if confidence is acceptable
 */
export const isConfidenceAcceptable = (
  confidence: number,
  threshold: number = 0.7
): boolean => {
  return confidence >= threshold;
};

/**
 * Get supported classes for UI/forms
 */
export const getSupportedClasses = (): typeof SUPPORTED_CLASSES => {
  return SUPPORTED_CLASSES;
};

/**
 * Calculate confidence category
 */
export const getConfidenceCategory = (
  confidence: number
): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (confidence < 0.5) return 'LOW';
  if (confidence < 0.8) return 'MEDIUM';
  return 'HIGH';
};
