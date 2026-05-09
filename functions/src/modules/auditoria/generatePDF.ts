/**
 * generateAuditReportPDF — Puppeteer server-side PDF generation
 *
 * Generates a comprehensive audit report PDF including:
 * - Audit header (lab, auditor, date, status)
 * - Checklist items (~115 DICQ items with responses)
 * - Findings (achados) with severity and NC links
 * - RT signature
 *
 * PDF must be <10MB per RDC 978 compliance.
 * Uses Puppeteer for server-side rendering + pdf-lib for manipulation.
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import type { Browser } from 'puppeteer';
import { Storage } from '@google-cloud/storage';
import { z } from 'zod';
import type { Auditoria, Sessao, ChecklistItem, Achado } from './types';

const db = admin.firestore();
const storage = new Storage();

// Input validator
const GeneratePDFInput = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  sessaoId: z.string().min(1),
});

type GeneratePDFInputType = z.infer<typeof GeneratePDFInput>;

// Helper: Check lab membership
async function isActiveMemberOfLab(labId: string, uid: string): Promise<boolean> {
  try {
    const snap = await db.collection(`labs/${labId}/members`).doc(uid).get();
    return snap.exists && snap.data()?.active === true;
  } catch {
    return false;
  }
}

// Helper: Fetch audit data
async function fetchAuditData(
  labId: string,
  auditoriaId: string,
  sessaoId: string
): Promise<{
  auditoria: Auditoria;
  sessao: Sessao;
  checklistItems: ChecklistItem[];
  achados: Achado[];
}> {
  const [audSnap, sessSnap, itemsSnap, achadosSnap] = await Promise.all([
    db.collection(`labs/${labId}/auditorias-internas`).doc(auditoriaId).get(),
    db.collection(`labs/${labId}/auditorias-internas/${auditoriaId}/sessoes`).doc(sessaoId).get(),
    db.collection(`labs/${labId}/auditorias-internas/${auditoriaId}/sessoes/${sessaoId}/checklist-items`)
      .get(),
    db.collection(`labs/${labId}/auditorias-internas/${auditoriaId}/sessoes/${sessaoId}/achados`)
      .get(),
  ]);

  if (!audSnap.exists) throw new HttpsError('not-found', 'Auditoria not found');
  if (!sessSnap.exists) throw new HttpsError('not-found', 'Sessão not found');

  const auditoria = audSnap.data() as Auditoria;
  const sessao = sessSnap.data() as Sessao;
  const checklistItems = itemsSnap.docs.map((doc) => doc.data() as ChecklistItem);
  const achados = achadosSnap.docs.map((doc) => doc.data() as Achado);

  return { auditoria, sessao, checklistItems, achados };
}

// Helper: Generate HTML content for PDF
function generateHTML(
  auditoria: Auditoria,
  sessao: Sessao,
  checklistItems: ChecklistItem[],
  achados: Achado[],
  labName: string
): string {
  const formatDate = (ts: any) => {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // Statistics
  const conforme = checklistItems.filter((i) => i.resposta === 'conforme').length;
  const naoConforme = checklistItems.filter((i) => i.resposta === 'não-conforme').length;
  const na = checklistItems.filter((i) => i.resposta === 'N/A').length;
  const conformidadePercentual = checklistItems.length > 0
    ? ((conforme / checklistItems.length) * 100).toFixed(1)
    : 'N/A';

  // Group achados by severity
  const achadosPorSeveridade = {
    crítica: achados.filter((a) => a.severidade === 'crítica'),
    grave: achados.filter((a) => a.severidade === 'grave'),
    moderada: achados.filter((a) => a.severidade === 'moderada'),
    leve: achados.filter((a) => a.severidade === 'leve'),
    observação: achados.filter((a) => a.severidade === 'observação'),
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Auditoria Interna</title>
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
      padding: 40px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      border-bottom: 3px solid #1e40af;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }

    .header-title {
      font-size: 28px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 8px;
    }

    .header-subtitle {
      font-size: 14px;
      color: #666;
      margin-bottom: 16px;
    }

    .header-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      font-size: 13px;
    }

    .header-item {
      display: flex;
      flex-direction: column;
    }

    .header-label {
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .header-value {
      color: #666;
    }

    /* Section */
    .section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 16px;
      border-left: 4px solid #1e40af;
      padding-left: 12px;
    }

    /* Statistics Box */
    .stats-box {
      background: #f3f4f6;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .stat-item {
      text-align: center;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }

    /* Checklist Section */
    .checklist {
      margin-bottom: 32px;
    }

    .checklist-item {
      border-left: 4px solid #e5e7eb;
      padding: 12px;
      margin-bottom: 8px;
      background: #f9fafb;
      page-break-inside: avoid;
      font-size: 12px;
    }

    .checklist-item.conforme {
      border-left-color: #10b981;
      background: #f0fdf4;
    }

    .checklist-item.nao-conforme {
      border-left-color: #ef4444;
      background: #fef2f2;
    }

    .checklist-item.na {
      border-left-color: #9ca3af;
      background: #f3f4f6;
    }

    .checklist-item-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .checklist-item-numero {
      font-weight: 600;
      color: #333;
    }

    .checklist-item-resposta {
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
    }

    .checklist-item-resposta.conforme {
      background: #10b981;
      color: white;
    }

    .checklist-item-resposta.nao-conforme {
      background: #ef4444;
      color: white;
    }

    .checklist-item-resposta.na {
      background: #9ca3af;
      color: white;
    }

    .checklist-item-descricao {
      color: #333;
      margin-bottom: 4px;
      line-height: 1.4;
    }

    .checklist-item-obs {
      color: #666;
      font-size: 11px;
      font-style: italic;
    }

    /* Findings Section */
    .achados-group {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .achados-group-title {
      font-size: 14px;
      font-weight: 600;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .achados-group-title.critica {
      background: #dc2626;
    }

    .achados-group-title.grave {
      background: #ea580c;
    }

    .achados-group-title.moderada {
      background: #f59e0b;
    }

    .achados-group-title.leve {
      background: #06b6d4;
    }

    .achados-group-title.observacao {
      background: #8b5cf6;
    }

    .achado {
      border-left: 4px solid #e5e7eb;
      padding: 12px;
      margin-bottom: 12px;
      background: #f9fafb;
      page-break-inside: avoid;
      font-size: 12px;
    }

    .achado.critica {
      border-left-color: #dc2626;
      background: #fef2f2;
    }

    .achado.grave {
      border-left-color: #ea580c;
      background: #fff7ed;
    }

    .achado.moderada {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }

    .achado.leve {
      border-left-color: #06b6d4;
      background: #ecf0f1;
    }

    .achado.observacao {
      border-left-color: #8b5cf6;
      background: #faf5ff;
    }

    .achado-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .achado-numero {
      font-weight: 600;
      color: #333;
    }

    .achado-nc-link {
      color: #1e40af;
      font-weight: 500;
    }

    .achado-descricao {
      color: #333;
      margin-bottom: 6px;
      line-height: 1.4;
    }

    .achado-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #666;
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

    .signature-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
      font-size: 12px;
    }

    .signature-line {
      border-top: 1px solid #333;
      margin-bottom: 4px;
      height: 60px;
    }

    .signature-label {
      text-align: center;
      color: #333;
      font-weight: 600;
    }

    /* Page break helpers */
    @page {
      size: A4;
      margin: 20mm;
    }

    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-title">Relatório de Auditoria Interna</div>
      <div class="header-subtitle">Conforme DICQ 1.3 (ISO 15189:2015)</div>

      <div class="header-grid">
        <div class="header-item">
          <span class="header-label">Laboratório</span>
          <span class="header-value">${labName}</span>
        </div>
        <div class="header-item">
          <span class="header-label">Auditor</span>
          <span class="header-value">${sessao.auditor}</span>
        </div>
        <div class="header-item">
          <span class="header-label">Data de Início</span>
          <span class="header-value">${formatDate(sessao.dataInicio)}</span>
        </div>
        <div class="header-item">
          <span class="header-label">Data de Conclusão</span>
          <span class="header-value">${formatDate(sessao.dataFim || new Date())}</span>
        </div>
        <div class="header-item">
          <span class="header-label">Frequência</span>
          <span class="header-value">${auditoria.frequencia}</span>
        </div>
        <div class="header-item">
          <span class="header-label">Status</span>
          <span class="header-value">${sessao.status}</span>
        </div>
        <div class="header-item">
          <span class="header-label">Ano</span>
          <span class="header-value">${auditoria.ano}</span>
        </div>
        <div class="header-item">
          <span class="header-label">RT Responsável</span>
          <span class="header-value">${auditoria.responsavelTecnico}</span>
        </div>
      </div>
    </div>

    <!-- Statistics -->
    <div class="section">
      <div class="section-title">Resumo de Conformidade</div>
      <div class="stats-box">
        <div class="stat-item">
          <div class="stat-value">${conforme}</div>
          <div class="stat-label">Conforme</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${naoConforme}</div>
          <div class="stat-label">Não Conforme</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${na}</div>
          <div class="stat-label">N/A</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${conformidadePercentual}%</div>
          <div class="stat-label">Conformidade</div>
        </div>
      </div>
    </div>

    <!-- Checklist Items -->
    <div class="section">
      <div class="section-title">Itens de Verificação (DICQ)</div>
      <div class="checklist">
        ${checklistItems
          .map(
            (item) => `
          <div class="checklist-item ${item.resposta || 'na'}">
            <div class="checklist-item-header">
              <span class="checklist-item-numero">${item.numeroDICQ}</span>
              <span class="checklist-item-resposta ${item.resposta || 'na'}">
                ${item.resposta === 'conforme' ? '✓ Conforme' : item.resposta === 'não-conforme' ? '✗ Não Conforme' : 'N/A'}
              </span>
            </div>
            <div class="checklist-item-descricao">${item.descricao}</div>
            ${item.observacoes ? `<div class="checklist-item-obs">Obs: ${item.observacoes}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <!-- Findings Section -->
    ${
      achados.length > 0
        ? `
    <div class="section">
      <div class="section-title">Achados (Não Conformidades)</div>

      ${
        achadosPorSeveridade.crítica.length > 0
          ? `
        <div class="achados-group">
          <div class="achados-group-title critica">Críticos (${achadosPorSeveridade.crítica.length})</div>
          ${achadosPorSeveridade.crítica
            .map(
              (achado, idx) => `
            <div class="achado critica">
              <div class="achado-header">
                <span class="achado-numero">Achado ${idx + 1}</span>
                ${achado.ncId ? `<span class="achado-nc-link">NC: ${achado.ncId}</span>` : ''}
              </div>
              <div class="achado-descricao">${achado.descricao}</div>
              <div class="achado-meta">
                <span>Item: ${achado.checklistItemId}</span>
                <span>Registrado por: ${achado.criadoPor}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        achadosPorSeveridade.grave.length > 0
          ? `
        <div class="achados-group">
          <div class="achados-group-title grave">Graves (${achadosPorSeveridade.grave.length})</div>
          ${achadosPorSeveridade.grave
            .map(
              (achado, idx) => `
            <div class="achado grave">
              <div class="achado-header">
                <span class="achado-numero">Achado ${idx + 1}</span>
                ${achado.ncId ? `<span class="achado-nc-link">NC: ${achado.ncId}</span>` : ''}
              </div>
              <div class="achado-descricao">${achado.descricao}</div>
              <div class="achado-meta">
                <span>Item: ${achado.checklistItemId}</span>
                <span>Registrado por: ${achado.criadoPor}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        achadosPorSeveridade.moderada.length > 0
          ? `
        <div class="achados-group">
          <div class="achados-group-title moderada">Moderados (${achadosPorSeveridade.moderada.length})</div>
          ${achadosPorSeveridade.moderada
            .map(
              (achado, idx) => `
            <div class="achado moderada">
              <div class="achado-header">
                <span class="achado-numero">Achado ${idx + 1}</span>
                ${achado.ncId ? `<span class="achado-nc-link">NC: ${achado.ncId}</span>` : ''}
              </div>
              <div class="achado-descricao">${achado.descricao}</div>
              <div class="achado-meta">
                <span>Item: ${achado.checklistItemId}</span>
                <span>Registrado por: ${achado.criadoPor}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        achadosPorSeveridade.leve.length > 0
          ? `
        <div class="achados-group">
          <div class="achados-group-title leve">Leves (${achadosPorSeveridade.leve.length})</div>
          ${achadosPorSeveridade.leve
            .map(
              (achado, idx) => `
            <div class="achado leve">
              <div class="achado-header">
                <span class="achado-numero">Achado ${idx + 1}</span>
                ${achado.ncId ? `<span class="achado-nc-link">NC: ${achado.ncId}</span>` : ''}
              </div>
              <div class="achado-descricao">${achado.descricao}</div>
              <div class="achado-meta">
                <span>Item: ${achado.checklistItemId}</span>
                <span>Registrado por: ${achado.criadoPor}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        achadosPorSeveridade.observação.length > 0
          ? `
        <div class="achados-group">
          <div class="achados-group-title observacao">Observações (${achadosPorSeveridade.observação.length})</div>
          ${achadosPorSeveridade.observação
            .map(
              (achado, idx) => `
            <div class="achado observacao">
              <div class="achado-header">
                <span class="achado-numero">Achado ${idx + 1}</span>
                ${achado.ncId ? `<span class="achado-nc-link">NC: ${achado.ncId}</span>` : ''}
              </div>
              <div class="achado-descricao">${achado.descricao}</div>
              <div class="achado-meta">
                <span>Item: ${achado.checklistItemId}</span>
                <span>Registrado por: ${achado.criadoPor}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }
    </div>
    `
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      <p>Relatório gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
      <p>Sistema HC Quality — Auditoria Interna DICQ 1.3</p>

      <div class="signature-box">
        <div>
          <div class="signature-line"></div>
          <div class="signature-label">Auditor</div>
        </div>
        <div>
          <div class="signature-line"></div>
          <div class="signature-label">RT Responsável</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Callable: generateInternalAuditReportPDF
 *
 * Generates a PDF report of an internal audit session (checklist + achados).
 * Returns a signed Cloud Storage URL valid for 1 week.
 *
 * Note: renamed from generateAuditReportPDF to avoid conflict with the
 * anomaly-based generateAuditReportPDF in generateReportPDF.ts.
 */
export const generateInternalAuditReportPDF = onCall(
  { region: 'southamerica-east1', cors: true, memory: '2GiB', timeoutSeconds: 300 },
  async (request: CallableRequest<GeneratePDFInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    let input: GeneratePDFInputType;
    try {
      input = GeneratePDFInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    const isMember = await isActiveMemberOfLab(input.labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    let browser: Browser | null = null;

    try {
      // Fetch audit data
      const { auditoria, sessao, checklistItems, achados } = await fetchAuditData(
        input.labId,
        input.auditoriaId,
        input.sessaoId
      );

      // Get lab name
      const labSnap = await db.collection('labs').doc(input.labId).get();
      const labName = (labSnap.data()?.name as string) || 'Laboratório Desconhecido';

      // Generate HTML
      const html = generateHTML(auditoria, sessao, checklistItems, achados, labName);

      // Lazy-load puppeteer so this 200MB module only loads when generation is invoked.
      const { default: puppeteer } = await import('puppeteer');

      // Launch Puppeteer browser
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

      // Check PDF size
      const pdfSizeKB = pdfBuffer.length / 1024;
      const pdfSizeMB = pdfSizeKB / 1024;

      if (pdfSizeMB > 10) {
        throw new HttpsError(
          'resource-exhausted',
          `PDF size (${pdfSizeMB.toFixed(2)}MB) exceeds 10MB limit`
        );
      }

      // Upload to Cloud Storage
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `audits/${input.labId}/${input.auditoriaId}/relatorio-${input.sessaoId}-${timestamp}.pdf`;
      const bucket = storage.bucket('hmatologia2.appspot.com');
      const file = bucket.file(filename);

      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            labId: input.labId,
            auditoriaId: input.auditoriaId,
            sessaoId: input.sessaoId,
            generatedAt: new Date().toISOString(),
          },
        },
      });

      // Generate signed URL (valid for 7 days)
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      // Audit log
      await db.collection('auditLogs').add({
        action: 'GENERATE_AUDIT_REPORT_PDF',
        callerUid: request.auth.uid,
        labId: input.labId,
        auditoriaId: input.auditoriaId,
        sessaoId: input.sessaoId,
        pdfSizeMB: Number(pdfSizeMB.toFixed(2)),
        pdfUrl: signedUrl,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        pdfUrl: signedUrl,
        pdfSizeMB: Number(pdfSizeMB.toFixed(2)),
        filename,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      console.error('PDF generation error:', error);
      throw new HttpsError('internal', `Erro ao gerar PDF: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
);
