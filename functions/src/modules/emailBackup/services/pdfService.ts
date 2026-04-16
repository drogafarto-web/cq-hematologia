import PDFDocument from 'pdfkit';
import { createHash } from 'crypto';
import type { BackupReport, ModuleBackupSection } from '../types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const FONT_REGULAR = 'Helvetica';
const FONT_BOLD    = 'Helvetica-Bold';

const COLOR = {
  bg:           '#0d0d0d',
  surface:      '#161616',
  border:       '#2a2a2a',
  accent:       '#3b82f6',   // blue-500
  accentWarm:   '#f59e0b',   // amber-500 (warning)
  danger:       '#ef4444',   // red-500 (critical)
  success:      '#22c55e',   // green-500
  textPrimary:  '#f4f4f5',
  textMuted:    '#71717a',
  white:        '#ffffff',
  rowAlt:       '#1c1c1c',
} as const;

const PAGE = {
  margin: 40,
  width:  595.28,  // A4
  height: 841.89,  // A4
} as const;

// ─── PDF Generator ────────────────────────────────────────────────────────────

/**
 * Generates a backup PDF from a BackupReport.
 * Returns a Buffer (suitable for email attachment).
 *
 * Structure:
 *   Cover page  — lab identity, period, generation metadata
 *   Per module  — section header + summary table + data table
 *   Footer page — SHA-256 integrity hash + generation note
 */
export function generateBackupPdf(report: BackupReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:    'A4',
      margins: {
        top:    PAGE.margin,
        bottom: PAGE.margin,
        left:   PAGE.margin,
        right:  PAGE.margin,
      },
      info: {
        Title:    `Backup HC Quality — ${report.labName}`,
        Author:   'HC Quality',
        Subject:  `Período: ${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}`,
        Creator:  'HC Quality Backup Module',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Cover page ───────────────────────────────────────────────────────────
    renderCoverPage(doc, report);

    // ── Module sections ──────────────────────────────────────────────────────
    for (const section of report.sections) {
      doc.addPage();
      renderModuleSection(doc, section, report);
    }

    // ── Integrity footer page ────────────────────────────────────────────────
    if (report.sections.length > 0 || report.stalenessAlerts.length > 0) {
      doc.addPage();
      renderIntegrityPage(doc, report);
    }

    doc.end();
  });
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function renderCoverPage(doc: PDFKit.PDFDocument, report: BackupReport): void {
  const { margin } = PAGE;
  const contentWidth = PAGE.width - margin * 2;

  // Header bar
  doc
    .rect(0, 0, PAGE.width, 8)
    .fill(COLOR.accent);

  // HC Quality wordmark
  doc
    .font(FONT_BOLD)
    .fontSize(11)
    .fillColor(COLOR.accent)
    .text('HC QUALITY', margin, 28);

  doc
    .font(FONT_REGULAR)
    .fontSize(9)
    .fillColor(COLOR.textMuted)
    .text('Sistema de Controle de Qualidade', margin, 42);

  // Divider
  doc
    .moveTo(margin, 62)
    .lineTo(PAGE.width - margin, 62)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  // Title block
  doc
    .font(FONT_BOLD)
    .fontSize(22)
    .fillColor(COLOR.textPrimary)
    .text('Backup de Dados', margin, 90);

  doc
    .font(FONT_REGULAR)
    .fontSize(13)
    .fillColor(COLOR.textMuted)
    .text('Relatório de Redundância — Exportação Automatizada', margin, 118);

  // Lab info card
  const cardY = 165;
  doc
    .roundedRect(margin, cardY, contentWidth, 110, 6)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  doc
    .font(FONT_BOLD)
    .fontSize(8)
    .fillColor(COLOR.textMuted)
    .text('LABORATÓRIO', margin + 16, cardY + 14);

  doc
    .font(FONT_BOLD)
    .fontSize(16)
    .fillColor(COLOR.textPrimary)
    .text(report.labName, margin + 16, cardY + 28);

  if (report.labCnpj) {
    doc
      .font(FONT_REGULAR)
      .fontSize(10)
      .fillColor(COLOR.textMuted)
      .text(`CNPJ: ${report.labCnpj}`, margin + 16, cardY + 52);
  }

  doc
    .font(FONT_REGULAR)
    .fontSize(10)
    .fillColor(COLOR.textMuted)
    .text(`ID: ${report.labId}`, margin + 16, cardY + (report.labCnpj ? 68 : 52));

  // Period badge
  const periodY = 305;
  const midX = margin + contentWidth / 2;

  doc
    .font(FONT_BOLD)
    .fontSize(8)
    .fillColor(COLOR.textMuted)
    .text('PERÍODO', margin, periodY, { width: contentWidth / 3, align: 'center' });

  doc
    .font(FONT_BOLD)
    .fontSize(14)
    .fillColor(COLOR.textPrimary)
    .text(
      `${formatDate(report.periodStart)}  →  ${formatDate(report.periodEnd)}`,
      margin, periodY + 16, { width: contentWidth, align: 'center' },
    );

  // Stats summary
  const totalRuns = report.sections.reduce((sum, s) => sum + s.totalRuns, 0);
  const totalNonConforming = report.sections.reduce((sum, s) => sum + s.nonConformingRuns, 0);

  renderStatGrid(doc, margin, 370, contentWidth, [
    { label: 'Módulos com dados', value: String(report.sections.length) },
    { label: 'Total de corridas', value: String(totalRuns) },
    { label: 'Não conformidades', value: String(totalNonConforming) },
    { label: 'Alertas de inatividade', value: String(report.stalenessAlerts.length) },
  ]);

  // Staleness alerts on cover if any
  if (report.stalenessAlerts.length > 0) {
    const alertY = 480;

    doc
      .rect(margin, alertY, contentWidth, 20)
      .fill(report.stalenessAlerts.some(a => a.level === 'critical')
        ? '#3b0f0f'
        : '#3b2c0a',
      );

    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(report.stalenessAlerts.some(a => a.level === 'critical')
        ? COLOR.danger
        : COLOR.accentWarm,
      )
      .text(
        `⚠  ${report.stalenessAlerts.length} alerta(s) de inatividade detectado(s) — ver página de integridade`,
        margin + 12, alertY + 6,
        { width: contentWidth - 24 },
      );

    let alertOffset = alertY + 26;
    for (const alert of report.stalenessAlerts) {
      const alertColor = alert.level === 'critical' ? COLOR.danger : COLOR.accentWarm;
      const daysStr = isFinite(alert.daysSinceLastRun)
        ? `${alert.daysSinceLastRun} dias sem registros`
        : 'nenhum registro encontrado';
      doc
        .font(FONT_REGULAR)
        .fontSize(9)
        .fillColor(alertColor)
        .text(`• ${alert.moduleName}: ${daysStr}`, margin + 12, alertOffset);
      alertOffset += 14;
    }
  }

  // Generation metadata
  doc
    .font(FONT_REGULAR)
    .fontSize(8)
    .fillColor(COLOR.textMuted)
    .text(
      `Gerado em: ${new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}  ·  HC Quality Backup Module`,
      margin, PAGE.height - 55,
      { width: contentWidth, align: 'center' },
    );

  // Bottom accent bar
  doc
    .rect(0, PAGE.height - 8, PAGE.width, 8)
    .fill(COLOR.accent);
}

// ─── Module Section ───────────────────────────────────────────────────────────

function renderModuleSection(
  doc: PDFKit.PDFDocument,
  section: ModuleBackupSection,
  report: BackupReport,
): void {
  const { margin } = PAGE;
  const contentWidth = PAGE.width - margin * 2;

  // Top accent bar for module
  doc
    .rect(0, 0, PAGE.width, 4)
    .fill(COLOR.accent);

  // Module header
  doc
    .font(FONT_BOLD)
    .fontSize(8)
    .fillColor(COLOR.accent)
    .text('MÓDULO', margin, 18);

  doc
    .font(FONT_BOLD)
    .fontSize(16)
    .fillColor(COLOR.textPrimary)
    .text(section.moduleName, margin, 30);

  // Period + lab
  doc
    .font(FONT_REGULAR)
    .fontSize(9)
    .fillColor(COLOR.textMuted)
    .text(
      `${report.labName}  ·  ${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}`,
      margin, 50,
    );

  // Summary stats
  const summaryEntries = Object.entries(section.summary);
  const colWidth = contentWidth / Math.min(summaryEntries.length, 4);
  let summaryX = margin;
  const summaryY = 75;

  for (let i = 0; i < summaryEntries.length; i++) {
    const [label, value] = summaryEntries[i];
    if (i > 0 && i % 4 === 0) {
      summaryX = margin;
    }

    doc
      .roundedRect(summaryX, summaryY + Math.floor(i / 4) * 55, colWidth - 8, 48, 4)
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();

    doc
      .font(FONT_BOLD)
      .fontSize(16)
      .fillColor(COLOR.textPrimary)
      .text(value, summaryX + 8, summaryY + Math.floor(i / 4) * 55 + 8, {
        width: colWidth - 16,
        align: 'left',
      });

    doc
      .font(FONT_REGULAR)
      .fontSize(7)
      .fillColor(COLOR.textMuted)
      .text(label.toUpperCase(), summaryX + 8, summaryY + Math.floor(i / 4) * 55 + 30, {
        width: colWidth - 16,
      });

    summaryX += colWidth;
  }

  const tableRows = Math.ceil(summaryEntries.length / 4);
  const tableStartY = summaryY + tableRows * 55 + 16;

  // Divider
  doc
    .moveTo(margin, tableStartY)
    .lineTo(PAGE.width - margin, tableStartY)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  // Data table
  renderDataTable(doc, section.columns, section.rows, tableStartY + 10, contentWidth);

  // Page footer
  renderPageFooter(doc, report);
}

// ─── Data Table ───────────────────────────────────────────────────────────────

function renderDataTable(
  doc: PDFKit.PDFDocument,
  columns: string[],
  rows: Array<Record<string, string>>,
  startY: number,
  contentWidth: number,
): void {
  const { margin } = PAGE;
  const colWidth   = contentWidth / columns.length;
  const rowHeight  = 16;
  const headerH    = 20;

  // Header row
  doc
    .rect(margin, startY, contentWidth, headerH)
    .fill('#1a1a2e');

  for (let i = 0; i < columns.length; i++) {
    doc
      .font(FONT_BOLD)
      .fontSize(6.5)
      .fillColor(COLOR.textMuted)
      .text(
        columns[i].toUpperCase(),
        margin + i * colWidth + 4,
        startY + 7,
        { width: colWidth - 8, ellipsis: true },
      );
  }

  let currentY = startY + headerH;

  // Guard against rendering past bottom margin
  const maxY = PAGE.height - PAGE.margin - 30;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    if (currentY + rowHeight > maxY) {
      // Add a new page and restart the table with column headers
      doc.addPage();

      // Reset accent bar
      doc
        .rect(0, 0, PAGE.width, 4)
        .fill(COLOR.accent);

      currentY = PAGE.margin + 10;

      // Continuation header
      doc
        .font(FONT_BOLD)
        .fontSize(7)
        .fillColor(COLOR.textMuted)
        .text('(continuação)', margin, currentY);

      currentY += 14;

      // Re-render column headers
      doc
        .rect(margin, currentY, contentWidth, headerH)
        .fill('#1a1a2e');

      for (let i = 0; i < columns.length; i++) {
        doc
          .font(FONT_BOLD)
          .fontSize(6.5)
          .fillColor(COLOR.textMuted)
          .text(
            columns[i].toUpperCase(),
            margin + i * colWidth + 4,
            currentY + 7,
            { width: colWidth - 8, ellipsis: true },
          );
      }

      currentY += headerH;
    }

    const row = rows[rowIdx];
    const isAlt = rowIdx % 2 === 1;

    if (isAlt) {
      doc
        .rect(margin, currentY, contentWidth, rowHeight)
        .fill(COLOR.rowAlt);
    }

    // Highlight non-conforming rows
    const conformidade = row['Conformidade'] ?? row['Status'] ?? '';
    if (conformidade === 'NÃO CONFORME' || conformidade === 'Rejeitada') {
      doc
        .rect(margin, currentY, 3, rowHeight)
        .fill(COLOR.danger);
    }

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const val = row[col] ?? '—';

      // Color-code specific values
      let cellColor = COLOR.textPrimary;
      if (val === 'Conforme' || val === 'Aprovada')    cellColor = COLOR.success;
      if (val === 'NÃO CONFORME' || val === 'Rejeitada') cellColor = COLOR.danger;
      if (val === 'Pendente')                           cellColor = COLOR.accentWarm;

      doc
        .font(FONT_REGULAR)
        .fontSize(6.5)
        .fillColor(cellColor)
        .text(
          val,
          margin + i * colWidth + 5,
          currentY + 5,
          { width: colWidth - 10, ellipsis: true },
        );
    }

    currentY += rowHeight;
  }

  if (rows.length === 0) {
    doc
      .font(FONT_REGULAR)
      .fontSize(9)
      .fillColor(COLOR.textMuted)
      .text('Nenhuma corrida registrada no período.', margin, currentY + 8);
  }
}

// ─── Integrity Page ───────────────────────────────────────────────────────────

function renderIntegrityPage(doc: PDFKit.PDFDocument, report: BackupReport): void {
  const { margin } = PAGE;
  const contentWidth = PAGE.width - margin * 2;

  doc
    .rect(0, 0, PAGE.width, 4)
    .fill(COLOR.accent);

  doc
    .font(FONT_BOLD)
    .fontSize(14)
    .fillColor(COLOR.textPrimary)
    .text('Integridade e Autenticidade', margin, 24);

  doc
    .font(FONT_REGULAR)
    .fontSize(9)
    .fillColor(COLOR.textMuted)
    .text(
      'Este documento foi gerado automaticamente pelo módulo de backup do HC Quality. ' +
      'O hash abaixo é derivado do conteúdo de todos os registros incluídos neste relatório ' +
      'e pode ser usado para verificar a integridade do arquivo em auditorias futuras.',
      margin, 46, { width: contentWidth },
    );

  // Hash display
  const hashY = 100;
  doc
    .roundedRect(margin, hashY, contentWidth, 56, 6)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  doc
    .font(FONT_BOLD)
    .fontSize(7)
    .fillColor(COLOR.textMuted)
    .text('SHA-256 DO CONTEÚDO', margin + 12, hashY + 10);

  doc
    .font(FONT_BOLD)
    .fontSize(9)
    .fillColor(COLOR.accent)
    .text(report.contentHash, margin + 12, hashY + 25, {
      width: contentWidth - 24,
      lineBreak: true,
    });

  // Metadata table
  const metaY = 178;
  const metaRows: Array<[string, string]> = [
    ['Laboratório',      report.labName],
    ['Lab ID',           report.labId],
    ['CNPJ',             report.labCnpj ?? '—'],
    ['Período início',   report.periodStart.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    ['Período fim',      report.periodEnd.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    ['Gerado em',        new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    ['Módulos incluídos', report.sections.map(s => s.moduleName).join('; ') || '—'],
    ['Total de corridas', String(report.sections.reduce((s, m) => s + m.totalRuns, 0))],
  ];

  for (let i = 0; i < metaRows.length; i++) {
    const [label, value] = metaRows[i];
    const rowY = metaY + i * 20;
    if (i % 2 === 0) {
      doc.rect(margin, rowY, contentWidth, 20).fill(COLOR.rowAlt);
    }
    doc
      .font(FONT_BOLD)
      .fontSize(8)
      .fillColor(COLOR.textMuted)
      .text(label, margin + 10, rowY + 6, { width: contentWidth * 0.3 });
    doc
      .font(FONT_REGULAR)
      .fontSize(8)
      .fillColor(COLOR.textPrimary)
      .text(value, margin + contentWidth * 0.32, rowY + 6, {
        width: contentWidth * 0.68 - 10,
        ellipsis: true,
      });
  }

  // Staleness alerts section
  if (report.stalenessAlerts.length > 0) {
    const alertSectionY = metaY + metaRows.length * 20 + 24;

    doc
      .font(FONT_BOLD)
      .fontSize(10)
      .fillColor(COLOR.textPrimary)
      .text('Alertas de Inatividade', margin, alertSectionY);

    let alertY = alertSectionY + 18;
    for (const alert of report.stalenessAlerts) {
      const isCritical = alert.level === 'critical';
      const alertColor = isCritical ? COLOR.danger : COLOR.accentWarm;
      const bgColor    = isCritical ? '#3b0f0f' : '#3b2c0a';
      const daysStr = isFinite(alert.daysSinceLastRun)
        ? `${alert.daysSinceLastRun} dia(s) sem registros`
        : 'nenhum registro encontrado';
      const lastStr = alert.lastRunAt
        ? ` — último em ${new Date(alert.lastRunAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
        : '';

      doc.rect(margin, alertY, contentWidth, 28).fill(bgColor);
      doc
        .font(FONT_BOLD)
        .fontSize(9)
        .fillColor(alertColor)
        .text(`${isCritical ? '🔴' : '🟡'} ${alert.moduleName}`, margin + 10, alertY + 6);
      doc
        .font(FONT_REGULAR)
        .fontSize(8)
        .fillColor(alertColor)
        .text(`${daysStr}${lastStr}`, margin + 10, alertY + 18);

      alertY += 34;
    }
  }

  // Disclaimer
  doc
    .font(FONT_REGULAR)
    .fontSize(7.5)
    .fillColor(COLOR.textMuted)
    .text(
      'HC Quality — Backup Automático  ·  Este documento não substitui os registros primários armazenados no sistema. ' +
      'Conservar em local seguro de acordo com a política de retenção de dados da instituição (RDC 978/2025, LGPD).',
      margin, PAGE.height - 55,
      { width: contentWidth, align: 'center' },
    );

  doc
    .rect(0, PAGE.height - 8, PAGE.width, 8)
    .fill(COLOR.accent);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderStatGrid(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  stats: Array<{ label: string; value: string }>,
): void {
  const colW = width / stats.length;

  for (let i = 0; i < stats.length; i++) {
    doc
      .roundedRect(x + i * colW, y, colW - 8, 60, 4)
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();

    doc
      .font(FONT_BOLD)
      .fontSize(20)
      .fillColor(COLOR.textPrimary)
      .text(stats[i].value, x + i * colW + 10, y + 10, {
        width: colW - 20,
        align: 'left',
      });

    doc
      .font(FONT_REGULAR)
      .fontSize(7.5)
      .fillColor(COLOR.textMuted)
      .text(stats[i].label.toUpperCase(), x + i * colW + 10, y + 38, {
        width: colW - 20,
      });
  }
}

function renderPageFooter(doc: PDFKit.PDFDocument, report: BackupReport): void {
  doc
    .font(FONT_REGULAR)
    .fontSize(7)
    .fillColor(COLOR.textMuted)
    .text(
      `HC Quality  ·  ${report.labName}  ·  Gerado em ${new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      PAGE.margin, PAGE.height - 28,
      { width: PAGE.width - PAGE.margin * 2, align: 'center' },
    );

  doc
    .rect(0, PAGE.height - 8, PAGE.width, 8)
    .fill(COLOR.accent);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// ─── Content Hash ─────────────────────────────────────────────────────────────

/**
 * Computes a SHA-256 fingerprint of the report content.
 * Used both as a tamper-evidence mechanism and as a unique identifier
 * for deduplication if the backup runs more than once for the same period.
 */
export function computeContentHash(report: Omit<BackupReport, 'contentHash'>): string {
  const payload = JSON.stringify({
    labId:       report.labId,
    periodStart: report.periodStart.toISOString(),
    periodEnd:   report.periodEnd.toISOString(),
    sections:    report.sections.map(s => ({
      moduleId:   s.moduleId,
      totalRuns:  s.totalRuns,
      rows:       s.rows,
    })),
  });
  return createHash('sha256').update(payload).digest('hex');
}
