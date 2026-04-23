/**
 * HMAC-SHA256 server-side signing + verification.
 *
 * Objetivo (Onda 5): fechar o gap de assinaturas client-only no logicalSignature
 * (CIQ runs) e payloadSignature (insumo-movimentacoes). Em dual-write:
 *   - Cliente continua assinando como hoje (SHA-256 do payload canônico)
 *   - Trigger server-side recomputa HMAC com chave secreta e grava `serverHmac`
 *   - Divergências são logadas em `auditLogs` (severity=warning)
 *   - Após janela de observação, rules endurecem para exigir `serverHmac` presente
 *
 * Segurança:
 *   - Chave HCQ_SIGNATURE_HMAC_KEY nunca exposta ao cliente
 *   - HMAC cobre tampering pós-create (Admin SDK bypassa rules)
 *   - Se a chave rotaciona, novos eventos usam nova chave — antigos permanecem
 *     verificáveis desde que a chave antiga seja mantida como `HCQ_SIGNATURE_HMAC_KEY_V0`
 *     (não coberto aqui — versão inicial usa chave única)
 */

import { createHmac } from 'crypto';
import { defineSecret } from 'firebase-functions/params';
import { canonicalStringify } from './canonical';

export const HCQ_SIGNATURE_HMAC_KEY = defineSecret('HCQ_SIGNATURE_HMAC_KEY');

export function computeHmac(key: string, payload: unknown): string {
  const canonical = canonicalStringify(payload);
  return createHmac('sha256', key).update(canonical).digest('hex');
}

export interface VerificationResult {
  ok: boolean;
  serverHmac: string;
  clientSignature: string | null;
  divergence: boolean;
}

/**
 * Compara a assinatura gravada pelo cliente contra o HMAC server-side.
 * Não rejeita — retorna resultado para o caller decidir (dual-write).
 */
export function verify(
  key: string,
  payload: unknown,
  clientSignature: string | null | undefined,
): VerificationResult {
  const serverHmac = computeHmac(key, payload);
  if (!clientSignature) {
    return {
      ok: false,
      serverHmac,
      clientSignature: null,
      divergence: false, // ausente não é divergência, é legacy
    };
  }
  // Comparação constant-time é ideal, mas crypto.timingSafeEqual exige buffers
  // de mesmo tamanho. Aqui ambos são sha256 hex (64 chars) → tratamos com
  // comparação simples, aceitável porque a chave é secreta.
  const ok = serverHmac === clientSignature;
  return {
    ok,
    serverHmac,
    clientSignature,
    divergence: !ok,
  };
}
