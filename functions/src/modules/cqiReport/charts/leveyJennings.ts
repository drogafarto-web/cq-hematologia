// ─── Levey-Jennings chart renderer ───────────────────────────────────────────
// Draws directly onto a PDFKit document using vector primitives — no native
// dependencies. Avoids chartjs-node-canvas (C++ Cairo bindings, ~50 MB bundle).
//
// Adjustment 1 (gap resolution): PDFKit has no SVG embedding API.
// Drawing with doc.moveTo / doc.lineTo / doc.circle matches the pdfService.ts
// pattern already used across this project.

const TZ = 'America/Sao_Paulo';

export interface LeveyJenningsInput {
  analyteId: string;
  lotNumber: string;
  values: number[];
  timestamps: Date[];
  mean: number;
  sd: number;
  cv: number;
}

/**
 * Draws a Levey-Jennings chart onto an existing PDFDocument at the given
 * position. The caller controls page layout; this function only draws within
 * [x, y, x+width, y+height].
 *
 * Colour coding:
 *   ● blue   (#2563eb) — within ±2SD
 *   ● amber  (#d97706) — between ±2SD and ±3SD
 *   ● red    (#dc2626) — outside ±3SD
 */
export function drawLeveyJenningsChart(
  doc: PDFKit.PDFDocument,
  input: LeveyJenningsInput,
  x: number,
  y: number,
  chartWidth: number,
  chartHeight: number,
): void {
  const { values, timestamps, mean, sd, cv, analyteId, lotNumber } = input;

  // ── Outer box ──────────────────────────────────────────────────────────────
  doc.save();
  doc.rect(x, y, chartWidth, chartHeight).fillColor('#ffffff').fill();
  doc.rect(x, y, chartWidth, chartHeight).lineWidth(0.5).strokeColor('#e5e7eb').stroke();

  // ── Title ──────────────────────────────────────────────────────────────────
  const titleH = 14;
  doc
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor('#374151')
    .text(
      `${analyteId} — Lote ${lotNumber}  |  Média: ${mean.toFixed(2)}  |  SD: ${sd.toFixed(2)}  |  CV: ${cv}%`,
      x + 4,
      y + 3,
      { width: chartWidth - 8, ellipsis: true },
    );

  if (values.length === 0) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#9ca3af')
      .text('Sem dados para exibir', x + 4, y + titleH + 10, {
        width: chartWidth - 8,
        align: 'center',
      });
    doc.restore();
    return;
  }

  // ── Plot area ──────────────────────────────────────────────────────────────
  const padL = 42,
    padR = 10,
    padT = titleH + 4,
    padB = 24;
  const plotX = x + padL;
  const plotY = y + padT;
  const plotW = chartWidth - padL - padR;
  const plotH = chartHeight - padT - padB;

  // Y-axis range: ±3.5 SD (fall back to value spread when sd = 0)
  const halfRange = sd > 0 ? 3.5 * sd : Math.max(...values) - Math.min(...values) || 1;
  const yMax = mean + halfRange;
  const yMin = mean - halfRange;
  const yRange = yMax - yMin || 1;

  const n = values.length;
  const toSX = (i: number) => plotX + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const toSY = (v: number) =>
    plotY + plotH - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / yRange) * plotH;

  // Plot background
  doc.rect(plotX, plotY, plotW, plotH).fillColor('#f9fafb').fill();

  // ── Reference lines ────────────────────────────────────────────────────────
  const refLines: Array<{
    v: number;
    color: string;
    dash: [number, number] | null;
    label: string;
  }> = [
    { v: mean + 3 * sd, color: '#dc2626', dash: [3, 2], label: '+3SD' },
    { v: mean + 2 * sd, color: '#d97706', dash: [4, 2], label: '+2SD' },
    { v: mean + sd, color: '#16a34a', dash: [2, 3], label: '+1SD' },
    { v: mean, color: '#6b7280', dash: null, label: 'M' },
    { v: mean - sd, color: '#16a34a', dash: [2, 3], label: '-1SD' },
    { v: mean - 2 * sd, color: '#d97706', dash: [4, 2], label: '-2SD' },
    { v: mean - 3 * sd, color: '#dc2626', dash: [3, 2], label: '-3SD' },
  ];

  for (const rl of refLines) {
    if (sd === 0 && rl.label !== 'M') continue;
    const ly = toSY(rl.v);
    if (ly < plotY - 1 || ly > plotY + plotH + 1) continue;

    doc.lineWidth(0.5).strokeColor(rl.color);
    if (rl.dash) {
      doc.dash(rl.dash[0], { space: rl.dash[1] });
    } else {
      doc.undash();
    }
    doc
      .moveTo(plotX, ly)
      .lineTo(plotX + plotW, ly)
      .stroke();
    doc.undash();

    // Y-axis label (right-aligned in left padding)
    doc
      .font('Helvetica')
      .fontSize(5)
      .fillColor(rl.color)
      .text(rl.label, x + 1, ly - 3.5, { width: padL - 4, align: 'right' });
  }

  // ── Connecting lines ───────────────────────────────────────────────────────
  doc.undash();
  for (let i = 0; i < n - 1; i++) {
    doc
      .lineWidth(0.8)
      .strokeColor('#9ca3af')
      .moveTo(toSX(i), toSY(values[i]))
      .lineTo(toSX(i + 1), toSY(values[i + 1]))
      .stroke();
  }

  // ── Data points ───────────────────────────────────────────────────────────
  for (let i = 0; i < n; i++) {
    const z = sd > 0 ? Math.abs(values[i] - mean) / sd : 0;
    const ptColor = z > 3 ? '#dc2626' : z > 2 ? '#d97706' : '#2563eb';
    doc.circle(toSX(i), toSY(values[i]), 2.5).fillColor(ptColor).fill();
  }

  // ── X-axis date labels (max 5 labels) ─────────────────────────────────────
  const maxLabels = 5;
  const step = Math.max(1, Math.floor(n / maxLabels));
  for (let i = 0; i < n; i += step) {
    if (i >= timestamps.length) continue;
    const label = timestamps[i]
      .toLocaleString('pt-BR', {
        timeZone: TZ,
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(',', '');
    doc
      .font('Helvetica')
      .fontSize(4.5)
      .fillColor('#6b7280')
      .text(label, toSX(i) - 14, plotY + plotH + 4, { width: 30, align: 'center' });
  }

  doc.restore();
}
