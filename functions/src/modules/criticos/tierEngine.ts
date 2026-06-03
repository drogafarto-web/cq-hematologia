/**
 * tierEngine — pure functions for 3-tier SLA escalation logic.
 *
 * Task 05-02: Critical Value Detection + SLA Escalation
 * RDC 978 Art. 5.7.1 — critical communication mandatory <60min
 * DICQ 5.7.1 — escalation matrix
 *
 * Tier 1: 0–15min   → contact RT (Responsável Técnico)
 * Tier 2: 15–30min  → contact attending physician
 * Tier 3: 30–60min  → escalate to CTO / Diretor Médico
 *
 * Pure: no Firestore, no Twilio, no SMTP. Trivially unit-testable.
 */

import type { CriticosTierEscalation } from './types';

export type TierNumber = 1 | 2 | 3;

export interface TierConfig {
  tier: TierNumber;
  destinatario: 'RT' | 'MEDICO' | 'CTO' | 'DIRETOR_MEDICO';
  /** Cumulative deadline minutes from detection — NOT per-tier delta. */
  cumulativeDeadlineMin: 15 | 30 | 60;
}

/**
 * Default tier ladder. Cumulative SLAs from detection time.
 *
 * Note: slaMinutos in CriticosTierEscalation is the WINDOW for THIS tier.
 * - Tier 1 has 15min window starting at detection
 * - Tier 2 has 15min window starting at +15min
 * - Tier 3 has 30min window starting at +30min
 * Cumulative ceiling is 60min total per RDC 978.
 */
export const DEFAULT_TIER_LADDER: ReadonlyArray<{
  tier: TierNumber;
  destinatario: 'RT' | 'MEDICO' | 'CTO' | 'DIRETOR_MEDICO';
  windowMin: 15 | 30;
}> = [
  { tier: 1, destinatario: 'RT', windowMin: 15 },
  { tier: 2, destinatario: 'MEDICO', windowMin: 15 },
  { tier: 3, destinatario: 'CTO', windowMin: 30 },
];

/**
 * Determine if a tier has expired given the current time.
 * @param activatedAtMs Tier activation timestamp (ms epoch)
 * @param windowMin Tier SLA window (minutes)
 * @param nowMs Current time (ms epoch)
 */
export function isTierExpired(activatedAtMs: number, windowMin: number, nowMs: number): boolean {
  const deadlineMs = activatedAtMs + windowMin * 60 * 1000;
  return nowMs > deadlineMs;
}

/**
 * Decide what to do next based on the current tier state.
 * Returns 'expire' (close current tier as expired + advance), 'wait' (still in
 * SLA window), or 'done' (terminal — no more tiers to advance to).
 */
export function decideNextTierAction(
  currentTier: TierNumber,
  activatedAtMs: number,
  windowMin: number,
  nowMs: number,
): 'expire' | 'wait' | 'done' {
  if (!isTierExpired(activatedAtMs, windowMin, nowMs)) {
    return 'wait';
  }
  if (currentTier === 3) {
    return 'done';
  }
  return 'expire';
}

/**
 * Compute the minimum SLA target (in minutes) for the *current active* tier.
 * Used by the dashboard to render countdown timers.
 */
export function getActiveTierWindowMs(tier: CriticosTierEscalation): number {
  return tier.slaMinutos * 60 * 1000;
}

/**
 * Compute remaining time (ms) before active tier expires.
 * Returns negative when expired.
 */
export function getRemainingTierMs(
  activatedAtMs: number,
  windowMin: number,
  nowMs: number,
): number {
  const deadlineMs = activatedAtMs + windowMin * 60 * 1000;
  return deadlineMs - nowMs;
}

/**
 * Determine outcome label from the tier on which acknowledgment occurred.
 */
export function outcomeFromAckTier(
  tier: TierNumber,
): 'reconhecido_tier1' | 'reconhecido_tier2' | 'reconhecido_tier3' {
  return `reconhecido_tier${tier}` as const;
}

/**
 * Validate that tier numbers in a tiers[] history are monotonically increasing
 * and have no gaps. Detects corrupt audit trails.
 */
export function isMonotonicTierHistory(tiers: CriticosTierEscalation[]): boolean {
  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].tier !== ((i + 1) as TierNumber)) {
      return false;
    }
  }
  return true;
}

/**
 * Determine the SLA window (minutes) for a given tier from the default ladder.
 */
export function defaultWindowForTier(tier: TierNumber): 15 | 30 {
  const entry = DEFAULT_TIER_LADDER.find((t) => t.tier === tier);
  if (!entry) throw new Error(`Unknown tier ${tier}`);
  return entry.windowMin;
}

/**
 * Determine the destinatario role for a given tier from the default ladder.
 */
export function defaultDestinatarioForTier(
  tier: TierNumber,
): 'RT' | 'MEDICO' | 'CTO' | 'DIRETOR_MEDICO' {
  const entry = DEFAULT_TIER_LADDER.find((t) => t.tier === tier);
  if (!entry) throw new Error(`Unknown tier ${tier}`);
  return entry.destinatario;
}
