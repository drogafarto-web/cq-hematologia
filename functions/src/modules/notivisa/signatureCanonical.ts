/**
 * signatureCanonical.ts (server — notivisa)
 *
 * Espelho do algoritmo em `src/shared/notivisa/signatureCanonical.ts`.
 *
 * Garantia chave: dado o mesmo `payload` (sortedStringify) + `operatorId` +
 * `ts.toMillis()`, server e cliente produzem o MESMO hash SHA-256. Preserva
 * `verifyNotivisaSignature` no front pra auditoria de docs históricos.
 *
 * Diferenças intencionais vs cliente:
 *   - `node:crypto` síncrono em vez de `crypto.subtle` assíncrono
 *   - `ts` é `admin.firestore.Timestamp.now()` — server é fonte da verdade
 *
 * ADR-0026 compliance: RDC 978 Art. 5.3 (audit trail) + DICQ 4.3 (versionamento)
 */

import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

export type NotivisaPayloadForSigning = Record<string, string | number>;

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: admin.firestore.Timestamp;
}

export function sortedStringify(payload: NotivisaPayloadForSigning): string {
  const sorted: NotivisaPayloadForSigning = {};
  for (const key of Object.keys(payload).sort()) {
    sorted[key] = payload[key];
  }
  return JSON.stringify(sorted);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateNotivisaSignatureServer(
  operatorId: string,
  payload: NotivisaPayloadForSigning,
  ts: admin.firestore.Timestamp = admin.firestore.Timestamp.now(),
): LogicalSignature {
  const dataString = JSON.stringify({
    operatorId,
    ts: ts.toMillis(),
    data: sortedStringify(payload),
  });
  return {
    hash: sha256Hex(dataString),
    operatorId,
    ts,
  };
}
