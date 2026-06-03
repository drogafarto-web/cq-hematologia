/**
 * onRiskEventCreated.ts (server — risks module)
 *
 * Firestore trigger: `onDocumentCreated('labs/{labId}/risks/{riskId}/events/{eventId}')`
 *
 * Flow:
 *   1. Triggered when audit event is created
 *   2. Query previous event by ordering on timestamp
 *   3. Compute chainHash = SHA-256(prevChainHash || canonicalEventPayload)
 *   4. Update event with computed chainHash
 *   5. Idempotent (if already has chainHash, skip)
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sha256Hex, sortedStringify } from './signatureCanonical';

interface RiskAuditEvent {
  id: string;
  timestamp: admin.firestore.Timestamp;
  operatorId: string;
  tipo: string;
  changes?: Record<string, unknown>;
  chainHash?: string;
  prevChainHash?: string;
}

export const onRiskEventCreated = onDocumentCreated(
  {
    document: 'labs/{labId}/risks/{riskId}/events/{eventId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const eventData = event.data?.data() as RiskAuditEvent | undefined;
    const eventRef = event.data?.ref;

    if (!eventData || !eventRef) {
      console.error('[RISK_EVENT_ERROR] No data or ref in trigger');
      return;
    }

    // ─── Skip if chainHash already populated ───────────────────────────────

    if (eventData.chainHash) {
      console.log('[RISK_EVENT_SKIP] ChainHash already populated, idempotent');
      return;
    }

    // ─── Query previous event by timestamp ─────────────────────────────────

    const eventsCol = eventRef.parent;
    const previousSnap = await eventsCol
      .orderBy('timestamp', 'desc')
      .startAfter(eventData.timestamp)
      .limit(1)
      .get();

    let prevChainHash: string | null = null;
    if (!previousSnap.empty) {
      const prevEvent = previousSnap.docs[0].data() as any;
      prevChainHash = prevEvent.chainHash || null;
    }

    // ─── Compute chainHash ────────────────────────────────────────────────

    const canonicalPayload = sortedStringify({
      id: eventData.id,
      timestamp: eventData.timestamp.toMillis(),
      operatorId: eventData.operatorId,
      tipo: eventData.tipo,
      changes: eventData.changes ? JSON.stringify(eventData.changes) : '',
    });

    const dataToHash = prevChainHash ? `${prevChainHash}|${canonicalPayload}` : canonicalPayload;

    const chainHash = sha256Hex(dataToHash);

    // ─── Update event with computed chainHash ──────────────────────────────

    await eventRef.update({
      chainHash,
      prevChainHash,
    });

    console.log('[RISK_EVENT_CREATED]', {
      riskId: eventRef.parent.parent?.id,
      eventId: eventData.id,
      tipo: eventData.tipo,
      chainHash: chainHash.substring(0, 8) + '...',
    });
  },
);
