/**
 * shared/tokenUtils — short-lived signed tokens for public NPS/feedback flows
 *
 * Token format: base64url(payload).hmac
 *   payload = { reclamacaoId?, labId, pacienteId?, exp }  (JSON)
 *   hmac    = HMAC-SHA256(secret, payloadB64url) → hex
 *
 * Tokens are stateless — no Firestore lookup required to validate.
 */

import * as crypto from 'crypto';

const SECRET_ENV = 'NPS_TOKEN_SECRET';
const DEFAULT_SECRET = 'hcquality-emulator-nps-secret';

function getSecret(): string {
  return process.env[SECRET_ENV] || DEFAULT_SECRET;
}

interface NPSTokenPayload {
  labId: string;
  reclamacaoId?: string;
  pacienteId?: string;
  exp: number; // ms epoch
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/**
 * Generate a signed NPS token tied to a reclamação or paciente.
 * @param reclamacaoIdOrPacienteId — context id (reclamação for pos-resolução, paciente for trimestral)
 * @param labId — owning lab
 * @param ttlMs — time-to-live in ms (e.g., 14*24*60*60*1000 for 14 days)
 */
export async function generateNPSToken(
  reclamacaoIdOrPacienteId: string,
  labId: string,
  ttlMs: number,
): Promise<string> {
  const payload: NPSTokenPayload = {
    labId,
    reclamacaoId: reclamacaoIdOrPacienteId,
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload)));
  const hmac = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('hex');
  return `${payloadB64}.${hmac}`;
}

/**
 * Verify and decode an NPS token. Returns null if invalid/expired.
 */
export async function verifyNPSToken(
  token: string,
): Promise<{ labId: string; reclamacaoId?: string; pacienteId?: string } | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, hmac] = parts;

  const expectedHmac = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('hex');

  // Constant-time compare
  try {
    if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null;
    }
  } catch {
    return null;
  }

  let payload: NPSTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf-8'));
  } catch {
    return null;
  }

  if (!payload.exp || Date.now() > payload.exp) return null;

  return {
    labId: payload.labId,
    reclamacaoId: payload.reclamacaoId,
    pacienteId: payload.pacienteId,
  };
}
