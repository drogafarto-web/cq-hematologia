import {
  COLOR,
  CONTENT_WIDTH,
  FONT_SIZES,
  Fonts,
  PAGE,
  safeBottomY,
} from '../../services/pdf/layout';
import type {
  LotAlertCode,
  LotLifecycleRecord,
  OperacionalReport,
} from '../types';
import {
  drawKpiGrid,
  drawSectionTitle,
  drawStatusPill,
  drawTableHeader,
  drawTableRows,
  type SimpleColumn,
} from './components';

// ─── Seção 2 — Rastreabilidade de Insumos ────────────────────────────────────

const ALERT_LABEL: Record<LotAlertCode, string> = {
  EXPIRED_IN_USE: 'VALIDADE VENCIDA',
  OPENED_WITHOUT_DATE: 'SEM DATA DE ABERTURA',
  MISSING_ANVISA_REG: 'ANVISA AUSENTE',
  POST_OPENING_EXPIRED: 'PÓS-ABERTURA EXPIRADO',
  HIGH_REJECTION_RATE: 'REJEIÇÃO ELEVADA',
  SEGREGATED: 'LOTE SEGREGADO',
};

function formatDateBR(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function renderPageChrome(doc: PDFKit.PDFDocument, continuation: boolean): number {
  doc.rect(0, 0, PAGE.width, 4).fill(COLOR.accent);
  let y = PAGE.margin;
  if (continuation) {
    doc
      .font(Fonts.bold)
      .fontSize(FONT_SIZES.micro)
      .fillColor(COLOR.textMuted)
      .text('Rastreabilidade — continuação', PAGE.margin, y, {
        width: CONTENT_WIDTH,
        lineBreak: false,
        ellipsis: true,
      });
    y += 16;
  }
  return y;
}

function rowForLot(record: LotLifecycleRecord): Record<string, string> {
  const alertsPriority = record.alerts.reduce((acc, a) => {
    if (a.severity === 'critical') return 'critical';
    if (a.severity === 'warning' && acc !== 'critical') return 'warning';
    return acc;
  }, 'none' as 'critical' | 'warning' | 'none');

  const alertsLabel =
    record.alerts.length === 0
      ? '—'
      : record.alerts
          .map((a) => ALERT_LABEL[a.code])
          .slice(0, 2)
          .join(' · ');

  return {
    lote: record.lotNumber,
    produto: `${record.nomeComercial} (${record.fabricante})`,
    tipo: record.tipo,
    anvisa: record.registroAnvisa ?? '—',
    validade: formatDateBR(record.validadeFabricante),
    abertura: formatDateBR(record.dataAbertura),
    fechamento: formatDateBR(record.dataFechamento ?? record.dataDescarte),
    diasUso: record.diasEmUso === null ? '—' : String(record.diasEmUso),
    runs: String(record.runsCount),
    alertas: alertsLabel,
    alertsPriority,
  };
}

function renderLotTable(
  doc: PDFKit.PDFDocument,
  title: string,
  records: LotLifecycleRecord[],
  x: number,
  startY: number,
  width: number,
): number {
  let y = startY;
  if (y + 40 > safeBottomY()) {
    doc.addPage();
    y = renderPageChrome(doc, true);
  }

  doc
    .font(Fonts.bold)
    .fontSize(11)
    .fillColor(COLOR.textPrimary)
    .text(title, x, y, { width });
  y += 16;

  const columns: SimpleColumn[] = [
    { key: 'lote', label: 'Lote', weight: 1.2, monospace: true },
    { key: 'produto', label: 'Produto', weight: 2.2 },
    { key: 'tipo', label: 'Tipo', weight: 0.8 },
    {
      key: 'anvisa',
      label: 'ANVISA',
      weight: 1.1,
      color: (v) => (v === '—' ? COLOR.danger : COLOR.textPrimary),
    },
    { key: 'validade', label: 'Validade', weight: 1.0 },
    { key: 'abertura', label: 'Abertura', weight: 1.0 },
    { key: 'diasUso', label: 'Dias uso', weight: 0.7, align: 'right' },
    { key: 'runs', label: 'Runs', weight: 0.6, align: 'right' },
    {
      key: 'alertas',
      label: 'Alertas',
      weight: 1.8,
      color: (_v, row) => {
        if (row['alertsPriority'] === 'critical') return COLOR.danger;
        if (row['alertsPriority'] === 'warning') return COLOR.accentWarm;
        return COLOR.textMuted;
      },
    },
  ];

  const rows = records.map(rowForLot);

  y = drawTableHeader(doc, x, y, width, columns);
  y = drawTableRows(
    doc,
    x,
    y,
    width,
    columns,
    rows,
    () => {
      doc.addPage();
      const chromeY = renderPageChrome(doc, true);
      return drawTableHeader(doc, x, chromeY + 10, width, columns);
    },
    {
      accentLeftColor: (row) => {
        if (row['alertsPriority'] === 'critical') return COLOR.danger;
        if (row['alertsPriority'] === 'warning') return COLOR.accentWarm;
        return null;
      },
    },
  );
  return y + 12;
}

function renderAlertDetail(
  doc: PDFKit.PDFDocument,
  x: number,
  startY: number,
  width: number,
  records: LotLifecycleRecord[],
): number {
  const lotsWithAlerts = records.filter((r) => r.alerts.length > 0);
  if (lotsWithAlerts.length === 0) return startY;

  let y = startY;
  if (y + 40 > safeBottomY()) {
    doc.addPage();
    y = renderPageChrome(doc, true);
  }

  doc
    .font(Fonts.bold)
    .fontSize(11)
    .fillColor(COLOR.textPrimary)
    .text('Detalhamento de alertas', x, y, { width });
  y += 18;

  for (const lot of lotsWithAlerts) {
    for (const alert of lot.alerts) {
      if (y + 36 > safeBottomY()) {
        doc.addPage();
        y = renderPageChrome(doc, true);
      }
      const fg = alert.severity === 'critical' ? COLOR.danger : COLOR.accentWarm;
      const bg = alert.severity === 'critical' ? COLOR.dangerBg : COLOR.warningBg;

      doc.roundedRect(x, y, width, 28, 4).fill(bg);

      doc
        .font(Fonts.bold)
        .fontSize(7.5)
        .fillColor(fg)
        .text(`[${ALERT_LABEL[alert.code]}]`, x + 12, y + 6, {
          width: 120,
          lineBreak: false,
          characterSpacing: 0.4,
        });

      doc
        .font(Fonts.bold)
        .fontSize(FONT_SIZES.small)
        .fillColor(COLOR.textPrimary)
        .text(
          `${lot.nomeComercial} · Lote ${lot.lotNumber}`,
          x + 140,
          y + 4,
          { width: width - 160, lineBreak: false, ellipsis: true },
        );

      doc
        .font(Fonts.regular)
        .fontSize(FONT_SIZES.micro)
        .fillColor(COLOR.textPrimary)
        .text(alert.message, x + 140, y + 16, {
          width: width - 160,
          lineBreak: false,
          ellipsis: true,
        });

      y += 32;
    }
  }
  return y;
}

export function renderRastreabilidadeSection(
  doc: PDFKit.PDFDocument,
  report: OperacionalReport,
): void {
  const x = PAGE.margin;
  const width = CONTENT_WIDTH;
  const section = report.rastreabilidade;

  doc.addPage();
  let y = renderPageChrome(doc, false);

  y = drawSectionTitle(
    doc,
    x,
    y + 10,
    width,
    'Seção 2 de 3',
    'Rastreabilidade de Insumos',
    'Lotes em uso, lotes fechados no período e alertas regulatórios (ANVISA, validade, abertura).',
  );

  drawStatusPill(doc, x + width, PAGE.margin - 2, section.status, 'right');

  const missingAnvisa = [...section.activeLots, ...section.closedLots].filter(
    (r) => r.registroAnvisa === null || r.registroAnvisa === '',
  ).length;

  y =
    drawKpiGrid(doc, x, y + 4, width, [
      {
        label: 'Lotes ativos',
        value: String(section.activeLots.length),
      },
      {
        label: 'Fechados no período',
        value: String(section.closedLots.length),
      },
      {
        label: 'Alertas críticos',
        value: String(section.alertsCount.critical),
        valueColor: section.alertsCount.critical === 0 ? COLOR.success : COLOR.danger,
      },
      {
        label: 'ANVISA ausente',
        value: String(missingAnvisa),
        valueColor: missingAnvisa === 0 ? COLOR.success : COLOR.accentWarm,
      },
    ]) + 22;

  y = renderLotTable(doc, 'Lotes em uso', section.activeLots, x, y, width);
  if (section.closedLots.length > 0) {
    y = renderLotTable(doc, 'Lotes encerrados no período', section.closedLots, x, y, width);
  }

  renderAlertDetail(doc, x, y, width, [...section.activeLots, ...section.closedLots]);
}
