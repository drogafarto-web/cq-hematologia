/**
 * Client-side service for analytics operations
 *
 * Phase 3.1: Placeholder for reads only (via hook).
 * Phase 3.2: Will add manual refresh callable and export operations.
 *
 * Provides a contract for future expansion with manual refresh
 * and export functionality (cross-module integration with export system).
 */

import type { AggregationResult } from '../types';

/**
 * Analytics service layer
 *
 * Placeholder structure for Phase 3.1.
 * Enables IDE autocomplete and provides extension point for Phase 3.2.
 */
export const AnalyticsService = {
  /**
   * Manual refresh: call Cloud Function to immediately aggregate metrics
   *
   * Not yet implemented; scheduled function runs hourly.
   *
   * Phase 3.2: Will implement as Cloud Callable
   * `httpsCallable<{labId: string}, AggregationResult>('analytics_refreshNow')`
   *
   * @param labId Lab to refresh
   * @returns Aggregation result
   * @throws Error if not implemented
   */
  refreshNow: async (labId: string): Promise<AggregationResult> => {
    console.warn('[Analytics] Manual refresh not yet implemented (Phase 3.2)');
    return {
      labId,
      metrics: {} as any,
      error: 'Not implemented in Phase 3.1',
    };
  },

  /**
   * Export analytics for a date range
   *
   * Phase 3.2: Will integrate with project-wide export system.
   * Supports XLSX and PDF formats.
   *
   * @param labId Lab to export
   * @param format Output format (xlsx | pdf)
   * @returns Job ID for tracking
   * @throws Error if not implemented
   */
  exportAnalytics: async (
    labId: string,
    format: 'xlsx' | 'pdf' = 'xlsx',
  ): Promise<{ jobId: string }> => {
    console.warn('[Analytics] Export not yet implemented (Phase 3.2)');
    throw new Error('Not implemented in Phase 3.1');
  },
};
