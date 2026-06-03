/**
 * SA-16: generateAuditReportPDF (for anomaly-based reports)
 *
 * Generates a comprehensive anomaly audit report PDF with:
 * - Cover page (lab name, CNPJ, period, RT, generation timestamp)
 * - Executive summary (NLP prose)
 * - Per-rule sections (rule name, description, alert count, triggered alerts table)
 *
 * Output: PDF buffer or signed Cloud Storage URL.
 * No new npm dependencies — uses existing puppeteer setup.
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();

// ─── Input validation ────────────────────────────────────────────────────────

const GenerateReportPDFInput = z.object({
  labId: z.string().min(1),
  reportId: z.string().min(1),
});

type GenerateReportPDFInputType = z.infer<typeof GenerateReportPDFInput>;

// ─── Helper: Check lab membership ─────────────────────────────────────────────

async function isActiveMemberOfLab(labId: string, uid: string): Promise<boolean> {
  try {
    const snap = await db.collection(`labs/${labId}/members`).doc(uid).get();
    return snap.exists && snap.data()?.active === true;
  } catch {
    return false;
  }
}

// ─── Helper: Generate HTML content ──────────────────────────────────────────

function generateHTML(
  labName: string,
  labCNPJ: string,
  reportData: any,
  periodFrom: Date,
  periodTo: Date,
  rtName: string,
  generatedAt: Date,
): string {
  const formatDate = (d: Date) => d.toLocaleDateString('pt-BR');
  const formatTime = (d: Date) => d.toLocaleTimeString('pt-BR');

  const violet500 = '#7c3aed'; // Tailwind violet-500 hex

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Auditoria - Anomalias</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: white;
      color: #333;
      line-height: 1.6;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px;
    }

    /* Cover Page */
    .cover-page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 100vh;
      padding: 60px 40px;
      border-left: 4mm solid ${violet500};
    }

    .cover-header {
      text-align: left;
    }

    .cover-accent {
      display: block;
      height: 4px;
      width: 40px;
      background: ${violet500};
      margin-bottom: 24px;
    }

    .cover-title {
      font-size: 36px;
      font-weight: 700;
      color: #000;
      margin-bottom: 8px;
    }

    .cover-subtitle {
      font-size: 18px;
      color: #666;
      margin-bottom: 40px;
    }

    .cover-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      font-size: 14px;
      margin-bottom: 48px;
    }

    .cover-meta-item {
      display: flex;
      flex-direction: column;
    }

    .cover-meta-label {
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .cover-meta-value {
      color: #666;
      font-size: 13px;
    }

    .cover-footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #ddd;
      padding-top: 24px;
    }

    /* Executive Summary */
    .section {
      margin-bottom: 48px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: ${violet500};
      margin-bottom: 16px;
      border-left: 4px solid ${violet500};
      padding-left: 12px;
    }

    .summary-text {
      font-size: 14px;
      line-height: 1.8;
      color: #333;
      text-align: justify;
    }

    /* Per-Rule Sections */
    .rule-section {
      margin-bottom: 32px;
      page-break-inside: avoid;
      border: 1px solid #e5e7eb;
      padding: 20px;
      border-radius: 6px;
    }

    .rule-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      align-items: flex-start;
    }

    .rule-name {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .rule-count {
      font-size: 24px;
      font-weight: 700;
      color: ${violet500};
      text-align: center;
    }

    .rule-description {
      font-size: 13px;
      color: #666;
      margin-bottom: 16px;
    }

    .rule-alerts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 12px;
    }

    .rule-alerts-table th {
      background: #f3f4f6;
      padding: 8px;
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid #d1d5db;
    }

    .rule-alerts-table td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
    }

    .rule-alerts-table tr:last-child td {
      border-bottom: none;
    }

    .severity-critical {
      background: #fef2f2;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
      color: #dc2626;
    }

    .severity-high {
      background: #fff7ed;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
      color: #ea580c;
    }

    .severity-medium {
      background: #fffbeb;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
      color: #f59e0b;
    }

    .severity-low {
      background: #ecfdf5;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
      color: #10b981;
    }

    /* Footer */
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #666;
      text-align: center;
    }

    /* Page break */
    @page {
      size: A4;
      margin: 20mm;
    }

    @media print {
      body {
        padding: 0;
      }
      .container {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-header">
      <span class="cover-accent"></span>
      <div class="cover-title">Relatório de Auditoria</div>
      <div class="cover-subtitle">Anomalias e Insights com IA</div>
    </div>

    <div class="cover-meta">
      <div class="cover-meta-item">
        <span class="cover-meta-label">Laboratório</span>
        <span class="cover-meta-value">${labName}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">CNPJ</span>
        <span class="cover-meta-value">${labCNPJ}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Período</span>
        <span class="cover-meta-value">${formatDate(periodFrom)} a ${formatDate(periodTo)}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">RT Responsável</span>
        <span class="cover-meta-value">${rtName}</span>
      </div>
    </div>

    <div class="cover-footer">
      <p>Gerado em ${formatDate(generatedAt)} às ${formatTime(generatedAt)}</p>
      <p>Sistema HC Quality — Controle de Qualidade Interno</p>
    </div>
  </div>

  <!-- Main Content -->
  <div class="container">
    <!-- Executive Summary -->
    <div class="section">
      <div class="section-title">Sumário Executivo</div>
      <p class="summary-text">
        ${reportData.summary || 'Sumário não disponível.'}
      </p>
    </div>

    <!-- Per-Rule Sections -->
    ${(reportData.rules || [])
      .map(
        (rule: any) => `
    <div class="rule-section">
      <div class="rule-header">
        <div>
          <div class="rule-name">${rule.name}</div>
          <div class="rule-description">${rule.description}</div>
        </div>
        <div class="rule-count">${rule.alertCount}</div>
      </div>

      ${
        rule.alerts && rule.alerts.length > 0
          ? `
      <table class="rule-alerts-table">
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Descrição</th>
            <th>Severidade</th>
          </tr>
        </thead>
        <tbody>
          ${rule.alerts
            .map(
              (alert: any) => `
          <tr>
            <td>${new Date(alert.detectedAt).toLocaleString('pt-BR')}</td>
            <td>${alert.shortDescription}</td>
            <td><span class="severity-${alert.severity}">${alert.severity}</span></td>
          </tr>
        `,
            )
            .join('')}
        </tbody>
      </table>
      `
          : '<p style="color:#999; font-size:12px;">Nenhum alerta neste período</p>'
      }
    </div>
    `,
      )
      .join('')}

    <!-- Footer -->
    <div class="footer">
      <p>Este relatório foi gerado automaticamente pelo sistema de auditoria avançada.</p>
      <p>Para questões, contate o Responsável Técnico.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// ─── Callable ────────────────────────────────────────────────────────────────

/**
 * generateAuditReportPDF: Generate advanced audit report PDF
 *
 * Requires auth and lab membership.
 * Fetches report data, generates HTML with cover + summary + per-rule sections,
 * renders to PDF via Puppeteer, and returns signed Cloud Storage URL.
 */
export const generateAuditReportPDF = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    memory: '2GiB',
    timeoutSeconds: 300,
  },
  async (request: CallableRequest<GenerateReportPDFInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    let input: GenerateReportPDFInputType;
    try {
      input = GenerateReportPDFInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    const isMember = await isActiveMemberOfLab(input.labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    let browser: any = null;

    try {
      // Fetch report data
      const reportRef = db.collection(`labs/${input.labId}/audit-reports`).doc(input.reportId);
      const reportSnap = await reportRef.get();

      if (!reportSnap.exists) {
        throw new HttpsError('not-found', 'Relatório não encontrado');
      }

      const reportData = reportSnap.data();
      const labSnap = await db.collection('labs').doc(input.labId).get();
      const lab = labSnap.data();

      const labName = lab?.name || 'Laboratório Desconhecido';
      const labCNPJ = lab?.cnpj || '00.000.000/0000-00';
      const rtName = reportData?.generatedBy || 'Responsável Técnico';
      const periodFrom = reportData?.periodFrom?.toDate?.() || new Date();
      const periodTo = reportData?.periodTo?.toDate?.() || new Date();
      const generatedAt = new Date();

      // Generate HTML
      const html = generateHTML(
        labName,
        labCNPJ,
        reportData || {},
        periodFrom,
        periodTo,
        rtName,
        generatedAt,
      );

      // Lazy-load puppeteer
      const { default: puppeteer } = await import('puppeteer');

      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        printBackground: true,
      });

      await page.close();

      // Verify size
      const pdfSizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);
      if (Number(pdfSizeMB) > 25) {
        throw new HttpsError(
          'resource-exhausted',
          `PDF exceeds 25MB limit: ${pdfSizeMB}MB. Use Firebase Storage signed URL instead.`,
        );
      }

      // Upload to Cloud Storage
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `audit-reports/${input.labId}/${input.reportId}-${timestamp}.pdf`;
      const bucket = storage.bucket('hmatologia2.appspot.com');
      const file = bucket.file(filename);

      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            labId: input.labId,
            reportId: input.reportId,
            generatedAt: generatedAt.toISOString(),
          },
        },
      });

      // Generate signed URL (valid for 7 days)
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      return {
        success: true,
        pdfUrl: signedUrl,
        pdfSizeMB: Number(pdfSizeMB),
        filename,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      console.error('PDF generation error:', error);
      throw new HttpsError('internal', `PDF generation failed: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  },
);
