/**
 * generateLaudoPDF — Puppeteer-based PDF rendering for liberated laudos.
 *
 * Pipeline:
 *  1. Auth: active member of labId (any role can re-render an existing PDF).
 *  2. Read LaudoVersion (immutable snapshot).
 *  3. Generate QR Code with public validation URL.
 *  4. Render HTML template + Puppeteer → PDF buffer.
 *  5. Enforce <10MB hard cap (RDC compliance + Cloud Storage cost guard).
 *  6. Compute SHA-256(pdfBuffer) → pdfHash (audit-grade integrity).
 *  7. Upload to Cloud Storage gs://{bucket}/laudos/{labId}/{laudoId}/v{version}.pdf
 *  8. Update LaudoVersion doc with pdfUrl + pdfHash (forward audit trail).
 *  9. Return signed URL (1h expiration) for the caller.
 *
 * Region: southamerica-east1 (RDC 978 data sovereignty).
 * Memory: 2GiB (Puppeteer is memory-hungry under cold starts).
 * Timeout: 120s (cold start ~30s + render ~5s + upload ~2s).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import type { Browser } from 'puppeteer';
import { createHash } from 'crypto';
import { z } from 'zod';

import type { Laudo, LaudoVersion } from './_shared/types';
import { renderLaudoHtml } from './_pdf/template';
import { generateQRCodeDataUrl, buildValidationUrl, DEFAULT_VALIDATION_BASE } from './_pdf/qrCode';
import { uploadLaudoPDF } from './_shared/pdfStorage';

const REGION = 'southamerica-east1';
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB

const InputSchema = z.object({
  labId: z.string().min(1),
  laudoId: z.string().min(1),
  version: z.number().int().positive().optional(),
  /**
   * Override the validation base URL (used in staging / local testing).
   * Production omits this to fall back to DEFAULT_VALIDATION_BASE.
   */
  validationBaseUrl: z.string().url().optional(),
  /**
   * Custom expiration for the returned signed URL, in seconds.
   * Default: 3600 (1 hour). Max: 7 days.
   */
  signedUrlExpiresInSec: z
    .number()
    .int()
    .min(60)
    .max(7 * 24 * 60 * 60)
    .optional(),
});

type GenerateLaudoPDFInput = z.infer<typeof InputSchema>;

interface GenerateLaudoPDFResult {
  ok: true;
  laudoId: string;
  version: number;
  signedUrl: string;
  storagePath: string;
  pdfHash: string;
  sizeBytes: number;
  validationUrl: string;
}

async function assertActiveMember(labId: string, uid: string): Promise<void> {
  const snap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${uid}`)
    .get();
  if (!snap.exists || snap.data()?.['active'] !== true) {
    throw new HttpsError('permission-denied', 'Caller is not an active member of the lab.');
  }
}

async function fetchLaudoAndVersion(
  labId: string,
  laudoId: string,
  versionOverride?: number,
): Promise<{ laudo: Laudo; version: LaudoVersion }> {
  const db = admin.firestore();

  const laudoSnap = await db.doc(`labs/${labId}/laudos/${laudoId}`).get();
  if (!laudoSnap.exists) {
    throw new HttpsError('not-found', `Laudo ${laudoId} não encontrado.`);
  }
  const laudo = laudoSnap.data() as Laudo;

  const targetVersion = versionOverride ?? laudo.currentVersion;
  if (!targetVersion || targetVersion < 1) {
    throw new HttpsError('failed-precondition', 'Laudo ainda não tem versão liberada.');
  }

  const versionsSnap = await db
    .collection(`labs/${labId}/laudo-versions`)
    .where('laudoId', '==', laudoId)
    .where('version', '==', targetVersion)
    .limit(1)
    .get();

  if (versionsSnap.empty) {
    throw new HttpsError('not-found', `Versão ${targetVersion} de laudo ${laudoId} não encontrada.`);
  }

  const version = versionsSnap.docs[0].data() as LaudoVersion;
  // Stamp the version doc id so we can update it later.
  (version as LaudoVersion & { _docId: string })._docId = versionsSnap.docs[0].id;
  return { laudo, version };
}

async function renderPdfWithPuppeteer(html: string): Promise<Buffer> {
  // Lazy-load puppeteer to keep cold start cheap for callables that never render PDFs.
  const { default: puppeteer } = await import('puppeteer');
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' },
      displayHeaderFooter: true,
      footerTemplate: `
        <div style="font-size:8pt;color:#666;width:100%;text-align:center;padding:0 18mm;">
          Página <span class="pageNumber"></span> de <span class="totalPages"></span>
        </div>`,
      headerTemplate: '<div></div>',
    });

    await page.close();
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}

export const generateLaudoPDF = onCall<unknown, Promise<GenerateLaudoPDFResult>>(
  { region: REGION, memory: '2GiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const parsed = InputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input: GenerateLaudoPDFInput = parsed.data;

    await assertActiveMember(input.labId, request.auth.uid);

    const { laudo, version } = await fetchLaudoAndVersion(
      input.labId,
      input.laudoId,
      input.version,
    );

    // Build validation URL + QR.
    const validationUrl = buildValidationUrl({
      laudoId: input.laudoId,
      version: version.version,
      chainHash: version.chainHash,
      baseUrl: input.validationBaseUrl ?? DEFAULT_VALIDATION_BASE,
    });
    const qrDataUrl = await generateQRCodeDataUrl(validationUrl, { width: 120 });

    // Render HTML → PDF.
    const html = renderLaudoHtml({
      laudo,
      version,
      qrCodeDataUrl: qrDataUrl,
      validationUrl,
    });

    const pdfBuffer = await renderPdfWithPuppeteer(html);

    if (pdfBuffer.length > MAX_PDF_BYTES) {
      throw new HttpsError(
        'resource-exhausted',
        `PDF size ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB exceeds 10MB limit.`,
      );
    }

    const pdfHash = createHash('sha256').update(pdfBuffer).digest('hex');

    const upload = await uploadLaudoPDF({
      labId: input.labId,
      laudoId: input.laudoId,
      version: version.version,
      buffer: pdfBuffer,
      pdfHash,
      expiresInSec: input.signedUrlExpiresInSec,
    });

    // Update LaudoVersion with pdfUrl + pdfHash. Best-effort — generation
    // can be retried, so we don't block the response if this fails.
    try {
      const versionDocId = (version as LaudoVersion & { _docId: string })._docId;
      await admin
        .firestore()
        .doc(`labs/${input.labId}/laudo-versions/${versionDocId}`)
        .update({
          pdfUrl: upload.gsUrl,
          pdfStoragePath: upload.storagePath,
          pdfHash,
          pdfGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
      console.error('[generateLaudoPDF] failed to write pdfUrl back', err);
    }

    // Audit log.
    try {
      await admin.firestore().collection(`labs/${input.labId}/audit-logs`).add({
        tipo: 'laudo_pdf_gerado',
        laudoId: input.laudoId,
        version: version.version,
        operatorId: request.auth.uid,
        pdfHash,
        sizeBytes: upload.sizeBytes,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error('[generateLaudoPDF] audit log failed', err);
    }

    return {
      ok: true,
      laudoId: input.laudoId,
      version: version.version,
      signedUrl: upload.signedUrl,
      storagePath: upload.storagePath,
      pdfHash,
      sizeBytes: upload.sizeBytes,
      validationUrl,
    };
  },
);
