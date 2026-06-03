/**
 * getNotivisaDraft — Read-only callable to fetch single draft with context
 * Phase 8 — Returns draft payload + audit log + linked queue event
 *
 * Input: { labId, draftId }
 * Output: { ok, draft, auditLog, linkedEvent? }
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const getNotivisaDraftInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  draftId: z.string().min(1, 'draftId required'),
});

const auditLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  operatorId: z.string(),
  ts: z.number().int(),
  details: z.record(z.any()),
});

const linkedEventSchema = z.object({
  eventId: z.string(),
  status: z.enum(['pending', 'sent', 'failed', 'acknowledged', 'rejected']),
  attempts: z.number().int(),
  nextRetry: z.number().int().optional(),
});

const draftSchema = z.object({
  id: z.string(),
  labId: z.string(),
  laudoId: z.string(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'submitted', 'rejected']),
  payload: z.any(),
  rejectionReason: z.string().optional(),
  criadoEm: z.number().int(),
  updatedAt: z.number().int().optional(),
});

const getNotivisaDraftOutputSchema = z.object({
  ok: z.literal(true),
  draft: draftSchema,
  auditLog: z.array(auditLogSchema),
  linkedEvent: linkedEventSchema.optional(),
});

const getNotivisaDraftErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum(['DRAFT_NOT_FOUND', 'PERMISSION_DENIED', 'INTERNAL_ERROR']),
  message: z.string(),
});

type GetNotivisaDraftInput = z.infer<typeof getNotivisaDraftInputSchema>;
type GetNotivisaDraftOutput = z.infer<typeof getNotivisaDraftOutputSchema>;
type GetNotivisaDraftError = z.infer<typeof getNotivisaDraftErrorSchema>;

export const getNotivisaDraft = functions
  .region('southamerica-east1')
  .onCall(async (request): Promise<GetNotivisaDraftOutput | GetNotivisaDraftError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
      }

      const input = getNotivisaDraftInputSchema.parse(request.data);
      const { labId, draftId } = input;
      const uid = request.auth.uid;

      const db = admin.firestore();

      // ========== 2. Authorization check ==========
      const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(uid).get();

      if (!memberDoc.exists) {
        return {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: `User is not a member of lab ${labId}`,
        };
      }

      // ========== 3. Fetch draft ==========
      const draftRef = db
        .collection('notivisa-drafts')
        .doc(labId)
        .collection('drafts')
        .doc(draftId);

      const draftSnap = await draftRef.get();
      if (!draftSnap.exists) {
        return {
          ok: false,
          code: 'DRAFT_NOT_FOUND',
          message: `Draft ${draftId} not found`,
        };
      }

      const draftData = draftSnap.data();
      if (!draftData || draftData.deletadoEm) {
        return {
          ok: false,
          code: 'DRAFT_NOT_FOUND',
          message: 'Draft has been deleted',
        };
      }

      // ========== 4. Fetch audit log ==========
      const auditSnap = await draftRef.collection('auditLog').orderBy('ts', 'desc').limit(50).get();

      const auditLog = auditSnap.docs.map((doc) => ({
        id: doc.id,
        action: doc.data().action || '',
        operatorId: doc.data().operatorId || '',
        ts: doc.data().ts || 0,
        details: doc.data().details || {},
      }));

      // ========== 5. Fetch linked queue event (if submitted) ==========
      let linkedEvent;
      if (draftData.status === 'submitted' || draftData.submittedAt) {
        const eventSnap = await db
          .collection('notivisa-queue')
          .doc(labId)
          .collection('events')
          .where('draftId', '==', draftId)
          .limit(1)
          .get();

        if (!eventSnap.empty) {
          const eventData = eventSnap.docs[0].data();
          linkedEvent = {
            eventId: eventSnap.docs[0].id,
            status: eventData.status || 'pending',
            attempts: eventData.attempts || 0,
            nextRetry: eventData.nextRetry,
          };
        }
      }

      // ========== 6. Return ==========
      const draft = {
        id: draftData.id || draftId,
        labId: draftData.labId || labId,
        laudoId: draftData.laudoId || '',
        status: draftData.status || 'draft',
        payload: draftData.payload,
        rejectionReason: draftData.rejectionReason,
        criadoEm: draftData.criadoEm || 0,
        updatedAt: draftData.updatedAt,
      };

      return {
        ok: true,
        draft,
        auditLog,
        linkedEvent,
      };
    } catch (error: any) {
      functions.logger.error('[getNotivisaDraft] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          message: error.errors[0].message,
        };
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error fetching draft',
      };
    }
  });
