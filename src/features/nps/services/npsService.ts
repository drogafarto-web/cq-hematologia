/**
 * src/features/nps/services/npsService.ts
 *
 * MP-6 (v1.4-final-closure) — NPS thin client (read-only). Writes happen
 * exclusively through `submitNPS` / `aggregateNPSCycle` callables.
 *
 * Multi-tenant paths:
 *   labs/{labId}/nps/cycles/{cycleId}/summary             — single doc
 *   labs/{labId}/nps/cycles/{cycleId}/responses/{respId}  — append-only
 */

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import {
  classifyNPSScore,
  type NPSCycleSummary,
  type NPSResponse,
} from '../types';

export function subscribeNPSCycle(
  labId: string,
  cycleId: string,
  onChange: (s: NPSCycleSummary) => void,
): () => void {
  const ref = doc(
    db,
    'labs',
    labId,
    'nps',
    'cycles',
    cycleId,
    'summary',
    'current',
  );
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      onChange(emptySummary(cycleId));
      return;
    }
    const data = snap.data() as DocumentData;
    onChange({
      cycleId,
      totalResponses: Number(data.totalResponses ?? 0),
      averageScore: Number(data.averageScore ?? 0),
      npsValue: Number(data.npsValue ?? 0),
      detractors: Number(data.detractors ?? 0),
      passives: Number(data.passives ?? 0),
      promoters: Number(data.promoters ?? 0),
      lastUpdatedAt: toMs(data.lastUpdatedAt),
    });
  });
}

export async function getNPSResponses(
  labId: string,
  cycleId: string,
): Promise<NPSResponse[]> {
  const q = query(
    collection(db, 'labs', labId, 'nps', 'cycles', cycleId, 'responses'),
    where('deletedAt', '==', null),
    orderBy('submittedAt', 'desc'),
  );
  const snap = await getDocs(q);
  const out: NPSResponse[] = [];
  snap.forEach((d) => {
    const data = d.data() as DocumentData;
    out.push({
      id: d.id,
      labId: String(data.labId ?? labId),
      score: Number(data.score ?? 0),
      category:
        (data.category as NPSResponse['category']) ??
        classifyNPSScore(Number(data.score ?? 0)),
      followUp: data.followUp ?? undefined,
      consentToken: data.consentToken ?? undefined,
      patientToken: data.patientToken ?? undefined,
      cycleId: String(data.cycleId ?? cycleId),
      submittedAt: toMs(data.submittedAt),
      deletedAt: data.deletedAt ? toMs(data.deletedAt) : undefined,
    });
  });
  return out;
}

// ─── Internals ──────────────────────────────────────────────────────────────

function toMs(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as Timestamp).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  return 0;
}

function emptySummary(cycleId: string): NPSCycleSummary {
  return {
    cycleId,
    totalResponses: 0,
    averageScore: 0,
    npsValue: 0,
    detractors: 0,
    passives: 0,
    promoters: 0,
    lastUpdatedAt: 0,
  };
}
