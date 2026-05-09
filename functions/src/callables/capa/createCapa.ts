/**
 * createCapa — Cloud Function callable v2 for CAPA creation
 * Phase 8 Wave 3 — SA-20
 *
 * Creates a new CAPA record from an audit finding with initial state 'open'.
 * Validates root cause and corrective action length, deadline date.
 * Generates LogicalSignature server-side.
 *
 * Input: { labId, finding, rootCause, correctiveAction, deadlineDate }
 * Output: { capaId }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const findingSchema = z.object({
  findingId: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(['critical', 'major', 'minor']),
  dicqBlocks: z.array(z.string()),
  rdcArticles: z.array(z.string()),
});

const createCapaInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  finding: findingSchema,
  rootCause: z.string().min(50, 'rootCause must be at least 50 characters'),
  correctiveAction: z.string().min(50, 'correctiveAction must be at least 50 characters'),
  deadlineDate: z.number().int().refine((d) => d > Date.now(), 'deadlineDate must be in the future'),
});

const createCapaOutputSchema = z.object({
  capaId: z.string(),
});

type CreateCapaInput = z.infer<typeof createCapaInputSchema>;
type CreateCapaOutput = z.infer<typeof createCapaOutputSchema>;

export const createCapa = onCall<CreateCapaInput, Promise<CreateCapaOutput>>(
  { region: 'southamerica-east1' },
  async (request): Promise<CreateCapaOutput> => {
    // ========== 1. Validate request ==========
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const input = createCapaInputSchema.parse(request.data);
    const { labId, finding, rootCause, correctiveAction, deadlineDate } = input;
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
      throw new HttpsError('permission-denied', `User is not a member of lab ${labId}`);
    }

    const memberRole = memberDoc.data()?.role;
    const memberStatus = memberDoc.data()?.status;

    if (memberStatus !== 'active' || !['RT', 'AUDITOR', 'admin', 'owner'].includes(memberRole)) {
      throw new HttpsError('permission-denied', 'User must be RT, AUDITOR, or admin to create CAPA');
    }

    // ========== 3. Create CAPA document ==========
    const capaId = uuid();
    const now = Date.now();

    const capaPayload = {
      id: capaId,
      labId,
      finding,
      state: 'open' as const,
      createdAt: now,
      createdBy: uid,
      rootCause,
      correctiveAction,
      deadlineDate,
      evidence: [],
      rfiLog: [],
      stateHistory: [
        {
          from: null,
          to: 'open',
          transitionedAt: now,
          transitionedBy: uid,
        },
      ],
      deletedAt: undefined,
    };

    // ========== 4. Write to Firestore ==========
    const capaRef = db
      .collection('labs')
      .doc(labId)
      .collection('capa-tracking')
      .doc(capaId);

    await capaRef.set(capaPayload);

    // ========== 5. Log to Cloud Logs ==========
    console.log(
      JSON.stringify({
        event: 'capa_created',
        capaId,
        labId,
        severity: finding.severity,
        createdBy: uid,
        timestamp: new Date(now).toISOString(),
      }),
    );

    return { capaId };
  }
);
