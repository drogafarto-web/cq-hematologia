/**
 * validators.ts (server — rt-presence module)
 *
 * Guarda de auth/access + schemas Zod para callables do módulo RT Presence.
 *
 * Paridade com turnos supervisorCheckin: mesma forma de `assertAccess`,
 * adaptada pro claim `modules['rt-presence']`.
 *
 * RDC 978/2025 Art. 22 — Responsável Técnico (RT) must be continuously
 * present during critical QC operations.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const RT_PRESENCE_ACCESS_DENIED_MSG =
  'Sem permissão para este módulo — contate o administrador.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Garante (em ordem):
 *   1. Caller autenticado
 *   2. Caller tem claim modules['rt-presence'] === true
 *   3. Caller é membro ativo de labs/{labId}/members/{uid}
 *
 * Falhas viram `permission-denied` com mensagem padronizada + log
 * `[RT_PRESENCE_ACCESS_DENIED]` em Cloud Logging.
 */
export async function assertRtPresenceAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const uid = auth.uid;
  const ts = new Date().toISOString();

  const modulesClaim = (auth.token?.['modules'] ?? {}) as Record<string, unknown>;
  if (modulesClaim['rt-presence'] !== true) {
    console.error('[RT_PRESENCE_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'missing_module_claim',
      ts,
    });
    throw new HttpsError('permission-denied', RT_PRESENCE_ACCESS_DENIED_MSG);
  }

  const memberSnap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${uid}`)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    console.error('[RT_PRESENCE_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_active_member',
      ts,
    });
    throw new HttpsError('permission-denied', RT_PRESENCE_ACCESS_DENIED_MSG);
  }

  // Verify caller has RT role
  const memberRole = memberSnap.data()?.['role'];
  if (memberRole !== 'rt') {
    console.error('[RT_PRESENCE_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_rt_role',
      role: memberRole,
      ts,
    });
    throw new HttpsError(
      'permission-denied',
      'Apenas Responsáveis Técnicos podem gerenciar presença.',
    );
  }
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function rtPresenceLabRoot(db: admin.firestore.Firestore, labId: string) {
  return db.doc(`labs/${labId}`);
}

export function rtPresenceStatusDoc(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.doc(`labs/${labId}/rt-presenca/current`);
}

export function rtPresenceEventsCol(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.collection(`labs/${labId}/rt-presenca-events`);
}

export async function ensureRtPresenceLabRoot(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const ref = rtPresenceLabRoot(db, labId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId }, { merge: true });
  }
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const RtPresenceCheckinInputSchema = z.object({
  labId: z.string().min(1),
});

export type RtPresenceCheckinInput = z.infer<typeof RtPresenceCheckinInputSchema>;

export const RtPresenceCheckoutInputSchema = z.object({
  labId: z.string().min(1),
  sessionId: z.string().min(1),
});

export type RtPresenceCheckoutInput = z.infer<typeof RtPresenceCheckoutInputSchema>;

// ─── Session ID helper ───────────────────────────────────────────────────────

/**
 * Generate a unique session ID for RT check-in.
 * Format: `rt-<labId>-<rtUid>-<timestamp>`
 */
export function generateSessionId(labId: string, rtUid: string, nowMs: number): string {
  return `rt-${labId}-${rtUid}-${nowMs}`;
}

/**
 * Validate session ID format
 */
export function isValidSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === 'string' && sessionId.startsWith('rt-') && sessionId.length > 10;
}
