import PDFDocument = require('pdfkit');
import { createHash } from 'crypto';
import type { BackupReport, ColumnSpec, ModuleBackupSection } from '../types';
import {
  COLOR,
  CONTENT_WIDTH,
  FONT_BOLD,
  FONT_REGULAR,
  FONT_SIZES,
  PAGE,
  detectEnvironment,
  drawAlertBadge,
  drawWarningTriangle,
  environmentHashPrefix,
  isNonProduction,
  renderEnvironmentBanner,
  renderEnvironmentWatermark,
  safeBottomY,
  type PdfEnvironment,
} from './pdf/layout';

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
      size: 'A4',
      margins: {
        top: PAGE.margin,
        bottom: PAGE.margin,
        left: PAGE.margin,
        right: PAGE.margin,
      },
      info: {
        Title: `Backup HC Quality — ${report.labName}`,
        Author: 'HC Quality',
        Subject: `Período: ${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}`,
        Creator: 'HC Quality Backup Module',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Environment watermark (auto em cada página) ──────────────────────────
    const env = detectEnvironment();
    if (isNonProduction(env)) {
      // Primeira página já foi criada pelo construtor — marca agora.
      renderEnvironmentWatermark(doc, env);
      doc.on('pageAdded', () => renderEnvironmentWatermark(doc, env));
    }

    // ── Cover page ───────────────────────────────────────────────────────────
    renderCoverPage(doc, report, env);

    // ── Module sections ──────────────────────────────────────────────────────
    for (const section of report.sections) {
      doc.addPage();
      renderModuleSection(doc, section, report);
    }

    // ── Integrity footer page ────────────────────────────────────────────────
    if (report.sections.length > 0 || report.stalenessAlerts.length > 0) {
      doc.addPage();
      renderIntegrityPage(doc, report, env);
    }

    doc.end();
  });
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function renderCoverPage(
  doc: PDFKit.PDFDocument,
  report: BackupReport,
  env: PdfEnvironment,
): void {
  const { margin } = PAGE;
  const contentWidth = CONTENT_WIDTH;

  // Header bar
  doc.rect(0, 0, PAGE.width, 8).fill(COLOR.accent);

  // Environment banner (apenas em não-produção; empurra o conteúdo para baixo)
  const bannerHeight = renderEnvironmentBanner(doc, margin, 14, contentWidth, env);
  const headerOffset = bannerHeight;

  // HC Quality wordmark
  doc
    .font(FONT_BOLD)
    .fontSize(11)
    .fillColor(COLOR.accent)
    .text('HC QUALITY', margin, 28 + headerOffset);

  doc
    .font(FONT_REGULAR)
    .fontSize(9)
    .fillColor(COLOR.textMuted)
    .text('Sistema de Controle de Qualidade', margin, 42 + headerOffset);

  // Divider
  doc
    .moveTo(margin, 62 + headerOffset)
    .lineTo(PAGE.width - margin, 62 + headerOffset)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  // Title block
  doc
    .font(FONT_BOLD)
    .fontSize(FONT_SIZES.h1)
    .fillColor(COLOR.textPrimary)
    .text('Backup de Dados', margin, 90 + headerOffset);

  doc
    .font(FONT_REGULAR)
    .fontSize(13)
    .fillColor(COLOR.textMuted)
    .text('Relatório de Redundância — Exportação Automatizada', margin, 118 + headerOffset);

  // Lab info card
  const cardY = 165 + headerOffset;
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
  const periodY = 305 + headerOffset;
  doc
    .font(FONT_BOLD)
    .fontSize(8)
    .fillColor(COLOR.textMuted)
    .text('PERÍODO', margin, periodY, { width: contentWidth / 3, align: 'center' });

  // en-dash (U+2013) é WinAnsi-safe; evita o arrow U+2192 que quebra em Helvetica padrão
  doc
    .font(FONT_BOLD)
    .fontSize(14)
    .fillColor(COLOR.textPrimary)
    .text(
      `${formatDate(report.periodStart)}  \u2013  ${formatDate(report.periodEnd)}`,
      margin,
      periodY + 16,
      { width: contentWidth, align: 'center' },
    );

  // Stats summary
  const totalRuns = report.sections.reduce((sum, s) => sum + s.totalRuns, 0);
  const totalNonConforming = report.sections.reduce((sum, s) => sum + s.nonConformingRuns, 0);

  renderStatGrid(doc, margin, 370 + headerOffset, contentWidth, [
    { label: 'Módulos com dados', value: String(report.sections.length) },
    { label: 'Total de corridas', value: String(totalRuns) },
    { label: 'Não conformidades', value: String(totalNonConforming) },
    { label: 'Alertas de inatividade', value: String(report.stalenessAlerts.length) },
  ]);

  // Staleness alerts on cover if any
  if (report.stalenessAlerts.length > 0) {
    const alertY = 480 + headerOffset;
    const hasCritical = report.stalenessAlerts.some((a) => a.level === 'critical');
    const bannerColor = hasCritical ? COLOR.dangerBg : COLOR.warningBg;
    const textColor = hasCritical ? COLOR.danger : COLOR.accentWarm;

    doc.rect(margin, alertY, contentWidth, 22).fill(bannerColor);

    // Triângulo vetorial de aviso (substitui emoji ⚠ que quebra em Helvetica/WinAnsi)
    drawWarningTriangle(doc, margin + 10, alertY + 6, 11);

    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(textColor)
      .text(
        `${report.stalenessAlerts.length} alerta(s) de inatividade detectado(s) — ver página de integridade`,
        margin + 28,
        alertY + 7,
        { width: contentWidth - 40, lineBreak: false, ellipsis: true },
      );

    let alertOffset = alertY + 30;
    for (const alert of report.stalenessAlerts) {
      const alertColor = alert.level === 'critical' ? COLOR.danger : COLOR.accentWarm;
      const daysStr = isFinite(alert.daysSinceLastRun)
        ? `${alert.daysSinceLastRun} dias sem registros`
        : 'nenhum registro encontrado';

      drawAlertBadge(doc, margin + 14, alertOffset + 2, alert.level, 3);

      doc
        .font(FONT_REGULAR)
        .fontSize(9)
        .fillColor(alertColor)
        .text(`${alert.moduleName}: ${daysStr}`, margin + 26, alertOffset, {
          width: contentWidth - 40,
          lineBreak: false,
          ellipsis: true,
        });
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
      margin,
      PAGE.height - 55,
      { width: contentWidth, align: 'center' },
    );

  // Bottom accent bar
  doc.rect(0, PAGE.height - 8, PAGE.width, 8).fill(COLOR.accent);
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
  doc.rect(0, 0, PAGE.width, 4).fill(COLOR.accent);

  // Module header
  doc.font(FONT_BOLD).fontSize(8).fillColor(COLOR.accent).text('MÓDULO', margin, 18);

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
      margin,
      50,
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

  // Data table — dispatcher: dual-row se tableLayout presente, senão legacy
  renderModuleTable(doc, section, tableStartY + 10, contentWidth);

  // Page footer
  renderPageFooter(doc, report);
}

/**
 * Dispatcher: escolhe entre render dual-row (layout refinado) ou
 * render legado (equal-width single-row) baseado em `tableLayout`.
 */
function renderModuleTable(
  doc: PDFKit.PDFDocument,
  section: ModuleBackupSection,
  startY: number,
  contentWidth: number,
): void {
  if (section.tableLayout) {
    renderDualRowTable(doc, section, startY, contentWidth);
  } else {
    renderDataTable(doc, section.columns, section.rows, startY, contentWidth);
  }
}

/**
 * Computa posições (x, largura) para um conjunto de colunas com pesos
 * relativos, dentro de uma largura total disponível.
 */
function computeColumnLayout(
  columns: ColumnSpec[],
  originX: number,
  totalWidth: number,
): Array<{ col: ColumnSpec; x: number; width: number }> {
  const totalWeight = columns.reduce((sum, c) => sum + (c.weight ?? 1), 0) || 1;
  const out: Array<{ col: ColumnSpec; x: number; width: number }> = [];
  let cursorX = originX;
  for (const col of columns) {
    const width = ((col.weight ?? 1) / totalWeight) * totalWidth;
    out.push({ col, x: cursorX, width });
    cursorX += width;
  }
  return out;
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
  const colWidth = contentWidth / columns.length;
  const rowHeight = 16;
  const headerH = 20;

  // Header row
  doc.rect(margin, startY, contentWidth, headerH).fill('#1a1a2e');

  for (let i = 0; i < columns.length; i++) {
    doc
      .font(FONT_BOLD)
      .fontSize(6.5)
      .fillColor(COLOR.textMuted)
      .text(columns[i].toUpperCase(), margin + i * colWidth + 4, startY + 7, {
        width: colWidth - 8,
        ellipsis: true,
      });
  }

  let currentY = startY + headerH;

  // Guard against rendering past bottom margin
  const maxY = PAGE.height - PAGE.margin - 30;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    if (currentY + rowHeight > maxY) {
      // Add a new page and restart the table with column headers
      doc.addPage();

      // Reset accent bar
      doc.rect(0, 0, PAGE.width, 4).fill(COLOR.accent);

      currentY = PAGE.margin + 10;

      // Continuation header
      doc
        .font(FONT_BOLD)
        .fontSize(7)
        .fillColor(COLOR.textMuted)
        .text('(continuação)', margin, currentY);

      currentY += 14;

      // Re-render column headers
      doc.rect(margin, currentY, contentWidth, headerH).fill('#1a1a2e');

      for (let i = 0; i < columns.length; i++) {
        doc
          .font(FONT_BOLD)
          .fontSize(6.5)
          .fillColor(COLOR.textMuted)
          .text(columns[i].toUpperCase(), margin + i * colWidth + 4, currentY + 7, {
            width: colWidth - 8,
            ellipsis: true,
          });
      }

      currentY += headerH;
    }

    const row = rows[rowIdx];
    const isAlt = rowIdx % 2 === 1;

    if (isAlt) {
      doc.rect(margin, currentY, contentWidth, rowHeight).fill(COLOR.rowAlt);
    }

    // Highlight non-conforming rows
    const conformidade = row['Conformidade'] ?? row['Status'] ?? '';
    if (conformidade === 'NÃO CONFORME' || conformidade === 'Rejeitada') {
      doc.rect(margin, currentY, 3, rowHeight).fill(COLOR.danger);
    }

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const val = row[col] ?? '—';

      // Color-code specific values
      let cellColor: string = COLOR.textPrimary;
      if (val === 'Conforme' || val === 'Aprovada') cellColor = COLOR.success;
      if (val === 'NÃO CONFORME' || val === 'Rejeitada') cellColor = COLOR.danger;
      if (val === 'Pendente') cellColor = COLOR.accentWarm;

      doc
        .font(FONT_REGULAR)
        .fontSize(6.5)
        .fillColor(cellColor)
        .text(val, margin + i * colWidth + 5, currentY + 5, {
          width: colWidth - 10,
          ellipsis: true,
        });
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

// ─── Dual-row Data Table ──────────────────────────────────────────────────────
//
// Layout de corrida em duas linhas lógicas:
//   Linha 1 (primary):   colunas técnicas destacadas, com pesos
//   Linha 2 (secondary): rastreabilidade inline, fonte menor e cor muted
//
// Permite que tabelas com 12+ colunas caibam em A4 retrato sem truncar.

function renderDualRowTable(
  doc: PDFKit.PDFDocument,
  section: ModuleBackupSection,
  startY: number,
  contentWidth: number,
): void {
  const { margin } = PAGE;
  const layout = section.tableLayout!;
  const primarySpecs = layout.primary;
  const secondarySpecs = layout.secondary ?? [];
  const hasSecondary = secondarySpecs.length > 0;

  const primaryCols = computeColumnLayout(primarySpecs, margin, contentWidth);

  const headerH = 22;
  const primaryRowH = 16;
  const secondaryRowH = hasSecondary ? 14 : 0;
  const totalRowH = primaryRowH + secondaryRowH;
  const rowSeparatorY = 0.5;

  // Estado de paginação: redesenha cabeçalho ao trocar página.
  const drawHeader = (y: number): number => {
    doc.rect(margin, y, contentWidth, headerH).fill('#1a1a2e');
    for (const { col, x, width } of primaryCols) {
      const label = (col.shortLabel ?? col.key).toUpperCase();
      doc
        .font(FONT_BOLD)
        .fontSize(FONT_SIZES.tableHead)
        .fillColor(COLOR.textMuted)
        .text(label, x + 4, y + 8, {
          width: width - 8,
          align: col.align ?? 'left',
          lineBreak: false,
          ellipsis: true,
        });
    }
    return y + headerH;
  };

  const rewindForPage = (): number => {
    doc.addPage();
    doc.rect(0, 0, PAGE.width, 4).fill(COLOR.accent);

    let y = PAGE.margin + 10;
    doc
      .font(FONT_BOLD)
      .fontSize(FONT_SIZES.micro)
      .fillColor(COLOR.textMuted)
      .text(`${section.moduleName} (continuação)`, margin, y, {
        width: contentWidth,
        lineBreak: false,
        ellipsis: true,
      });
    y += 16;
    return drawHeader(y);
  };

  let cursorY = drawHeader(startY);

  if (section.rows.length === 0) {
    doc
      .font(FONT_REGULAR)
      .fontSize(FONT_SIZES.small)
      .fillColor(COLOR.textMuted)
      .text('Nenhuma corrida registrada no período.', margin, cursorY + 10);
    return;
  }

  for (let rowIdx = 0; rowIdx < section.rows.length; rowIdx++) {
    if (cursorY + totalRowH > safeBottomY()) {
      cursorY = rewindForPage();
    }

    const row = section.rows[rowIdx];
    const isAlt = rowIdx % 2 === 1;

    // Fundo zebrado da linha dupla
    if (isAlt) {
      doc.rect(margin, cursorY, contentWidth, totalRowH).fill(COLOR.rowAlt);
    }

    // Barra vermelha à esquerda para não-conformidades
    const statusVal = row['Conformidade'] ?? row['Status'] ?? '';
    if (statusVal === 'NÃO CONFORME' || statusVal === 'Rejeitada') {
      doc.rect(margin, cursorY, 3, totalRowH).fill(COLOR.danger);
    }

    // ── Linha 1 — primary ──────────────────────────────────────────────
    for (const { col, x, width } of primaryCols) {
      const val = row[col.key] ?? '—';
      let cellColor: string = COLOR.textPrimary;
      if (val === 'Conforme' || val === 'Aprovada') cellColor = COLOR.success;
      else if (val === 'NÃO CONFORME' || val === 'Rejeitada') cellColor = COLOR.danger;
      else if (val === 'Pendente') cellColor = COLOR.accentWarm;

      doc
        .font(FONT_BOLD)
        .fontSize(FONT_SIZES.table)
        .fillColor(cellColor)
        .text(val, x + 5, cursorY + 4, {
          width: width - 10,
          align: col.align ?? 'left',
          lineBreak: false,
          ellipsis: true,
        });
    }

    // ── Linha 2 — secondary (metadados inline, muted, fonte menor) ──────
    if (hasSecondary) {
      const secondaryY = cursorY + primaryRowH;

      // Separador fino entre as duas linhas lógicas
      doc
        .moveTo(margin + 4, secondaryY)
        .lineTo(margin + contentWidth - 4, secondaryY)
        .lineWidth(rowSeparatorY)
        .strokeColor(COLOR.border)
        .stroke();

      // Monta labels inline: "Eq.: — · Op.: Dra. Maria · Sig: abc123…"
      const parts: Array<{ label: string; value: string }> = secondarySpecs.map((c) => ({
        label: (c.shortLabel ?? c.key).replace(/:$/u, ''),
        value: row[c.key] ?? '—',
      }));

      doc.font(FONT_REGULAR).fontSize(FONT_SIZES.micro).fillColor(COLOR.textMuted);

      let inlineX = margin + 6;
      const inlineMaxX = margin + contentWidth - 6;
      const inlineY = secondaryY + 3;
      const separator = '  \u00b7  '; // middle-dot espaçado

      for (let i = 0; i < parts.length; i++) {
        const { label, value } = parts[i];
        const fragmentLabel = `${label}: `;
        const fragmentValue = value;
        const fullFragment = fragmentLabel + fragmentValue + (i < parts.length - 1 ? separator : '');

        const fragmentWidth = doc.widthOfString(fullFragment);
        if (inlineX + fragmentWidth > inlineMaxX) {
          // Pulou o orçamento horizontal — escreve o que couber com ellipsis e sai
          const remaining = inlineMaxX - inlineX;
          doc.text('…', inlineX, inlineY, {
            width: Math.max(remaining, 6),
            lineBreak: false,
            ellipsis: true,
          });
          break;
        }

        // Label em tom ainda mais muted
        doc.fillColor('#52525b').text(fragmentLabel, inlineX, inlineY, { lineBreak: false });
        inlineX += doc.widthOfString(fragmentLabel);

        // Valor em textMuted
        doc.fillColor(COLOR.textMuted).text(fragmentValue, inlineX, inlineY, { lineBreak: false });
        inlineX += doc.widthOfString(fragmentValue);

        if (i < parts.length - 1) {
          doc.fillColor(COLOR.border).text(separator, inlineX, inlineY, { lineBreak: false });
          inlineX += doc.widthOfString(separator);
        }
      }
    }

    cursorY += totalRowH;
  }
}

// ─── Integrity Page ───────────────────────────────────────────────────────────

function renderIntegrityPage(
  doc: PDFKit.PDFDocument,
  report: BackupReport,
  env: PdfEnvironment,
): void {
  const { margin } = PAGE;
  const contentWidth = CONTENT_WIDTH;

  const disclaimerText =
    'HC Quality \u2014 Backup Automático  \u00b7  Este documento não substitui os registros primários armazenados no sistema. ' +
    'Conservar em local seguro de acordo com a política de retenção de dados da instituição (RDC 978/2025, LGPD).';

  const renderTopChrome = (): number => {
    doc.rect(0, 0, PAGE.width, 4).fill(COLOR.accent);

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
        margin,
        46,
        { width: contentWidth },
      );

    return 100; // próxima Y livre (abaixo do parágrafo introdutório)
  };

  let cursorY = renderTopChrome();

  // Hash display
  const hashBoxHeight = 56;
  doc
    .roundedRect(margin, cursorY, contentWidth, hashBoxHeight, 6)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  doc
    .font(FONT_BOLD)
    .fontSize(7)
    .fillColor(COLOR.textMuted)
    .text('SHA-256 DO CONTEÚDO', margin + 12, cursorY + 10);

  const hashDisplay = `${environmentHashPrefix(env)}${report.contentHash}`;
  doc
    .font(FONT_BOLD)
    .fontSize(9)
    .fillColor(COLOR.accent)
    .text(hashDisplay, margin + 12, cursorY + 25, {
      width: contentWidth - 24,
      lineBreak: true,
    });

  cursorY += hashBoxHeight + 22;

  // Metadata table
  const metaRows: Array<[string, string]> = [
    ['Laboratório', report.labName],
    ['Lab ID', report.labId],
    ['CNPJ', report.labCnpj ?? '—'],
    [
      'Período início',
      report.periodStart.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    ],
    [
      'Período fim',
      report.periodEnd.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    ],
    [
      'Gerado em',
      new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    ],
    ['Módulos incluídos', report.sections.map((s) => s.moduleName).join('; ') || '—'],
    ['Total de corridas', String(report.sections.reduce((s, m) => s + m.totalRuns, 0))],
  ];

  const metaRowH = 20;

  for (let i = 0; i < metaRows.length; i++) {
    if (cursorY + metaRowH > safeBottomY()) {
      doc.addPage();
      cursorY = renderTopChrome();
    }
    const [label, value] = metaRows[i];
    if (i % 2 === 0) {
      doc.rect(margin, cursorY, contentWidth, metaRowH).fill(COLOR.rowAlt);
    }
    doc
      .font(FONT_BOLD)
      .fontSize(8)
      .fillColor(COLOR.textMuted)
      .text(label, margin + 10, cursorY + 6, { width: contentWidth * 0.3 });
    doc
      .font(FONT_REGULAR)
      .fontSize(8)
      .fillColor(COLOR.textPrimary)
      .text(value, margin + contentWidth * 0.32, cursorY + 6, {
        width: contentWidth * 0.68 - 10,
        ellipsis: true,
      });
    cursorY += metaRowH;
  }

  // Staleness alerts section
  if (report.stalenessAlerts.length > 0) {
    const headerBlockH = 24;
    const alertBlockH = 34;
    const totalAlertsBlockH = headerBlockH + report.stalenessAlerts.length * alertBlockH;

    // Se não couber junto, empurra para a próxima página
    if (cursorY + totalAlertsBlockH > safeBottomY()) {
      doc.addPage();
      cursorY = renderTopChrome();
    }

    cursorY += 8;
    doc
      .font(FONT_BOLD)
      .fontSize(10)
      .fillColor(COLOR.textPrimary)
      .text('Alertas de Inatividade', margin, cursorY);
    cursorY += 18;

    for (const alert of report.stalenessAlerts) {
      if (cursorY + alertBlockH > safeBottomY()) {
        doc.addPage();
        cursorY = renderTopChrome();
      }
      const isCritical = alert.level === 'critical';
      const alertColor = isCritical ? COLOR.danger : COLOR.accentWarm;
      const bgColor = isCritical ? COLOR.dangerBg : COLOR.warningBg;
      const daysStr = isFinite(alert.daysSinceLastRun)
        ? `${alert.daysSinceLastRun} dia(s) sem registros`
        : 'nenhum registro encontrado';
      const lastStr = alert.lastRunAt
        ? ` \u2014 último em ${new Date(alert.lastRunAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
        : '';

      doc.rect(margin, cursorY, contentWidth, 28).fill(bgColor);

      // Badge vetorial (substitui emojis 🔴/🟡 que quebram em Helvetica)
      drawAlertBadge(doc, margin + 10, cursorY + 9, alert.level, 4);

      doc
        .font(FONT_BOLD)
        .fontSize(9)
        .fillColor(alertColor)
        .text(alert.moduleName, margin + 26, cursorY + 6, {
          width: contentWidth - 40,
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .font(FONT_REGULAR)
        .fontSize(8)
        .fillColor(alertColor)
        .text(`${daysStr}${lastStr}`, margin + 26, cursorY + 18, {
          width: contentWidth - 40,
          lineBreak: false,
          ellipsis: true,
        });

      cursorY += alertBlockH;
    }
  }

  // Disclaimer — mede antes de posicionar para não vazar para próxima página
  doc.font(FONT_REGULAR).fontSize(7.5);
  const disclaimerHeight = doc.heightOfString(disclaimerText, {
    width: contentWidth,
    align: 'center',
  });
  const disclaimerY = PAGE.height - 20 - disclaimerHeight;

  // Se o conteúdo acima colidir com o disclaimer, empurra para nova página
  if (cursorY + 10 > disclaimerY) {
    doc.addPage();
    renderTopChrome();
  }

  doc
    .font(FONT_REGULAR)
    .fontSize(7.5)
    .fillColor(COLOR.textMuted)
    .text(disclaimerText, margin, disclaimerY, { width: contentWidth, align: 'center' });

  doc.rect(0, PAGE.height - 8, PAGE.width, 8).fill(COLOR.accent);
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
      PAGE.margin,
      PAGE.height - 28,
      { width: PAGE.width - PAGE.margin * 2, align: 'center' },
    );

  doc.rect(0, PAGE.height - 8, PAGE.width, 8).fill(COLOR.accent);
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
    labId: report.labId,
    periodStart: report.periodStart.toISOString(),
    periodEnd: report.periodEnd.toISOString(),
    sections: report.sections.map((s) => ({
      moduleId: s.moduleId,
      totalRuns: s.totalRuns,
      rows: s.rows,
    })),
  });
  return createHash('sha256').update(payload).digest('hex');
}
