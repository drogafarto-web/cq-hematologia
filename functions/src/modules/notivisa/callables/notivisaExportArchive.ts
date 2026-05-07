/**
 * notivisaExportArchive — Auditor-only export of submitted NOTIVISA forms
 * Phase 8+ — Creates immutable archive of past 90 days
 *
 * Auditor initiates export, function queries notivisa-outbox with status='acknowledged',
 * generates CSV + JSON export, stores in /notivisa-outbox/{labId}/archives,
 * and returns archive entry for download.
 *
 * Per ADR-0026: auditor-only read access, immutable archive, tracks exportedBy + exportedAt.
 *
 * Input: { labId, daysBack?, format? }
 * Output: { ok, archiveId, exportedAt, recordCount, formats }
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const notivisaExportArchiveInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  daysBack: z.number().int().min(1).max(365).default(90),
  format: z.enum(['csv', 'json', 'both']).default('both'),
});

const notivisaExportArchiveOutputSchema = z.object({
  ok: z.literal(true),
  archiveId: z.string(),
  exportedAt: z.number().int(),
  recordCount: z.number().int().nonnegative(),
  formats: z.array(z.enum(['csv', 'json'])),
  expiresAt: z.number().int(),
});

const notivisaExportArchiveErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'UNAUTHORIZED',
    'LAB_NOT_FOUND',
    'NO_DATA',
    'EXPORT_FAILED',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type NotivisaExportArchiveOutput = z.infer<typeof notivisaExportArchiveOutputSchema>;
type NotivisaExportArchiveError = z.infer<typeof notivisaExportArchiveErrorSchema>;

interface NotivisaOutboxEntry {
  id: string;
  labId: string;
  laudoId: string;
  diseaseCode: string;
  patientData?: {
    name_anon?: string;
    dateOfBirth?: any;
    gender?: string;
  };
  resultValue: string;
  resultDate: any;
  status: string;
  submissionAttempts?: Array<any>;
  receiptCodeFromAnvisa?: string;
  anvisa_eventId?: string;
  criadoEm?: any;
}

/**
 * Format outbox entries as CSV
 */
function generateCSV(entries: NotivisaOutboxEntry[]): string {
  const headers = [
    'archiveId',
    'diseaseCode',
    'patientAnon',
    'resultValue',
    'resultDate',
    'status',
    'receiptCode',
    'submissionAttempts',
    'createdAt',
  ];

  const rows = entries.map(entry => [
    entry.id,
    entry.diseaseCode,
    entry.patientData?.name_anon || 'N/A',
    entry.resultValue,
    entry.resultDate?.toDate?.()?.toISOString?.() || '',
    entry.status,
    entry.receiptCodeFromAnvisa || '',
    entry.submissionAttempts?.length ?? 0,
    entry.criadoEm?.toDate?.()?.toISOString?.() || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Format outbox entries as JSON
 */
function generateJSON(entries: NotivisaOutboxEntry[]): string {
  const exported = entries.map(entry => ({
    id: entry.id,
    diseaseCode: entry.diseaseCode,
    patientAnon: entry.patientData?.name_anon || 'N/A',
    resultValue: entry.resultValue,
    resultDate: entry.resultDate?.toDate?.()?.toISOString?.() || null,
    status: entry.status,
    receiptCode: entry.receiptCodeFromAnvisa || null,
    anvisaEventId: entry.anvisa_eventId || null,
    submissionAttempts: entry.submissionAttempts?.length ?? 0,
    createdAt: entry.criadoEm?.toDate?.()?.toISOString?.() || null,
  }));

  return JSON.stringify({ exported, count: exported.length }, null, 2);
}

/**
 * Export archive callable
 */
export const notivisaExportArchive = functions
  .region('southamerica-east1')
  .onCall<z.infer<typeof notivisaExportArchiveInputSchema>, NotivisaExportArchiveOutput | NotivisaExportArchiveError>(
  async (request): Promise<NotivisaExportArchiveOutput | NotivisaExportArchiveError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const input = notivisaExportArchiveInputSchema.parse(request.data);
      const { labId, daysBack, format } = input;
      const uid = request.auth.uid;

      const db = admin.firestore();

      // ========== 2. Authorization: auditor only ==========
      const memberDoc = await db
        .collection('labs')
        .doc(labId)
        .collection('members')
        .doc(uid)
        .get();

      if (!memberDoc.exists) {
        return {
          ok: false,
          code: 'UNAUTHORIZED',
          message: `User is not a member of lab ${labId}`,
        };
      }

      const memberRole = memberDoc.data()?.role;
      const isAuditor = memberRole === 'AUDITOR' || memberRole === 'admin';

      if (!isAuditor) {
        return {
          ok: false,
          code: 'UNAUTHORIZED',
          message: `User role ${memberRole} cannot export NOTIVISA archives (requires AUDITOR or admin)`,
        };
      }

      // ========== 3. Query acknowledged entries ==========
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

      const acknowledgedEntries = await db
        .collection(`labs/${labId}/notivisa-outbox`)
        .where('status', '==', 'acknowledged')
        .where('criadoEm', '>=', cutoffTimestamp)
        .limit(1000) // hard limit to avoid memory issues
        .get();

      if (acknowledgedEntries.empty) {
        return {
          ok: false,
          code: 'NO_DATA',
          message: `No acknowledged NOTIVISA entries found in past ${daysBack} days`,
        };
      }

      const entries = acknowledgedEntries.docs.map(doc => doc.data() as NotivisaOutboxEntry);

      // ========== 4. Generate export files ==========
      const formats: Array<'csv' | 'json'> = [];
      let csvContent: string | null = null;
      let jsonContent: string | null = null;

      if (format === 'csv' || format === 'both') {
        csvContent = generateCSV(entries);
        formats.push('csv');
      }

      if (format === 'json' || format === 'both') {
        jsonContent = generateJSON(entries);
        formats.push('json');
      }

      // ========== 5. Store archive entry (immutable) ==========
      const archivesRef = db
        .collection(`labs/${labId}/notivisa-outbox`)
        .doc('_archives');

      // Ensure archives parent exists
      await archivesRef.set({ _type: 'archives-parent' }, { merge: true });

      const archiveId = `archive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const archiveDocRef = archivesRef.collection('exports').doc(archiveId);
      const now = Date.now();
      const expiresAt = now + 90 * 24 * 3600 * 1000; // 90 days retention

      await archiveDocRef.set({
        id: archiveId,
        labId,
        exportedBy: uid,
        exportedAt: now,
        expiresAt,
        daysBack,
        recordCount: entries.length,
        formats,
        csvSize: csvContent?.length || 0,
        jsonSize: jsonContent?.length || 0,
        status: 'ready',
      });

      // 6. Store file contents in separate subcollection
      // (Firestore doc size limit = 1MB; store large exports separately)
      if (csvContent && csvContent.length < 1000000) {
        await archiveDocRef.collection('files').doc('export.csv').set({
          content: csvContent,
          mimeType: 'text/csv',
          size: csvContent.length,
        });
      }

      if (jsonContent && jsonContent.length < 1000000) {
        await archiveDocRef.collection('files').doc('export.json').set({
          content: jsonContent,
          mimeType: 'application/json',
          size: jsonContent.length,
        });
      }

      // ========== 7. Create audit log entry ==========
      await archiveDocRef.collection('auditLog').doc(`${now}`).set({
        action: 'CREATED',
        operatorId: uid,
        ts: now,
        details: {
          recordCount: entries.length,
          formats,
          daysBack,
        },
      });

      functions.logger.info(`[NOTIVISA] Archive created: ${archiveId}`, {
        labId,
        recordCount: entries.length,
        exportedBy: uid,
      } as Record<string, any>);

      return {
        ok: true,
        archiveId,
        exportedAt: now,
        recordCount: entries.length,
        formats,
        expiresAt,
      };
    } catch (error: any) {
      functions.logger.error('[notivisaExportArchive] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'EXPORT_FAILED',
          message: error.errors[0].message,
        };
      }

      if (error instanceof functions.HttpsError) {
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error during export',
      };
    }
  }
);
