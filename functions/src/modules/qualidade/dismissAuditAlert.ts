/**
 * dismissAuditAlert.ts
 *
 * Cloud Function callable to dismiss an audit anomaly alert.
 * Updates alert status from 'active' → 'dismissed' with reason and actor.
 *
 * Phase 7 Wave 7 — Advanced Auditoria
 * RDC 978 Art. 107 — Audit trail anomaly management
 * DICQ 4.4 — Audit monitoring
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface DismissPayload {
  labId: string;
  alertId: string;
  reason: string;
}

export const dismissAuditAlert = onCall(
  { region: 'southamerica-east1', memory: '256MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { labId, alertId, reason } = request.data as DismissPayload;

    if (!labId || !alertId) {
      throw new HttpsError('invalid-argument', 'labId e alertId são obrigatórios.');
    }

    // Validate membership + role
    const memberDoc = await db
      .collection('labs')
      .doc(labId)
      .collection('members')
      .doc(uid)
      .get();

    if (!memberDoc.exists) {
      throw new HttpsError('permission-denied', 'Usuário não é membro deste laboratório.');
    }

    const memberData = memberDoc.data();
    const role = memberData?.role;
    const allowedRoles = ['rt', 'auditor', 'admin', 'owner'];

    if (!role || !allowedRoles.includes(role)) {
      throw new HttpsError('permission-denied', 'Sem permissão para descartar alertas.');
    }

    // Fetch alert
    const alertRef = db
      .collection('labs')
      .doc(labId)
      .collection('audit-alerts')
      .doc(alertId);

    const alertDoc = await alertRef.get();

    if (!alertDoc.exists) {
      throw new HttpsError('not-found', 'Alerta não encontrado.');
    }

    const alertData = alertDoc.data();
    if (alertData?.status !== 'active' && alertData?.status !== 'investigating') {
      throw new HttpsError('failed-precondition', 'Alerta já foi processado.');
    }

    // Update alert
    await alertRef.update({
      status: 'dismissed',
      dismissedAt: Date.now(),
      dismissedBy: uid,
      dismissReason: reason || 'Descartado pelo operador',
    });

    return { success: true, alertId };
  }
);
