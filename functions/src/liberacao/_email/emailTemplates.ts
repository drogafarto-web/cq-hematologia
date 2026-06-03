/**
 * Email templates para notificação de críticos
 * HTML + plain text fallback
 */

interface EmailTemplateInput {
  tipo: 'critico-alta' | 'critico-baixa' | 'rotina';
  paciente_nome: string;
  paciente_iniciais: string;
  medico_nome: string;
  lab_name: string;
  criticos?: Array<{
    analito: string;
    valor: number;
    unidade: string;
    severidade: string;
  }>;
  laudoUrl: string;
}

export function subjectTemplate(input: EmailTemplateInput): string {
  switch (input.tipo) {
    case 'critico-alta':
      return `🚨 CRÍTICO (Alta) — ${input.paciente_iniciais} — ${input.lab_name}`;
    case 'critico-baixa':
      return `⚠️ CRÍTICO (Baixa) — ${input.paciente_iniciais} — ${input.lab_name}`;
    case 'rotina':
      return `📋 Laudo Disponível — ${input.paciente_iniciais} — ${input.lab_name}`;
    default:
      return 'Novo Laudo';
  }
}

export function bodyTemplate(input: EmailTemplateInput): string {
  const header = getHeaderByType(input.tipo);
  const criticosHtml =
    input.criticos
      ?.map(
        (c) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">
        <strong>${c.analito}</strong>
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-family: monospace;">
        ${c.valor} ${c.unidade}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">
        <span style="background: ${c.severidade === 'alta' ? '#fee2e2' : '#fef3c7'}; color: ${c.severidade === 'alta' ? '#dc2626' : '#d97706'}; padding: 2px 6px; border-radius: 3px; font-size: 12px;">
          ${c.severidade === 'alta' ? 'ALTA' : 'BAIXA'}
        </span>
      </td>
    </tr>
  `,
      )
      .join('') || '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${header.bgColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { border: 1px solid #ddd; border-top: none; padding: 20px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .cta-button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
    .footer { font-size: 12px; color: #999; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${header.title}</h1>
      <p style="margin: 10px 0 0 0; font-size: 14px;">${input.lab_name}</p>
    </div>

    <div class="content">
      <p>Olá <strong>${input.medico_nome}</strong>,</p>

      <p>Um novo laudo foi gerado para o paciente <strong>${input.paciente_nome}</strong>.</p>

      ${
        input.criticos && input.criticos.length > 0
          ? `
      <h3 style="color: ${header.titleColor};">Resultados Críticos Detectados</h3>
      <table class="table">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left; font-weight: 600;">Analito</th>
            <th style="padding: 8px; text-align: right; font-weight: 600;">Resultado</th>
            <th style="padding: 8px; font-weight: 600;">Severidade</th>
          </tr>
        </thead>
        <tbody>
          ${criticosHtml}
        </tbody>
      </table>
      `
          : ''
      }

      <p style="text-align: center;">
        <a href="${input.laudoUrl}" class="cta-button">Ver Laudo Completo</a>
      </p>

      <p style="font-size: 13px; color: #666;">
        Este laudo está disponível no sistema HC Quality — Controle de Qualidade.
      </p>
    </div>

    <div class="footer">
      <p>© HC Quality — Controle Interno de Qualidade. Todos os direitos reservados.</p>
      <p>Este é um email automático. Não responda diretamente.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function getHeaderByType(tipo: string): { bgColor: string; titleColor: string; title: string } {
  switch (tipo) {
    case 'critico-alta':
      return {
        bgColor: '#dc2626',
        titleColor: '#dc2626',
        title: '🚨 CRÍTICO (Severidade Alta)',
      };
    case 'critico-baixa':
      return {
        bgColor: '#d97706',
        titleColor: '#d97706',
        title: '⚠️ CRÍTICO (Severidade Baixa)',
      };
    case 'rotina':
      return {
        bgColor: '#059669',
        titleColor: '#059669',
        title: '📋 Novo Laudo Disponível',
      };
    default:
      return {
        bgColor: '#6b7280',
        titleColor: '#6b7280',
        title: 'Notificação de Laudo',
      };
  }
}

export function plainTextTemplate(input: EmailTemplateInput): string {
  let text = `${subjectTemplate(input)}\n\n`;
  text += `Laboratório: ${input.lab_name}\n`;
  text += `Paciente: ${input.paciente_nome}\n`;
  text += `Médico: ${input.medico_nome}\n\n`;

  if (input.criticos && input.criticos.length > 0) {
    text += 'RESULTADOS CRÍTICOS:\n';
    for (const c of input.criticos) {
      text += `  ${c.analito}: ${c.valor} ${c.unidade} (${c.severidade})\n`;
    }
    text += '\n';
  }

  text += `Ver laudo completo: ${input.laudoUrl}\n`;
  return text;
}
