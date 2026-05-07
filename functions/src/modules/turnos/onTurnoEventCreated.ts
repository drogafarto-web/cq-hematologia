/**
 * onTurnoEventCreated — Firestore trigger (v2)
 *
 * Triggered when a new audit event is written to `/labs/{labId}/turnos/{turnoId}/events/{eventId}`.
 *
 * Computes `chainHash = SHA-256(prevChainHash || canonicalEventPayload)` and
 * persists back to the event doc. Ensures tamper-evidence via RN-TURNO-05
 * (continuidade de chainHash no audit trail).
 *
 * Similar to controle-temperatura/onLeituraCreated or educacao-continuada triggers.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

interface AuditEvent {
  tipo: string;
  operadorId: string;
  timestamp: admin.firestore.Timestamp;
  mudancas?: any;
  chainHashAnterior?: string | null;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const onTurnoEventCreated = onDocumentCreated(
  'labs/{labId}/turnos/{turnoId}/events/{eventId}',
  async (event) => {
    const db = admin.firestore();
    const { labId, turnoId, eventId } = event.params;

    // Get the newly created event
    const eventDocRef = db.doc(`labs/${labId}/turnos/${turnoId}/events/${eventId}`);
    const eventSnap = await eventDocRef.get();

    if (!eventSnap.exists) {
      console.warn(`[TURNO_EVENT] Event doc does not exist: ${eventId}`);
      return;
    }

    const eventData = eventSnap.data() as AuditEvent & Record<string, any>;

    // Query for previous event (by timestamp DESC, skip current)
    const eventsCol = db.collection(`labs/${labId}/turnos/${turnoId}/events`);
    const prevQuery = eventsCol
      .orderBy('timestamp', 'desc')
      .limit(2); // Get 2 to skip the one we just created

    const prevSnaps = await prevQuery.get();
    let prevChainHash: string | null = null;

    if (prevSnaps.size >= 2) {
      // Second doc is the previous one
      const prevEventData = prevSnaps.docs[1].data();
      prevChainHash = (prevEventData['chainHash'] as string) || null;
    }

    // Build canonical payload for this event
    const canonicalPayload = {
      tipo: eventData.tipo,
      operadorId: eventData.operadorId,
      tsMillis: eventData.timestamp.toMillis(),
      ...(eventData.mudancas && { mudancas: eventData.mudancas }),
    };

    const canonicalStr = JSON.stringify(canonicalPayload);
    const eventPayloadHash = sha256Hex(canonicalStr);

    // Compute chainHash: hash of (prevChainHash || eventPayloadHash)
    const chainInput = prevChainHash
      ? `${prevChainHash}::${eventPayloadHash}`
      : eventPayloadHash;
    const chainHash = sha256Hex(chainInput);

    // Update the event doc with chainHash
    await eventDocRef.update({
      chainHash,
      chainHashAnterior: prevChainHash,
    });

    console.log(`[TURNO_EVENT] chainHash computed: ${eventId} -> ${chainHash.substring(0, 8)}...`);
  },
);
