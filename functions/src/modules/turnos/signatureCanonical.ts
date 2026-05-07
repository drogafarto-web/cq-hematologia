/**
 * signatureCanonical.ts (server — turnos module)
 *
 * Server-side SHA-256 signature generation mirroring the client-side algorithm
 * in `src/utils/logicalSignature.ts`.
 *
 * Garantia chave: dado o mesmo `payload` (sortedStringify) + `operatorId` +
 * `ts.toMillis()`, server e cliente produzem o MESMO hash SHA-256.
 *
 * Diferenças intencionais vs cliente:
 *   - `node:crypto` síncrono em vez de `crypto.subtle` assíncrono
 *   - `ts` é `admin.firestore.Timestamp.now()` — server é fonte da verdade
 */

import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

export type TurnoPayload = Record<string, string | number>;

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: admin.firestore.Timestamp;
}

export function sortedStringify(payload: TurnoPayload): string {
  const sorted: TurnoPayload = {};
  for (const key of Object.keys(payload).sort()) {
    sorted[key] = payload[key];
  }
  return JSON.stringify(sorted);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateTurnosSignatureServer(
  operatorId: string,
  payload: TurnoPayload,
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
