import type { Timestamp } from 'firebase/firestore';

/**
 * Ordena as chaves de confirmedData antes de serializar para garantir
 * assinatura determinística entre engines JS.
 */
function sortedStringify(data: Record<string, number>): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, number>>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

/**
 * Gera assinatura lógica SHA-256 de uma corrida confirmada.
 *
 * ⚠️ Compliance RDC 978: esta implementação roda no cliente e pode ser
 * recalculada via DevTools. Para compliance real mover a geração para uma
 * Cloud Function com Admin SDK antes do go-live.
 */
export async function generateLogicalSignature(
  operatorId: string,
  confirmedAt: Timestamp,
  confirmedData: Record<string, number>,
): Promise<string> {
  const dataString = JSON.stringify({
    operatorId,
    ts: confirmedAt.toMillis(),
    data: sortedStringify(confirmedData),
  });

  const encoder = new TextEncoder();
  const encoded = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifySignature(
  signature: string,
  operatorId: string,
  confirmedAt: Timestamp,
  confirmedData: Record<string, number>,
): Promise<boolean> {
  const expected = await generateLogicalSignature(operatorId, confirmedAt, confirmedData);
  return signature === expected;
}
