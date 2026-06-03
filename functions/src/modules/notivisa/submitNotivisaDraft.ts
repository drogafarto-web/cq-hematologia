/**
 * submitNotivisaDraft — callable submitter, moves draft to queue, creates audit log entry
 *
 * @deprecated Use notivisaSubmitDraft instead (Wave 2-10).
 * Scheduled for removal 2026-08-01. See:
 * - Migration guide: docs/notivisa/MIGRATION_LEGACY_TO_WAVE2.md
 * - Deprecation timeline: docs/notivisa/NOTIVISA_CLEANUP_ROADMAP.md
 *
 * Implementação Batch 1, ADR-0026 Phase 8.
 *
 * Responsabilidades:
 *   1. Valida claim + membership (assertNotivisaAccess).
 *   2. Fetch draft, valida status ∈ ['draft', 'approved'].
 *   3. Cria entry em notivisa-queue/{labId}/events com status='pending'.
 *   4. Atualiza draft status → 'submitted'.
 *   5. Cria audit log entries (draft + queue).
 *   6. Retorna eventId + queue status + pacienteCpf (masked).
 *
 * RN-12: escrita via callable; queue processa async (ADR-0026).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertNotivisaAccess,
  SubmitNotivisaDraftInputSchema,
  notivisaDraftsCol,
  notivisaQueueCol,
} from './validators';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

interface SubmitNotivisaDraftResult {
  ok: true;
  eventId: string;
  draftId: string;
  status: 'pending';
  pacienteCpf: string; // masked: ***1234
}

export const submitNotivisaDraft = onCall<unknown, Promise<SubmitNotivisaDraftResult>>(
  {},
  async (request) => {
    const parsed = SubmitNotivisaDraftInputSchema.safeParse(request.data);
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

    // Validate status — only 'draft' or 'approved' can be submitted
    if (draftStatus !== 'draft' && draftStatus !== 'approved') {
      throw new HttpsError(
        'failed-precondition',
        `Rascunho em estado inválido: ${draftStatus}. Apenas 'draft' ou 'approved' podem ser enviados.`,
      );
    }

    if (draftData?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', 'Rascunho foi deletado.');
    }

    // Extract patient CPF for masking
    const pacienteCpf = draftData?.['payload']?.['paciente_cpf'] as string | undefined;
    if (!pacienteCpf) {
      throw new HttpsError('failed-precondition', 'CPF do paciente não encontrado no rascunho.');
    }

    // 2. Create queue event (status='pending', ready for async processor)
    const nowTs = admin.firestore.Timestamp.now();
    const eventRef = notivisaQueueCol(db, input.labId).doc();

    // 3. Atomic batch: update draft + create queue event
    const batch = db.batch();

    // Update draft status → 'submitted'
    batch.update(draftRef, {
      status: 'submitted',
    });

    // Create queue event
    batch.set(eventRef, {
      labId: input.labId,
      draftId: input.draftId,
      pacienteCpf,
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      createdAt: nowTs,
      updatedAt: nowTs,
      deletadoEm: null,
    });

    // Create audit log in draft subcollection
    const draftAuditRef = draftRef.collection('auditLog').doc();
    batch.set(draftAuditRef, {
      action: 'SUBMITTED',
      operatorId: uid,
      ts: nowTs,
      details: {
        eventId: eventRef.id,
        paciente_cpf_masked: `***${pacienteCpf.slice(-4)}`,
      },
    });

    // Create audit log in queue event subcollection
    const queueAuditRef = eventRef.collection('auditLog').doc();
    batch.set(queueAuditRef, {
      action: 'CREATED',
      operatorId: uid,
      ts: nowTs,
      details: {
        draftId: input.draftId,
      },
    });

    await batch.commit();

    // Audit non-blocking — retries + fallback to auditLogFailures/
    await writeAuditLog({
      action: 'NOTIVISA_DRAFT_SUBMIT',
      callerUid: uid,
      labId: input.labId,
      payload: {
        draftId: input.draftId,
        eventId: eventRef.id,
        paciente_cpf_masked: `***${pacienteCpf.slice(-4)}`,
      },
    });

    return {
      ok: true,
      eventId: eventRef.id,
      draftId: input.draftId,
      status: 'pending',
      pacienteCpf: `***${pacienteCpf.slice(-4)}`,
    };
  },
);
