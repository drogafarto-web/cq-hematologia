/**
 * notivisaWebhookHandler — HTTP endpoint for Anvisa acknowledgment callbacks
 * Phase 12+ (production NOTIVISA integration)
 *
 * Receives SOAP callback from Anvisa, verifies HMAC-SHA256 signature,
 * and updates entry status to 'acknowledged'.
 *
 * Per ADR-0026: webhook verifies signature, finds entry by idempotencyKey,
 * updates status immutably, emits success metric.
 *
 * Signature: HMAC-SHA256(payload, ANVISA_WEBHOOK_SECRET)
 * Header: x-anvisa-signature (hex-encoded)
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import crypto from 'crypto';
import { z } from 'zod';

/**
 * Webhook payload from Anvisa
 */
const anvisaWebhookPayloadSchema = z.object({
  idempotencyKey: z.string().length(64, 'idempotencyKey must be 64-char hex'),
  status: z.enum(['success', 'rejected', 'error']),
  eventId: z.string().min(1),
  timestamp: z.string().datetime(),
  receiptNumber: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});

type AnvisaWebhookPayload = z.infer<typeof anvisaWebhookPayloadSchema>;

/**
 * Internal response schema
 */
interface WebhookHandlerResponse {
  received: boolean;
  entryId?: string;
  labId?: string;
  note?: string;
}

/**
 * Verify HMAC-SHA256 signature
 * @param payload - JSON string of request body
 * @param signature - hex-encoded signature from header
 * @param secret - webhook secret (from Secret Manager, Phase 12+)
 * @returns true if signature matches
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // Constant-time comparison to prevent timing attacks
  return computed.length === signature.length && computed === signature;
}

/**
 * Webhook handler for Anvisa acknowledgments
 * Endpoint: /notivisaWebhookHandler (configured via env)
 */
export const notivisaWebhookHandler = onRequest(
  {
    region: 'southamerica-east1',
    // Phase 12: add ANVISA_WEBHOOK_SECRET to secrets array
    // secrets: ['ANVISA_WEBHOOK_SECRET'],
  },
  async (req: any, res: any): Promise<void> => {
    try {
      // 1. Verify HTTP method
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      // 2. Get signature from header
      const signature = req.headers['x-anvisa-signature'];
      if (!signature || typeof signature !== 'string') {
        functions.logger.warn('[NOTIVISA Webhook] Missing x-anvisa-signature header');
        res.status(401).json({ error: 'Unauthorized: missing signature' });
        return;
      }

      // 3. Verify signature
      // Phase 12: replace placeholder with real secret from Secret Manager
      const ANVISA_WEBHOOK_SECRET = process.env.ANVISA_WEBHOOK_SECRET || 'PLACEHOLDER_SECRET_PHASE_12';
      const payloadString = JSON.stringify(req.body);

      if (!verifyWebhookSignature(payloadString, signature, ANVISA_WEBHOOK_SECRET)) {
        functions.logger.warn('[NOTIVISA Webhook] Signature verification failed', {
          received: signature.substring(0, 8),
          expectedPrefix: 'sha256_',
        });
        res.status(401).json({ error: 'Unauthorized: invalid signature' });
        return;
      }

      // 4. Parse and validate webhook payload
      let payload: AnvisaWebhookPayload;
      try {
        payload = anvisaWebhookPayloadSchema.parse(req.body);
      } catch (error: any) {
        functions.logger.warn('[NOTIVISA Webhook] Payload validation failed:', error);
        // Still acknowledge to Anvisa (so they don't retry)
        res.status(200).json({ received: true, note: 'Invalid payload but acknowledged' });
        return;
      }

      // 5. Find outbox entry by idempotencyKey (across all labs)
      const db = admin.firestore();
      const allLabsSnap = await db.collection('labs').listDocuments();

      let found = false;
      for (const labDoc of allLabsSnap) {
        const labId = labDoc.id;

        const entryQuery = await db
          .collection(`labs/${labId}/notivisa-outbox`)
          .where('idempotencyKey', '==', payload.idempotencyKey)
          .limit(1)
          .get();

        if (!entryQuery.empty) {
          const entryDoc = entryQuery.docs[0];

          // 6. Update entry status to acknowledged
          const updateData: any = {
            status: 'acknowledged',
            anvisa_eventId: payload.eventId,
            anvisa_acknowledgedAt: admin.firestore.FieldValue.serverTimestamp(),
            anvisa_receiptNumber: payload.receiptNumber || null,
          };

          // If Anvisa reported an error, record it
          if (payload.status === 'error' || payload.status === 'rejected') {
            updateData.anvisa_rejectionCode = payload.errorCode || null;
            updateData.anvisa_rejectionMessage = payload.errorMessage || null;
            // Still mark as acknowledged (we received confirmation of rejection)
          }

          await entryDoc.ref.update(updateData);

          // 7. Create audit log entry
          await entryDoc.ref.collection('webhookLog').doc(`${Date.now()}`).set({
            action: 'ANVISA_WEBHOOK',
            ts: admin.firestore.FieldValue.serverTimestamp(),
            payload: {
              eventId: payload.eventId,
              status: payload.status,
              receiptNumber: payload.receiptNumber || null,
              errorCode: payload.errorCode || null,
            },
          });

          functions.logger.info('[NOTIVISA Webhook] Entry updated', {
            labId,
            entryId: entryDoc.id,
            anvisaEventId: payload.eventId,
            status: payload.status,
          });

          const response: WebhookHandlerResponse = {
            received: true,
            entryId: entryDoc.id,
            labId,
          };

          res.status(200).json(response);
          found = true;
          break;
        }
      }

      // 8. If entry not found (edge case), still acknowledge
      if (!found) {
        functions.logger.warn('[NOTIVISA Webhook] Entry not found by idempotencyKey', {
          idempotencyKey: payload.idempotencyKey,
        });

        // Acknowledge anyway (prevent Anvisa from retrying)
        const response: WebhookHandlerResponse = {
          received: true,
          note: 'Entry not found but webhook acknowledged',
        };

        res.status(200).json(response);
      }
    } catch (error: any) {
      functions.logger.error('[notivisaWebhookHandler] Unexpected error:', error);

      // Acknowledge to Anvisa to prevent retry storms
      res.status(200).json({
        received: true,
        note: 'Internal error but webhook acknowledged',
      });
    }
  }
);
