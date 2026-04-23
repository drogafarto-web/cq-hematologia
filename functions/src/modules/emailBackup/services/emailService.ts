import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';
import type { BackupReport } from '../types';
import { formatStalenessAlert } from './stalenessService';

// ─── Secret ───────────────────────────────────────────────────────────────────
// Set via: firebase secrets:set RESEND_API_KEY
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// ─── Email Service ────────────────────────────────────────────────────────────

export interface BackupEmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendBackupEmailOptions {
  /** Um ou mais destinatários. Array vazio é erro do chamador (filtre antes). */
  to: string | string[];
  report: BackupReport;
  /**
   * Attachments to include, in order. The first is assumed to be the canonical
   * backup PDF; additional attachments (ex: relatório operacional) são anexos
   * suplementares. Caller é responsável por garantir tamanho total < 10MB
   * (limite Resend).
   */
  attachments: BackupEmailAttachment[];
  /**
   * Marcador de status agregado — quando o relatório operacional detecta algo
   * crítico que não está refletido nos staleness alerts do backup, o caller
   * pode elevar o subject aqui.
   */
  elevatedSubject?: 'critico' | 'atencao' | null;
  /** Resumo curto do relatório operacional para mostrar no corpo HTML. */
  operacionalSummary?: {
    status: 'ok' | 'atencao' | 'critico';
    globalApprovalRate: number | null;
    totalRuns: number;
    criticalAlerts: number;
    warningAlerts: number;
  };
}

/**
 * Sends the daily backup email with the PDF attached.
 * Uses Resend — configure RESEND_API_KEY via Firebase secrets.
 *
 * Aceita múltiplos destinatários: Resend envia UM email com N endereços no
 * header `To:` (lab admin + coordenador + RT recebem cópia nominal). Para
 * anonimato entre destinatários (um não vê o outro) usar bcc no futuro.
 */
export async function sendBackupEmail(opts: SendBackupEmailOptions): Promise<void> {
  const { to, report, attachments, elevatedSubject, operacionalSummary } = opts;

  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) {
    throw new Error('[sendBackupEmail] recipients list is empty');
  }
  if (!attachments || attachments.length === 0) {
    throw new Error('[sendBackupEmail] attachments must contain at least one PDF');
  }

  const totalBytes = attachments.reduce((s, a) => s + a.content.byteLength, 0);
  // Resend cap: ~10MB por email. Falhar cedo e claro.
  if (totalBytes > 10 * 1024 * 1024) {
    throw new Error(
      `[sendBackupEmail] total attachments size ${totalBytes}B exceeds Resend 10MB limit`,
    );
  }

  const resend = new Resend(RESEND_API_KEY.value());

  const subject = buildSubject(report, elevatedSubject ?? null);
  const html = buildHtmlBody(report, attachments.length, operacionalSummary);
  const text = buildTextBody(report, attachments.length, operacionalSummary);

  const { error } = await resend.emails.send({
    from: 'HC Quality Backup <backup@app.labclinmg.com.br>',
    to: recipients,
    subject,
    html,
    text,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  if (error) {
    throw new Error(`Resend API error: ${JSON.stringify(error)}`);
  }
}

// ─── Subject Builder ──────────────────────────────────────────────────────────

function buildSubject(
  report: BackupReport,
  elevatedSubject: 'critico' | 'atencao' | null,
): string {
  const stalenessCritical = report.stalenessAlerts.some((a) => a.level === 'critical');
  const stalenessWarning = report.stalenessAlerts.some((a) => a.level === 'warning');

  const hasCritical = stalenessCritical || elevatedSubject === 'critico';
  const hasWarning =
    !hasCritical && (stalenessWarning || elevatedSubject === 'atencao');

  const dateStr = new Date(report.generatedAt).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (hasCritical) {
    const subjectCause = stalenessCritical
      ? 'Inatividade grave detectada'
      : 'Sinais críticos no CIQ';
    return `[CRÍTICO] HC Quality — ${subjectCause} — ${report.labName} — ${dateStr}`;
  }
  if (hasWarning) {
    const subjectCause = stalenessWarning
      ? 'Inatividade detectada'
      : 'Atenção no CIQ';
    return `[ATENÇÃO] HC Quality — ${subjectCause} — ${report.labName} — ${dateStr}`;
  }

  const totalRuns = report.sections.reduce((s, m) => s + m.totalRuns, 0);
  const isMonthly = new Date().getDate() === 1;
  const prefix = isMonthly ? 'Resumo Mensal' : 'Backup Diário';

  return `[HC Quality] ${prefix} — ${report.labName} — ${dateStr} (${totalRuns} corrida${totalRuns !== 1 ? 's' : ''})`;
}

// ─── HTML Body ────────────────────────────────────────────────────────────────

function buildHtmlBody(
  report: BackupReport,
  attachmentCount: number,
  operacional: SendBackupEmailOptions['operacionalSummary'],
): string {
  const periodStr = `${formatDateBR(report.periodStart)} – ${formatDateBR(report.periodEnd)}`;
  const totalRuns = report.sections.reduce((s, m) => s + m.totalRuns, 0);
  const totalNC = report.sections.reduce((s, m) => s + m.nonConformingRuns, 0);
  const generatedAt = new Date(report.generatedAt).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });

  let alertsBlock = '';
  if (report.stalenessAlerts.length > 0) {
    const alertItems = report.stalenessAlerts
      .map((a) => {
        const isCrit = a.level === 'critical';
        const color = isCrit ? '#ef4444' : '#f59e0b';
        const bg = isCrit ? '#3b0f0f' : '#3b2c0a';
        const daysStr = isFinite(a.daysSinceLastRun)
          ? `${a.daysSinceLastRun} dia(s) sem registros`
          : 'nenhum registro encontrado';
        const lastStr = a.lastRunAt
          ? ` — último em ${new Date(a.lastRunAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
          : '';
        return `
          <div style="background:${bg};border-left:3px solid ${color};padding:10px 14px;margin-bottom:8px;border-radius:4px;">
            <strong style="color:${color}">${isCrit ? '🔴 CRÍTICO' : '🟡 ATENÇÃO'} — ${a.moduleName}</strong><br/>
            <span style="color:#a1a1aa;font-size:13px">${daysStr}${lastStr}</span>
          </div>`;
      })
      .join('');

    alertsBlock = `
      <div style="margin:24px 0;">
        <h3 style="color:#f4f4f5;font-size:14px;margin:0 0 12px">Alertas de Inatividade</h3>
        ${alertItems}
      </div>`;
  }

  let moduleSummaries = '';
  for (const section of report.sections) {
    const summaryRows = Object.entries(section.summary)
      .map(
        ([k, v]) => `
        <tr>
          <td style="color:#71717a;font-size:12px;padding:4px 0">${k}</td>
          <td style="color:#f4f4f5;font-size:12px;padding:4px 0;text-align:right"><strong>${v}</strong></td>
        </tr>`,
      )
      .join('');

    moduleSummaries += `
      <div style="border:1px solid #2a2a2a;border-radius:6px;padding:16px;margin-bottom:16px;">
        <h3 style="color:#3b82f6;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em">MÓDULO</h3>
        <h2 style="color:#f4f4f5;font-size:15px;margin:0 0 14px">${section.moduleName}</h2>
        <table style="width:100%;border-collapse:collapse">${summaryRows}</table>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0d0d0d;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">

    <!-- Header -->
    <div style="border-bottom:1px solid #2a2a2a;padding-bottom:20px;margin-bottom:24px">
      <span style="color:#3b82f6;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">HC QUALITY</span>
      <h1 style="color:#f4f4f5;font-size:20px;margin:8px 0 4px">Backup de Dados</h1>
      <p style="color:#71717a;font-size:13px;margin:0">${report.labName}</p>
    </div>

    <!-- Period + quick stats -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:8px;padding:16px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="color:#71717a;font-size:12px">Período</td>
          <td style="color:#f4f4f5;font-size:12px;text-align:right"><strong>${periodStr}</strong></td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:12px;padding-top:6px">Total de corridas</td>
          <td style="color:#f4f4f5;font-size:12px;text-align:right;padding-top:6px"><strong>${totalRuns}</strong></td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:12px;padding-top:6px">Não conformidades</td>
          <td style="color:${totalNC > 0 ? '#ef4444' : '#22c55e'};font-size:12px;text-align:right;padding-top:6px"><strong>${totalNC}</strong></td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:12px;padding-top:6px">Módulos incluídos</td>
          <td style="color:#f4f4f5;font-size:12px;text-align:right;padding-top:6px"><strong>${report.sections.length}</strong></td>
        </tr>
      </table>
    </div>

    ${alertsBlock}

    <!-- Operacional summary -->
    ${buildOperacionalBlock(operacional)}

    <!-- Module summaries -->
    ${moduleSummaries}

    <!-- Attachment note -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:6px;padding:14px;margin-bottom:24px">
      <p style="color:#71717a;font-size:12px;margin:0">
        ${
          attachmentCount > 1
            ? 'Este e-mail contém <strong>dois PDFs anexos</strong>: o <em>backup diário</em> (arquivo de redundância regulatório — guarde em local seguro conforme RDC 978/2025 e LGPD) e o <em>relatório operacional</em> (instrumento de decisão do RT — leitura diária, descarte mensal).'
            : 'O relatório completo com todos os registros está anexo neste email em formato PDF. Guarde-o em local seguro conforme sua política de retenção de dados (RDC 978/2025 / LGPD).'
        }
      </p>
    </div>

    <!-- Integrity -->
    <div style="margin-bottom:24px">
      <p style="color:#3b3b3b;font-size:10px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em">SHA-256</p>
      <code style="color:#3b82f6;font-size:10px;word-break:break-all">${report.contentHash}</code>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #2a2a2a;padding-top:16px">
      <p style="color:#3b3b3b;font-size:11px;margin:0">
        HC Quality · Backup automático · Gerado em ${generatedAt}
      </p>
      <p style="color:#3b3b3b;font-size:11px;margin:4px 0 0">
        Este e-mail foi enviado automaticamente. Não responda esta mensagem.
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Operacional block (HTML) ────────────────────────────────────────────────

function buildOperacionalBlock(
  operacional: SendBackupEmailOptions['operacionalSummary'],
): string {
  if (!operacional) return '';
  const statusColor =
    operacional.status === 'critico'
      ? '#ef4444'
      : operacional.status === 'atencao'
        ? '#f59e0b'
        : '#22c55e';
  const statusLabel =
    operacional.status === 'critico'
      ? 'CRÍTICO'
      : operacional.status === 'atencao'
        ? 'ATENÇÃO'
        : 'OK';
  const approvalStr =
    operacional.globalApprovalRate !== null
      ? `${operacional.globalApprovalRate.toFixed(1)}%`
      : '—';
  return `
    <div style="border:1px solid #2a2a2a;border-radius:8px;padding:16px;margin-bottom:20px;background:#101010">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="color:#3b82f6;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">RELATÓRIO OPERACIONAL</span>
        <span style="color:${statusColor};font-size:11px;font-weight:700;letter-spacing:.1em">${statusLabel}</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="color:#71717a;font-size:12px">Taxa de aprovação</td>
          <td style="color:${statusColor};font-size:12px;text-align:right"><strong>${approvalStr}</strong></td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:12px;padding-top:6px">Corridas no período</td>
          <td style="color:#f4f4f5;font-size:12px;text-align:right;padding-top:6px"><strong>${operacional.totalRuns}</strong></td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:12px;padding-top:6px">Alertas críticos</td>
          <td style="color:${operacional.criticalAlerts > 0 ? '#ef4444' : '#22c55e'};font-size:12px;text-align:right;padding-top:6px"><strong>${operacional.criticalAlerts}</strong></td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:12px;padding-top:6px">Avisos</td>
          <td style="color:${operacional.warningAlerts > 0 ? '#f59e0b' : '#22c55e'};font-size:12px;text-align:right;padding-top:6px"><strong>${operacional.warningAlerts}</strong></td>
        </tr>
      </table>
      <p style="color:#71717a;font-size:11px;margin:12px 0 0">Detalhamento completo no PDF <em>hcquality_operacional</em> em anexo.</p>
    </div>`;
}

// ─── Plain-text fallback ──────────────────────────────────────────────────────

function buildTextBody(
  report: BackupReport,
  attachmentCount: number,
  operacional: SendBackupEmailOptions['operacionalSummary'],
): string {
  const lines: string[] = [
    'HC QUALITY — BACKUP DE DADOS',
    '='.repeat(40),
    '',
    `Laboratório: ${report.labName}`,
    `Período: ${formatDateBR(report.periodStart)} – ${formatDateBR(report.periodEnd)}`,
    `Gerado em: ${new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    '',
  ];

  if (report.stalenessAlerts.length > 0) {
    lines.push('⚠ ALERTAS DE INATIVIDADE:', '-'.repeat(30));
    for (const alert of report.stalenessAlerts) {
      lines.push(formatStalenessAlert(alert));
    }
    lines.push('');
  }

  if (operacional) {
    const statusLabel =
      operacional.status === 'critico'
        ? 'CRÍTICO'
        : operacional.status === 'atencao'
          ? 'ATENÇÃO'
          : 'OK';
    lines.push(
      `RELATÓRIO OPERACIONAL — ${statusLabel}`,
      '-'.repeat(30),
      `  Taxa de aprovação: ${operacional.globalApprovalRate !== null ? operacional.globalApprovalRate.toFixed(1) + '%' : '—'}`,
      `  Corridas no período: ${operacional.totalRuns}`,
      `  Alertas críticos: ${operacional.criticalAlerts}`,
      `  Avisos: ${operacional.warningAlerts}`,
      '',
    );
  }

  for (const section of report.sections) {
    lines.push(`MÓDULO: ${section.moduleName}`, '-'.repeat(30));
    for (const [k, v] of Object.entries(section.summary)) {
      lines.push(`  ${k}: ${v}`);
    }
    lines.push('');
  }

  lines.push(
    `SHA-256: ${report.contentHash}`,
    '',
    attachmentCount > 1
      ? 'Este email traz dois PDFs: backup diário + relatório operacional.'
      : 'O relatório completo está anexo em PDF.',
    'HC Quality — Backup automático',
  );

  return lines.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function buildBackupFilename(labId: string, generatedAtISO: string): string {
  const date = new Date(generatedAtISO)
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .replace(/\//g, '-');
  return `hcquality_backup_${labId.slice(0, 8)}_${date}.pdf`;
}

export function buildOperacionalFilename(labId: string, generatedAtISO: string): string {
  const date = new Date(generatedAtISO)
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .replace(/\//g, '-');
  return `hcquality_operacional_${labId.slice(0, 8)}_${date}.pdf`;
}

function formatDateBR(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
