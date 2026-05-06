/**
 * DPIA PDF Export Utility
 *
 * Generates PDF from DPIA document using jsPDF (client-side, dynamic import)
 * No server roundtrip needed; works offline.
 */

import type { DPIA } from '../types';

/**
 * Export DPIA to PDF
 * Dynamic import of jsPDF to avoid bundle bloat (per performance.md)
 */
export async function exportDPIAToPDF(dpia: DPIA): Promise<Blob> {
  // Dynamic import to avoid bloating main bundle
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // Set default font
  pdf.setFont('Helvetica');

  // ─────────────────────────────────────────────────────────────
  // Header
  // ─────────────────────────────────────────────────────────────
  pdf.setFontSize(18);
  pdf.setTextColor(40, 40, 40);
  pdf.text('Avaliação de Impacto à Proteção de Dados (DPIA)', margin, currentY);
  currentY += 10;

  // Version and date
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Versão ${dpia.versao}`, margin, currentY);
  currentY += 5;
  pdf.text(`Data: ${dpia.atualizadoEm?.toDate().toLocaleDateString('pt-BR')}`, margin, currentY);
  currentY += 10;

  // ─────────────────────────────────────────────────────────────
  // Section: Responsável
  // ─────────────────────────────────────────────────────────────
  pdf.setFontSize(12);
  pdf.setTextColor(40, 40, 40);
  pdf.text('Responsável pelos Dados', margin, currentY);
  currentY += 5;

  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  pdf.text(dpia.responsavelDados || '—', margin + 5, currentY);
  currentY += 8;

  // ─────────────────────────────────────────────────────────────
  // Section: Dados Coletados
  // ─────────────────────────────────────────────────────────────
  pdf.setFontSize(12);
  pdf.setTextColor(40, 40, 40);
  pdf.text('Dados Coletados', margin, currentY);
  currentY += 6;

  pdf.setFontSize(9);
  dpia.datasColetadas.forEach((item) => {
    if (currentY > pageHeight - margin - 10) {
      pdf.addPage();
      currentY = margin;
    }
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Campo: ${item.campo}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Propósito: ${item.proposito}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Retenção: ${item.retencao}`, margin + 5, currentY);
    currentY += 5;
  });
  currentY += 3;

  // ─────────────────────────────────────────────────────────────
  // Section: Fluxos de Dados
  // ─────────────────────────────────────────────────────────────
  pdf.setFontSize(12);
  pdf.setTextColor(40, 40, 40);
  pdf.text('Fluxos de Dados', margin, currentY);
  currentY += 6;

  pdf.setFontSize(9);
  dpia.fluxosDados.forEach((item) => {
    if (currentY > pageHeight - margin - 10) {
      pdf.addPage();
      currentY = margin;
    }
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Entrada: ${item.entrada}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Processamento: ${item.processamento}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Saída: ${item.saida}`, margin + 5, currentY);
    currentY += 5;
  });
  currentY += 3;

  // ─────────────────────────────────────────────────────────────
  // Section: Riscos
  // ─────────────────────────────────────────────────────────────
  pdf.setFontSize(12);
  pdf.setTextColor(40, 40, 40);
  pdf.text('Riscos Identificados', margin, currentY);
  currentY += 6;

  pdf.setFontSize(9);
  dpia.riscos.forEach((item) => {
    if (currentY > pageHeight - margin - 10) {
      pdf.addPage();
      currentY = margin;
    }
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Tipo: ${item.tipo}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Descrição: ${item.descricao}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(
      `Probabilidade: ${item.probabilidade} | Impacto: ${item.impacto}`,
      margin + 5,
      currentY,
    );
    currentY += 5;
  });
  currentY += 3;

  // ─────────────────────────────────────────────────────────────
  // Section: Medidas
  // ─────────────────────────────────────────────────────────────
  pdf.setFontSize(12);
  pdf.setTextColor(40, 40, 40);
  pdf.text('Medidas de Mitigação', margin, currentY);
  currentY += 6;

  pdf.setFontSize(9);
  dpia.medidas.forEach((item) => {
    if (currentY > pageHeight - margin - 10) {
      pdf.addPage();
      currentY = margin;
    }
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Medida: ${item.medida}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Responsável: ${item.responsavel}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Prazo: ${item.prazo}`, margin + 5, currentY);
    currentY += 5;
  });
  currentY += 3;

  // ─────────────────────────────────────────────────────────────
  // Footer with signature block
  // ─────────────────────────────────────────────────────────────
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  const footerY = pageHeight - margin - 15;

  if (dpia.revisaoJuridica) {
    pdf.text('✓ Revisão jurídica aprovada', margin, footerY);
    if (dpia.dataAprovacao) {
      pdf.text(
        `Aprovado em: ${dpia.dataAprovacao.toDate().toLocaleDateString('pt-BR')}`,
        margin,
        footerY + 5,
      );
    }
  }

  if (dpia.assinaturRT) {
    pdf.text(
      `Assinado por: ${dpia.assinaturRT.operatorId}`,
      margin,
      footerY + 10,
    );
  }

  // Convert to Blob
  const pdfBlob = pdf.output('blob');
  return pdfBlob as Blob;
}
