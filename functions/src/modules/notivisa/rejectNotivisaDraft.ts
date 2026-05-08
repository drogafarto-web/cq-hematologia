/**
 * rejectNotivisaDraft — auditor rejects draft with motivo, transitions back to rejected
 *
 * @deprecated Rejection mechanism transitioning to soft-delete in Wave 2 (TBD Phase 5+).
 * Scheduled for removal 2026-08-01. See:
 * - Migration guide: docs/notivisa/MIGRATION_LEGACY_TO_WAVE2.md
 * - Deprecation timeline: docs/notivisa/NOTIVISA_CLEANUP_ROADMAP.md
 *
 * Implementação Batch 1, ADR-0026 Phase 8.
 *
 * Responsabilidades:
 *   1. Valida claim + membership (assertNotivisaAccess).
 *   2. Valida signature (hash + operatorId + ts check).
 *   3. Fetch draft, valida status ∈ ['draft', 'approved'].
 *   4. Update draft status → 'rejected', armazena motivo.
 *   5. Cria audit log entry.
 *   6. Retorna draftId + status + motivo.
 *
 * RN-12: escrita via callable; signature obrigatória (ADR-0012).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertNotivisaAccess,
  RejectNotivisaDraftInputSchema,
  notivisaDraftsCol,
} from './validators';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';
import {
  generateNotivisaSignatureServer,
  type LogicalSignature,
  sha256Hex,
  sortedStringify,
} from './signatureCanonical';

interface RejectNotivisaDraftResult {
  ok: true;
  draftId: string;
  status: 'rejected';
  motivo: string;
}

/**
 * Verifica se a assinatura fornecida é válida:
 *   - hash matches computedHash (dado operatorId + payload)
 *   - operatorId matches request.auth.uid
 *   - ts within 5 minutes of server time
 */
function verifySignature(
  signature: { hash: string; operatorId: string; ts: number },
  expectedPayload: Record<string, string | number>,
  uid: string,
): boolean {
  // Verify operatorId matches
  if (signature.operatorId !== uid) {
    return false;
  }

  // Verify timestamp is recent (within 5 minutes)
  const now = Date.now();
  const sigTime = signature.ts as number;
  if (Math.abs(now - sigTime) > 5 * 60 * 1000) {
    return false;
  }

  // Verify hash
  const expectedHash = sha256Hex(
    JSON.stringify({
      operatorId: uid,
      ts: sigTime,
      data: sortedStringify(expectedPayload),
    }),
  );

  return signature.hash === expectedHash;
}

export const rejectNotivisaDraft = onCall<unknown, Promise<RejectNotivisaDraftResult>>(
  {},
  async (request) => {
    const parsed = RejectNotivisaDraftInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }

    const input = parsed.data;

    await assertNotivisaAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    // 1. Fetch draft
    const draftRef = notivisaDraftsCol(db, input.labId).doc(input.draftId);
    const draftSnap = await draftRef.get();

    if (!draftSnap.exists) {
      throw new HttpsError('not-found', 'Rascunho não encontrado.');
    }

    const draftData = draftSnap.data();
    const draftStatus = draftData?.['status'];

    // Only drafts in 'draft' or 'approved' state can be rejected
    if (draftStatus !== 'draft' && draftStatus !== 'approved') {
      throw new HttpsError(
        'failed-precondition',
        `Rascunho em estado inválido: ${draftStatus}. Apenas 'draft' ou 'approved' podem ser rejeitados.`,
      );
    }

    if (draftData?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', 'Rascunho foi deletado.');
    }

    // 2. Verify signature
    const payloadForSig = {
      draftId: input.draftId,
      motivo: input.motivo,
      action: 'reject',
    };

    if (!verifySignature(input.signature, payloadForSig, uid)) {
      throw new HttpsError(
        'invalid-argument',
        'Assinatura inválida — operatorId, hash ou timestamp incorreto.',
      );
    }

    // 3. Update draft to rejected
    const nowTs = admin.firestore.Timestamp.now();

    const rejectionSig: LogicalSignature = generateNotivisaSignatureServer(
      uid,
      {
        draftId: input.draftId,
        motivo: input.motivo,
        action: 'reject',
      },
      nowTs,
    );

    const batch = db.batch();

    batch.update(draftRef, {
      status: 'rejected',
      motivo: input.motivo,
      rejectionSignature: {
        hash: rejectionSig.hash,
        operatorId: rejectionSig.operatorId,
        ts: rejectionSig.ts.toMillis(),
      },
    });

    // Create audit log entry
    const auditRef = draftRef.collection('auditLog').doc();
    batch.set(auditRef, {
      action: 'REJECTED',
      operatorId: uid,
      ts: nowTs,
      details: {
        draftId: input.draftId,
        motivo: input.motivo,
      },
    });

    await batch.commit();

    // Audit non-blocking — retries + fallback to auditLogFailures/
    await writeAuditLog({
      action: 'NOTIVISA_DRAFT_REJECT',
      callerUid: uid,
      labId: input.labId,
      payload: {
        draftId: input.draftId,
        motivo: input.motivo,
      },
    });

    return {
      ok: true,
      draftId: input.draftId,
      status: 'rejected',
      motivo: input.motivo,
    };
  },
);
