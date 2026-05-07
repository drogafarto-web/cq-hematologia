/**
 * SMTP Client — Unified email delivery helper
 *
 * Single source of truth for SMTP transport configuration across all
 * Cloud Functions that send transactional email. Replaces the previous
 * Resend integration (decision 2026-05-07: consolidate on SMTP).
 *
 * SMTP credentials live exclusively in Firebase Secret Manager:
 *   SMTP_HOST · SMTP_USER · SMTP_PASS · SMTP_PORT
 *
 * Cloud Functions consuming this module must declare the secrets in
 * their function options:
 *
 *   import { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT, sendEmail }
 *     from '../../shared/email/smtpClient';
 *
 *   export const myFn = onSchedule(
 *     { secrets: [SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT], ... },
 *     async () => { await sendEmail({ to, subject, html }); }
 *   );
 *
 * For convenience, ALL_SMTP_SECRETS is exported as a tuple of the four
 * SecretParam objects to be spread directly into the `secrets` array.
 */

import * as nodemailer from 'nodemailer';
import { defineSecret } from 'firebase-functions/params';

// ─── Secrets ──────────────────────────────────────────────────────────────────
// Single declaration site. All callers import these from here.
export const SMTP_HOST = defineSecret('SMTP_HOST');
export const SMTP_USER = defineSecret('SMTP_USER');
export const SMTP_PASS = defineSecret('SMTP_PASS');
export const SMTP_PORT = defineSecret('SMTP_PORT');

/** Spread this into a function's `secrets` option to bind all four. */
export const ALL_SMTP_SECRETS = [
  SMTP_HOST,
  SMTP_USER,
  SMTP_PASS,
  SMTP_PORT,
] as const;

// ─── Transporter ──────────────────────────────────────────────────────────────

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedKey: string | null = null;

/**
 * Returns a configured nodemailer Transporter. Cached per-process while
 * SMTP secret values are stable. SMTP secrets are resolved lazily — call
 * only inside a function handler that has declared the SMTP secrets.
 */
export function getSmtpTransporter(): nodemailer.Transporter {
  const host = SMTP_HOST.value();
  const port = parseInt(SMTP_PORT.value(), 10);
  const user = SMTP_USER.value();
  const pass = SMTP_PASS.value();

  if (!host || !user || !pass || !Number.isFinite(port)) {
    throw new Error(
      '[smtpClient] SMTP secrets not configured (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT required)',
    );
  }

  // Cache by stringified config so secret rotation invalidates cleanly.
  const key = `${host}:${port}:${user}`;
  if (cachedTransporter && cachedKey === key) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // implicit TLS on 465; STARTTLS on 587
    auth: { user, pass },
  });
  cachedKey = key;
  return cachedTransporter;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  /** Buffer or string content. Pass a Buffer for PDFs and other binary. */
  content: Buffer | string;
}

export interface SendEmailOptions {
  /** RFC-5321 mailbox or display-name <addr> form. Defaults to "HC Quality" <SMTP_USER>. */
  from?: string;
  /** One or more recipients. Empty array throws. */
  to: string | string[];
  subject: string;
  /** HTML body. Required. */
  html: string;
  /** Optional plain-text fallback. */
  text?: string;
  /** Optional file attachments (PDFs, etc). */
  attachments?: EmailAttachment[];
}

/**
 * Sends an email via the configured SMTP transport.
 *
 * Throws on misconfiguration (missing secrets) or transport failure.
 * Caller decides whether the failure is fatal (e.g. liberacao critical
 * paths) or should be logged and swallowed (e.g. scheduled alerts).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  if (recipients.length === 0) {
    throw new Error('[sendEmail] recipients list is empty');
  }

  const transporter = getSmtpTransporter();
  const fromUser = SMTP_USER.value();
  const from = opts.from ?? `"HC Quality" <${fromUser}>`;

  await transporter.sendMail({
    from,
    to: recipients,
    subject: opts.subject,
    html: opts.html,
    ...(opts.text ? { text: opts.text } : {}),
    ...(opts.attachments && opts.attachments.length > 0
      ? { attachments: opts.attachments }
      : {}),
  });
}
