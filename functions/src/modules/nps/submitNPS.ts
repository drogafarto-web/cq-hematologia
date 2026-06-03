/**
 * functions/src/modules/nps/submitNPS.ts
 *
 * MP-6 (v1.4-final-closure) — NPS submission + cycle aggregation callables.
 *
 * Anonymous-OK by design: a respondent can submit without auth, but a
 * `patientToken` (device-bound) enforces idempotency (1 submission per cycle).
 *
 * Compliance:
 *   - DICQ 4.14.4 + LGPD Art. 7/9/11/13 (consent base + transparency)
 *   - `followUp` is NEVER logged (may contain personal feedback / PII)
 *
 * Wire format:
 *   - region        : southamerica-east1
 *   - cors          : true
 *   - memory        : 256MiB
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const REGION = 'southamerica-east1';
const CALLABLE_OPTS = {
  region: REGION,
  cors: true,
  memory: '256MiB' as const,
  timeoutSeconds: 30,
};

const ROLES_INTERNAL = new Set(['RT', 'admin', 'owner', 'qualidade']);

type NPSCategory = 'detractor' | 'passive' | 'promoter';

function classify(score: number): NPSCategory {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
}

function db(): admin.firestore.Firestore {
  return admin.firestore();
}

function cycleRoot(labId: string, cycleId: string) {
  return db().collection('labs').doc(labId).collection('nps').doc('cycles').collection(cycleId);
}

function responsesCollection(labId: string, cycleId: string) {
  return cycleRoot(labId, cycleId).doc('responses').collection('items');
}

function summaryDoc(labId: string, cycleId: string) {
  return cycleRoot(labId, cycleId).doc('summary');
}

function logEvent(event: string, fields: Record<string, unknown>): void {
  // LGPD: never include `followUp` in fields.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event, ...fields }));
}

// ─── submitNPS ──────────────────────────────────────────────────────────────

export const submitNPS = onCall(CALLABLE_OPTS, async (request) => {
  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = String(data.labId ?? '');
  const cycleId = String(data.cycleId ?? '');
  if (!labId || !cycleId) {
    throw new HttpsError('invalid-argument', 'labId + cycleId required');
  }

  const score = Number(data.score);
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    throw new HttpsError('invalid-argument', 'score must be integer 0..10');
  }

  const followUp =
    typeof data.followUp === 'string' && data.followUp.length > 0 ? data.followUp : null;
  if (score <= 6 && (!followUp || followUp.length < 10)) {
    throw new HttpsError('invalid-argument', 'followUp required (≥ 10 chars) when score ≤ 6');
  }
  if (followUp && followUp.length > 5000) {
    throw new HttpsError('invalid-argument', 'followUp too long');
  }

  const consentToken =
    typeof data.consentToken === 'string' && data.consentToken.length > 0
      ? data.consentToken
      : null;
  const patientToken =
    typeof data.patientToken === 'string' && data.patientToken.length > 0
      ? data.patientToken
      : null;

  // Idempotency by patientToken (anonymous, device-bound).
  if (patientToken) {
    const existing = await responsesCollection(labId, cycleId)
      .where('patientToken', '==', patientToken)
      .where('deletedAt', '==', null)
      .limit(1)
      .get();
    if (!existing.empty) {
      const id = existing.docs[0].id;
      logEvent('nps_submit_idempotent', {
        labId,
        cycleId,
        responseId: id,
      });
      return { responseId: id };
    }
  }

  const category = classify(score);
  const ref = responsesCollection(labId, cycleId).doc();
  const now = Date.now();

  await ref.set({
    labId,
    cycleId,
    score,
    category,
    followUp,
    consentToken,
    patientToken,
    submittedAt: now,
    deletedAt: null,
  });

  logEvent('nps_submitted', {
    labId,
    cycleId,
    responseId: ref.id,
    score,
    category,
    identified: !!consentToken,
  });

  return { responseId: ref.id };
});

// ─── aggregateNPSCycle ──────────────────────────────────────────────────────

export const aggregateNPSCycle = onCall(CALLABLE_OPTS, async (request) => {
  const role = request.auth?.token?.role;
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'auth required');
  }
  if (typeof role !== 'string' || !ROLES_INTERNAL.has(role)) {
    throw new HttpsError('permission-denied', 'internal role required');
  }

  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = String(data.labId ?? '');
  const cycleId = String(data.cycleId ?? '');
  if (!labId || !cycleId) {
    throw new HttpsError('invalid-argument', 'labId + cycleId required');
  }

  const snap = await responsesCollection(labId, cycleId).where('deletedAt', '==', null).get();

  let total = 0;
  let detractors = 0;
  let passives = 0;
  let promoters = 0;
  let scoreSum = 0;

  snap.forEach((d) => {
    const v = d.data();
    const score = Number(v.score ?? -1);
    if (!Number.isFinite(score) || score < 0 || score > 10) return;
    total += 1;
    scoreSum += score;
    const c = classify(score);
    if (c === 'detractor') detractors += 1;
    else if (c === 'passive') passives += 1;
    else promoters += 1;
  });

  const npsValue =
    total === 0
      ? 0
      : Math.round(((promoters / total) * 100 - (detractors / total) * 100) * 10) / 10;
  const averageScore = total === 0 ? 0 : Math.round((scoreSum / total) * 100) / 100;

  const summary = {
    cycleId,
    totalResponses: total,
    averageScore,
    npsValue,
    detractors,
    passives,
    promoters,
    lastUpdatedAt: Date.now(),
  };

  await summaryDoc(labId, cycleId).collection('summary').doc('current').set(summary);

  logEvent('nps_cycle_aggregated', {
    labId,
    cycleId,
    total,
    npsValue,
    actorUid: request.auth.uid,
  });

  return { summary };
});
