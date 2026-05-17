/**
 * alertEngine.ts
 *
 * Alert generation, routing, and persistence engine for anomalies.
 * Phase 7 Wave 2 — Advanced Auditoria
 *
 * RDC 978 Art. 107 — Anomaly detection in audit trail
 * DICQ 4.4 — Audit monitoring + compliance tracking
 */

import * as admin from 'firebase-admin';
import type { AuditAlert, AlertSeverity } from '../types/anomalyTypes';
import type { AnomalyDetectionResult } from './anomalyDetector';

const db = admin.firestore();

export interface AlertRoutingRule {
  severity: AlertSeverity;
  routeTo: string[];
}

function computeSeverity(overallScore: number): AlertSeverity {
  if (overallScore >= 0.95) return 'critical';
  if (overallScore >= 0.85) return 'high';
  return 'medium';
}

function getDefaultRouting(severity: AlertSeverity): string[] {
  switch (severity) {
    case 'critical':
      return ['rt', 'auditor', 'admin'];
    case 'high':
      return ['rt', 'auditor'];
    case 'medium':
      return ['auditor'];
  }
}

/**
 * Generate alert from anomaly result and persist to Firestore.
 * Also triggers RT notification for critical alerts.
 */
export async function generateAlert(
  anomalyResult: AnomalyDetectionResult,
  labId: string,
  operatorId?: string,
  routingRules?: AlertRoutingRule[]
): Promise<AuditAlert | null> {
  if (anomalyResult.overall < 0.70) {
    return null;
  }

  const severity = computeSeverity(anomalyResult.overall);
  const routedTo = routingRules
    ? routingRules.find((r) => r.severity === severity)?.routeTo ?? getDefaultRouting(severity)
    : getDefaultRouting(severity);

  const alertRef = db.collection('labs').doc(labId).collection('audit-alerts').doc();

  const alert: Omit<AuditAlert, 'id'> = {
    labId,
    anomalyScore: {
      entryId: anomalyResult.entryId,
      labId,
      operatorId: operatorId || 'unknown',
      overall: anomalyResult.overall,
      dimensions: anomalyResult.dimensions,
      computedAt: Date.now(),
    },
    severity,
    status: 'active',
    routedTo,
    createdAt: Date.now(),
  };

  await alertRef.set(alert);

  const persistedAlert: AuditAlert = { id: alertRef.id, ...alert };

  // Notify RT for critical alerts
  if (severity === 'critical') {
    await notifyRT(labId, persistedAlert);
  }

  return persistedAlert;
}

/**
 * Notify RT members when a critical anomaly is detected.
 * Writes to /labs/{labId}/notifications/{notifId}.
 */
async function notifyRT(labId: string, alert: AuditAlert): Promise<void> {
  try {
    const membersSnap = await db
      .collection('labs')
      .doc(labId)
      .collection('members')
      .where('role', 'in', ['rt', 'admin', 'owner'])
      .where('status', '==', 'active')
      .get();

    const batch = db.batch();
    membersSnap.docs.forEach((memberDoc) => {
      const notifRef = db.collection('labs').doc(labId).collection('notifications').doc();
      batch.set(notifRef, {
        type: 'anomaly_critical',
        title: 'Anomalia Crítica Detectada',
        body: `Score ${Math.round(alert.anomalyScore.overall * 100)}% — operador ${alert.anomalyScore.operatorId}`,
        alertId: alert.id,
        recipientId: memberDoc.id,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (membersSnap.docs.length > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('[alertEngine] Failed to notify RT', {
      labId,
      alertId: alert.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
