/**
 * signatureCanonical.ts (server — labApoio module)
 *
 * Server-side SHA-256 signature generation for lab-apoio contracts.
 * Mirrors turnos pattern: deterministic over (labId, cnpj, vigenciaInicio, vigenciaFim, ts).
 *
 * Garantia chave: assinatura é imutável post-creation; chainHash trigger
 * valida continuidade em audit events.
 */

import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

export type ContratoPayload = Record<string, string | number>;

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: admin.firestore.Timestamp;
}

export function sortedStringify(payload: ContratoPayload): string {
  const sorted: ContratoPayload = {};
  for (const key of Object.keys(payload).sort()) {
    sorted[key] = payload[key];
  }
  return JSON.stringify(sorted);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Gera assinatura server-side para contrato.
 * Canonical payload: labId, cnpj, vigenciaInicio, vigenciaFim, ts (em ms).
 */
export function generateContratoSignatureServer(
  operatorId: string,
  labId: string,
  cnpj: string,
  vigenciaInicio: string,
  vigenciaFim: string,
  ts: admin.firestore.Timestamp = admin.firestore.Timestamp.now(),
): LogicalSignature {
  const canonicalPayload = sortedStringify({
    cnpj,
    labId,
    vigenciaFim,
    vigenciaInicio,
  });

  const dataString = JSON.stringify({
    data: canonicalPayload,
    operatorId,
    ts: ts.toMillis(),
  });

  return {
    hash: sha256Hex(dataString),
    operatorId,
    ts,
  };
}
