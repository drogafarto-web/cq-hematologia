import {
  COLOR,
  CONTENT_WIDTH,
  FONT_SIZES,
  Fonts,
  PAGE,
  safeBottomY,
} from '../../services/pdf/layout';
import type { CIQAuditAction, CIQAuditEvent, OperacionalReport } from '../types';
import {
  drawInfoBanner,
  drawKpiGrid,
  drawSectionTitle,
  drawStatusPill,
  drawTableHeader,
  drawTableRows,
  type SimpleColumn,
} from './components';

// ─── Seção 3 — Audit Log de CIQ ──────────────────────────────────────────────

const ACTION_LABEL: Record<CIQAuditAction, string> = {
  CREATE_RUN: 'Criou run',
  APPROVE_RUN: 'Aprovou run',
  REJECT_RUN: 'Rejeitou run',
  EDIT_RUN_VALUE: 'Editou valor',
  REOPEN_RUN: 'Reabriu run',
  ATTACH_CORRECTIVE_ACTION: 'Anexou ação corretiva',
  OPEN_LOT: 'Abriu lote',
  CLOSE_LOT: 'Fechou lote',
  DISCARD_LOT: 'Descartou lote',
  SEGREGATE_LOT: 'Segregou lote',
  NOTIVISA_SUBMIT: 'Submeteu NOTIVISA',
  NOTIVISA_UPDATE: 'Atualizou NOTIVISA',
};

function renderPageChrome(doc: PDFKit.PDFDocument, continuation: boolean): number {
  doc.rect(0, 0, PAGE.width, 4).fill(COLOR.accent);
  let y = PAGE.margin;
  if (continuation) {
    doc
      .font(Fonts.bold)
      .fontSize(FONT_SIZES.micro)
      .fillColor(COLOR.textMuted)
      .text('Audit Log — continuação', PAGE.margin, y, {
        width: CONTENT_WIDTH,
        lineBreak: false,
        ellipsis: true,
      });
    y += 16;
  }
  return y;
}

function formatDateTimeBR(ts: CIQAuditEvent['timestamp']): string {
  return ts.toDate().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function severityColor(s: CIQAuditEvent['severity']): string {
  if (s === 'critical') return COLOR.danger;
  if (s === 'warning') return COLOR.accentWarm;
  return COLOR.textMuted;
}

export function renderAuditSection(
  doc: PDFKit.PDFDocument,
  report: OperacionalReport,
): void {
  const x = PAGE.margin;
  const width = CONTENT_WIDTH;
  const section = report.auditLog;

  doc.addPage();
  let y = renderPageChrome(doc, false);

  y = drawSectionTitle(
    doc,
    x,
    y + 10,
    width,
    'Seção 3 de 3',
    'Audit Log de CIQ',
    'Eventos auditáveis de decisões de CIQ no período: criação, aprovação, rejeição, ações corretivas e ciclo de vida de lotes.',
  );

  drawStatusPill(doc, x + width, PAGE.margin - 2, section.status, 'right');

  if (!section.collectionActive) {
    drawInfoBanner(
      doc,
      x,
      y + 6,
      width,
      'Coleta em deploy',
      'O registro imutável de eventos auditáveis (CIQ Audit Trail) será populado após o deploy do trigger de auditoria. A seção passa a apresentar dados reais em ~1-2 semanas. Até lá, os registros primários permanecem nas coleções de origem (labs/{labId}/lots/runs, labs/{labId}/ciq-imuno/runs).',
      'info',
    );
    return;
  }

  y =
    drawKpiGrid(doc, x, y + 4, width, [
      {
        label: 'Eventos no período',
        value: String(section.totalEvents),
        sublabel: section.truncated ? 'truncado em 2000' : undefined,
      },
      {
        label: 'Críticos',
        value: String(section.bySeverity.critical),
        valueColor: section.bySeverity.critical === 0 ? COLOR.success : COLOR.danger,
      },
      {
        label: 'Avisos',
        value: String(section.bySeverity.warning),
        valueColor: section.bySeverity.warning === 0 ? COLOR.success : COLOR.accentWarm,
      },
      {
        label: 'Chain verification',
        value: section.chain.valid ? 'OK' : 'FALHA',
        valueColor: section.chain.valid ? COLOR.success : COLOR.danger,
        sublabel: `${section.chain.eventsVerified} evt(s) verificado(s)`,
      },
    ]) + 22;

  if (!section.chain.valid) {
    y = drawInfoBanner(
      doc,
      x,
      y,
      width,
      'Integridade comprometida',
      `Detectada(s) ${section.chain.breaks.length} quebra(s) no hash chain. O primeiro evento divergente é ${section.chain.breaks[0]?.eventId ?? '—'}. Investigar imediatamente — tampering de audit log exige abertura de NC e auditoria completa.`,
      'critical',
    ) + 12;
  }

  // Breakdown por ação (top 8)
  const topActions = Object.entries(section.byAction)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (topActions.length > 0) {
    if (y + 40 > safeBottomY()) {
      doc.addPage();
      y = renderPageChrome(doc, true);
    }
    doc
      .font(Fonts.bold)
      .fontSize(11)
      .fillColor(COLOR.textPrimary)
      .text('Distribuição por ação', x, y);
    y += 16;

    const barMax = topActions[0][1] || 1;
    for (const [action, count] of topActions) {
      if (y + 14 > safeBottomY()) {
        doc.addPage();
        y = renderPageChrome(doc, true);
      }
      const pct = count / barMax;
      const label = ACTION_LABEL[action as CIQAuditAction] ?? action;
      doc
        .font(Fonts.regular)
        .fontSize(FONT_SIZES.small)
        .fillColor(COLOR.textPrimary)
        .text(label, x, y, { width: 160, lineBreak: false, ellipsis: true });

      const barX = x + 170;
      const barW = (width - 170 - 50) * pct;
      doc.rect(barX, y + 2, barW, 9).fill(COLOR.accent);

      doc
        .font(Fonts.bold)
        .fontSize(FONT_SIZES.small)
        .fillColor(COLOR.textMuted)
        .text(`${count}×`, x + width - 44, y, {
          width: 44,
          align: 'right',
          lineBreak: false,
        });
      y += 14;
    }
    y += 12;
  }

  // Eventos críticos (todos)
  if (section.criticalEvents.length > 0) {
    if (y + 40 > safeBottomY()) {
      doc.addPage();
      y = renderPageChrome(doc, true);
    }
    doc
      .font(Fonts.bold)
      .fontSize(11)
      .fillColor(COLOR.danger)
      .text('Eventos críticos', x, y);
    y += 16;

    const columns: SimpleColumn[] = [
      { key: 'ts', label: 'Quando', weight: 1.3 },
      { key: 'action', label: 'Ação', weight: 1.2 },
      { key: 'entity', label: 'Entidade', weight: 1.3, monospace: true },
      { key: 'actor', label: 'Ator', weight: 1.4 },
      { key: 'reason', label: 'Motivo', weight: 2.2, color: COLOR.textPrimary },
    ];
    const rows = section.criticalEvents.map((e) => ({
      ts: formatDateTimeBR(e.timestamp),
      action: ACTION_LABEL[e.action] ?? e.action,
      entity: `${e.entityType}:${e.entityId.slice(0, 12)}`,
      actor: `${e.actorName} (${e.actorRole})`,
      reason: e.reason ?? '—',
    }));

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
        accentLeftColor: () => COLOR.danger,
      },
    );
    y += 14;
  }

  // Timeline recente
  if (section.recentEvents.length > 0) {
    if (y + 40 > safeBottomY()) {
      doc.addPage();
      y = renderPageChrome(doc, true);
    }
    doc
      .font(Fonts.bold)
      .fontSize(11)
      .fillColor(COLOR.textPrimary)
      .text('Timeline de eventos recentes', x, y);
    y += 16;

    for (const e of section.recentEvents) {
      if (y + 16 > safeBottomY()) {
        doc.addPage();
        y = renderPageChrome(doc, true);
      }
      // Dot por severidade
      const dot = severityColor(e.severity);
      doc.save();
      doc.circle(x + 4, y + 5, 2.5).fill(dot);
      doc.restore();

      doc
        .font(Fonts.regular)
        .fontSize(FONT_SIZES.micro)
        .fillColor(COLOR.textMuted)
        .text(formatDateTimeBR(e.timestamp), x + 14, y, {
          width: 110,
          lineBreak: false,
        });

      doc
        .font(Fonts.bold)
        .fontSize(FONT_SIZES.micro)
        .fillColor(COLOR.textPrimary)
        .text(
          ACTION_LABEL[e.action] ?? e.action,
          x + 128,
          y,
          { width: 130, lineBreak: false, ellipsis: true },
        );

      doc
        .font(Fonts.regular)
        .fontSize(FONT_SIZES.micro)
        .fillColor(COLOR.textMuted)
        .text(
          `${e.actorName} · ${e.entityType}:${e.entityId.slice(0, 10)}`,
          x + 262,
          y,
          { width: width - 272, lineBreak: false, ellipsis: true },
        );
      y += 13;
    }
  }
}
