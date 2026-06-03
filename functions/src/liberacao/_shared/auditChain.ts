/**
 * Audit chain helper — segue padrão ADR 0001
 * Server-side calcula chainHash usando Node.js crypto
 * Client-side dupla check (não confia no client)
 *
 * Sequência: Genesis (00...0) → v1 → v2 → v3 ...
 * Cada hash: SHA-256(prevChainHash + payload canonical)
 */

import { createHash } from 'crypto';

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
 * Calcula SHA-256 de um input usando Node.js crypto
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Calcula chainHash: SHA-256(prevHash + canonical(payload))
 * Determinístico (mesma entrada → mesmo output)
 *
 * @param prevChainHash Hash anterior na sequência
 * @param payload Dados a hashear
 * @returns SHA-256 de 64 caracteres hexadecimais
 */
export function calculateChainHash(prevChainHash: string, payload: any): string {
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
