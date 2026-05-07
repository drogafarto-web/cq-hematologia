/**
 * turnos_updateTurno — callable for updating supervisor shift (post-creation edits).
 *
 * Allowed edits:
 *   - `observacoes` (notes)
 *   - `supervisorName` (post-backfill correction flow only)
 *
 * All other fields (data, periodo, supervisorId) require delete + recreate flow.
 *
 * Generates new signature and appends audit event with `mudancas` diff.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import { generateTurnosSignatureServer } from './signatureCanonical';
import {
  assertTurnosAccess,
  turnosCollection,
  UpdateTurnoInputSchema,
} from './validators';

interface UpdateTurnoResult {
  ok: true;
}

export const turnos_updateTurno = onCall<unknown, Promise<UpdateTurnoResult>>(
  {},
  async (request) => {
    const parsed = UpdateTurnoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertTurnosAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    const turnosCol = turnosCollection(db, input.labId);
    const turnoRef = turnosCol.doc(input.turnoId);
    const turnoSnap = await turnoRef.get();

    if (!turnoSnap.exists) {
      throw new HttpsError('not-found', 'Turno não encontrado.');
    }

    const turnoData = turnoSnap.data()!;

    // Build update payload (only editable fields)
    const updatePayload: Record<string, any> = {};
    const mudancas: Array<{
      campo: string;
      anterior: string | null;
      novo: string | null;
    }> = [];

    if (input.observacoes !== undefined) {
      const anterior = (turnoData['observacoes'] as string | null) || null;
      const novo = input.observacoes || null;
      if (anterior !== novo) {
        updatePayload['observacoes'] = novo;
        mudancas.push({
          campo: 'observacoes',
          anterior,
          novo: novo ? novo.substring(0, 50) : null, // Truncate for audit clarity
        });
      }
    }

    if (input.supervisorName !== undefined) {
      const anterior = (turnoData['supervisorName'] as string) || null;
      const novo = input.supervisorName || null;
      if (anterior !== novo) {
        updatePayload['supervisorName'] = novo;
        mudancas.push({
          campo: 'supervisorName',
          anterior,
          novo,
        });
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      // No changes
      return { ok: true };
    }

    // Regenerate signature with updated fields
    const nowTs = admin.firestore.Timestamp.now();
    const signaturePayload = {
      data: turnoData['data'] as string,
      periodo: turnoData['periodo'] as string,
      supervisorId: turnoData['supervisorId'] as string,
      supervisorName: updatePayload['supervisorName'] ?? turnoData['supervisorName'],
      supervisorCRBM: turnoData['supervisorCRBM'] as string,
    };

    const newSignature = generateTurnosSignatureServer(uid, signaturePayload);

    // Append audit event
    const auditEventRef = turnoRef.collection('events').doc();
    const auditEvent = {
      tipo: 'updated',
      operadorId: uid,
      timestamp: nowTs,
      mudancas,
      chainHash: '', // Will be computed by trigger
      chainHashAnterior: null,
    };

    const batch = db.batch();
    batch.update(turnoRef, {
      ...updatePayload,
      logicalSignature: newSignature,
    });
    batch.set(auditEventRef, auditEvent);
    await batch.commit();

    return { ok: true };
  },
);
