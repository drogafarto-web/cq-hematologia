/**
 * batchRecordConsent.ts (server — consents/migration)
 *
 * Cloud Function callable: `consents_batchRecordConsent`
 *
 * Admin-only callable that ingests a batch of patient consents captured on
 * paper and uploaded as scanned PDFs to Cloud Storage. For each entry we:
 *   1. Validate the entry (patientId, signedDocUrl, capturedBy timestamps).
 *   2. Confirm the patient exists in `/labs/{labId}/patients/{patientId}`.
 *   3. Confirm the signed-doc Storage object exists (defense-in-depth — the
 *      operator can lie about the URL but Storage doesn't).
 *   4. Upsert `consents/{labId}/patients/{patientId}` matching the contract
 *      enforced by `recordPatientConsent` (Wave 2 Agent 2). We deliberately
 *      do NOT call that callable internally — the contract is shared via
 *      `validators.ts` (RecordConsentInputSchema, consentDocRef,
 *      ensureConsentsLabRoot) so both flows write the same shape.
 *   5. Append a `paperTrail` array entry on the consent doc carrying
 *      capturedAt + capturedBy + signedDocPath + signedDocBucket. This
 *      preserves the chain of custody for the paper TCLE form, which the
 *      regulator can request at audit.
 *   6. Write a `consent-batch-captured` event via writeAuditLog.
 *
 * Result: per-entry success/failure breakdown. The callable never throws on
 * partial failure — it reports each row so the operator can fix and retry
 * just the rejected rows.
 *
 * Auth: caller must be `owner` or `admin` of the lab.
 *
 * Bounds: max 200 entries per call (keeps total work under the function
 * timeout and bounds the audit volume per call).
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import { writeAuditLog } from '../../../shared/audit/writeAuditLog';
import { ConsentScopeSchema, consentDocRef, ensureConsentsLabRoot } from '../validators';

// ─── Schema ──────────────────────────────────────────────────────────────────

const ConsentVersionSchema = z
  .string()
  .min(1, 'consentVersion obrigatório')
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/, 'consentVersion aceita apenas [A-Za-z0-9._-]');

const BatchEntrySchema = z.object({
  patientId: z.string().min(1).max(120),
  /**
   * ISO-8601 timestamp of when the patient physically signed the paper TCLE.
   * Stored on the doc as a Firestore Timestamp via Date conversion.
   */
  consentedAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)),
  /**
   * UID of the operator who collected the form (typed in by the admin doing
   * the batch upload). Validated to be an active member of the lab.
   */
  capturedBy: z.string().min(1).max(128),
  /**
   * Storage path of the signed scan, format:
   *   labs/{labId}/consent-paper-trail/{patientId}/{filename}.pdf
   * Bucket defaults to the project's default bucket.
   */
  signedDocPath: z.string().min(1).max(512),
  signedDocBucket: z.string().min(1).max(256).optional(),
  consentVersion: ConsentVersionSchema.optional(),
  scope: z.array(ConsentScopeSchema).min(1).optional(),
  notes: z.string().max(500).optional(),
});

const BatchRecordConsentInputSchema = z.object({
  labId: z.string().min(1, 'labId obrigatório'),
  /** Default consentVersion applied when an entry omits it. */
  defaultConsentVersion: ConsentVersionSchema.default('lgpd-v1'),
  /** Default scope applied when an entry omits it. */
  defaultScope: z.array(ConsentScopeSchema).min(1).default(['ia-strip']),
  entries: z
    .array(BatchEntrySchema)
    .min(1, 'entries não pode ser vazio')
    .max(200, 'máximo 200 entries por chamada'),
});

type BatchEntry = z.infer<typeof BatchEntrySchema>;
type BatchRecordConsentInput = z.infer<typeof BatchRecordConsentInputSchema>;

interface BatchEntryResult {
  patientId: string;
  ok: boolean;
  code?:
    | 'patient-not-found'
    | 'patient-deleted'
    | 'captured-by-not-member'
    | 'signed-doc-missing'
    | 'invalid-consented-at'
    | 'write-failed';
  error?: string;
}

interface BatchRecordConsentResult {
  ok: true;
  labId: string;
  requestId: string;
  attempted: number;
  succeeded: number;
  failed: number;
  results: BatchEntryResult[];
}

// ─── Auth (admin-only) ───────────────────────────────────────────────────────

async function assertAdminOfLab(
  auth: { uid: string } | undefined,
  labId: string,
  db: admin.firestore.Firestore,
): Promise<{ uid: string }> {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  const memberSnap = await db.doc(`labs/${labId}/members/${auth.uid}`).get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'Usuário não pertence a este laboratório.');
  }
  const data = memberSnap.data() ?? {};
  if (data['active'] !== true) {
    throw new HttpsError('permission-denied', 'Usuário inativo.');
  }
  const role = data['role'] as string | undefined;
  if (role !== 'owner' && role !== 'admin') {
    throw new HttpsError(
      'permission-denied',
      'Apenas owner/admin podem executar batch de consentimento.',
    );
  }
  return { uid: auth.uid };
}

// ─── Per-entry processor ─────────────────────────────────────────────────────

async function processEntry(
  db: admin.firestore.Firestore,
  bucket: ReturnType<typeof admin.storage>['bucket'] extends () => infer B ? B : never,
  labId: string,
  entry: BatchEntry,
  defaults: { consentVersion: string; scope: string[] },
  callerUid: string,
): Promise<BatchEntryResult> {
  // 1. Patient exists + not soft-deleted.
  const patientSnap = await db.doc(`labs/${labId}/patients/${entry.patientId}`).get();
  if (!patientSnap.exists) {
    return { patientId: entry.patientId, ok: false, code: 'patient-not-found' };
  }
  const patientData = patientSnap.data() ?? {};
  if (patientData['deletadoEm']) {
    return { patientId: entry.patientId, ok: false, code: 'patient-deleted' };
  }

  // 2. capturedBy is an active member.
  const capturedBySnap = await db.doc(`labs/${labId}/members/${entry.capturedBy}`).get();
  if (!capturedBySnap.exists || capturedBySnap.data()?.['active'] !== true) {
    return {
      patientId: entry.patientId,
      ok: false,
      code: 'captured-by-not-member',
    };
  }

  // 3. consentedAt parses to a real Date in the past or present.
  const consentedAtDate = new Date(entry.consentedAt);
  if (Number.isNaN(consentedAtDate.getTime())) {
    return { patientId: entry.patientId, ok: false, code: 'invalid-consented-at' };
  }
  // Allow up to 5 minutes of clock skew toward the future; reject anything beyond.
  if (consentedAtDate.getTime() > Date.now() + 5 * 60 * 1000) {
    return { patientId: entry.patientId, ok: false, code: 'invalid-consented-at' };
  }

  // 4. Signed-doc actually exists in Storage.
  const file = bucket.file(entry.signedDocPath);
  try {
    const [exists] = await file.exists();
    if (!exists) {
      return { patientId: entry.patientId, ok: false, code: 'signed-doc-missing' };
    }
  } catch (err: any) {
    return {
      patientId: entry.patientId,
      ok: false,
      code: 'signed-doc-missing',
      error: err?.message,
    };
  }

  // 5. Upsert consent doc — same shape as recordPatientConsent.
  const ref = consentDocRef(db, labId, entry.patientId);
  const existingSnap = await ref.get();
  const existingScope = (existingSnap.data()?.['scope'] as string[] | undefined) ?? [];
  const entryScope = entry.scope ?? defaults.scope;
  const mergedScope = Array.from(new Set([...existingScope, ...entryScope]));

  const existingPaperTrail =
    (existingSnap.data()?.['paperTrail'] as Array<Record<string, unknown>> | undefined) ?? [];

  const consentedAtTs = admin.firestore.Timestamp.fromDate(consentedAtDate);

  const paperTrailEntry = {
    capturedAt: consentedAtTs,
    capturedBy: entry.capturedBy,
    signedDocPath: entry.signedDocPath,
    signedDocBucket: entry.signedDocBucket ?? bucket.name,
    consentVersion: entry.consentVersion ?? defaults.consentVersion,
    scope: entryScope,
    source: 'batch-backfill',
    notes: entry.notes ?? null,
    recordedBy: callerUid,
    recordedAt: admin.firestore.Timestamp.now(),
  };

  const docPayload = {
    labId,
    patientId: entry.patientId,
    iaProcessing: true,
    consentedAt: consentedAtTs,
    consentVersion: entry.consentVersion ?? defaults.consentVersion,
    capturedBy: entry.capturedBy,
    revokedAt: null,
    scope: mergedScope,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    paperTrail: [...existingPaperTrail, paperTrailEntry],
    source: existingSnap.exists
      ? (existingSnap.data()?.['source'] ?? 'batch-backfill')
      : 'batch-backfill',
  };

  try {
    await ref.set(docPayload, { merge: true });
  } catch (err: any) {
    return {
      patientId: entry.patientId,
      ok: false,
      code: 'write-failed',
      error: err?.message ?? 'unknown',
    };
  }

  return { patientId: entry.patientId, ok: true };
}

// ─── Callable ────────────────────────────────────────────────────────────────

export const consents_batchRecordConsent = onCall<unknown, Promise<BatchRecordConsentResult>>(
  { region: 'southamerica-east1', enforceAppCheck: false, timeoutSeconds: 540 },
  async (request) => {
    const parsed = BatchRecordConsentInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input: BatchRecordConsentInput = parsed.data;

    const db = admin.firestore();
    const { uid } = await assertAdminOfLab(request.auth, input.labId, db);

    await ensureConsentsLabRoot(db, input.labId);

    const bucket = admin.storage().bucket();
    const requestId = randomUUID();

    const defaults = {
      consentVersion: input.defaultConsentVersion,
      scope: input.defaultScope,
    };

    // Sequential execution: prevents thundering-herd writes against the same
    // patient doc when an operator ships duplicate entries by mistake, and
    // keeps Firestore + Storage read costs predictable for audit.
    const results: BatchEntryResult[] = [];
    for (const entry of input.entries) {
      // Per-entry try/catch — never let a single bad row poison the batch.
      try {
        const result = await processEntry(db, bucket, input.labId, entry, defaults, uid);
        results.push(result);
      } catch (err: any) {
        results.push({
          patientId: entry.patientId,
          ok: false,
          code: 'write-failed',
          error: err?.message ?? 'unhandled',
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    await writeAuditLog({
      action: 'consent-batch-captured',
      callerUid: uid,
      labId: input.labId,
      payload: {
        requestId,
        attempted: results.length,
        succeeded,
        failed,
        defaultConsentVersion: defaults.consentVersion,
        defaultScope: defaults.scope,
        // No PII — only patientIds + outcome codes.
        outcomes: results.map((r) => ({
          patientId: r.patientId,
          ok: r.ok,
          code: r.code ?? null,
        })),
      },
    });

    return {
      ok: true,
      labId: input.labId,
      requestId,
      attempted: results.length,
      succeeded,
      failed,
      results,
    };
  },
);
