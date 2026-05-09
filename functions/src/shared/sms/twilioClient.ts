/**
 * Twilio SMS Client Integration
 * Phase 5 (W2-A4): SMS delivery for critical value escalations
 *
 * Exports TwilioSMSClient class with methods:
 * - sendSMS(to, body, labId) → Promise<SmsResult>
 * - sendBulkSMS(recipients, body, labId) → Promise<SmsResult[]>
 * - getMessageStatus(sid) → Promise<'delivered'|'failed'|'pending'>
 *
 * Features:
 * - E.164 phone validation (+55 format for Brazil)
 * - Retry logic: max 2 retries on network error; fail-fast on validation
 * - Typed errors: ValidationError, NetworkError, QuotaError
 * - Audit metadata: timestamp + labId in logging
 *
 * Requires secrets in Firebase Secret Manager:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER (regional São Paulo)
 */

import twilio from 'twilio';
import { defineSecret } from 'firebase-functions/params';

// ─── Error Classes ────────────────────────────────────────────────────────────

export class TwilioError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'TwilioError';
  }
}

export class ValidationError extends TwilioError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', false);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends TwilioError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', true);
    this.name = 'NetworkError';
  }
}

export class QuotaError extends TwilioError {
  constructor(message: string) {
    super(message, 'QUOTA_ERROR', true);
    this.name = 'QuotaError';
  }
}

// ─── Secrets ──────────────────────────────────────────────────────────────────

const ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN');
const PHONE_NUMBER = defineSecret('TWILIO_PHONE_NUMBER');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmsResult {
  sid: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  sentAt: number; // Unix timestamp in ms
  errorCode?: string;
  errorMessage?: string;
}

export interface SmsStatusResponse {
  status: 'delivered' | 'failed' | 'pending' | 'unknown';
  errorCode?: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

let cachedClient: any = null;

function createTwilioClient() {
  if (cachedClient) return cachedClient;

  const accountSid = ACCOUNT_SID.value();
  const authToken = AUTH_TOKEN.value();

  if (!accountSid || !authToken) {
    throw new ValidationError(
      'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set',
    );
  }

  cachedClient = twilio(accountSid, authToken);
  return cachedClient;
}

export class TwilioSMSClient {
  constructor(private maxRetries: number = 2) {}

  /**
   * Validates phone number in E.164 format (+55XXXXXXXXXXX for Brazil)
   */
  private validatePhoneNumber(phone: string): void {
    if (!phone.match(/^\+\d{1,15}$/)) {
      throw new ValidationError(
        `Invalid phone format: ${phone}. Must be E.164 format (e.g., +5511999999999)`,
      );
    }
  }

  /**
   * Sends a single SMS with retry logic and audit logging
   */
  async sendSMS(
    to: string,
    body: string,
    labId: string,
  ): Promise<SmsResult> {
    // Validate input
    this.validatePhoneNumber(to);

    if (!body || body.trim().length === 0) {
      throw new ValidationError('SMS body cannot be empty');
    }

    if (!labId || labId.trim().length === 0) {
      throw new ValidationError('labId is required for audit trail');
    }

    const sentAt = Date.now();
    let lastError: Error | null = null;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const client = createTwilioClient();
        const from = PHONE_NUMBER.value();

        const result = await client.messages.create({
          body,
          from,
          to,
          statusCallback: `https://southamerica-east1-hmatologia2.cloudfunctions.net/escalacao_sms_webhook`,
        });

        console.info(
          `[SMS] sent to ${to} labId=${labId} sid=${result.sid} status=${result.status}`,
        );

        return {
          sid: result.sid,
          status: result.status,
          sentAt,
        };
      } catch (error: any) {
        lastError = error;

        // Classify error and decide on retry
        const isNetworkError =
          error.code === 20107 || // Invalid To Parameter
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('ENOTFOUND');

        const isQuotaError = error.code === 20009; // Rate limit exceeded

        if (attempt < this.maxRetries && (isNetworkError || isQuotaError)) {
          const backoffMs = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        // No more retries or non-retryable error
        break;
      }
    }

    // Log failure with audit trail
    const errorCode = lastError?.code || 'UNKNOWN_ERROR';
    const errorMessage = lastError?.message || 'Unknown error';

    console.error(
      `[SMS] FAILED to ${to} labId=${labId} after ${this.maxRetries + 1} attempts: ${errorCode} - ${errorMessage}`,
    );

    return {
      sid: '',
      status: 'failed',
      sentAt,
      errorCode,
      errorMessage,
    };
  }

  /**
   * Sends SMS to multiple recipients sequentially
   */
  async sendBulkSMS(
    recipients: string[],
    body: string,
    labId: string,
  ): Promise<SmsResult[]> {
    if (!recipients || recipients.length === 0) {
      throw new ValidationError('Recipients list cannot be empty');
    }

    const results: SmsResult[] = [];

    for (const recipient of recipients) {
      const result = await this.sendSMS(recipient, body, labId);
      results.push(result);
    }

    return results;
  }

  /**
   * Checks the delivery status of an SMS by message SID
   */
  async getMessageStatus(messageSid: string): Promise<SmsStatusResponse> {
    if (!messageSid || messageSid.trim().length === 0) {
      throw new ValidationError('messageSid cannot be empty');
    }

    try {
      const client = createTwilioClient();
      const message = await client.messages(messageSid).fetch();

      // Map Twilio status to our canonical status
      let status: 'delivered' | 'failed' | 'pending' | 'unknown' = 'unknown';

      if (message.status === 'delivered') {
        status = 'delivered';
      } else if (
        message.status === 'failed' ||
        message.status === 'undelivered'
      ) {
        status = 'failed';
      } else if (
        message.status === 'queued' ||
        message.status === 'sending' ||
        message.status === 'sent'
      ) {
        status = 'pending';
      }

      console.info(
        `[SMS] status check sid=${messageSid} status=${status} twilioStatus=${message.status}`,
      );

      return {
        status,
        ...(message.errorCode ? { errorCode: String(message.errorCode) } : {}),
      };
    } catch (error: any) {
      console.error(`[SMS] status check failed sid=${messageSid}: ${error.message}`);

      return {
        status: 'unknown',
        errorCode: error.code || 'STATUS_CHECK_ERROR',
      };
    }
  }
}

// ─── Template Helper ──────────────────────────────────────────────────────────

/**
 * Generates SMS template for critical value escalation
 * Optimized for 160 character limit
 */
export function generateCriticalValueSMSTemplate(
  analitoNome: string,
  pacienteNome: string,
  valor: number,
  unidade: string,
  laudoId: string,
): string {
  const shortLaudoId = laudoId.substring(0, 8);
  // Format within ~160 chars: HC Qualidade CRÍTICO\nPaciente: {name}\nAnalito: {analyte}\nValor: {value} {unit}\nRef: {laudoId}
  return `HC Qualidade CRÍTICO\nPaciente: ${pacienteNome}\nAnalito: ${analitoNome}\nValor: ${valor} ${unidade}\nRef: ${shortLaudoId}`;
}

// ─── Legacy function exports (for backward compatibility) ─────────────────────

/**
 * @deprecated Use TwilioSMSClient.sendSMS() instead
 */
export async function sendSMS(
  toNumber: string,
  message: string,
): Promise<{
  sid: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  errorCode?: string;
}> {
  const client = new TwilioSMSClient();
  const result = await client.sendSMS(toNumber, message, 'unknown');
  return {
    sid: result.sid,
    status: result.status,
    ...(result.errorCode ? { errorCode: result.errorCode } : {}),
  };
}

/**
 * @deprecated Use TwilioSMSClient.getMessageStatus() instead
 */
export async function checkMessageStatus(sid: string): Promise<{
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
}> {
  const client = new TwilioSMSClient();
  const result = await client.getMessageStatus(sid);

  // Map back to legacy status strings
  const legacyStatus =
    result.status === 'delivered'
      ? 'delivered'
      : result.status === 'failed'
        ? 'failed'
        : result.status === 'pending'
          ? 'queued'
          : 'undelivered';

  return {
    status: legacyStatus as any,
    ...(result.errorCode ? { errorCode: result.errorCode } : {}),
  };
}

/**
 * @deprecated Use generateCriticalValueSMSTemplate() instead
 */
export async function getSMSTemplate(
  analitoNome: string,
  pacienteNome: string,
  valor: number,
  unidade: string,
  laudoId: string,
): Promise<string> {
  return generateCriticalValueSMSTemplate(
    analitoNome,
    pacienteNome,
    valor,
    unidade,
    laudoId,
  );
}
