/**
 * exportPatientList.ts (server — consents/migration)
 *
 * Cloud Function callable: `consents_exportPatientList`
 *
 * Admin-only callable that exports the full active patient roster of a single
 * lab into a CSV file in Cloud Storage and returns a 24h v4-signed download
 * URL. Used as Phase 1 of the patient-consent backfill plan: operators run
 * this once per lab to obtain a working list of every patient who needs to
 * be contacted for consent capture before the ia-strip consentGate is
 * enabled in production.
 *
 * Why server-side CSV (not client query):
 *   - Consent backfill exposes lists of patient identifiers + email + CPF
 *     for the entire tenant. We do NOT want this hitting the browser as a
 *     Firestore stream (cache, devtools, screenshots). Cloud Storage with a
 *     short-lived signed URL keeps the artefact auditable, time-boxed, and
 *     decoupled from Firestore rules.
 *   - CPF/DOB are kept HASHED in the CSV (sha256 hex). The plaintext stays
 *     in Firestore. The CSV is meant to drive operator outreach; we never
 *     need to print plaintext CPF on a worksheet.
 *   - The current consent state is enriched per row so operators can skip
 *     patients already covered (idempotent runs).
 *
 * Auth: caller must be `owner` or `admin` of the lab. Other roles are
 * rejected even if they belong to the lab.
 *
 * Storage path:
 *   exports/{labId}/consent-backfill/{timestamp}-{requestId}.csv
 *
 * Audit: writes a `consent-backfill-export` event via writeAuditLog including
 * the row count and the storage path. Never includes patient PII in the
 * audit payload itself — only metadata.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { createHash, randomUUID } from 'crypto';

import { writeAuditLog } from '../../../shared/audit/writeAuditLog';

// ─── Schema ──────────────────────────────────────────────────────────────────

const ExportPatientListInputSchema = z.object({
  labId: z.string().min(1, 'labId obrigatório'),
  /**
   * If true, includes patients with `status === 'inactive'` and patients
   * carrying a non-null `deletadoEm`. Defaults to false (active roster only),
   * which is the expected backfill target — the goal is to capture consent
   * for patients who can still receive results.
   */
  includeInactive: z.boolean().optional().default(false),
});

type ExportPatientListInput = z.infer<typeof ExportPatientListInputSchema>;

interface ExportPatientListResult {
  ok: true;
  labId: string;
  rowCount: number;
  storagePath: string;
  downloadUrl: string;
  expiresAt: number; // epoch ms
  generatedAt: number;
  requestId: string;
}

// ─── Auth helper (admin-only) ────────────────────────────────────────────────

async function assertAdminOfLab(
  auth: { uid: string } | undefined,
  labId: string,
  db: admin.firestore.Firestore,
): Promise<{ uid: string; role: string }> {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  const memberSnap = await db.doc(`labs/${labId}/members/${auth.uid}`).get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'Usuário não pertence a este laboratório.');
  }
  const memberData = memberSnap.data() ?? {};
  const role = (memberData['role'] as string | undefined) ?? '';
  const isActive = memberData['active'] === true;
  if (!isActive) {
    throw new HttpsError('permission-denied', 'Usuário inativo.');
  }
  if (role !== 'owner' && role !== 'admin') {
    throw new HttpsError(
      'permission-denied',
      'Apenas owner/admin podem exportar a lista de pacientes para backfill de consentimento.',
    );
  }
  return { uid: auth.uid, role };
}

// ─── CSV serialization ───────────────────────────────────────────────────────

const CSV_HEADERS = [
  'patientId',
  'name',
  'email',
  'cpfHash',
  'dobIso',
  'status',
  'labPatientId',
  'mrn',
  'lisId',
  'createdAtIso',
  'consentExists',
  'consentIaProcessing',
  'consentVersion',
  'consentRevokedAt',
  'consentCapturedAtIso',
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // RFC 4180 — quote if contains comma, quote, CR, or LF
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sha256Hex(value: string | undefined | null): string {
  if (!value) return '';
  return createHash('sha256').update(String(value)).digest('hex');
}

function tsToIso(value: unknown): string {
  if (!value) return '';
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return '';
}

// ─── Callable ────────────────────────────────────────────────────────────────

export const consents_exportPatientList = onCall<unknown, Promise<ExportPatientListResult>>(
  { region: 'southamerica-east1', enforceAppCheck: false, timeoutSeconds: 300 },
  async (request) => {
    const parsed = ExportPatientListInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input: ExportPatientListInput = parsed.data;

    const db = admin.firestore();
    const { uid } = await assertAdminOfLab(request.auth, input.labId, db);

    const requestId = randomUUID();
    const generatedAt = Date.now();

    // 1. Read all patients of the lab.
    const patientsSnap = await db.collection(`labs/${input.labId}/patients`).get();

    const rows: string[] = [];
    rows.push(CSV_HEADERS.join(','));

    let included = 0;

    for (const doc of patientsSnap.docs) {
      const data = doc.data() ?? {};
      const status = (data['status'] as string | undefined) ?? 'active';
      const deletadoEm = data['deletadoEm'];
      const isDeleted = deletadoEm !== null && deletadoEm !== undefined;

      if (!input.includeInactive && (status === 'inactive' || isDeleted)) {
        continue;
      }

      // 2. Lookup current consent state per patient (for idempotency).
      // One read per patient is acceptable here — backfill runs are infrequent
      // (once per lab, once per cutover) and bounded by lab roster size.
      const consentSnap = await db.doc(`consents/${input.labId}/patients/${doc.id}`).get();
      const consent = consentSnap.exists ? (consentSnap.data() ?? {}) : {};

      const identifiers = (data['identifiers'] as Record<string, unknown>) ?? {};

      const row = [
        doc.id,
        (data['name'] as string) ?? (data['nome'] as string) ?? '',
        (data['email'] as string) ?? '',
        sha256Hex((data['cpf'] as string) ?? ''),
        tsToIso(data['dateOfBirth'] ?? data['dataNascimento']),
        status,
        (identifiers['labPatientId'] as string) ?? '',
        (identifiers['mrn'] as string) ?? '',
        (identifiers['lisId'] as string) ?? '',
        tsToIso(data['createdAt'] ?? data['criadoEm']),
        consentSnap.exists ? 'true' : 'false',
        consent['iaProcessing'] === true ? 'true' : 'false',
        (consent['consentVersion'] as string) ?? '',
        tsToIso(consent['revokedAt']),
        tsToIso(consent['consentedAt']),
      ];

      rows.push(row.map(csvEscape).join(','));
      included += 1;
    }

    const csvBody = rows.join('\r\n') + '\r\n';

    // 3. Upload to Cloud Storage.
    const storagePath = `exports/${input.labId}/consent-backfill/${generatedAt}-${requestId}.csv`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    await file.save(csvBody, {
      contentType: 'text/csv; charset=utf-8',
      metadata: {
        cacheControl: 'private, max-age=0, no-store',
        metadata: {
          labId: input.labId,
          requestId,
          requestedBy: uid,
          purpose: 'consent-backfill-export',
          rowCount: String(included),
        },
      },
      resumable: false,
    });

    // 4. Generate v4 signed URL valid for 24h.
    const expiresAt = generatedAt + 24 * 60 * 60 * 1000;
    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });

    // 5. Audit (no PII in payload).
    await writeAuditLog({
      action: 'consent-backfill-export',
      callerUid: uid,
      labId: input.labId,
      payload: {
        requestId,
        storagePath,
        rowCount: included,
        includeInactive: input.includeInactive,
        expiresAtMs: expiresAt,
      },
    });

    return {
      ok: true,
      labId: input.labId,
      rowCount: included,
      storagePath,
      downloadUrl,
      expiresAt,
      generatedAt,
      requestId,
    };
  },
);
