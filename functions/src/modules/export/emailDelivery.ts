/**
 * Email Delivery Module — Export Signed URL Delivery
 *
 * Sends a branded HTML email with the export download link via nodemailer SMTP.
 *
 * SMTP configuration is stored exclusively in Firebase Secret Manager.
 * Secrets are NEVER hardcoded, never in Firestore, never in environment variables.
 * (T-03.3-12 mitigation: SMTP credentials in Secret Manager only)
 *
 * LGPD compliance (Lei 13.709/2018):
 * - Email is sent only to the address explicitly provided by the lab operator
 * - Footer identifies the operator who requested the export
 * - Links to the lab's data privacy section in HC Quality
 *
 * Failure mode: non-fatal. If SMTP delivery fails, the export job is still
 * marked 'completed' and the signed URL is still available in the job record.
 * The backgroundWorker catches errors from sendExportEmail and updates
 * emailError on the job document without failing the overall job.
 */

import * as nodemailer from 'nodemailer';
import { defineSecret } from 'firebase-functions/params';

// SMTP secrets — stored in Firebase Secret Manager, resolved at runtime
const smtpHost = defineSecret('SMTP_HOST');
const smtpPort = defineSecret('SMTP_PORT');
const smtpUser = defineSecret('SMTP_USER');
const smtpPass = defineSecret('SMTP_PASS');

export interface ExportEmailPayload {
  recipientEmail: string;
  labName: string;
  /** Human-readable format label e.g. "XLSX — Corridas CIQ" */
  exportType: string;
  signedUrl: string;
  expiresAt: Date;
  operatorId: string;
}

/**
 * Formats a Date to Brazilian Portuguese long date format.
 * e.g. "15 de janeiro de 2026"
 */
function formatDatePtBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

/**
 * Builds the branded HTML email body.
 * Design tokens: dark bg #0a0a0a, violet-500 #6366f1, emerald-500 #10b981
 */
function buildEmailHTML(payload: ExportEmailPayload): string {
  const expiryFormatted = formatDatePtBR(payload.expiresAt);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Exportação HC Quality</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#141417;border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <div style="display:inline-block;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:6px 14px;margin-bottom:20px;">
                <span style="color:#818cf8;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">HC Quality</span>
              </div>
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">
                Exportação pronta
              </h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.5;">
                Seu arquivo <strong style="color:rgba(255,255,255,0.8);">${payload.exportType}</strong> foi gerado com sucesso.
              </p>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:rgba(255,255,255,0.04);border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:rgba(255,255,255,0.35);">Laboratório</span><br/>
                          <span style="font-size:13px;color:rgba(255,255,255,0.85);font-weight:500;">${escapeHtml(payload.labName)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0 4px;">
                          <span style="font-size:12px;color:rgba(255,255,255,0.35);">Solicitado por</span><br/>
                          <span style="font-size:13px;color:rgba(255,255,255,0.85);font-weight:500;font-family:monospace;">${escapeHtml(payload.operatorId)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0 4px;">
                          <span style="font-size:12px;color:rgba(255,255,255,0.35);">Link expira em</span><br/>
                          <span style="font-size:13px;color:rgba(255,255,255,0.85);font-weight:500;">${expiryFormatted}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:0 32px 32px;" align="center">
              <a href="${payload.signedUrl}"
                 target="_blank"
                 rel="noopener noreferrer"
                 style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;
                        font-size:14px;font-weight:600;padding:14px 32px;border-radius:10px;
                        letter-spacing:0.01em;transition:background 150ms ease;">
                Baixar arquivo
              </a>
              <p style="margin:16px 0 0;font-size:11px;color:rgba(255,255,255,0.3);">
                O link expirará em 7 dias. Após esse prazo, gere uma nova exportação no sistema.
              </p>
            </td>
          </tr>

          <!-- LGPD Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);line-height:1.6;">
                Este email foi enviado automaticamente pelo <strong style="color:rgba(255,255,255,0.35);">HC Quality</strong>
                a pedido do operador <span style="font-family:monospace;">${escapeHtml(payload.operatorId)}</span>.<br/>
                Em conformidade com a <strong>LGPD (Lei 13.709/2018)</strong>, você pode exercer seus direitos de titular de dados
                (acesso, correção, exclusão) diretamente no sistema HC Quality na seção Privacidade de Dados.<br/>
                Este é um email transacional — não é possível cancelar a inscrição nesta categoria de mensagens.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Minimal HTML escaping to prevent XSS in email template */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sends the export download link to the recipient via SMTP.
 *
 * SMTP credentials are resolved from Firebase Secret Manager at call time.
 * Call this function only inside a Cloud Function that has declared
 * the smtpHost/smtpPort/smtpUser/smtpPass secrets.
 *
 * @param payload - Email content and metadata
 * @throws Error if SMTP connection or send fails (caller should handle non-fatally)
 */
export async function sendExportEmail(payload: ExportEmailPayload): Promise<void> {
  const host = smtpHost.value();
  const port = parseInt(smtpPort.value(), 10);
  const user = smtpUser.value();
  const pass = smtpPass.value();

  if (!host || !user || !pass) {
    throw new Error('SMTP secrets not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // TLS for port 465, STARTTLS for 587
    auth: {
      user,
      pass,
    },
  });

  const subject = `[HC Quality] Exportação pronta: ${payload.exportType} — ${payload.labName}`;
  const html = buildEmailHTML(payload);

  await transporter.sendMail({
    from: `"HC Quality" <${user}>`,
    to: payload.recipientEmail,
    subject,
    html,
  });

  console.log(
    `[EmailDelivery] Sent "${subject}" to ${payload.recipientEmail} for operator ${payload.operatorId}`,
  );
}
