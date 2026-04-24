/**
 * signatureCanonical.ts (server)
 *
 * Espelho server-side do algoritmo em
 * `web/src/features/educacao-continuada/services/ecSignatureService.ts`.
 *
 * Garantia chave: dado o mesmo `payload` (sortedStringify) + `operatorId` +
 * `ts.toMillis()`, server e cliente produzem o MESMO hash SHA-256. Isso preserva
 * a `verifyEcSignature` no front (auditoria UI continua funcional para docs
 * históricos assinados client-side antes da Fase 0b).
 *
 * Diferenças intencionais vs cliente:
 *   - usa `node:crypto` (síncrono) em vez de `crypto.subtle` (assíncrono)
 *   - `ts` é `admin.firestore.Timestamp.now()` — server é fonte da verdade
 */

import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

export type EcPayload = Record<string, string | number>;

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: admin.firestore.Timestamp;
}

export function sortedStringify(payload: EcPayload): string {
  const sorted: EcPayload = {};
  for (const key of Object.keys(payload).sort()) {
    sorted[key] = payload[key];
  }
  return JSON.stringify(sorted);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateEcSignatureServer(
  operatorId: string,
  payload: EcPayload,
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

/**
 * Verifica que `signature.hash` bate com `payload`. Útil em handlers que
 * recebem assinaturas pré-computadas (não é o caso da Fase 0b — todas as
 * callables geram a assinatura internamente — mas mantido para auditoria).
 */
export function verifyEcSignatureServer(
  signature: LogicalSignature,
  payload: EcPayload,
): boolean {
  const dataString = JSON.stringify({
    operatorId: signature.operatorId,
    ts: signature.ts.toMillis(),
    data: sortedStringify(payload),
  });
  return sha256Hex(dataString) === signature.hash;
}
