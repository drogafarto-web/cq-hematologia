/**
 * signatureCanonical.ts (server — criticos-config module)
 *
 * Server-authored SHA-256 LogicalSignature for threshold mutations.
 * Mirrors the canonical form used elsewhere in the codebase
 * (see functions/src/modules/risks/signatureCanonical.ts).
 *
 *   hash = sha256( JSON.stringify({
 *     operatorId,
 *     ts: timestamp.toMillis(),
 *     data: sortedStringify(payload),
 *   }) )
 */

import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

export type ThresholdPayload = Record<string, string | number | boolean | null>;

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: admin.firestore.Timestamp;
}

export function sortedStringify(payload: ThresholdPayload): string {
  const sorted: ThresholdPayload = {};
  for (const key of Object.keys(payload).sort()) {
    sorted[key] = payload[key];
  }
  return JSON.stringify(sorted);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateCriticosConfigSignature(
  operatorId: string,
  payload: ThresholdPayload,
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
