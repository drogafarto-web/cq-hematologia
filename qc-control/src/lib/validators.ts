import { z } from 'zod';

export const createQcRunSchema = z.object({
  lotId: z.string().cuid(),
  value: z.number().positive(),
});

export const releaseQcRunSchema = z.object({
  justification: z.string().min(10),
});

export const qcChartQuerySchema = z.object({
  lotId: z.string().cuid(),
  days: z.coerce.number().default(30),
});

export const createLotSchema = z.object({
  lotNumber: z.string(),
  analyte: z.string(),
  level: z.coerce.number().refine((v) => v === 1 || v === 2, { message: 'Level must be 1 or 2' }),
  reagentName: z.string(),
  analyzerId: z.string(),
  targetMean: z.number(),
  sd: z.number(),
  minAcceptance: z.number(),
  maxAcceptance: z.number(),
});

export const updateLotSchema = createLotSchema.partial();

export const createCASchema = z.object({
  analyte: z.string(),
  lotId: z.string().optional(),
  equipmentId: z.string().optional(),
  ruleViolated: z.string().optional(),
  operatorId: z.string(),
  investigatorId: z.string().optional(),
  targetCompletionAt: z.string().datetime().optional(),
});

export const updateCASchema = z.object({
  rootCause: z.string().optional(),
  supportingEvidence: z.string().optional(),
  actionTaken: z.string().optional(),
  preventiveMeasure: z.string().optional(),
  effectivenessCheck: z.string().optional(),
  verifiedById: z.string().optional(),
  verificationAt: z.string().datetime().optional(),
});

export const createAnalyzerSchema = z.object({
  analyzerId: z.string(),
  model: z.string(),
  manufacturer: z.string(),
  serialNumber: z.string(),
  location: z.string(),
  installDate: z.string().datetime(),
});

export const calibrateAnalyzerSchema = z.object({
  calibratedAt: z.string().datetime(),
  certificateNumber: z.string(),
  performedBy: z.string().optional(),
  notes: z.string().optional(),
});

export const maintenanceAnalyzerSchema = z.object({
  type: z.enum(['PREVENTIVE', 'CORRECTIVE']),
  performedAt: z.string().datetime(),
  description: z.string(),
  technician: z.string(),
  outcome: z.enum(['PASS', 'FAIL', 'PENDING_PARTS']),
  nextScheduledAt: z.string().datetime().optional(),
});

export const createReportSchema = z.object({
  type: z.enum(['MONTHLY_QC_SUMMARY', 'LOT_PERFORMANCE', 'CORRECTIVE_ACTIONS', 'EQUIPMENT']),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  scope: z.object({}).passthrough(),
});
