/**
 * slaFormat — pure helpers for rendering SLA state.
 *
 * RDC 978/2025 Art. 5.7.1: critical communication mandatory <60 min from
 * detection to acknowledgment. The escalation doc carries `sla_minutos_target`
 * (configurable per lab) and a `sla_status` already computed by the backend
 * cron — but the UI also needs a real-time elapsed counter for pending items.
 *
 * Tested independently of the React tree.
 */

import type { CriticosEscalacao } from '../types';

export type SlaKind = 'in_window' | 'warning' | 'expired';

export interface SlaState {
  kind: SlaKind;
  /** Milliseconds since detection. */
  elapsedMs: number;
  /** Target window in ms. */
  targetMs: number;
}

/**
 * Computes the live SLA bucket based on elapsed time since detection.
 * - expired:   elapsed >= target
 * - warning:   elapsed >= 50% of target
 * - in_window: otherwise
 *
 * For escalations already acknowledged, uses `tempo_sla_ms` if present so
 * the modal shows the snapshot of how long it actually took.
 */
export function computeSlaState(
  escalacao: CriticosEscalacao,
  nowMs: number,
): SlaState {
  const target = escalacao.sla_minutos_target * 60 * 1000;
  let elapsed: number;

  if (escalacao.status === 'reconhecido' && escalacao.tempo_sla_ms != null) {
    elapsed = escalacao.tempo_sla_ms;
  } else {
    const startMs = msFromTimestampLike(escalacao.criadoEm);
    elapsed = Math.max(0, nowMs - startMs);
  }

  if (elapsed >= target) return { kind: 'expired', elapsedMs: elapsed, targetMs: target };
  if (elapsed >= target * 0.5)
    return { kind: 'warning', elapsedMs: elapsed, targetMs: target };
  return { kind: 'in_window', elapsedMs: elapsed, targetMs: target };
}

/**
 * Renders "Xm Ys / Tm" — minutes:seconds elapsed vs minutes target.
 * Always tabular-safe: pads seconds to 2 digits.
 */
export function formatSlaCountdown(
  elapsedMs: number,
  targetMinutes: number,
): string {
  const totalSec = Math.floor(elapsedMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${String(sec).padStart(2, '0')}s / ${targetMinutes}m`;
}

/**
 * Accepts either a Firestore Timestamp-like ({ toMillis }), { seconds, nanoseconds },
 * a Date, a number, or undefined. Returns 0 for unknown shapes — we never
 * throw on render path.
 */
function msFromTimestampLike(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    const v = value as {
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') {
      return v.seconds * 1000 + Math.floor((v.nanoseconds ?? 0) / 1_000_000);
    }
  }
  return 0;
}
