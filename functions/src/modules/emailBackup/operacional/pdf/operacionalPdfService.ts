import PDFDocument = require('pdfkit');
import {
  COLOR,
  CONTENT_WIDTH,
  FONT_SIZES,
  Fonts,
  PAGE,
  detectEnvironment,
  environmentHashPrefix,
  initPdfFonts,
  isNonProduction,
  renderEnvironmentBanner,
  renderEnvironmentWatermark,
  safeBottomY,
  type PdfEnvironment,
} from '../../services/pdf/layout';
import type { OperacionalReport } from '../types';
import {
  drawKpiGrid,
  drawStatusPill,
  themeForStatus,
} from './components';
import { renderQcSection } from './qcSection';
import { renderRastreabilidadeSection } from './rastreabilidadeSection';
import { renderAuditSection } from './auditSection';

// ─── Relatório Operacional — PDF principal ───────────────────────────────────
//
// Estrutura:
//   Capa                    — identidade + KPIs globais + status por seção
//   Seção 1 — QC Decisions
//   Seção 2 — Rastreabilidade
//   Seção 3 — Audit Log
//   Integridade             — SHA-256, metadados, disclaimer RDC/LGPD

function formatDateBR(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatDateTimeBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

export function generateOperacionalPdf(report: OperacionalReport): Promise<Buffer> {
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
        Title: `Relatório Operacional HC Quality — ${report.labName}`,
        Author: 'HC Quality',
        Subject: `Período: ${formatDateBR(report.periodStart)} – ${formatDateBR(report.periodEnd)}`,
        Creator: 'HC Quality Operacional Module',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    initPdfFonts(doc);

    const env = detectEnvironment();
    if (isNonProduction(env)) {
      renderEnvironmentWatermark(doc, env);
      doc.on('pageAdded', () => renderEnvironmentWatermark(doc, env));
    }

    renderCoverPage(doc, report, env);
    renderQcSection(doc, report);
    renderRastreabilidadeSection(doc, report);
    renderAuditSection(doc, report);
    renderIntegrityPage(doc, report, env);

    doc.end();
  });
}

// ─── Capa ────────────────────────────────────────────────────────────────────

function renderCoverPage(
  doc: PDFKit.PDFDocument,
  report: OperacionalReport,
  env: PdfEnvironment,
): void {
  const { margin } = PAGE;
  const contentWidth = CONTENT_WIDTH;

  doc.rect(0, 0, PAGE.width, 8).fill(COLOR.accent);

  const bannerHeight = renderEnvironmentBanner(doc, margin, 14, contentWidth, env);
  const headerOffset = bannerHeight;

  // Wordmark
  doc
    .font(Fonts.bold)
    .fontSize(11)
    .fillColor(COLOR.accent)
    .text('HC QUALITY · OPERACIONAL', margin, 28 + headerOffset, {
      characterSpacing: 0.5,
    });

  doc
    .font(Fonts.regular)
    .fontSize(9)
    .fillColor(COLOR.textMuted)
    .text(
      'Decisões QC · Rastreabilidade · Audit Log',
      margin,
      42 + headerOffset,
    );

  doc
    .moveTo(margin, 62 + headerOffset)
    .lineTo(PAGE.width - margin, 62 + headerOffset)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  // Título
  doc
    .font(Fonts.bold)
    .fontSize(FONT_SIZES.h1)
    .fillColor(COLOR.textPrimary)
    .text('Relatório Operacional', margin, 90 + headerOffset, {
      characterSpacing: -0.4,
    });

  doc
    .font(Fonts.regular)
    .fontSize(13)
    .fillColor(COLOR.textMuted)
    .text(
      'Instrumento de decisão diária do responsável técnico',
      margin,
      118 + headerOffset,
      { characterSpacing: -0.1 },
    );

  // Pill de status global — grande, ancorada no canto direito
  drawStatusPill(
    doc,
    margin + contentWidth,
    92 + headerOffset,
    report.globalStatus,
    'right',
  );

  // Card do laboratório
  const cardY = 165 + headerOffset;
  const cardPaddingX = 16;
  const cardHeaderH = 42;
  const cardLineH = 14;
  const cardBottomPad = 12;

  type CardLine = { label: string; value: string; missing: boolean };
  const cardLines: CardLine[] = [
    { label: 'CNPJ', value: report.labCnpj ?? '— não cadastrado', missing: !report.labCnpj },
    {
      label: 'Endereço',
      value: report.labAddress ?? '— não cadastrado',
      missing: !report.labAddress,
    },
    {
      label: 'RT',
      value: report.responsibleTech
        ? `${report.responsibleTech.name} — ${report.responsibleTech.registration}`
        : '— não cadastrado',
      missing: !report.responsibleTech,
    },
    {
      label: 'Licença Sanitária',
      value: report.sanitaryLicense
        ? `${report.sanitaryLicense.number} — vigente até ${report.sanitaryLicense.validUntil}`
        : '— não cadastrada',
      missing: !report.sanitaryLicense,
    },
    { label: 'ID', value: report.labId, missing: false },
  ];

  const cardHeight = cardHeaderH + cardLines.length * cardLineH + cardBottomPad;

  doc
    .roundedRect(margin, cardY, contentWidth, cardHeight, 6)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  doc
    .font(Fonts.bold)
    .fontSize(8)
    .fillColor(COLOR.textMuted)
    .text('LABORATÓRIO', margin + cardPaddingX, cardY + 14, { characterSpacing: 0.4 });

  doc
    .font(Fonts.bold)
    .fontSize(16)
    .fillColor(COLOR.textPrimary)
    .text(report.labName, margin + cardPaddingX, cardY + 24, {
      width: contentWidth - cardPaddingX * 2,
      lineBreak: false,
      ellipsis: true,
    });

  let lineY = cardY + cardHeaderH + 6;
  for (const line of cardLines) {
    doc
      .font(Fonts.bold)
      .fontSize(7.5)
      .fillColor(COLOR.textMuted)
      .text(line.label.toUpperCase(), margin + cardPaddingX, lineY, {
        width: 110,
        lineBreak: false,
        characterSpacing: 0.3,
      });

    doc
      .font(Fonts.regular)
      .fontSize(9.5)
      .fillColor(line.missing ? COLOR.danger : COLOR.textPrimary)
      .text(line.value, margin + cardPaddingX + 115, lineY - 1, {
        width: contentWidth - cardPaddingX * 2 - 115,
        lineBreak: false,
        ellipsis: true,
      });

    lineY += cardLineH;
  }

  // Período
  const periodY = cardY + cardHeight + 20;
  doc
    .font(Fonts.bold)
    .fontSize(8)
    .fillColor(COLOR.textMuted)
    .text('PERÍODO', margin, periodY, {
      width: contentWidth,
      align: 'center',
      characterSpacing: 0.5,
    });

  doc
    .font(Fonts.bold)
    .fontSize(14)
    .fillColor(COLOR.textPrimary)
    .text(
      `${formatDateBR(report.periodStart)}  –  ${formatDateBR(report.periodEnd)}`,
      margin,
      periodY + 16,
      { width: contentWidth, align: 'center' },
    );

  // KPI executivo (4 cards)
  const kpiY = periodY + 60;
  const approvalRate = report.qcDecisions.globalApprovalRate;
  const approvalColor =
    approvalRate === null
      ? COLOR.textMuted
      : approvalRate >= 85
        ? COLOR.success
        : approvalRate >= 70
          ? COLOR.accentWarm
          : COLOR.danger;

  drawKpiGrid(doc, margin, kpiY, contentWidth, [
    {
      label: 'Corridas CIQ',
      value: String(report.qcDecisions.totalRuns),
      sublabel: `${report.qcDecisions.modules.length} módulo(s)`,
    },
    {
      label: 'Taxa de aprovação',
      value: approvalRate !== null ? `${approvalRate.toFixed(1)}%` : '—',
      valueColor: approvalColor,
    },
    {
      label: 'Alertas críticos',
      value: String(
        report.rastreabilidade.alertsCount.critical +
          report.auditLog.bySeverity.critical,
      ),
      valueColor:
        report.rastreabilidade.alertsCount.critical +
          report.auditLog.bySeverity.critical ===
        0
          ? COLOR.success
          : COLOR.danger,
    },
    {
      label: 'Lotes em uso',
      value: String(report.rastreabilidade.activeLots.length),
    },
  ]);

  // Status por seção — mini-matriz
  const summaryY = kpiY + 90;
  const rows: Array<{ label: string; status: typeof report.globalStatus; detail: string }> = [
    {
      label: '1. QC Decisions',
      status: report.qcDecisions.status,
      detail:
        report.qcDecisions.statusReasons.length > 0
          ? report.qcDecisions.statusReasons[0]
          : 'Sem sinais negativos no período.',
    },
    {
      label: '2. Rastreabilidade',
      status: report.rastreabilidade.status,
      detail: `${report.rastreabilidade.alertsCount.critical} crítico(s) · ${report.rastreabilidade.alertsCount.warning} aviso(s)`,
    },
    {
      label: '3. Audit Log',
      status: report.auditLog.status,
      detail: report.auditLog.collectionActive
        ? `${report.auditLog.totalEvents} evento(s) · chain ${report.auditLog.chain.valid ? 'íntegra' : 'COMPROMETIDA'}`
        : 'Coleta inicia em deploy.',
    },
  ];

  const sumHeaderH = 20;
  const sumRowH = 26;
  const sumTotalH = sumHeaderH + rows.length * sumRowH + 10;

  doc
    .roundedRect(margin, summaryY, contentWidth, sumTotalH, 6)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  doc
    .font(Fonts.bold)
    .fontSize(7.5)
    .fillColor(COLOR.textMuted)
    .text('PANORAMA POR SEÇÃO', margin + 14, summaryY + 8, {
      characterSpacing: 0.4,
    });

  let rowY = summaryY + sumHeaderH + 4;
  for (const r of rows) {
    const theme = themeForStatus(r.status);
    // Dot
    doc.save();
    doc.circle(margin + 20, rowY + 8, 3).fill(theme.fg);
    doc.restore();

    doc
      .font(Fonts.bold)
      .fontSize(10)
      .fillColor(COLOR.textPrimary)
      .text(r.label, margin + 32, rowY, {
        width: 140,
        lineBreak: false,
      });

    doc
      .font(Fonts.regular)
      .fontSize(FONT_SIZES.small)
      .fillColor(COLOR.textMuted)
      .text(r.detail, margin + 180, rowY, {
        width: contentWidth - 280,
        lineBreak: false,
        ellipsis: true,
      });

    doc
      .font(Fonts.bold)
      .fontSize(8)
      .fillColor(theme.fg)
      .text(theme.label, margin + contentWidth - 90, rowY, {
        width: 76,
        align: 'right',
        lineBreak: false,
        characterSpacing: 0.5,
      });

    rowY += sumRowH;
  }

  // Generation metadata
  doc
    .font(Fonts.regular)
    .fontSize(8)
    .fillColor(COLOR.textMuted)
    .text(
      `Gerado em ${formatDateTimeBR(report.generatedAt)} · HC Quality Operacional Module`,
      margin,
      PAGE.height - 55,
      { width: contentWidth, align: 'center' },
    );

  // Bottom accent
  doc.rect(0, PAGE.height - 8, PAGE.width, 8).fill(COLOR.accent);
}

// ─── Integridade ─────────────────────────────────────────────────────────────

function renderIntegrityPage(
  doc: PDFKit.PDFDocument,
  report: OperacionalReport,
  env: PdfEnvironment,
): void {
  doc.addPage();
  const { margin } = PAGE;
  const contentWidth = CONTENT_WIDTH;

  const disclaimer =
    'HC Quality — Relatório Operacional · Este documento é uma ferramenta de decisão diária do RT; ' +
    'os registros primários e auditáveis permanecem no sistema conforme RDC 978/2025 e LGPD. ' +
    'Descarte mensal recomendado após consumo pela chefia técnica.';

  const renderTop = (): number => {
    doc.rect(0, 0, PAGE.width, 4).fill(COLOR.accent);
    doc
      .font(Fonts.bold)
      .fontSize(14)
      .fillColor(COLOR.textPrimary)
      .text('Integridade e Autenticidade', margin, 24, { characterSpacing: -0.2 });

    doc
      .font(Fonts.regular)
      .fontSize(9)
      .fillColor(COLOR.textMuted)
      .text(
        'Hash derivado do conteúdo deste relatório — permite verificar se o PDF não foi alterado após gerado. ' +
          'Hash chain do audit log incluído separadamente.',
        margin,
        46,
        { width: contentWidth, lineGap: 2 },
      );

    return 96;
  };

  let cursorY = renderTop();

  // Hash do relatório operacional
  const hashBoxH = 56;
  doc
    .roundedRect(margin, cursorY, contentWidth, hashBoxH, 6)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();
  doc
    .font(Fonts.bold)
    .fontSize(7)
    .fillColor(COLOR.textMuted)
    .text('SHA-256 DO CONTEÚDO', margin + 12, cursorY + 10, { characterSpacing: 0.4 });
  const hashDisplay = `${environmentHashPrefix(env)}${report.contentHash}`;
  doc
    .font(Fonts.bold)
    .fontSize(9)
    .fillColor(COLOR.accent)
    .text(hashDisplay, margin + 12, cursorY + 25, {
      width: contentWidth - 24,
    });
  cursorY += hashBoxH + 22;

  // Hash chain do audit log
  const chainValid = report.auditLog.chain.valid;
  const chainBoxH = 56;
  doc
    .roundedRect(margin, cursorY, contentWidth, chainBoxH, 6)
    .lineWidth(0.7)
    .strokeColor(chainValid ? COLOR.success : COLOR.danger)
    .stroke();
  doc
    .font(Fonts.bold)
    .fontSize(7)
    .fillColor(COLOR.textMuted)
    .text('AUDIT CHAIN', margin + 12, cursorY + 10, { characterSpacing: 0.4 });
  doc
    .font(Fonts.bold)
    .fontSize(12)
    .fillColor(chainValid ? COLOR.success : COLOR.danger)
    .text(
      report.auditLog.collectionActive
        ? chainValid
          ? `ÍNTEGRA — ${report.auditLog.chain.eventsVerified} evento(s) verificado(s)`
          : `COMPROMETIDA — ${report.auditLog.chain.breaks.length} quebra(s)`
        : 'Coleta ainda não iniciada (writer em deploy)',
      margin + 12,
      cursorY + 22,
      { width: contentWidth - 24, lineBreak: false, ellipsis: true },
    );
  cursorY += chainBoxH + 22;

  // Metadata table
  const metaRows: Array<[string, string, boolean]> = [
    ['Laboratório', report.labName, false],
    ['Lab ID', report.labId, false],
    ['CNPJ', report.labCnpj ?? '— não cadastrado', !report.labCnpj],
    ['Endereço', report.labAddress ?? '— não cadastrado', !report.labAddress],
    [
      'Responsável Técnico',
      report.responsibleTech
        ? `${report.responsibleTech.name} — ${report.responsibleTech.registration}`
        : '— não cadastrado',
      !report.responsibleTech,
    ],
    [
      'Licença Sanitária',
      report.sanitaryLicense
        ? `${report.sanitaryLicense.number} — vigente até ${report.sanitaryLicense.validUntil}`
        : '— não cadastrada',
      !report.sanitaryLicense,
    ],
    ['Período início', formatDateBR(report.periodStart), false],
    ['Período fim', formatDateBR(report.periodEnd), false],
    ['Gerado em', formatDateTimeBR(report.generatedAt), false],
    [
      'Status global',
      themeForStatus(report.globalStatus).label,
      report.globalStatus !== 'ok',
    ],
    [
      'Corridas CIQ',
      `${report.qcDecisions.totalRuns} (aprov. ${report.qcDecisions.totalApproved} / rejeit. ${report.qcDecisions.totalRejected})`,
      false,
    ],
    [
      'Lotes rastreados',
      `${report.rastreabilidade.activeLots.length} ativos · ${report.rastreabilidade.closedLots.length} encerrados`,
      false,
    ],
    [
      'Eventos auditáveis',
      report.auditLog.collectionActive
        ? `${report.auditLog.totalEvents} evento(s)`
        : 'Coleta em deploy',
      !report.auditLog.collectionActive,
    ],
  ];

  const metaRowH = 20;
  for (let i = 0; i < metaRows.length; i++) {
    if (cursorY + metaRowH > safeBottomY()) {
      doc.addPage();
      cursorY = renderTop();
    }
    const [label, value, emphasized] = metaRows[i];
    if (i % 2 === 0) {
      doc.rect(margin, cursorY, contentWidth, metaRowH).fill(COLOR.rowAlt);
    }
    doc
      .font(Fonts.bold)
      .fontSize(8)
      .fillColor(COLOR.textMuted)
      .text(label, margin + 10, cursorY + 6, { width: contentWidth * 0.3 });
    doc
      .font(Fonts.regular)
      .fontSize(8)
      .fillColor(emphasized ? COLOR.danger : COLOR.textPrimary)
      .text(value, margin + contentWidth * 0.32, cursorY + 6, {
        width: contentWidth * 0.68 - 10,
        ellipsis: true,
        lineBreak: false,
      });
    cursorY += metaRowH;
  }

  // Disclaimer
  doc.font(Fonts.regular).fontSize(7.5);
  const opts = { width: contentWidth, align: 'center' as const, lineGap: 2 };
  const dH = doc.heightOfString(disclaimer, opts);
  const dY = PAGE.height - 20 - dH;
  if (cursorY + 10 > dY) {
    doc.addPage();
    renderTop();
  }
  doc
    .font(Fonts.regular)
    .fontSize(7.5)
    .fillColor(COLOR.textMuted)
    .text(disclaimer, margin, dY, opts);

  doc.rect(0, PAGE.height - 8, PAGE.width, 8).fill(COLOR.accent);
}
