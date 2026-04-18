"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESEND_API_KEY = void 0;
exports.sendBackupEmail = sendBackupEmail;
const resend_1 = require("resend");
const params_1 = require("firebase-functions/params");
const stalenessService_1 = require("./stalenessService");
// ─── Secret ───────────────────────────────────────────────────────────────────
// Set via: firebase secrets:set RESEND_API_KEY
exports.RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
/**
 * Sends the daily backup email with the PDF attached.
 * Uses Resend — configure RESEND_API_KEY via Firebase secrets.
 *
 * The FROM address must be verified in your Resend account.
 * Default: backup@hcquality.com.br — change to match your verified domain.
 */
async function sendBackupEmail(opts) {
    const { to, report, pdfBuffer } = opts;
    const resend = new resend_1.Resend(exports.RESEND_API_KEY.value());
    const subject = buildSubject(report);
    const html = buildHtmlBody(report);
    const text = buildTextBody(report);
    const filename = buildFilename(report);
    const { error } = await resend.emails.send({
        from: 'HC Quality Backup <backup@hcquality.com.br>',
        to: [to],
        subject,
        html,
        text,
        attachments: [
            {
                filename,
                content: pdfBuffer,
            },
        ],
    });
    if (error) {
        throw new Error(`Resend API error: ${JSON.stringify(error)}`);
    }
}
// ─── Subject Builder ──────────────────────────────────────────────────────────
function buildSubject(report) {
    const hasCritical = report.stalenessAlerts.some(a => a.level === 'critical');
    const hasWarning = report.stalenessAlerts.some(a => a.level === 'warning');
    const dateStr = new Date(report.generatedAt).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    if (hasCritical) {
        return `[CRÍTICO] HC Quality — Inatividade grave detectada — ${report.labName} — ${dateStr}`;
    }
    if (hasWarning) {
        return `[ATENÇÃO] HC Quality — Inatividade detectada — ${report.labName} — ${dateStr}`;
    }
    const totalRuns = report.sections.reduce((s, m) => s + m.totalRuns, 0);
    const isMonthly = new Date().getDate() === 1;
    const prefix = isMonthly ? 'Resumo Mensal' : 'Backup Diário';
    return `[HC Quality] ${prefix} — ${report.labName} — ${dateStr} (${totalRuns} corrida${totalRuns !== 1 ? 's' : ''})`;
}
// ─── HTML Body ────────────────────────────────────────────────────────────────
function buildHtmlBody(report) {
    const periodStr = `${formatDateBR(report.periodStart)} – ${formatDateBR(report.periodEnd)}`;
    const totalRuns = report.sections.reduce((s, m) => s + m.totalRuns, 0);
    const totalNC = report.sections.reduce((s, m) => s + m.nonConformingRuns, 0);
    const generatedAt = new Date(report.generatedAt).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
    });
    let alertsBlock = '';
    if (report.stalenessAlerts.length > 0) {
        const alertItems = report.stalenessAlerts
            .map(a => {
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
            .map(([k, v]) => `
        <tr>
          <td style="color:#71717a;font-size:12px;padding:4px 0">${k}</td>
          <td style="color:#f4f4f5;font-size:12px;padding:4px 0;text-align:right"><strong>${v}</strong></td>
        </tr>`)
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

    <!-- Module summaries -->
    ${moduleSummaries}

    <!-- Attachment note -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:6px;padding:14px;margin-bottom:24px">
      <p style="color:#71717a;font-size:12px;margin:0">
        O relatório completo com todos os registros está anexo neste email em formato PDF.
        Guarde-o em local seguro conforme sua política de retenção de dados (RDC 978/2025 / LGPD).
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
// ─── Plain-text fallback ──────────────────────────────────────────────────────
function buildTextBody(report) {
    const lines = [
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
            lines.push((0, stalenessService_1.formatStalenessAlert)(alert));
        }
        lines.push('');
    }
    for (const section of report.sections) {
        lines.push(`MÓDULO: ${section.moduleName}`, '-'.repeat(30));
        for (const [k, v] of Object.entries(section.summary)) {
            lines.push(`  ${k}: ${v}`);
        }
        lines.push('');
    }
    lines.push(`SHA-256: ${report.contentHash}`, '', 'O relatório completo está anexo em PDF.', 'HC Quality — Backup automático');
    return lines.join('\n');
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildFilename(report) {
    const date = new Date(report.generatedAt)
        .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        .replace(/\//g, '-');
    const labId = report.labId.slice(0, 8);
    return `hcquality_backup_${labId}_${date}.pdf`;
}
function formatDateBR(d) {
    return d.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}
//# sourceMappingURL=emailService.js.map