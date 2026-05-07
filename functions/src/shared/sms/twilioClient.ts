/**
 * Twilio SMS Client Integration
 * Phase 6: SMS delivery for critical value escalations
 *
 * Requires secrets:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER (regional: São Paulo)
 */

import twilio from 'twilio';
import { defineSecret } from 'firebase-functions/params';

const ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN');
const PHONE_NUMBER = defineSecret('TWILIO_PHONE_NUMBER');

let cachedClient: ReturnType<typeof twilio> | null = null;

export function createTwilioClient() {
  if (cachedClient) return cachedClient;

  try {
    cachedClient = twilio(ACCOUNT_SID.value(), AUTH_TOKEN.value());
    return cachedClient;
  } catch (error) {
    console.error('Failed to initialize Twilio client:', error);
    throw new Error('TWILIO_CLIENT_INIT_ERROR');
  }
}

export async function sendSMS(
  toNumber: string,
  message: string,
): Promise<{
  sid: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  errorCode?: string;
}> {
  try {
    // Validate E.164 format
    if (!toNumber.match(/^\+\d{1,15}$/)) {
      return {
        sid: '',
        status: 'failed',
        errorCode: 'INVALID_PHONE_FORMAT',
      };
    }

    const client = createTwilioClient();
    const result = await client.messages.create({
      body: message,
      from: PHONE_NUMBER.value(),
      to: toNumber,
      statusCallback: `https://southamerica-east1-hmatologia2.cloudfunctions.net/escalacaoCriticos_webhook`,
    });

    return {
      sid: result.sid,
      status: result.status as any,
    };
  } catch (error: any) {
    console.error('Twilio SMS send error:', error);
    return {
      sid: '',
      status: 'failed',
      errorCode: error.code || 'TWILIO_ERROR',
    };
  }
}

export async function checkMessageStatus(sid: string): Promise<{
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
}> {
  try {
    const client = createTwilioClient();
    const message = await client.messages(sid).fetch();

    return {
      status: message.status as any,
      errorCode: message.errorCode || undefined,
    };
  } catch (error: any) {
    console.error('Twilio status check error:', error);
    return {
      status: 'failed',
      errorCode: error.code || 'TWILIO_ERROR',
    };
  }
}

export async function getSMSTemplate(
  analitoNome: string,
  pacienteNome: string,
  valor: number,
  unidade: string,
  laudoId: string,
): Promise<string> {
  // SMS template (160 chars max)
  // Format: HC Qualidade CRÍTICO\nPaciente: {name}\nAnalito: {analyte}\nValor: {value} {unit}\nRef: {laudoId}\nResponda RECONHECER para confirmar

  const shortLaudoId = laudoId.substring(0, 8);
  const template = `HC Qualidade CRÍTICO\nPaciente: ${pacienteNome}\nAnalito: ${analitoNome}\nValor: ${valor} ${unidade}\nRef: ${shortLaudoId}`;

  return template;
}
