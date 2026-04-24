/**
 * ctSignatureService.ts
 *
 * Gera e verifica `LogicalSignature` no formato usado pelas entidades
 * auditáveis deste módulo — mesmo algoritmo do `ecSignatureService`.
 *
 * Divergente da `generateLogicalSignature` global (`src/utils/logicalSignature.ts`)
 * em dois pontos intencionais:
 *   1. Aceita payload `Record<string, string | number>` — IDs de entidades
 *      (equipamentoId, leituraId) são strings e fazem parte essencial do
 *      que precisa ser assinado.
 *   2. Retorna wrapper `{ hash, operatorId, ts }` em vez de só o hash — a
 *      verificação futura (auditoria, Cloud Function) não precisa reabrir o
 *      doc pai para descobrir quando/quem assinou.
 *
 * ⚠️ Compliance RDC 978/2025: esta implementação roda no cliente e pode ser
 * recalculada via DevTools. Migração para Cloud Function Admin SDK fica
 * pendente (débito técnico CT-01) — mesmo gap do módulo Educação Continuada
 * antes da Fase 0b.
 */

import { Timestamp } from '../../../shared/services/firebase';
import type { LogicalSignature, UserId } from '../types/_shared_refs';

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

export async function generateCtSignature(
  operatorId: UserId,
  payload: CtSignaturePayload,
): Promise<LogicalSignature> {
  const ts = Timestamp.now();
  const dataString = JSON.stringify({
    operatorId,
    ts: ts.toMillis(),
    data: sortedStringify(payload),
  });
  const hash = await sha256Hex(dataString);
  return { hash, operatorId, ts };
}

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
