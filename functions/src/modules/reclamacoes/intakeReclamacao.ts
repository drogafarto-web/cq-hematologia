/**
 * functions/src/modules/reclamacoes/intakeReclamacao.ts
 *
 * MP-6 (v1.4-final-closure) — Patient-portal complaint intake + RCA Five Whys
 * lifecycle as 6 callables. Lives alongside the Phase-11 `criarReclamacao`
 * (form-rich legacy path) without colliding.
 *
 * Callables exported:
 *   - intakeReclamacao        (anonymous OK; consent gate when identified)
 *   - triageReclamacao        (RT/admin/qualidade)
 *   - startRCAFiveWhys        (RT/admin/qualidade)
 *   - submitRCAAnswer         (RT/admin/qualidade)
 *   - completeRCAFiveWhys     (RT/admin/qualidade — signature required)
 *   - closeReclamacao         (RT/admin/qualidade — links CAPA when provided)
 *
 * Wire format:
 *   - region        : southamerica-east1
 *   - cors          : true
 *   - memory        : 256MiB
 *   - timeoutSeconds: 30
 *
 * Compliance:
 *   - RDC 978 Art. 86 (complaint → CAPA traceability)
 *   - DICQ 4.14.3 / 4.14.6
 *   - LGPD Art. 9/11/13/17 — `description` and `patientContact` NEVER hit Cloud Logs
 *   - RN-06 — no hard delete here (soft-delete admin-only, deferred per spec)
 *   - LogicalSignature: hash 64 hex + operatorId === auth.uid + ts numeric
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// ─── Constants ──────────────────────────────────────────────────────────────

const REGION = 'southamerica-east1';
const CALLABLE_OPTS = {
  region: REGION,
  cors: true,
  memory: '256MiB' as const,
  timeoutSeconds: 30,
};

const ROLES_INTERNAL = new Set(['RT', 'admin', 'owner', 'qualidade']);
const HASH_RE = /^[a-f0-9]{64}$/;

// ─── Shared types (callable wire format) ────────────────────────────────────

type ReclamacaoStatus =
  | 'new'
  | 'triaged'
  | 'rca-in-progress'
  | 'rca-completed'
  | 'capa-linked'
  | 'closed'
  | 'rejected';

type ReclamacaoSeverity = 'low' | 'medium' | 'high' | 'critical';

type ReclamacaoCanal = 'patient-portal' | 'phone' | 'email' | 'in-person' | 'social-media';

interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: number;
}

interface RCAFiveWhysAnswer {
  level: 1 | 2 | 3 | 4 | 5;
  question: string;
  answer: string;
  answeredBy: string;
  answeredAt: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function db(): admin.firestore.Firestore {
  return admin.firestore();
}

function reclamacaoRef(labId: string, id: string) {
  return db().collection('labs').doc(labId).collection('reclamacoes').doc(id);
}

function reclamacaoCollection(labId: string) {
  return db().collection('labs').doc(labId).collection('reclamacoes');
}

function auditLogRef(labId: string) {
  return db().collection('labs').doc(labId).collection('reclamacoes-audit');
}

function requireString(value: unknown, name: string, max = 5000): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpsError('invalid-argument', `${name} required`);
  }
  if (value.length > max) {
    throw new HttpsError('invalid-argument', `${name} too long`);
  }
  return value;
}

function requireLabId(value: unknown): string {
  return requireString(value, 'labId', 200);
}

function requireInternalAuth(authUid: string | undefined, role: unknown): string {
  if (!authUid) {
    throw new HttpsError('unauthenticated', 'auth required');
  }
  if (typeof role !== 'string' || !ROLES_INTERNAL.has(role)) {
    throw new HttpsError('permission-denied', 'internal role required');
  }
  return authUid;
}

function validateSignature(sig: unknown, expectedOperator: string): LogicalSignature {
  if (!sig || typeof sig !== 'object') {
    throw new HttpsError('invalid-argument', 'signature required');
  }
  const s = sig as Record<string, unknown>;
  if (typeof s.hash !== 'string' || !HASH_RE.test(s.hash)) {
    throw new HttpsError('invalid-argument', 'signature.hash must be sha256 hex');
  }
  if (s.operatorId !== expectedOperator) {
    throw new HttpsError('permission-denied', 'signature.operatorId mismatch');
  }
  if (typeof s.ts !== 'number' || !Number.isFinite(s.ts)) {
    throw new HttpsError('invalid-argument', 'signature.ts must be number');
  }
  return { hash: s.hash, operatorId: s.operatorId, ts: s.ts };
}

function logEvent(event: string, fields: Record<string, unknown>): void {
  // LGPD: callers MUST omit `description` / `patientContact` / `answer` /
  // `followUp` from the fields argument. This helper is intentionally dumb
  // about that — the cost of a slip is too high to enforce here generically.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event, ...fields }));
}

async function appendAudit(
  labId: string,
  reclamacaoId: string,
  action: string,
  actorUid: string | null,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await auditLogRef(labId).add({
    labId,
    reclamacaoId,
    action,
    actorUid,
    ts: admin.firestore.FieldValue.serverTimestamp(),
    ...extra,
  });
}

// ─── intakeReclamacao ───────────────────────────────────────────────────────

export const intakeReclamacao = onCall(CALLABLE_OPTS, async (request) => {
  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = requireLabId(data.labId);
  const canal = (data.canal as ReclamacaoCanal) ?? 'patient-portal';
  if (!['patient-portal', 'phone', 'email', 'in-person', 'social-media'].includes(canal)) {
    throw new HttpsError('invalid-argument', 'invalid canal');
  }

  const description = requireString(data.description, 'description', 5000);
  if (description.length < 30) {
    throw new HttpsError('invalid-argument', 'description must be ≥ 30 chars');
  }

  const patientName =
    typeof data.patientName === 'string' && data.patientName.length > 0 ? data.patientName : null;
  const patientContact =
    typeof data.patientContact === 'string' && data.patientContact.length > 0
      ? data.patientContact
      : null;
  const consentToken =
    typeof data.consentToken === 'string' && data.consentToken.length > 0
      ? data.consentToken
      : null;

  if ((patientName || patientContact) && !consentToken) {
    throw new HttpsError(
      'failed-precondition',
      'consentToken required when patient is identified (LGPD Art. 9/11)',
    );
  }

  let signaturePatient: LogicalSignature | undefined;
  if (data.signaturePatient && request.auth?.uid) {
    signaturePatient = validateSignature(data.signaturePatient, request.auth.uid);
  }

  const ref = reclamacaoCollection(labId).doc();
  const now = Date.now();

  await ref.set({
    labId,
    canal,
    status: 'new' satisfies ReclamacaoStatus,
    severity: 'medium' satisfies ReclamacaoSeverity,
    patientName,
    patientContact,
    consentToken,
    description,
    attachments: [],
    signaturePatient: signaturePatient ?? null,
    createdAt: now,
    deletedAt: null,
  });

  await appendAudit(labId, ref.id, 'intake', request.auth?.uid ?? null, {
    canal,
    severity: 'medium',
    identified: !!patientContact,
  });

  logEvent('reclamacao_intake', {
    labId,
    reclamacaoId: ref.id,
    canal,
    identified: !!patientContact,
    actorUid: request.auth?.uid ?? null,
  });

  return { reclamacaoId: ref.id };
});

// ─── triageReclamacao ───────────────────────────────────────────────────────

export const triageReclamacao = onCall(CALLABLE_OPTS, async (request) => {
  const role = request.auth?.token?.role;
  const actor = requireInternalAuth(request.auth?.uid, role);

  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = requireLabId(data.labId);
  const reclamacaoId = requireString(data.reclamacaoId, 'reclamacaoId', 200);
  const severity = data.severity as ReclamacaoSeverity;
  const newStatus = data.status as ReclamacaoStatus;

  if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
    throw new HttpsError('invalid-argument', 'invalid severity');
  }
  if (!['triaged', 'rejected'].includes(newStatus)) {
    throw new HttpsError('invalid-argument', 'status must be triaged|rejected');
  }
  const closingReason = typeof data.closingReason === 'string' ? data.closingReason : null;

  await db().runTransaction(async (tx) => {
    const ref = reclamacaoRef(labId, reclamacaoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'reclamacao not found');
    const current = snap.data() as Record<string, unknown>;
    if (current.status !== 'new') {
      throw new HttpsError(
        'failed-precondition',
        `cannot triage from status ${String(current.status)}`,
      );
    }

    const patch: Record<string, unknown> = {
      status: newStatus,
      severity,
      triagedAt: Date.now(),
      triagedBy: actor,
    };
    if (newStatus === 'rejected' && closingReason) {
      patch.closingReason = closingReason;
      patch.closedAt = Date.now();
      patch.closedBy = actor;
    }
    tx.update(ref, patch);
  });

  await appendAudit(labId, reclamacaoId, 'triage', actor, {
    severity,
    status: newStatus,
  });
  logEvent('reclamacao_triage', {
    labId,
    reclamacaoId,
    severity,
    status: newStatus,
    actorUid: actor,
  });

  return { ok: true };
});

// ─── startRCAFiveWhys ───────────────────────────────────────────────────────

export const startRCAFiveWhys = onCall(CALLABLE_OPTS, async (request) => {
  const role = request.auth?.token?.role;
  const actor = requireInternalAuth(request.auth?.uid, role);

  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = requireLabId(data.labId);
  const reclamacaoId = requireString(data.reclamacaoId, 'reclamacaoId', 200);

  let workflowId = '';
  await db().runTransaction(async (tx) => {
    const ref = reclamacaoRef(labId, reclamacaoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'reclamacao not found');
    const current = snap.data() as Record<string, unknown>;
    if (current.status !== 'triaged') {
      throw new HttpsError(
        'failed-precondition',
        `RCA requires status 'triaged' (got ${String(current.status)})`,
      );
    }
    const sev = current.severity as ReclamacaoSeverity;
    if (!['medium', 'high', 'critical'].includes(sev)) {
      throw new HttpsError(
        'failed-precondition',
        `RCA requires severity ≥ medium (got ${String(sev)})`,
      );
    }

    workflowId = ref.id + '-rca-' + Date.now().toString(36);
    tx.update(ref, {
      status: 'rca-in-progress' satisfies ReclamacaoStatus,
      rca: {
        workflowId,
        startedAt: Date.now(),
        startedBy: actor,
        answers: [],
      },
    });
  });

  await appendAudit(labId, reclamacaoId, 'rca-start', actor, { workflowId });
  logEvent('reclamacao_rca_start', {
    labId,
    reclamacaoId,
    workflowId,
    actorUid: actor,
  });

  return { workflowId };
});

// ─── submitRCAAnswer ────────────────────────────────────────────────────────

export const submitRCAAnswer = onCall(CALLABLE_OPTS, async (request) => {
  const role = request.auth?.token?.role;
  const actor = requireInternalAuth(request.auth?.uid, role);

  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = requireLabId(data.labId);
  const reclamacaoId = requireString(data.reclamacaoId, 'reclamacaoId', 200);
  const level = data.level;
  const question = requireString(data.question, 'question', 1000);
  const answer = requireString(data.answer, 'answer', 5000);

  if (typeof level !== 'number' || ![1, 2, 3, 4, 5].includes(level as number)) {
    throw new HttpsError('invalid-argument', 'level must be 1..5');
  }
  if (answer.length < 10) {
    throw new HttpsError('invalid-argument', 'answer must be ≥ 10 chars');
  }

  await db().runTransaction(async (tx) => {
    const ref = reclamacaoRef(labId, reclamacaoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'reclamacao not found');
    const current = snap.data() as Record<string, unknown>;
    if (current.status !== 'rca-in-progress') {
      throw new HttpsError('failed-precondition', `RCA answer requires status 'rca-in-progress'`);
    }
    const rca = (current.rca ?? {}) as Record<string, unknown>;
    const answers = Array.isArray(rca.answers) ? [...rca.answers] : [];

    // Sequence enforcement: level N can only be answered if level N-1 already
    // exists. Re-answering same level overwrites in-place (idempotent).
    const expected = answers.length + 1;
    const overwriting = answers.find((a) => (a as RCAFiveWhysAnswer).level === level);
    if (!overwriting && level !== expected) {
      throw new HttpsError(
        'failed-precondition',
        `out-of-order RCA answer (expected level ${expected}, got ${level})`,
      );
    }

    const newAnswer: RCAFiveWhysAnswer = {
      level: level as 1 | 2 | 3 | 4 | 5,
      question,
      answer,
      answeredBy: actor,
      answeredAt: Date.now(),
    };
    const updated = overwriting
      ? answers.map((a) => ((a as RCAFiveWhysAnswer).level === level ? newAnswer : a))
      : [...answers, newAnswer];

    tx.update(ref, {
      'rca.answers': updated,
    });
  });

  await appendAudit(labId, reclamacaoId, 'rca-answer', actor, { level });
  logEvent('reclamacao_rca_answer', {
    labId,
    reclamacaoId,
    level,
    actorUid: actor,
  });

  return { ok: true };
});

// ─── completeRCAFiveWhys ────────────────────────────────────────────────────

export const completeRCAFiveWhys = onCall(CALLABLE_OPTS, async (request) => {
  const role = request.auth?.token?.role;
  const actor = requireInternalAuth(request.auth?.uid, role);

  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = requireLabId(data.labId);
  const reclamacaoId = requireString(data.reclamacaoId, 'reclamacaoId', 200);
  const rootCause = requireString(data.rootCause, 'rootCause', 5000);
  if (rootCause.length < 30) {
    throw new HttpsError('invalid-argument', 'rootCause must be ≥ 30 chars');
  }
  const signature = validateSignature(data.signature, actor);

  await db().runTransaction(async (tx) => {
    const ref = reclamacaoRef(labId, reclamacaoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'reclamacao not found');
    const current = snap.data() as Record<string, unknown>;
    if (current.status !== 'rca-in-progress') {
      throw new HttpsError('failed-precondition', `RCA complete requires status 'rca-in-progress'`);
    }
    const rca = (current.rca ?? {}) as Record<string, unknown>;
    const answers = Array.isArray(rca.answers) ? rca.answers : [];
    if (answers.length !== 5) {
      throw new HttpsError(
        'failed-precondition',
        `RCA requires all 5 answers (got ${answers.length})`,
      );
    }

    tx.update(ref, {
      status: 'rca-completed' satisfies ReclamacaoStatus,
      'rca.rootCause': rootCause,
      'rca.completedAt': Date.now(),
      'rca.completedBy': actor,
      'rca.signature': signature,
    });
  });

  await appendAudit(labId, reclamacaoId, 'rca-complete', actor, {
    sigHash: signature.hash.slice(0, 12),
  });
  logEvent('reclamacao_rca_complete', {
    labId,
    reclamacaoId,
    actorUid: actor,
  });

  return { ok: true };
});

// ─── closeReclamacao ────────────────────────────────────────────────────────

export const closeReclamacao = onCall(CALLABLE_OPTS, async (request) => {
  const role = request.auth?.token?.role;
  const actor = requireInternalAuth(request.auth?.uid, role);

  const data = (request.data ?? {}) as Record<string, unknown>;
  const labId = requireLabId(data.labId);
  const reclamacaoId = requireString(data.reclamacaoId, 'reclamacaoId', 200);
  const closingReason = requireString(data.closingReason, 'closingReason', 2000);
  const capaId = typeof data.capaId === 'string' && data.capaId.length > 0 ? data.capaId : null;

  await db().runTransaction(async (tx) => {
    const ref = reclamacaoRef(labId, reclamacaoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'reclamacao not found');
    const current = snap.data() as Record<string, unknown>;
    const cur = current.status as ReclamacaoStatus;
    if (cur !== 'rca-completed' && cur !== 'triaged') {
      throw new HttpsError(
        'failed-precondition',
        `close requires 'rca-completed' or 'triaged' (got ${cur})`,
      );
    }

    const patch: Record<string, unknown> = {
      closingReason,
      closedAt: Date.now(),
      closedBy: actor,
    };

    if (capaId) {
      patch.capaId = capaId;
      patch.status = 'capa-linked' satisfies ReclamacaoStatus;
    } else {
      patch.status = 'closed' satisfies ReclamacaoStatus;
    }

    tx.update(ref, patch);
  });

  await appendAudit(labId, reclamacaoId, 'close', actor, {
    capaLinked: !!capaId,
  });
  logEvent('reclamacao_close', {
    labId,
    reclamacaoId,
    capaLinked: !!capaId,
    actorUid: actor,
  });

  return { ok: true };
});
