/**
 * Email Templates for Critical Value Escalation
 * Phase 5: Multi-tier escalation (Tier 1 RT → Tier 2 Physician → Tier 3 CTO)
 *
 * Templates support:
 * - Initial escalation notification (RT/Physician/CTO)
 * - SLA breach alerts
 * - NOTIVISA draft submission notification
 *
 * Localization: Portuguese (pt-BR) primary with fallback to English
 * Responsive HTML for email clients (Gmail, Outlook, Apple Mail)
 */

import type { CriticosEscalacao, CriticosTierEscalation } from '../../../../modules/criticos/types';

export interface EmailTemplateOutput {
  subject: string;
  html: string;
  text: string;
}

export interface EscalacaoTemplateOptions {
  locale?: 'pt-BR' | 'en';
  baseUrl?: string; // Portal base URL (e.g., https://hmatologia2.web.app)
  labLogoUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Localization strings
// ─────────────────────────────────────────────────────────────────────────────

const i18n = {
  'pt-BR': {
    subject: {
      escalacaoRT: '🚨 CRÍTICO — Ação Imediata Requerida — {paciente}',
      escalacaoMedico: '⚠️ CRÍTICO — Resposta do Médico Requerida — {paciente}',
      escalacaoCTO: '🔴 CRÍTICO — Escalação Final — {paciente}',
      slaBreach: '🔔 SLA Vencido — Crítico não reconhecido — {paciente}',
      notiVisaDraft: '📋 Laudo Crítico Pendente — NOTIVISA {status}',
    },
    body: {
      greeting: 'Olá {nome},',
      patientInfo: 'Paciente',
      result: 'Resultado',
      normalRange: 'Intervalo de Referência',
      severity: 'Severidade',
      severityHigh: 'CRÍTICO (Alto)',
      severityLow: 'CRÍTICO (Baixo)',
      physician: 'Médico',
      rt: 'Responsável Técnico',
      cto: 'CTO',
      slaTarget: 'Meta de Resposta',
      minutes: 'min',
      actionRequired: 'Ação Requerida',
      acknowledgeInPortal: 'Reconhecer no Portal',
      viewDetails: 'Ver Detalhes',
      tier1: 'Nível 1 — RT (15 minutos)',
      tier2: 'Nível 2 — Médico (30 minutos)',
      tier3: 'Nível 3 — CTO/Diretor Médico (60 minutos)',
      slaExpired: 'Prazo Excedido',
      attemptCount: 'Tentativas',
      nextAction: 'Próxima Ação',
      notiVisaStatus: 'Status NOTIVISA',
      draftUrl: 'Abrir Rascunho',
      laboratory: 'Laboratório',
      doNotReply: 'Este é um email automático. Não responda diretamente.',
      copyright: '© HC Quality — Controle Interno de Qualidade',
      timestamp: 'Gerado em {date}',
      escalationType: {
        INITIAL: 'Notificação Inicial',
        RETRANSMIT: 'Retransmissão — SLA em risco',
        NEXT_TIER: 'Escalação para próximo nível',
      },
    },
  },
  en: {
    subject: {
      escalacaoRT: '🚨 CRITICAL — Immediate Action Required — {paciente}',
      escalacaoMedico: '⚠️ CRITICAL — Physician Response Needed — {paciente}',
      escalacaoCTO: '🔴 CRITICAL — Final Escalation — {paciente}',
      slaBreach: '🔔 SLA Breached — Unacknowledged Critical — {paciente}',
      notiVisaDraft: '📋 Critical Report Pending — NOTIVISA {status}',
    },
    body: {
      greeting: 'Hello {nome},',
      patientInfo: 'Patient',
      result: 'Result',
      normalRange: 'Reference Range',
      severity: 'Severity',
      severityHigh: 'CRITICAL (High)',
      severityLow: 'CRITICAL (Low)',
      physician: 'Physician',
      rt: 'Technical Responsible',
      cto: 'CTO',
      slaTarget: 'Response Target',
      minutes: 'min',
      actionRequired: 'Action Required',
      acknowledgeInPortal: 'Acknowledge in Portal',
      viewDetails: 'View Details',
      tier1: 'Tier 1 — RT (15 minutes)',
      tier2: 'Tier 2 — Physician (30 minutes)',
      tier3: 'Tier 3 — CTO/Medical Director (60 minutes)',
      slaExpired: 'Deadline Exceeded',
      attemptCount: 'Attempts',
      nextAction: 'Next Action',
      notiVisaStatus: 'NOTIVISA Status',
      draftUrl: 'Open Draft',
      laboratory: 'Laboratory',
      doNotReply: 'This is an automated email. Do not reply directly.',
      copyright: '© HC Quality — Internal Quality Control',
      timestamp: 'Generated at {date}',
      escalationType: {
        INITIAL: 'Initial Notification',
        RETRANSMIT: 'Retransmission — SLA at risk',
        NEXT_TIER: 'Escalation to next level',
      },
    },
  },
};

function t<K extends keyof (typeof i18n)['pt-BR']>(
  locale: 'pt-BR' | 'en',
  key: K,
): (typeof i18n)['pt-BR'][K] {
  return i18n[locale][key];
}

function substitute(str: string, vars: Record<string, string | number>): string {
  return str.replace(/{(\w+)}/g, (_, key) => String(vars[key] ?? ''));
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 1: Initial Escalation Email
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders escalation notification email for RT/Physician/CTO tier
 */
export function renderEscalacaoEmail(
  escalacao: CriticosEscalacao,
  analito: {
    nome: string;
    valor: number;
    unidade: string;
    intervaloReferencia?: string;
  },
  destinatario: 'RT' | 'MEDICO' | 'CTO' | 'DIRETOR_MEDICO',
  options: EscalacaoTemplateOptions = {},
): EmailTemplateOutput {
  const locale = options.locale ?? 'pt-BR';
  const baseUrl = options.baseUrl ?? 'https://hmatologia2.web.app';
  const now = new Date();
  const dateStr = now.toLocaleString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let recipientName = '';
  let subjectTemplate = '';

  if (destinatario === 'RT') {
    recipientName = escalacao.rtNome;
    subjectTemplate = 'escalacaoRT';
  } else if (destinatario === 'MEDICO') {
    recipientName = escalacao.medicoNome;
    subjectTemplate = 'escalacaoMedico';
  } else {
    // CTO or DIRETOR_MEDICO
    recipientName = escalacao.medicoNome; // Placeholder; in production, resolve from DB
    subjectTemplate = 'escalacaoCTO';
  }

  const severityLabel =
    escalacao.severidade === 'alta'
      ? t(locale, 'body').severityHigh
      : t(locale, 'body').severityLow;
  const severityColor = escalacao.severidade === 'alta' ? '#dc2626' : '#d97706';

  const subject = substitute(
    t(locale, 'subject')[subjectTemplate as keyof (typeof i18n)['pt-BR']['subject']],
    {
      paciente: escalacao.pacienteNome,
    },
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f9fafb;
      color: #1f2937;
      line-height: 1.5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background-color: ${severityColor};
      color: white;
      padding: 24px 20px;
      text-align: center;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }
    .header p {
      font-size: 13px;
      opacity: 0.95;
    }
    .content {
      padding: 24px 20px;
    }
    .greeting {
      font-size: 15px;
      margin-bottom: 16px;
    }
    .section {
      margin-bottom: 24px;
      padding: 16px;
      background-color: #f3f4f6;
      border-radius: 6px;
    }
    .section h3 {
      font-size: 13px;
      font-weight: 600;
      color: ${severityColor};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .section-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 13px;
    }
    .grid-item {
      padding: 8px;
      background-color: white;
      border-radius: 4px;
      border-left: 3px solid ${severityColor};
    }
    .grid-label {
      font-weight: 600;
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .grid-value {
      margin-top: 4px;
      font-size: 14px;
      color: #1f2937;
      font-weight: 500;
    }
    .sla-box {
      margin-bottom: 16px;
      padding: 12px;
      background-color: #fef3c7;
      border-left: 4px solid #d97706;
      border-radius: 4px;
    }
    .sla-box.expired {
      background-color: #fee2e2;
      border-left-color: #dc2626;
    }
    .sla-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: ${severityColor};
      letter-spacing: 0.3px;
    }
    .sla-value {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      margin-top: 4px;
    }
    .action-box {
      margin-top: 20px;
      padding: 16px;
      background-color: #ecfdf5;
      border-left: 4px solid #059669;
      border-radius: 4px;
      text-align: center;
    }
    .action-box h4 {
      font-size: 13px;
      font-weight: 600;
      color: #059669;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 12px;
    }
    .button {
      display: inline-block;
      background-color: ${severityColor};
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .button:hover {
      opacity: 0.9;
    }
    .button-secondary {
      background-color: #6366f1;
      margin-left: 8px;
    }
    .footer {
      padding: 20px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .footer p {
      margin-bottom: 8px;
    }
    .footer a {
      color: #6366f1;
      text-decoration: none;
    }
    @media (max-width: 480px) {
      .container { border-radius: 0; }
      .content { padding: 16px; }
      .section-grid { grid-template-columns: 1fr; }
      .button { display: block; margin-bottom: 8px; width: 100%; box-sizing: border-box; }
      .button-secondary { margin-left: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${severityColor === '#dc2626' ? '🚨 CRÍTICO (Alto)' : '⚠️ CRÍTICO (Baixo)'}</h1>
      <p>${escalacao.labId ? 'Laboratório: ' + escalacao.labId : ''}</p>
    </div>

    <div class="content">
      <p class="greeting">${substitute(t(locale, 'body').greeting, { nome: recipientName })}</p>

      <p style="margin-bottom: 20px; font-size: 14px;">
        Um resultado crítico foi detectado e requer sua ação imediata.
      </p>

      <!-- Patient & Result Section -->
      <div class="section">
        <h3>Informações do Paciente e Resultado</h3>
        <div class="section-grid">
          <div class="grid-item">
            <div class="grid-label">${t(locale, 'body').patientInfo}</div>
            <div class="grid-value">${escalacao.pacienteNome}</div>
          </div>
          <div class="grid-item">
            <div class="grid-label">Idade / Sexo</div>
            <div class="grid-value">${escalacao.pacienteIdade} anos / ${escalacao.pacienteSexo}</div>
          </div>
          <div class="grid-item">
            <div class="grid-label">${t(locale, 'body').result}</div>
            <div class="grid-value">${analito.valor} ${analito.unidade}</div>
          </div>
          <div class="grid-item">
            <div class="grid-label">${t(locale, 'body').normalRange}</div>
            <div class="grid-value">${analito.intervaloReferencia ?? '—'}</div>
          </div>
          <div class="grid-item">
            <div class="grid-label">Analito</div>
            <div class="grid-value">${analito.nome}</div>
          </div>
          <div class="grid-item">
            <div class="grid-label">${t(locale, 'body').severity}</div>
            <div class="grid-value" style="color: ${severityColor}; font-weight: 700;">${severityLabel}</div>
          </div>
        </div>
      </div>

      <!-- SLA & Physician Section -->
      <div class="section">
        <h3>Médico Assistente</h3>
        <div class="section-grid">
          <div class="grid-item">
            <div class="grid-label">${t(locale, 'body').physician}</div>
            <div class="grid-value">${escalacao.medicoNome}</div>
          </div>
          <div class="grid-item">
            <div class="grid-label">Telefone</div>
            <div class="grid-value">${escalacao.medicoTelefone}</div>
          </div>
        </div>
      </div>

      <!-- SLA Alert -->
      <div class="sla-box ${escalacao.sla_status === 'vencido' ? 'expired' : ''}">
        <div class="sla-label">${t(locale, 'body').slaTarget}</div>
        <div class="sla-value">${escalacao.sla_minutos_target} ${t(locale, 'body').minutes}</div>
        <p style="font-size: 12px; margin-top: 8px; color: ${severityColor};">
          ${
            escalacao.sla_status === 'vencido'
              ? '⚠️ Prazo excedido — resposta urgente requerida'
              : '✓ Em conformidade com SLA'
          }
        </p>
      </div>

      <!-- Action Required -->
      <div class="action-box">
        <h4>${t(locale, 'body').actionRequired}</h4>
        <div>
          <a href="${baseUrl}/portal/criticos/${escalacao.id}" class="button">
            ${t(locale, 'body').acknowledgeInPortal}
          </a>
          <a href="${baseUrl}/laudos/${escalacao.laudoId}" class="button button-secondary">
            ${t(locale, 'body').viewDetails}
          </a>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>${t(locale, 'body').doNotReply}</p>
      <p>${substitute(t(locale, 'body').timestamp, { date: dateStr })}</p>
      <p>${t(locale, 'body').copyright}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `${subject}

${substitute(t(locale, 'body').greeting, { nome: recipientName })}

${t(locale, 'body').patientInfo}: ${escalacao.pacienteNome}
Idade: ${escalacao.pacienteIdade} anos
Sexo: ${escalacao.pacienteSexo}

${t(locale, 'body').result}:
  Analito: ${analito.nome}
  Valor: ${analito.valor} ${analito.unidade}
  Intervalo: ${analito.intervaloReferencia ?? '—'}
  Severidade: ${severityLabel}

${t(locale, 'body').physician}: ${escalacao.medicoNome}
Telefone: ${escalacao.medicoTelefone}

${t(locale, 'body').slaTarget}: ${escalacao.sla_minutos_target} minutos
SLA Status: ${escalacao.sla_status === 'vencido' ? '❌ VENCIDO' : '✓ EM CONFORMIDADE'}

${t(locale, 'body').actionRequired}:
${baseUrl}/portal/criticos/${escalacao.id}

${t(locale, 'body').doNotReply}
${substitute(t(locale, 'body').timestamp, { date: dateStr })}
${t(locale, 'body').copyright}
`;

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 2: SLA Breach Alert
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders SLA breach alert — tier failed to acknowledge within SLA
 */
export function renderSLABreachEmail(
  escalacao: CriticosEscalacao,
  failedTier: CriticosTierEscalation,
  nextTier?: CriticosTierEscalation,
  options: EscalacaoTemplateOptions = {},
): EmailTemplateOutput {
  const locale = options.locale ?? 'pt-BR';
  const baseUrl = options.baseUrl ?? 'https://hmatologia2.web.app';
  const now = new Date();
  const dateStr = now.toLocaleString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const subject = substitute(t(locale, 'subject').slaBreach, {
    paciente: escalacao.pacienteNome,
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f9fafb;
      color: #1f2937;
      line-height: 1.5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background-color: #dc2626;
      color: white;
      padding: 24px 20px;
      text-align: center;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .content {
      padding: 24px 20px;
    }
    .alert-box {
      padding: 16px;
      background-color: #fee2e2;
      border-left: 4px solid #dc2626;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .alert-box h3 {
      color: #991b1b;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .tier-info {
      margin-bottom: 20px;
      padding: 12px;
      background-color: #f3f4f6;
      border-radius: 6px;
    }
    .tier-info h4 {
      color: #dc2626;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .tier-detail {
      font-size: 13px;
      margin-bottom: 4px;
    }
    .tier-detail strong { color: #1f2937; }
    .next-tier-box {
      padding: 16px;
      background-color: #fef3c7;
      border-left: 4px solid #d97706;
      border-radius: 4px;
      margin-top: 16px;
    }
    .button {
      display: inline-block;
      background-color: #dc2626;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      margin-top: 12px;
    }
    .footer {
      padding: 20px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 SLA Vencido</h1>
      <p>Crítico Não Reconhecido</p>
    </div>

    <div class="content">
      <p>Alerta: O prazo de resposta (SLA) para o crítico do paciente <strong>${escalacao.pacienteNome}</strong> foi excedido.</p>

      <div class="alert-box">
        <h3>⚠️ Nível ${failedTier.tier} Falhou</h3>
        <div class="tier-detail">
          <strong>Destinatário:</strong> ${failedTier.destinatarioNome} (${failedTier.destinatario})
        </div>
        <div class="tier-detail">
          <strong>Meta de Resposta:</strong> ${failedTier.slaMinutos} minutos
        </div>
        <div class="tier-detail">
          <strong>Status:</strong> Não reconhecido
        </div>
      </div>

      ${
        nextTier
          ? `
      <div class="next-tier-box">
        <h4>Escalando para Nível ${nextTier.tier}…</h4>
        <p>O crítico será escalado para:</p>
        <div class="tier-detail">
          <strong>${nextTier.destinatarioNome}</strong> (${nextTier.destinatario})<br/>
          Meta: ${nextTier.slaMinutos} minutos
        </div>
      </div>
      `
          : ''
      }

      <div style="text-align: center; margin-top: 24px;">
        <a href="${baseUrl}/portal/criticos/${escalacao.id}" class="button">
          Reconhecer Agora
        </a>
      </div>
    </div>

    <div class="footer">
      <p>${t(locale, 'body').doNotReply}</p>
      <p>${substitute(t(locale, 'body').timestamp, { date: dateStr })}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `${subject}

Alerta: O prazo de resposta (SLA) para o crítico do paciente ${escalacao.pacienteNome} foi excedido.

Nível ${failedTier.tier} Falhou:
  Destinatário: ${failedTier.destinatarioNome} (${failedTier.destinatario})
  Meta de Resposta: ${failedTier.slaMinutos} minutos
  Status: Não reconhecido

${
  nextTier
    ? `Escalando para Nível ${nextTier.tier}:
  ${nextTier.destinatarioNome} (${nextTier.destinatario})
  Meta: ${nextTier.slaMinutos} minutos

`
    : ''
}Reconheça agora:
${baseUrl}/portal/criticos/${escalacao.id}

${t(locale, 'body').doNotReply}
${substitute(t(locale, 'body').timestamp, { date: dateStr })}
`;

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 3: NOTIVISA Draft Notification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders NOTIVISA draft submission notification
 * Status: 'draft' | 'submitted' | 'approved' | 'rejected'
 */
export function renderNOTIVISANotificationEmail(
  laudoId: string,
  pacienteNome: string,
  status: 'draft' | 'submitted' | 'approved' | 'rejected',
  draftId: string,
  options: EscalacaoTemplateOptions = {},
): EmailTemplateOutput {
  const locale = options.locale ?? 'pt-BR';
  const baseUrl = options.baseUrl ?? 'https://hmatologia2.web.app';
  const now = new Date();
  const dateStr = now.toLocaleString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const statusLabels: Record<typeof status, { color: string; label: string }> = {
    draft: { color: '#6b7280', label: 'Rascunho' },
    submitted: { color: '#2563eb', label: 'Enviado' },
    approved: { color: '#059669', label: 'Aprovado' },
    rejected: { color: '#dc2626', label: 'Rejeitado' },
  };

  const { color: statusColor, label: statusLabel } = statusLabels[status];

  const subject = substitute(t(locale, 'subject').notiVisaDraft, {
    status: statusLabel,
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f9fafb;
      color: #1f2937;
      line-height: 1.5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background-color: ${statusColor};
      color: white;
      padding: 24px 20px;
      text-align: center;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .content {
      padding: 24px 20px;
    }
    .status-badge {
      display: inline-block;
      background-color: ${statusColor};
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 16px;
    }
    .info-box {
      padding: 16px;
      background-color: #f3f4f6;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: #666;
    }
    .info-value {
      color: #1f2937;
    }
    .button {
      display: inline-block;
      background-color: ${statusColor};
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      margin-top: 12px;
    }
    .note {
      padding: 12px;
      background-color: #fef3c7;
      border-left: 4px solid #d97706;
      border-radius: 4px;
      margin-top: 16px;
      font-size: 13px;
    }
    .footer {
      padding: 20px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 NOTIVISA — Laudo Crítico</h1>
      <p>${pacienteNome}</p>
    </div>

    <div class="content">
      <div class="status-badge">${statusLabel}</div>

      <p>O rascunho NOTIVISA para o paciente <strong>${pacienteNome}</strong> foi atualizado.</p>

      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Status</div>
          <div class="info-value" style="color: ${statusColor}; font-weight: 600;">${statusLabel}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Laudo ID</div>
          <div class="info-value">${laudoId}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Rascunho ID</div>
          <div class="info-value" style="font-family: monospace; font-size: 12px;">${draftId}</div>
        </div>
      </div>

      ${
        status === 'draft'
          ? `<p>O rascunho está pronto para revisão e submissão ao NOTIVISA.</p>`
          : status === 'submitted'
            ? `<p>O rascunho foi enviado ao NOTIVISA para aprovação. Você será notificado quando o status mudar.</p>`
            : status === 'approved'
              ? `<p>O rascunho foi aprovado pelo NOTIVISA.</p>`
              : `<p>O rascunho foi rejeitado. Revise e corrija conforme necessário.</p>`
      }

      <div style="text-align: center;">
        <a href="${baseUrl}/notivisa/drafts/${draftId}" class="button">
          Abrir Rascunho
        </a>
      </div>

      <div class="note">
        <strong>ℹ️ Próximos Passos:</strong>
        ${
          status === 'draft'
            ? 'Revise o formulário e submeta ao NOTIVISA.'
            : status === 'submitted'
              ? 'Aguarde a aprovação ou rejeição do NOTIVISA.'
              : status === 'approved'
                ? 'O laudo foi aceito oficialmente.'
                : 'Corrija os erros indicados e resubmita.'
        }
      </div>
    </div>

    <div class="footer">
      <p>${t(locale, 'body').doNotReply}</p>
      <p>${substitute(t(locale, 'body').timestamp, { date: dateStr })}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `${subject}

Status: ${statusLabel}

Paciente: ${pacienteNome}
Laudo ID: ${laudoId}
Rascunho ID: ${draftId}

${
  status === 'draft'
    ? 'O rascunho está pronto para revisão e submissão ao NOTIVISA.'
    : status === 'submitted'
      ? 'O rascunho foi enviado ao NOTIVISA para aprovação.'
      : status === 'approved'
        ? 'O rascunho foi aprovado pelo NOTIVISA.'
        : 'O rascunho foi rejeitado. Revise e corrija conforme necessário.'
}

Abrir Rascunho:
${baseUrl}/notivisa/drafts/${draftId}

${t(locale, 'body').doNotReply}
${substitute(t(locale, 'body').timestamp, { date: dateStr })}
`;

  return { subject, html, text };
}
