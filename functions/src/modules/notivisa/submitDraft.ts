/**
 * submitDraft.ts — Enqueue an approved draft for async transmission.
 *
 * Wave 2 Agent 10 — test-mode lifecycle. Companion to `createDraft.ts`
 * and `approveDraft.ts`. Requires `status === 'approved'`. Atomically:
 *   1. Updates the draft to `submitted`.
 *   2. Creates a `notivisa-queue/{labId}/events/{eventId}` doc with
 *      `status: 'pending'`, `attempts: 0`, `nextRetry: now`.
 *   3. Writes audit logs on draft + queue event.
 *
 * The cron in `processQueue.ts` picks events up from there. No HTTP call
 * happens in this callable — submission to the (synthetic in test mode)
 * gov endpoint is async by design so the user-facing latency stays low.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import {
  assertNotivisaAccess,
  notivisaDraftsCol,
  notivisaQueueCol,
} from './validators';
import { getNotivisaMode } from './testMode';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

const SubmitDraftInputSchema = z.object({
  labId: z.string().min(1),
  draftId: z.string().min(1),
});

export type SubmitDraftInput = z.infer<typeof SubmitDraftInputSchema>;

export interface SubmitDraftResult {
  ok: true;
  draftId: string;
  eventId: string;
  status: 'pending';
  mode: 'test' | 'sandbox' | 'prod';
  enqueuedAt: number;
}

const MAX_ATTEMPTS = 5;

export const submitDraft = onCall<unknown, Promise<SubmitDraftResult>>(
  { region: 'southamerica-east1' },
  async (request) => {
    const parsed = SubmitDraftInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertNotivisaAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();
    const mode = getNotivisaMode();

    const draftRef = notivisaDraftsCol(db, input.labId).doc(input.draftId);
    const draftSnap = await draftRef.get();
    if (!draftSnap.exists) {
      throw new HttpsError('not-found', 'Rascunho não encontrado.');
    }
    const data = draftSnap.data();
    if (data?.['deletadoEm']) {
      throw new HttpsError('not-found', 'Rascunho foi deletado.');
    }
    if (data?.['status'] !== 'approved') {
      throw new HttpsError(
        'failed-precondition',
        `Rascunho precisa estar 'approved' para ser enviado (status atual: ${data?.['status']}).`,
      );
    }

    const laudoId = data?.['laudoId'] as string | undefined;
    const pacienteCpf = data?.['payload']?.['paciente_cpf'] as string | undefined;
    if (!laudoId || !pacienteCpf) {
      throw new HttpsError('failed-precondition', 'Rascunho com payload incompleto.');
    }

    const nowTs = admin.firestore.Timestamp.now();
    const eventRef = notivisaQueueCol(db, input.labId).doc();

    const batch = db.batch();

    batch.update(draftRef, {
      status: 'submitted',
      submittedBy: uid,
      submittedAt: nowTs,
      queueEventId: eventRef.id,
    });

    batch.set(eventRef, {
      labId: input.labId,
      draftId: input.draftId,
      laudoId,
      pacienteCpfMasked: `***${pacienteCpf.slice(-4)}`,
      mode,
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextRetry: nowTs,
      createdAt: nowTs,
      updatedAt: nowTs,
      enqueuedBy: uid,
      deletadoEm: null,
    });

    const draftAuditRef = draftRef.collection('auditLog').doc();
    batch.set(draftAuditRef, {
      action: 'DRAFT_SUBMITTED',
      operatorId: uid,
      ts: nowTs,
      details: { eventId: eventRef.id, mode },
    });

    await batch.commit();

    await writeAuditLog({
      action: 'NOTIVISA_DRAFT_SUBMITTED',
      callerUid: uid,
      labId: input.labId,
      payload: {
        draftId: input.draftId,
        eventId: eventRef.id,
        mode,
      },
    });

    return {
      ok: true,
      draftId: input.draftId,
      eventId: eventRef.id,
      status: 'pending',
      mode,
      enqueuedAt: nowTs.toMillis(),
    };
  },
);
