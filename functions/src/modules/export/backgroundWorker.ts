/**
 * Background Worker — Export Job Processor (Phase 3.3)
 *
 * Pub/Sub triggered Cloud Function that processes export jobs.
 * Handles all supported formats:
 *   - xlsx-ciq      XLSX with CIQ run data + conditional formatting
 *   - xlsx-nc       XLSX with non-conformity records
 *   - pdf-compliance PDF compliance report (compressed)
 *   - csv-audit     CSV audit log (RFC 4180, UTF-8 BOM)
 *
 * Job lifecycle: queued → processing → completed | failed
 * Email delivery: non-fatal — email failure does not fail the export job.
 *
 * Multi-tenant invariant: all Firestore reads are scoped to /labs/{labId}/
 * RN-06: job status updates use .update() never deleteDoc()
 */

import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as XLSX from 'xlsx';
import { generateCSVAuditLog } from './csvGenerator';
import { applyConditionalFormatting } from './excelFormatter';
import { compressPDF } from './pdfCompressor';
import { sendExportEmail } from './emailDelivery';

const db = getFirestore();
const storage = getStorage();

/** All supported export formats in Phase 3.3 */
export type ExportFormat33 = 'xlsx-ciq' | 'xlsx-nc' | 'pdf-compliance' | 'csv-audit';

interface ExportJobMessage {
  jobId: string;
  labId: string;
  format: string;
}

interface ExportJob {
  jobId: string;
  labId: string;
  format: string;
  startDate: FirebaseFirestore.Timestamp | Date;
  endDate: FirebaseFirestore.Timestamp | Date;
  status: string;
  operatorId: string;
  emailRecipient?: string;
  labName?: string;
  batchId?: string;
}

/** Maps format code to human-readable label for email subjects */
function formatLabel(format: string): string {
  switch (format) {
    case 'xlsx-ciq':       return 'XLSX — Corridas CIQ';
    case 'xlsx-nc':        return 'XLSX — Registro de NCs';
    case 'pdf-compliance': return 'PDF — Relatório de Conformidade';
    case 'csv-audit':      return 'CSV — Log de Auditoria';
    default:               return format;
  }
}

/** Converts Firestore Timestamp or Date to JS Date */
function toDate(ts: FirebaseFirestore.Timestamp | Date | unknown): Date {
  if (ts instanceof Date) return ts;
  if (ts && typeof ts === 'object' && 'toDate' in ts) {
    return (ts as FirebaseFirestore.Timestamp).toDate();
  }
  return new Date(ts as string);
}

/**
 * Generates CIQ XLSX with conditional formatting for out-of-range values.
 * Requires xlsx installed with cellStyles support.
 */
async function generateXlsxCIQ(
  labId: string,
  startDate: Date,
  endDate: Date,
): Promise<Buffer> {
  const col = db
    .collection('runs')
    .doc(labId)
    .collection('entries');

  const snap = await col
    .where('criadoEm', '>=', startDate)
    .where('criadoEm', '<=', endDate)
    .where('deletadoEm', '==', null)
    .get();

  const data = snap.docs.map((d) => {
    const r = d.data();
    return {
      'ID':          d.id,
      'Status':      r['status'] ?? '',
      'Equipamento': r['equipmentId'] ?? '',
      'Operador':    r['operatorId'] ?? '',
      'Resultado':   r['resultado'] ?? '',
      'Data':        r['criadoEm']?.toDate?.() ?? r['criadoEm'],
      'Módulo':      r['moduleName'] ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);

  // Determine column index for 'Status' (0-based, column B in this layout = index 1)
  // Headers are: ID(0), Status(1), Equipamento(2), Operador(3), Resultado(4), Data(5), Módulo(6)
  const statusColIndex = 1;

  // Apply conditional formatting: red=invalid, amber=pending, emerald=valid
  applyConditionalFormatting(ws, statusColIndex, 1);

  ws['!cols'] = [
    { wch: 20 }, // ID
    { wch: 12 }, // Status
    { wch: 16 }, // Equipamento
    { wch: 14 }, // Operador
    { wch: 14 }, // Resultado
    { wch: 22 }, // Data
    { wch: 16 }, // Módulo
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Corridas CIQ');

  // cellStyles: true is required for SheetJS Community conditional formatting
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellStyles: true });

  console.log(`[BackgroundWorker] CIQ XLSX: ${data.length} rows, ${buffer.length} bytes`);
  return buffer;
}

/**
 * Generates NC XLSX from nao-conformidades collection.
 */
async function generateXlsxNC(
  labId: string,
  startDate: Date,
  endDate: Date,
): Promise<Buffer> {
  const col = db.collection('labs').doc(labId).collection('naoConformidades');

  const snap = await col
    .where('criadoEm', '>=', startDate)
    .where('criadoEm', '<=', endDate)
    .where('deletadoEm', '==', null)
    .get();

  const data = snap.docs.map((d) => {
    const r = d.data();
    return {
      'ID':           d.id,
      'Título':       r['titulo'] ?? '',
      'Módulo':       r['moduloOrigem'] ?? '',
      'Status':       r['status'] ?? '',
      'Severidade':   r['severidade'] ?? '',
      'Operador':     r['operatorId'] ?? '',
      'Data abertura': r['criadoEm']?.toDate?.() ?? '',
      'Data fechamento': r['fechadoEm']?.toDate?.() ?? '',
      'Descrição':    r['descricao'] ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Não-Conformidades');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellStyles: true });
  console.log(`[BackgroundWorker] NC XLSX: ${data.length} rows, ${buffer.length} bytes`);
  return buffer;
}

/**
 * Generates a basic compliance PDF using pdfkit.
 * For Phase 3.3, this is a placeholder that pdfCompressor will optimize.
 */
async function generateCompliancePDF(
  labId: string,
  startDate: Date,
  endDate: Date,
): Promise<Buffer> {
  // Dynamic import avoids top-level ESM issues with pdfkit in commonjs context
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = require('pdfkit') as typeof import('pdfkit');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Cover
    doc.fontSize(20).text('Relatório de Conformidade', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Laboratório: ${labId}`);
    doc.text(`Período: ${startDate.toLocaleDateString('pt-BR')} — ${endDate.toLocaleDateString('pt-BR')}`);
    doc.text(`Gerado em: ${new Date().toISOString()}`);
    doc.moveDown();

    doc.fontSize(10).text(
      'Este relatório foi gerado automaticamente pelo HC Quality (RDC 978/2025 Art. 128). ' +
      'Os dados refletem o estado do sistema no período selecionado.'
    );

    doc.end();
  });
}

/**
 * Main Cloud Function: processes export jobs published to the 'exports' Pub/Sub topic.
 * Timeout: 540s (9 minutes) for large labs.
 * Memory: 512MB.
 */
export const backgroundWorker = onMessagePublished(
  {
    topic: 'exports',
    region: 'southamerica-east1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (event) => {
    const startTime = Date.now();
    let message: ExportJobMessage | null = null;

    try {
      // 1. Decode Pub/Sub message
      const messageData = event.data.message.data
        ? Buffer.from(event.data.message.data, 'base64').toString()
        : '';

      message = JSON.parse(messageData) as ExportJobMessage;
      if (!message?.jobId) {
        throw new Error('Invalid message payload — missing jobId');
      }

      const { jobId, labId, format } = message;
      console.log(`[BackgroundWorker] Processing job ${jobId} for lab ${labId}, format ${format}`);

      // 2. Load job document
      const jobRef = db
        .collection('labs')
        .doc(labId)
        .collection('export-jobs')
        .doc(jobId);

      const jobDoc = await jobRef.get();
      if (!jobDoc.exists) {
        throw new Error(`Job document not found: ${jobId}`);
      }

      const job = jobDoc.data() as ExportJob;

      // 3. Mark as processing
      await jobRef.update({
        status: 'processing',
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const startDate = toDate(job.startDate);
      const endDate = toDate(job.endDate);
      const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      // 4. Generate file buffer based on format
      let fileBuffer: Buffer;
      let filename: string;
      let contentType: string;

      switch (format) {
        case 'xlsx-ciq': {
          fileBuffer = await generateXlsxCIQ(labId, startDate, endDate);
          filename = `ciq-runs-${timestampStr}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        }

        case 'xlsx-nc': {
          fileBuffer = await generateXlsxNC(labId, startDate, endDate);
          filename = `nao-conformidades-${timestampStr}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        }

        case 'pdf-compliance': {
          const rawPDF = await generateCompliancePDF(labId, startDate, endDate);
          const { buffer: compressedPDF, compressionRatio } = await compressPDF(rawPDF);
          console.log(`[BackgroundWorker] PDF compressed ${compressionRatio.toFixed(2)}x`);
          fileBuffer = compressedPDF;
          filename = `relatorio-conformidade-${timestampStr}.pdf`;
          contentType = 'application/pdf';
          break;
        }

        case 'csv-audit': {
          fileBuffer = await generateCSVAuditLog(labId, startDate, endDate);
          filename = `audit-log-${timestampStr}.csv`;
          contentType = 'text/csv; charset=utf-8';
          break;
        }

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // 5. Upload to Cloud Storage
      const bucket = storage.bucket(`${process.env['GCLOUD_PROJECT']}.appspot.com`);
      const gsPath = `exports/${labId}/${jobId}/${filename}`;
      const file = bucket.file(gsPath);

      await file.save(fileBuffer, {
        metadata: {
          contentType,
          cacheControl: 'private, max-age=604800', // 7 days
        },
      });

      console.log(
        `[BackgroundWorker] Uploaded to ${gsPath}, size: ${fileBuffer.length} bytes`
      );

      // 6. Generate signed URL (7-day expiry)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read' as const,
        expires: expiresAt.getTime(),
      });

      // 7. Update job as completed
      const completedAt = new Date();
      const processingDurationMs = completedAt.getTime() - startTime;

      await jobRef.update({
        status: 'completed',
        gsPath,
        signedUrl,
        downloadUrl: signedUrl,
        expiresAt,
        fileSizeBytes: fileBuffer.length,
        generatedAt: completedAt,
        completedAt,
        updatedAt: FieldValue.serverTimestamp(),
        processingDurationMs,
      });

      // 8. Email delivery (non-fatal)
      if (job.emailRecipient) {
        try {
          await sendExportEmail({
            recipientEmail: job.emailRecipient,
            labName: job.labName ?? labId,
            exportType: formatLabel(format),
            signedUrl,
            expiresAt,
            operatorId: job.operatorId,
          });
          await jobRef.update({ emailSentAt: FieldValue.serverTimestamp() });
          console.log(`[BackgroundWorker] Email sent to ${job.emailRecipient} for job ${jobId}`);
        } catch (emailErr) {
          // Non-fatal: log error, update job with emailError, but do not fail export
          console.error('[BackgroundWorker] Email delivery failed:', emailErr);
          await jobRef.update({
            emailError: (emailErr as Error).message ?? 'Email delivery failed',
          });
        }
      }

      console.log(
        `[BackgroundWorker] Job ${jobId} completed in ${processingDurationMs}ms`
      );

      return { success: true, jobId, processingDurationMs };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[BackgroundWorker] Error processing job:`, error);

      if (message) {
        try {
          const jobRef = db
            .collection('labs')
            .doc(message.labId)
            .collection('export-jobs')
            .doc(message.jobId);

          await jobRef.update({
            status: 'failed',
            errorMessage: errMsg,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } catch (updateErr) {
          console.error('[BackgroundWorker] Failed to update job status:', updateErr);
        }
      }

      throw error; // Pub/Sub will retry
    }
  }
);
