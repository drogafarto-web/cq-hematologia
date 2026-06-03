/**
 * Scheduled Cloud Function: Hourly CIQ Analytics Aggregation
 *
 * Runs every hour via Cloud Scheduler.
 * For each lab, computes CIQ compliance metrics and caches in Firestore.
 *
 * Schedule: "every 1 hours"
 * Region: southamerica-east1
 * Timeout: 300s (5 min) for all labs combined
 * Max instances: 1 (prevents parallel runs causing duplicate writes)
 *
 * Cache structure:
 * - Metrics: `/labs/{labId}/analytics/cache/metrics/ciqCompliance`
 * - Metadata: `/labs/{labId}/analytics/meta`
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { queryCIQCompliance } from './queryCIQCompliance';
import type { AggregationResult } from './types';

const db = getFirestore();

export const aggregateAnalytics = onSchedule(
  {
    schedule: 'every 1 hours',
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    maxInstances: 1,
    memory: '512MiB',
  },
  async () => {
    const startTime = Date.now();
    console.log('[Analytics] Hourly aggregation started');

    try {
      // 1. Get all labs
      const labsSnap = await db.collection('labs').get();
      const labs = labsSnap.docs;

      console.log(`[Analytics] Found ${labs.length} labs to aggregate`);

      const results: AggregationResult[] = [];

      // 2. For each lab, compute metrics and cache
      for (const labDoc of labs) {
        const labId = labDoc.id;

        try {
          // Compute metrics
          const metrics = await queryCIQCompliance(labId);

          // Cache in Firestore at /labs/{labId}/analytics/cache/metrics/ciqCompliance
          const cacheRef = db
            .collection('labs')
            .doc(labId)
            .collection('analytics')
            .doc('cache')
            .collection('metrics')
            .doc('ciqCompliance');

          await cacheRef.set(metrics, { merge: true });

          // Also update metadata: /labs/{labId}/analytics/meta
          const metaRef = db.collection('labs').doc(labId).collection('analytics').doc('meta');

          await metaRef.set(
            {
              lastRefreshAt: new Date(),
              refreshIntervalMinutes: 60,
              isCached: true,
              cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            },
            { merge: true },
          );

          results.push({
            labId,
            metrics,
            durationMs: Date.now() - startTime,
          });

          console.log(`[Analytics] ✓ Lab ${labId}: cached metrics`);
        } catch (err) {
          console.error(`[Analytics] ✗ Lab ${labId}: failed to aggregate`, err);
          results.push({
            labId,
            metrics: {} as any,
            error: String(err),
          });
        }
      }

      // 3. Summary log
      const successCount = results.filter((r) => !r.error).length;
      const totalDuration = Date.now() - startTime;

      console.log(
        `[Analytics] Aggregation complete: ${successCount}/${labs.length} labs succeeded in ${totalDuration}ms`,
      );
    } catch (error) {
      console.error('[Analytics] Aggregation failed:', error);
    }
  },
);
