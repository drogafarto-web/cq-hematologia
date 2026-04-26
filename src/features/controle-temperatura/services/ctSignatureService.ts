/**
 * ctSignatureService.ts
 *
 * Pós-CT-01 (2026-04-24): geração de assinatura migrada pra callable server
 * `ct_commitLeitura`. Este arquivo mantém APENAS `verifyCtSignature` — útil
 * pra auditoria UI de docs históricos e também pra smoke tests do próprio
 * algoritmo espelho (server em `functions/src/modules/controleTemperatura/
 * signatureCanonical.ts` produz o mesmo hash).
 *
 * ⚠️ Não reintroduzir `generateCtSignature` aqui. A assinatura é emitida
 * EXCLUSIVAMENTE pelo server a partir de agora (RDC 978/2025 compliance
 * real — não mais theater). Tentativa de forja client-side falha nas rules
 * porque `/leituras` e `/ncs` têm `allow create: if false`.
 */

import type { LogicalSignature } from '../types/_shared_refs';

export type CtSignaturePayload = Record<string, string | number>;

function sortedStringify(data: CtSignaturePayload): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<CtSignaturePayload>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Recalcula o hash a partir de `operatorId + ts + payload` e compara com o
 * hash armazenado. Usado pela UI de auditoria pra exibir "assinatura válida
 * ✅ / adulterada ❌" em docs já gravados.
 */
export async function verifyCtSignature(
  signature: LogicalSignature,
  payload: CtSignaturePayload,
): Promise<boolean> {
  const dataString = JSON.stringify({
    operatorId: signature.operatorId,
    ts: signature.ts.toMillis(),
    data: sortedStringify(payload),
  });
  const expected = await sha256Hex(dataString);
  return expected === signature.hash;
}
