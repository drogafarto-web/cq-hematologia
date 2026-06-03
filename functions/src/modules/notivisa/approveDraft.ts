/**
 * approveDraft.ts — RT/admin approves a NOTIVISA draft.
 *
 * Wave 2 Agent 10 — test-mode lifecycle. Distinct from the legacy
 * `approveNotivisaDraft` callable: this companion to `createDraft.ts`
 * operates on drafts in `pending` status (the lifecycle skeleton) and
 * transitions them to `approved`. No signature ceremony — Wave 2 keeps
 * the cryptographic dance scoped to the legacy callable so we don't fork
 * verification logic during the race-window. The audit log preserves
 * who/when, which is enough for the test-mode E2E.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import { assertNotivisaAccess, notivisaDraftsCol } from './validators';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

const ApproveDraftInputSchema = z.object({
  labId: z.string().min(1),
  draftId: z.string().min(1),
});

export type ApproveDraftInput = z.infer<typeof ApproveDraftInputSchema>;

export interface ApproveDraftResult {
  ok: true;
  draftId: string;
  status: 'approved';
  approvedBy: string;
  approvedAt: number;
}

function callerHasApprovalRole(token: Record<string, unknown> | undefined): boolean {
  if (!token) return false;
  const role = token['role'];
  if (role === 'RT' || role === 'admin' || role === 'owner') return true;
  // Some deployments embed roles under `roles` array.
  const roles = token['roles'];
  if (Array.isArray(roles) && roles.some((r) => r === 'RT' || r === 'admin' || r === 'owner')) {
    return true;
  }
  return false;
}

export const approveDraft = onCall<unknown, Promise<ApproveDraftResult>>(
  { region: 'southamerica-east1' },
  async (request) => {
    const parsed = ApproveDraftInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertNotivisaAccess(request.auth, input.labId);
    const uid = request.auth!.uid;

    if (!callerHasApprovalRole(request.auth!.token as Record<string, unknown>)) {
      throw new HttpsError(
        'permission-denied',
        'Apenas RT, admin ou owner podem aprovar rascunhos NOTIVISA.',
      );
    }

    const db = admin.firestore();
    const draftRef = notivisaDraftsCol(db, input.labId).doc(input.draftId);
    const draftSnap = await draftRef.get();

    if (!draftSnap.exists) {
      throw new HttpsError('not-found', 'Rascunho não encontrado.');
    }

    const data = draftSnap.data();
    if (data?.['deletadoEm']) {
      throw new HttpsError('not-found', 'Rascunho foi deletado.');
    }
    if (data?.['status'] !== 'pending') {
      throw new HttpsError(
        'failed-precondition',
        `Rascunho não está em estado 'pending' (status atual: ${data?.['status']}).`,
      );
    }

    const nowTs = admin.firestore.Timestamp.now();
    const batch = db.batch();

    batch.update(draftRef, {
      status: 'approved',
      approvedBy: uid,
      approvedAt: nowTs,
    });

    const auditRef = draftRef.collection('auditLog').doc();
    batch.set(auditRef, {
      action: 'DRAFT_APPROVED',
      operatorId: uid,
      ts: nowTs,
      details: { draftId: input.draftId },
    });

    await batch.commit();

    await writeAuditLog({
      action: 'NOTIVISA_DRAFT_APPROVED',
      callerUid: uid,
      labId: input.labId,
      payload: { draftId: input.draftId },
    });

    return {
      ok: true,
      draftId: input.draftId,
      status: 'approved',
      approvedBy: uid,
      approvedAt: nowTs.toMillis(),
    };
  },
);
