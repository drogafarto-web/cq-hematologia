/**
 * validators.ts (server — turnos module)
 *
 * Guarda de auth/access + schemas Zod para callables do módulo Turnos.
 *
 * Paridade com educacao-continuada: mesma forma de `assertEcAccess`,
 * adaptada pro claim `modules['turnos']`.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const TURNOS_ACCESS_DENIED_MSG =
  'Sem permissão para este módulo — contate o administrador.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Garante (em ordem):
 *   1. Caller autenticado
 *   2. Caller tem claim modules['turnos'] === true
 *   3. Caller é membro ativo de labs/{labId}/members/{uid}
 *
 * Falhas viram `permission-denied` com mensagem padronizada + log
 * `[TURNOS_ACCESS_DENIED]` em Cloud Logging.
 */
export async function assertTurnosAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const uid = auth.uid;
  const ts = new Date().toISOString();

  const modulesClaim = (auth.token?.['modules'] ?? {}) as Record<string, unknown>;
  if (modulesClaim['turnos'] !== true) {
    console.error('[TURNOS_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'missing_module_claim',
      ts,
    });
    throw new HttpsError('permission-denied', TURNOS_ACCESS_DENIED_MSG);
  }

  const memberSnap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${uid}`)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    console.error('[TURNOS_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_active_member',
      ts,
    });
    throw new HttpsError('permission-denied', TURNOS_ACCESS_DENIED_MSG);
  }
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function turnosLabRoot(db: admin.firestore.Firestore, labId: string) {
  return db.doc(`labs/${labId}`);
}

export function turnosCollection(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.collection(`labs/${labId}/turnos`);
}

export async function ensureTurnosLabRoot(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const ref = turnosLabRoot(db, labId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId }, { merge: true });
  }
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const PeriodoSchema = z.enum(['manha', 'tarde', 'noite', 'plantao']);

export const CreateTurnoInputSchema = z.object({
  labId: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date validation
  periodo: PeriodoSchema,
  supervisorId: z.string().min(1),
  observacoes: z.string().max(500).optional().nullable(),
});

export type CreateTurnoInput = z.infer<typeof CreateTurnoInputSchema>;

export const UpdateTurnoInputSchema = z.object({
  labId: z.string().min(1),
  turnoId: z.string().min(1),
  observacoes: z.string().max(500).optional().nullable(),
  supervisorName: z.string().optional(),
});

export type UpdateTurnoInput = z.infer<typeof UpdateTurnoInputSchema>;

export const SoftDeleteTurnoInputSchema = z.object({
  labId: z.string().min(1),
  turnoId: z.string().min(1),
});

export type SoftDeleteTurnoInput = z.infer<typeof SoftDeleteTurnoInputSchema>;

export const Backfill90DaysInputSchema = z.object({
  labId: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
});

export type Backfill90DaysInput = z.infer<typeof Backfill90DaysInputSchema>;
