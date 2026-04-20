"use strict";
// ─── CQI Email Template ───────────────────────────────────────────────────────
// Adjustment 2 (gap resolution): sendBackupEmail builds its own subject via
// buildSubject() — it cannot produce [CQI][SETOR] subjects. This module calls
// Resend directly, reusing RESEND_API_KEY declared via defineSecret (Firebase
// deduplicates secrets with the same name at deploy time, so declaring it here
// is safe and independent of emailService.ts).
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCQIEmail = sendCQIEmail;
const resend_1 = require("resend");
const params_1 = require("firebase-functions/params");
const RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
const TZ = 'America/Sao_Paulo';
const SECTOR_META = {
    hematologia: { headerColor: '#1e3a5f', label: 'HEMATOLOGIA' },
    imunologia: { headerColor: '#1a4731', label: 'IMUNOLOGIA' },
};
function meta(sector) {
    return SECTOR_META[sector] ?? { headerColor: '#374151', label: sector.toUpperCase() };
}
// ─── Subject ──────────────────────────────────────────────────────────────────
function buildSubject(opts) {
    const { sector, labName, date, lotNumber } = opts;
    const { label } = meta(sector);
    const dateStr = date.toLocaleDateString('pt-BR', {
        timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const shortLot = lotNumber.length > 14 ? `${lotNumber.slice(0, 14)}…` : lotNumber;
    return `[CQI][${label}] ${labName} · ${dateStr} · Lote #${shortLot}`;
}
// ─── Status line ──────────────────────────────────────────────────────────────
function statusLine(opts) {
    if (opts.hasRejections)
        return { icon: '❌', text: 'Corridas reprovadas registradas', color: '#dc2626' };
    if (opts.alertCount > 0)
        return { icon: '⚠️', text: 'Alertas Westgard presentes', color: '#d97706' };
    return { icon: '✅', text: 'Dentro do controle', color: '#16a34a' };
}
// ─── HTML body ────────────────────────────────────────────────────────────────
function buildHtml(opts) {
    const { labName, sector, lotNumber, date, totalRuns, analyteCount, alertCount } = opts;
    const m = meta(sector);
    const st = statusLine(opts);
    const dateStr = date.toLocaleDateString('pt-BR', {
        timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: TZ });
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#f3f4f6;margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:520px;margin:0 auto">

  <!-- Header colorido por setor -->
  <div style="background:${m.headerColor};border-radius:10px 10px 0 0;padding:24px 28px">
    <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:rgba(255,255,255,.5);text-transform:uppercase;margin-bottom:6px">
      RELATÓRIO CQI — ${m.label}
    </div>
    <div style="font-size:20px;font-weight:700;color:#ffffff;margin-bottom:4px">${labName}</div>
    <div style="font-size:13px;color:rgba(255,255,255,.65)">${dateStr} · Lote #${lotNumber}</div>
  </div>

  <!-- Corpo -->
  <div style="background:#ffffff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none">

    <!-- Status geral -->
    <div style="background:#f9fafb;border-left:4px solid ${st.color};border-radius:4px;padding:12px 16px;margin-bottom:20px">
      <span style="font-size:14px;font-weight:700;color:${st.color}">${st.icon} ${st.text}</span>
    </div>

    <!-- Resumo numérico -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="color:#6b7280;font-size:12px;padding:5px 0;border-bottom:1px solid #f3f4f6">Corridas realizadas</td>
        <td style="color:#111827;font-size:12px;font-weight:700;text-align:right;border-bottom:1px solid #f3f4f6">${totalRuns}</td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:12px;padding:5px 0;border-bottom:1px solid #f3f4f6">Analitos monitorados</td>
        <td style="color:#111827;font-size:12px;font-weight:700;text-align:right;border-bottom:1px solid #f3f4f6">${analyteCount}</td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:12px;padding:5px 0">Alertas Westgard</td>
        <td style="color:${alertCount > 0 ? '#d97706' : '#16a34a'};font-size:12px;font-weight:700;text-align:right">${alertCount}</td>
      </tr>
    </table>

    <!-- Nota de anexo -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px 16px;font-size:12px;color:#0369a1">
      📎 Relatório PDF completo em anexo — inclui gráficos de Levey-Jennings e estatísticas por analito.
    </div>
  </div>

  <!-- Rodapé -->
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:14px 28px">
    <p style="color:#9ca3af;font-size:10px;margin:0">
      Relatório PDF completo em anexo · Gerado automaticamente às 23:00 BRT · hc-quality
    </p>
    <p style="color:#d1d5db;font-size:10px;margin:4px 0 0">
      Gerado em: ${generatedAt} · Este email foi enviado automaticamente. Não responda.
    </p>
  </div>

</div>
</body>
</html>`;
}
// ─── Attachment filename ──────────────────────────────────────────────────────
function buildFilename(opts) {
    const { label } = meta(opts.sector);
    const d = opts.date
        .toLocaleDateString('pt-BR', { timeZone: TZ })
        .replace(/\//g, '-');
    const safeName = opts.labName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    return `cqi_${label.toLowerCase()}_${safeName}_${d}.pdf`;
}
// ─── Send ─────────────────────────────────────────────────────────────────────
/**
 * Sends the daily CQI report email with a sector-specific subject and PDF attachment.
 * Uses Resend directly so it can produce the [CQI][SETOR] subject format that
 * sendBackupEmail cannot (it always builds its own subject internally).
 */
async function sendCQIEmail(opts) {
    const resend = new resend_1.Resend(RESEND_API_KEY.value());
    const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
    if (recipients.length === 0) {
        throw new Error('[sendCQIEmail] recipients list is empty');
    }
    const { error } = await resend.emails.send({
        from: 'HC Quality CQI <cqi@app.labclinmg.com.br>',
        to: recipients,
        subject: buildSubject(opts),
        html: buildHtml(opts),
        attachments: [
            {
                filename: buildFilename(opts),
                content: opts.pdfBuffer,
            },
        ],
    });
    if (error) {
        throw new Error(`[sendCQIEmail] Resend API error: ${JSON.stringify(error)}`);
    }
}
//# sourceMappingURL=cqiTemplate.js.map