/**
 * Firestore query helpers for analytics module
 *
 * Multi-tenant: all paths scoped to /labs/{labId}/analytics/
 * No cross-lab queries. labId always required as first argument.
 */

import { db, doc, collection } from '../../../shared/services/firebase';

// ─── Path constants ───────────────────────────────────────────────────────────

/** Base path for all analytics data under a lab */
const analyticsBase = (labId: string) => `labs/${labId}/analytics`;

/** Firestore document ref: CIQ compliance metrics cache */
export const ciqComplianceRef = (labId: string) =>
  doc(db, analyticsBase(labId), 'cache', 'metrics', 'ciqCompliance');

/** Firestore document ref: analytics metadata (refresh time, staleness) */
export const analyticsMetaRef = (labId: string) => doc(db, analyticsBase(labId), 'meta');

/** Firestore document ref: NC heatmap cache */
export const ncHeatmapRef = (labId: string) => doc(db, analyticsBase(labId), 'cache', 'ncHeatmap');

/** Firestore document ref: training matrix cache */
export const trainingMatrixRef = (labId: string) =>
  doc(db, analyticsBase(labId), 'cache', 'trainingMatrix');

/** Firestore collection ref: CIQ trend snapshots (time series) */
export const ciqTrendsCol = (labId: string) =>
  collection(db, analyticsBase(labId), 'cache', 'ciqTrends');

// ─── Type guards ──────────────────────────────────────────────────────────────

/** Returns true if labId is non-empty (multi-tenant safety guard) */
export function isValidLabId(labId: string | null | undefined): labId is string {
  return typeof labId === 'string' && labId.length > 0;
}
