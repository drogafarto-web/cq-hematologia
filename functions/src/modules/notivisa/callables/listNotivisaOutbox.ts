/**
 * listNotivisaOutbox — Auditor export endpoint
 * Phase 8 — Returns paginated list of submitted notifications with export capability
 *
 * Input: { labId, filters?, format?, pageSize?, pageToken? }
 * Output: { ok, items, pageToken?, total, downloadUrl? }
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const filtersSchema = z.object({
  status: z.enum(['submitted', 'acknowledged', 'rejected', 'failed']).optional(),
  operatorId: z.string().optional(),
  dateRangeStart: z.number().int().optional(),
  dateRangeEnd: z.number().int().optional(),
  pacienteCpf: z.string().regex(/^\d{11}$/).optional(),
});

const listNotivisaOutboxInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  filters: filtersSchema.optional(),
  format: z.enum(['json', 'csv', 'xlsx']).default('json'),
  pageSize: z.number().int().min(10).max(500).default(50),
  pageToken: z.string().optional(),
});

const outboxItemSchema = z.object({
  draftId: z.string(),
  eventId: z.string().optional(),
  status: z.string(),
  pacienteCpf: z.string(),
  laudoId: z.string(),
  submittedAt: z.number().int(),
  govStatus: z.enum(['pending', 'acknowledged', 'rejected', 'failed']).optional(),
  attempts: z.number().int().optional(),
});

const listNotivisaOutboxOutputSchema = z.object({
  ok: z.literal(true),
  items: z.array(outboxItemSchema),
  pageToken: z.string().optional(),
  total: z.number().int(),
  downloadUrl: z.string().optional(),
});

const listNotivisaOutboxErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum(['PERMISSION_DENIED', 'INVALID_INPUT', 'INTERNAL_ERROR']),
  message: z.string(),
});

type ListNotivisaOutboxInput = z.infer<typeof listNotivisaOutboxInputSchema>;
type ListNotivisaOutboxOutput = z.infer<typeof listNotivisaOutboxOutputSchema>;
type ListNotivisaOutboxError = z.infer<typeof listNotivisaOutboxErrorSchema>;

const RATE_LIMIT_PER_HOUR = 10;

export const listNotivisaOutbox = functions.region('southamerica-east1').onCall(
  async (request): Promise<ListNotivisaOutboxOutput | ListNotivisaOutboxError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const input = listNotivisaOutboxInputSchema.parse(request.data);
      const { labId, filters, format, pageSize, pageToken } = input;
      const uid = request.auth.uid;

      const db = admin.firestore();

      // ========== 2. Authorization check (AUDITOR only) ==========
      const memberDoc = await db
        .collection('labs')
        .doc(labId)
        .collection('members')
        .doc(uid)
        .get();

      if (!memberDoc.exists) {
        return {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: `User is not a member of lab ${labId}`,
        };
      }

      const memberRole = memberDoc.data()?.role;
      if (memberRole !== 'AUDITOR' && memberRole !== 'admin') {
        return {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: `User role ${memberRole} cannot access NOTIVISA outbox (requires AUDITOR)`,
        };
      }

      // ========== 3. Rate limiting check ==========
      const oneHourAgo = Date.now() - 3600000;
      const recentRequests = await db
        .collection('labs')
        .doc(labId)
        .collection('auditLogs')
        .where('action', '==', 'LIST_NOTIVISA_OUTBOX')
        .where('ts', '>=', oneHourAgo)
        .count()
        .get();

      if (recentRequests.data().count >= RATE_LIMIT_PER_HOUR) {
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          message: `Rate limit exceeded (${RATE_LIMIT_PER_HOUR} requests per hour)`,
        };
      }

      // ========== 4. Build query ==========
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db
        .collection('notivisa-drafts')
        .doc(labId)
        .collection('drafts')
        .where('status', '==', 'submitted');

      // Apply filters
      if (filters) {
        if (filters.dateRangeStart) {
          query = query.where('criadoEm', '>=', filters.dateRangeStart);
        }
        if (filters.dateRangeEnd) {
          query = query.where('criadoEm', '<=', filters.dateRangeEnd);
        }
      }

      query = query.orderBy('criadoEm', 'desc');

      // ========== 5. Execute query with pagination ==========
      let docQuery = query.limit(pageSize + 1); // +1 to check if more results

      if (pageToken) {
        try {
          const lastDocSnap = await db
            .collection('notivisa-drafts')
            .doc(labId)
            .collection('drafts')
            .doc(pageToken)
            .get();
          if (lastDocSnap.exists) {
            docQuery = docQuery.startAfter(lastDocSnap);
          }
        } catch (e) {
          // Invalid token, start from beginning
        }
      }

      const snapshot = await docQuery.get();
      const hasMore = snapshot.docs.length > pageSize;
      const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
      const nextPageToken = hasMore ? snapshot.docs[pageSize - 1].id : undefined;

      // ========== 6. Enrich with event data and build items ==========
      const items: z.infer<typeof outboxItemSchema>[] = [];

      for (const docSnap of docs) {
        const draftData = docSnap.data();

        // Look up linked queue event
        let eventData;
        const eventSnap = await db
          .collection('notivisa-queue')
          .doc(labId)
          .collection('events')
          .where('draftId', '==', docSnap.id)
          .limit(1)
          .get();

        if (!eventSnap.empty) {
          eventData = eventSnap.docs[0].data();
        }

        // Apply CPF filter if specified
        if (filters?.pacienteCpf && draftData.pacienteCpf !== filters.pacienteCpf) {
          continue;
        }

        items.push({
          draftId: docSnap.id,
          eventId: eventData?.id,
          status: draftData.status || 'submitted',
          pacienteCpf: draftData.pacienteCpf || '***',
          laudoId: draftData.laudoId || '',
          submittedAt: draftData.submittedAt || draftData.criadoEm || 0,
          govStatus: eventData?.status,
          attempts: eventData?.attempts,
        });
      }

      // ========== 7. Log request ==========
      await db
        .collection('labs')
        .doc(labId)
        .collection('auditLogs')
        .add({
          action: 'LIST_NOTIVISA_OUTBOX',
          operatorId: uid,
          ts: Date.now(),
          details: {
            format,
            itemCount: items.length,
            filters,
          },
        });

      // ========== 8. Return ==========
      const response: ListNotivisaOutboxOutput = {
        ok: true,
        items,
        total: snapshot.docs.length,
      };

      if (nextPageToken) {
        response.pageToken = nextPageToken;
      }

      return response;
    } catch (error: any) {
      functions.logger.error('[listNotivisaOutbox] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INVALID_INPUT',
          message: error.errors[0].message,
        };
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error listing outbox',
      };
    }
  }
);
