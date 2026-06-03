/**
 * Audit chain helper — segue padrão ADR 0001
 * Client-side calcula chainHash; server-side dupla check (não confia no client)
 *
 * Sequência: Genesis (00...0) → v1 → v2 → v3 ...
 * Cada hash: SHA-256(prevChainHash + payload canonical)
 */

/**
 * Genesis hash — ponto de início da cadeia
 */
export const GENESIS_CHAIN_HASH = '0'.repeat(64);

/**
 * Canonicaliza um payload pra ser hasheado
 * Ordem de chaves importa pra determinismo
 */
export function canonicalizePayload(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort(), 0);
}

/**
 * Calcula SHA-256 de um input usando Web Crypto API
 * Browser compatible (não usa Node.js crypto)
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calcula chainHash: SHA-256(prevHash + canonical(payload))
 * Determinístico (mesma entrada → mesmo output)
 *
 * @param prevChainHash Hash anterior na sequência
 * @param payload Dados a hashear
 * @returns Promise<SHA-256 de 64 caracteres hexadecimais>
 */
export async function calculateChainHash(prevChainHash: string, payload: any): Promise<string> {
  const canonical = canonicalizePayload(payload);
  const combined = prevChainHash + canonical;
  return sha256(combined);
}

/**
 * Valida se um chainHash é válido
 * (64 caracteres hex, sem espaços/caracteres inválidos)
 */
export function isValidChainHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}
