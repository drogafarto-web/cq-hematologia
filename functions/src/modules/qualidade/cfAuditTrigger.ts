/**
 * cfAuditTrigger.ts
 *
 * Cloud Function onDocumentCreated trigger for audit-trail collection.
 * Detects anomalies and generates alerts for operator behavior deviations.
 *
 * Phase 7 Wave 3: Advanced Auditoria
 * RDC 978 Art. 107 — Anomalies in operation audit trail
 * DICQ 4.4 — Audit monitoring + compliance tracking
 *
 * Trigger path: /labs/{labId}/audit-trail/{entryId}
 * Region: southamerica-east1
 * Memory: 256MiB
 * Timeout: 30s
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { detectAnomalies, getOperatorBaseline } from '../../shared/anomalyDetector';
import { generateAlert } from '../../shared/alertEngine';
import type { AuditEntry, AnomalyScore } from '../../types/anomalyTypes';

// Initialize Firestore admin
const db = admin.firestore();

/**
 * onAuditTrailEntry
 *
 * Triggered on creation of new audit trail entry.
 * Flow:
 * 1. Extract labId and entry from event path/data
 * 2. Run anomaly detection (graceful failure)
 * 3. Save anomaly score to /labs/{labId}/anomaly-scores/{entryId}
 * 4. If overall score >= 0.85, generate alert
 *
 * Failures are logged but do not block audit trail persistence.
 */
export const onAuditTrailEntry = onDocumentCreated(
  {
    document: 'labs/{labId}/audit-trail/{entryId}',
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (event) => {
    const labId = event.params.labId;
    const entryId = event.params.entryId;
    const entry = event.data?.data() as AuditEntry | undefined;

    // Validation
    if (!labId || !entryId || !entry) {
      console.warn('[cfAuditTrigger] Missing required params', { labId, entryId });
      return;
    }

    console.log('[cfAuditTrigger] Processing entry', { labId, entryId });

    try {
      // 1. Fetch operator baseline
      const operatorId = entry.operatorId || 'unknown';
      const baseline = await getOperatorBaseline(labId, operatorId);

      // 2. Detect anomalies
      let anomalyScore: AnomalyScore;
      try {
        const detectionResult = await detectAnomalies(entry, baseline);
        anomalyScore = {
          entryId,
          labId,
          operatorId,
          overall: detectionResult.overall,
          dimensions: detectionResult.dimensions,
          computedAt: Date.now(),
        };
      } catch (detectionErr) {
        console.warn('[cfAuditTrigger] Anomaly detection failed', {
          labId,
          entryId,
          error: detectionErr instanceof Error ? detectionErr.message : String(detectionErr),
        });

        anomalyScore = {
          entryId,
          labId,
          operatorId,
          overall: 0,
          dimensions: [],
          computedAt: Date.now(),
        };
      }

      // 3. Save anomaly score
      await db
        .collection('labs')
        .doc(labId)
        .collection('anomaly-scores')
        .doc(entryId)
        .set(anomalyScore, { merge: true });

      console.log('[cfAuditTrigger] Anomaly score saved', {
        labId,
        entryId,
        score: anomalyScore.overall,
      });

      // 4. Generate alert if threshold exceeded
      if (anomalyScore.overall >= 0.70) {
        try {
          await generateAlert(
            { entryId, overall: anomalyScore.overall, dimensions: anomalyScore.dimensions, flags: [] },
            labId,
            operatorId
          );
          console.log('[cfAuditTrigger] Alert generated', {
            labId,
            entryId,
            score: anomalyScore.overall,
          });
        } catch (alertErr) {
          console.warn('[cfAuditTrigger] Alert generation failed', {
            labId,
            entryId,
            error: alertErr instanceof Error ? alertErr.message : String(alertErr),
          });
        }
      }
    } catch (err) {
      console.error('[cfAuditTrigger] Unexpected error', {
        labId,
        entryId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Do not rethrow; this function must not block audit trail
    }
  },
);
