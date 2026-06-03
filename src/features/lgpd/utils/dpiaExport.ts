/**
 * DPIA PDF Export Utility
 *
 * Generates printable HTML document for PDF export.
 * Client-side only; no server roundtrip needed; works offline.
 * Uses browser's Print to PDF feature.
 */

import type { DPIA } from '../types';

/**
 * Export DPIA to PDF
 * Generates HTML content and returns as Blob
 */
export async function exportDPIAToPDF(dpia: DPIA): Promise<Blob> {
  // Generate HTML content
  const html = generateDPIAHTML(dpia);

  // Create blob from HTML
  const blob = new Blob([html], { type: 'text/html' });
  return blob;
}

/**
 * Generate printable HTML for DPIA document
 */
function generateDPIAHTML(dpia: DPIA): string {
  const now = new Date();
  const headerDate = now.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const datasHtml = dpia.datasColetadas
    .map(
      (d) =>
        '<div class="item">' +
        `<div class="item-field">Campo: ${d.campo}</div>` +
        `<div class="item-value">Propósito: ${d.proposito}</div>` +
        `<div class="item-value">Retenção: ${d.retencao}</div>` +
        '</div>',
    )
    .join('');

  const fluxosHtml = dpia.fluxosDados
    .map(
      (f) =>
        '<div class="item">' +
        `<div class="item-field">Entrada: ${f.entrada}</div>` +
        `<div class="item-value">Processamento: ${f.processamento}</div>` +
        `<div class="item-value">Saída: ${f.saida}</div>` +
        '</div>',
    )
    .join('');

  const riscosHtml = dpia.riscos
    .map(
      (r) =>
        '<tr>' +
        `<td>${r.tipo}</td>` +
        `<td>${r.descricao}</td>` +
        `<td>${r.probabilidade}</td>` +
        `<td>${r.impacto}</td>` +
        '</tr>',
    )
    .join('');

  const medidasHtml = dpia.medidas
    .map(
      (m) =>
        '<tr>' +
        `<td>${m.medida}</td>` +
        `<td>${m.responsavel}</td>` +
        `<td>${m.prazo}</td>` +
        '</tr>',
    )
    .join('');

  const aprovacaoHtml =
    (dpia.dataAprovacao
      ? `<div class="signature-item">Aprovado em: ${dpia.dataAprovacao.toDate().toLocaleDateString('pt-BR')}</div>`
      : '') +
    (dpia.assinaturRT
      ? `<div class="signature-item">Assinado por: ${dpia.assinaturRT.operatorId}</div>`
      : '');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DPIA v${dpia.versao}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
      padding: 40px;
    }
    @media print {
      body { padding: 20px; }
      page-break-after: auto;
    }
    h1 { font-size: 24px; margin: 30px 0 10px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
    h2 { font-size: 18px; margin: 20px 0 10px; color: #1a1a1a; }
    .header { margin-bottom: 30px; }
    .meta { color: #666; font-size: 14px; margin: 5px 0; }
    .section { margin: 20px 0; }
    .item { margin: 15px 0; padding: 10px; background: #f9f9f9; border-left: 3px solid #e0e0e0; }
    .item-field { font-weight: 600; color: #1a1a1a; }
    .item-value { margin-left: 20px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    td, th { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0; color: #666; font-size: 12px; }
    .signature-block { margin-top: 30px; }
    .signature-item { margin: 10px 0; }
    @media print {
      .no-print { display: none; }
      h1, h2 { page-break-after: avoid; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Avaliação de Impacto à Proteção de Dados (DPIA)</h1>
    <div class="meta">Versão ${dpia.versao}</div>
    <div class="meta">Atualizado em ${dpia.atualizadoEm?.toDate().toLocaleDateString('pt-BR')}</div>
    <div class="meta">Data de preenchimento: ${dpia.dataPreenchimento?.toDate().toLocaleDateString('pt-BR')}</div>
  </div>

  <div class="section">
    <h2>Responsável pelos Dados</h2>
    <div class="item-value">${dpia.responsavelDados || '—'}</div>
  </div>

  <div class="section">
    <h2>Dados Coletados</h2>
    ${datasHtml}
  </div>

  <div class="section">
    <h2>Fluxos de Dados</h2>
    ${fluxosHtml}
  </div>

  <div class="section">
    <h2>Riscos Identificados</h2>
    <table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Descrição</th>
          <th>Probabilidade</th>
          <th>Impacto</th>
        </tr>
      </thead>
      <tbody>
        ${riscosHtml}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Medidas de Mitigação</h2>
    <table>
      <thead>
        <tr>
          <th>Medida</th>
          <th>Responsável</th>
          <th>Prazo</th>
        </tr>
      </thead>
      <tbody>
        ${medidasHtml}
      </tbody>
    </table>
  </div>

  <div class="signature-block">
    <h2>Aprovações</h2>
    <div class="signature-item">
      Revisão Jurídica: ${dpia.revisaoJuridica ? '✓ Aprovada' : '✗ Pendente'}
    </div>
    ${aprovacaoHtml}
  </div>

  <div class="footer">
    <p>Documento gerado automaticamente em ${headerDate}</p>
    <p>Para converter em PDF, use a função "Imprimir" do navegador (Ctrl+P ou Cmd+P) e selecione "Salvar como PDF".</p>
  </div>
</body>
</html>`;
}
