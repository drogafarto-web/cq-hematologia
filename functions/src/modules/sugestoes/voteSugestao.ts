/**
 * functions/src/modules/sugestoes/voteSugestao.ts
 *
 * MP-6 (v1.4-final-closure) — Per-user vote callable + admin recompute.
 * Sits beside the legacy `upvoteSugestao` (which only increments) and adds
 * directional voting (up / down / cleared) with strict 1-user-1-item fairness.
 *
 * Fairness invariants (CRITICAL — Threat: vote stuffing):
 *   - Per-user vote document path: labs/{labId}/sugestoes/{id}/votes/{uid}
 *     (uid == doc id enforces 1 vote per user)
 *   - Server-side transaction reads `votes/{uid}` before mutating `votos`
 *     (master doc score). Never trusts client-supplied delta.
 *   - Idempotent: same direction twice = no-op.
 *   - 'cleared' soft-deletes the vote subdoc and reverts the score.
 *   - All votes audit-logged (uid included for forensics).
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

type VoteDirection = 'up' | 'down' | 'cleared';

function db(): admin.firestore.Firestore {
  return admin.firestore();
}

function logEvent(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event, ...fields }));
}

function deltaFor(prev: VoteDirection, next: VoteDirection): number {
  // Map each (prev → next) combination to score delta.
  // up/down/cleared each contributes +1 / -1 / 0 to the score.
  const value = (d: VoteDirection): number => (d === 'up' ? 1 : d === 'down' ? -1 : 0);
  return value(next) - value(prev);
}

// ─── voteSugestao ───────────────────────────────────────────────────────────

export const voteSugestao = onCall(CALLABLE_OPTS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'auth required');
  }
  const uid = request.auth.uid;

  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = String(data.labId ?? '');
  const sugestaoId = String(data.sugestaoId ?? '');
  const direction = data.direction as VoteDirection;

  if (!labId || !sugestaoId) {
    throw new HttpsError('invalid-argument', 'labId + sugestaoId required');
  }
  if (!['up', 'down', 'cleared'].includes(direction)) {
    throw new HttpsError('invalid-argument', 'direction must be up|down|cleared');
  }

  const sugestaoRef = db().collection('labs').doc(labId).collection('sugestoes').doc(sugestaoId);
  const voteRef = sugestaoRef.collection('votes').doc(uid);

  const result = await db().runTransaction(async (tx) => {
    const sugestaoSnap = await tx.get(sugestaoRef);
    if (!sugestaoSnap.exists) {
      throw new HttpsError('not-found', 'sugestao not found');
    }
    const sugestao = sugestaoSnap.data() as Record<string, unknown>;
    if (sugestao.deletadoEm) {
      throw new HttpsError('not-found', 'sugestao soft-deleted');
    }

    const voteSnap = await tx.get(voteRef);
    let prev: VoteDirection = 'cleared';
    if (voteSnap.exists) {
      const v = voteSnap.data() as Record<string, unknown>;
      if (!v.deletedAt) {
        const d = v.direction;
        if (d === 'up' || d === 'down') prev = d;
      }
    }

    // Idempotent same-direction = no-op.
    if (prev === direction) {
      return {
        newScore: Number(sugestao.votos ?? 0),
        userVote: direction,
        noOp: true,
      };
    }

    const delta = deltaFor(prev, direction);
    const currentScore = Number(sugestao.votos ?? 0);
    const newScore = currentScore + delta;

    if (direction === 'cleared') {
      // Soft-delete vote doc (RN-06).
      tx.set(
        voteRef,
        {
          uid,
          direction: 'cleared',
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } else {
      tx.set(
        voteRef,
        {
          uid,
          direction,
          deletedAt: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    tx.update(sugestaoRef, {
      votos: admin.firestore.FieldValue.increment(delta),
    });

    return { newScore, userVote: direction, noOp: false };
  });

  logEvent('sugestao_vote', {
    labId,
    sugestaoId,
    direction,
    uid,
    noOp: result.noOp,
  });

  return { newScore: result.newScore, userVote: result.userVote };
});

// ─── recomputeSugestaoRank ──────────────────────────────────────────────────

const ROLES_INTERNAL = new Set(['RT', 'admin', 'owner', 'qualidade']);

export const recomputeSugestaoRank = onCall(CALLABLE_OPTS, async (request) => {
  const role = request.auth?.token?.role;
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'auth required');
  }
  if (typeof role !== 'string' || !ROLES_INTERNAL.has(role)) {
    throw new HttpsError('permission-denied', 'admin role required');
  }

  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = String(data.labId ?? '');
  const sugestaoId =
    typeof data.sugestaoId === 'string' && data.sugestaoId.length > 0 ? data.sugestaoId : null;
  if (!labId) {
    throw new HttpsError('invalid-argument', 'labId required');
  }

  const sugCol = db().collection('labs').doc(labId).collection('sugestoes');

  const targets = sugestaoId
    ? [await sugCol.doc(sugestaoId).get()].filter((d) => d.exists)
    : (await sugCol.where('deletadoEm', '==', null).get()).docs;

  let updated = 0;
  for (const sd of targets) {
    const id = sd.id;
    const votesSnap = await sugCol.doc(id).collection('votes').where('deletedAt', '==', null).get();
    let score = 0;
    votesSnap.forEach((vd) => {
      const v = vd.data() as Record<string, unknown>;
      if (v.direction === 'up') score += 1;
      else if (v.direction === 'down') score -= 1;
    });
    await sugCol.doc(id).update({ votos: score });
    updated += 1;
  }

  logEvent('sugestao_rank_recomputed', {
    labId,
    sugestaoId,
    updated,
    actorUid: request.auth.uid,
  });

  return { updated };
});
