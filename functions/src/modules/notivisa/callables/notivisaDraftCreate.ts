/**
 * notivisaDraftCreate — System callable for auto-draft creation
 * Phase 8 — Creates NOTIVISA draft from laudo (triggered by Phase 10 criticos module)
 *
 * Validates laudo payload, builds NOTIVISA Art. 6º §1 schema,
 * and creates draft awaiting RT approval.
 *
 * Input: { labId, laudoId, criticoContext?, payloadOverride? }
 * Output: { ok, draftId, status, payload, createdAt }
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { notivisaPayloadSchema, notivisaFormatter } from '../../../shared/notivisa';

const criticoContextSchema = z.object({
  detectadoEm: z.number().int(),
  analito: z.string(),
  valor: z.number(),
  severidade: z.enum(['alta', 'baixa']),
});

const payloadOverrideSchema = z.object({
  resultados: z.array(
    z.object({
      analito: z.string(),
      valor: z.union([z.number(), z.string()]),
      unidade: z.string(),
      referencia: z.string(),
    })
  ),
}).optional();

const notivisaDraftCreateInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  laudoId: z.string().min(1, 'laudoId required'),
  criticoContext: criticoContextSchema.optional(),
  payloadOverride: payloadOverrideSchema,
});

const notivisaDraftCreateOutputSchema = z.object({
  ok: z.literal(true),
  draftId: z.string(),
  status: z.literal('draft'),
  payload: notivisaPayloadSchema,
  createdAt: z.number().int(),
});

const notivisaDraftCreateErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum(['LAUDO_NOT_FOUND', 'PACIENTE_NOT_FOUND', 'INVALID_PAYLOAD', 'INTERNAL_ERROR']),
  message: z.string(),
});

type NotivisaDraftCreateInput = z.infer<typeof notivisaDraftCreateInputSchema>;
type NotivisaDraftCreateOutput = z.infer<typeof notivisaDraftCreateOutputSchema>;
type NotivisaDraftCreateError = z.infer<typeof notivisaDraftCreateErrorSchema>;

export const notivisaDraftCreate = functions.region('southamerica-east1').onCall(
  async (request): Promise<NotivisaDraftCreateOutput | NotivisaDraftCreateError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const input = notivisaDraftCreateInputSchema.parse(request.data);
      const { labId, laudoId, criticoContext, payloadOverride } = input;
      const uid = request.auth.uid;

      const db = admin.firestore();

      // ========== 2. Authorization check ==========
      const memberDoc = await db
        .collection('labs')
        .doc(labId)
        .collection('members')
        .doc(uid)
        .get();

      if (!memberDoc.exists) {
        throw new functions.https.HttpsError(
          'permission-denied',
          `User is not a member of lab ${labId}`
        );
      }

      // ========== 3. Fetch laudo ==========
      // Phase 10 integration: read from liberacao-laudos or similar module
      const laudoRef = db
        .collection('labs')
        .doc(labId)
        .collection('liberacao-laudos')
        .doc(laudoId);

      const laudoSnap = await laudoRef.get();
      if (!laudoSnap.exists) {
        return {
          ok: false,
          code: 'LAUDO_NOT_FOUND',
          message: `Laudo ${laudoId} not found in lab ${labId}`,
        };
      }

      const laudoData = laudoSnap.data();
      if (!laudoData) {
        return {
          ok: false,
          code: 'LAUDO_NOT_FOUND',
          message: 'Laudo data is empty',
        };
      }

      // Validate laudo has required NOTIVISA fields
      if (!laudoData.resultados || laudoData.resultados.length === 0) {
        return {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: 'Laudo must have at least one resultado',
        };
      }

      // ========== 4. Fetch paciente ==========
      const pacienteRef = db
        .collection('labs')
        .doc(labId)
        .collection('pacientes')
        .doc(laudoData.pacienteId);

      const pacienteSnap = await pacienteRef.get();
      if (!pacienteSnap.exists) {
        return {
          ok: false,
          code: 'PACIENTE_NOT_FOUND',
          message: `Paciente ${laudoData.pacienteId} not found`,
        };
      }

      const pacienteData = pacienteSnap.data();
      if (!pacienteData?.cpf) {
        return {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: 'Paciente missing CPF (required for NOTIVISA)',
        };
      }

      // ========== 5. Build NOTIVISA payload ==========
      let payload;
      try {
        const formatted = notivisaFormatter(
          {
            id: laudoId,
            resultadoEm: laudoData.resultadoEm?.toMillis?.() || Date.now(),
            resultados: payloadOverride?.resultados || laudoData.resultados,
            assinatura: {
              operatorCpf: laudoData.assinatura?.operatorCpf || 'UNKNOWN',
              ts: laudoData.assinatura?.ts?.toMillis?.() || Date.now(),
            },
          },
          {
            cpf: pacienteData.cpf,
            nome: pacienteData.nome || 'Unknown',
          }
        );

        payload = notivisaPayloadSchema.parse(formatted);
      } catch (error: any) {
        return {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: `Payload validation failed: ${error.message}`,
        };
      }

      // ========== 6. Check if draft already exists (idempotent) ==========
      const existingDraft = await db
        .collection('notivisa-drafts')
        .doc(labId)
        .collection('drafts')
        .where('laudoId', '==', laudoId)
        .where('status', 'in', ['draft', 'approved', 'submitted'])
        .limit(1)
        .get();

      if (!existingDraft.empty) {
        const existingId = existingDraft.docs[0].id;
        const existingData = existingDraft.docs[0].data();
        return {
          ok: true,
          draftId: existingId,
          status: 'draft',
          payload: existingData.payload,
          createdAt: existingData.criadoEm,
        };
      }

      // ========== 7. Create draft ==========
      const draftsRef = db
        .collection('notivisa-drafts')
        .doc(labId)
        .collection('drafts');

      const newDraftId = draftsRef.doc().id;
      const now = Date.now();

      const batch = db.batch();

      // Create draft doc
      batch.set(draftsRef.doc(newDraftId), {
        id: newDraftId,
        labId,
        laudoId,
        status: 'draft',
        payload,
        pacienteCpf: pacienteData.cpf,
        criticoContext: criticoContext || null,
        criadoEm: now,
        deletadoEm: null,
      });

      // Create audit log entry
      batch.set(
        draftsRef.doc(newDraftId).collection('auditLog').doc(`${now}`),
        {
          action: 'CREATED',
          operatorId: uid,
          ts: now,
          details: {
            source: criticoContext ? 'critico_detector' : 'manual_ui',
            laudoId,
            criticoAnalito: criticoContext?.analito || null,
            criticoSeveridade: criticoContext?.severidade || null,
          },
        }
      );

      await batch.commit();

      // Log to Cloud Logs
      functions.logger.info(`[NOTIVISA] Draft created from laudo ${laudoId}`, {
        labId,
        draftId: newDraftId,
        source: criticoContext ? 'critico_detector' : 'manual_ui',
      });

      return {
        ok: true,
        draftId: newDraftId,
        status: 'draft',
        payload,
        createdAt: now,
      };
    } catch (error: any) {
      functions.logger.error('[notivisaDraftCreate] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: error.errors[0].message,
        };
      }

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error during draft creation',
      };
    }
  }
);
