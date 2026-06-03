/**
 * createDraft.ts — NOTIVISA draft creation callable (test-mode lifecycle, Wave 2 Agent 10).
 *
 * Phase 8 / v1.4 Phase 4 — RDC 978 Art. 6 lifecycle skeleton.
 *
 * Distinct from the legacy `notivisaDraftCreate` callable: this is the
 * test-mode-aware entrypoint for the draft → submit → outbox lifecycle.
 * It writes to `notivisa-drafts/{labId}/drafts/{draftId}` with status
 * `pending`, enforces idempotency on `laudoId`, and never touches the
 * government API (test mode is the default; sandbox/prod are unimplemented).
 *
 * Idempotency: a non-rejected draft for the same `laudoId` short-circuits
 * the call and returns the existing `draftId` — no double writes, no
 * audit-log noise, safe for client retries.
 *
 * Companion files: `approveDraft.ts`, `submitDraft.ts`, `processQueue.ts`,
 * `exportOutbox.ts`. Wiring proposed in
 * `.planning/proposed-changes/wave2-10-notivisa.md` — index.ts is NOT
 * touched directly to avoid race with Wave 2 Agent 3.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import { assertNotivisaAccess, ensureNotivisaLabRoot, notivisaDraftsCol } from './validators';
import { getNotivisaMode } from './testMode';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

const CreateDraftInputSchema = z.object({
  labId: z.string().min(1),
  laudoId: z.string().min(1),
  payload: z.object({
    versao: z.literal('1.0'),
    laudo_id: z.string().min(1),
    paciente_cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
    data_resultado: z.number().int().positive(),
    resultados: z
      .array(
        z.object({
          analito: z.string().min(1),
          valor: z.union([z.number(), z.string()]),
          unidade: z.string().min(1),
          referencia: z.string(),
        }),
      )
      .min(1),
  }),
});

export type CreateDraftInput = z.infer<typeof CreateDraftInputSchema>;

export interface CreateDraftResult {
  ok: true;
  draftId: string;
  status: 'pending';
  idempotent: boolean;
  mode: 'test' | 'sandbox' | 'prod';
  criadoEm: number;
}

export const createDraft = onCall<unknown, Promise<CreateDraftResult>>(
  { region: 'southamerica-east1' },
  async (request) => {
    const parsed = CreateDraftInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }

    const input = parsed.data;
    await assertNotivisaAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();
    const mode = getNotivisaMode();

    await ensureNotivisaLabRoot(db, input.labId);

    // Idempotency — any draft for this laudoId in non-rejected state wins.
    const existing = await notivisaDraftsCol(db, input.labId)
      .where('laudoId', '==', input.laudoId)
      .where('status', 'in', ['pending', 'approved', 'submitted'])
      .limit(1)
      .get();

    if (!existing.empty) {
      const existingDoc = existing.docs[0];
      const existingData = existingDoc.data();
      return {
        ok: true,
        draftId: existingDoc.id,
        status: 'pending',
        idempotent: true,
        mode,
        criadoEm: existingData?.['criadoEm']?.toMillis?.() ?? Date.now(),
      };
    }

    const draftRef = notivisaDraftsCol(db, input.labId).doc();
    const nowTs = admin.firestore.Timestamp.now();

    const batch = db.batch();
    batch.set(draftRef, {
      labId: input.labId,
      laudoId: input.laudoId,
      payload: input.payload,
      status: 'pending',
      mode,
      createdBy: uid,
      criadoEm: nowTs,
      deletadoEm: null,
    });

    const auditRef = draftRef.collection('auditLog').doc();
    batch.set(auditRef, {
      action: 'DRAFT_CREATED',
      operatorId: uid,
      ts: nowTs,
      details: {
        laudoId: input.laudoId,
        mode,
        paciente_cpf_masked: `***${input.payload.paciente_cpf.slice(-4)}`,
      },
    });

    await batch.commit();

    await writeAuditLog({
      action: 'NOTIVISA_DRAFT_CREATED',
      callerUid: uid,
      labId: input.labId,
      payload: {
        draftId: draftRef.id,
        laudoId: input.laudoId,
        mode,
      },
    });

    return {
      ok: true,
      draftId: draftRef.id,
      status: 'pending',
      idempotent: false,
      mode,
      criadoEm: nowTs.toMillis(),
    };
  },
);
