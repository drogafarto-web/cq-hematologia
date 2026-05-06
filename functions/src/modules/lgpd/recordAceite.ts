/**
 * recordPrivacyAceite Cloud Function Callable
 *
 * Records user acceptance of privacy policy (LGPD Art. 9 — transparência)
 * Stores acceptance with IP address, user agent, timestamp for audit trail
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const recordPrivacyAceite = onCall(async (request: any) => {
  const { userId, labId, policyVersionId, policyVersao, ipAddr, userAgent } = request.data;

  // ─────────────────────────────────────────────────────────────────────────
  // Validate inputs
  // ─────────────────────────────────────────────────────────────────────────

  if (!userId || !labId || !policyVersionId || !policyVersao) {
    throw new HttpsError('invalid-argument', 'Campos obrigatórios ausentes');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate auth: user can only accept for themselves
  // ─────────────────────────────────────────────────────────────────────────

  if (request.auth?.uid !== userId) {
    throw new HttpsError(
      'permission-denied',
      'Você pode aceitar a política apenas para sua própria conta',
    );
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Check if policy version exists
    // ─────────────────────────────────────────────────────────────────────────

    const policyDoc = await db.doc(`labs/${labId}/lgpd/politicas/${policyVersionId}`).get();

    if (!policyDoc.exists) {
      throw new HttpsError('not-found', 'Versão de política não encontrada');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Check if already accepted (idempotent)
    // ─────────────────────────────────────────────────────────────────────────

    const existingQuery = db
      .collection(`users/${userId}/privacyAceites`)
      .where('policyVersionId', '==', policyVersionId)
      .limit(1);

    const existingSnap = await existingQuery.get();

    if (!existingSnap.empty) {
      // Already accepted — return existing record
      return {
        aceitesId: existingSnap.docs[0].id,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Create acceptance record
    // ─────────────────────────────────────────────────────────────────────────

    const aceitesRef = db.collection(`users/${userId}/privacyAceites`).doc();

    const now = admin.firestore.Timestamp.now();

    const aceiteData = {
      labId,
      userId,
      policyVersionId,
      policyVersao,
      aceiteEm: now,
      ipAddr: ipAddr || 'unknown',
      userAgent: userAgent || 'unknown',
    };

    await aceitesRef.set(aceiteData);

    // ─────────────────────────────────────────────────────────────────────────
    // Log to audit trail
    // ─────────────────────────────────────────────────────────────────────────

    await db.collection('auditLogs').add({
      action: 'PRIVACY_POLICY_ACCEPTED',
      callerUid: request.auth.uid,
      labId,
      payload: {
        userId,
        policyVersionId,
        policyVersao,
        aceiteEm: now,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `[recordPrivacyAceite] User ${userId} accepted policy ${policyVersao} in lab ${labId}`,
    );

    return {
      aceitesId: aceitesRef.id,
    };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message || 'Erro ao registrar aceitação');
  }
});
