/**
 * SLA Tracker Service — Critical value escalation SLA metrics
 *
 * Tracks acknowledgment times and SLA breaches for critical value alerts.
 * Implements RDC 978 Art. 5.7.1 (critical communication <60min)
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import { db } from '../../../shared/services/firebase';

export interface SLAMetric {
  alertId: string;
  detectedAt: number;
  acknowledgedAt: number | null;
  timeToAcknowledgeMs: number | null;
  slaBreached: boolean;
  slaTargetMs: number;
}

export interface AggregatedSLA {
  count: number;
  breachedCount: number;
  p50Ms: number;
  p95Ms: number;
  meanMs: number;
}

/**
 * Get SLA metrics for alerts in a time range.
 *
 * @param labId Lab identifier
 * @param range Time range (from/to as milliseconds since epoch)
 * @returns Array of SLA metrics for alerts in range
 */
export async function getSLAMetrics(
  labId: string,
  range: { from: number; to: number }
): Promise<SLAMetric[]> {
  try {
    const fromTs = Timestamp.fromMillis(range.from);
    const toTs = Timestamp.fromMillis(range.to);

    const q = query(
      collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CRITICOS_ESCALACOES),
      where('criadoEm', '>=', fromTs),
      where('criadoEm', '<=', toTs),
      orderBy('criadoEm', 'desc')
    );

    const snap = await getDocs(q);
    const metrics: SLAMetric[] = [];

    snap.docs.forEach((doc) => {
      const data = doc.data() as any;
      const slaTargetMs = (data.sla_minutos_target || 60) * 60 * 1000;
      const detectedAt = data.criadoEm?.toMillis?.() || Date.now();
      const acknowledgedAt = data.reconhecido_em?.toMillis?.() || null;

      let timeToAcknowledgeMs: number | null = null;
      let slaBreached = false;

      if (acknowledgedAt !== null) {
        timeToAcknowledgeMs = acknowledgedAt - detectedAt;
        slaBreached = timeToAcknowledgeMs > slaTargetMs;
      }

      metrics.push({
        alertId: doc.id,
        detectedAt,
        acknowledgedAt,
        timeToAcknowledgeMs,
        slaBreached,
        slaTargetMs,
      });
    });

    return metrics;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Aggregate SLA metrics into statistics.
 * Pure function — testable without Firestore.
 *
 * @param metrics Array of SLA metrics
 * @returns Aggregated statistics (count, breach count, percentiles, mean)
 */
export function aggregateSLA(metrics: SLAMetric[]): AggregatedSLA {
  const count = metrics.length;

  if (count === 0) {
    return {
      count: 0,
      breachedCount: 0,
      p50Ms: 0,
      p95Ms: 0,
      meanMs: 0,
    };
  }

  const breachedCount = metrics.filter((m) => m.slaBreached).length;

  // Get acknowledged times for percentile calculation
  const acknowledgedTimes = metrics
    .filter((m) => m.timeToAcknowledgeMs !== null)
    .map((m) => m.timeToAcknowledgeMs as number)
    .sort((a, b) => a - b);

  let p50Ms = 0;
  let p95Ms = 0;
  let meanMs = 0;

  if (acknowledgedTimes.length > 0) {
    // p50
    const p50Index = Math.floor(acknowledgedTimes.length * 0.5);
    p50Ms = acknowledgedTimes[p50Index];

    // p95
    const p95Index = Math.floor(acknowledgedTimes.length * 0.95);
    p95Ms = acknowledgedTimes[p95Index];

    // mean
    const sum = acknowledgedTimes.reduce((a, b) => a + b, 0);
    meanMs = sum / acknowledgedTimes.length;
  }

  return {
    count,
    breachedCount,
    p50Ms: Math.round(p50Ms),
    p95Ms: Math.round(p95Ms),
    meanMs: Math.round(meanMs),
  };
}
