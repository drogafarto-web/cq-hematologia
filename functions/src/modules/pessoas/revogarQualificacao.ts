import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Qualificacao } from './types';
import { checkNCs } from '../qualidade/naoConformidade';
import { HCQ_SIGNATURE_HMAC_KEY } from '../signatures/verifier';
import { writeAuditEntry } from '../qualidade/auditTrail';

const db = admin.firestore();

/**
 * revogarQualificacao — Soft-delete a qualification (RN-06)
 *
 * Behavior:
 * 1. Validate RT auth + operatorId !== request.auth.uid
 * 2. Verify qualificacao exists and deletadoEm == null
 * 3. Set deletadoEm: serverTimestamp() (soft delete)
 * 4. Log to audit trail with HMAC signature
 *
 * RDC 978 Art. 5.3 — Write intent + audit trail
 */
export const revogarQualificacao = functions.onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request) => {
    // Auth
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Auth required');
    }

    const { labId, operadorId, qualificacaoId } = request.data;

    // Input validation
    if (!labId || !operadorId || !qualificacaoId) {
      throw new functions.HttpsError(
        'invalid-argument',
        'labId, operadorId, qualificacaoId required',
      );
    }

    // RT-only check
    const memberSnap = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();
    if (!memberSnap.data()?.responsavelTecnico) {
      throw new functions.HttpsError('permission-denied', 'Only RT can revoke qualifications');
    }

    // Cannot revoke own qualification
    if (request.auth.uid === operadorId) {
      throw new functions.HttpsError('permission-denied', 'Cannot revoke your own qualification');
    }

    // Check blocking NCs (ADR 0003)
    const ncCheck = await checkNCs(labId, 'pessoas');
    if (ncCheck.blocked) {
      throw new functions.HttpsError(
        'failed-precondition',
        ncCheck.message || 'NC crítica aberta bloqueia operações neste módulo',
      );
    }

    // Read and verify qualificacao exists
    const qualRef = db.doc(`labs/${labId}/qualificacoes/${qualificacaoId}`);
    const qualSnap = await qualRef.get();

    if (!qualSnap.exists) {
      throw new functions.HttpsError('not-found', 'Qualificação não encontrada');
    }

    const qual = qualSnap.data() as Qualificacao;

    // Check if already deleted
    if (qual.deletadoEm) {
      throw new functions.HttpsError('already-exists', 'Qualificação já foi revogada');
    }

    // Soft delete: set deletadoEm
    try {
      await qualRef.update({
        deletadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Write audit trail entry
      await writeAuditEntry(
        labId,
        request.auth.uid,
        'revogarQualificacao',
        'pessoas',
        {
          operadorId,
          qualificacaoId,
          tipoQualificacao: qual.tipo,
        },
        'sucesso',
        'revoke',
      );

      return {
        success: true,
        qualificacaoId,
      };
    } catch (error: any) {
      throw new functions.HttpsError('internal', 'Falha ao revogar qualificação');
    }
  },
);
