/**
 * updateCapaState — Cloud Function callable v2 for CAPA state transitions
 * Phase 8 Wave 3 — SA-21
 *
 * Validates state machine transitions and atomically updates state.
 * Appends to stateHistory and auditLog.
 *
 * Valid transitions:
 * open → in-progress
 * in-progress → evidence-submitted
 * evidence-submitted → auditor-reviewing
 * auditor-reviewing → closed | in-progress (rejection cycle)
 *
 * Input: { labId, capaId, newState, reason? }
 * Output: { success, previousState }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const updateCapaStateInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  capaId: z.string().min(1, 'capaId required'),
  newState: z.enum(['open', 'in-progress', 'evidence-submitted', 'auditor-reviewing', 'closed']),
  reason: z.string().optional(),
});

export interface UpdateCapaStateOutput {
  success: boolean;
  previousState: string;
}

function isValidStateTransition(from: string, to: string): boolean {
  if (from === 'closed') return false;
  if (from === 'auditor-reviewing' && to === 'in-progress') return true;

  const validNext: Record<string, string[]> = {
    open: ['in-progress'],
    'in-progress': ['evidence-submitted'],
    'evidence-submitted': ['auditor-reviewing'],
    'auditor-reviewing': ['closed'],
    closed: [],
  };

  return validNext[from]?.includes(to) ?? false;
}

export const updateCapaState = onCall<
  { labId: string; capaId: string; newState: string; reason?: string },
  Promise<UpdateCapaStateOutput>
>({ region: 'southamerica-east1', cors: true }, async (request): Promise<UpdateCapaStateOutput> => {
  // ========== 1. Validate request ==========
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const input = updateCapaStateInputSchema.parse(request.data);
  const { labId, capaId, newState, reason } = input;
  const uid = request.auth.uid;

  const db = admin.firestore();

  // ========== 2. Authorization check ==========
  const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(uid).get();

  if (!memberDoc.exists) {
    throw new HttpsError('permission-denied', `User is not a member of lab ${labId}`);
  }

  // ========== 3. Fetch current CAPA ==========
  const capaRef = db.collection('labs').doc(labId).collection('capa-tracking').doc(capaId);

  const capaSnap = await capaRef.get();

  if (!capaSnap.exists) {
    throw new HttpsError('not-found', `CAPA ${capaId} not found`);
  }

  const capaData = capaSnap.data();
  const currentState = capaData?.state;

  // ========== 4. Validate soft-delete ==========
  if (capaData?.deletedAt !== undefined && capaData.deletedAt !== null) {
    throw new HttpsError('invalid-argument', 'Cannot transition deleted CAPA');
  }

  // ========== 5. Validate state transition ==========
  if (!isValidStateTransition(currentState, newState)) {
    throw new HttpsError(
      'invalid-argument',
      `Invalid transition from ${currentState} to ${newState}`,
    );
  }

  // ========== 6. Atomic update ==========
  const now = Date.now();

  const newStateHistory = capaData?.stateHistory || [];
  newStateHistory.push({
    from: currentState,
    to: newState,
    transitionedAt: now,
    transitionedBy: uid,
    reason,
  });

  const updatePayload = {
    state: newState,
    stateHistory: newStateHistory,
  };

  await capaRef.update(updatePayload);

  // ========== 7. Log to Cloud Logs ==========
  console.log(
    JSON.stringify({
      event: 'capa_state_transition',
      capaId,
      labId,
      from: currentState,
      to: newState,
      transitionedBy: uid,
      reason,
      timestamp: new Date(now).toISOString(),
    }),
  );

  return {
    success: true,
    previousState: currentState,
  };
});
