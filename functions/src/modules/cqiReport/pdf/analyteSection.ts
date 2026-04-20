// ─── Per-analyte PDF section renderers ───────────────────────────────────────
// Each function draws onto an existing PDFKit.PDFDocument and returns the
// y-coordinate immediately after the last drawn element.
//
// Quantitative (hematologia): chart + stats table + violation list.
// Categorical  (imunologia):  R/N results table — NO chart.

import { drawLeveyJenningsChart, type LeveyJenningsInput } from '../charts/leveyJennings';

// ─── Layout constants (A4) ────────────────────────────────────────────────────

const PAGE_H = 841.89;
const MARGIN = 40;
const CW = 595.28 - MARGIN * 2; // usable content width
const FONT_B = 'Helvetica-Bold';
const FONT_R = 'Helvetica';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuantitativeAnalyteData {
  analyteId: string;
  name: string;
  unit: string;
  lotNumber: string;
  /** Today's confirmed runs for this analyte */
  todayValues: Array<{ value: number; timestamp: Date; runCode: string; violations: string[] }>;
  /** Last ≤20 runs (full lot history) — used for the LJ chart */
  last20Values: Array<{ value: number; timestamp: Date }>;
  mean: number;
  sd: number;
  cv: number;
}

export interface CategoricalRunData {
  runCode: string;
  timestamp: Date;
  testType: string;
  resultadoObtido: string;
  resultadoEsperado: string;
  conforme: boolean;
}

// ─── Page-break guard ─────────────────────────────────────────────────────────

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, y: number): number {
  if (y + needed > PAGE_H - MARGIN - 30) {
    doc.addPage();
    // Re-draw top accent after page break to maintain visual consistency
    doc.rect(0, 0, 595.28, 4).fillColor('#1e3a5f').fill();
    return MARGIN + 10;
  }
  return y;
}

// ─── Quantitative section (Hematologia) ──────────────────────────────────────

/**
 * Renders one analyte block: header bar → LJ chart → stats row → violations.
 * @returns the y position immediately after the section (caller advances from here)
 */
export function renderQuantitativeAnalyteSection(
  doc: PDFKit.PDFDocument,
  data: QuantitativeAnalyteData,
  startY: number,
): number {
  let y = ensureSpace(doc, 210, startY);

  // ── Header bar ─────────────────────────────────────────────────────────────
  doc.rect(MARGIN, y, CW, 20).fillColor('#1e3a5f').fill();
  doc
    .font(FONT_B)
    .fontSize(8.5)
    .fillColor('#ffffff')
    .text(`${data.analyteId}  —  ${data.name}`, MARGIN + 10, y + 6, { width: CW * 0.72 });
  doc
    .font(FONT_R)
    .fontSize(7.5)
    .fillColor('#93c5fd')
    .text(data.unit, MARGIN + CW * 0.74, y + 7, { width: CW * 0.24, align: 'right' });
  y += 24;

  // ── Levey-Jennings chart ───────────────────────────────────────────────────
  if (data.last20Values.length > 0) {
    const chartH = 120;
    y = ensureSpace(doc, chartH + 8, y);
    const chartInput: LeveyJenningsInput = {
      analyteId: data.analyteId,
      lotNumber: data.lotNumber,
      values: data.last20Values.map((r) => r.value),
      timestamps: data.last20Values.map((r) => r.timestamp),
      mean: data.mean,
      sd: data.sd,
      cv: data.cv,
    };
    drawLeveyJenningsChart(doc, chartInput, MARGIN, y, CW, chartH);
    y += chartH + 6;
  }

  // ── Stats table ────────────────────────────────────────────────────────────
  y = ensureSpace(doc, 36, y);
  const colW = CW / 4;
  const headers = ['N (hoje)', 'Média', 'SD', 'CV%'];
  const values = [
    String(data.todayValues.length),
    data.mean.toFixed(2),
    data.sd.toFixed(2),
    `${data.cv}%`,
  ];

  // Header row
  doc.rect(MARGIN, y, CW, 14).fillColor('#f1f5f9').fill();
  for (let i = 0; i < 4; i++) {
    doc
      .font(FONT_B)
      .fontSize(6)
      .fillColor('#475569')
      .text(headers[i], MARGIN + i * colW + 6, y + 4, { width: colW - 10 });
  }
  y += 14;

  // Value row
  doc.rect(MARGIN, y, CW, 18).fillColor('#f8fafc').fill();
  for (let i = 0; i < 4; i++) {
    doc
      .font(FONT_B)
      .fontSize(10)
      .fillColor('#0f172a')
      .text(values[i], MARGIN + i * colW + 6, y + 4, { width: colW - 10 });
  }
  y += 22;

  // ── Violation banner ───────────────────────────────────────────────────────
  const allViols = [...new Set(data.todayValues.flatMap((r) => r.violations))];
  if (allViols.length > 0) {
    y = ensureSpace(doc, 16, y);
    doc.rect(MARGIN, y, CW, 14).fillColor('#fef2f2').fill();
    doc
      .font(FONT_B)
      .fontSize(6.5)
      .fillColor('#b91c1c')
      .text(`Violações Westgard detectadas hoje: ${allViols.join('  ·  ')}`, MARGIN + 8, y + 4, {
        width: CW - 16,
      });
    y += 18;
  }

  return y + 8;
}

// ─── Categorical section (Imunologia) ────────────────────────────────────────

/**
 * Renders an R/N results table for one test type. No chart.
 * @returns the y position immediately after the section.
 */
export function renderCategoricalRunsSection(
  doc: PDFKit.PDFDocument,
  runs: CategoricalRunData[],
  testTypeName: string,
  startY: number,
): number {
  let y = ensureSpace(doc, 60, startY);

  // ── Header bar ─────────────────────────────────────────────────────────────
  doc.rect(MARGIN, y, CW, 20).fillColor('#1a4731').fill();
  doc
    .font(FONT_B)
    .fontSize(8.5)
    .fillColor('#ffffff')
    .text(`${testTypeName}  —  Resultados do Dia`, MARGIN + 10, y + 6, { width: CW - 20 });
  y += 24;

  // ── Column definitions ─────────────────────────────────────────────────────
  const cols = ['Corrida', 'Tipo de Teste', 'Esperado', 'Obtido', 'Conforme?'];
  const widths = [CW * 0.17, CW * 0.27, CW * 0.16, CW * 0.16, CW * 0.24];
  const rowH = 14;

  // Column headers
  y = ensureSpace(doc, 14 + rowH, y);
  doc.rect(MARGIN, y, CW, 14).fillColor('#f0fdf4').fill();
  let cx = MARGIN;
  for (let i = 0; i < cols.length; i++) {
    doc
      .font(FONT_B)
      .fontSize(6)
      .fillColor('#14532d')
      .text(cols[i], cx + 4, y + 4, { width: widths[i] - 8 });
    cx += widths[i];
  }
  y += 14;

  // ── Data rows ──────────────────────────────────────────────────────────────
  for (let ri = 0; ri < runs.length; ri++) {
    y = ensureSpace(doc, rowH + 2, y);
    const r = runs[ri];

    if (ri % 2 === 1) doc.rect(MARGIN, y, CW, rowH).fillColor('#f9fafb').fill();

    const cells = [
      r.runCode,
      r.testType,
      r.resultadoEsperado === 'R' ? 'Reagente' : 'Não Reagente',
      r.resultadoObtido === 'R' ? 'Reagente' : 'Não Reagente',
      r.conforme ? 'Conforme' : 'NÃO CONFORME',
    ];

    cx = MARGIN;
    for (let i = 0; i < cells.length; i++) {
      const isResult = i === 4;
      const color = isResult ? (r.conforme ? '#16a34a' : '#dc2626') : '#111827';
      doc
        .font(isResult ? FONT_B : FONT_R)
        .fontSize(6.5)
        .fillColor(color)
        .text(cells[i], cx + 4, y + 4, { width: widths[i] - 8, ellipsis: true });
      cx += widths[i];
    }
    y += rowH;
  }

  return y + 12;
}
