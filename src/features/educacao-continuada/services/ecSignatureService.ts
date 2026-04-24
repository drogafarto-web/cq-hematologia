/**
 * ecSignatureService.ts
 *
 * **Fase 0b + 0c (2026-04-24):** geração de assinatura foi movida para Cloud
 * Functions (`ec_mintSignature`, `ec_commit*`, `ec_registrar*`). Este módulo
 * agora só expõe `verifyEcSignature` para auditoria UI sobre documentos
 * existentes. Algoritmo permanece byte-equal ao do server — validação
 * client/server round-trip mantida.
 *
 * Limpeza 2026-04-24: `generateEcSignature` removida (zero callers após Fase
 * 0b). Rollback histórico via `git revert` do commit de limpeza.
 */

import type { LogicalSignature } from '../types/_shared_refs';

export type EcSignaturePayload = Record<string, string | number>;

function sortedStringify(data: EcSignaturePayload): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<EcSignaturePayload>((acc, key) => {
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
 * Valida que `signature.hash` bate com o `payload` informado. Usado por UI de
 * auditoria para exibir ✓/✗ em documentos históricos. Retorna false em hash
 * inválido OU payload diferente do original assinado.
 */
export async function verifyEcSignature(
  signature: LogicalSignature,
  payload: EcSignaturePayload,
): Promise<boolean> {
  const dataString = JSON.stringify({
    operatorId: signature.operatorId,
    ts: signature.ts.toMillis(),
    data: sortedStringify(payload),
  });
  const expected = await sha256Hex(dataString);
  return expected === signature.hash;
}
