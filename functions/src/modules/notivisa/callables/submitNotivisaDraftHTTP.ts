/**
 * callables/submitNotivisaDraftHTTP.ts — Submit draft via real HTTP client
 *
 * Wave 3 Agent 3 — Sandbox + Production modes
 *
 * Flow:
 *   1. Validate authorization (RT or admin)
 *   2. Fetch draft from Firestore
 *   3. Fetch laudo from Firestore
 *   4. Build NOTIVISA payload via payloadBuilder
 *   5. Call HTTP client submitDraft()
 *   6. Update draft with statusId and status: 'submitted-http'
 *   7. Audit log the submission
 *
 * Returns: { ok: true, statusId, submittedAt } | { ok: false, error }
 * Does NOT throw on HTTP errors; returns error object instead.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import { NotivisaHTTPClient } from '../http/client';
import { buildNotivisaPayload } from '../http/payloadBuilder';
import {
  assertNotivisaAccess,
  notivisaDraftsCol,
} from '../validators';
import { writeAuditLog } from '../../../shared/audit/writeAuditLog';
import { defineSecret } from 'firebase-functions/params';

const submitDraftHTTPInputSchema = z.object({
  labId: z.string().min(1),
  draftId: z.string().min(1),
});

export type SubmitDraftHTTPInput = z.infer<
  typeof submitDraftHTTPInputSchema
>;

export interface SubmitDraftHTTPSuccess {
  ok: true;
  statusId: string;
  submittedAt: number;
}

export interface SubmitDraftHTTPError {
  ok: false;
  error: string;
  code?:
    | 'DRAFT_NOT_FOUND'
    | 'LAUDO_NOT_FOUND'
    | 'INVALID_PAYLOAD'
    | 'HTTP_ERROR'
    | 'INTERNAL_ERROR';
}

export type SubmitDraftHTTPResult = SubmitDraftHTTPSuccess | SubmitDraftHTTPError;

// Secrets (will be provisioned via Firebase)
const notivisaSandboxKey = defineSecret('NOTIVISA_SANDBOX_KEY');
const notivisaSandboxUrl = defineSecret('NOTIVISA_SANDBOX_URL');
const notivisaProdKey = defineSecret('NOTIVISA_PROD_KEY');
const notivisaProdUrl = defineSecret('NOTIVISA_PROD_URL');

/**
 * Get credentials for the given lab
 * For now, all labs use sandbox credentials. Production routing will come in Phase 8.
 */
function getCredentials(mode: 'sandbox' | 'prod'): {
  apiKey: string;
  baseUrl: string;
} {
  // Placeholder values — will be replaced by actual secrets when provisioned
  if (mode === 'prod') {
    return {
      apiKey: process.env.NOTIVISA_PROD_KEY || 'PENDING_SET_NOTIVISA_PROD_KEY',
      baseUrl: process.env.NOTIVISA_PROD_URL || 'PENDING_SET_NOTIVISA_PROD_URL',
    };
  }

  return {
    apiKey:
      process.env.NOTIVISA_SANDBOX_KEY || 'PENDING_SET_NOTIVISA_SANDBOX_KEY',
    baseUrl:
      process.env.NOTIVISA_SANDBOX_URL || 'PENDING_SET_NOTIVISA_SANDBOX_URL',
  };
}

export const submitNotivisaDraftHTTP = onCall<
  unknown,
  Promise<SubmitDraftHTTPResult>
>(
  {
    region: 'southamerica-east1',
    secrets: [
      notivisaSandboxKey,
      notivisaSandboxUrl,
      notivisaProdKey,
      notivisaProdUrl,
    ],
  },
  async (request) => {
    try {
      const parsed = submitDraftHTTPInputSchema.safeParse(request.data);
      if (!parsed.success) {
        return {
          ok: false,
          error: `Dados inválidos: ${parsed.error.message}`,
          code: 'INVALID_PAYLOAD',
        };
      }

      const input = parsed.data;
      await assertNotivisaAccess(request.auth, input.labId);
      const uid = request.auth!.uid;
      const db = admin.firestore();

      // Determine mode (sandbox for now; Phase 8 will add lab-based routing)
      const mode = 'sandbox' as const;

      // 1. Fetch draft
      const draftRef = notivisaDraftsCol(db, input.labId).doc(
        input.draftId,
      );
      const draftSnap = await draftRef.get();
      if (!draftSnap.exists) {
        return {
          ok: false,
          error: 'Rascunho não encontrado',
          code: 'DRAFT_NOT_FOUND',
        };
      }

      const draftData = draftSnap.data();
      if (draftData?.deletadoEm) {
        return {
          ok: false,
          error: 'Rascunho foi deletado',
          code: 'DRAFT_NOT_FOUND',
        };
      }

      if (draftData?.status !== 'approved') {
        return {
          ok: false,
          error: `Rascunho deve estar aprovado (status: ${draftData?.status})`,
          code: 'INVALID_PAYLOAD',
        };
      }

      const laudoId = draftData?.laudoId as string | undefined;
      if (!laudoId) {
        return {
          ok: false,
          error: 'Rascunho sem laudoId',
          code: 'INVALID_PAYLOAD',
        };
      }

      // 2. Fetch laudo
      // Assuming laudos live in /labs/{labId}/laudos/{laudoId}
      // Adjust path if needed based on your schema
      const laudoRef = db
        .collection('laudos')
        .doc(laudoId);
      const laudoSnap = await laudoRef.get();
      if (!laudoSnap.exists) {
        return {
          ok: false,
          error: 'Laudo não encontrado',
          code: 'LAUDO_NOT_FOUND',
        };
      }

      const laudoData = laudoSnap.data() as any;

      // 3. Build payload
      let payload;
      try {
        payload = await buildNotivisaPayload(
          {
            id: laudoData.id,
            labId: input.labId,
            pacienteId: laudoData.pacienteId,
            pacienteCpf: laudoData.pacienteCpf,
            pacienteNome: laudoData.pacienteNome || 'UNKNOWN',
            resultadoEm: laudoData.resultadoEm,
            resultados: laudoData.resultados || [],
            assinatura: laudoData.assinatura || {},
            deletadoEm: laudoData.deletadoEm,
          },
          {
            id: input.labId,
            nome: 'Lab Name', // Will be fetched separately if needed
          },
        );
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          error: `Erro ao construir payload: ${errorMsg}`,
          code: 'INVALID_PAYLOAD',
        };
      }

      // 4. Call HTTP client
      const creds = getCredentials(mode);
      const client = new NotivisaHTTPClient(creds.apiKey, creds.baseUrl);

      const httpResult = await client.submitDraft(input.draftId, payload);

      // Check if HTTP call succeeded
      if ('status' in httpResult && httpResult.status === 'error') {
        return {
          ok: false,
          error: httpResult.reason || 'HTTP submission failed',
          code: 'HTTP_ERROR',
        };
      }

      // 5. Update draft with statusId
      const nowTs = admin.firestore.Timestamp.now();
      await draftRef.update({
        status: 'submitted-http',
        notivisaStatusId: httpResult.statusId,
        submittedHttpAt: nowTs,
        submittedHttpBy: uid,
      });

      // 6. Audit log
      await writeAuditLog({
        action: 'NOTIVISA_DRAFT_SUBMITTED_HTTP',
        callerUid: uid,
        labId: input.labId,
        payload: {
          draftId: input.draftId,
          laudoId,
          statusId: httpResult.statusId,
          mode,
        },
      });

      return {
        ok: true,
        statusId: httpResult.statusId,
        submittedAt: httpResult.submittedAt,
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : String(err);
      console.error('[submitNotivisaDraftHTTP] Unexpected error:', err);

      return {
        ok: false,
        error: `Erro interno: ${errorMsg}`,
        code: 'INTERNAL_ERROR',
      };
    }
  },
);
