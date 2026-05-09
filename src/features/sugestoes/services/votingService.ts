/**
 * src/features/sugestoes/services/votingService.ts
 *
 * MP-6 (v1.4-final-closure) — Read-only client for ranked sugestões + per-user
 * vote state. Writes happen exclusively through `voteSugestao` /
 * `recomputeSugestaoRank` callables (1-user-1-vote enforced server-side).
 *
 * Multi-tenant paths:
 *   labs/{labId}/sugestoes/{sugestaoId}                  — suggestion master
 *   labs/{labId}/sugestoes/{sugestaoId}/votes/{uid}      — per-user vote (uid == doc id)
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { Sugestao } from './sugestaoService';

export type VoteDirection = 'up' | 'down' | 'cleared';

export interface SugestaoWithUserVote extends Sugestao {
  userVote: VoteDirection;
}

/**
 * Realtime subscription to a lab's sugestões ordered by score desc, then
 * createdAt desc. For each row, the current user's vote direction is fetched
 * once per snapshot and joined client-side. Soft-deleted suggestions are
 * dropped.
 *
 * Score field: callable maintains `votos` (int) on the master doc — same field
 * used by the legacy `sugestaoService`. Treats the value as the canonical score.
 */
export function subscribeSugestoesRanked(
  labId: string,
  uid: string,
  onChange: (rows: SugestaoWithUserVote[]) => void,
): () => void {
  const q = query(
    collection(db, 'labs', labId, 'sugestoes'),
    where('labId', '==', labId),
    where('deletadoEm', '==', null),
    orderBy('votos', 'desc'),
    orderBy('criadoEm', 'desc'),
  );

  let active = true;

  const unsubscribe = onSnapshot(q, async (snap) => {
    if (!active) return;
    const baseRows = snap.docs.map((d) => {
      const data = d.data() as DocumentData;
      return {
        id: d.id,
        ...data,
      } as Sugestao;
    });

    const votes = await Promise.all(
      baseRows.map(async (row) => {
        try {
          const voteRef = doc(
            db,
            'labs',
            labId,
            'sugestoes',
            row.id,
            'votes',
            uid,
          );
          const voteSnap = await getDoc(voteRef);
          if (!voteSnap.exists()) return 'cleared' as VoteDirection;
          const v = voteSnap.data() as DocumentData;
          if (v.deletedAt) return 'cleared' as VoteDirection;
          const dir = v.direction;
          if (dir === 'up' || dir === 'down') return dir;
          return 'cleared' as VoteDirection;
        } catch {
          return 'cleared' as VoteDirection;
        }
      }),
    );

    if (!active) return;
    onChange(
      baseRows.map((row, i) => ({
        ...row,
        userVote: votes[i],
      })),
    );
  });

  return () => {
    active = false;
    unsubscribe();
  };
}

// ─── Internals ──────────────────────────────────────────────────────────────

// `toMs` retained for callers that need to massage `criadoEm` Timestamps
// alongside the joined vote state. Not used internally yet — exported as a
// no-op convenience.
export function timestampToMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as Timestamp).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  return 0;
}
