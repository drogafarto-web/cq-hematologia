import {
  COLOR,
  CONTENT_WIDTH,
  FONT_SIZES,
  Fonts,
  PAGE,
  safeBottomY,
} from '../../services/pdf/layout';
import type { OperacionalReport, QCDecisionSection, QCModuleStats } from '../types';
import {
  drawKpiGrid,
  drawSectionTitle,
  drawStatusPill,
  drawTableHeader,
  drawTableRows,
  themeForStatus,
  type SimpleColumn,
} from './components';

// ─── Seção 1 — QC Decisions ──────────────────────────────────────────────────

function formatPp(delta: number | null): string {
  if (delta === null) return '—';
  const sign = delta > 0 ? '+' : delta < 0 ? '' : '';
  return `${sign}${delta.toFixed(1)}pp`;
}

function trendColor(delta: number | null): string {
  if (delta === null) return COLOR.textMuted;
  if (delta >= 0) return COLOR.success;
  if (delta > -5) return COLOR.textPrimary;
  if (delta > -10) return COLOR.accentWarm;
  return COLOR.danger;
}

function approvalColor(rate: number): string {
  if (rate >= 85) return COLOR.success;
  if (rate >= 70) return COLOR.accentWarm;
  return COLOR.danger;
}

function renderPageChrome(
  doc: PDFKit.PDFDocument,
  continuation: boolean,
): number {
  doc.rect(0, 0, PAGE.width, 4).fill(COLOR.accent);
  let y = PAGE.margin;
  if (continuation) {
    doc
      .font(Fonts.bold)
      .fontSize(FONT_SIZES.micro)
      .fillColor(COLOR.textMuted)
      .text('QC Decisions — continuação', PAGE.margin, y, {
        width: CONTENT_WIDTH,
        lineBreak: false,
        ellipsis: true,
      });
    y += 16;
  }
  return y;
}

function renderModuleCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  module: QCModuleStats,
): number {
  const cardHeight = 94;

  doc.roundedRect(x, y, width, cardHeight, 6).fillColor('#131316').fill();
  doc
    .roundedRect(x, y, width, cardHeight, 6)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  // Nome
  doc
    .font(Fonts.bold)
    .fontSize(9)
    .fillColor(COLOR.accent)
    .text('MÓDULO', x + 14, y + 12, { characterSpacing: 0.4 });

  doc
    .font(Fonts.bold)
    .fontSize(13)
    .fillColor(COLOR.textPrimary)
    .text(module.moduleName, x + 14, y + 22, {
      width: width - 28,
      lineBreak: false,
      ellipsis: true,
      characterSpacing: -0.2,
    });

  // Taxa de aprovação — KPI principal
  const approvalY = y + 46;
  doc
    .font(Fonts.bold)
    .fontSize(28)
    .fillColor(approvalColor(module.approvalRate))
    .text(`${module.approvalRate.toFixed(1)}%`, x + 14, approvalY, {
      width: width - 28,
      lineBreak: false,
    });

  doc
    .font(Fonts.regular)
    .fontSize(FONT_SIZES.micro)
    .fillColor(COLOR.textMuted)
    .text('Taxa de aprovação 30d', x + 14, approvalY + 32, {
      characterSpacing: 0.3,
    });

  // Tendência 7d à direita
  const trendX = x + width - 110;
  doc
    .font(Fonts.bold)
    .fontSize(14)
    .fillColor(trendColor(module.trendDeltaPp))
    .text(formatPp(module.trendDeltaPp), trendX, approvalY + 4, {
      width: 96,
      align: 'right',
      lineBreak: false,
    });
  doc
    .font(Fonts.regular)
    .fontSize(FONT_SIZES.micro)
    .fillColor(COLOR.textMuted)
    .text('7d vs 30d', trendX, approvalY + 22, {
      width: 96,
      align: 'right',
      lineBreak: false,
    });
  doc
    .font(Fonts.regular)
    .fontSize(FONT_SIZES.micro)
    .fillColor(COLOR.textMuted)
    .text(`${module.totalRuns} corrida(s) · ${module.rejected} rejeição(ões)`, trendX, approvalY + 34, {
      width: 96,
      align: 'right',
      lineBreak: false,
    });

  return y + cardHeight;
}

function renderStatusBanner(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  section: QCDecisionSection,
): number {
  const theme = themeForStatus(section.status);
  const height = 44;
  doc.roundedRect(x, y, width, height, 6).fill(theme.bg);
  doc.roundedRect(x, y, width, height, 6).lineWidth(0.7).strokeColor(theme.border).stroke();

  doc
    .font(Fonts.bold)
    .fontSize(9)
    .fillColor(theme.fg)
    .text(`STATUS QC — ${theme.label}`, x + 14, y + 10, { characterSpacing: 0.5 });

  const message =
    section.statusReasons.length > 0
      ? section.statusReasons.slice(0, 3).join(' · ')
      : 'Nenhum sinal negativo detectado no período.';

  doc
    .font(Fonts.regular)
    .fontSize(FONT_SIZES.small)
    .fillColor(COLOR.textPrimary)
    .text(message, x + 14, y + 24, {
      width: width - 28,
      lineBreak: false,
      ellipsis: true,
    });

  return y + height;
}

export function renderQcSection(
  doc: PDFKit.PDFDocument,
  report: OperacionalReport,
): void {
  const x = PAGE.margin;
  const width = CONTENT_WIDTH;
  const section = report.qcDecisions;

  let y = renderPageChrome(doc, false);

  // Cabeçalho da seção
  y = drawSectionTitle(
    doc,
    x,
    y + 10,
    width,
    'Seção 1 de 3',
    'QC Decisions',
    'Decisões do CIQ no período: taxa de aprovação, tendência 7d, ranking de operadores e lotes problemáticos.',
  );

  // Pill de status ancorada ao canto superior direito
  drawStatusPill(doc, x + width, PAGE.margin - 2, section.status, 'right');

  // Banner de status com razões
  y = renderStatusBanner(doc, x, y + 4, width, section) + 14;

  // KPIs globais
  y =
    drawKpiGrid(doc, x, y, width, [
      {
        label: 'Corridas no período',
        value: String(section.totalRuns),
        sublabel: `${section.modules.length} módulo(s)`,
      },
      {
        label: 'Taxa de aprovação',
        value:
          section.globalApprovalRate !== null
            ? `${section.globalApprovalRate.toFixed(1)}%`
            : '—',
        valueColor:
          section.globalApprovalRate !== null
            ? approvalColor(section.globalApprovalRate)
            : COLOR.textMuted,
        sublabel: `${section.totalApproved} aprovada(s)`,
      },
      {
        label: 'Rejeições',
        value: String(section.totalRejected),
        valueColor: section.totalRejected === 0 ? COLOR.success : COLOR.danger,
      },
      {
        label: 'Lotes problemáticos',
        value: String(section.problematicLots.length),
        valueColor:
          section.problematicLots.length === 0 ? COLOR.success : COLOR.accentWarm,
        sublabel:
          section.problematicLots.filter((l) => l.shouldSegregate).length > 0
            ? `${section.problematicLots.filter((l) => l.shouldSegregate).length} p/ segregar`
            : undefined,
      },
    ]) + 18;

  // Cards por módulo (2 por linha)
  if (section.modules.length > 0) {
    const gap = 10;
    const cardW = (width - gap) / 2;
    for (let i = 0; i < section.modules.length; i += 2) {
      const left = section.modules[i];
      const right = section.modules[i + 1];
      if (y + 100 > safeBottomY()) {
        doc.addPage();
        y = renderPageChrome(doc, true);
      }
      const leftBottom = renderModuleCard(doc, x, y, cardW, left);
      const rightBottom = right
        ? renderModuleCard(doc, x + cardW + gap, y, cardW, right)
        : leftBottom;
      y = Math.max(leftBottom, rightBottom) + 14;
    }
  }

  // Top violações Westgard (unificado cross-módulo)
  const westgardAgg = new Map<string, number>();
  for (const m of section.modules) {
    for (const [v, c] of Object.entries(m.westgardViolationsCount)) {
      westgardAgg.set(v, (westgardAgg.get(v) ?? 0) + c);
    }
  }
  const topWestgard = Array.from(westgardAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topWestgard.length > 0) {
    if (y + 80 > safeBottomY()) {
      doc.addPage();
      y = renderPageChrome(doc, true);
    }
    doc
      .font(Fonts.bold)
      .fontSize(11)
      .fillColor(COLOR.textPrimary)
      .text('Top violações Westgard', x, y);
    y += 18;

    const barHeight = 14;
    const maxCount = topWestgard[0][1] || 1;
    for (const [code, count] of topWestgard) {
      if (y + barHeight > safeBottomY()) {
        doc.addPage();
        y = renderPageChrome(doc, true);
      }
      const barW = (count / maxCount) * (width - 120);
      doc
        .font(Fonts.bold)
        .fontSize(FONT_SIZES.small)
        .fillColor(COLOR.textPrimary)
        .text(code, x, y, { width: 60, lineBreak: false });

      doc.rect(x + 60, y + 2, barW, 10).fill(COLOR.accentWarm);

      doc
        .font(Fonts.bold)
        .fontSize(FONT_SIZES.small)
        .fillColor(COLOR.textMuted)
        .text(`${count}×`, x + width - 40, y, { width: 40, align: 'right', lineBreak: false });
      y += barHeight + 4;
    }
    y += 10;
  }

  // Ranking operadores
  const operatorsColumns: SimpleColumn[] = [
    { key: 'operator', label: 'Operador', weight: 2.0 },
    { key: 'role', label: 'Cargo', weight: 0.9 },
    { key: 'runs', label: 'Runs', weight: 0.6, align: 'right' },
    { key: 'rejections', label: 'Rejeições', weight: 0.8, align: 'right' },
    {
      key: 'rate',
      label: 'Taxa rej.',
      weight: 0.8,
      align: 'right',
      color: (v, row) => (row['outlier'] === '1' ? COLOR.danger : COLOR.textPrimary),
    },
  ];

  const operatorRows = section.operatorRanking.slice(0, 10).map((o) => ({
    operator: o.isOutlier ? `★ ${o.operatorName}` : o.operatorName,
    role: o.operatorRole,
    runs: String(o.runsProcessed),
    rejections: String(o.rejections),
    rate: `${o.rejectionRate.toFixed(1)}%`,
    outlier: o.isOutlier ? '1' : '0',
  }));

  if (operatorRows.length > 0) {
    if (y + 60 > safeBottomY()) {
      doc.addPage();
      y = renderPageChrome(doc, true);
    }
    doc
      .font(Fonts.bold)
      .fontSize(11)
      .fillColor(COLOR.textPrimary)
      .text('Ranking de operadores', x, y);
    y += 16;

    y = drawTableHeader(doc, x, y, width, operatorsColumns);
    y = drawTableRows(
      doc,
      x,
      y,
      width,
      operatorsColumns,
      operatorRows,
      () => {
        doc.addPage();
        const chromeY = renderPageChrome(doc, true);
        return drawTableHeader(doc, x, chromeY + 10, width, operatorsColumns);
      },
      {
        accentLeftColor: (row) => (row['outlier'] === '1' ? COLOR.danger : null),
      },
    );
    y += 14;
  }

  // Lotes problemáticos
  if (section.problematicLots.length > 0) {
    if (y + 60 > safeBottomY()) {
      doc.addPage();
      y = renderPageChrome(doc, true);
    }
    doc
      .font(Fonts.bold)
      .fontSize(11)
      .fillColor(COLOR.textPrimary)
      .text('Lotes problemáticos', x, y);
    y += 16;

    const lotColumns: SimpleColumn[] = [
      { key: 'lot', label: 'Lote', weight: 1.3, monospace: true },
      { key: 'product', label: 'Produto', weight: 2.0 },
      { key: 'module', label: 'Módulo', weight: 1.2 },
      { key: 'runs', label: 'Runs', weight: 0.6, align: 'right' },
      { key: 'rej', label: 'Rejeições', weight: 0.8, align: 'right' },
      {
        key: 'rate',
        label: 'Taxa rej.',
        weight: 0.8,
        align: 'right',
        color: (_v, row) =>
          row['segregate'] === '1' ? COLOR.danger : COLOR.accentWarm,
      },
    ];
    const lotRows = section.problematicLots.map((l) => ({
      lot: l.lotNumber,
      product: l.product,
      module: l.moduleId,
      runs: String(l.totalRuns),
      rej: String(l.rejections),
      rate: `${l.rejectionRate.toFixed(1)}%`,
      segregate: l.shouldSegregate ? '1' : '0',
    }));

    y = drawTableHeader(doc, x, y, width, lotColumns);
    y = drawTableRows(
      doc,
      x,
      y,
      width,
      lotColumns,
      lotRows,
      () => {
        doc.addPage();
        const chromeY = renderPageChrome(doc, true);
        return drawTableHeader(doc, x, chromeY + 10, width, lotColumns);
      },
      {
        accentLeftColor: (row) =>
          row['segregate'] === '1' ? COLOR.danger : COLOR.accentWarm,
      },
    );
  }
}
