/**
 * validators.ts (server — criticos-config module)
 *
 * Auth guard + Zod schemas for critical values threshold configuration.
 * Mirrors risks/turnos pattern. Follows DL-1: server is authoritative for
 * audit fields, signature, and ID. Client supplies only domain payload.
 *
 * Compliance: RDC 978/2025 Art. 167 (laudo critical values), DICQ 5.7.1,
 * ISO 15189:2022 §7.4.1.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const CRITICOS_CONFIG_ACCESS_DENIED_MSG =
  'Sem permissão para configurar valores críticos — contate o administrador.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Read access: any active member of the lab (read-only on the threshold list).
 *
 * Why: callers need to query thresholds during laudo flow without an
 * elevated claim. Write paths apply additional role checks.
 */
export async function assertCriticosConfigReadAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const memberSnap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${auth.uid}`)
    .get();

  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    console.error('[CRITICOS_CONFIG_ACCESS_DENIED]', {
      uid: auth.uid,
      labId,
      reason: 'not_active_member',
      ts: new Date().toISOString(),
    });
    throw new HttpsError('permission-denied', CRITICOS_CONFIG_ACCESS_DENIED_MSG);
  }
}

/**
 * Write access: must be active member AND role in { 'admin', 'owner', 'rt' }.
 *
 * RT (Responsável Técnico) is the regulator-recognized role responsible for
 * defining critical value thresholds (RDC 978/2025 Art. 167). Admin/owner
 * may also configure for operational reasons.
 */
export async function assertCriticosConfigWriteAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<{ uid: string; role: string }> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const memberSnap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${auth.uid}`)
    .get();

  const data = memberSnap.data();
  if (!memberSnap.exists || data?.['active'] !== true) {
    console.error('[CRITICOS_CONFIG_ACCESS_DENIED]', {
      uid: auth.uid,
      labId,
      reason: 'not_active_member',
      ts: new Date().toISOString(),
    });
    throw new HttpsError('permission-denied', CRITICOS_CONFIG_ACCESS_DENIED_MSG);
  }

  const role = String(data?.['role'] ?? '');
  if (!['admin', 'owner', 'rt'].includes(role)) {
    console.error('[CRITICOS_CONFIG_ACCESS_DENIED]', {
      uid: auth.uid,
      labId,
      reason: 'role_not_authorized',
      role,
      ts: new Date().toISOString(),
    });
    throw new HttpsError(
      'permission-denied',
      'Apenas RT, Admin ou Owner podem configurar valores críticos.',
    );
  }

  return { uid: auth.uid, role };
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function criticosConfigCollection(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.collection(`critical-thresholds/${labId}/items`);
}

export async function ensureCriticosConfigLabRoot(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const ref = db.doc(`critical-thresholds/${labId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId }, { merge: true });
  }
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const SexSchema = z.enum(['M', 'F', 'ALL']);

/**
 * Age group buckets — chosen to align with NHANES + standard pediatric
 * labs reference intervals. ALL means thresholds apply regardless of age.
 */
const AgeGroupSchema = z.enum([
  'ALL',
  'NEONATE',     // 0–28 days
  'INFANT',      // 29 days – 1 year
  'CHILD',       // 1–11 years
  'ADOLESCENT',  // 12–17 years
  'ADULT',       // 18–64 years
  'ELDERLY',     // 65+
]);

/** Reasonable bounds for clinical chemistry. Server rejects payloads outside. */
const ThresholdValueSchema = z
  .number()
  .finite()
  .min(-1_000_000)
  .max(1_000_000);

/** Unit string — short, no whitespace at edges. e.g. "mg/dL", "mmol/L". */
const UnitSchema = z
  .string()
  .min(1, 'Unidade obrigatória')
  .max(32, 'Unidade longa demais (máx 32)')
  .regex(/^[^\s].*[^\s]$|^\S$/, 'Unidade não pode começar/terminar com espaço');

/**
 * Cross-field validation:
 *   panicLow ≤ lowThreshold ≤ highThreshold ≤ panicHigh
 * (with the relaxation that any field may be omitted; only the present
 * relations are checked)
 */
function validateBounds<
  T extends {
    lowThreshold?: number;
    highThreshold?: number;
    panicLow?: number;
    panicHigh?: number;
  },
>(input: T, ctx: z.RefinementCtx): void {
  const { lowThreshold: low, highThreshold: high, panicLow: pLow, panicHigh: pHigh } = input;

  if (low !== undefined && high !== undefined && low > high) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'lowThreshold deve ser ≤ highThreshold.',
      path: ['lowThreshold'],
    });
  }
  if (pLow !== undefined && low !== undefined && pLow > low) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'panicLow deve ser ≤ lowThreshold.',
      path: ['panicLow'],
    });
  }
  if (pHigh !== undefined && high !== undefined && pHigh < high) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'panicHigh deve ser ≥ highThreshold.',
      path: ['panicHigh'],
    });
  }
  if (pLow !== undefined && pHigh !== undefined && pLow > pHigh) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'panicLow deve ser ≤ panicHigh.',
      path: ['panicLow'],
    });
  }

  // At least ONE bound must be present — empty thresholds make no sense.
  if (low === undefined && high === undefined && pLow === undefined && pHigh === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Defina pelo menos um limite (low, high, panicLow ou panicHigh).',
      path: ['lowThreshold'],
    });
  }
}

export const CreateThresholdInputSchema = z
  .object({
    labId: z.string().min(1),
    analyteId: z
      .string()
      .min(1, 'analyteId obrigatório')
      .max(64, 'analyteId longo demais (máx 64)')
      .regex(/^[A-Za-z0-9_-]+$/, 'analyteId aceita apenas [A-Za-z0-9_-]'),
    analyteName: z.string().min(1).max(120),
    lowThreshold: ThresholdValueSchema.optional(),
    highThreshold: ThresholdValueSchema.optional(),
    panicLow: ThresholdValueSchema.optional(),
    panicHigh: ThresholdValueSchema.optional(),
    unit: UnitSchema,
    ageGroup: AgeGroupSchema.default('ALL'),
    sex: SexSchema.default('ALL'),
    notas: z.string().max(500).optional(),
  })
  .superRefine(validateBounds);

export type CreateThresholdInput = z.infer<typeof CreateThresholdInputSchema>;

export const UpdateThresholdInputSchema = z
  .object({
    labId: z.string().min(1),
    thresholdId: z.string().min(1),
    lowThreshold: ThresholdValueSchema.nullable().optional(),
    highThreshold: ThresholdValueSchema.nullable().optional(),
    panicLow: ThresholdValueSchema.nullable().optional(),
    panicHigh: ThresholdValueSchema.nullable().optional(),
    unit: UnitSchema.optional(),
    notas: z.string().max(500).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    // For update, treat null/undefined as "no change". Build a snapshot
    // of provided numeric values and re-validate bounds among them.
    const provided: {
      lowThreshold?: number;
      highThreshold?: number;
      panicLow?: number;
      panicHigh?: number;
    } = {};
    if (typeof input.lowThreshold === 'number') provided.lowThreshold = input.lowThreshold;
    if (typeof input.highThreshold === 'number') provided.highThreshold = input.highThreshold;
    if (typeof input.panicLow === 'number') provided.panicLow = input.panicLow;
    if (typeof input.panicHigh === 'number') provided.panicHigh = input.panicHigh;

    if (Object.keys(provided).length > 0) {
      validateBounds(provided, ctx);
    }
  });

export type UpdateThresholdInput = z.infer<typeof UpdateThresholdInputSchema>;

export const GetThresholdsInputSchema = z.object({
  labId: z.string().min(1),
  analyteId: z.string().min(1).max(64).optional(),
  ageGroup: AgeGroupSchema.optional(),
  sex: SexSchema.optional(),
  includeDeleted: z.boolean().optional().default(false),
});

export type GetThresholdsInput = z.infer<typeof GetThresholdsInputSchema>;
