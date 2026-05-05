/**
 * Zod validation schemas for Export feature.
 * Validates Firestore job records coming from the server before rendering.
 */

import { z } from 'zod';

/** Status lifecycle enum */
export const ExportJobStatusSchema = z.enum([
  'queued',
  'processing',
  'completed',
  'failed',
]);

/** Format enum — only XLSX variants available in Phase 3.2 (PDF deferred) */
export const ExportFormatSchema = z.enum(['xlsx', 'pdf', 'csv']);

/**
 * Full Firestore export-job document schema.
 * Dates arrive as Firestore Timestamps (object with toDate()) or ISO strings.
 * We coerce to Date via z.coerce.date().
 */
export const ExportJobSchema = z.object({
  jobId: z.string().min(1),
  labId: z.string().min(1),
  format: ExportFormatSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: ExportJobStatusSchema,

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  operatorId: z.string().min(1),
  estimatedSizeBytes: z.number().optional(),

  // Populated when completed
  downloadUrl: z.string().url().optional(),
  expiresAt: z.coerce.date().optional(),
  fileSizeBytes: z.number().optional(),
  generatedAt: z.coerce.date().optional(),

  // Error info
  errorMessage: z.string().optional(),

  // Processing info
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  processingDurationMs: z.number().optional(),
});

export type ExportJobSchemaType = z.infer<typeof ExportJobSchema>;
