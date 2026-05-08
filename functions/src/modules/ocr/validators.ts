/**
 * validators.ts (server — ocr)
 *
 * Access control + path helpers for OCR Yumizen H550 callable.
 *
 * Pattern aligned with `notivisa/validators.ts`:
 *   - assertOcrAccess: lab membership check (no module claim — OCR is part of
 *     the analyzer module which is open to all active members of the lab).
 *   - Path helpers for extractions, audit, daily counter.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const OCR_ACCESS_DENIED_MSG =
  'Sem permissão para o módulo do analisador — contate o administrador.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Garante (em ordem):
 *   1. Caller autenticado.
 *   2. Caller é membro ativo de `labs/{labId}/members/{uid}`.
 *
 * Diferente do NOTIVISA, OCR não exige claim de módulo: o analyzer é
 * disponibilizado a todos os membros ativos do lab por padrão (RDC 978
 * Art. 122 — competência delegada via cargo, não via módulo opt-in).
 */
export async function assertOcrAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const uid = auth.uid;
  const ts = new Date().toISOString();

  const memberSnap = await admin.firestore().doc(`labs/${labId}/members/${uid}`).get();
  const memberData = memberSnap.data();
  const isActive =
    memberSnap.exists &&
    (memberData?.['active'] === true || memberData?.['status'] === 'active');

  if (!isActive) {
    console.error('[OCR_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_active_member',
      ts,
    });
    throw new HttpsError('permission-denied', OCR_ACCESS_DENIED_MSG);
  }
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function ocrExtractionsCol(db: admin.firestore.Firestore, labId: string) {
  return db.collection(`ocr-extractions/${labId}/items`);
}

export function ocrAuditCol(db: admin.firestore.Firestore, labId: string) {
  return db.collection(`ocr-extractions/${labId}/auditLog`);
}

export function ocrLabRoot(db: admin.firestore.Firestore, labId: string) {
  return db.doc(`ocr-extractions/${labId}`);
}

export async function ensureOcrLabRoot(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const ref = ocrLabRoot(db, labId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId });
  }
}

// ─── Cost guardrail ──────────────────────────────────────────────────────────

/**
 * Daily counter doc path. Reset implicitly by date key (`YYYY-MM-DD`); old
 * docs are not deleted (kept for monthly billing audit).
 */
export function ocrDailyCounterDoc(
  db: admin.firestore.Firestore,
  labId: string,
  dateKey: string,
) {
  return db.doc(`ocr-extractions/${labId}/rate-limits/day-${dateKey}`);
}

/** Returns `YYYY-MM-DD` in São Paulo time (lab-local). */
export function todayKeySaoPaulo(now: Date = new Date()): string {
  // São Paulo is UTC-3 year-round (no DST since 2019).
  const offsetMs = -3 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Hard ceiling per lab per day. Sized for ~3 shifts × 30 runs × headroom.
 * Override per-lab via `ocr-extractions/{labId}.dailyLimitOverride` in
 * future; currently a deploy-time constant.
 */
export const OCR_DAILY_LIMIT_PER_LAB = 100;

/**
 * Atomically reserves one slot in today's quota. Throws `resource-exhausted`
 * if the lab already burned through its daily allowance. Uses a transaction
 * so concurrent callers cannot oversubscribe past the ceiling.
 */
export async function reserveDailyOcrSlot(
  db: admin.firestore.Firestore,
  labId: string,
  dateKey: string,
): Promise<{ count: number; limit: number }> {
  const ref = ocrDailyCounterDoc(db, labId, dateKey);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? Number(snap.data()?.['count'] ?? 0) : 0) || 0;

    if (current >= OCR_DAILY_LIMIT_PER_LAB) {
      throw new HttpsError(
        'resource-exhausted',
        `Limite diário de ${OCR_DAILY_LIMIT_PER_LAB} extrações OCR atingido para este laboratório. Tente novamente amanhã ou contate o administrador para revisão de cota.`,
      );
    }

    const next = current + 1;
    if (snap.exists) {
      tx.update(ref, {
        count: next,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(ref, {
        labId,
        dateKey,
        count: next,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { count: next, limit: OCR_DAILY_LIMIT_PER_LAB };
  });
}

// ─── Idempotency hash ────────────────────────────────────────────────────────

import { createHash } from 'crypto';

/**
 * Idempotency key = `sha256(labId + ':' + base64)`. Identical image uploaded
 * twice by the same lab returns the cached extraction without re-billing
 * Gemini. Cross-tenant re-runs are intentionally NOT deduplicated — different
 * labs may legitimately scan the same control image.
 */
export function imageHashFor(labId: string, base64: string): string {
  return createHash('sha256').update(`${labId}:${base64}`).digest('hex');
}
