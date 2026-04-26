/**
 * signatureCanonical.ts (server — controleTemperatura)
 *
 * Espelho do algoritmo em
 * `src/features/controle-temperatura/services/ctSignatureService.ts`.
 *
 * Garantia chave: dado o mesmo `payload` (sortedStringify) + `operatorId` +
 * `ts.toMillis()`, server e cliente produzem o MESMO hash SHA-256. Preserva
 * `verifyCtSignature` no front pra auditoria de docs históricos.
 *
 * Diferenças intencionais vs cliente:
 *   - `node:crypto` síncrono em vez de `crypto.subtle` assíncrono
 *   - `ts` é `admin.firestore.Timestamp.now()` — server é fonte da verdade
 */

import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

export type CtPayload = Record<string, string | number>;

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: admin.firestore.Timestamp;
}

export function sortedStringify(payload: CtPayload): string {
  const sorted: CtPayload = {};
  for (const key of Object.keys(payload).sort()) {
    sorted[key] = payload[key];
  }
  return JSON.stringify(sorted);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateCtSignatureServer(
  operatorId: string,
  payload: CtPayload,
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
