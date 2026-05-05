/**
 * Firestore aggregation query for CIQ compliance metrics
 *
 * Computes metrics for a single lab across all CIQ modules:
 * - Total runs, valid/invalid counts, compliance percentage
 * - Open/closed NCs, resolution rate, average resolution days
 * - Average processing hours from run creation to signing
 *
 * Uses Firestore aggregation queries where possible (.count().get()),
 * falls back to manual snapshot count if timeout occurs.
 *
 * Query timeout target: <10 seconds for 100k documents (with indices).
 * Without indices: may timeout, graceful fallback to manual count.
 */

import { getFirestore } from 'firebase-admin/firestore';
import type { CIQComplianceMetrics } from './types';

const db = getFirestore();

export async function queryCIQCompliance(labId: string): Promise<CIQComplianceMetrics> {
  const startTime = Date.now();

  try {
    // 1. Count valid runs using aggregation query (requires composite index for filters)
    let validCount = 0;
    let totalCount = 0;

    try {
      const validRunsSnap = await db
        .collection('runs')
        .doc(labId)
        .collection('entries')
        .where('status', '==', 'valid')
        .where('deletadoEm', '==', null)
        .count()
        .get();

      validCount = validRunsSnap.data().count;
    } catch (aggErr) {
      console.warn(
        `[Analytics] Aggregation query timeout for lab ${labId}, falling back to manual count`,
        aggErr,
      );
      // Fallback: manual count
      const validSnap = await db
        .collection('runs')
        .doc(labId)
        .collection('entries')
        .where('status', '==', 'valid')
        .where('deletadoEm', '==', null)
        .get();
      validCount = validSnap.size;
    }

    // 2. Count total (valid + invalid) runs
    try {
      const allRunsSnap = await db
        .collection('runs')
        .doc(labId)
        .collection('entries')
        .where('deletadoEm', '==', null)
        .count()
        .get();

      totalCount = allRunsSnap.data().count;
    } catch (aggErr) {
      const allSnap = await db
        .collection('runs')
        .doc(labId)
        .collection('entries')
        .where('deletadoEm', '==', null)
        .get();
      totalCount = allSnap.size;
    }

    // 3. Count open NCs
    const openNCsSnap = await db
      .collection('ncs')
      .doc(labId)
      .collection('records')
      .where('status', '==', 'aberto')
      .where('deletadoEm', '==', null)
      .get();

    const openNCs = openNCsSnap.size;

    // 4. Count closed NCs
    const closedNCsSnap = await db
      .collection('ncs')
      .doc(labId)
      .collection('records')
      .where('status', '!=', 'aberto')
      .where('deletadoEm', '==', null)
      .get();

    const closedNCs = closedNCsSnap.size;

    // 5. Compute average resolution time (days from creation to closure)
    let avgResolutionDays = 0;
    if (closedNCs > 0) {
      const closedNCDocs = closedNCsSnap.docs;
      const resolutionDaysArray = closedNCDocs.map((doc) => {
        const data = doc.data();
        const createdAt = data.criadoEm?.toDate ? data.criadoEm.toDate() : new Date(data.criadoEm);
        const closedAt = data.fechadoEm?.toDate ? data.fechadoEm.toDate() : new Date(data.fechadoEm);
        const days = (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return days;
      });

      avgResolutionDays = resolutionDaysArray.reduce((a, b) => a + b, 0) / closedNCs;
    }

    // 6. Compute average processing time (hours from run creation to signing)
    let avgProcessingHours = 0;
    if (totalCount > 0) {
      const sampleRunDocs = (
        await db
          .collection('runs')
          .doc(labId)
          .collection('entries')
          .where('deletadoEm', '==', null)
          .limit(1000) // Sample first 1000 runs to avoid scanning all
          .get()
      ).docs;

      if (sampleRunDocs.length > 0) {
        const processingHoursArray = sampleRunDocs
          .map((doc) => {
            const data = doc.data();
            const createdAt = data.criadoEm?.toDate ? data.criadoEm.toDate() : new Date(data.criadoEm);
            const signedAt = data.assinadorEm?.toDate ? data.assinadorEm.toDate() : undefined;

            if (!signedAt) return 0; // Unsigned, exclude
            const hours = (signedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            return Math.max(0, hours); // No negative times
          })
          .filter((h) => h > 0);

        avgProcessingHours =
          processingHoursArray.length > 0
            ? processingHoursArray.reduce((a, b) => a + b, 0) / processingHoursArray.length
            : 0;
      }
    }

    // 7. Build result object
    const compliancePercent = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0;
    const ncResolutionRate = openNCs + closedNCs > 0
      ? Math.round((closedNCs / (openNCs + closedNCs)) * 100)
      : 0;

    const metrics: CIQComplianceMetrics = {
      totalRuns: totalCount,
      validRuns: validCount,
      invalidRuns: totalCount - validCount,
      openNCs,
      closedNCs,
      compliancePercent,
      ncResolutionRate,
      avgResolutionDays: Math.round(avgResolutionDays * 10) / 10, // 1 decimal
      avgProcessingHours: Math.round(avgProcessingHours * 10) / 10,
      computedAt: new Date(),
      dataAsOf: new Date(),
    };

    console.log(`[Analytics] Computed metrics for lab ${labId}:`, {
      totalRuns: metrics.totalRuns,
      validRuns: metrics.validRuns,
      openNCs: metrics.openNCs,
      durationMs: Date.now() - startTime,
    });

    return metrics;
  } catch (error) {
    console.error(`[Analytics] Failed to compute metrics for lab ${labId}:`, error);
    throw error;
  }
}
