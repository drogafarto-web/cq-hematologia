/**
 * exportOutbox.ts — Auditor-only CSV export of NOTIVISA outbox archives.
 *
 * Wave 2 Agent 10 — test-mode lifecycle. Reads
 * `notivisa-outbox/{labId}/archives` filtered by date range, serialises
 * to CSV, uploads to Cloud Storage under `notivisa-exports/{labId}/...`,
 * stamps `exportedBy` on each archived doc (one-time), and returns a
 * signed download URL valid for 15 minutes.
 *
 * Restriction: caller must have `request.auth.token.role === 'AUDITOR'`
 * AND active membership in the lab. Anyone else is rejected with
 * `permission-denied` regardless of module claim.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import { assertNotivisaAccess } from './validators';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

const ExportOutboxInputSchema = z.object({
  labId: z.string().min(1),
  rangeStartMs: z.number().int().positive().optional(),
  rangeEndMs: z.number().int().positive().optional(),
});

export type ExportOutboxInput = z.infer<typeof ExportOutboxInputSchema>;

export interface ExportOutboxResult {
  ok: true;
  rowCount: number;
  downloadUrl: string;
  storagePath: string;
  expiresAt: number;
}

const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

function callerIsAuditor(token: Record<string, unknown> | undefined): boolean {
  if (!token) return false;
  if (token['role'] === 'AUDITOR') return true;
  const roles = token['roles'];
  if (Array.isArray(roles) && roles.includes('AUDITOR')) return true;
  return false;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function buildOutboxCsv(
  db: admin.firestore.Firestore,
  labId: string,
  rangeStartMs?: number,
  rangeEndMs?: number,
): Promise<{ csv: string; rowCount: number; archiveDocs: admin.firestore.QueryDocumentSnapshot[] }> {
  let q: admin.firestore.Query = db.collection(`notivisa-outbox/${labId}/archives`);
  if (rangeStartMs) {
    q = q.where('archivedAt', '>=', admin.firestore.Timestamp.fromMillis(rangeStartMs));
  }
  if (rangeEndMs) {
    q = q.where('archivedAt', '<=', admin.firestore.Timestamp.fromMillis(rangeEndMs));
  }
  const snap = await q.orderBy('archivedAt', 'asc').limit(10000).get();

  const header = [
    'archiveId',
    'eventId',
    'draftId',
    'laudoId',
    'mode',
    'receiptCode',
    'govEventId',
    'govStatus',
    'roundTripMs',
    'respondedAt',
    'archivedAt',
    'isSynthetic',
  ].join(',');

  const lines = [header];
  for (const doc of snap.docs) {
    const d = doc.data();
    lines.push(
      [
        doc.id,
        d['eventId'],
        d['draftId'],
        d['laudoId'],
        d['mode'],
        d['receiptCode'],
        d['govEventId'],
        d['govStatus'],
        d['roundTripMs'],
        d['respondedAt'],
        d['archivedAt']?.toMillis?.() ?? '',
        d['isSynthetic'] ? 'true' : 'false',
      ]
        .map(csvEscape)
        .join(','),
    );
  }

  return { csv: lines.join('\n'), rowCount: snap.size, archiveDocs: snap.docs };
}

export const exportOutbox = onCall<unknown, Promise<ExportOutboxResult>>(
  { region: 'southamerica-east1' },
  async (request) => {
    const parsed = ExportOutboxInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertNotivisaAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const token = request.auth!.token as Record<string, unknown>;

    if (!callerIsAuditor(token)) {
      throw new HttpsError(
        'permission-denied',
        'Apenas usuários com role AUDITOR podem exportar o outbox NOTIVISA.',
      );
    }

    const db = admin.firestore();
    const { csv, rowCount, archiveDocs } = await buildOutboxCsv(
      db,
      input.labId,
      input.rangeStartMs,
      input.rangeEndMs,
    );

    const now = Date.now();
    const storagePath = `notivisa-exports/${input.labId}/${now}-${uid}.csv`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(Buffer.from(csv, 'utf-8'), {
      contentType: 'text/csv; charset=utf-8',
      metadata: {
        metadata: {
          labId: input.labId,
          exportedBy: uid,
          rowCount: String(rowCount),
        },
      },
    });

    const expiresAt = now + SIGNED_URL_TTL_MS;
    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt,
    });

    // Stamp exportedBy on archived docs (one-time write per archive).
    if (archiveDocs.length > 0) {
      const batch = db.batch();
      const ts = admin.firestore.Timestamp.fromMillis(now);
      for (const doc of archiveDocs) {
        if (!doc.data()['exportedBy']) {
          batch.update(doc.ref, { exportedBy: uid, exportedAt: ts, exportPath: storagePath });
        }
      }
      await batch.commit();
    }

    await writeAuditLog({
      action: 'NOTIVISA_OUTBOX_EXPORTED',
      callerUid: uid,
      labId: input.labId,
      payload: {
        rowCount,
        storagePath,
        rangeStartMs: input.rangeStartMs ?? null,
        rangeEndMs: input.rangeEndMs ?? null,
      },
    });

    return {
      ok: true,
      rowCount,
      downloadUrl,
      storagePath,
      expiresAt,
    };
  },
);
