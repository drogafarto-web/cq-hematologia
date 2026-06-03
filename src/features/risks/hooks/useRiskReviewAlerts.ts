/**
 * useRiskReviewAlerts — riscos com revisão vencida ou nos próximos 7 dias.
 *
 * Usa `reviewSchedule.proximaRevisao` quando existir; senão `reviewDate`
 * (paridade com CF `risks_alertRiskReviews`).
 */

import { useEffect, useMemo, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { subscribeRisks } from '../services/risksService';
import type { Risk } from '../types/Risk';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;

type RiskWithSchedule = Risk & {
  reviewSchedule?: { proximaRevisao?: Timestamp | null };
};

function getProximaRevisaoMillis(r: Risk): number | null {
  const ext = r as RiskWithSchedule;
  const pr = ext.reviewSchedule?.proximaRevisao;
  if (pr != null && typeof pr.toMillis === 'function') {
    return pr.toMillis();
  }
  const rd = r.reviewDate;
  if (rd != null && typeof rd.toMillis === 'function') {
    return rd.toMillis();
  }
  return null;
}

export interface UseRiskReviewAlertsResult {
  readonly vencidas: Risk[];
  readonly prestes: Risk[];
  readonly count: number;
  readonly loading: boolean;
  readonly error: Error | null;
}

export function useRiskReviewAlerts(labId: string | null | undefined): UseRiskReviewAlertsResult {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setRisks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = subscribeRisks(
      labId,
      { includeDeleted: false },
      (next) => {
        setRisks(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsub();
    };
  }, [labId]);

  const { vencidas, prestes, count } = useMemo(() => {
    const now = Date.now();
    const horizon = now + WINDOW_DAYS * DAY_MS;
    const v: Risk[] = [];
    const p: Risk[] = [];

    for (const r of risks) {
      if (r.status === 'fechado') continue;
      const prox = getProximaRevisaoMillis(r);
      if (prox == null) continue;
      if (prox < now) {
        v.push(r);
      } else if (prox < horizon) {
        p.push(r);
      }
    }

    return {
      vencidas: v,
      prestes: p,
      count: v.length + p.length,
    };
  }, [risks]);

  return { vencidas, prestes, count, loading, error };
}
