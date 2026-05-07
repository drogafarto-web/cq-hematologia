import { z } from 'zod';

/**
 * Zod schema + validator for IA strip image metadata.
 * Validates image URLs, dimensions, detected classes, confidence scores,
 * model version, and optional feedback.
 */

const ALLOWED_CLASSES = [
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
] as const;

/**
 * Zod validator schema for strip image metadata.
 * Enforces:
 * - Valid HTTPS image URL
 * - Positive integer dimensions
 * - Classes from approved list
 * - Confidence between 0 and 1
 * - Valid semantic version for model
 * - Optional feedback with complete required fields
 */
export const iaStripValidator = z.object({
  imageUrl: z
    .string()
    .url('Invalid image URL')
    .refine((url) => url.startsWith('https://'), 'Image URL must be HTTPS'),

  imageDim: z.object({
    width: z.number().int('Width must be integer').positive('Width must be positive'),
    height: z.number().int('Height must be integer').positive('Height must be positive'),
  }),

  classesDetected: z.array(
    z.enum(ALLOWED_CLASSES, {
      errorMap: () => ({
        message: `Class must be one of: ${ALLOWED_CLASSES.join(', ')}`,
      }),
    })
  ),

  confidence: z
    .number()
    .min(0, 'Confidence must be >= 0')
    .max(1, 'Confidence must be <= 1'),

  model_version: z
    .string()
    .regex(/^\d+\.\d+/, 'Model version must be semantic (e.g., 2.1 or 1.0.5)'),

  feedback: z
    .object({
      classes: z.array(z.string().min(1, 'Each class must be non-empty')),
      correctedBy: z.string().min(1, 'correctedBy must be non-empty'),
      correctedAt: z.date(),
    })
    .optional(),

  batch_id: z.string().optional(),
});

/**
 * Type inference from Zod schema.
 * Represents validated strip image metadata.
 */
export type StripImage = z.infer<typeof iaStripValidator>;

/**
 * Validate strip image metadata.
 * Parses and validates input against iaStripValidator schema.
 *
 * @param data - Unknown data to validate
 * @returns Validated StripImage object
 * @throws ZodError if validation fails
 */
export const validateStripImage = (data: unknown): StripImage => {
  return iaStripValidator.parse(data);
};

/**
 * Safe validation with error details.
 * Returns result object with success flag and either data or errors.
 *
 * @param data - Unknown data to validate
 * @returns Validation result with status and data/errors
 */
export const validateStripImageSafe = (
  data: unknown
): { success: boolean; data?: StripImage; errors?: Record<string, string[]> } => {
  const result = iaStripValidator.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string[]> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });

  return { success: false, errors };
};
