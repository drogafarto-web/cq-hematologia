/**
 * Componentes compartilhados do relatório operacional.
 * Desenhados sobre os design tokens já existentes (`services/pdf/layout`).
 * World-class, dark-first, editorial.
 */

import {
  COLOR,
  Fonts,
  FONT_SIZES,
  PAGE,
  safeBottomY,
} from '../../services/pdf/layout';
import type { OperacionalStatus } from '../types';

// ─── Status tokens ───────────────────────────────────────────────────────────

export interface StatusTheme {
  label: string;
  fg: string;
  bg: string;
  border: string;
  emphasis: string; // usado em títulos grandes
}

export function themeForStatus(status: OperacionalStatus): StatusTheme {
  switch (status) {
    case 'critico':
      return {
        label: 'CRÍTICO',
        fg: COLOR.danger,
        bg: COLOR.dangerBg,
        border: '#5a1818',
        emphasis: COLOR.danger,
      };
    case 'atencao':
      return {
        label: 'ATENÇÃO',
        fg: COLOR.accentWarm,
        bg: COLOR.warningBg,
        border: '#5a4418',
        emphasis: COLOR.accentWarm,
      };
    default:
      return {
        label: 'OK',
        fg: COLOR.success,
        bg: '#0f2a1a',
        border: '#1b4d32',
        emphasis: COLOR.success,
      };
  }
}

// ─── Status Pill ─────────────────────────────────────────────────────────────

export function drawStatusPill(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  status: OperacionalStatus,
  anchor: 'left' | 'right' = 'left',
): { width: number; height: number } {
  const theme = themeForStatus(status);
  const padX = 10;
  const padY = 5;
  const fontSize = 8.5;
  doc.font(Fonts.bold).fontSize(fontSize);
  const textW = doc.widthOfString(theme.label);
  const width = textW + padX * 2;
  const height = fontSize + padY * 2;
  const originX = anchor === 'right' ? x - width : x;

  doc.save();
  doc.roundedRect(originX, y, width, height, 10).fillColor(theme.bg).fill();
  doc
    .roundedRect(originX, y, width, height, 10)
    .lineWidth(0.8)
    .strokeColor(theme.border)
    .stroke();
  doc
    .font(Fonts.bold)
    .fontSize(fontSize)
    .fillColor(theme.fg)
    .text(theme.label, originX + padX, y + padY, {
      width: textW,
      lineBreak: false,
    });
  doc.restore();
  return { width, height };
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

export interface KpiCard {
  label: string;
  value: string;
  sublabel?: string;
  /** cor do número principal — se omitido, usa textPrimary */
  valueColor?: string;
}

export function drawKpiGrid(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  cards: KpiCard[],
  heightOverride?: number,
): number {
  if (cards.length === 0) return y;
  const gap = 8;
  const cardW = (width - gap * (cards.length - 1)) / cards.length;
  const cardH = heightOverride ?? 62;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const cx = x + i * (cardW + gap);

    doc
      .roundedRect(cx, y, cardW, cardH, 6)
      .fillColor('#131316')
      .fill();
    doc
      .roundedRect(cx, y, cardW, cardH, 6)
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();

    doc
      .font(Fonts.bold)
      .fontSize(20)
      .fillColor(card.valueColor ?? COLOR.textPrimary)
      .text(card.value, cx + 12, y + 10, {
        width: cardW - 24,
        lineBreak: false,
        ellipsis: true,
      });

    doc
      .font(Fonts.bold)
      .fontSize(6.5)
      .fillColor(COLOR.textMuted)
      .text(card.label.toUpperCase(), cx + 12, y + 36, {
        width: cardW - 24,
        characterSpacing: 0.4,
        lineBreak: false,
        ellipsis: true,
      });

    if (card.sublabel) {
      doc
        .font(Fonts.regular)
        .fontSize(7.5)
        .fillColor(COLOR.textMuted)
        .text(card.sublabel, cx + 12, y + 46, {
          width: cardW - 24,
          lineBreak: false,
          ellipsis: true,
        });
    }
  }

  return y + cardH;
}

// ─── Section Title ───────────────────────────────────────────────────────────

export function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  eyebrow: string,
  title: string,
  subtitle?: string,
): number {
  doc
    .font(Fonts.bold)
    .fontSize(8)
    .fillColor(COLOR.accent)
    .text(eyebrow.toUpperCase(), x, y, { width, characterSpacing: 0.8 });

  doc
    .font(Fonts.bold)
    .fontSize(18)
    .fillColor(COLOR.textPrimary)
    .text(title, x, y + 14, { width, characterSpacing: -0.3 });

  let nextY = y + 14 + 22;
  if (subtitle) {
    doc
      .font(Fonts.regular)
      .fontSize(9.5)
      .fillColor(COLOR.textMuted)
      .text(subtitle, x, nextY, { width, lineGap: 2 });
    nextY += doc.heightOfString(subtitle, { width, lineGap: 2 });
  }

  // Divider
  doc
    .moveTo(x, nextY + 10)
    .lineTo(x + width, nextY + 10)
    .lineWidth(0.5)
    .strokeColor(COLOR.border)
    .stroke();

  return nextY + 20;
}

// ─── Generic table row helpers ───────────────────────────────────────────────

export interface SimpleColumn {
  key: string;
  label: string;
  weight?: number;
  align?: 'left' | 'right' | 'center';
  monospace?: boolean;
  /** Cor do texto (default textPrimary). Aceita função para coloração por valor. */
  color?: string | ((value: string, row: Record<string, string>) => string);
}

export function drawTableHeader(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  columns: SimpleColumn[],
): number {
  const headerH = 20;
  const totalWeight = columns.reduce((s, c) => s + (c.weight ?? 1), 0) || 1;

  doc.rect(x, y, width, headerH).fill('#1a1a2e');

  let cx = x;
  for (const col of columns) {
    const w = ((col.weight ?? 1) / totalWeight) * width;
    doc
      .font(Fonts.bold)
      .fontSize(FONT_SIZES.tableHead)
      .fillColor(COLOR.textMuted)
      .text(col.label.toUpperCase(), cx + 6, y + 7, {
        width: w - 12,
        align: col.align ?? 'left',
        lineBreak: false,
        ellipsis: true,
        characterSpacing: 0.3,
      });
    cx += w;
  }

  return y + headerH;
}

export interface TableRenderOptions {
  rowHeight?: number;
  accentLeftColor?: (row: Record<string, string>) => string | null;
}

/**
 * Render de tabela simples com fallback para nova página quando estoura.
 * O chamador é responsável por redesenhar cabeçalho na nova página.
 */
export function drawTableRows(
  doc: PDFKit.PDFDocument,
  x: number,
  startY: number,
  width: number,
  columns: SimpleColumn[],
  rows: Array<Record<string, string>>,
  onPageBreak: () => number, // retorna Y da nova linha após reinserir cabeçalho
  options: TableRenderOptions = {},
): number {
  const rowHeight = options.rowHeight ?? 18;
  const totalWeight = columns.reduce((s, c) => s + (c.weight ?? 1), 0) || 1;

  let cursorY = startY;

  if (rows.length === 0) {
    doc
      .font(Fonts.regular)
      .fontSize(FONT_SIZES.small)
      .fillColor(COLOR.textMuted)
      .text('Nenhum registro no período.', x + 6, cursorY + 6, { width });
    return cursorY + rowHeight;
  }

  for (let i = 0; i < rows.length; i++) {
    if (cursorY + rowHeight > safeBottomY()) {
      cursorY = onPageBreak();
    }
    const row = rows[i];
    const isAlt = i % 2 === 1;
    if (isAlt) {
      doc.rect(x, cursorY, width, rowHeight).fill(COLOR.rowAlt);
    }

    const accent = options.accentLeftColor?.(row);
    if (accent) {
      doc.rect(x, cursorY, 3, rowHeight).fill(accent);
    }

    let cx = x;
    for (const col of columns) {
      const w = ((col.weight ?? 1) / totalWeight) * width;
      const val = row[col.key] ?? '—';

      let color: string = COLOR.textPrimary;
      if (typeof col.color === 'function') color = col.color(val, row);
      else if (typeof col.color === 'string') color = col.color;

      doc
        .font(col.monospace ? Fonts.mono : Fonts.regular)
        .fontSize(FONT_SIZES.table)
        .fillColor(color)
        .text(val, cx + 6, cursorY + 5, {
          width: w - 12,
          align: col.align ?? 'left',
          lineBreak: false,
          ellipsis: true,
        });
      cx += w;
    }

    cursorY += rowHeight;
  }

  return cursorY;
}

// ─── Banner helpers ──────────────────────────────────────────────────────────

export function drawInfoBanner(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  message: string,
  tone: 'info' | 'warning' | 'critical' = 'info',
): number {
  const bg =
    tone === 'critical'
      ? COLOR.dangerBg
      : tone === 'warning'
        ? COLOR.warningBg
        : '#0f1a2a';
  const fg =
    tone === 'critical'
      ? COLOR.danger
      : tone === 'warning'
        ? COLOR.accentWarm
        : COLOR.accent;

  doc.font(Fonts.regular).fontSize(FONT_SIZES.small);
  const msgHeight = doc.heightOfString(message, { width: width - 24, lineGap: 2 });
  const boxHeight = 20 + msgHeight + 14;

  doc.roundedRect(x, y, width, boxHeight, 4).fill(bg);
  doc
    .roundedRect(x, y, width, boxHeight, 4)
    .lineWidth(0.5)
    .strokeColor(fg)
    .stroke();

  doc
    .font(Fonts.bold)
    .fontSize(8)
    .fillColor(fg)
    .text(title.toUpperCase(), x + 12, y + 10, { width: width - 24, characterSpacing: 0.6 });

  doc
    .font(Fonts.regular)
    .fontSize(FONT_SIZES.small)
    .fillColor(COLOR.textPrimary)
    .text(message, x + 12, y + 24, {
      width: width - 24,
      lineGap: 2,
    });

  return y + boxHeight;
}

// ─── Page footer (consistent with backup pdfService) ─────────────────────────

export function drawPageFooter(
  doc: PDFKit.PDFDocument,
  leftText: string,
  rightText: string,
): void {
  const footerY = PAGE.height - 28;
  doc
    .font(Fonts.regular)
    .fontSize(7)
    .fillColor(COLOR.textMuted)
    .text(leftText, PAGE.margin, footerY, {
      width: PAGE.width - PAGE.margin * 2,
      align: 'left',
      lineBreak: false,
    });
  doc
    .font(Fonts.regular)
    .fontSize(7)
    .fillColor(COLOR.textMuted)
    .text(rightText, PAGE.margin, footerY, {
      width: PAGE.width - PAGE.margin * 2,
      align: 'right',
      lineBreak: false,
    });

  doc.rect(0, PAGE.height - 8, PAGE.width, 8).fill(COLOR.accent);
}
