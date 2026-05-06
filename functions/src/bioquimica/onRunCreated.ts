/**
 * onRunCreated — Firestore trigger
 *
 * Fires when a new run is created in /labs/{labId}/bioquimica/root/runs/{runId}
 * Automatically records a traceability event (append-only log entry)
 * for RDC 978 Art. 181 compliance (rastreabilidade de amostras controle)
 *
 * Trigger: onDocumentCreated('labs/{labId}/bioquimica/root/runs/{runId}')
 * Action: recordTraceabilityEvent (internal call via Admin SDK)
 *
 * Does NOT block if event recording fails (fire-and-forget pattern)
 * but logs failures for monitoring.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

/**
 * Cloud Function: onRunCreated
 * Trigger: Firestore onDocumentCreated
 * Path: /labs/{labId}/bioquimica/root/runs/{runId}
 */
export const onRunCreated = onDocumentCreated(
  'labs/{labId}/bioquimica/root/runs/{runId}',
  async (event) => {
    const { labId, runId } = event.params;
    const runData = event.data?.data() as any;

    if (!runData) {
      logger.warn(`[bioquimica] onRunCreated: run data is empty for ${runId}`);
      return;
    }

    const db = admin.firestore();

    try {
      // Record traceability event (append-only)
      // This documents the creation of the run for audit purposes
      const traceabilityEvent = {
        labId,
        runId,
        eventType: 'run-created',
        equipment: runData.equipmentId,
        analitos: runData.analitoIds,
        status: runData.status,
        violations: (runData.violations || []).length,
        chainHash: runData.chainHash,
        signature: {
          hash: runData.signature.hash,
          operatorId: runData.signature.operatorId,
          ts: runData.signature.ts,
        },
        // Manual field (MVP) — operator provides at run capture
        examCodeAtChange: null,
        remarks: null,
        createdAt: admin.firestore.Timestamp.now(),
      };

      await db
        .doc(`labs/${labId}/bioquimica/root/traceability-events/${runId}`)
        .set(traceabilityEvent);

      logger.info(
        `[bioquimica] Traceability event recorded for run ${runId} (${runData.status})`
      );
    } catch (err) {
      logger.error(
        `[bioquimica] Failed to record traceability event for ${runId}:`,
        err
      );
      // Non-blocking: don't throw — run is already persisted
    }
  }
);
