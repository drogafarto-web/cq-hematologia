/**
 * thresholdsConfig.ts — Phase 10 (MP-4)
 *
 * Per-lab + per-analito SLA configuration for critical value FSM.
 * Supports default overrides at lab and analito levels.
 */

import {
  collection,
  db,
  doc,
  getDoc,
  setDoc,
  type CollectionReference,
  type DocumentReference,
} from '../../../shared/services/firebase';

/**
 * FSM threshold configuration.
 * slaTargetMs: how long before CRITICO → ALERTADO must occur (default 5 min)
 * autoEscalateAfterMs: how long before cron auto-escalates stale CRITICO cases (default 10 min)
 */
export interface FSMThresholdConfig {
  labId: string;
  slaTargetMs: number;
  autoEscalateAfterMs: number;
  perAnalito?: Record<
    string,
    {
      slaTargetMs?: number;
      autoEscalateAfterMs?: number;
    }
  >;
}

/**
 * Default thresholds for all labs.
 * 5 minutes to alert, 10 minutes for cron escalation.
 */
export const DEFAULT_FSM_THRESHOLD_CONFIG: FSMThresholdConfig = {
  labId: '__default__',
  slaTargetMs: 5 * 60_000, // 5 minutes
  autoEscalateAfterMs: 10 * 60_000, // 10 minutes
  perAnalito: {},
};

// ─── Paths ────────────────────────────────────────────────────────────────

const configCol = (labId: string): CollectionReference =>
  collection(db, 'labs', labId, 'fsm-config');

const configDoc = (labId: string): DocumentReference => doc(configCol(labId), 'main');

// ─── API ───────────────────────────────────────────────────────────────────

/**
 * Get FSM configuration for a lab.
 * Returns merged config (lab-specific overrides + defaults).
 */
export async function getFSMConfig(labId: string): Promise<FSMThresholdConfig> {
  try {
    const snap = await getDoc(configDoc(labId));

    if (!snap.exists()) {
      return {
        ...DEFAULT_FSM_THRESHOLD_CONFIG,
        labId,
      };
    }

    const stored = snap.data() as Partial<FSMThresholdConfig>;

    return {
      labId,
      slaTargetMs: stored.slaTargetMs ?? DEFAULT_FSM_THRESHOLD_CONFIG.slaTargetMs,
      autoEscalateAfterMs:
        stored.autoEscalateAfterMs ?? DEFAULT_FSM_THRESHOLD_CONFIG.autoEscalateAfterMs,
      perAnalito: stored.perAnalito ?? {},
    };
  } catch (err) {
    console.error(`getFSMConfig error for ${labId}:`, err);
    return {
      ...DEFAULT_FSM_THRESHOLD_CONFIG,
      labId,
    };
  }
}

/**
 * Set/update FSM configuration for a lab.
 * Validates that all durations are positive integers ≤ 24h.
 */
export async function setFSMConfig(
  labId: string,
  patch: Partial<Omit<FSMThresholdConfig, 'labId'>>,
): Promise<void> {
  // Validation
  if (patch.slaTargetMs !== undefined) {
    if (!Number.isInteger(patch.slaTargetMs) || patch.slaTargetMs <= 0) {
      throw new Error('slaTargetMs must be a positive integer');
    }
    if (patch.slaTargetMs > 24 * 60 * 60 * 1000) {
      throw new Error('slaTargetMs cannot exceed 24 hours');
    }
  }

  if (patch.autoEscalateAfterMs !== undefined) {
    if (!Number.isInteger(patch.autoEscalateAfterMs) || patch.autoEscalateAfterMs <= 0) {
      throw new Error('autoEscalateAfterMs must be a positive integer');
    }
    if (patch.autoEscalateAfterMs > 24 * 60 * 60 * 1000) {
      throw new Error('autoEscalateAfterMs cannot exceed 24 hours');
    }
  }

  // Validate per-analito overrides
  if (patch.perAnalito) {
    for (const [analitoId, override] of Object.entries(patch.perAnalito)) {
      if (override.slaTargetMs !== undefined) {
        if (!Number.isInteger(override.slaTargetMs) || override.slaTargetMs <= 0) {
          throw new Error(`perAnalito.${analitoId}.slaTargetMs must be a positive integer`);
        }
        if (override.slaTargetMs > 24 * 60 * 60 * 1000) {
          throw new Error(`perAnalito.${analitoId}.slaTargetMs cannot exceed 24 hours`);
        }
      }

      if (override.autoEscalateAfterMs !== undefined) {
        if (!Number.isInteger(override.autoEscalateAfterMs) || override.autoEscalateAfterMs <= 0) {
          throw new Error(`perAnalito.${analitoId}.autoEscalateAfterMs must be a positive integer`);
        }
        if (override.autoEscalateAfterMs > 24 * 60 * 60 * 1000) {
          throw new Error(`perAnalito.${analitoId}.autoEscalateAfterMs cannot exceed 24 hours`);
        }
      }
    }
  }

  await setDoc(configDoc(labId), { ...patch, labId }, { merge: true });
}

/**
 * Resolve effective SLA settings for a specific analito.
 * Checks per-analito overrides first, then base config, then defaults.
 */
export function resolveSLA(
  config: FSMThresholdConfig,
  analitoId: string,
): { slaTargetMs: number; autoEscalateAfterMs: number } {
  const override = config.perAnalito?.[analitoId];

  return {
    slaTargetMs: override?.slaTargetMs ?? config.slaTargetMs,
    autoEscalateAfterMs: override?.autoEscalateAfterMs ?? config.autoEscalateAfterMs,
  };
}
