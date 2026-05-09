/**
 * criticoDetector — Phase 5 W2-SA-28
 *
 * Firestore trigger on result writes to detect critical values.
 * Triggers on /labs/{labId}/results/{resultId} write.
 * Target latency: <200ms p95 for detection + escalation queue write.
 *
 * RDC 978 Art. 128 (rastreabilidade de críticos)
 * DICQ 4.3 (detecção automática de valores críticos)
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { db } from '../../shared/firebase';

// ─── In-memory threshold cache with 60s TTL ──────────────────────────────────

interface CachedThreshold {
  min: number | null;
  max: number | null;
  faixaCritica: { min: number | null; max: number | null };
  faixaPanico: { min: number | null; max: number | null };
  severityDefault: 'low' | 'medium' | 'high' | 'panic';
}

const thresholdCache = new Map<
  string,
  {
    data: Map<string, CachedThreshold>;
    expiresAt: number;
  }
>();
const CACHE_TTL_MS = 60 * 1000; // 60s TTL

async function getThresholdForAnalyte(
  labId: string,
  analitoId: string
): Promise<CachedThreshold | null> {
  const now = Date.now();

  // Check cache
  let labCache = thresholdCache.get(labId);
  if (labCache && labCache.expiresAt > now) {
    return labCache.data.get(analitoId) || null;
  }

  // Cache miss — fetch all thresholds for lab
  try {
    const snap = await db
      .collection('labs')
      .doc(labId)
      .collection('criticos-thresholds')
      .where('deletadoEm', '==', null)
      .where('ativo', '==', true)
      .get();

    const newCache = new Map<string, CachedThreshold>();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      newCache.set(data.analitoId, {
        min: data.min || null,
        max: data.max || null,
        faixaCritica: data.faixaCritica || { min: null, max: null },
        faixaPanico: data.faixaPanico || { min: null, max: null },
        severityDefault: data.severityDefault || 'medium',
      });
    });

    thresholdCache.set(labId, {
      data: newCache,
      expiresAt: now + CACHE_TTL_MS,
    });

    return newCache.get(analitoId) || null;
  } catch (err) {
    console.error(`Failed to load thresholds for lab ${labId}:`, err);
    return null;
  }
}

/**
 * Classify value severity against a threshold.
 * - If in faixaPanico → 'panic'
 * - Else if in faixaCritica → severityDefault
 * - Else → null
 */
function classifySeverity(
  valor: number,
  threshold: CachedThreshold
): 'low' | 'medium' | 'high' | 'panic' | null {
  // Check panic range first
  if (threshold.faixaPanico) {
    const inMin =
      threshold.faixaPanico.min === null || valor >= threshold.faixaPanico.min;
    const inMax =
      threshold.faixaPanico.max === null || valor <= threshold.faixaPanico.max;
    if (inMin && inMax) return 'panic';
  }

  // Check critical range
  if (threshold.faixaCritica) {
    const inMin =
      threshold.faixaCritica.min === null || valor >= threshold.faixaCritica.min;
    const inMax =
      threshold.faixaCritica.max === null || valor <= threshold.faixaCritica.max;
    if (inMin && inMax) {
      const def = threshold.severityDefault;
      return def === 'panic' || def === 'low' ? 'medium' : def;
    }
  }

  return null;
}

/**
 * Trigger: onDocumentWritten on /labs/{labId}/results/{resultId}
 * Detects if any analyte in result is critical.
 * Creates critico-alert and enqueues for escalation.
 */
export const onResultWriteDetectCritico = onDocumentWritten(
  {
    document: 'labs/{labId}/results/{resultId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const startTime = Date.now();
    const { labId, resultId } = event.params;
    const after = event.data?.after.data();

    if (!after) {
      // Delete event — skip detection
      return;
    }

    try {
      // Check if we already have an alert for this result
      const existingAlert = await db
        .collection('labs')
        .doc(labId)
        .collection('criticos')
        .where('resultId', '==', resultId)
        .limit(1)
        .get();

      if (!existingAlert.empty) {
        // Alert already exists — idempotent
        return;
      }

      // Iterate over result analytes (assuming structure: { analytes: [{ analitoId, valor }] })
      const analytes = after.analytes || [];
      const alerts: Array<{
        analitoId: string;
        valor: number;
        severity: string;
      }> = [];

      for (const analyte of analytes) {
        const { analitoId, valor } = analyte;
        const threshold = await getThresholdForAnalyte(labId, analitoId);

        if (threshold) {
          const severity = classifySeverity(valor, threshold);
          if (severity) {
            alerts.push({ analitoId, valor, severity });
          }
        }
      }

      if (alerts.length === 0) {
        // No critical values — done
        return;
      }

      // Write critico-alert for each critical analyte
      const batch = admin.firestore().batch();
      for (const alert of alerts) {
        const alertId = admin.firestore().collection('_').doc().id;
        const alertRef = db
          .collection('labs')
          .doc(labId)
          .collection('criticos')
          .doc(alertId);

        batch.set(alertRef, {
          labId,
          resultId,
          analitoId: alert.analitoId,
          valor: alert.valor,
          severity: alert.severity,
          detectedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'novo',
        });

        // Enqueue for escalation (if severity is high or panic)
        if (alert.severity === 'high' || alert.severity === 'panic') {
          const queueId = admin.firestore().collection('_').doc().id;
          const queueRef = db
            .collection('labs')
            .doc(labId)
            .collection('criticos-escalation-queue')
            .doc(queueId);

          batch.set(queueRef, {
            labId,
            alertId,
            analitoId: alert.analitoId,
            severity: alert.severity,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            nextRetry: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      await batch.commit();

      // Log latency if exceeded 200ms
      const elapsed = Date.now() - startTime;
      if (elapsed > 200) {
        console.warn(
          `[criticoDetector] Latency exceeded 200ms: ${elapsed}ms for lab=${labId}, result=${resultId}`
        );
      }
    } catch (err) {
      console.error(
        `[criticoDetector] Error detecting criticos for lab=${labId}, result=${resultId}:`,
        err
      );
      // Non-blocking — log and continue
    }
  }
);
