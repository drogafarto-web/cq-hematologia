/**
 * HTML template for the laudo PDF (RDC 978 Art. 167).
 *
 * Renders the 14 mandatory fields per laudo:
 *  1. CNES + nome do laboratório
 *  2. Endereço + telefone
 *  3. Responsável Técnico (RT) + registro
 *  4. Profissional que assina + registro
 *  5. Identificação do paciente (nome, idade/dataNasc, sexo, CPF opcional)
 *  6. Data + horário da coleta
 *  7. Material biológico
 *  8. Médico solicitante
 *  9. Lista de exames com resultados
 * 10. Unidade de medida
 * 11. Valores de referência
 * 12. Método analítico
 * 13. Limitações técnicas / observações
 * 14. Data da emissão + assinatura digital + QR de validação
 *
 * Layout: A4 retrato, margens 20mm, tipografia editorial (Inter / system-ui).
 * Print-only — sem dependências de fonte externa que dependam de internet
 * em runtime do Puppeteer.
 */
import type { Laudo, LaudoVersion, ExameLaudo } from '../_shared/types';

interface TemplateInputs {
  laudo: Laudo;
  version: LaudoVersion;
  qrCodeDataUrl: string;
  /**
   * URL legível, exibida em texto pequeno abaixo do QR (acessibilidade /
   * fallback caso o QR não escaneie).
   */
  validationUrl: string;
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(ts: { toDate?: () => Date } | Date | undefined): string {
  if (!ts) return '—';
  const date = (ts as { toDate?: () => Date }).toDate?.() ?? (ts as Date);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(ts: { toDate?: () => Date } | Date | undefined): string {
  if (!ts) return '—';
  const date = (ts as { toDate?: () => Date }).toDate?.() ?? (ts as Date);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatIdade(idade: Laudo['pacienteIdade']): string {
  if (!idade) return '—';
  if ('value' in idade) {
    return `${idade.value} ${idade.unit}`;
  }
  if ('dataNascimento' in idade) {
    return formatDate(idade.dataNascimento);
  }
  return '—';
}

function formatResultado(exame: ExameLaudo): string {
  if (!exame.resultados || exame.resultados.length === 0) return '—';
  const r = exame.resultados[0];
  if (r.value === null || r.value === undefined) return '—';
  // tabular-nums (CSS) garante alinhamento; aqui só formatamos número.
  const numStr = Number.isFinite(r.value)
    ? r.value.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      })
    : '—';
  return numStr;
}

function formatRefRange(exame: ExameLaudo): string {
  const ref = exame.valoresReferencia;
  if (!ref) return '—';
  if (ref.descricao) return escapeHtml(ref.descricao);
  if (ref.min !== undefined && ref.max !== undefined) {
    return `${ref.min} – ${ref.max}`;
  }
  return '—';
}

const STYLES = `
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4 portrait;margin:18mm}
  html,body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#fff;font-size:10.5pt;line-height:1.45}
  .doc{max-width:174mm;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
  .header .lab-block .lab-name{font-size:14pt;font-weight:700;letter-spacing:-0.01em}
  .header .lab-block .lab-meta{font-size:9pt;color:#444;margin-top:2px}
  .header .laudo-id{text-align:right;font-size:9pt;color:#444}
  .header .laudo-id strong{display:block;font-size:11pt;color:#111;font-weight:600;margin-bottom:2px}
  h2{font-size:10pt;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#444;margin:14px 0 6px;border-left:3px solid #111;padding-left:8px}
  .section{margin-bottom:12px;page-break-inside:avoid}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:10pt}
  .grid-3{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:6px 24px;font-size:10pt}
  .field{display:flex;flex-direction:column}
  .field .label{font-size:8.5pt;color:#666;text-transform:uppercase;letter-spacing:0.05em}
  .field .value{font-size:10.5pt;color:#111;font-weight:500;font-variant-numeric:tabular-nums}
  table.exames{width:100%;border-collapse:collapse;margin-top:4px;font-size:9.5pt}
  table.exames thead th{font-size:8.5pt;text-transform:uppercase;letter-spacing:0.04em;color:#666;border-bottom:1px solid #111;padding:6px 4px;text-align:left;font-weight:600}
  table.exames tbody td{padding:6px 4px;border-bottom:1px solid #ddd;vertical-align:top;font-variant-numeric:tabular-nums}
  table.exames tbody tr{page-break-inside:avoid}
  .num{text-align:right}
  .obs{font-size:9pt;color:#444;font-style:italic;margin-top:1px}
  .footer{margin-top:18px;padding-top:12px;border-top:1px solid #111;display:flex;justify-content:space-between;align-items:flex-end}
  .footer .signature-block{font-size:9pt;color:#111;flex:1}
  .footer .signature-block .label{color:#666;text-transform:uppercase;font-size:8pt;letter-spacing:0.05em;margin-bottom:2px}
  .footer .signature-block .name{font-size:11pt;font-weight:600}
  .footer .signature-block .registro{font-size:9.5pt;color:#444}
  .footer .signature-block .hash{font-size:8pt;color:#666;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;margin-top:6px;word-break:break-all}
  .footer .qr-block{margin-left:24px;text-align:center}
  .footer .qr-block img{display:block;width:96px;height:96px}
  .footer .qr-block .qr-caption{font-size:7.5pt;color:#666;margin-top:3px;max-width:120px;line-height:1.2;word-break:break-all}
  .meta{margin-top:6px;font-size:8.5pt;color:#666;text-align:center}
  .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:60pt;color:#000;opacity:0.04;font-weight:700;letter-spacing:0.1em;pointer-events:none;z-index:0}
  @media print{.watermark{opacity:0.04}}
`;

export function renderLaudoHtml(inputs: TemplateInputs): string {
  const { laudo, version, qrCodeDataUrl, validationUrl } = inputs;

  const exameRows = (laudo.exames ?? [])
    .map((exame) => {
      const result = formatResultado(exame);
      const unit = exame.resultados?.[0]?.unidade ?? '';
      const refRange = formatRefRange(exame);
      const obs = exame.limitacoesTecnicas
        ? `<div class="obs">${escapeHtml(exame.limitacoesTecnicas)}</div>`
        : '';
      const interp = exame.interpretacao
        ? `<div class="obs">${escapeHtml(exame.interpretacao)}</div>`
        : '';
      return `
        <tr>
          <td>
            <strong>${escapeHtml(exame.nome)}</strong>
            <div class="obs">${escapeHtml(exame.metodoAnalitico)}</div>
            ${obs}${interp}
          </td>
          <td class="num">${escapeHtml(result)}</td>
          <td>${escapeHtml(unit)}</td>
          <td>${refRange}</td>
        </tr>`;
    })
    .join('');

  const cpf = laudo.paciente?.cpf
    ? `<div class="field"><span class="label">CPF</span><span class="value">${escapeHtml(laudo.paciente.cpf)}</span></div>`
    : '';

  const hashTrunc = (version.chainHash ?? '').slice(0, 16);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Laudo ${escapeHtml(laudo.id)} — v${version.version}</title>
<style>${STYLES}</style>
</head>
<body>
  <div class="watermark">DOCUMENTO CONTROLADO</div>
  <div class="doc">
    <div class="header">
      <div class="lab-block">
        <div class="lab-name">${escapeHtml(laudo.labName)}</div>
        <div class="lab-meta">CNES ${escapeHtml(laudo.cnes)} · ${escapeHtml(laudo.labEndereco)} · Tel ${escapeHtml(laudo.labTelefone)}</div>
      </div>
      <div class="laudo-id">
        <strong>Laudo ${escapeHtml(laudo.id)}</strong>
        <div>Versão ${version.version}</div>
        <div>Emitido em ${formatDateTime(laudo.emissaoEm)}</div>
      </div>
    </div>

    <div class="section">
      <h2>Responsabilidade Técnica</h2>
      <div class="grid-2">
        <div class="field"><span class="label">Responsável Técnico</span><span class="value">${escapeHtml(laudo.rtNome)} (${escapeHtml(laudo.rtRegistro)})</span></div>
        <div class="field"><span class="label">Profissional que Assina</span><span class="value">${escapeHtml(laudo.profissionalAssinaName)} (${escapeHtml(laudo.profissionalAssinaRegistro)})</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Paciente</h2>
      <div class="grid-3">
        <div class="field"><span class="label">Nome</span><span class="value">${escapeHtml(laudo.paciente?.nome)}</span></div>
        <div class="field"><span class="label">Idade / Nasc.</span><span class="value">${escapeHtml(formatIdade(laudo.pacienteIdade))}</span></div>
        <div class="field"><span class="label">Sexo</span><span class="value">${escapeHtml(laudo.paciente?.sexo)}</span></div>
        ${cpf}
      </div>
    </div>

    <div class="section">
      <h2>Coleta</h2>
      <div class="grid-2">
        <div class="field"><span class="label">Data da Coleta</span><span class="value">${formatDateTime(laudo.coletaEm)}</span></div>
        <div class="field"><span class="label">Material</span><span class="value">${escapeHtml(laudo.exames?.[0]?.tipoMaterial ?? '—')}</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Resultados</h2>
      <table class="exames">
        <thead>
          <tr>
            <th>Exame / Método</th>
            <th class="num">Resultado</th>
            <th>Unidade</th>
            <th>Valores de Referência</th>
          </tr>
        </thead>
        <tbody>${exameRows}</tbody>
      </table>
    </div>

    <div class="footer">
      <div class="signature-block">
        <div class="label">Assinatura digital</div>
        <div class="name">${escapeHtml(version.signature?.operatorName ?? laudo.rtNome)}</div>
        <div class="registro">${escapeHtml(version.signature?.operatorRegistro ?? laudo.rtRegistro)}</div>
        <div class="hash">SHA-256 · ${escapeHtml(hashTrunc)}…</div>
        <div class="hash">Assinado em ${formatDateTime(version.signature?.timestamp)}</div>
      </div>
      <div class="qr-block">
        <img src="${qrCodeDataUrl}" alt="QR de validação do laudo" />
        <div class="qr-caption">Escaneie para validar autenticidade<br/>${escapeHtml(validationUrl)}</div>
      </div>
    </div>

    <div class="meta">Documento gerado pelo HC Quality · v${version.version} · Conforme RDC 978/2025 Art. 167</div>
  </div>
</body>
</html>`;
}
