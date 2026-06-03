/**
 * Zod validation schemas for analytics aggregate data
 *
 * Validates Firestore snapshot data before handing it to UI components.
 * Guards against missing fields, wrong types, or corrupted cache entries.
 */

import { z } from 'zod';

// ─── Primitive validators ─────────────────────────────────────────────────────

const percentSchema = z.number().min(0).max(100);
const nonNegativeInt = z.number().int().min(0);
const nonNegativeFloat = z.number().min(0);

// ─── NC age buckets ───────────────────────────────────────────────────────────

export const ncAgeBucketsSchema = z.object({
  '7d': nonNegativeInt.default(0),
  '30d': nonNegativeInt.default(0),
  '60d': nonNegativeInt.default(0),
  '>60d': nonNegativeInt.default(0),
});

// ─── Analytics aggregate schema ───────────────────────────────────────────────

export const analyticsAggregateSchema = z.object({
  labId: z.string().min(1),

  // CIQ compliance
  totalRuns: nonNegativeInt.default(0),
  validRuns: nonNegativeInt.default(0),
  invalidRuns: nonNegativeInt.default(0),
  compliancePercent: percentSchema.default(0),

  // Non-conformities
  openNCs: nonNegativeInt.default(0),
  closedNCs: nonNegativeInt.default(0),
  ncResolutionRate: percentSchema.default(0),
  avgResolutionDays: nonNegativeFloat.default(0),

  // Processing
  avgProcessingHours: nonNegativeFloat.default(0),

  // Retrabalho
  retrabalhoCount: nonNegativeInt.default(0),
  retrabalhoPercent: percentSchema.default(0),

  // NC by module — allow any module slug
  ncByModule: z.record(z.string(), nonNegativeInt).default({}),

  // NC age buckets
  ncAgeBuckets: ncAgeBucketsSchema.default({ '7d': 0, '30d': 0, '60d': 0, '>60d': 0 }),

  // Metadata — Firestore Timestamps come as objects; accept any for safe coercion
  computedAt: z.any().nullable().default(null),
  dataAsOf: z.any().nullable().default(null),
});

export type AnalyticsAggregateRaw = z.input<typeof analyticsAggregateSchema>;
export type AnalyticsAggregateValidated = z.output<typeof analyticsAggregateSchema>;

// ─── Analytics metadata schema ────────────────────────────────────────────────

export const analyticsMetadataSchema = z.object({
  labId: z.string().min(1),
  lastRefreshAt: z.any().nullable().default(null),
  refreshIntervalMinutes: z.number().int().min(1).default(60),
  isCached: z.boolean().default(false),
  cacheExpiresAt: z.any().nullable().optional(),
  staleWarningMinutes: z.number().int().min(1).optional(),
});

// ─── Parse helpers ────────────────────────────────────────────────────────────

/**
 * Safely parse a Firestore snapshot into a validated aggregate.
 * Returns null if data is missing or structurally invalid.
 *
 * @param data Raw Firestore document data (from snap.data())
 * @returns Validated aggregate or null
 */
export function parseAnalyticsAggregate(data: unknown): AnalyticsAggregateValidated | null {
  const result = analyticsAggregateSchema.safeParse(data);
  if (!result.success) {
    console.warn('[Analytics] Aggregate schema validation failed:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Convert Firestore Timestamps to JS Dates within an aggregate.
 * Firestore SDK returns proprietary Timestamp objects; UI needs Date.
 */
export function coerceAggregateTimestamps(
  data: AnalyticsAggregateValidated,
): AnalyticsAggregateValidated & { computedAt: Date | null; dataAsOf: Date | null } {
  const toDate = (v: unknown): Date | null => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof (v as any).toDate === 'function') return (v as any).toDate();
    if (typeof (v as any).seconds === 'number') {
      return new Date((v as any).seconds * 1000);
    }
    return null;
  };

  return {
    ...data,
    computedAt: toDate(data.computedAt),
    dataAsOf: toDate(data.dataAsOf),
  };
}
