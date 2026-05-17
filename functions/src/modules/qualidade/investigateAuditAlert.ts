/**
 * investigateAuditAlert.ts
 *
 * Cloud Function callable to investigate and resolve an audit anomaly alert.
 * Supports optional NC auto-generation for confirmed anomalies.
 *
 * Phase 7 Wave 7 — Advanced Auditoria
 * RDC 978 Art. 107 — Audit trail anomaly investigation
 * DICQ 4.4 — Audit monitoring + compliance tracking
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface InvestigatePayload {
  labId: string;
  alertId: string;
  conclusion: string;
  ncGenerated: boolean;
  notes?: string;
}

export const investigateAuditAlert = onCall(
  { region: 'southamerica-east1', memory: '256MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { labId, alertId, conclusion, ncGenerated, notes } = request.data as InvestigatePayload;

    if (!labId || !alertId || !conclusion) {
      throw new HttpsError('invalid-argument', 'labId, alertId e conclusion são obrigatórios.');
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
      throw new HttpsError('permission-denied', 'Sem permissão para investigar alertas.');
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
    if (alertData?.status === 'resolved' || alertData?.status === 'dismissed') {
      throw new HttpsError('failed-precondition', 'Alerta já foi processado.');
    }

    const batch = db.batch();

    // Update alert status to resolved
    batch.update(alertRef, {
      status: 'resolved',
      resolvedAt: Date.now(),
      resolvedBy: uid,
    });

    // Create investigation record
    const investigationRef = alertRef.collection('investigations').doc();
    batch.set(investigationRef, {
      alertId,
      labId,
      investigatorId: uid,
      conclusion,
      ncGenerated,
      notes: notes || null,
      createdAt: Date.now(),
    });

    // If NC should be generated, create it
    let ncId: string | null = null;
    if (ncGenerated) {
      const ncRef = db.collection('labs').doc(labId).collection('naoConformidades').doc();
      ncId = ncRef.id;

      batch.set(ncRef, {
        id: ncRef.id,
        labId,
        codigo: `NC-AUTO-${Date.now()}`,
        titulo: `Anomalia confirmada — Alert ${alertId.substring(0, 8)}`,
        descricao: conclusion,
        severidade: alertData?.severity === 'critical' ? 'critica' : 'grave',
        origem: 'modulo',
        moduloOrigem: 'auditoria-avancada',
        auditoriaId: alertId,
        bloqueiaOperacoes: alertData?.severity === 'critical',
        modulosBloqueados: [],
        capaStatus: 'nao_iniciada',
        capaHistorico: [
          {
            status: 'nao_iniciada',
            timestamp: admin.firestore.Timestamp.now(),
            realizadoPor: uid,
            realizadoPorName: 'Sistema',
            descricao: `NC auto-criada a partir de investigação de anomalia.`,
            evidencias: [],
          },
        ],
        abertaEm: admin.firestore.Timestamp.now(),
        abertaPor: uid,
        prazoClosure: null,
        fechadaEm: null,
        fechadaPor: null,
        deletadoEm: null,
      });
    }

    await batch.commit();

    return {
      success: true,
      alertId,
      investigationId: investigationRef.id,
      ncId,
    };
  }
);
