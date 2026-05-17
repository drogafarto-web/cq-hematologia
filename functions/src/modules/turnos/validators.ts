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

export function escalasCollection(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.collection(`personnel/${labId}/escalas`);
}

export function escalaPadraoDoc(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.doc(`labs/${labId}/turnos-config/escala-padrao`);
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
const PeriodoEscalaSchema = z.enum(['manha', 'tarde', 'noite', 'integral', 'plantao']);

const EscalaColaboradorSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  cargo: z.string().min(1),
});

export const CreateEscalaInputSchema = z.object({
  labId: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodo: PeriodoEscalaSchema,
  colaboradores: z.array(EscalaColaboradorSchema).default([]),
  rtPresente: z.boolean(),
  rtSubstitutoPresente: z.boolean(),
  observacoes: z.string().max(500).optional().nullable(),
});

export type CreateEscalaInput = z.infer<typeof CreateEscalaInputSchema>;

export const UpdateEscalaInputSchema = z.object({
  labId: z.string().min(1),
  escalaId: z.string().min(1),
  periodo: PeriodoEscalaSchema.optional(),
  colaboradores: z.array(EscalaColaboradorSchema).optional(),
  rtPresente: z.boolean().optional(),
  rtSubstitutoPresente: z.boolean().optional(),
  observacoes: z.string().max(500).optional().nullable(),
});

export type UpdateEscalaInput = z.infer<typeof UpdateEscalaInputSchema>;

export const SoftDeleteEscalaInputSchema = z.object({
  labId: z.string().min(1),
  escalaId: z.string().min(1),
});

export type SoftDeleteEscalaInput = z.infer<typeof SoftDeleteEscalaInputSchema>;

export const SaveEscalaPadraoInputSchema = z.object({
  labId: z.string().min(1),
  diasAtivos: z.array(z.number().int().min(0).max(6)),
  turnos: z.array(z.object({
    periodo: PeriodoEscalaSchema,
    colaboradores: z.array(EscalaColaboradorSchema),
    rtPresente: z.boolean(),
    rtSubstitutoPresente: z.boolean(),
  })),
});

export type SaveEscalaPadraoInput = z.infer<typeof SaveEscalaPadraoInputSchema>;

export const ApplyEscalaPadraoInputSchema = z.object({
  labId: z.string().min(1),
  weekStartISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ApplyEscalaPadraoInput = z.infer<typeof ApplyEscalaPadraoInputSchema>;

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

// ─── Presença schemas (Phase 5 Wave 0 — RDC 978 Art. 122) ───────────────────

export const SupervisorCheckinInputSchema = z.object({
  labId: z.string().min(1),
  turnoId: z.string().min(1),
  supervisorUid: z.string().min(1),
  pin: z.string().regex(/^\d{4,6}$/).optional().nullable(),
});

export type SupervisorCheckinInput = z.infer<typeof SupervisorCheckinInputSchema>;

export const SupervisorCheckoutInputSchema = z.object({
  labId: z.string().min(1),
  turnoId: z.string().min(1),
});

export type SupervisorCheckoutInput = z.infer<typeof SupervisorCheckoutInputSchema>;

export const DesignateSubstituteInputSchema = z.object({
  labId: z.string().min(1),
  turnoId: z.string().min(1),
  substituteUid: z.string().min(1),
  reason: z.string().min(10).max(500),
});

export type DesignateSubstituteInput = z.infer<typeof DesignateSubstituteInputSchema>;

// ─── Presença path helpers ──────────────────────────────────────────────────

export function presencaDoc(
  db: admin.firestore.Firestore,
  labId: string,
  turnoId: string,
) {
  return db.doc(`labs/${labId}/turnos/${turnoId}/presenca/current`);
}

export function presencaEventsCol(
  db: admin.firestore.Firestore,
  labId: string,
  turnoId: string,
) {
  return db.collection(`labs/${labId}/turnos/${turnoId}/presenca-events`);
}

export function labSupervisorStatusDoc(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.doc(`labs/${labId}/supervisor-status/current`);
}

// ─── Periodo → janela horária (defaults configuráveis por lab no futuro) ────

interface PeriodoWindow {
  startH: number;
  endH: number;
}

export const PERIODO_WINDOWS: Record<string, PeriodoWindow> = {
  manha: { startH: 6, endH: 12 },
  tarde: { startH: 12, endH: 18 },
  noite: { startH: 18, endH: 24 },
  plantao: { startH: 0, endH: 24 },
};

/**
 * Computa início e fim planejados do turno (em ms epoch UTC) a partir
 * de `data` (ISO YYYY-MM-DD) + `periodo`. Assume timezone do lab = America/Sao_Paulo.
 */
export function computeTurnoWindow(
  data: string,
  periodo: string,
): { inicioMs: number; fimMs: number } {
  const window = PERIODO_WINDOWS[periodo];
  if (!window) {
    throw new HttpsError('invalid-argument', `Período desconhecido: ${periodo}`);
  }
  // Treat as America/Sao_Paulo (UTC-3, no DST since 2019). Backfilled with sufficient
  // accuracy for window calculation; not used for legal/audit timestamps.
  const [y, m, d] = data.split('-').map(Number);
  const inicio = Date.UTC(y, m - 1, d, window.startH + 3, 0, 0);
  const fim = Date.UTC(y, m - 1, d, window.endH + 3, 0, 0);
  return { inicioMs: inicio, fimMs: fim };
}
